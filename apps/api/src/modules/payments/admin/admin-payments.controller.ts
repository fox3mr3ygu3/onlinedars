import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  adminPaymentListSchema,
  adminPaymentSchema,
  adminPaymentStatusChangeSchema,
  type AdminPaymentView,
  type AuthPrincipal,
  type Paginated,
  paymentListQuerySchema,
  Role,
} from '@onlinedars/shared';
import type { Request } from 'express';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles } from '../../../common/decorators';
import { AdminPaymentsService } from './admin-payments.service';

export class PaymentListQueryDto extends createZodDto(paymentListQuerySchema) {}
export class AdminPaymentStatusChangeDto extends createZodDto(adminPaymentStatusChangeSchema) {}
export class AdminPaymentDto extends createZodDto(adminPaymentSchema) {}
export class AdminPaymentListDto extends createZodDto(adminPaymentListSchema) {}

/** Payments are ADMIN-only (CONTENT_MANAGER sees content only). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Orders with their provider transactions, filtered and paginated' })
  @ApiOkResponse({ type: AdminPaymentListDto })
  list(@Query() query: PaymentListQueryDto): Promise<Paginated<AdminPaymentView>> {
    return this.payments.list(query);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Manual status change of an order (id = orderId); reason required, audited',
  })
  @ApiOkResponse({ type: AdminPaymentDto })
  changeStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AdminPaymentStatusChangeDto,
    @Req() req: Request,
  ): Promise<AdminPaymentView> {
    return this.payments.changeStatus(user, id, dto, {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }
}
