import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seededDeck, solve, dealMetrics } from './solver.mjs';
import { verifyCatalog, verifyWitness } from './verify.mjs';

export function generateCatalog({ candidates = 150, maxSeed = 2500, maxNodes = 6000, log = console.log } = {}) {
  const solved = [];
  for (let seed = 1; seed <= maxSeed && solved.length < candidates; seed++) {
    const deck = seededDeck(seed);
    const result = solve(deck, { maxNodes });
    if (result.solution) {
      verifyWitness(deck, result.solution);
      const metrics = dealMetrics(deck, result.solution);
      solved.push({ seed, deck, metrics, nodes: result.nodes, solution: result.solution });
      log(`Seed ${seed}: solved ${solved.length}/${candidates}; nodes ${result.nodes}; rating ${metrics.rating}; actions ${metrics.solutionLength}`);
    } else if (seed % 10 === 0) log(`Seed ${seed}: no witness within ${maxNodes} nodes (${solved.length} solved so far).`);
  }
  if (solved.length < 90) throw new Error(`Only ${solved.length} witnesses found; refusing to publish an incomplete catalog.`);
  solved.sort((a, b) => a.metrics.rating - b.metrics.rating || a.seed - b.seed);
  const middle = Math.floor((solved.length - 30) / 2);
  const groups = [solved.slice(0, 30), solved.slice(middle, middle + 30), solved.slice(-30)];
  const catalog = [], witnesses = {};
  for (const [tier, group] of groups.entries()) {
    const difficulty = ['Easy', 'Medium', 'Difficult'][tier];
    group.forEach((record, i) => {
      const id = `${difficulty.toLowerCase()}-${String(i + 1).padStart(2, '0')}`;
      catalog.push({
        id, difficulty, deck: record.deck, seed: record.seed,
        verification: 'independent-winning-replay-v1',
        metrics: record.metrics, searchNodes: record.nodes,
      });
      witnesses[id] = record.solution;
    });
  }
  verifyCatalog(catalog, witnesses);
  return { catalog, witnesses, candidatesSolved: solved.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const candidates = Number(process.argv[2] ?? 150);
  const result = generateCatalog({ candidates });
  writeFileSync(new URL('../../src/data/catalog.json', import.meta.url), `${JSON.stringify(result.catalog)}\n`);
  writeFileSync(new URL('./witnesses.json', import.meta.url), `${JSON.stringify(result.witnesses)}\n`);
  console.log(`Wrote 90 independently verified deals selected from ${result.candidatesSolved} solved random seeded deals.`);
}
