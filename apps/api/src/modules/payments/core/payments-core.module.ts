import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { OrderFulfillmentService } from './order-fulfillment.service';
import {
  NoopPaymentStatusChecker,
  PaymentRecheckService,
  PaymentStatusChecker,
} from './payment-recheck.service';

/** Payment state machine shared by the API (callbacks, admin) and the worker (re-check job). */
@Module({
  imports: [NotificationsModule],
  providers: [
    OrderFulfillmentService,
    PaymentRecheckService,
    { provide: PaymentStatusChecker, useClass: NoopPaymentStatusChecker },
  ],
  exports: [OrderFulfillmentService, PaymentRecheckService, NotificationsModule],
})
export class PaymentsCoreModule {}
