import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider';

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';

export interface EskizOptions {
  email: string;
  password: string;
  from: string;
  /** Injected for tests. */
  fetchFn?: typeof fetch;
}

/**
 * Eskiz.uz SMS gateway. Logs in with email + password to get a bearer token (valid ~30 days),
 * caches it, and re-logs in once if a send returns 401.
 * Note: Eskiz only delivers texts that match a template approved in their cabinet.
 */
@Injectable()
export class EskizSmsProvider extends SmsProvider {
  private readonly logger = new Logger('EskizSms');
  private token: string | null = null;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: EskizOptions) {
    super();
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async send(phone: string, text: string): Promise<void> {
    let res = await this.post(phone, text);
    if (res.status === 401) {
      this.token = null;
      res = await this.post(phone, text);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Eskiz send failed: ${res.status} ${body.slice(0, 300)}`);
      throw new Error(`Eskiz SMS send failed with status ${res.status}`);
    }
  }

  private async post(phone: string, text: string): Promise<Response> {
    const token = await this.getToken();
    const form = new FormData();
    form.set('mobile_phone', phone.replace(/^\+/, ''));
    form.set('message', text);
    form.set('from', this.options.from);
    return this.fetchFn(`${ESKIZ_BASE_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    const form = new FormData();
    form.set('email', this.options.email);
    form.set('password', this.options.password);
    const res = await this.fetchFn(`${ESKIZ_BASE_URL}/auth/login`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Eskiz login failed with status ${res.status}`);
    const json = (await res.json()) as { data?: { token?: string } };
    const token = json.data?.token;
    if (!token) throw new Error('Eskiz login returned no token');
    this.token = token;
    return token;
  }
}
