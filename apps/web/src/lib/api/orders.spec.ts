import type { OrderStatusResponse, PaymentStatus } from '@onlinedars/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { isFreeEnrollment, pollOrderStatus } from './orders';

const order = (status: PaymentStatus): OrderStatusResponse => ({
  orderId: 'o1',
  status,
  courseId: 'c1',
  amount: 50_000_000,
  currency: 'UZS',
});

/** Virtual clock: sleep is real setTimeout with 0 ms interval, time advances per call. */
function sequence(...steps: (PaymentStatus | Error)[]) {
  let i = 0;
  return vi.fn(async () => {
    const s = steps[Math.min(i++, steps.length - 1)]!;
    if (s instanceof Error) throw s;
    return order(s);
  });
}

describe('pollOrderStatus', () => {
  it('keeps polling while PENDING and stops at PAID', async () => {
    const fetchOrder = sequence('PENDING', 'PENDING', 'PAID');
    const updates: string[] = [];
    const r = await pollOrderStatus({
      fetchOrder,
      intervalMs: 1,
      timeoutMs: 10_000,
      onUpdate: (o) => updates.push(o.status),
    });
    expect(r).toEqual({ kind: 'final', order: order('PAID') });
    expect(fetchOrder).toHaveBeenCalledTimes(3);
    expect(updates).toEqual(['PENDING', 'PENDING', 'PAID']);
  });

  it('stops at FAILED (and other final statuses)', async () => {
    for (const s of ['FAILED', 'CANCELLED', 'REFUNDED'] as const) {
      const r = await pollOrderStatus({ fetchOrder: sequence('PENDING', s), intervalMs: 1 });
      expect(r).toEqual({ kind: 'final', order: order(s) });
    }
  });

  it('times out while still PENDING and returns the last order', async () => {
    let now = 0;
    const fetchOrder = vi.fn(async () => {
      now += 1000;
      return order('PENDING');
    });
    const r = await pollOrderStatus({ fetchOrder, intervalMs: 1, timeoutMs: 5000, now: () => now });
    expect(r).toEqual({ kind: 'timeout', order: order('PENDING') });
    expect(fetchOrder.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(fetchOrder.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('retries transient errors', async () => {
    const onError = vi.fn();
    const r = await pollOrderStatus({
      fetchOrder: sequence(new ApiError(502, 'INTERNAL_ERROR', 'bad gateway'), 'PAID'),
      intervalMs: 1,
      onError,
      isFatal: (e) => e instanceof ApiError && e.status === 404,
    });
    expect(r.kind).toBe('final');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('rethrows fatal errors (e.g. ORDER_NOT_FOUND)', async () => {
    const err = new ApiError(404, 'ORDER_NOT_FOUND', 'nope');
    await expect(
      pollOrderStatus({
        fetchOrder: sequence(err),
        intervalMs: 1,
        isFatal: (e) => e instanceof ApiError && e.status === 404,
      }),
    ).rejects.toBe(err);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const p = pollOrderStatus({
      fetchOrder: vi.fn(async () => order('PENDING')),
      intervalMs: 10_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 5);
    await expect(p).rejects.toBeDefined();
  });
});

describe('isFreeEnrollment', () => {
  it('detects the free-course response', () => {
    expect(isFreeEnrollment({ enrolled: true })).toBe(true);
    expect(isFreeEnrollment({ orderId: 'o', number: 1, amount: 1, redirectUrl: 'https://x' })).toBe(
      false,
    );
  });
});
