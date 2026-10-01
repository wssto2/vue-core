import { describe, expect, it } from "vitest";
import { clampPan, clampZoom, drawnSize, miniMap, panLimit, panToFraction, stepZoom, turned, zoomAt } from "./photoGeometry";

const stage = { width: 800, height: 500 };
const photo = { width: 1600, height: 1000 };

describe("fitting", () => {
  it("fits the photo to the stage without distortion", () => {
    expect(drawnSize(photo, stage, 0)).toEqual({ width: 800, height: 500 });
    expect(drawnSize({ width: 1000, height: 1000 }, stage, 0)).toEqual({ width: 500, height: 500 });
  });

  it("fits the rotated photo: a quarter turn swaps the room it needs", () => {
    const drawn = drawnSize(photo, stage, 1);
    // Turned, it is 1000 × 1600: it fits the 500 px tall stage at 31.25 %, and the box it is drawn in (before the turn) is 500 × 312.5.
    expect(drawn.width).toBeCloseTo(500);
    expect(drawn.height).toBeCloseTo(312.5);
    expect(turned(drawn, 1)).toEqual({ width: drawn.height, height: drawn.width });
  });

  it("is empty until the sizes are known", () => {
    expect(drawnSize({ width: 0, height: 0 }, stage, 0)).toEqual({ width: 0, height: 0 });
    expect(drawnSize(photo, { width: 0, height: 0 }, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe("pan bounds", () => {
  const visible = { width: 800, height: 500 };

  it("allows no pan at 100 %", () => {
    expect(panLimit(visible, stage, 1)).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: 90, y: -90 }, visible, stage, 1)).toEqual({ x: 0, y: 0 });
  });

  it("allows half of what overflows, on each side", () => {
    expect(panLimit(visible, stage, 2)).toEqual({ x: 400, y: 250 });
    expect(clampPan({ x: 999, y: -999 }, visible, stage, 2)).toEqual({ x: 400, y: -250 });
  });

  it("allows nothing on an axis the photo does not overflow", () => {
    const wide = { width: 800, height: 100 };
    expect(panLimit(wide, stage, 2)).toEqual({ x: 400, y: 0 });
  });
});

describe("zooming around a point", () => {
  const visible = { width: 800, height: 500 };

  it("keeps the point under the cursor where it was", () => {
    const view = zoomAt({ zoom: 1, pan: { x: 0, y: 0 } }, 2, { x: 200, y: 100 }, visible, stage);
    // The point of the photo that was at (200, 100) is at (200 * 2 + pan.x, 100 * 2 + pan.y) now: still (200, 100).
    expect(view.zoom).toBe(2);
    expect(view.pan).toEqual({ x: -200, y: -100 });
  });

  it("zooming around the centre does not move the photo", () => {
    expect(zoomAt({ zoom: 1, pan: { x: 0, y: 0 } }, 3, { x: 0, y: 0 }, visible, stage).pan).toEqual({ x: 0, y: 0 });
  });

  it("stays inside the bounds near an edge", () => {
    const view = zoomAt({ zoom: 1, pan: { x: 0, y: 0 } }, 2, { x: 390, y: 240 }, visible, stage);
    expect(view.pan).toEqual({ x: -390, y: -240 });
    const corner = zoomAt({ zoom: 1.5, pan: { x: 0, y: 0 } }, 5, { x: 500, y: 500 }, visible, stage);
    expect(Math.abs(corner.pan.x)).toBeLessThanOrEqual(panLimit(visible, stage, 5).x);
  });

  it("clamps the zoom to 100–500 % and zooming out recentres what no longer overflows", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(5);
    const view = zoomAt({ zoom: 2, pan: { x: 300, y: 100 } }, 1, { x: 0, y: 0 }, visible, stage);
    expect(view).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });

  it("steps between the stops", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1.5, 1)).toBe(2);
    expect(stepZoom(1.7, 1)).toBe(2);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(1.2, -1)).toBe(1);
    expect(stepZoom(5, 1)).toBe(5);
    expect(stepZoom(1, -1)).toBe(1);
  });
});

describe("mini-map", () => {
  const visible = { width: 800, height: 500 };
  const box = { width: 120, height: 80 };

  it("shows the whole photo in its aspect and a frame of what is in view", () => {
    const map = miniMap(visible, stage, 2, { x: 0, y: 0 }, box);
    expect(map.image).toEqual({ width: 120, height: 75 });
    expect(map.view.width).toBeCloseTo(60);
    expect(map.view.height).toBeCloseTo(37.5);
    expect(map.view.x).toBeCloseTo(30);
    expect(map.view.y).toBeCloseTo(18.75);
  });

  it("moves the frame opposite to the pan, and to the corner at the pan limit", () => {
    const limit = panLimit(visible, stage, 2);
    const left = miniMap(visible, stage, 2, { x: limit.x, y: limit.y }, box); // photo dragged right/down: we look at its top left
    expect(left.view.x).toBeCloseTo(0);
    expect(left.view.y).toBeCloseTo(0);
    const right = miniMap(visible, stage, 2, { x: -limit.x, y: -limit.y }, box);
    expect(right.view.x + right.view.width).toBeCloseTo(120);
    expect(right.view.y + right.view.height).toBeCloseTo(75);
  });

  it("a click on the map pans so that point is in the middle, within the bounds", () => {
    expect(panToFraction({ x: 0.5, y: 0.5 }, visible, stage, 2)).toEqual({ x: 0, y: 0 });
    expect(panToFraction({ x: 0.25, y: 0.5 }, visible, stage, 2)).toEqual({ x: 400, y: 0 });
    expect(panToFraction({ x: 0, y: 0 }, visible, stage, 2)).toEqual({ x: 400, y: 250 });
  });
});
