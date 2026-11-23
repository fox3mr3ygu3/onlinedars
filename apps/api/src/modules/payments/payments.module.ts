import { Module } from '@nestjs/common';
import { AdminPaymentsController } from './admin/admin-payments.controller';
import { AdminPaymentsService } from './admin/admin-payments.service';
import { PaymentCallbacksController } from './callbacks.controller';
import { ClickService } from './click/click.service';
import { CheckoutUrlService } from './core/checkout-url';
import { PaymentsCoreModule } from './core/payments-core.module';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PaymeService } from './payme/payme.service';

@Module({
  imports: [PaymentsCoreModule],
  controllers: [OrdersController, PaymentCallbacksController, AdminPaymentsController],
  providers: [CheckoutUrlService, OrdersService, PaymeService, ClickService, AdminPaymentsService],
})
export class PaymentsModule {}
