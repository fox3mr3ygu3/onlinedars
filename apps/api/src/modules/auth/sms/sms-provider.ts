/**
 * Sends SMS messages. Abstract class so it can be used as a Nest DI token.
 * Implementations: EskizSmsProvider (real, when ESKIZ_EMAIL/ESKIZ_PASSWORD are set) and
 * ConsoleSmsProvider (logs the message; used in dev/test and when credentials are absent).
 */
export abstract class SmsProvider {
  /** @param phone E.164, e.g. +998901234567 */
  abstract send(phone: string, text: string): Promise<void>;
}
