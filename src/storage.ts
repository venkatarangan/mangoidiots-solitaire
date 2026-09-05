import { validateBoard, isWon, type Board } from "./game/engine.ts";
import type { Difficulty } from "./data/deals";
import { gameStorageKey } from "./identity.ts";

export interface Snapshot { board: Board; movePoints: number }
export interface Attempt {
  schemaVersion: 1;
  id: string;
  dealId: string;
  difficulty: Difficulty;
  startedAt: string;
  endedAt: string | null;
  board: Board;
  elapsedMs: number;
  started: boolean;
  movePoints: number;
  undoPenalty: number;
  moves: number;
  hints: number;
  undos: number;
  bonus: number;
  status: "active" | "won";
  undo: Snapshot[];
}
export interface Preferences {
  music: number;
  effects: number;
  muted: boolean;
  reduced: boolean;
  difficulty: Difficulty;
  theme: string;
  themeVersion: string;
  seen: Record<Difficulty, string[]>;
}
export interface HistoryEntry {
  id: string; dealId: string; difficulty: Difficulty;
  startedAt: string; endedAt: string;
  result: "Won" | "Restarted" | "Abandoned";
  score: number; elapsedMs: number; moves: number; hints: number; undos: number;
}
export const defaults = (): Preferences => ({
  music: .18, effects: .65, muted: false,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  difficulty: "Easy", theme: "chola", themeVersion: "1.0.0", seen: { Easy: [], Medium: [], Difficult: [] },
});
const difficulty = (value: unknown): value is Difficulty => ["Easy", "Medium", "Difficult"].includes(String(value));
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved data is not an object.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.length) throw new Error("Saved text is missing.");
  return value;
}
function number(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) throw new Error("A saved number is invalid.");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("A saved option is invalid.");
  return value;
}
export function validateAttempt(value: unknown): Attempt {
  const v = object(value);
  if (v.schemaVersion !== 1 || !difficulty(v.difficulty) || !["active", "won"].includes(String(v.status)) || !Array.isArray(v.undo)) {
    throw new Error("This saved game has an unsupported format. It has not been overwritten.");
  }
  const undo = v.undo.map((entry: unknown) => {
    const s = object(entry);
    return { board: validateBoard(s.board), movePoints: number(s.movePoints, -Infinity) };
  });
  const board = validateBoard(v.board);
  if ((v.status === "won") !== isWon(board) || (v.status === "won" ? v.endedAt === null : v.endedAt !== null)) {
    throw new Error("Saved completion status does not match the cards.");
  }
  if (!Number.isFinite(Date.parse(text(v.startedAt))) ||
      (v.endedAt !== null && !Number.isFinite(Date.parse(text(v.endedAt))))) throw new Error("Saved game dates are invalid.");
  for (const key of ["movePoints", "undoPenalty", "moves", "hints", "undos", "bonus"]) {
    if (!Number.isSafeInteger(v[key])) throw new Error("Saved game counters are invalid.");
  }
  return {
    schemaVersion: 1, id: text(v.id), dealId: text(v.dealId), difficulty: v.difficulty,
    startedAt: text(v.startedAt), endedAt: v.endedAt === null ? null : text(v.endedAt),
    board, elapsedMs: number(v.elapsedMs), started: boolean(v.started),
    movePoints: number(v.movePoints, -Infinity), undoPenalty: number(v.undoPenalty),
    moves: number(v.moves), hints: number(v.hints), undos: number(v.undos), bonus: number(v.bonus),
    status: v.status === "won" ? "won" : "active", undo,
  };
}
function preferences(value: unknown): Preferences {
  if (value === undefined) return defaults();
  const v = object(value), seen = object(v.seen);
  if (!difficulty(v.difficulty)) throw new Error("Saved difficulty is invalid.");
  const music = number(v.music), effects = number(v.effects);
  if (music > 1 || effects > 1) throw new Error("Saved sound volume is invalid.");
  const validateSeen = (key: Difficulty): string[] => {
    if (!Array.isArray(seen[key]) || !seen[key].every((item: unknown) => typeof item === "string")) throw new Error("Saved deal selection is invalid.");
    return seen[key] as string[];
  };
  return { music, effects, muted: boolean(v.muted), reduced: boolean(v.reduced), difficulty: v.difficulty,
    theme: text(v.theme), themeVersion: text(v.themeVersion), seen: { Easy: validateSeen("Easy"), Medium: validateSeen("Medium"), Difficult: validateSeen("Difficult") } };
}
export function playingScore(attempt: Attempt, elapsed = attempt.elapsedMs): number {
  return Math.max(0, attempt.movePoints - attempt.undoPenalty - 2 * Math.floor(elapsed / 10000));
}
export function summary(attempt: Attempt, result: HistoryEntry["result"]): HistoryEntry {
  return {
    id: attempt.id, dealId: attempt.dealId, difficulty: attempt.difficulty, startedAt: attempt.startedAt,
    endedAt: attempt.endedAt || new Date().toISOString(), result,
    score: playingScore(attempt) + (result === "Won" ? attempt.bonus : 0),
    elapsedMs: attempt.elapsedMs, moves: attempt.moves, hints: attempt.hints, undos: attempt.undos,
  };
}
function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error(`Your game was not saved: ${tx.error?.message || "storage transaction aborted"}. Free some storage space and reload; the last saved game is preserved.`));
  });
}
export class Store {
  private db: IDBDatabase;
  private constructor(db: IDBDatabase) { this.db = db; }
  static async open(base: URL): Promise<Store> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(gameStorageKey(base), 1);
      let blocked = false;
      r.onupgradeneeded = () => {
        r.result.createObjectStore("state");
        r.result.createObjectStore("history", { keyPath: "id" });
      };
      r.onerror = () => reject(new Error(`Local storage is unavailable: ${r.error?.message}. The game cannot promise to remember progress.`));
      r.onblocked = () => { blocked = true; reject(new Error("Close other game tabs, then reload to open local storage.")); };
      r.onsuccess = () => {
        if (blocked) { r.result.close(); return; }
        r.result.onversionchange = () => { r.result.close(); location.reload(); };
        resolve(r.result);
      };
    });
    return new Store(db);
  }
  async load(): Promise<{ current: Attempt | null; preferences: Preferences }> {
    const tx = this.db.transaction("state");
    const state = tx.objectStore("state");
    const [raw, prefs] = await Promise.all([request(state.get("current")), request(state.get("preferences"))]);
    try {
      return { current: raw === undefined ? null : validateAttempt(raw), preferences: preferences(prefs) };
    } catch (error) {
      throw new Error(`Your saved data needs attention and has not been overwritten. ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async save(current: Attempt, preferences: Preferences, entry?: HistoryEntry): Promise<void> {
    const tx = this.db.transaction(["state", "history"], "readwrite");
    const done = completed(tx);
    tx.objectStore("state").put(structuredClone(current), "current");
    tx.objectStore("state").put(structuredClone(preferences), "preferences");
    if (entry) {
      const history = tx.objectStore("history");
      history.put(entry);
      const all = history.getAll();
      all.onsuccess = () => {
        const sorted: HistoryEntry[] = all.result;
        sorted.sort((a, b) => b.endedAt.localeCompare(a.endedAt) || b.id.localeCompare(a.id));
        sorted.slice(500).forEach((item) => history.delete(item.id));
      };
    }
    await done;
  }
  async history(): Promise<HistoryEntry[]> {
    const result: HistoryEntry[] = await request(this.db.transaction("history").objectStore("history").getAll());
    return result.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  }
}

export async function acquireGameLock(base: URL): Promise<void> {
  if (!navigator.locks) throw new Error("This browser lacks the safe single-tab storage feature. Please use a current Chrome, Edge, Firefox, or Safari browser.");
  await new Promise<void>((resolve, reject) => {
    navigator.locks.request(gameStorageKey(base), { ifAvailable: true }, async (lock) => {
      if (!lock) { reject(new Error("Another tab is already playing this game. Close that tab and reload here. Your save has not been changed.")); return; }
      resolve();
      await new Promise<void>((release) => window.addEventListener("pagehide", () => release(), { once: true }));
    }).catch(reject);
  });
}
