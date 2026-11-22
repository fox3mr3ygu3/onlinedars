import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

/** Renders an HTML document to a PDF. Abstract class = Nest DI token; tests provide a fake. */
export abstract class PdfRenderer {
  abstract render(html: string): Promise<Buffer>;
}

/** Minimal shape of the parts of puppeteer-core we use (keeps the import lazy and mockable). */
interface BrowserLike {
  newPage(): Promise<{
    setContent(
      html: string,
      opts: { waitUntil: 'networkidle0' | 'load'; timeout: number },
    ): Promise<void>;
    pdf(opts: Record<string, unknown>): Promise<Uint8Array>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
  connected?: boolean;
}

export type BrowserLauncher = () => Promise<BrowserLike>;

/** Launch options agreed with devops: system Chromium, non-root container without setuid sandbox. */
export function puppeteerLaunchOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  };
}

const defaultLauncher: BrowserLauncher = async () => {
  const puppeteer = await import('puppeteer-core');
  const opts = puppeteerLaunchOptions();
  if (!opts.executablePath) {
    throw new Error('PUPPETEER_EXECUTABLE_PATH is not set (path to Chrome/Chromium)');
  }
  return (await puppeteer.default.launch(opts)) as unknown as BrowserLike;
};

/** Puppeteer HTML → A4 landscape PDF. One browser per process, reused across jobs. */
@Injectable()
export class PuppeteerPdfRenderer extends PdfRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPdfRenderer.name);
  private browser: Promise<BrowserLike> | null = null;

  constructor(private readonly launch: BrowserLauncher = defaultLauncher) {
    super();
  }

  private getBrowser(): Promise<BrowserLike> {
    this.browser ??= this.launch().catch((err: unknown) => {
      this.browser = null;
      throw err;
    });
    return this.browser;
  }

  async render(html: string): Promise<Buffer> {
    let browser = await this.getBrowser();
    if (browser.connected === false) {
      this.browser = null;
      browser = await this.getBrowser();
    }
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
      const pdf = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browser) return;
    try {
      await (await this.browser).close();
    } catch (err) {
      this.logger.warn(`Closing Chromium failed: ${String(err)}`);
    }
  }
}
