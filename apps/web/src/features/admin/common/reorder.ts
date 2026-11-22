/** Pure helpers for drag / keyboard reordering of modules, lessons, materials. */

/** Moves the element at `from` to index `to` (both clamped). Returns a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  if (target === from) return next;
  const [item] = next.splice(from, 1) as [T];
  next.splice(target, 0, item);
  return next;
}

/** Moves the item with `id` one step up (-1) or down (+1). */
export function moveById<T extends { id: string }>(list: readonly T[], id: string, delta: -1 | 1): T[] {
  const from = list.findIndex((i) => i.id === id);
  if (from < 0) return [...list];
  return moveItem(list, from, from + delta);
}

/** Ids in the current order — the body of `PATCH …/reorder {ids}`. */
export function orderIds<T extends { id: string }>(list: readonly T[]): string[] {
  return list.map((i) => i.id);
}

/** True if the order of ids differs. */
export function orderChanged<T extends { id: string }>(a: readonly T[], b: readonly T[]): boolean {
  return a.length !== b.length || a.some((x, i) => x.id !== b[i]?.id);
}

/** Sorts by `position` (stable) without mutating. */
export function byPosition<T extends { position: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.position - b.position);
}
