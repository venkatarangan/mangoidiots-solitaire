# Reproducible verified Klondike catalog

The browser imports only `src/data/catalog.json` through `src/data/deals.ts`.
This directory is offline tooling, **not** browser code. `witnesses.json` holds
every elementary action of all 90 winning solutions.

## Reproduce and verify

From the project root, using Node 24 or later (native erasable TypeScript support):

```powershell
node tools/deals/generate.mjs 150
node tools/deals/verify.mjs
node --test tests/game.test.mjs
```

The first command deterministically generates the exact release catalog and
witnesses. The second checks the witnesses using a separately implemented rules
replayer that imports neither the runtime engine nor the solver. The tests also
replay all 90 with the runtime engine, compare scores, verify the 21 reveals per
deal, validate the intermediate boards, regenerate each seeded deck, and check a
solver result against its recorded witness.

## Provenance and search

- These are original seeded shuffled 52-card decks, not downloaded deals or
  constructive templates. All 90 also have distinct rank-only layouts: none is
  just a suit permutation of another.
- `seededDeck(seed)` uses Mulberry32 and a Fisher–Yates shuffle. Integer seeds
  1 through 261 supply the first 150 witnessed wins under the default search
  limit of 6,000 states per candidate.
- `newBoard` deals rows left to right: columns 0–6, then 1–6, through column 6.
  The next deck card (index 28) is the first stock draw.
- The original bounded depth-first solver uses full information **offline**,
  canonicalizes tableau-column permutations, prioritizes reveals, automatically
  promotes sufficiently safe foundation cards, and represents stock scanning
  as drawing/recycling followed by playing a reachable waste card. Every macro
  is expanded to normal engine actions in the saved witness.
- Search excludes foundation backtracks and pointless empty-column king
  transfers. It is deliberately incomplete: failure to find a witness says
  nothing about a candidate's actual solvability. It does not find shortest
  solutions. No unsolved candidate is published.
- The independent verifier checks normal Draw 1 rules, exact stock order,
  alternating sequences, reveal boundaries, fixed-suit foundations, 52-card
  conservation after every action, and the final four complete foundations.

## Difficulty is a heuristic, not a certification

Solvability is certified by replay. Human difficulty is **not** certified.
These labels estimate challenge from both the initial structure and a recorded
solution. They do not use search runtime, random assignment, suit permutations,
or a claim that the witness is an optimal human route. Representative human
playtesting remains necessary to calibrate the labels.

The rating is:

```text
buriedLowCards
  + 3 * tableauMoves
  + 2 * wastePlacements
  + 8 * recycles
  + 4 * unsafePromotions
```

`buriedLowCards` sums the number of cards above each hidden ace through five.
The remaining metrics count actions in the recorded witness. An
`unsafePromotion` simply fails the solver's sufficient safe-promotion test; it
is not a claim that the move is losing. The sufficient test accepts aces/twos
or requires both opposite-colour foundations to reach rank minus one and the
other same-colour foundation to reach rank minus two.

Sort the 150 solved candidates by rating, breaking ties by seed. Publish the
lowest 30 as Easy, the middle 30 as Medium, and the highest 30 as Difficult.
This leaves rating gaps between tiers rather than splitting tied ratings.

| Metric | Easy (30) | Medium (30) | Difficult (30) |
| --- | ---: | ---: | ---: |
| Rating range | 125–162 | 178–189 | 201–262 |
| Mean buried-low-card depth sum | 21.67 | 22.27 | 23.30 |
| Mean tableau rearrangements | 14.27 | 17.17 | 20.73 |
| Mean waste-to-tableau placements | 11.30 | 14.23 | 14.27 |
| Mean recycles | 3.67 | 4.53 | 5.30 |
| Mean promotions outside sufficient safe test | 8.30 | 11.33 | 15.30 |
| Mean witness actions (including draws) | 153.57 | 168.47 | 182.47 |

The tier averages differ meaningfully, but individual metric ranges overlap;
no single count defines human difficulty. A player's alternative choices can
still make a supplied deal unwinnable. Runtime hints inspect visible cards only
and do not consult the witnesses, seeds, hidden cards, or offline solver.
