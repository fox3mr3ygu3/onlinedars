import { Logger, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { EskizSmsProvider } from './sms/eskiz-sms.provider';
import { SmsProvider } from './sms/sms-provider';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    PasswordService,
    TokenService,
    {
      provide: SmsProvider,
      inject: [AppConfig],
      useFactory: (config: AppConfig): SmsProvider => {
        if (config.hasEskiz) {
          return new EskizSmsProvider({
            email: config.env.ESKIZ_EMAIL as string,
            password: config.env.ESKIZ_PASSWORD as string,
            from: config.env.ESKIZ_FROM,
          });
        }
        if (config.isProduction) {
          new Logger('AuthModule').warn(
            'ESKIZ_EMAIL/ESKIZ_PASSWORD not set: SMS codes are only written to the log.',
          );
        }
        return new ConsoleSmsProvider();
      },
    },
  ],
  exports: [PasswordService, TokenService],
})
export class AuthModule {}
