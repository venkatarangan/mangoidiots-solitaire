export const ZOOM_LEVELS: readonly number[] = [.75, 1, 1.25, 1.5, 1.75, 2];

export function validZoom(value: unknown): value is number {
  return typeof value === "number" && (value === 0 || ZOOM_LEVELS.includes(value));
}

export function validColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function tableInk(colour: string): string {
  if (!validColour(colour)) throw new Error("Choose a valid six-digit background colour.");
  const rgb = [1, 3, 5].map((i) => {
    const channel = parseInt(colour.slice(i, i + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#000000" : "#ffffff";
}
