import Phaser from "phaser";
import { type Board, type Move } from "./game/engine";
import type { LoadedTheme } from "./themes";
import { legalDropTargets, resolveDropTarget, type DropTarget } from "./drop-targets";

export interface Selection { pile: string; index: number }
interface CardSprite { image: Phaser.GameObjects.Image; card: number; pile: string; index: number; x: number; y: number }
interface DragState {
  pile: string; index: number; pointerId: number; anchorX: number; anchorY: number;
  lead: CardSprite; members: CardSprite[]; targets: DropTarget[];
}
interface BoardOptions {
  theme: LoadedTheme;
  enabled: () => boolean;
  card: (pile: string, index: number) => void;
  destination: (pile: string) => void;
  stock: () => void;
  drop: (from: string, index: number, to: string) => void;
  inspect: (column: number) => void;
  ready: () => void;
  error: (message: string) => void;
  dragFeedback: (target: string | null) => void;
}
export class RoyalBoard extends Phaser.Scene {
  private state?: Board;
  private selected: Selection | null = null;
  private cards: CardSprite[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private zones: DropTarget[] = [];
  private mutedMotion = false;
  private width = 0;
  private renderedHeight = 0;
  private cardWidth = 100;
  private cardHeight = 140;
  private drag: DragState | null = null;
  private pressed: { image: Phaser.GameObjects.Image; pointerId: number; anchorX: number; anchorY: number } | null = null;
  private dropPreview?: Phaser.GameObjects.Graphics;
  private dropTarget: string | null = null;
  private cancelledPointer: number | null = null;
  private suppressClickUntil = 0;
  private failed = false;
  constructor(private options: BoardOptions) { super("royal-court"); }
  preload(): void {
    const { manifest, urls } = this.options.theme;
    for (let card = 0; card < 52; card++) this.load.image(`card-${card}`, urls.get(manifest.cards[String(card)])!);
    this.load.image("back", urls.get(manifest.back)!);
    this.load.image("table", urls.get(manifest.background)!);
    this.load.on("loaderror", () => {
      this.failed = true;
      this.options.error("A theme image could not be decoded. Reconnect and retry, or select a compatible theme pack.");
    });
  }
  create(): void {
    if (this.failed) return;
    this.input.dragDistanceThreshold = 5;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.cancelledPointer === pointer.id) this.cancelledPointer = null;
    });
    this.input.on("dragstart", (pointer: Phaser.Input.Pointer, image: Phaser.GameObjects.Image) => {
      if (!this.options.enabled() || this.drag || !this.state) return;
      const card = this.cards.find((c) => c.image === image);
      if (!card) return;
      this.tweens.killTweensOf(this.cards.map((c) => c.image));
      const members = this.cards.filter((c) => c.pile === card.pile && c.index >= card.index);
      for (const member of this.cards) {
        member.image.setAlpha(1);
        if (!members.includes(member)) member.image.setPosition(member.x, member.y);
      }
      const press = this.pressed?.image === image && this.pressed.pointerId === pointer.id ? this.pressed : null;
      this.drag = {
        pile: card.pile, index: card.index, pointerId: pointer.id,
        anchorX: press?.anchorX ?? pointer.downX - image.x,
        anchorY: press?.anchorY ?? pointer.downY - image.y,
        lead: card, members, targets: legalDropTargets(this.state, card, this.zones),
      };
      this.dropPreview = this.add.graphics().setDepth(450);
      this.objects.push(this.dropPreview);
      this.dropTarget = null;
      this.suppressClickUntil = performance.now() + 300;
      this.moveDrag(pointer);
    });
    this.input.on("drag", (pointer: Phaser.Input.Pointer) => this.moveDrag(pointer));
    this.input.on("dragend", (pointer: Phaser.Input.Pointer) => {
      if (!this.drag || pointer.id !== this.drag.pointerId) return;
      // A release can arrive before the final drag frame, particularly with touch.
      const target = pointer.event?.type !== "touchcancel" && this.insideCanvas(pointer) && this.options.enabled() ? this.moveDrag(pointer) : null;
      const { pile, index } = this.drag;
      this.clearDrag();
      if (target) this.options.drop(pile, index, target.pile);
      else {
        this.options.dragFeedback(null);
        if (this.state) this.render(this.state, this.selected, true);
      }
    });
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      if (this.drag?.pointerId === pointer.id) this.cancelDrag();
    });
    this.game.events.on(Phaser.Core.Events.BLUR, this.cancelDrag, this);
    this.events.once("shutdown", () => this.game.events.off(Phaser.Core.Events.BLUR, this.cancelDrag, this));
    this.scale.on("resize", () => {
      // Phaser also emits this when refreshing page offsets, without resizing the table.
      if (this.state && (this.scale.width !== this.width || this.scale.height !== this.renderedHeight)) {
        this.render(this.state, this.selected, false);
      }
    });
    this.options.ready();
  }
  private insideCanvas(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= 0 && pointer.y >= 0 && pointer.x <= this.scale.width && pointer.y <= this.scale.height;
  }
  private moveDrag(pointer: Phaser.Input.Pointer): DropTarget | null {
    const drag = this.drag;
    if (!drag || drag.pointerId !== pointer.id || !this.options.enabled()) return null;
    const x = pointer.x - drag.anchorX, y = pointer.y - drag.anchorY;
    for (const card of drag.members) {
      card.image.setPosition(x + card.x - drag.lead.x, y + card.y - drag.lead.y).setDepth(500 + card.index);
    }
    const target = this.insideCanvas(pointer) ? resolveDropTarget(
      { x, y, width: this.cardWidth, height: this.cardHeight }, drag.targets, this.zones,
    ) : null;
    const preview = this.dropPreview!;
    preview.clear();
    for (const candidate of drag.targets) {
      const r = candidate.rect;
      preview.lineStyle(1, 0xf2cf84, .35).strokeRoundedRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4, 8);
    }
    if (target) {
      const r = target.rect;
      preview.fillStyle(0xf2cf84, .12).fillRoundedRect(r.x - 4, r.y - 4, r.width + 8, r.height + 8, 9);
      preview.lineStyle(3, 0xffdc91, 1).strokeRoundedRect(r.x - 4, r.y - 4, r.width + 8, r.height + 8, 9);
    }
    if (this.dropTarget !== (target?.pile ?? null)) {
      this.dropTarget = target?.pile ?? null;
      this.options.dragFeedback(this.dropTarget);
    }
    this.suppressClickUntil = performance.now() + 300;
    return target;
  }
  private clearDrag(): void {
    if (this.drag) {
      this.suppressClickUntil = performance.now() + 150;
      if (this.input.manager.pointers[this.drag.pointerId].isDown) this.cancelledPointer = this.drag.pointerId;
      this.options.dragFeedback(null);
    }
    this.drag = null; this.pressed = null; this.dropTarget = null;
    this.dropPreview?.clear(); this.dropPreview = undefined;
  }
  private cancelDrag(): void {
    if (!this.drag) return;
    this.clearDrag();
    if (this.state) this.render(this.state, this.selected, true);
  }
  reduced(value: boolean): void { this.mutedMotion = value; }
  render(board: Board, selection: Selection | null = null, animate = true): void {
    const old = new Map(this.cards.map((c) => [c.card, { x: c.image.x, y: c.image.y }]));
    this.clearDrag();
    this.tweens.killAll();
    for (const object of this.objects) object.destroy();
    this.objects = []; this.cards = []; this.zones = [];
    this.state = board; this.selected = selection;
    this.width = this.scale.width;
    const gap = this.width < 500 ? 5 : 14;
    this.cardWidth = Math.min(126, (this.width - gap * 6 - 8) / 7);
    this.cardHeight = this.cardWidth * 1.4;
    const total = this.cardWidth * 7 + gap * 6;
    const left = (this.width - total) / 2;
    const top = 12;
    const tableauTop = this.cardHeight + (this.width < 600 ? 68 : 62);
    const faceStep = Math.max(11, Math.min(32, this.cardWidth * .27));
    const backStep = Math.max(7, Math.min(12, this.cardWidth * .11));
    const stackHeight = Math.max(...board.tableau.map((p) =>
      p.faceUp * backStep + Math.max(0, p.cards.length - p.faceUp - 1) * faceStep + this.cardHeight));
    const height = Math.max(this.width < 600 ? 410 : 530, tableauTop + stackHeight + 22);
    if (this.scale.height !== Math.ceil(height)) {
      this.scale.resize(this.width, Math.ceil(height));
      return;
    }
    this.renderedHeight = this.scale.height;
    const background = this.add.image(this.width / 2, height / 2, "table").setDisplaySize(this.width, height).setAlpha(.21);
    this.objects.push(background);
    const xAt = (column: number) => left + column * (this.cardWidth + gap);
    const slot = (pile: string, x: number, y: number, label: string) => {
      const frame = this.add.graphics();
      frame.lineStyle(1, 0xd9bb7b, .30).strokeRoundedRect(x, y, this.cardWidth, this.cardHeight, 7);
      this.objects.push(frame);
      const text = this.add.text(x + this.cardWidth / 2, y + this.cardHeight / 2, label, {
        fontFamily: "Georgia", fontSize: `${this.cardWidth * .38}px`, color: "#d9c18c",
      }).setOrigin(.5).setAlpha(.24);
      this.objects.push(text);
      const zone = this.add.zone(x, y, this.cardWidth, this.cardHeight).setOrigin(0).setInteractive();
      zone.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (!this.options.enabled() || this.drag || this.cancelledPointer === pointer.id || pointer.event?.type === "touchcancel" || performance.now() < this.suppressClickUntil) return;
        if (pile === "stock") this.options.stock(); else this.options.destination(pile);
      });
      this.objects.push(zone);
      if (pile.startsWith("f")) {
        const rect = { x, y, width: this.cardWidth, height: this.cardHeight };
        this.zones.push({ pile, rect, area: rect });
      }
    };
    const addCard = (card: number, pile: string, index: number, x: number, y: number, faceUp: boolean, interactive = true) => {
      const image = this.add.image(x, y, faceUp ? `card-${card}` : "back").setOrigin(0).setDisplaySize(this.cardWidth, this.cardHeight);
      image.setDepth(20 + index);
      this.objects.push(image);
      this.cards.push({ image, card, pile, index, x, y });
      if (interactive) {
        image.setInteractive({ useHandCursor: true });
        image.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (!this.options.enabled() || this.drag || !faceUp || pile === "stock") return;
          this.pressed = { image, pointerId: pointer.id, anchorX: pointer.x - image.x, anchorY: pointer.y - image.y };
          this.tweens.killTweensOf(this.cards.filter((c) => c.pile === pile && c.index >= index).map((c) => c.image));
        });
        image.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (!this.options.enabled() || this.drag || this.cancelledPointer === pointer.id || pointer.event?.type === "touchcancel" || performance.now() < this.suppressClickUntil) return;
          if (pile === "stock") this.options.stock();
          else if (faceUp) this.options.card(pile, index);
          else this.options.destination(pile);
        });
        if (faceUp && pile !== "stock") this.input.setDraggable(image);
      }
      if (faceUp && selection?.pile === pile && index >= selection.index) {
        const ring = this.add.graphics().setDepth(200 + index);
        ring.lineStyle(3, 0xffd88a, .95).strokeRoundedRect(x - 1, y - 1, this.cardWidth + 2, this.cardHeight + 2, 6);
        this.objects.push(ring);
      }
      const previous = old.get(card);
      if (animate && !this.mutedMotion && previous && (Math.abs(previous.x - x) > 1 || Math.abs(previous.y - y) > 1)) {
        image.setPosition(previous.x, previous.y);
        this.tweens.add({ targets: image, x, y, duration: 180, ease: "Cubic.Out" });
      }
    };
    const addStack = (cards: number[], pile: string, x: number, y: number) => {
      // Keep the covered card visible during a drag, without making it playable.
      for (let index = Math.max(0, cards.length - 2); index < cards.length; index++) {
        addCard(cards[index], pile, index, x, y, true, index === cards.length - 1);
      }
    };
    slot("stock", xAt(0), top, "\u21bb");
    if (board.stock.length) addCard(board.stock[board.stock.length - 1], "stock", board.stock.length - 1, xAt(0), top, false);
    slot("waste", xAt(1), top, "");
    addStack(board.waste, "waste", xAt(1), top);
    const count = this.add.text(xAt(0) + this.cardWidth / 2, top + this.cardHeight + 7, `${board.stock.length} in stock`, {
      fontFamily: "Segoe UI", fontSize: this.width < 500 ? "8px" : "10px", color: "#c3d0b9",
    }).setOrigin(.5, 0);
    this.objects.push(count);
    ["\u2660", "\u2665", "\u2663", "\u2666"].forEach((suit, i) => {
      slot(`f${i}`, xAt(i + 3), top, suit);
      addStack(board.foundations[i], `f${i}`, xAt(i + 3), top);
    });
    board.tableau.forEach((pile, column) => {
      const x = xAt(column);
      const label = this.add.text(x + this.cardWidth / 2, tableauTop - 24, `${column + 1}  \u00b7  ${pile.cards.length}`, {
        fontFamily: "Segoe UI", fontSize: this.width < 500 ? "9px" : "10px", color: "#c9d4bd",
      }).setOrigin(.5);
      const inspect = this.add.zone(x, tableauTop - 46, this.cardWidth, 44).setOrigin(0).setInteractive({ useHandCursor: true });
      inspect.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (this.options.enabled() && !this.drag && this.cancelledPointer !== pointer.id &&
            pointer.event?.type !== "touchcancel" && performance.now() >= this.suppressClickUntil) this.options.inspect(column);
      });
      this.objects.push(label, inspect);
      slot(`t${column}`, x, tableauTop, "K");
      let y = tableauTop;
      let tail = tableauTop;
      pile.cards.forEach((card, index) => {
        addCard(card, `t${column}`, index, x, y, index >= pile.faceUp);
        tail = y;
        y += index < pile.faceUp ? backStep : faceStep;
      });
      this.zones.push({
        pile: `t${column}`,
        rect: { x, y: tail, width: this.cardWidth, height: this.cardHeight },
        area: { x, y: tableauTop, width: this.cardWidth, height: tail - tableauTop + this.cardHeight },
      });
    });
  }
  hint(move: Move): void {
    if (!this.state) return;
    if (move.type === "draw" || move.type === "recycle") {
      const stock = this.cards.find((card) => card.pile === "stock");
      const x = stock?.x ?? (this.width - (this.cardWidth * 7 + (this.width < 500 ? 5 : 14) * 6)) / 2;
      this.ring(x, 12, this.cardWidth, this.cardHeight);
      return;
    }
    this.render(this.state, { pile: move.from, index: move.index }, false);
    const target = this.zones.find((zone) => zone.pile === move.to);
    if (target) this.ring(target.rect.x, target.rect.y, target.rect.width, this.cardHeight);
  }
  private ring(x: number, y: number, width: number, height: number): void {
    const ring = this.add.graphics().setDepth(400);
    ring.lineStyle(3, 0xffdf92).strokeRoundedRect(x - 2, y - 2, width + 4, height + 4, 8);
    this.objects.push(ring);
    if (!this.mutedMotion) this.tweens.add({ targets: ring, alpha: .3, duration: 450, yoyo: true, repeat: 3 });
  }
  points(points: number): void {
    if (!points || this.mutedMotion) return;
    const popup = this.add.text(this.width / 2, 16, `${points > 0 ? "+" : ""}${points}`, {
      fontFamily: "Georgia", fontSize: "28px", color: points > 0 ? "#f4d58f" : "#f4b098",
    }).setDepth(700).setOrigin(.5);
    this.objects.push(popup);
    this.tweens.add({ targets: popup, y: -12, alpha: 0, duration: 1000, onComplete: () => popup.destroy() });
  }
  deal(): void {
    if (this.mutedMotion) return;
    const stock = this.cards.find((card) => card.pile === "stock");
    if (!stock) return;
    this.cards.filter((card) => card.pile.startsWith("t")).forEach((card, i) => {
      card.image.setPosition(stock.x, stock.y).setAlpha(.4);
      this.tweens.add({ targets: card.image, x: card.x, y: card.y, alpha: 1,
        duration: 260, delay: i * 12, ease: "Cubic.Out" });
    });
  }
  celebrate(): void {
    if (this.mutedMotion) return;
    for (let i = 0; i < 45; i++) {
      const petal = this.add.text(Math.random() * this.width, -30, ["\u2660", "\u2665", "\u2666", "\u2726"][i % 4], {
        fontFamily: "Georgia", fontSize: `${14 + Math.random() * 22}px`,
        color: ["#ead091", "#d87872", "#fff1c8"][i % 3],
      }).setDepth(800);
      this.objects.push(petal);
      this.tweens.add({ targets: petal, x: petal.x + (Math.random() - .5) * 160, y: this.scale.height + 30,
        angle: Math.random() * 240 - 120, alpha: .1, duration: 1700 + Math.random() * 1400, delay: i * 20,
        onComplete: () => petal.destroy() });
    }
  }
}

export async function createBoard(element: HTMLElement, options: Omit<BoardOptions, "ready">): Promise<{ game: Phaser.Game; scene: RoyalBoard; resize: ResizeObserver }> {
  let scene: RoyalBoard;
  let game: Phaser.Game;
  const ready = new Promise<void>((resolve, reject) => {
    scene = new RoyalBoard({ ...options, ready: resolve, error: (message) => { options.error(message); reject(new Error(message)); } });
    game = new Phaser.Game({
      type: Phaser.AUTO, parent: element, width: element.clientWidth, height: 530,
      backgroundColor: "rgba(0,0,0,0)", transparent: true, antialias: true,
      audio: { noAudio: true }, scene: scene,
      render: { roundPixels: false }, input: { activePointers: 2 },
      banner: false,
    });
  });
  try { await ready; }
  catch (error) { game!.destroy(true); throw error; }
  game!.canvas.setAttribute("aria-hidden", "true");
  const resize = new ResizeObserver(() => {
    if (element.clientWidth > 0 && game.scale.width !== element.clientWidth) game.scale.resize(element.clientWidth, game.scale.height);
  });
  resize.observe(element);
  return { game: game!, scene: scene!, resize };
}
