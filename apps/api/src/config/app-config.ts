import { type Env, parseEnv } from './env';

/** Typed, validated configuration. Inject `AppConfig` instead of reading process.env. */
export class AppConfig {
  constructor(readonly env: Env) {}

  static fromProcessEnv(): AppConfig {
    return new AppConfig(parseEnv(process.env));
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get corsOrigins(): string[] {
    const extra = (this.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [this.env.WEB_URL, ...extra];
  }

  /** True when Eskiz credentials exist; otherwise the console SMS provider is used. */
  get hasEskiz(): boolean {
    return Boolean(this.env.ESKIZ_EMAIL && this.env.ESKIZ_PASSWORD);
  }
}
