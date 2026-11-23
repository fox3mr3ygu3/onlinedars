import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider';

/** Development / test SMS provider: writes messages to the log and keeps them in memory. */
@Injectable()
export class ConsoleSmsProvider extends SmsProvider {
  private readonly logger = new Logger('ConsoleSms');
  /** Last messages sent, newest last. Tests read OTP codes from here. */
  readonly outbox: { phone: string; text: string; at: Date }[] = [];

  async send(phone: string, text: string): Promise<void> {
    this.outbox.push({ phone, text, at: new Date() });
    if (this.outbox.length > 100) this.outbox.shift();
    this.logger.log(`SMS to ${phone}: ${text}`);
  }

  lastTo(phone: string): string | undefined {
    return [...this.outbox].reverse().find((m) => m.phone === phone)?.text;
  }
}
