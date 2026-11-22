import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthPrincipal,
  type CreateOrderResponse,
  createOrderSchema,
  myOrdersQuerySchema,
  orderListSchema,
  orderSchema,
  type OrderView,
  type Paginated,
  Role,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles } from '../../../common/decorators';
import { OrdersService } from './orders.service';

export class CreateOrderDto extends createZodDto(createOrderSchema) {}
export class MyOrdersQueryDto extends createZodDto(myOrdersQuerySchema) {}
export class OrderDto extends createZodDto(orderSchema) {}
export class OrderListDto extends createZodDto(orderListSchema) {}

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  @Roles(Role.STUDENT, Role.CONTENT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Start a purchase. Paid course → { enrolled:false, orderId, number, amount, redirectUrl }; free course → { enrolled:true, courseId }.',
  })
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateOrderDto,
  ): Promise<CreateOrderResponse> {
    return this.orders.create(user, dto);
  }

  @Get('orders/:orderId')
  @Roles(Role.STUDENT, Role.CONTENT_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Order status (owner or ADMIN). The web polls this after the provider redirect.',
  })
  @ApiOkResponse({ type: OrderDto })
  getOne(
    @CurrentUser() user: AuthPrincipal,
    @Param('orderId') orderId: string,
  ): Promise<OrderView> {
    return this.orders.getOne(user, orderId);
  }

  @Get('me/orders')
  @Roles(Role.STUDENT, Role.CONTENT_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "The signed-in user's own orders / payment history" })
  @ApiOkResponse({ type: OrderListDto })
  listOwn(
    @CurrentUser() user: AuthPrincipal,
    @Query() query: MyOrdersQueryDto,
  ): Promise<Paginated<OrderView>> {
    return this.orders.listOwn(user, query);
  }
}
