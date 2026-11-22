/**
 * Payme Merchant API constants (https://developer.help.paycom.uz/metody-merchant-api/).
 * Error responses are HTTP 200 with `{ error: { code, message: { ru, uz, en }, data? }, id }`.
 */

export const PaymeErrorCode = {
  /** Request method is not POST. */
  TRANSPORT_ERROR: -32300,
  /** Body is not valid JSON. */
  PARSE_ERROR: -32700,
  /** Missing/invalid JSON-RPC fields or params. */
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  /** Wrong/missing Basic auth. */
  INSUFFICIENT_PRIVILEGE: -32504,
  /** Internal error on our side. */
  SYSTEM_ERROR: -32400,
  WRONG_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  /** The transaction cannot be cancelled (service already delivered and not refundable). */
  CANNOT_CANCEL: -31007,
  /** The operation is not possible in the transaction's state (or it timed out). */
  CANNOT_PERFORM: -31008,
  /** -31050..-31099: errors about the `account` (our order). `data` = field name. */
  ORDER_NOT_FOUND: -31050,
  ORDER_NOT_PAYABLE: -31051,
  ORDER_BUSY: -31099,
} as const;
export type PaymeErrorCode = (typeof PaymeErrorCode)[keyof typeof PaymeErrorCode];

/** Transaction states as Payme sees them. */
export const PaymeState = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;
export type PaymeState = (typeof PaymeState)[keyof typeof PaymeState];

/** Cancel reason 4 = "transaction cancelled by timeout". */
export const PAYME_REASON_TIMEOUT = 4;
/** A created (state 1) transaction must be performed within 12 hours. */
export const PAYME_TX_TIMEOUT_MS = 12 * 60 * 60 * 1000;
/** The account field configured in the Payme merchant cabinet. */
export const PAYME_ACCOUNT_FIELD = 'order_id';

export interface PaymeMessage {
  ru: string;
  uz: string;
  en: string;
}

const M = (uz: string, ru: string, en: string): PaymeMessage => ({ uz, ru, en });

export const PAYME_MESSAGES: Record<PaymeErrorCode, PaymeMessage> = {
  [PaymeErrorCode.TRANSPORT_ERROR]: M(
    "So'rov usuli POST emas",
    'Метод запроса не POST',
    'Request method is not POST',
  ),
  [PaymeErrorCode.PARSE_ERROR]: M("JSON noto'g'ri", 'Ошибка парсинга JSON', 'JSON parse error'),
  [PaymeErrorCode.INVALID_REQUEST]: M("So'rov noto'g'ri", 'Неверный запрос', 'Invalid request'),
  [PaymeErrorCode.METHOD_NOT_FOUND]: M('Metod topilmadi', 'Метод не найден', 'Method not found'),
  [PaymeErrorCode.INSUFFICIENT_PRIVILEGE]: M(
    'Ruxsat etilmagan',
    'Недостаточно привилегий',
    'Insufficient privilege',
  ),
  [PaymeErrorCode.SYSTEM_ERROR]: M('Tizim xatosi', 'Системная ошибка', 'System error'),
  [PaymeErrorCode.WRONG_AMOUNT]: M("Summa noto'g'ri", 'Неверная сумма', 'Incorrect amount'),
  [PaymeErrorCode.TRANSACTION_NOT_FOUND]: M(
    'Tranzaksiya topilmadi',
    'Транзакция не найдена',
    'Transaction not found',
  ),
  [PaymeErrorCode.CANNOT_CANCEL]: M(
    "Tranzaksiyani bekor qilib bo'lmaydi",
    'Невозможно отменить транзакцию',
    'Unable to cancel transaction',
  ),
  [PaymeErrorCode.CANNOT_PERFORM]: M(
    "Amalni bajarib bo'lmaydi",
    'Невозможно выполнить операцию',
    'Unable to perform operation',
  ),
  [PaymeErrorCode.ORDER_NOT_FOUND]: M('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'),
  [PaymeErrorCode.ORDER_NOT_PAYABLE]: M(
    "Buyurtma to'langan yoki bekor qilingan",
    'Заказ уже оплачен или отменён',
    'Order is already paid or cancelled',
  ),
  [PaymeErrorCode.ORDER_BUSY]: M(
    "Buyurtma bo'yicha boshqa to'lov kutilmoqda",
    'По заказу ожидается другая оплата',
    'Another payment for this order is in progress',
  ),
};

export class PaymeRpcError extends Error {
  constructor(
    readonly code: PaymeErrorCode,
    readonly data?: string,
  ) {
    super(PAYME_MESSAGES[code].en);
  }
}
