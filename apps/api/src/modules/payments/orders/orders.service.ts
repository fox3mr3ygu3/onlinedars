import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AuthPrincipal,
  CourseStatus,
  type CreateOrderInput,
  type CreateOrderResponse,
  EnrollmentMode,
  EnrollmentSource,
  ErrorCode,
  type MyOrdersQuery,
  type OrderView,
  type Paginated,
  PaymentStatus,
  Role,
} from '@onlinedars/shared';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { assertOwnerOrRoles } from '../../../common/ownership/ownership.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CheckoutUrlService } from '../core/checkout-url';
import { getEnrollmentMode, ORDER_TTL_MS } from '../core/payments-db';

export const orderViewInclude = {
  course: { select: { title: true, slug: true } },
  enrollment: { select: { revokedAt: true } },
} satisfies Prisma.OrderInclude;

type OrderWithCourse = Prisma.OrderGetPayload<{ include: typeof orderViewInclude }>;

export function toOrderView(o: OrderWithCourse, enrolled?: boolean): OrderView {
  return {
    orderId: o.id,
    number: o.number,
    status: o.status,
    courseId: o.courseId,
    courseTitle: o.course.title,
    courseSlug: o.course.slug,
    amount: o.amount,
    currency: o.currency,
    provider: o.provider,
    enrolled: enrolled ?? Boolean(o.enrollment && !o.enrollment.revokedAt),
    paidAt: o.paidAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutUrlService,
  ) {}

  /**
   * Starts a purchase. Amount and currency are copied from the course in the DB (the client
   * sends only courseId + provider). A free course enrolls the student directly, no order.
   * An open order for the same course/provider/price with no provider transaction yet is reused.
   * Only allowed when the platform is in SELF_SERVICE mode; in ADMIN_ONLY mode (the default) access
   * comes from an admin grant only (Admin → Students), so this answers 403 ENROLLMENT_ADMIN_ONLY.
   */
  async create(
    principal: AuthPrincipal,
    input: CreateOrderInput,
    now: Date = new Date(),
  ): Promise<CreateOrderResponse> {
    if ((await getEnrollmentMode(this.prisma)) !== EnrollmentMode.SELF_SERVICE) {
      throw AppException.forbidden(ErrorCode.ENROLLMENT_ADMIN_ONLY);
    }
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, status: true, isFree: true, price: true, currency: true },
    });
    if (!course) throw AppException.notFound(ErrorCode.NOT_FOUND, 'Course not found');
    if (course.status !== CourseStatus.PUBLISHED) {
      throw AppException.badRequest(ErrorCode.COURSE_NOT_PURCHASABLE);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: principal.id, courseId: course.id } },
      select: { id: true, revokedAt: true },
    });
    if (enrollment && !enrollment.revokedAt)
      throw AppException.conflict(ErrorCode.ALREADY_ENROLLED);

    if (course.isFree || course.price === 0) {
      if (enrollment) {
        await this.prisma.enrollment.update({
          where: { id: enrollment.id },
          data: { revokedAt: null, source: EnrollmentSource.FREE, orderId: null, enrolledAt: now },
        });
      } else {
        await this.prisma.enrollment.create({
          data: { userId: principal.id, courseId: course.id, source: EnrollmentSource.FREE },
        });
      }
      return { enrolled: true, courseId: course.id };
    }

    if (!this.checkout.isAvailable(input.provider)) {
      throw new AppException(
        ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const reusable = await this.prisma.order.findFirst({
      where: {
        userId: principal.id,
        courseId: course.id,
        status: PaymentStatus.PENDING,
        provider: input.provider,
        amount: course.price,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    let order =
      reusable && (await this.prisma.payment.count({ where: { orderId: reusable.id } })) === 0
        ? await this.prisma.order.findUniqueOrThrow({ where: { id: reusable.id } })
        : null;
    order ??= await this.prisma.order.create({
      data: {
        userId: principal.id,
        courseId: course.id,
        amount: course.price,
        currency: course.currency,
        status: PaymentStatus.PENDING,
        provider: input.provider,
        expiresAt: new Date(now.getTime() + ORDER_TTL_MS),
      },
    });

    const redirectUrl = this.checkout.build(input.provider, {
      number: order.number,
      amount: order.amount,
      returnUrl: this.checkout.returnUrl(course.id, order.id),
    });
    return {
      enrolled: false,
      orderId: order.id,
      number: order.number,
      amount: order.amount,
      currency: order.currency,
      provider: input.provider,
      status: order.status,
      redirectUrl,
    };
  }

  /** The order status the web polls after the provider redirect. Owner or ADMIN only. */
  async getOne(principal: AuthPrincipal, orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderViewInclude,
    });
    if (!order) throw AppException.notFound(ErrorCode.ORDER_NOT_FOUND);
    assertOwnerOrRoles(principal, order.userId, [Role.ADMIN]);
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
      select: { revokedAt: true },
    });
    return toOrderView(order, Boolean(enrollment && !enrollment.revokedAt));
  }

  /** The signed-in student's own orders, newest first. */
  async listOwn(principal: AuthPrincipal, query: MyOrdersQuery): Promise<Paginated<OrderView>> {
    const where: Prisma.OrderWhereInput = {
      userId: principal.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderViewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((o) => toOrderView(o)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
