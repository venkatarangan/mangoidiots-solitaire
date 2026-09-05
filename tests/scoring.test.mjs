import test from "node:test";
import assert from "node:assert/strict";
import { playingScore, summary, validateAttempt } from "../src/storage.ts";
import { newBoard } from "../src/game/engine.ts";

function attempt(overrides = {}) {
  return {
    schemaVersion: 1, id: "score-test", dealId: "test", difficulty: "Easy",
    startedAt: "2026-01-01T00:00:00Z", endedAt: null,
    board: newBoard(Array.from({ length: 52 }, (_, i) => i)),
    elapsedMs: 0, started: false, movePoints: 0, undoPenalty: 0,
    moves: 0, hints: 0, undos: 0, bonus: 0, status: "active", undo: [],
    ...overrides,
  };
}
test("time penalty is applied at each complete ten-second boundary", () => {
  const game = attempt({ movePoints: 20 });
  assert.equal(playingScore(game, 9999), 20);
  assert.equal(playingScore(game, 10000), 18);
  assert.equal(playingScore(game, 19999), 18);
  assert.equal(playingScore(game, 20000), 16);
});
test("display clamps signed totals without forgetting deductions", () => {
  const game = attempt({ movePoints: -100, undoPenalty: 2, elapsedMs: 10000 });
  assert.equal(playingScore(game), 0);
  assert.equal(playingScore({ ...game, movePoints: 100 }), 96);
  assert.equal(playingScore({ ...game, movePoints: 5 }), 1);
});
test("history adds a bonus only for a win and retains independent counters", () => {
  const game = attempt({ movePoints: 60, bonus: 100, moves: 5, hints: 2, undos: 3, undoPenalty: 6 });
  assert.equal(summary(game, "Won").score, 154);
  assert.equal(summary(game, "Restarted").score, 54);
  assert.deepEqual([summary(game, "Abandoned").moves, summary(game, "Abandoned").hints, summary(game, "Abandoned").undos], [5, 2, 3]);
});
test("unsupported, duplicate-card and damaged Undo saves are rejected", () => {
  assert.throws(() => validateAttempt(attempt({ schemaVersion: 2 })));
  assert.throws(() => validateAttempt(attempt({ elapsedMs: -1 })));
  assert.throws(() => validateAttempt(attempt({ undo: [{ board: {}, movePoints: 0 }] })));
  const invalid = attempt();
  invalid.board.stock[0] = invalid.board.stock[1];
  assert.throws(() => validateAttempt(invalid));
  assert.equal(validateAttempt(attempt()).id, "score-test");
});
