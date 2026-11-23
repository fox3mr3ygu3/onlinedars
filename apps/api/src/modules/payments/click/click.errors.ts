import { createHash } from 'node:crypto';
import { safeEqual } from '../core/secure-compare';

/** Click SHOP-API error codes (https://docs.click.uz/click-api-error/). */
export const ClickErrorCode = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;
export type ClickErrorCode = (typeof ClickErrorCode)[keyof typeof ClickErrorCode];

export const CLICK_ERROR_NOTES: Record<ClickErrorCode, string> = {
  [ClickErrorCode.SUCCESS]: 'Success',
  [ClickErrorCode.SIGN_CHECK_FAILED]: 'SIGN CHECK FAILED!',
  [ClickErrorCode.INCORRECT_AMOUNT]: 'Incorrect parameter amount',
  [ClickErrorCode.ACTION_NOT_FOUND]: 'Action not found',
  [ClickErrorCode.ALREADY_PAID]: 'Already paid',
  [ClickErrorCode.ORDER_NOT_FOUND]: 'User does not exist',
  [ClickErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction does not exist',
  [ClickErrorCode.FAILED_TO_UPDATE]: 'Failed to update user',
  [ClickErrorCode.BAD_REQUEST]: 'Error in request from click',
  [ClickErrorCode.TRANSACTION_CANCELLED]: 'Transaction cancelled',
};

export const ClickAction = { PREPARE: '0', COMPLETE: '1' } as const;

export class ClickError extends Error {
  constructor(readonly code: ClickErrorCode) {
    super(CLICK_ERROR_NOTES[code]);
  }
}

export interface ClickSignInput {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  /** Only in Complete. */
  merchant_prepare_id?: string;
  amount: string;
  action: string;
  sign_time: string;
}

/**
 * Prepare:  md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
 * Complete: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 * Values are concatenated exactly as received (amount keeps its original formatting).
 */
export function clickSignString(p: ClickSignInput, secretKey: string): string {
  const parts = [
    p.click_trans_id,
    p.service_id,
    secretKey,
    p.merchant_trans_id,
    ...(p.merchant_prepare_id !== undefined ? [p.merchant_prepare_id] : []),
    p.amount,
    p.action,
    p.sign_time,
  ];
  return createHash('md5').update(parts.join(''), 'utf8').digest('hex');
}

export function verifyClickSign(
  p: ClickSignInput & { sign_string: string },
  secretKey: string | undefined,
): boolean {
  if (!secretKey) return false;
  return safeEqual(clickSignString(p, secretKey), p.sign_string.trim().toLowerCase());
}

/** Click amount ("150000", "150000.00", "1500.5") in so'm → tiyin, or null if malformed. */
export function clickAmountToTiyin(amount: string): number | null {
  const s = amount.trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
