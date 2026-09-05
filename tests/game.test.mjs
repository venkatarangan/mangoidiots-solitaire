import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyMove, autoFinish, cardLabel, cardRank, cardSuit, hintMoves, isSafeFoundation,
  isWon, legalMoves, newBoard, validateBoard,
} from '../src/game/engine.ts';
import { deals } from '../src/data/deals.ts';
import { seededDeck, solve, dealMetrics } from '../tools/deals/solver.mjs';
import { verifyCatalog, verifyWitness } from '../tools/deals/verify.mjs';

const ordered = Array.from({ length: 52 }, (_, i) => i);
const move = (from, to, index) => ({ type: 'move', from, to, index });
const witnesses = JSON.parse(readFileSync(new URL('../tools/deals/witnesses.json', import.meta.url), 'utf8'));

function position({ tableau = [], waste = [], heights = [0, 0, 0, 0] } = {}) {
  const columns = Array.from({ length: 7 }, (_, i) => {
    const c = tableau[i] ?? [];
    return Array.isArray(c) ? { cards: [...c], faceUp: 0 } : structuredClone(c);
  });
  const foundations = heights.map((n, suit) => Array.from({ length: n }, (_, i) => suit * 13 + i));
  const used = new Set([...waste, ...columns.flatMap(c => c.cards), ...foundations.flat()]);
  return validateBoard({ stock: ordered.filter(c => !used.has(c)), waste, tableau: columns, foundations });
}

test('card encoding and readable labels cover all four suits', () => {
  assert.equal(cardRank(0), 1);
  assert.equal(cardRank(51), 13);
  assert.equal(cardSuit(0), 0);
  assert.equal(cardSuit(13), 1);
  assert.equal(cardSuit(26), 2);
  assert.equal(cardSuit(39), 3);
  assert.equal(cardLabel(0), 'Ace of spades');
  assert.equal(cardLabel(24), 'Queen of hearts');
  assert.equal(cardLabel(51), 'King of diamonds');
});

test('dealing is deterministic, triangular, detached, and contains 24 stock cards', () => {
  const deck = [...ordered];
  const board = newBoard(deck);
  assert.deepEqual(board, newBoard(deck));
  assert.deepEqual(board.tableau.map(c => c.cards.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(board.tableau.map(c => c.faceUp), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(board.tableau[0].cards, [0]);
  assert.deepEqual(board.tableau[1].cards, [1, 7]);
  assert.deepEqual(board.tableau[2].cards, [2, 8, 13]);
  assert.equal(board.stock.length, 24);
  assert.equal(board.stock.at(-1), 28);
  deck[0] = 50;
  assert.equal(board.tableau[0].cards[0], 0);
  assert.deepEqual(validateBoard(board), board);
});

test('invalid decks are rejected instead of repaired', () => {
  for (const bad of [
    null, {}, ordered.slice(1), [...ordered, 0], ordered.map(() => 1),
    ordered.map(c => c === 51 ? 52 : c), ordered.map(c => c === 51 ? -1 : c),
    ordered.map(c => c === 51 ? 1.2 : c), ordered.map(c => c === 51 ? '51' : c),
    Array(52),
  ]) assert.throws(() => newBoard(bad));
});

test('draw is immutable, exposes one card and earns zero points', () => {
  const board = newBoard(ordered), before = structuredClone(board);
  const result = applyMove(board, { type: 'draw' });
  assert.deepEqual(board, before);
  assert.deepEqual(result.board.waste, [28]);
  assert.equal(result.board.stock.length, 23);
  assert.equal(result.points, 0);
  assert.equal(result.revealed, false);
  result.board.tableau[0].cards.pop();
  assert.deepEqual(board, before);
});

test('recycling preserves Draw 1 order indefinitely and charges each time', () => {
  let board = newBoard(ordered);
  assert.throws(() => applyMove(board, { type: 'recycle' }));
  for (let cycle = 0; cycle < 4; cycle++) {
    const drawn = [];
    while (board.stock.length) {
      board = applyMove(board, { type: 'draw' }).board;
      drawn.push(board.waste.at(-1));
    }
    assert.deepEqual(drawn, ordered.slice(28));
    assert.throws(() => applyMove(board, { type: 'draw' }));
    const prior = structuredClone(board);
    const result = applyMove(board, { type: 'recycle' });
    assert.deepEqual(board, prior);
    assert.equal(result.points, -100);
    assert.equal(result.revealed, false);
    assert.deepEqual(result.board.waste, []);
    board = result.board;
  }
  assert.throws(() => applyMove(position({ heights: [13, 13, 13, 13] }), { type: 'recycle' }));
});

test('recycle excludes waste cards already played and preserves the others', () => {
  let board = position({ waste: [2, 0, 4] });
  while (board.stock.length) board = applyMove(board, { type: 'draw' }).board;
  board = applyMove(board, { type: 'recycle' }).board;
  board = applyMove(board, { type: 'draw' }).board;
  assert.equal(board.waste.at(-1), 2);
  board = applyMove(board, { type: 'draw' }).board;
  assert.equal(board.waste.at(-1), 0);
  board = applyMove(board, move('waste', 'f0', 1)).board;
  while (board.stock.length) board = applyMove(board, { type: 'draw' }).board;
  board = applyMove(board, { type: 'recycle' }).board;
  const next = [];
  while (board.stock.length) {
    board = applyMove(board, { type: 'draw' }).board;
    next.push(board.waste.at(-1));
  }
  assert.deepEqual(next.slice(0, 2), [2, 4]);
  assert.equal(next.includes(0), false);
});

test('waste to tableau scores 5 and foundation scores 10', () => {
  let result = applyMove(position({ waste: [5], tableau: [[19]] }), move('waste', 't0', 0));
  assert.equal(result.points, 5);
  assert.equal(result.revealed, false);
  assert.deepEqual(result.board.tableau[0].cards, [19, 5]);
  result = applyMove(position({ waste: [0] }), move('waste', 'f0', 0));
  assert.equal(result.points, 10);
  assert.deepEqual(result.board.foundations[0], [0]);
});

test('sequence move and automatic reveal are one immutable scored action', () => {
  const board = position({ tableau: [{ cards: [40, 5, 17], faceUp: 1 }, [19]] });
  const before = structuredClone(board);
  const result = applyMove(board, move('t0', 't1', 1));
  assert.deepEqual(board, before);
  assert.equal(result.points, 5);
  assert.equal(result.revealed, true);
  assert.deepEqual(result.board.tableau[0], { cards: [40], faceUp: 0 });
  assert.deepEqual(result.board.tableau[1].cards, [19, 5, 17]);
  assert.match(result.description, /Reveal a hidden card/);
});

test('tableau to foundation plus reveal scores 15; no-reveal transfer scores 0', () => {
  const promoted = applyMove(position({ tableau: [{ cards: [38, 0], faceUp: 1 }] }), move('t0', 'f0', 1));
  assert.equal(promoted.points, 15);
  assert.equal(promoted.revealed, true);
  assert.deepEqual(promoted.board.tableau[0], { cards: [38], faceUp: 0 });
  const transfer = applyMove(position({ tableau: [[5], [19]] }), move('t0', 't1', 0));
  assert.equal(transfer.points, 0);
  assert.equal(transfer.revealed, false);
  assert.deepEqual(transfer.board.tableau[0], { cards: [], faceUp: 0 });
});

test('a legal foundation backtrack scores minus 15 and only the top may move', () => {
  const board = position({ heights: [2, 0, 0, 0], tableau: [[15]] });
  assert.throws(() => applyMove(board, move('f0', 't0', 0)));
  const result = applyMove(board, move('f0', 't0', 1));
  assert.equal(result.points, -15);
  assert.deepEqual(result.board.foundations[0], [0]);
  assert.deepEqual(result.board.tableau[0].cards, [15, 1]);
});

test('only a king or a king-led face-up sequence fills an empty column', () => {
  assert.throws(() => applyMove(position({ tableau: [[5]] }), move('t0', 't1', 0)));
  const result = applyMove(position({ tableau: [[12, 24]] }), move('t0', 't1', 0));
  assert.deepEqual(result.board.tableau[1].cards, [12, 24]);
  assert.deepEqual(result.board.tableau[0], { cards: [], faceUp: 0 });
  assert.equal(result.points, 0);
});

test('same colour, wrong rank, and multi-card foundation moves are illegal', () => {
  assert.throws(() => applyMove(position({ tableau: [[5], [32]] }), move('t0', 't1', 0)));
  assert.throws(() => applyMove(position({ tableau: [[5], [20]] }), move('t0', 't1', 0)));
  assert.throws(() => applyMove(position({ tableau: [[14, 0]] }), move('t0', 'f1', 0)));
  assert.throws(() => applyMove(position({ waste: [0] }), move('waste', 'f1', 0)));
  assert.throws(() => applyMove(position({ waste: [1] }), move('waste', 'f0', 0)));
});

test('hidden cards, non-top waste, malformed actions and unknown piles cannot move', () => {
  const board = position({ tableau: [{ cards: [12, 5], faceUp: 1 }, [19]], waste: [0, 13] });
  const before = structuredClone(board);
  for (const action of [
    move('t0', 't2', 0), move('waste', 'f0', 0), move('waste', 'f1', -1),
    move('waste', 'f1', 2), move('waste', 'f1', 1.5), move('waste', 'f1', '1'),
    move('t0', 't0', 1), move('t0', 'stock', 1), move('stock', 't0', 0),
    move('t7', 't0', 0), move('f4', 't0', 0), move('t0', 'waste', 1),
    { type: 'fly' }, null,
  ]) {
    assert.throws(() => applyMove(board, action));
    assert.deepEqual(board, before);
  }
});

test('board validation rejects corrupt shape, duplicates and invalid tableau boundaries', () => {
  const base = newBoard(ordered);
  const mutations = [
    b => { b.tableau.pop(); },
    b => { b.foundations.push([]); },
    b => { b.stock[0] = b.stock[1]; },
    b => { b.stock.pop(); },
    b => { b.stock[0] = NaN; },
    b => { b.tableau[0] = null; },
    b => { b.tableau[0].faceUp = 1; },
    b => { b.tableau[1].faceUp = -1; },
    b => { b.tableau[1].faceUp = 0.5; },
    b => { b.tableau[1].faceUp = '1'; },
    b => { b.tableau[1].faceUp = 0; },
    b => { delete b.waste; },
    b => { b.foundations[0] = null; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(base);
    mutate(bad);
    assert.throws(() => validateBoard(bad));
  }
  const empty = position();
  empty.tableau[0].faceUp = 1;
  assert.throws(() => validateBoard(empty));
  for (const bad of [null, undefined, false, 4, []]) assert.throws(() => validateBoard(bad));
});

test('validation enforces foundation suit and rank order and clones valid data', () => {
  const board = position({ heights: [3, 2, 1, 0] });
  const detached = validateBoard(board);
  detached.stock.reverse();
  assert.notDeepEqual(detached.stock, board.stock);
  const wrongOrder = structuredClone(board);
  wrongOrder.foundations[0].reverse();
  assert.throws(() => validateBoard(wrongOrder));
  const wrongSuit = structuredClone(board);
  [wrongSuit.foundations[0], wrongSuit.foundations[1]] = [wrongSuit.foundations[1], wrongSuit.foundations[0]];
  assert.throws(() => validateBoard(wrongSuit));
});

test('legalMoves agrees exactly with applyMove for representative reachable states', () => {
  const names = ['waste', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 'f0', 'f1', 'f2', 'f3'];
  let board = newBoard(deals[0].deck);
  const path = witnesses[deals[0].id];
  for (let step = 0; step < path.length; step++) {
    if (step % 19 === 0) {
      const declared = new Set(legalMoves(board).map(m => JSON.stringify(m)));
      const actions = [{ type: 'draw' }, { type: 'recycle' }];
      for (const from of names) {
        const cards = from === 'waste' ? board.waste :
          from[0] === 't' ? board.tableau[Number(from[1])].cards : board.foundations[Number(from[1])];
        for (let index = 0; index < cards.length; index++) for (const to of names) actions.push(move(from, to, index));
      }
      const accepted = new Set();
      for (const action of actions) {
        try { applyMove(board, action); accepted.add(JSON.stringify(action)); } catch { /* Expected rejection. */ }
      }
      assert.deepEqual(accepted, declared);
    }
    board = applyMove(board, path[step]).board;
  }
});

test('hints prioritize reveals and safe foundations without reading concealed identities', () => {
  const board = position({ tableau: [{ cards: [40, 5], faceUp: 1 }, [19]], waste: [0] });
  const hints = hintMoves(board);
  assert.deepEqual(hints[0].move, move('t0', 't1', 1));
  assert.match(hints[0].reason, /reveal a hidden card/i);
  const hiddenSwap = structuredClone(board);
  [hiddenSwap.stock[0], hiddenSwap.tableau[0].cards[0]] = [hiddenSwap.tableau[0].cards[0], hiddenSwap.stock[0]];
  hiddenSwap.stock.reverse();
  assert.deepEqual(hintMoves(hiddenSwap), hints);
  for (const hint of hints) assert.doesNotThrow(() => applyMove(board, hint.move));
  assert.equal(isSafeFoundation(board, 0), true);
  assert.equal(isSafeFoundation(board, 4), false);
});

test('hints avoid foundation reversals, empty-column king shuffles and one-card recycle loops', () => {
  const board = position({ tableau: [[12, 24], [15]], heights: [2, 0, 0, 0] });
  assert.ok(legalMoves(board).some(m => m.type === 'move' && m.from === 'f0'));
  assert.ok(legalMoves(board).some(m => m.type === 'move' && m.from === 't0' && m.to === 't2'));
  assert.ok(hintMoves(board).every(({ move: m }) => m.type !== 'move' || m.from !== 'f0' && m.from !== 't0'));
  const nearlyWon = position({ heights: [12, 13, 13, 13], waste: [12] });
  assert.ok(hintMoves(nearlyWon).every(({ move: m }) => m.type !== 'recycle'));
});

test('auto-finish is conservative, immutable and returns only a verified foundation sequence', () => {
  assert.equal(autoFinish(newBoard(ordered)), null);
  assert.equal(autoFinish(position({ heights: [12, 13, 13, 13], waste: [12] })), null);
  const board = position({
    heights: [11, 11, 11, 11],
    tableau: [[12, 24], [25, 37], [38, 50], [51, 11]],
  });
  assert.equal(board.stock.length, 0);
  const before = structuredClone(board);
  const actions = autoFinish(board);
  assert.equal(actions.length, 8);
  assert.deepEqual(board, before);
  let finished = board;
  for (const action of actions) {
    assert.equal(action.type, 'move');
    assert.match(action.to, /^f[0-3]$/);
    finished = applyMove(finished, action).board;
  }
  assert.equal(isWon(finished), true);
  assert.deepEqual(autoFinish(finished), []);
  assert.deepEqual(hintMoves(finished), []);
  const hidden = position({ heights: [11, 13, 13, 13], tableau: [{ cards: [12, 11], faceUp: 1 }] });
  assert.equal(autoFinish(hidden), null);
});

test('seeded shuffle and bounded solver reproduce a persisted witness exactly', () => {
  assert.deepEqual(seededDeck(1), seededDeck(1));
  assert.notDeepEqual(seededDeck(1), seededDeck(2));
  assert.equal(new Set(seededDeck(1)).size, 52);
  const deal = deals.find(d => d.seed === 1);
  assert.ok(deal);
  const result = solve(seededDeck(deal.seed), { maxNodes: 6000 });
  assert.deepEqual(result.solution, witnesses[deal.id]);
  assert.equal(result.nodes, deal.searchNodes);
  assert.deepEqual(solve(seededDeck(1), { maxNodes: 0 }).solution, null);
});

test('catalog has 30 distinct genuinely varied seeded decks per tier with separated ratings', () => {
  assert.equal(deals.length, 90);
  assert.equal(new Set(deals.map(d => d.id)).size, 90);
  assert.equal(new Set(deals.map(d => d.deck.join(','))).size, 90);
  // Rank-only layouts also differ, so no pair is merely a suit permutation.
  assert.equal(new Set(deals.map(d => d.deck.map(cardRank).join(','))).size, 90);
  const groups = ['Easy', 'Medium', 'Difficult'].map(t => deals.filter(d => d.difficulty === t));
  for (const group of groups) assert.equal(group.length, 30);
  assert.ok(Math.max(...groups[0].map(d => d.metrics.rating)) < Math.min(...groups[1].map(d => d.metrics.rating)));
  assert.ok(Math.max(...groups[1].map(d => d.metrics.rating)) < Math.min(...groups[2].map(d => d.metrics.rating)));
  const avg = (group, key) => group.reduce((sum, d) => sum + d.metrics[key], 0) / group.length;
  assert.ok(avg(groups[0], 'tableauMoves') < avg(groups[1], 'tableauMoves'));
  assert.ok(avg(groups[1], 'tableauMoves') < avg(groups[2], 'tableauMoves'));
  assert.ok(avg(groups[0], 'buriedLowCards') < avg(groups[2], 'buriedLowCards'));
});

test('independent verifier rejects illegal or incomplete witnesses', () => {
  const deal = deals[0];
  assert.throws(() => verifyWitness(deal.deck, []), /does not reach/);
  assert.throws(() => verifyWitness(deal.deck, [{ type: 'recycle' }]), /Invalid recycle/);
  assert.throws(() => verifyWitness(deal.deck, [move('t6', 'f0', 0)]), /Hidden/);
  assert.throws(() => verifyWitness(deal.deck, witnesses[deal.id].slice(0, -1)), /does not reach/);
  assert.throws(() => verifyWitness([...deal.deck.slice(1), deal.deck[1]], []), /Invalid witness deck/);
});

test('all 90 witnesses independently replay to victory and agree with the runtime engine', async t => {
  assert.equal(verifyCatalog(deals, witnesses), true);
  for (const deal of deals) {
    await t.test(`${deal.id} (seed ${deal.seed})`, () => {
      assert.deepEqual(deal.deck, seededDeck(deal.seed));
      const solution = witnesses[deal.id];
      const independent = verifyWitness(deal.deck, solution);
      let board = newBoard(deal.deck), points = 0, reveals = 0;
      for (const action of solution) {
        const result = applyMove(board, action);
        points += result.points;
        reveals += Number(result.revealed);
        board = validateBoard(result.board);
      }
      assert.equal(isWon(board), true);
      assert.equal(points, independent.points);
      assert.equal(reveals, 21);
      assert.equal(reveals, independent.reveals);
      assert.deepEqual(deal.metrics, dealMetrics(deal.deck, solution));
    });
  }
});
