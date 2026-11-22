import {
  type CreateOrderInput,
  type OrderStatusResponse,
  PaymentStatus,
} from '@onlinedars/shared';
import { authFetch } from '../auth/session';

/*
 * Orders (backend-payments). Access is granted only by the provider's server-to-server callback;
 * the browser never decides whether a payment succeeded — it only polls GET /orders/:orderId.
 */

export interface CreatedOrder {
  orderId: string;
  number: number;
  /** tiyin, computed by the server */
  amount: number;
  redirectUrl: string;
}

export interface FreeEnrollment {
  enrolled: true;
}

export type CreateOrderResult = CreatedOrder | FreeEnrollment;

export function isFreeEnrollment(r: CreateOrderResult): r is FreeEnrollment {
  return 'enrolled' in r && r.enrolled === true;
}

/** Only course + provider are sent; the amount always comes from the DB. */
export function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return authFetch<CreateOrderResult>('/orders', { method: 'POST', body: input });
}

export function getOrder(orderId: string, signal?: AbortSignal): Promise<OrderStatusResponse> {
  return authFetch<OrderStatusResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    cache: 'no-store',
    signal,
  });
}

export const FINAL_ORDER_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  PaymentStatus.PAID,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
]);

export type PollOutcome =
  | { kind: 'final'; order: OrderStatusResponse }
  | { kind: 'timeout'; order: OrderStatusResponse | null };

export interface PollOptions {
  fetchOrder: (signal: AbortSignal) => Promise<OrderStatusResponse>;
  /** ms between requests (default 2 s) */
  intervalMs?: number;
  /** give up after this many ms (default 2 min) */
  timeoutMs?: number;
  signal?: AbortSignal;
  onUpdate?: (order: OrderStatusResponse) => void;
  /** transient errors (network, 5xx) are retried; this is called for each one */
  onError?: (e: unknown) => void;
  /** errors that should stop polling (e.g. 404 / 403) */
  isFatal?: (e: unknown) => boolean;
  now?: () => number;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Polls the order until it reaches a final status (PAID / FAILED / CANCELLED / REFUNDED) or the
 * timeout passes. PENDING keeps polling. Fatal errors are re-thrown.
 */
export async function pollOrderStatus(opts: PollOptions): Promise<PollOutcome> {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 120_000;
  const now = opts.now ?? Date.now;
  const controller = new AbortController();
  const abort = () => controller.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', abort, { once: true });
  const started = now();
  let last: OrderStatusResponse | null = null;
  try {
    for (;;) {
      try {
        last = await opts.fetchOrder(controller.signal);
        opts.onUpdate?.(last);
        if (FINAL_ORDER_STATUSES.has(last.status)) return { kind: 'final', order: last };
      } catch (e) {
        if (controller.signal.aborted) throw e;
        if (opts.isFatal?.(e)) throw e;
        opts.onError?.(e);
      }
      if (now() - started + interval > timeout) return { kind: 'timeout', order: last };
      await sleep(interval, controller.signal);
    }
  } finally {
    opts.signal?.removeEventListener('abort', abort);
  }
}
