import { applyMove, cardRank, cardSuit, isSafeFoundation, isWon, legalMoves, newBoard } from '../../src/game/engine.ts';

/** Mulberry32 and a Fisher–Yates shuffle; stable across JS runtimes. */
export function seededDeck(seed) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function stateKey(board) {
  // Column order is immaterial to solvability. Removing column permutations
  // avoids searching seven equivalent destinations for a king.
  return board.tableau.map(c => `${c.faceUp}:${c.cards.join(',')}`).sort().join('|') +
    `/${board.foundations.map(f => f.length).join(',')}/${board.stock.join(',')}/${board.waste.join(',')}`;
}

function promoteSafe(board) {
  const moves = [];
  for (;;) {
    const move = legalMoves(board).find(m => {
      if (m.type !== 'move' || m.to[0] !== 'f') return false;
      const cards = m.from === 'waste' ? board.waste : board.tableau[Number(m.from[1])].cards;
      return isSafeFoundation(board, cards[m.index]);
    });
    if (!move) break;
    board = applyMove(board, move).board;
    moves.push(move);
  }
  return { board, moves };
}

function moveWeight(board, move) {
  const source = move.from === 'waste' ? null : board.tableau[Number(move.from[1])];
  const reveals = source && source.faceUp > 0 && source.faceUp === move.index;
  const foundation = move.to[0] === 'f';
  let weight = reveals ? 100 + source.faceUp * 4 : 0;
  if (foundation) weight += 45;
  if (move.from === 'waste') weight += 35;
  if (source && move.index > source.faceUp) {
    const below = source.cards[move.index - 1];
    if (board.foundations[cardSuit(below)].length + 1 === cardRank(below)) weight += 20;
  }
  return weight;
}

function candidates(board) {
  const options = [];
  const empty = board.tableau.findIndex(c => c.cards.length === 0);
  const add = (state, move, prefix) => {
    if (move.from[0] === 'f') return;
    if (move.to[0] === 't' && !state.tableau[Number(move.to[1])].cards.length) {
      if (Number(move.to[1]) !== empty) return;
      if (move.from[0] === 't' && move.index === 0) return;
    }
    options.push({ move, prefix, state, weight: moveWeight(state, move) - prefix.length * 0.25 });
  };
  for (const move of legalMoves(board)) if (move.type === 'move') add(board, move, []);

  // A macro draws at most one complete stock cycle and then plays the exposed
  // waste card. Pure stock cycles never change the position and need no node.
  const prefix = [];
  let scan = board;
  const originalWaste = new Set(board.waste);
  let recycled = false;
  const seen = new Set(board.waste.length ? [board.waste.at(-1)] : []);
  for (let guard = 0; guard < 105; guard++) {
    let move;
    if (scan.stock.length) move = { type: 'draw' };
    else {
      if (recycled || !originalWaste.size || !scan.waste.length) break;
      move = { type: 'recycle' };
      recycled = true;
    }
    scan = applyMove(scan, move).board;
    prefix.push(move);
    if (move.type === 'recycle') continue;
    const card = scan.waste.at(-1);
    if (seen.has(card)) break;
    seen.add(card);
    for (const next of legalMoves(scan)) {
      if (next.type === 'move' && next.from === 'waste') add(scan, next, [...prefix]);
    }
  }
  return options.sort((a, b) => b.weight - a.weight);
}

/** Bounded, deterministic, full-information offline search, never shipped to the browser. */
export function solve(deck, { maxNodes = 12000, maxDepth = 180 } = {}) {
  const seen = new Set();
  let nodes = 0;
  let maxBranch = 0;
  let decisions = 0;
  let exhausted = false;
  function visit(board, depth) {
    if (nodes >= maxNodes) { exhausted = true; return null; }
    if (depth > maxDepth) return null;
    const normalized = promoteSafe(board);
    board = normalized.board;
    if (isWon(board)) return normalized.moves;
    const key = stateKey(board);
    if (seen.has(key)) return null;
    seen.add(key);
    nodes++;
    const options = candidates(board);
    maxBranch = Math.max(maxBranch, options.length);
    if (options.length > 1) decisions++;
    for (const option of options) {
      const next = applyMove(option.state, option.move).board;
      const tail = visit(next, depth + 1);
      if (tail) return [...normalized.moves, ...option.prefix, option.move, ...tail];
      if (exhausted) break;
    }
    return null;
  }
  const solution = visit(newBoard(deck), 0);
  return { solution, nodes, maxBranch, decisions, exhausted };
}

export function dealMetrics(deck, solution) {
  let board = newBoard(deck);
  const buriedLowCards = board.tableau.reduce((sum, c) => sum +
    c.cards.slice(0, c.faceUp).reduce((n, card, i) =>
      n + (cardRank(card) <= 5 ? c.cards.length - 1 - i : 0), 0), 0);
  const initialLegalChoices = legalMoves(board).filter(m => m.type === 'move' && m.from[0] !== 'f').length;
  let tableauMoves = 0, wastePlacements = 0, recycles = 0, draws = 0, reveals = 0, unsafePromotions = 0;
  for (const move of solution) {
    if (move.type === 'recycle') recycles++;
    if (move.type === 'draw') draws++;
    if (move.type === 'move') {
      if (move.from[0] === 't' && move.to[0] === 't') tableauMoves++;
      if (move.from === 'waste' && move.to[0] === 't') wastePlacements++;
      if (move.to[0] === 'f') {
        const cards = move.from === 'waste' ? board.waste : board.tableau[Number(move.from[1])].cards;
        if (!isSafeFoundation(board, cards[move.index])) unsafePromotions++;
      }
    }
    const result = applyMove(board, move);
    if (result.revealed) reveals++;
    board = result.board;
  }
  if (!isWon(board)) throw new Error('Search returned a nonwinning witness.');
  return {
    buriedLowCards, initialLegalChoices, tableauMoves, wastePlacements, recycles,
    draws, reveals, unsafePromotions, solutionLength: solution.length,
    rating: buriedLowCards + 3 * tableauMoves + 2 * wastePlacements + 8 * recycles + 4 * unsafePromotions,
  };
}
