import { describe, expect, it } from "vitest";
import { rectFromDisplay, rectToDisplay, type NormalizedRect } from "./selection";

const rect: NormalizedRect = { x: 0, y: 0, w: 0.5, h: 0.25 };

describe("rect rotation transforms", () => {
  it("is identity at 0 degrees", () => {
    expect(rectToDisplay(rect, 0)).toEqual(rect);
    expect(rectFromDisplay(rect, 0)).toEqual(rect);
  });

  it("maps a top-left rect clockwise for each quarter turn", () => {
    expect(rectToDisplay(rect, 90)).toEqual({ x: 0.75, y: 0, w: 0.25, h: 0.5 });
    expect(rectToDisplay(rect, 180)).toEqual({ x: 0.5, y: 0.75, w: 0.5, h: 0.25 });
    expect(rectToDisplay(rect, 270)).toEqual({ x: 0, y: 0.5, w: 0.25, h: 0.5 });
  });

  it("round-trips through every quarter turn", () => {
    for (const rotation of [0, 90, 180, 270, -90, 450]) {
      const back = rectFromDisplay(rectToDisplay(rect, rotation), rotation);
      expect(back.x).toBeCloseTo(rect.x, 10);
      expect(back.y).toBeCloseTo(rect.y, 10);
      expect(back.w).toBeCloseTo(rect.w, 10);
      expect(back.h).toBeCloseTo(rect.h, 10);
    }
  });
});
