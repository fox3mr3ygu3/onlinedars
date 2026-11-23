import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import {
  type ClickCompleteResponse,
  type ClickPrepareResponse,
  ClickService,
} from './click/click.service';
import { type PaymeResponse, PaymeService } from './payme/payme.service';

/**
 * Provider server-to-server callbacks. @Public (no JWT) because the providers authenticate
 * with their own scheme: Payme with Basic auth (merchant key), Click with the MD5 sign_string.
 * No throttling (the throttler is not global) so provider retries are never rejected.
 * Always HTTP 200: both providers read the result from the body.
 * Bodies are validated inside the services (not by the global zod pipe), because each
 * provider requires its own error format.
 */
@ApiTags('payment-callbacks')
@Public()
@Controller('payments')
export class PaymentCallbacksController {
  constructor(
    private readonly paymeService: PaymeService,
    private readonly clickService: ClickService,
  ) {}

  @Post('payme')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payme Merchant API (JSON-RPC). Auth: Basic Paycom:<PAYME_KEY>.' })
  payme(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<PaymeResponse> {
    return this.paymeService.handle(authorization, body);
  }

  @Post('click/prepare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Click SHOP-API Prepare (action=0), form-urlencoded, MD5 sign_string.' })
  clickPrepare(@Body() body: unknown): Promise<ClickPrepareResponse> {
    return this.clickService.prepare(body);
  }

  @Post('click/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Click SHOP-API Complete (action=1), form-urlencoded, MD5 sign_string.',
  })
  clickComplete(@Body() body: unknown): Promise<ClickCompleteResponse> {
    return this.clickService.complete(body);
  }
}
