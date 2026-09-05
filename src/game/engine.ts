/** Cards are 0..51: A..K of spades, hearts, clubs, then diamonds. */
export type Card = number;
export interface Column { cards: Card[]; faceUp: number }
export interface Board {
  stock: Card[];
  waste: Card[];
  tableau: Column[];
  /** Foundation indices are fixed to the suit indices. */
  foundations: Card[][];
}
export type Move =
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'move'; from: string; to: string; index: number };

const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
const ranks = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
export const cardRank = (card: Card): number => card % 13 + 1;
export const cardSuit = (card: Card): number => Math.floor(card / 13);
export const cardLabel = (card: Card): string => `${ranks[cardRank(card) - 1]} of ${suits[cardSuit(card)]}`;
const opposite = (a: Card, b: Card): boolean => cardSuit(a) % 2 !== cardSuit(b) % 2;
const fits = (lower: Card, upper: Card): boolean => cardRank(lower) === cardRank(upper) + 1 && opposite(lower, upper);
const top = (cards: Card[]): Card => cards[cards.length - 1];

function fail(message: string): never { throw new Error(message); }
function cardArray(value: unknown, name: string): Card[] {
  if (!Array.isArray(value)) fail(`${name} must be an array.`);
  for (const card of value) {
    if (!Number.isInteger(card) || card < 0 || card > 51) fail(`${name} contains an invalid card.`);
  }
  return [...value];
}
function completeDeck(cards: Card[]): void {
  if (cards.length !== 52 || new Set(cards).size !== 52) fail('A board must contain all 52 cards exactly once.');
}

/** Validate persisted/untrusted state and return a detached, normalized copy. */
export function validateBoard(value: unknown): Board {
  if (value === null || typeof value !== 'object') fail('A board must be an object.');
  const v = value as Record<string, unknown>;
  const stock = cardArray(v.stock, 'Stock');
  const waste = cardArray(v.waste, 'Waste');
  if (!Array.isArray(v.tableau) || v.tableau.length !== 7) fail('A board needs seven tableau columns.');
  if (!Array.isArray(v.foundations) || v.foundations.length !== 4) fail('A board needs four foundations.');
  const tableau: Column[] = [];
  for (const [i, value] of v.tableau.entries()) {
    if (value === null || typeof value !== 'object') fail(`Invalid tableau column ${i}.`);
    const column = value as Record<string, unknown>;
    const cards = cardArray(column.cards, `Tableau ${i}`);
    const faceUp = column.faceUp;
    if (typeof faceUp !== 'number' || !Number.isInteger(faceUp) ||
        faceUp < 0 || (cards.length === 0 ? faceUp !== 0 : faceUp >= cards.length)) {
      fail(`Invalid face-up boundary in tableau ${i}.`);
    }
    for (let j = faceUp + 1; j < cards.length; j++) {
      if (!fits(cards[j - 1], cards[j])) fail(`Invalid face-up sequence in tableau ${i}.`);
    }
    tableau.push({ cards, faceUp });
  }
  const foundations: Card[][] = [];
  for (const [suit, value] of v.foundations.entries()) {
    const cards = cardArray(value, `Foundation ${suit}`);
    if (cards.length > 13 || cards.some((card, i) => cardSuit(card) !== suit || cardRank(card) !== i + 1)) {
      fail(`Foundation ${suit} must ascend from ace in its own suit.`);
    }
    foundations.push(cards);
  }
  completeDeck([...stock, ...waste, ...tableau.flatMap(c => c.cards), ...foundations.flat()]);
  return { stock, waste, tableau, foundations };
}

/**
 * deck[0] is dealt first. Deal rows left to right: columns 0..6, then 1..6,
 * through column 6. Turn up each column's last card. deck[28] is the first
 * stock draw (the stored stock is reversed, because all pile tops are last).
 */
export function newBoard(deck: Card[]): Board {
  const cards = cardArray(deck, 'Deck');
  completeDeck(cards);
  const tableau: Column[] = Array.from({ length: 7 }, () => ({ cards: [], faceUp: 0 }));
  let next = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) tableau[col].cards.push(cards[next++]);
  }
  for (const column of tableau) column.faceUp = column.cards.length - 1;
  return { stock: cards.slice(28).reverse(), waste: [], tableau, foundations: [[], [], [], []] };
}

function pile(board: Board, name: string): { cards: Card[]; kind: 'waste' | 'tableau' | 'foundation'; column?: Column; suit?: number } {
  if (name === 'waste') return { cards: board.waste, kind: 'waste' };
  if (/^t[0-6]$/.test(name)) {
    const column = board.tableau[Number(name[1])];
    return { cards: column.cards, kind: 'tableau', column };
  }
  if (/^f[0-3]$/.test(name)) {
    const suit = Number(name[1]);
    return { cards: board.foundations[suit], kind: 'foundation', suit };
  }
  return fail('Unknown pile.');
}

export function applyMove(board: Board, move: Move): { board: Board; points: number; revealed: boolean; description: string } {
  const next = validateBoard(board);
  if (move === null || typeof move !== 'object') fail('Invalid move.');
  if (move.type === 'draw') {
    if (!next.stock.length) fail('The stock is empty.');
    next.waste.push(next.stock.pop()!);
    return { board: next, points: 0, revealed: false, description: `Draw ${cardLabel(top(next.waste))}.` };
  }
  if (move.type === 'recycle') {
    if (next.stock.length || !next.waste.length) fail('Recycle only an exhausted stock with nonempty waste.');
    next.stock = next.waste.reverse();
    next.waste = [];
    return { board: next, points: -100, revealed: false, description: 'Recycle the waste without shuffling.' };
  }
  if (move.type !== 'move' || typeof move.from !== 'string' || typeof move.to !== 'string' ||
      !Number.isInteger(move.index) || move.from === move.to) fail('Invalid move.');
  const source = pile(next, move.from);
  const target = pile(next, move.to);
  if (move.index < 0 || move.index >= source.cards.length) fail('No card at that source index.');
  if (source.column ? move.index < source.column.faceUp : move.index !== source.cards.length - 1) {
    fail('Only face-up tableau sequences or the top waste/foundation card may move.');
  }
  const moved = source.cards.slice(move.index);
  let points = 0;
  if (target.kind === 'foundation') {
    if (source.kind === 'foundation' || moved.length !== 1 || cardSuit(moved[0]) !== target.suit ||
        cardRank(moved[0]) !== target.cards.length + 1) fail('Foundations build upward in suit, one card at a time.');
    points = 10;
  } else if (target.kind === 'tableau') {
    if (target.cards.length ? !fits(top(target.cards), moved[0]) : cardRank(moved[0]) !== 13) {
      fail('Tableau builds downward in alternating colours; only kings fill empty columns.');
    }
    points = source.kind === 'waste' ? 5 : source.kind === 'foundation' ? -15 : 0;
  } else fail('Cards cannot be moved to the waste.');
  source.cards.splice(move.index);
  target.cards.push(...moved);
  let revealed = false;
  if (source.column) {
    if (!source.cards.length) source.column.faceUp = 0;
    else if (source.column.faceUp >= source.cards.length) {
      source.column.faceUp = source.cards.length - 1;
      revealed = true;
      points += 5;
    }
  }
  const destination = target.kind === 'foundation' ? `${suits[target.suit!]} foundation` : `column ${Number(move.to[1]) + 1}`;
  return {
    board: next, points, revealed,
    description: `Move ${cardLabel(moved[0])}${moved.length > 1 ? ` and ${moved.length - 1} following card${moved.length === 2 ? '' : 's'}` : ''} to ${destination}.${revealed ? ' Reveal a hidden card.' : ''}`,
  };
}

/** All legal actions, including legal but strategically pointless reversals. */
export function legalMoves(board: Board): Move[] {
  const moves: Move[] = [];
  if (board.stock.length) moves.push({ type: 'draw' });
  else if (board.waste.length) moves.push({ type: 'recycle' });
  const sources = [
    { name: 'waste', cards: board.waste, start: board.waste.length - 1 },
    ...board.tableau.map((c, i) => ({ name: `t${i}`, cards: c.cards, start: c.faceUp })),
    ...board.foundations.map((cards, i) => ({ name: `f${i}`, cards, start: cards.length - 1 })),
  ];
  for (const source of sources) {
    if (!source.cards.length) continue;
    for (let index = source.start; index < source.cards.length; index++) {
      const card = source.cards[index];
      if (source.name[0] !== 'f' && index === source.cards.length - 1 && board.foundations[cardSuit(card)].length + 1 === cardRank(card)) {
        moves.push({ type: 'move', from: source.name, to: `f${cardSuit(card)}`, index });
      }
      board.tableau.forEach((column, i) => {
        if (source.name !== `t${i}` && (column.cards.length ? fits(top(column.cards), card) : cardRank(card) === 13)) {
          moves.push({ type: 'move', from: source.name, to: `t${i}`, index });
        }
      });
    }
  }
  return moves;
}

export const isWon = (board: Board): boolean => board.foundations.every(f => f.length === 13) &&
  board.stock.length === 0 && board.waste.length === 0 && board.tableau.every(c => c.cards.length === 0);

/** A sufficient (not necessary) visible-information condition for promotion. */
export function isSafeFoundation(board: Board, card: Card): boolean {
  const rank = cardRank(card);
  const suit = cardSuit(card);
  return rank <= 2 || board.foundations.every((f, s) =>
    s === suit || f.length >= rank - (s % 2 === suit % 2 ? 2 : 1));
}

export function hintMoves(board: Board): Array<{ move: Move; reason: string }> {
  const ranked: Array<{ move: Move; reason: string; priority: number }> = [];
  for (const move of legalMoves(board)) {
    if (move.type === 'draw') {
      ranked.push({ move, priority: 10, reason: 'Draw the next stock card to discover another option.' });
      continue;
    }
    if (move.type === 'recycle') {
      // One remaining waste card cannot uncover a new option by recycling.
      if (board.waste.length > 1) ranked.push({ move, priority: 0, reason: 'Recycle to revisit earlier waste cards. This costs 100 points.' });
      continue;
    }
    const source = pile(board, move.from);
    const card = source.cards[move.index];
    const reveals = !!source.column && source.column.faceUp > 0 && move.index === source.column.faceUp;
    if (move.to[0] === 'f') {
      if (isSafeFoundation(board, card)) {
        ranked.push({ move, priority: reveals ? 110 : 90, reason: `Build the ${suits[cardSuit(card)]} foundation safely${reveals ? ' and reveal a hidden card' : ''}.` });
      } else if (reveals) {
        ranked.push({ move, priority: 70, reason: 'Reveal a hidden card by moving this card to its foundation. It may still be useful in the tableau.' });
      }
      continue;
    }
    if (source.kind === 'foundation') continue; // Avoid immediately undoing a suggested promotion.
    if (reveals) {
      ranked.push({ move, priority: 100, reason: `Move ${cardLabel(card)}${source.cards.length - move.index > 1 ? ' and its sequence' : ''} to reveal a hidden card.` });
    } else if (source.kind === 'waste') {
      ranked.push({ move, priority: 60, reason: 'Bring this waste card into play and expose the waste card beneath it.' });
    } else if (move.index > source.column!.faceUp) {
      const exposed = source.cards[move.index - 1];
      if (board.foundations[cardSuit(exposed)].length + 1 === cardRank(exposed)) {
        ranked.push({ move, priority: 50, reason: 'Uncover a visible card that can move to its foundation.' });
      }
    }
  }
  return ranked.sort((a, b) => b.priority - a.priority).map(({ move, reason }) => ({ move, reason }));
}

/**
 * No hidden-card reasoning or stock search: return a replay-verified sequence
 * only when the entire remainder can be promoted directly to foundations.
 */
export function autoFinish(board: Board): Move[] | null {
  let next = validateBoard(board);
  if (next.stock.length || next.waste.length || next.tableau.some(c => c.faceUp !== 0)) return null;
  const moves: Move[] = [];
  while (!isWon(next)) {
    const move = legalMoves(next).find(m => m.type === 'move' && m.to[0] === 'f');
    if (!move) return null;
    next = applyMove(next, move).board;
    moves.push(move);
  }
  return moves;
}
