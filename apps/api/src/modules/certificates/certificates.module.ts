import { Module, type Provider } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { CertificatePdfProcessor } from '../../jobs/certificate-pdf.processor';
import {
  BullmqCertificatePdfQueue,
  CertificatePdfQueue,
  InlineCertificatePdfQueue,
  redisUrlFromEnv,
} from '../../jobs/certificate-pdf.queue';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateTemplatesService } from './certificate-templates.service';
import {
  AdminCertificateTemplatesController,
  CertificatesPublicController,
  MeCertificatesController,
} from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { PdfRenderer, PuppeteerPdfRenderer } from './pdf/pdf-renderer';
import { CertificateStorage } from './storage/certificate-storage';
import { S3CertificateStorage } from './storage/s3-certificate-storage';

/** Rendering + storage, shared by the API (inline mode) and the worker. */
const pdfProviders: Provider[] = [
  CertificatePdfService,
  { provide: PdfRenderer, useFactory: () => new PuppeteerPdfRenderer() },
  {
    provide: CertificateStorage,
    inject: [AppConfig],
    useFactory: (config: AppConfig) => new S3CertificateStorage(config),
  },
];

@Module({
  controllers: [
    CertificatesPublicController,
    MeCertificatesController,
    AdminCertificateTemplatesController,
  ],
  providers: [
    ...pdfProviders,
    CertificatesService,
    CertificateTemplatesService,
    {
      provide: CertificatePdfQueue,
      inject: [CertificatePdfService],
      useFactory: (pdf: CertificatePdfService) => {
        const url = redisUrlFromEnv();
        return url ? new BullmqCertificatePdfQueue(url) : new InlineCertificatePdfQueue(pdf);
      },
    },
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}

/** Worker side: consumes the `certificate-pdf` queue. Registered in WorkerModule. */
@Module({
  providers: [...pdfProviders, CertificatePdfProcessor],
})
export class CertificatesWorkerModule {}
