import test from "node:test";
import assert from "node:assert/strict";
import { tableLayout, drawingDensity } from "../src/board-layout.ts";
import { validZoom, validColour, tableInk, ZOOM_LEVELS } from "../src/table-appearance.ts";

const board = (hidden, visible) => ({
  stock: [], waste: [], foundations: [[], [], [], []],
  tableau: Array.from({ length: 7 }, (_, column) => ({
    cards: Array.from({ length: column === 0 ? hidden + visible : 1 }, (_, i) => i),
    faceUp: column === 0 ? hidden : 0,
  })),
});

for (const width of [308, 363, 378, 418, 1284, 1800]) {
  test(`readable portrait/desktop geometry at ${width}px`, () => {
    const layout = tableLayout(board(6, 1), width);
    assert.equal(layout.side, false);
    assert.ok(layout.cardWidth >= 40);
    for (const rect of Object.values(layout.piles)) {
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
    }
    assert.ok(layout.height < (width < 600 ? 400 : 480), "initial deal must not have the old empty 410/530px minimum");
    assert.ok(layout.faceStep >= layout.cardWidth * .36);
  });
}
for (const [width, height] of [[575, 248], [688, 268], [752, 338]]) {
  for (const [hidden, visible] of [[0, 1], [6, 1], [0, 13], [20, 13], [21, 3]]) {
    test(`landscape ${width}x${height}: ${hidden} covered / ${visible} exposed`, () => {
      const value = board(hidden, visible);
      const layout = tableLayout(value, width, { arrangement: "side", availableHeight: height });
      assert.equal(layout.side, true);
      assert.ok(layout.cardWidth * 86 / 240 >= 12, "rank nominal height stays at least12px");
      assert.equal(layout.height, height);
      for (const rect of Object.values(layout.piles)) {
        assert.ok(rect.x >= 0 && rect.y >= 0);
        assert.ok(rect.x + rect.width <= width && rect.y + rect.height <= height);
      }
      for (const column of layout.columns) {
        assert.ok(column.cardY.at(-1) + layout.cardHeight <= height);
      }
      const exposed = layout.columns[0].cardY.slice(hidden);
      for (let i = 1; i < exposed.length; i++) {
        assert.ok(exposed[i] - exposed[i - 1] >= layout.cardWidth * .36 - .001);
      }
    });
  }
}
test("drawing density respects Retina, texture limits and memory budget", () => {
  assert.equal(drawingDensity(390, 500, 3), 3);
  assert.equal(drawingDensity(1366, 600, 1), 1);
  const value = drawingDensity(1460, 1000, 4);
  assert.ok(value <= 3 && value * 1460 <= 4096);
  assert.ok(value ** 2 * 1460 * 1000 <= 6_000_000 + .001);
});
test("invalid layout dimensions surface an error", () => {
  assert.throws(() => tableLayout(board(0, 1), NaN));
  assert.throws(() => tableLayout(board(0, 1), 390, { availableHeight: 0 }));
  assert.throws(() => tableLayout(board(0, 1), 390, { zoom: 9 }));
});
for (const zoom of ZOOM_LEVELS) {
  test(`zoom ${zoom} scales every card and destination without squeezing long landscape runs`, () => {
    const natural = tableLayout(board(20, 13), 575, { arrangement: "side", availableHeight: 200, zoom: 1 });
    const scaled = tableLayout(board(20, 13), 575, { arrangement: "side", availableHeight: 200, zoom });
    assert.equal(scaled.cardWidth, natural.cardWidth * zoom);
    assert.ok(scaled.height > 200);
    assert.ok(scaled.cardWidth * 86 / 240 >= 14);
    for (const rect of Object.values(scaled.piles)) {
      assert.ok(rect.x >= 0 && rect.x + rect.width <= scaled.width);
      assert.ok(rect.y >= 0 && rect.y + rect.height <= scaled.height);
    }
    assert.ok(scaled.columns[0].cardY.at(-1) + scaled.cardHeight <= scaled.height);
    assert.ok(Math.abs(scaled.columns[0].cardY[25] - scaled.columns[0].cardY[24] - scaled.faceStep) < .001);
  });
}
for (const [width, height] of [[924, 440], [1180, 440], [1180, 560], [1266, 490], [1340, 590], [1348, 640], [1372, 790]]) {
  for (const [hidden, visible] of [[0, 1], [6, 1], [0, 13], [20, 13], [21, 3]]) {
    test(`laptop above-pile Fit ${width}x${height}: ${hidden} hidden / ${visible} exposed`, () => {
      const value = board(hidden, visible);
      const layout = tableLayout(value, width, { availableHeight: height });
      assert.equal(layout.side, false, "height constraints must not select the side arrangement");
      assert.equal(layout.height, height);
      assert.ok(layout.piles.f0.y + layout.cardHeight < layout.piles.t0.y);
      for (const rect of Object.values(layout.piles)) {
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
        assert.ok(rect.y >= 0 && rect.y + rect.height <= height);
      }
      for (const column of layout.columns) {
        assert.ok(column.labelY > layout.piles.stock.y + layout.cardHeight);
        assert.ok(column.cardY.at(-1) + layout.cardHeight + 12 <= height + .001);
      }
      assert.equal(layout.compact, layout.cardWidth < 85);
      assert.ok(layout.faceStep >= layout.cardWidth * .36);
      const numeric = tableLayout(value, width, { availableHeight: height, zoom: 1.5 });
      const unbounded = tableLayout(value, width, { zoom: 1.5 });
      assert.equal(numeric.cardWidth, unbounded.cardWidth, "numeric zoom must never be squeezed");
      assert.deepEqual(numeric.piles, unbounded.piles);
      assert.deepEqual(numeric.columns, unbounded.columns);
    });
  }
}
test("portrait Fit stays width-only and exposed strips survive the compact-face transition", () => {
  const portrait = tableLayout(board(20, 13), 378);
  assert.ok(portrait.height > 410);
  assert.ok(portrait.cardWidth >= 50);
  for (const height of [300, 400, 500, 600, 700, 800, 1000]) {
    const layout = tableLayout(board(20, 13), 1266, { availableHeight: height });
    assert.ok(layout.columns[0].cardY.at(-1) + layout.cardHeight + 12 <= height + .001);
    assert.equal(layout.faceStep, layout.cardWidth * (layout.compact ? .36 : .39));
  }
});
test("appearance settings validate zoom and maintain contrasting black or white labels", () => {
  for (const value of [0, ...ZOOM_LEVELS]) assert.ok(validZoom(value));
  for (const value of [NaN, Infinity, -1, 3, "1", null]) assert.equal(validZoom(value), false);
  assert.ok(validColour("#Ab1234"));
  for (const value of ["red", "#fff", null, "url(x)"]) assert.equal(validColour(value), false);
  assert.equal(tableInk("#ffffff"), "#000000");
  assert.equal(tableInk("#103e38"), "#ffffff");
  assert.equal(tableInk("#808080"), "#000000");
  assert.throws(() => tableInk("invalid"));
});
