export type NtfsExtraTimes = {
  modifiedAt?: number;
  createdAt?: number;
};

function filetimeToMs(view: DataView, offset: number) {
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  const filetime = BigInt(high) * 4294967296n + BigInt(low);
  if (filetime <= 0n) return undefined;
  const ms = Number(filetime / 10000n - 11644473600000n);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

/**
 * Extra 0x000a. El campo de tamaño no incluye la cabecera de 4 bytes:
 * el Explorador de Windows escribe 32.
 */
export function readNtfsExtraTimes(extra: Uint8Array): NtfsExtraTimes {
  const times: NtfsExtraTimes = {};
  if (extra.length < 4) return times;
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const id = view.getUint16(cursor, true);
    const size = view.getUint16(cursor + 2, true);
    const start = cursor + 4;
    if (start + size > extra.length) break;
    if (id === 0x000a && size >= 32) {
      let tagCursor = start + 4;
      const end = start + size;
      while (tagCursor + 4 <= end) {
        const tag = view.getUint16(tagCursor, true);
        const tagSize = view.getUint16(tagCursor + 2, true);
        const tagStart = tagCursor + 4;
        if (tag === 0x0001 && tagStart + 8 <= extra.length) {
          times.modifiedAt = filetimeToMs(view, tagStart);
          if (tagSize >= 24 && tagStart + 24 <= extra.length) {
            times.createdAt = filetimeToMs(view, tagStart + 16);
          }
        }
        tagCursor = tagStart + tagSize;
      }
    }
    cursor = start + size;
  }
  return times;
}
