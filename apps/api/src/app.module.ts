import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OwnershipModule } from './common/ownership/ownership.service';
import { AppConfig } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { AppLoggerModule } from './config/logger.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ExamsModule } from './modules/exams/exams.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AccessRequestsModule } from './modules/access-requests/access-requests.module';

import { ProgressModule } from './modules/progress/progress.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';
// backend-content
import { CoursesModule } from './modules/courses/courses.module';
import { DirectionsModule } from './modules/directions/directions.module';
import { FaqModule } from './modules/faq/faq.module';
import { FilesModule } from './modules/files/files.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { ModulesModule } from './modules/modules/modules.module';
import { PracticesModule } from './modules/practices/practices.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule,
    AppLoggerModule,
    PrismaModule,
    OwnershipModule,
    JwtModule.register({ global: true }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 20 }],
        skipIf: () => config.isTest,
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    AuditModule,
    NotificationsModule,
    AccessRequestsModule,

    // backend-learning
    ProgressModule,
    ExamsModule,
    CertificatesModule,
    ReportsModule,
    StudentsModule,

    // backend-content
    DirectionsModule,
    TeachersModule,
    FaqModule,
    CoursesModule,
    ModulesModule,
    LessonsModule,
    PracticesModule,
    QuestionsModule,
    FilesModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: authenticate first, then check roles. Deny-by-default; use @Public() to opt out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
