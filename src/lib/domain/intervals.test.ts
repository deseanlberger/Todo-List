import { describe, expect, it } from "vitest";
import { overlaps, subtract } from "./intervals";

describe("subtracting busy time from a window", () => {
  it("returns the whole window when nothing is in it", () => {
    expect(subtract(450, 630, [])).toEqual([{ start: 450, end: 630 }]);
  });

  it("splits a window around something in the middle", () => {
    // 7:30-10:30 with a block at 9:00-9:45 leaves two pieces, not one.
    expect(subtract(450, 630, [{ start: 540, end: 585 }])).toEqual([
      { start: 450, end: 540 },
      { start: 585, end: 630 },
    ]);
  });

  it("trims from the front and the back", () => {
    expect(subtract(450, 630, [{ start: 400, end: 480 }])).toEqual([
      { start: 480, end: 630 },
    ]);
    expect(subtract(450, 630, [{ start: 600, end: 700 }])).toEqual([
      { start: 450, end: 600 },
    ]);
  });

  it("returns nothing when the window is fully covered", () => {
    expect(subtract(450, 630, [{ start: 400, end: 700 }])).toEqual([]);
  });

  it("handles overlapping and out-of-order busy spans", () => {
    const busy = [
      { start: 560, end: 600 },
      { start: 480, end: 520 },
      { start: 500, end: 570 },
    ];
    expect(subtract(450, 630, busy)).toEqual([
      { start: 450, end: 480 },
      { start: 600, end: 630 },
    ]);
  });

  it("ignores busy spans that miss the window entirely", () => {
    expect(subtract(450, 630, [{ start: 100, end: 200 }])).toEqual([
      { start: 450, end: 630 },
    ]);
  });

  it("drops slivers under five minutes", () => {
    // A 3-minute remainder is a rounding artefact, not a slot.
    expect(subtract(450, 630, [{ start: 453, end: 630 }])).toEqual([]);
    // Five minutes exactly is kept.
    expect(subtract(450, 630, [{ start: 455, end: 630 }])).toEqual([
      { start: 450, end: 455 },
    ]);
  });

  it("never returns a piece that runs past the window", () => {
    for (const busy of [[], [{ start: 500, end: 510 }], [{ start: 440, end: 460 }]]) {
      for (const piece of subtract(450, 630, busy)) {
        expect(piece.start).toBeGreaterThanOrEqual(450);
        expect(piece.end).toBeLessThanOrEqual(630);
        expect(piece.end).toBeGreaterThan(piece.start);
      }
    }
  });
});

describe("overlaps", () => {
  it("is true when they share a minute", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 9, end: 20 })).toBe(true);
  });

  it("is false when they only touch", () => {
    // Half-open: a block ending at 9:00 does not clash with one starting there.
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  });
});
