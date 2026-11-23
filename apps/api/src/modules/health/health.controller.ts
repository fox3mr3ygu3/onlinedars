import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Used by Docker/Caddy/uptime checks. */
  @Public()
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: the database answers. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: 'ok' | 'error'; db: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: true };
    } catch {
      return { status: 'error', db: false };
    }
  }
}
