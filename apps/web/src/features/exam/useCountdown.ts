'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Countdown to a server deadline. The server's clock is the authority: `serverTime` (from the
 * same response as `expiresAt`) gives the offset between the server and this device, so a wrong
 * device clock doesn't change the deadline. `onExpire` fires exactly once.
 */
export function useCountdown(
  expiresAt: string,
  serverTime: string | undefined,
  onExpire: () => void,
) {
  const [offset] = useState(() => {
    const server = serverTime ? Date.parse(serverTime) : NaN;
    return Number.isNaN(server) ? 0 : server - Date.now();
  });
  const deadline = Date.parse(expiresAt);
  const compute = () => Math.max(0, deadline - (Date.now() + offset));
  const [remaining, setRemaining] = useState(compute);
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadline - (Date.now() + offset));
      setRemaining(left);
      if (left <= 0 && !fired.current) {
        fired.current = true;
        cb.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, offset]);

  return remaining;
}

/** 3725000 ms → "1:02:05"; 65000 → "01:05". */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
