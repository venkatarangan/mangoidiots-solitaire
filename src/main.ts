import "./styles.css";
import { applyMove, newBoard, isWon, cardLabel, legalMoves, hintMoves, autoFinish, type Move } from "./game/engine";
import { deals, type Deal, type Difficulty } from "./data/deals";
import { Store, acquireGameLock, defaults, playingScore, summary, type Attempt, type Preferences } from "./storage";
import { loadTheme, themeListings, Sound, disposeTheme, type LoadedTheme, type ThemeListing } from "./themes";
import { createBoard, type RoyalBoard, type Selection } from "./board";
import logoURL from "./assets/mangoidiots-logo.png";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Required interface element is missing: ${id}`);
  return node as T;
}
const base = new URL(document.baseURI);
const dialog = element<HTMLDialogElement>("dialog");
const body = element("dialog-body");
const loading = element("loading");
const shell = document.querySelector<HTMLElement>(".app-shell")!;
let store: Store;
let current: Attempt;
let preferences: Preferences = defaults();
let theme: LoadedTheme;
let listings: ThemeListing[] = [];
let sound: Sound;
let scene: RoyalBoard;
let boardInstance: Awaited<ReturnType<typeof createBoard>>;
let selection: Selection | null = null;
let busy = false, playing = false, finishing = false, failed = false;
let checkpointSaving = false;
let clockBase = 0, clockStart = 0, checkpointAt = 0;
let resumeAfterDialog = false;
let protectionRequested = false;
let hintIndex = 0;
let lastFocused: HTMLElement | null = null;

function elapsed(): number { return playing && current.started ? clockBase + performance.now() - clockStart : current.elapsedMs; }
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function message(text: string): void { element("message").textContent = text; }
function report(error: unknown, fatal = false): void {
  console.error(error);
  element("error").textContent = error instanceof Error ? error.message : String(error);
  element("error").hidden = false;
  if (fatal && current) {
    current.elapsedMs = elapsed(); playing = false; finishing = false; failed = true;
    sound?.pause(); render();
  }
}
function progress(text: string, percent: number): void {
  element("loading-label").textContent = text;
  element<HTMLProgressElement>("loading-progress").value = percent;
}
function control<T extends keyof HTMLElementTagNameMap>(tag: T, text?: string, className?: string): HTMLElementTagNameMap[T] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text: string, action: () => void | Promise<void>, primary = false): HTMLButtonElement {
  const node = control("button", text, primary ? "primary" : "secondary");
  node.addEventListener("click", () => { void Promise.resolve(action()).catch((error) => report(error, true)); });
  return node;
}
function allowed(): boolean { return !!current && playing && current.status === "active" && !busy && !failed && !finishing && !dialog.open; }
function startClock(): void {
  if (!current.started) {
    current.started = true; clockBase = current.elapsedMs; clockStart = performance.now();
  }
}
function updateMetrics(): void {
  if (!current) return;
  const time = elapsed();
  element("score").textContent = (playingScore(current, time) + current.bonus).toLocaleString("en-US");
  element("timer").textContent = formatTime(time);
  element("moves").textContent = String(current.moves);
}
function render(animate = false): void {
  if (!current || !scene) return;
  updateMetrics();
  element("difficulty").textContent = current.difficulty;
  element("deal-label").textContent = current.dealId;
  element("deal-label").title = `Proven-solvable starting deal ${current.dealId}`;
  element("theme-label").textContent = theme.manifest.name;
  const paused = !playing && current.status === "active";
  element("pause-overlay").hidden = !paused;
  element<HTMLButtonElement>("resume").disabled = busy || failed;
  element<HTMLButtonElement>("undo").disabled = !allowed() || current.undo.length === 0;
  element<HTMLButtonElement>("hint").disabled = !allowed();
  element<HTMLButtonElement>("pause").disabled = current.status !== "active" || failed;
  element("pause").innerHTML = playing ? '<span aria-hidden="true">&#10074;&#10074;</span> Pause' : '<span aria-hidden="true">&#9655;</span> Resume';
  const path = allowed() ? autoFinish(current.board) : null;
  element("finish").hidden = !path?.length;
  element<HTMLButtonElement>("finish").disabled = !allowed();
  element("mute").textContent = preferences.muted ? "\u266a\u00d7" : "\u266b";
  element("mute").setAttribute("aria-label", preferences.muted ? "Unmute sound" : "Mute all sound");
  scene.reduced(preferences.reduced);
  scene.render(current.board, selection, animate);
  renderAccessible();
}
function renderAccessible(): void {
  const list = element("card-list");
  const oldKey = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.cardKey : undefined;
  list.replaceChildren();
  if (!current || !playing || current.status !== "active") {
    list.append(control("p", current?.status === "won" ? "This game is complete." : "Resume to inspect and move cards."));
    return;
  }
  const stock = control("div", undefined, "pile-list");
  stock.append(control("h3", "Stock & waste"));
  const draw = button(current.board.stock.length ? `Draw (${current.board.stock.length})` : "Recycle waste", drawCard);
  draw.disabled = !allowed(); stock.append(draw);
  const addCard = (parent: HTMLElement, pile: string, index: number, card: number) => {
    const node = button(cardLabel(card), () => selectCard(pile, index));
    node.dataset.cardKey = `${pile}:${index}`;
    node.setAttribute("aria-pressed", String(selection?.pile === pile && selection.index === index));
    node.disabled = !allowed(); parent.append(node);
  };
  if (current.board.waste.length) addCard(stock, "waste", current.board.waste.length - 1, current.board.waste.at(-1)!);
  list.append(stock);
  current.board.foundations.forEach((pile, i) => {
    const section = control("div", undefined, "pile-list");
    section.append(control("h3", ["Spades", "Hearts", "Clubs", "Diamonds"][i]));
    if (pile.length) addCard(section, `f${i}`, pile.length - 1, pile.at(-1)!);
    const target = button(`Place on ${["spades", "hearts", "clubs", "diamonds"][i]}`, () => destination(`f${i}`));
    target.disabled = !allowed() || !selection; section.append(target); list.append(section);
  });
  current.board.tableau.forEach((pile, i) => {
    const section = control("div", undefined, "pile-list");
    section.append(control("h3", `Column ${i + 1}`));
    if (pile.faceUp) section.append(control("p", `${pile.faceUp} hidden card${pile.faceUp === 1 ? "" : "s"}`));
    pile.cards.forEach((card, index) => { if (index >= pile.faceUp) addCard(section, `t${i}`, index, card); });
    const target = button(pile.cards.length ? `Place on column ${i + 1}` : "Empty column (King)", () => destination(`t${i}`));
    target.disabled = !allowed() || !selection; section.append(target); list.append(section);
  });
  if (oldKey) list.querySelector<HTMLElement>(`[data-card-key="${CSS.escape(oldKey)}"]`)?.focus({ preventScroll: true });
}
async function persist(entry?: ReturnType<typeof summary>): Promise<void> {
  current.elapsedMs = elapsed();
  await store.save(current, preferences, entry);
}
async function perform(move: Move, automatic = false): Promise<void> {
  if ((!automatic && !allowed()) || busy || failed || !playing || current.status !== "active") return;
  let result: ReturnType<typeof applyMove>;
  try { result = applyMove(current.board, move); }
  catch (error) {
    sound.effect("invalid");
    message(error instanceof Error ? error.message : "That move is not allowed.");
    selection = null; render(); return;
  }
  busy = true;
  startClock();
  const next: Attempt = { ...current, board: result.board, movePoints: current.movePoints + result.points,
    elapsedMs: elapsed(), moves: current.moves + 1,
    undo: [...current.undo, { board: current.board, movePoints: current.movePoints }] };
  const won = isWon(next.board);
  if (won) {
    next.status = "won"; next.endedAt = new Date().toISOString();
    const seconds = Math.floor(next.elapsedMs / 1000);
    next.bonus = seconds > 30 ? Math.floor(700000 / seconds) : 0;
  }
  try {
    await store.save(next, preferences, won ? summary(next, "Won") : undefined);
    current = next; selection = null; hintIndex = 0;
    if (won) { playing = false; finishing = false; sound.pause(); }
    busy = false;
    render(true);
    scene.points(result.points);
    sound.effect(move.type === "move" ? "place" : "draw");
    message(result.description);
    if (won) {
      sound.effect("victory"); scene.celebrate();
      showVictory();
    }
  } catch (error) { busy = false; report(error, true); }
}
async function drawCard(): Promise<void> {
  await perform({ type: current.board.stock.length ? "draw" : "recycle" });
}
function selectCard(pile: string, index: number): void {
  if (!allowed()) return;
  if (selection && selection.pile !== pile) { void destination(pile); return; }
  if (selection?.pile === pile && selection.index === index) {
    const foundation = legalMoves(current.board).find((move) => move.type === "move" && move.from === pile && move.index === index && move.to.startsWith("f"));
    if (foundation) { void perform(foundation); return; }
    selection = null;
  } else selection = { pile, index };
  render();
  if (selection) message("Now choose a destination. Tap the same card again to move it to a foundation when legal.");
}
async function destination(pile: string): Promise<void> {
  if (!selection || !allowed()) { message("Choose a face-up card first, then its destination."); return; }
  await perform({ type: "move", from: selection.pile, to: pile, index: selection.index });
}
async function undo(): Promise<void> {
  if (!allowed() || !current.undo.length) return;
  busy = true;
  const snapshot = current.undo.at(-1)!;
  const next: Attempt = { ...current, board: snapshot.board, movePoints: snapshot.movePoints,
    elapsedMs: elapsed(), undoPenalty: current.undoPenalty + 2, undos: current.undos + 1, undo: current.undo.slice(0, -1) };
  try {
    await store.save(next, preferences); current = next; selection = null; hintIndex = 0; busy = false;
    render(true); sound.effect("draw"); message("Move undone. Time continues; Undo costs 2 points.");
  } catch (error) { busy = false; report(error, true); }
}
async function hint(): Promise<void> {
  if (!allowed()) return;
  busy = true; startClock();
  const suggestions = hintMoves(current.board);
  const next = { ...current, elapsedMs: elapsed(), hints: current.hints + 1 };
  try {
    await store.save(next, preferences); current = next; busy = false; selection = null; render();
    if (!suggestions.length) { message("No useful hint found. Try Undo or Reset; this is not proof the game cannot be won."); return; }
    const suggestion = suggestions[hintIndex++ % suggestions.length];
    scene.hint(suggestion.move);
    message(`${suggestion.reason} Hints suggest legal moves, not guaranteed wins.`);
  } catch (error) { busy = false; report(error, true); }
}
async function pause(save = true): Promise<void> {
  if (!current) return;
  current.elapsedMs = elapsed(); playing = false; finishing = false; sound?.pause(); selection = null;
  if (save && !busy && !failed) {
    busy = true;
    try { await store.save(current, preferences); }
    catch (error) { report(error, true); }
    finally { busy = false; }
  }
  render();
}
function resume(): void {
  if (!current || failed || busy || current.status !== "active") return;
  clockBase = current.elapsedMs; clockStart = performance.now(); playing = true; sound.start();
  render(); message("Draw one. Take your time.");
  if (!protectionRequested && navigator.storage?.persist) {
    protectionRequested = true;
    void navigator.storage.persist().then((protectedStorage) => {
      element("offline-status").title = protectedStorage
        ? "Browser storage is protected against ordinary eviction. Clearing site data still removes saves."
        : "The browser uses best-effort storage. Clearing site data or eviction can remove your save.";
    }).catch((error: Error) => message(`Storage protection could not be requested: ${error.message}. Saves remain in ordinary browser storage.`));
  }
}
async function openDialog(title: string): Promise<void> {
  if (busy || failed) return;
  resumeAfterDialog = playing;
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await pause();
  if (failed) return;
  element("dialog-title").textContent = title;
  body.replaceChildren();
  dialog.showModal();
}
function closeDialog(restore = true): void {
  dialog.close();
  if (restore && resumeAfterDialog) resume();
  resumeAfterDialog = false;
  lastFocused?.focus({ preventScroll: true });
}
function selectedDeal(difficulty: Difficulty, prefs: Preferences, exclude?: string): Deal {
  const tier = deals.filter((d) => d.difficulty === difficulty);
  let choices = tier.filter((d) => !prefs.seen[difficulty].includes(d.id) && d.id !== exclude);
  if (!choices.length) { prefs.seen[difficulty] = []; choices = tier.filter((d) => d.id !== exclude); }
  if (!choices.length) choices = tier;
  if (!choices.length) throw new Error(`There are no verified ${difficulty} deals in this release.`);
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  const deal = choices[random % choices.length];
  prefs.seen[difficulty].push(deal.id);
  return deal;
}
function attempt(deal: Deal): Attempt {
  return { schemaVersion: 1, id: crypto.randomUUID(), dealId: deal.id, difficulty: deal.difficulty,
    startedAt: new Date().toISOString(), endedAt: null, board: newBoard(deal.deck), elapsedMs: 0,
    started: false, movePoints: 0, undoPenalty: 0, moves: 0, hints: 0, undos: 0, bonus: 0, status: "active", undo: [] };
}
async function begin(difficulty: Difficulty, reset = false): Promise<void> {
  if (busy || failed) return;
  busy = true;
  const previous = current ? { ...current, elapsedMs: elapsed(), endedAt: new Date().toISOString() } : null;
  const prefs = structuredClone(preferences);
  prefs.difficulty = difficulty;
  const deal = reset ? deals.find((d) => d.id === current.dealId) : selectedDeal(difficulty, prefs, current?.dealId);
  if (!deal) { busy = false; throw new Error("This deal is no longer in the catalog; the current save was preserved."); }
  const next = attempt(deal);
  try {
    await store.save(next, prefs, previous?.status === "active" ? summary(previous, reset ? "Restarted" : "Abandoned") : undefined);
    current = next; preferences = prefs; selection = null; hintIndex = 0; busy = false;
    if (dialog.open) closeDialog(false);
    resume(); scene.deal(); sound.effect("shuffle");
  } catch (error) { busy = false; report(error, true); }
}
async function newGameDialog(): Promise<void> {
  await openDialog("Choose your next game");
  if (!dialog.open) return;
  body.append(control("p", "Every deal has a verified winning path from its starting position. Your choices can still lead to a dead end."));
  const grid = control("div", undefined, "difficulty-grid");
  const descriptions = { Easy: "More direct reveals and fewer competing choices.", Medium: "More sequencing and careful foundation timing.", Difficult: "More dependencies and longer-term planning." };
  for (const difficulty of ["Easy", "Medium", "Difficult"] as const) {
    const label = control("label"), input = control("input");
    input.type = "radio"; input.name = "difficulty"; input.value = difficulty; input.checked = preferences.difficulty === difficulty;
    label.append(input, document.createTextNode(difficulty), control("small", descriptions[difficulty])); grid.append(label);
  }
  body.append(grid, control("p", "The launch catalog contains 30 deals per tier. Difficulty is an estimate, not a promise about every position.", "fine-print"));
  if (current.status === "active") body.append(control("p", "Starting a new game records this attempt as Abandoned."));
  const actions = control("div", undefined, "dialog-actions");
  actions.append(button("Cancel", () => closeDialog()), button("Start new game", async () => {
    const input = body.querySelector<HTMLInputElement>('input[name="difficulty"]:checked');
    const value = input?.value;
    if (value === "Easy" || value === "Medium" || value === "Difficult") await begin(value);
  }, true));
  body.append(actions);
}
async function resetDialog(): Promise<void> {
  await openDialog("Restart this deal?");
  if (!dialog.open) return;
  body.append(control("p", "The same cards return to their original positions. Score, timer, and Undo history reset. This attempt stays in history as Restarted."));
  const actions = control("div", undefined, "dialog-actions");
  actions.append(button("Keep playing", () => closeDialog()), button("Restart deal", () => begin(current.difficulty, true), true)); body.append(actions);
}
async function menuDialog(): Promise<void> {
  await openDialog("Mangoidiots Solitaire");
  if (!dialog.open) return;
  const grid = control("div", undefined, "menu-grid");
  const change = (action: () => Promise<void>) => async () => { closeDialog(); await action(); };
  grid.append(button("New game", change(newGameDialog)), button("Restart this deal", change(resetDialog)),
    button("Game history", change(historyDialog)), button("Sound & effects", change(settingsDialog)),
    button("Theme collection", change(themesDialog)), button("How to play", change(helpDialog)),
    button("About Mangoidiots Solitaire", change(aboutDialog)));
  body.append(grid, control("p", "Your game stays on this browser and device. Clearing site data can remove saved games and downloaded themes.", "fine-print"));
}
async function settingsDialog(): Promise<void> {
  await openDialog("Sound & effects");
  if (!dialog.open) return;
  const persistSetting = async () => {
    sound.settings(preferences.music, preferences.effects, preferences.muted);
    await store.save(current, preferences);
    element("mute").textContent = preferences.muted ? "\u266a\u00d7" : "\u266b";
    scene.reduced(preferences.reduced);
  };
  for (const [name, key] of [["Music volume", "music"], ["Card sounds", "effects"]] as const) {
    const row = control("label", undefined, "settings-row"), input = control("input");
    input.type = "range"; input.min = "0"; input.max = "100"; input.value = String(Math.round(preferences[key] * 100));
    input.setAttribute("aria-label", name);
    input.addEventListener("input", () => { preferences[key] = Number(input.value) / 100; sound.settings(preferences.music, preferences.effects, preferences.muted); });
    input.addEventListener("change", () => { void persistSetting().catch((error) => report(error, true)); });
    row.append(document.createTextNode(name), input); body.append(row);
  }
  for (const [name, key] of [["Mute everything", "muted"], ["Reduce visual effects", "reduced"]] as const) {
    const row = control("label", undefined, "settings-row"), input = control("input");
    input.type = "checkbox"; input.checked = preferences[key];
    input.addEventListener("change", () => { preferences[key] = input.checked; void persistSetting().catch((error) => report(error, true)); });
    row.append(document.createTextNode(name), input); body.append(row);
  }
  const musicNote = theme.manifest.id === "chola"
    ? "Original synthesized veena-, flute-, and mridangam-inspired timbres; a creative interpretation, not a professional Carnatic performance."
    : theme.manifest.id === "mughal"
      ? "Original instrumental music inspired by Sufi and Indo-Persian traditions, with plucked strings, reed-like melody and frame-drum timbres. No sacred recitation or religious vocals."
      : "Music and card sounds are supplied by the active theme pack.";
  body.append(control("p", `${theme.manifest.name}: ${musicNote}`, "fine-print"));
  body.append(button("Done", () => closeDialog(), true));
}
async function historyDialog(): Promise<void> {
  await openDialog("Your game history");
  if (!dialog.open) return;
  const history = await store.history();
  body.append(control("p", `${history.length} past attempts saved. The newest 500 are kept; your current game is separate.`, "fine-print"));
  if (!history.length) { body.append(control("p", "Your story begins with this game. Finished, restarted, and abandoned attempts will appear here.")); return; }
  const scroll = control("div", undefined, "history-scroll"), table = control("table"), head = control("thead"), row = control("tr");
  ["Date / deal", "Result", "Score", "Time", "Moves / hints / undos"].forEach((text) => row.append(control("th", text)));
  head.append(row); table.append(head);
  const rows = control("tbody");
  for (const entry of history) {
    const row = control("tr");
    row.append(control("td", `${new Date(entry.endedAt).toLocaleDateString()} \u00b7 ${entry.difficulty}\n${entry.dealId}`),
      control("td", entry.result, `result-${entry.result}`), control("td", String(entry.score)),
      control("td", formatTime(entry.elapsedMs)), control("td", `${entry.moves} / ${entry.hints} / ${entry.undos}`));
    rows.append(row);
  }
  table.append(rows); scroll.append(table); body.append(scroll);
}
async function helpDialog(): Promise<void> {
  await openDialog("How to play");
  if (!dialog.open) return;
  body.append(brandLogo());
  const rules = control("ol", undefined, "help-rules");
  [
    "Build the seven columns downward, alternating red and black. Move a single face-up card or a correctly ordered sequence.",
    "Only a King or a sequence beginning with a King fills an empty column.",
    "Build each foundation by suit, from Ace to King. You may move foundation cards back to the tableau.",
    "Draw one card from the left stock. When empty, recycle the waste without shuffling; each recycle costs 100 points.",
    "Drag the exposed waste card or a face-up sequence. The leading card can overlap a destination even when your finger is outside it. Release when the legal destination glows; a rejected drop returns your cards without a penalty.",
    "You can also tap a source and then a destination. Tap the same selected card again to send it to a foundation when legal.",
    "On a small screen, tap a column's numbered heading to inspect its cards. The Card list below the board supports keyboard play.",
    "Undo costs 2 points and does not rewind the clock. Hints suggest useful legal moves, not guaranteed winning moves.",
  ].forEach((text) => rules.append(control("li", text)));
  body.append(rules, control("h3", "Classic-style Standard scoring"));
  body.append(control("p", "Waste to tableau +5; to a foundation +10; reveal a hidden card +5; foundation back to tableau -15. Other moves and draws score 0. Every 10 active seconds costs 2 points."));
  body.append(control("p", "Displayed playing score never falls below zero; negative internal totals must be earned back. Undo restores the previous action score and keeps all time/Undo deductions. Victory adds floor(700,000 / active seconds) if the game took more than 30 whole seconds."));
  body.append(control("h3", "Offline and privacy"));
  body.append(control("p", "Visit once online and wait for Ready offline. There are no accounts or progress uploads. Progress belongs to this browser profile and site address; clearing site data or browser eviction can remove it."));
  body.append(control("p", "Chola and Mughal court illustrations are original historical interpretations, not authenticated portraits. Difficulty tiers are estimates over proven-solvable starting deals.", "fine-print"));
}
function brandLogo(): HTMLImageElement {
  const image = control("img", undefined, "about-logo");
  image.src = logoURL; image.alt = "MangoIdiots.com"; image.decoding = "async";
  return image;
}
async function aboutDialog(): Promise<void> {
  await openDialog("About Mangoidiots Solitaire");
  if (!dialog.open) return;
  body.append(brandLogo(), control("p", "Draw 1 Klondike, with original art and instrumental music inspired by India's historical courts. Choose Chola or Mughal Gardens in the Theme collection."));
  const attribution = control("p", "Generated with OpenAI GPT-6 Astra. Play for free at ");
  const link = control("a", "solitaire.mangoidiots.com");
  link.href = "https://solitaire.mangoidiots.com/";
  attribution.append(link, document.createTextNode(".")); body.append(attribution);
  body.append(control("p", "Version 1.2.0. Free to play, with no account or progress uploads. After the first complete download, your game and downloaded themes work offline. Saves stay in this browser; cloud sync is not included.", "fine-print"));
  body.append(control("p", "An independent game, not affiliated with Microsoft. Artwork and synthesized music are creative interpretations, not historical portraits or recordings.", "fine-print"));
}
async function themesDialog(): Promise<void> {
  await openDialog("Theme collection");
  if (!dialog.open) return;
  const card = control("div", undefined, "theme-card"), image = control("img"), copy = control("div");
  image.src = theme.urls.get(theme.manifest.back)!; image.alt = `${theme.manifest.name} card back`;
  copy.append(control("h3", theme.manifest.name), control("p", theme.manifest.description));
  card.append(image, copy); body.append(card, control("p", theme.manifest.attribution, "fine-print"));
  const row = control("div", undefined, "theme-select"), select = control("select");
  select.setAttribute("aria-label", "Available theme packs");
  for (const item of listings) {
    const option = control("option", item.name); option.value = `${item.id}@${item.version}`;
    option.selected = item.id === theme.manifest.id && item.version === theme.manifest.version; select.append(option);
  }
  row.append(select, button("Use theme", async () => {
    const item = listings.find((t) => `${t.id}@${t.version}` === select.value);
    if (!item) throw new Error("Selected theme is not available.");
    const shouldResume = resumeAfterDialog;
    closeDialog(false); await changeTheme(item); if (shouldResume) resume();
  }, true)); body.append(row);
  body.append(control("p", "Additional theme packs are published with site updates. Each pack is fully downloaded and checked before it becomes active. The current theme remains available if a download fails.", "fine-print"));
}
async function inspectColumn(column: number): Promise<void> {
  await openDialog(`Column ${column + 1}`);
  if (!dialog.open) return;
  const pile = current.board.tableau[column];
  body.append(control("p", `${pile.faceUp} hidden card${pile.faceUp === 1 ? "" : "s"}. Select any visible card to move it and the sequence below it.`, "fine-print"));
  const grid = control("div", undefined, "menu-grid");
  pile.cards.forEach((card, index) => {
    if (index < pile.faceUp) return;
    const node = button(cardLabel(card), () => {
      closeDialog(); if (allowed()) { selection = { pile: `t${column}`, index }; render(); message("Choose a destination for this sequence."); }
    });
    const image = control("img"); image.src = theme.urls.get(theme.manifest.cards[String(card)])!; image.alt = cardLabel(card);
    image.width = 85; image.style.display = "block"; image.style.margin = "0 auto 8px";
    node.prepend(image); grid.append(node);
  });
  body.append(grid);
}
function showVictory(): void {
  if (dialog.open) closeDialog(false);
  resumeAfterDialog = false; body.replaceChildren();
  element("dialog-title").textContent = "A royal victory.";
  body.append(control("div", "\u2726", "win-emblem"), control("div", (playingScore(current) + current.bonus).toLocaleString("en-US"), "win-score"));
  const breakdown = control("div", undefined, "score-breakdown");
  for (const [name, value] of [["Playing score", playingScore(current)], ["Time bonus", current.bonus], ["Active time", formatTime(current.elapsedMs)]]) {
    const item = control("div", String(name)); item.append(control("strong", String(value))); breakdown.append(item);
  }
  body.append(breakdown, control("p", `${current.difficulty} \u00b7 ${current.moves} moves \u00b7 ${current.hints} hints \u00b7 ${current.undos} undos`, "fine-print"));
  const actions = control("div", undefined, "dialog-actions");
  actions.append(button("View table / skip", () => { scene.render(current.board); closeDialog(false); }),
    button("Play again", () => begin(current.difficulty), true));
  body.append(actions); dialog.showModal();
}
async function finish(): Promise<void> {
  if (!allowed()) return;
  const path = autoFinish(current.board);
  if (!path?.length) return;
  finishing = true;
  for (const move of path) {
    if (!finishing || !playing || failed) break;
    await perform(move, true);
    if (!preferences.reduced) await new Promise((resolve) => setTimeout(resolve, 120));
  }
  finishing = false;
}
function boardOptions(loaded: LoadedTheme): Parameters<typeof createBoard>[1] {
  return {
    theme: loaded, enabled: allowed, card: selectCard, destination: (pile) => { void destination(pile); },
    stock: () => { void drawCard(); }, inspect: (column) => { void inspectColumn(column); },
    drop: (from, index, to) => { void perform({ type: "move", from, index, to }); },
    dragFeedback: (target) => message(target
      ? `Release to place on ${target.startsWith("f") ? `the ${["spades", "hearts", "clubs", "diamonds"][Number(target[1])]} foundation` : `column ${Number(target[1]) + 1}`}.`
      : "Overlap a legal destination to make it glow. Cards return safely if no destination is highlighted."),
    error: (text) => report(new Error(text)),
  };
}
async function connectBoard(loaded: LoadedTheme): Promise<void> {
  boardInstance = await createBoard(element("board"), boardOptions(loaded));
  scene = boardInstance.scene;
}
async function changeTheme(listing: ThemeListing): Promise<void> {
  await pause(); loading.hidden = false; shell.inert = true;
  let stagedTheme: LoadedTheme | undefined;
  let stagedBoard: Awaited<ReturnType<typeof createBoard>> | undefined;
  let mount: HTMLDivElement | undefined;
  try {
    stagedTheme = await loadTheme(base, listing, progress);
    mount = control("div");
    mount.style.position = "absolute"; mount.style.visibility = "hidden";
    mount.style.width = `${element("board").clientWidth}px`;
    element("board-wrap").append(mount);
    stagedBoard = await createBoard(mount, boardOptions(stagedTheme));
    const prefs = { ...preferences, theme: stagedTheme.manifest.id, themeVersion: stagedTheme.manifest.version };
    await store.save(current, prefs);
    const previous = theme;
    boardInstance.resize.disconnect(); boardInstance.game.destroy(true); sound.dispose();
    element("board").replaceWith(mount);
    mount.id = "board"; mount.style.position = ""; mount.style.visibility = ""; mount.style.width = "100%";
    boardInstance = stagedBoard; scene = stagedBoard.scene;
    theme = stagedTheme; preferences = prefs;
    applyThemeAppearance();
    sound = new Sound(theme, message);
    sound.settings(preferences.music, preferences.effects, preferences.muted);
    disposeTheme(previous); render();
  } catch (error) {
    stagedBoard?.resize.disconnect(); stagedBoard?.game.destroy(true);
    mount?.remove();
    if (stagedTheme) disposeTheme(stagedTheme);
    report(error);
  }
  finally { loading.hidden = true; shell.inert = false; }
}
async function workerStatus(worker: ServiceWorker, type = "STATUS"): Promise<{ ready: boolean; files: number; total: number; version: string; scope: string }> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("The offline worker timed out. Reconnect and reload.")); }, 20000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout); channel.port1.close();
      if (data.error) reject(new Error(data.error)); else resolve(data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
async function prepareOffline(): Promise<void> {
  if (!window.isSecureContext || !navigator.serviceWorker) throw new Error("Offline play requires HTTPS or localhost and a browser with service workers.");
  const workerURL = new URL("sw.js", base).href;
  const existing = await navigator.serviceWorker.getRegistration(base.href);
  const existingWorker = existing?.active || existing?.waiting || existing?.installing;
  if (existingWorker && (existing.scope !== base.href || existingWorker.scriptURL !== workerURL)) {
    throw new Error("Another service worker manages this route. The site administrator must resolve the overlap; no worker has been replaced.");
  }
  const registration = existing?.active && navigator.serviceWorker.controller?.scriptURL === workerURL
    ? existing
    : await navigator.serviceWorker.register(workerURL, { scope: base.href, updateViaCache: "none" });
  if (existing?.active && navigator.onLine) {
    void registration.update().catch((error: Error) => message(`The installed offline game is available; an update could not be downloaded: ${error.message}`));
  }
  const start = performance.now();
  while (navigator.serviceWorker.controller?.scriptURL !== workerURL) {
    if (!registration.installing && !registration.active && !registration.waiting) throw new Error("The offline download failed. Check connectivity and retry.");
    if (performance.now() - start > 30000) throw new Error("Offline preparation is taking too long. Close other game tabs, reconnect, and reload.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let status = await workerStatus(navigator.serviceWorker.controller!);
  if (!status.ready) status = await workerStatus(navigator.serviceWorker.controller!, "REPAIR");
  if (!status.ready || status.scope !== base.href) throw new Error("The game files are not completely available offline.");
  if (registration.waiting) message("An update is downloaded. Close all game tabs and reopen when convenient to activate it.");
}
async function initialize(): Promise<void> {
  shell.inert = true;
  element<HTMLButtonElement>("retry-load").hidden = true;
  try {
    progress("Opening your private local save...", 2);
    await acquireGameLock(base);
    store = await Store.open(base);
    const loaded = await store.load();
    preferences = loaded.preferences;
    current = loaded.current!;
    progress("Downloading the offline game...", 8);
    await prepareOffline();
    listings = await themeListings(base);
    const selected = listings.find((item) => item.id === preferences.theme && item.version === preferences.themeVersion);
    if (!selected) throw new Error(`Your saved theme "${preferences.theme}" is not available in this site's theme list. Restore the pack before continuing.`);
    theme = await loadTheme(base, selected, progress);
    applyThemeAppearance();
    await connectBoard(theme);
    sound = new Sound(theme, message);
    sound.settings(preferences.music, preferences.effects, preferences.muted);
    if (!current) {
      const selected = selectedDeal(preferences.difficulty, preferences);
      current = attempt(selected);
      await store.save(current, preferences);
      element("pause-title").textContent = "Your court awaits.";
      element("pause-copy").textContent = "A game of patience. A collection of royal worlds.";
      element("resume").textContent = "Start playing";
    }
    clockBase = current.elapsedMs; playing = false;
    progress("Ready to play, even offline.", 100);
    render();
    loading.hidden = true; shell.inert = false;
    element("offline-status").textContent = "Ready offline";
    if (current.status === "won") showVictory();
    else if (current.started) message("Your game is saved. Resume when you are ready.");
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    console.error(error); progress(text, 0);
    element<HTMLButtonElement>("retry-load").hidden = false;
    element("offline-status").textContent = "Offline readiness not confirmed";
  }
}
function applyThemeAppearance(): void {
  document.documentElement.style.setProperty("--table", theme.manifest.palette.table);
  document.documentElement.style.setProperty("--gold", theme.manifest.palette.accent);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = theme.manifest.palette.table;
}
function action(id: string, callback: () => void | Promise<void>): void {
  element(id).addEventListener("click", () => {
    element("error").hidden = true;
    void Promise.resolve(callback()).catch((error) => report(error, true));
  });
}
action("resume", resume);
action("pause", () => playing ? pause() : resume());
action("undo", undo); action("hint", hint);
action("new-game", newGameDialog); action("reset", resetDialog); action("menu", menuDialog); action("finish", finish);
action("themes", themesDialog);
action("dialog-close", () => closeDialog());
action("retry-load", () => location.reload());
action("mute", async () => {
  if (!sound || busy || failed) return;
  preferences.muted = !preferences.muted;
  sound.settings(preferences.music, preferences.effects, preferences.muted);
  await persist(); render();
});
dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
document.addEventListener("keydown", (event) => {
  if (!current || dialog.open || !loading.hidden || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); void undo(); }
  else if (event.key.toLowerCase() === "h") { event.preventDefault(); void hint(); }
  else if (event.key.toLowerCase() === "p") { event.preventDefault(); if (playing) void pause(); else resume(); }
  else if (event.key === "Escape") { selection = null; render(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resumeAfterDialog = false;
    sound?.pause();
    if (current && playing) void pause();
  }
});
window.addEventListener("pagehide", () => { if (current) { current.elapsedMs = elapsed(); playing = false; sound?.pause(); void store?.save(current, preferences).catch(console.error); } });
window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload(); });
setInterval(() => {
  if (!current || !loading.hidden || failed) return;
  updateMetrics();
  if (playing && current.started && !busy && !checkpointSaving && performance.now() - checkpointAt > 5000) {
    checkpointAt = performance.now(); checkpointSaving = true;
    void persist().catch((error) => report(error, true)).finally(() => { checkpointSaving = false; });
  }
}, 250);
void initialize();
