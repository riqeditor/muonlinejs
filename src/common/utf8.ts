// thegame: o OpenMU lê e escreve os textos do chat em UTF-8
// (ClientToServerPackets.cs / ServerToClientPackets.cs usam Encoding.UTF8).
// Os pacotes gerados do cliente gravam 1 byte por letra (Latin-1), o que quebra acentos.

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

/** Codifica em UTF-8 sem cortar uma letra no meio, limitado a `maxBytes`. */
export function encodeUtf8(text: string, maxBytes: number): Uint8Array {
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return bytes;

  let end = maxBytes;
  // Não termina no meio de uma sequência UTF-8 (bytes de continuação são 10xxxxxx).
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.slice(0, end);
}

/** Lê um texto UTF-8 do pacote, parando no primeiro byte 0. */
export function decodeUtf8(view: DataView, from: number, to = view.byteLength): string {
  const end = Math.min(to, view.byteLength);
  let stop = from;
  while (stop < end && view.getUint8(stop) !== 0) stop++;
  return decoder.decode(new Uint8Array(view.buffer, view.byteOffset + from, stop - from));
}

/** true quando o foco está num campo de texto (as teclas são do usuário digitando, não do jogo). */
export function isTypingInField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}
