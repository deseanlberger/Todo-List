/** A half-open span of minutes within one day: `[start, end)`. */
export interface Span {
  start: number;
  end: number;
}

/** Nothing shorter than this is time anyone can use. */
export const SLIVER_MINUTES = 5;

/**
 * `[start, end)` with every span in `busy` removed, as the pieces that
 * survive.
 *
 * Slivers are dropped: a two-minute remainder is a rounding artefact, not a
 * slot, and rendering it would litter a day with unusable fragments.
 */
export function subtract(start: number, end: number, busy: Span[]): Span[] {
  const overlapping = busy
    .filter((span) => span.end > start && span.start < end)
    .sort((a, b) => a.start - b.start);

  const pieces: Span[] = [];
  let cursor = start;

  for (const span of overlapping) {
    if (span.start > cursor) pieces.push({ start: cursor, end: Math.min(span.start, end) });
    cursor = Math.max(cursor, span.end);
    if (cursor >= end) break;
  }
  if (cursor < end) pieces.push({ start: cursor, end });

  return pieces.filter((piece) => piece.end - piece.start >= SLIVER_MINUTES);
}

/** True when the two spans share any minute. */
export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}
