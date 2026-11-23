import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@onlinedars/shared';
import { AppConfig } from '../../../config/app-config';

export const PAYME_CHECKOUT_URL = 'https://checkout.paycom.uz';
export const PAYME_CHECKOUT_TEST_URL = 'https://checkout.test.paycom.uz';
export const CLICK_CHECKOUT_URL = 'https://my.click.uz/services/pay';

export interface CheckoutOrder {
  /** Sequential order number = Payme `account.order_id` = Click `merchant_trans_id`. */
  number: number;
  /** Tiyin. */
  amount: number;
  returnUrl: string;
}

/** Tiyin → so'm string for Click ("150000" or "1500.50"). */
export function tiyinToSumString(tiyin: number): string {
  return tiyin % 100 === 0 ? String(tiyin / 100) : (tiyin / 100).toFixed(2);
}

/**
 * Payme checkout (GET): `https://checkout.paycom.uz/<base64("m=…;ac.order_id=…;a=…;l=uz;c=…")>`.
 * Amount in tiyin. The return URL must not contain `;`.
 */
export function buildPaymeCheckoutUrl(
  cfg: { merchantId: string; testMode: boolean },
  order: CheckoutOrder,
): string {
  const params = [
    `m=${cfg.merchantId}`,
    `ac.order_id=${order.number}`,
    `a=${order.amount}`,
    'l=uz',
    `c=${order.returnUrl.replaceAll(';', '%3B')}`,
  ].join(';');
  const base = cfg.testMode ? PAYME_CHECKOUT_TEST_URL : PAYME_CHECKOUT_URL;
  return `${base}/${Buffer.from(params, 'utf8').toString('base64')}`;
}

/** Click checkout: `https://my.click.uz/services/pay?service_id=…&merchant_id=…&amount=…`. Amount in so'm. */
export function buildClickCheckoutUrl(
  cfg: { serviceId: string; merchantId: string },
  order: CheckoutOrder,
): string {
  const q = new URLSearchParams({
    service_id: cfg.serviceId,
    merchant_id: cfg.merchantId,
    amount: tiyinToSumString(order.amount),
    transaction_param: String(order.number),
    return_url: order.returnUrl,
  });
  return `${CLICK_CHECKOUT_URL}?${q.toString()}`;
}

/** Builds provider redirect URLs from config. A provider without credentials is unavailable. */
@Injectable()
export class CheckoutUrlService {
  constructor(private readonly config: AppConfig) {}

  isAvailable(provider: PaymentProvider): boolean {
    const e = this.config.env;
    return provider === PaymentProvider.PAYME
      ? Boolean(e.PAYME_MERCHANT_ID && e.PAYME_KEY)
      : Boolean(e.CLICK_SERVICE_ID && e.CLICK_MERCHANT_ID && e.CLICK_SECRET_KEY);
  }

  /** Where the provider sends the browser back. The web page polls GET /orders/:id there. */
  returnUrl(courseId: string, orderId: string): string {
    const base = this.config.env.WEB_URL.replace(/\/+$/, '');
    return `${base}/checkout/${encodeURIComponent(courseId)}?orderId=${encodeURIComponent(orderId)}`;
  }

  build(provider: PaymentProvider, order: CheckoutOrder): string {
    const e = this.config.env;
    if (provider === PaymentProvider.PAYME) {
      return buildPaymeCheckoutUrl(
        { merchantId: e.PAYME_MERCHANT_ID ?? '', testMode: e.PAYME_TEST_MODE },
        order,
      );
    }
    return buildClickCheckoutUrl(
      { serviceId: e.CLICK_SERVICE_ID ?? '', merchantId: e.CLICK_MERCHANT_ID ?? '' },
      order,
    );
  }
}
