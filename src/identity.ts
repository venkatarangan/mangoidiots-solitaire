export function gameStorageKey(base: URL): string {
  return `mangoidiots-solitaire:${base.pathname}`;
}
