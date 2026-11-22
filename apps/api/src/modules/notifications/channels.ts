import { Injectable, Logger } from '@nestjs/common';

/**
 * Optional outbound channels for notifications. Both default to no-op implementations;
 * bind a real provider (SMTP, Eskiz SMS, …) in NotificationsModule when one is chosen.
 */
export abstract class EmailSender {
  abstract send(to: string, subject: string, text: string): Promise<void>;
}

export abstract class NotificationSmsSender {
  abstract send(phone: string, text: string): Promise<void>;
}

@Injectable()
export class NoopEmailSender extends EmailSender {
  private readonly logger = new Logger('EmailSender');

  async send(to: string, subject: string): Promise<void> {
    this.logger.debug(`email (no-op) to=${to.replace(/^(.).*@/, '$1***@')} subject=${subject}`);
  }
}

@Injectable()
export class NoopNotificationSmsSender extends NotificationSmsSender {
  private readonly logger = new Logger('NotificationSms');

  async send(phone: string): Promise<void> {
    this.logger.debug(`sms (no-op) to=${phone.slice(0, 6)}***`);
  }
}
