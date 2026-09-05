import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Intentionally independent of engine.ts and the search implementation.
 * Replay every elementary action, enforce all rules, and conserve all cards.
 */
export function verifyWitness(deck, moves) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  assert(Array.isArray(deck) && deck.length === 52 && new Set(deck).size === 52 &&
    deck.every(c => Number.isInteger(c) && c >= 0 && c < 52), 'Invalid witness deck');
  assert(Array.isArray(moves), 'Invalid witness action list');
  const columns = Array.from({ length: 7 }, () => []);
  const boundaries = [0, 1, 2, 3, 4, 5, 6];
  const foundations = [[], [], [], []];
  let offset = 0;
  for (let row = 0; row < 7; row++) for (let col = row; col < 7; col++) columns[col].push(deck[offset++]);
  let stock = deck.slice(28).reverse(), waste = [];
  let points = 0, reveals = 0;
  const rank = c => c % 13 + 1;
  const suit = c => Math.trunc(c / 13);
  const get = name => name === 'waste' ? waste :
    /^t[0-6]$/.test(name) ? columns[Number(name[1])] :
    /^f[0-3]$/.test(name) ? foundations[Number(name[1])] : null;
  for (const [step, move] of moves.entries()) {
    const check = (ok, message) => assert(ok, `Action ${step}: ${message}`);
    check(move && typeof move === 'object', 'Bad action');
    if (move.type === 'draw') {
      check(stock.length > 0, 'Draw from empty stock');
      waste.push(stock.pop());
    } else if (move.type === 'recycle') {
      check(stock.length === 0 && waste.length > 0, 'Invalid recycle');
      stock = [...waste].reverse();
      waste = [];
      points -= 100;
    } else {
      check(move.type === 'move', 'Unknown action');
      check(typeof move.from === 'string' && typeof move.to === 'string', 'Invalid pile names');
      const source = get(move.from), destination = get(move.to);
      check(source && destination && source !== destination && move.to !== 'waste', 'Invalid piles');
      const i = move.index, col = Number(move.from[1]);
      check(Number.isInteger(i) && i >= 0 && i < source.length, 'Invalid source index');
      check(move.from[0] === 't' ? i >= boundaries[col] : i === source.length - 1, 'Hidden or non-top source');
      const sequence = source.slice(i);
      for (let j = 1; j < sequence.length; j++) {
        check(rank(sequence[j - 1]) === rank(sequence[j]) + 1 &&
          suit(sequence[j - 1]) % 2 !== suit(sequence[j]) % 2, 'Invalid source sequence');
      }
      const card = sequence[0];
      if (move.to[0] === 'f') {
        check(move.from[0] !== 'f' && sequence.length === 1 && suit(card) === Number(move.to[1]) &&
          rank(card) === destination.length + 1, 'Invalid foundation placement');
        points += 10;
      } else {
        check(move.to[0] === 't', 'Invalid destination');
        check(destination.length ? rank(destination.at(-1)) === rank(card) + 1 &&
          suit(destination.at(-1)) % 2 !== suit(card) % 2 : rank(card) === 13, 'Invalid tableau placement');
        if (move.from === 'waste') points += 5;
        if (move.from[0] === 'f') points -= 15;
      }
      source.splice(i);
      destination.push(...sequence);
      if (move.from[0] === 't') {
        if (source.length === 0) boundaries[col] = 0;
        else if (boundaries[col] >= source.length) {
          boundaries[col] = source.length - 1;
          reveals++;
          points += 5;
        }
      }
    }
    const all = [...stock, ...waste, ...columns.flat(), ...foundations.flat()];
    check(all.length === 52 && new Set(all).size === 52, 'Cards were lost or duplicated');
  }
  assert(foundations.every((f, s) => f.length === 13 && f.every((c, i) => c === s * 13 + i)),
    'Witness does not reach all four complete foundations');
  assert(!stock.length && !waste.length && columns.every(c => !c.length), 'Non-foundation cards remain');
  return { points, reveals, actions: moves.length };
}

export function verifyCatalog(catalog, witnesses) {
  if (catalog.length !== 90) throw new Error('The release catalog must have 90 deals.');
  if (new Set(catalog.map(d => d.id)).size !== 90 || new Set(catalog.map(d => d.deck.join(','))).size !== 90) {
    throw new Error('Duplicate deal ID or deck.');
  }
  for (const difficulty of ['Easy', 'Medium', 'Difficult']) {
    if (catalog.filter(d => d.difficulty === difficulty).length !== 30) throw new Error(`Expected 30 ${difficulty} deals.`);
  }
  for (const deal of catalog) {
    if (!Array.isArray(witnesses[deal.id])) throw new Error(`Missing witness ${deal.id}`);
    verifyWitness(deal.deck, witnesses[deal.id]);
  }
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const catalog = JSON.parse(readFileSync(new URL('../../src/data/catalog.json', import.meta.url), 'utf8'));
  const witnesses = JSON.parse(readFileSync(new URL('./witnesses.json', import.meta.url), 'utf8'));
  verifyCatalog(catalog, witnesses);
  console.log('Independently verified all 90 winning witnesses.');
}
