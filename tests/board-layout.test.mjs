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
      const layout = tableLayout(value, width, height);
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
  assert.throws(() => tableLayout(board(0, 1), 390, 0));
  assert.throws(() => tableLayout(board(0, 1), 390, undefined, 9));
});
for (const zoom of ZOOM_LEVELS) {
  test(`zoom ${zoom} scales every card and destination without squeezing long landscape runs`, () => {
    const natural = tableLayout(board(20, 13), 575, 200, 1);
    const scaled = tableLayout(board(20, 13), 575, 200, zoom);
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
