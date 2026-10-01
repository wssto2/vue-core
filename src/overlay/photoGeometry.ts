// The arithmetic of the photo viewer, free of the DOM so it can be tested: fitting, zooming around a point,
// the bounds of a pan, and the mini-map. Positions are in pixels from the stage's centre; a photo is
// drawn centred and moved by `pan` (a translation in screen space, applied after the zoom and the rotation).

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The stops the zoom buttons and keys move between; the wheel and the pinch are continuous in between. */
export const ZOOM_STOPS: readonly number[] = [1, 1.5, 2, 3, 4, 5];
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** A size as it appears after `turns` quarter turns: width and height swap on an odd number. */
export const turned = (size: Size, turns: number): Size => (turns % 2 === 0 ? size : { width: size.height, height: size.width });

/**
 * The box the photo is drawn in before it is rotated: scaled so the *rotated* photo fits the stage
 * (100 % is "fits the screen"), never distorted. Zero until the photo's size is known.
 */
export function drawnSize(natural: Size, stage: Size, turns: number): Size {
  const visible = turned(natural, turns);
  if (visible.width <= 0 || visible.height <= 0 || stage.width <= 0 || stage.height <= 0) return { width: 0, height: 0 };
  const fit = Math.min(stage.width / visible.width, stage.height / visible.height);
  return { width: natural.width * fit, height: natural.height * fit };
}

/** How far the photo may be moved from the centre: nothing while it is smaller than the stage on that axis. */
export function panLimit(visible: Size, stage: Size, zoom: number): Point {
  return { x: Math.max(0, (visible.width * zoom - stage.width) / 2), y: Math.max(0, (visible.height * zoom - stage.height) / 2) };
}

export function clampPan(pan: Point, visible: Size, stage: Size, zoom: number): Point {
  const limit = panLimit(visible, stage, zoom);
  // `+ 0` turns -0 into 0, so a centred photo compares equal.
  return { x: Math.min(limit.x, Math.max(-limit.x, pan.x)) + 0, y: Math.min(limit.y, Math.max(-limit.y, pan.y)) + 0 };
}

/** The view after zooming to `next` with `focus` (relative to the stage's centre) staying under the finger or cursor. */
export function zoomAt(view: { zoom: number; pan: Point }, next: number, focus: Point, visible: Size, stage: Size): { zoom: number; pan: Point } {
  const zoom = clampZoom(next);
  const ratio = zoom / view.zoom;
  const pan = { x: focus.x - (focus.x - view.pan.x) * ratio, y: focus.y - (focus.y - view.pan.y) * ratio };
  return { zoom, pan: clampPan(pan, visible, stage, zoom) };
}

/** The stop above (`1`) or below (`-1`) the current zoom. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const epsilon = 0.001;
  if (direction === 1) return ZOOM_STOPS.find((stop) => stop > zoom + epsilon) ?? MAX_ZOOM;
  return [...ZOOM_STOPS].reverse().find((stop) => stop < zoom - epsilon) ?? MIN_ZOOM;
}

export interface MiniMap {
  /** The thumbnail's size inside its box, in the photo's (rotated) aspect. */
  readonly image: Size;
  /** The part of the photo in view, in pixels of the thumbnail. */
  readonly view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** The mini-map shown while zoomed in: the whole photo, and a frame around what the stage shows. */
export function miniMap(visible: Size, stage: Size, zoom: number, pan: Point, box: Size): MiniMap {
  const scale = Math.min(box.width / visible.width, box.height / visible.height);
  const image = { width: visible.width * scale, height: visible.height * scale };
  const scaled = { width: visible.width * zoom, height: visible.height * zoom };
  const shown = { width: Math.min(1, stage.width / scaled.width), height: Math.min(1, stage.height / scaled.height) };
  const centre = { x: 0.5 - pan.x / scaled.width, y: 0.5 - pan.y / scaled.height };
  return {
    image,
    view: { x: (centre.x - shown.width / 2) * image.width, y: (centre.y - shown.height / 2) * image.height, width: shown.width * image.width, height: shown.height * image.height },
  };
}

/** The pan that puts a point of the mini-map (`fraction` of the photo, 0–1 on each axis) in the middle of the stage. */
export function panToFraction(fraction: Point, visible: Size, stage: Size, zoom: number): Point {
  return clampPan({ x: (0.5 - fraction.x) * visible.width * zoom, y: (0.5 - fraction.y) * visible.height * zoom }, visible, stage, zoom);
}
