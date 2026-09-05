import { legalMoves, type Board } from "./game/engine.ts";

export interface Rect { x: number; y: number; width: number; height: number }
export interface DropTarget {
  pile: string;
  rect: Rect;
  area: Rect;
}
function overlap(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}
function separation(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width);
  const dy = Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height);
  return Math.hypot(dx, dy);
}
function distance(a: Rect, b: Rect): number {
  return Math.hypot((a.x + a.width / 2 - b.x - b.width / 2) / a.width,
    (a.y + a.height / 2 - b.y - b.height / 2) / a.height);
}
function valid(rect: Rect): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}
export function legalDropTargets(board: Board, source: { pile: string; index: number }, targets: DropTarget[]): DropTarget[] {
  const destinations = new Set(legalMoves(board).flatMap((move) =>
    move.type === "move" && move.from === source.pile && move.index === source.index ? [move.to] : []));
  return targets.filter((target) => target.pile !== source.pile && destinations.has(target.pile));
}

/** Resolve the leading card, not the mouse/finger or the full dragged sequence. */
export function resolveDropTarget(card: Rect, targets: DropTarget[], allTargets: DropTarget[] = targets): DropTarget | null {
  if (!valid(card) || targets.some((target) => !valid(target.rect) || !valid(target.area))) {
    throw new Error("Drop geometry must contain finite, positive-sized rectangles.");
  }
  const margin = Math.max(8, Math.min(20, card.width * .18));
  const ranked = targets.flatMap((target) => {
    const direct = overlap(card, target.rect) / (card.width * card.height);
    const column = overlap(card, target.area) / (card.width * card.height);
    const horizontal = Math.max(0, Math.min(card.x + card.width, target.area.x + target.area.width) - Math.max(card.x, target.area.x));
    const vertical = Math.max(0, Math.min(card.y + card.height, target.area.y + target.area.height) - Math.max(card.y, target.area.y));
    const aligned = horizontal >= Math.min(card.width, target.area.width) * .35 ||
      vertical >= Math.min(card.height, target.area.height) * .35;
    const overAnotherPile = allTargets.some((other) => other.pile !== target.pile &&
      overlap(card, other.area) / (card.width * card.height) >= .5);
    const nearby = aligned && !overAnotherPile && separation(card, target.area) <= margin;
    if (direct < .15 && column < .25 && !nearby) return [];
    return [{ target, score: Math.max(direct, column * .82), distance: distance(card, target.rect) }];
  }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.target.pile.localeCompare(b.target.pile));
  if (!ranked.length) return null;
  // An exactly split drop should not arbitrarily choose one of two legal columns.
  if (ranked[1] && Math.abs(ranked[0].score - ranked[1].score) < .025 &&
      Math.abs(ranked[0].distance - ranked[1].distance) < .12) return null;
  return ranked[0].target;
}
