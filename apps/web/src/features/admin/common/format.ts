const TZ = 'Asia/Tashkent';

/** dd.mm.yyyy hh:mm in Tashkent time (locale-independent so SSR and client match). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

export function formatDate(iso: string | null | undefined): string {
  return formatDateTime(iso).split(' ')[0] ?? '—';
}

/** yyyy-mm-dd (from a date input) → ISO datetime at start/end of the day in Tashkent (UTC+5). */
export function dateInputToIso(value: string, endOfDay = false): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:00`).toISOString();
}
