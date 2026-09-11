import type { Board } from "./game/engine.ts";
import type { Rect } from "./drop-targets.ts";
import { validZoom } from "./table-appearance.ts";

export interface TableLayout {
  width: number; height: number; side: boolean; compact: boolean;
  cardWidth: number; cardHeight: number; faceStep: number;
  piles: Record<string, Rect>;
  columns: { labelY: number; cardY: number[]; backStep: number }[];
}

export interface TableConstraints {
  arrangement?: "above" | "side";
  availableHeight?: number;
  zoom?: number;
}

export function tableLayout(board: Board, width: number, {
  arrangement = "above", availableHeight, zoom = 0,
}: TableConstraints = {}): TableLayout {
  if (!Number.isFinite(width) || width <= 0 ||
      (availableHeight !== undefined && (!Number.isFinite(availableHeight) || availableHeight <= 0))) {
    throw new Error("The card table needs finite, positive dimensions.");
  }
  if (!validZoom(zoom)) throw new Error("The card table zoom is invalid.");
  const side = arrangement === "side";
  const gap = side || width < 600 ? 3 : 12;
  const inset = 4;
  const railGap = 18;
  const columnHeader = side ? 22 : 44;
  const hiddenHeight = (pile: Board["tableau"][number], cardWidth: number) =>
    Math.min(pile.faceUp * Math.min(10, cardWidth * .10), side ? 10 : 30);
  const extent = (cardWidth: number, compact: boolean) => {
    const cardHeight = cardWidth * 1.4;
    const step = cardWidth * (compact ? .36 : .39);
    return Math.max(...board.tableau.map((pile) => cardHeight + hiddenHeight(pile, cardWidth) +
      Math.max(0, pile.cards.length - pile.faceUp - 1) * step));
  };
  const isCompact = (cardWidth: number) => side || cardWidth < 85;
  const contentExtent = (cardWidth: number) => {
    const cardHeight = cardWidth * 1.4;
    const tableauTop = side ? columnHeader : 6 + cardHeight + columnHeader;
    return Math.ceil(Math.max(tableauTop + extent(cardWidth, isCompact(cardWidth)) + 12,
      side ? columnHeader + 3 * cardHeight + 2 * gap + inset : 0));
  };
  let cardWidth = Math.min(side ? 78 : 126,
    (width - inset * 2 - gap * (side ? 7 : 6) - (side ? railGap : 0)) / (side ? 9 : 7));
  if (availableHeight !== undefined && zoom === 0 && contentExtent(cardWidth) > availableHeight) {
    // Fit the same complete extents used below, including labels and bottom padding.
    // Keep exposed strips proportional; only numeric zoom opts into scrolling.
    let low = 0, high = cardWidth;
    for (let i = 0; i < 40; i++) {
      const candidate = (low + high) / 2;
      if (contentExtent(candidate) <= availableHeight) low = candidate;
      else high = candidate;
    }
    cardWidth = low;
  }
  const compact = isCompact(cardWidth);
  const cardHeight = cardWidth * 1.4;
  const faceStep = cardWidth * (compact ? .36 : .39);
  const total = cardWidth * (side ? 9 : 7) + gap * (side ? 7 : 6) + (side ? railGap : 0);
  const left = (width - total) / 2;
  const top = side ? columnHeader : 6;
  const tableauTop = side ? columnHeader : top + cardHeight + columnHeader;
  const piles: Record<string, Rect> = {};
  const rect = (x: number, y: number): Rect => ({ x, y, width: cardWidth, height: cardHeight });
  if (side) {
    for (const [index, id] of ["stock", "waste", "f0", "f1", "f2", "f3"].entries()) {
      piles[id] = rect(left + (index % 2) * (cardWidth + gap), top + Math.floor(index / 2) * (cardHeight + gap));
    }
  } else {
    for (const [index, id] of ["stock", "waste", "", "f0", "f1", "f2", "f3"].entries()) {
      if (id) piles[id] = rect(left + index * (cardWidth + gap), top);
    }
  }
  const columns = board.tableau.map((pile, column) => {
    const x = left + (side ? cardWidth * 2 + gap + railGap : 0) + column * (cardWidth + gap);
    piles[`t${column}`] = rect(x, tableauTop);
    const backStep = pile.faceUp ? hiddenHeight(pile, cardWidth) / pile.faceUp : 0;
    const cardY = pile.cards.map((_, index) => tableauTop + Math.min(index, pile.faceUp) * backStep +
      Math.max(0, index - pile.faceUp) * faceStep);
    return { labelY: tableauTop - 13, cardY, backStep };
  });
  const contentHeight = contentExtent(cardWidth);
  const scale = zoom || 1;
  const surfaceWidth = Math.max(width, width * scale);
  const offset = (surfaceWidth - width * scale) / 2;
  for (const rect of Object.values(piles)) {
    rect.x = rect.x * scale + offset; rect.y *= scale;
    rect.width *= scale; rect.height *= scale;
  }
  for (const column of columns) {
    column.labelY *= scale; column.backStep *= scale;
    column.cardY = column.cardY.map((y) => y * scale);
  }
  return { width: surfaceWidth, height: Math.max(availableHeight ?? 0, Math.ceil(contentHeight * scale)), side, compact,
    cardWidth: cardWidth * scale, cardHeight: cardHeight * scale, faceStep: faceStep * scale, piles, columns };
}

export function drawingDensity(width: number, height: number, deviceRatio: number): number {
  return Math.max(1, Math.min(deviceRatio || 1, 3, 4096 / Math.max(width, height),
    Math.sqrt(6_000_000 / (width * height))));
}
