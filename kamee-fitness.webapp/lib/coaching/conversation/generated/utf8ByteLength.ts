// Generated from src/lib/utf8ByteLength.ts; run the app sync-coaching-conversation-client script. Do not edit.
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const c of text) {
    const p = c.codePointAt(0)!;
    bytes += p <= 0x7f ? 1 : p <= 0x7ff ? 2 : p <= 0xffff ? 3 : 4;
  }
  return bytes;
}
