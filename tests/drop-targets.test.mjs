import test from "node:test";
import assert from "node:assert/strict";
import { legalDropTargets, resolveDropTarget } from "../src/drop-targets.ts";
import { validateBoard } from "../src/game/engine.ts";

const target = (pile, x, y, width, height = width * 1.4, areaHeight = height) => ({
  pile, rect: { x, y, width, height }, area: { x, y, width, height: areaHeight },
});
function boardWith({ waste = [], tableau = [], foundations = [[], [], [], []] }) {
  const columns = Array.from({ length: 7 }, (_, i) => tableau[i] || { cards: [], faceUp: 0 });
  const used = [...waste, ...columns.flatMap((p) => p.cards), ...foundations.flat()];
  return validateBoard({
    stock: Array.from({ length: 52 }, (_, i) => i).filter((i) => !used.includes(i)),
    waste, tableau: columns, foundations,
  });
}

for (const width of [37, 43, 76, 100, 126]) {
  test(`${width}px cards accept partial overlap independent of all five grab anchors`, () => {
    const destination = target("f0", width * 4, 12, width);
    const { rect } = destination;
    for (const [offsetX, offsetY] of [[0, 0], [-.75, 0], [.75, 0], [0, .75], [.45, .45], [-.45, -.45]]) {
      const card = { ...rect, x: rect.x + width * offsetX, y: rect.y + rect.height * offsetY };
      for (const [ax, ay] of [[.05, .05], [.95, .05], [.5, .5], [.05, .95], [.95, .95]]) {
        const pointer = { x: card.x + width * ax, y: card.y + rect.height * ay };
        const fromAnchor = { ...card, x: pointer.x - width * ax, y: pointer.y - rect.height * ay };
        assert.equal(resolveDropTarget(fromAnchor, [destination])?.pile, "f0", JSON.stringify({ width, offsetX, offsetY, ax, ay }));
      }
    }
  });
  test(`${width}px near-edge tolerance is generous but bounded`, () => {
    const destination = target("f0", width * 4, 12, width);
    const margin = Math.max(8, Math.min(20, width * .18));
    const card = { ...destination.rect, y: 12 + destination.rect.height + margin - 1 };
    assert.equal(resolveDropTarget(card, [destination])?.pile, "f0");
    assert.equal(resolveDropTarget({ ...card, y: card.y + 3 }, [destination]), null);
    assert.equal(resolveDropTarget({ ...card, x: card.x + width * 3 }, [destination]), null);
  });
  test(`${width}px adjacent legal columns choose stronger overlap; exact split does not guess`, () => {
    const gap = width < 70 ? 5 : 14;
    const a = target("t0", 0, 200, width), b = target("t1", width + gap, 200, width);
    assert.equal(resolveDropTarget({ ...a.rect, x: width * .22 }, [b, a])?.pile, "t0");
    assert.equal(resolveDropTarget({ ...b.rect, x: b.rect.x - width * .22 }, [a, b])?.pile, "t1");
    assert.equal(resolveDropTarget({ ...a.rect, x: (width + gap) / 2 }, [a, b]), null);
  });
}
for (let suit = 0; suit < 4; suit++) {
  for (const rank of [1, 2, 7, 13]) {
    test(`waste rank ${rank}, suit ${suit} selects only its legal foundation`, () => {
      const foundations = Array.from({ length: 4 }, (_, s) =>
        Array.from({ length: rank - 1 }, (_, r) => s * 13 + r));
      const board = boardWith({ waste: [suit * 13 + rank - 1], foundations });
      const targets = Array.from({ length: 4 }, (_, i) => target(`f${i}`, i * 114, 12, 100));
      const legal = legalDropTargets(board, { pile: "waste", index: 0 }, targets);
      assert.deepEqual(legal.map((t) => t.pile), [`f${suit}`]);
      assert.equal(resolveDropTarget({ ...legal[0].rect, y: 80 }, legal)?.pile, `f${suit}`);
    });
  }
}
test("sequences and hidden stock cannot be dragged to foundations; source is excluded", () => {
  const board = boardWith({ tableau: [{ cards: [27, 13], faceUp: 0 }] });
  const targets = [...Array.from({ length: 4 }, (_, i) => target(`f${i}`, i * 114, 12, 100)), target("t0", 0, 250, 100)];
  assert.deepEqual(legalDropTargets(board, { pile: "t0", index: 0 }, targets), []);
  assert.deepEqual(legalDropTargets(board, { pile: "stock", index: board.stock.length - 1 }, targets), []);
  assert.deepEqual(legalDropTargets(board, { pile: "t0", index: 1 }, targets).map((t) => t.pile), ["f1"]);
});
test("a sequence can target the visible column even above its receiving tail", () => {
  const destination = target("t3", 300, 380, 100);
  destination.area = { ...destination.rect, y: 200, height: 320 };
  assert.equal(resolveDropTarget({ x: 310, y: 210, width: 100, height: 140 }, [destination])?.pile, "t3");
  assert.equal(resolveDropTarget({ x: 310, y: 560, width: 100, height: 140 }, [destination]), null);
});
test("no legal targets or distant cards cannot cause a move; invalid geometry is explicit", () => {
  const card = { x: 0, y: 500, width: 100, height: 140 };
  assert.equal(resolveDropTarget(card, []), null);
  assert.equal(resolveDropTarget(card, [target("f0", 800, 12, 100)]), null);
  assert.throws(() => resolveDropTarget({ ...card, width: 0 }, []), /geometry/);
  assert.throws(() => resolveDropTarget({ ...card, x: NaN }, []), /geometry/);
});
test("near-edge assistance does not steal a card dropped squarely on an illegal neighbour", () => {
  const legal = target("f0", 300, 12, 100), wrongSuit = target("f1", 414, 12, 100);
  assert.equal(resolveDropTarget(wrongSuit.rect, [legal], [legal, wrongSuit]), null);
  assert.equal(resolveDropTarget({ ...legal.rect, x: 365 }, [legal], [legal, wrongSuit])?.pile, "f0");
});
