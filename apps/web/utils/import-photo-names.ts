export type ImportPhotoSlot = 'front' | 'back' | 'video';

export type ParsedImportMedia = {
  importKey: string;
  slot: ImportPhotoSlot;
  fileName: string;
};

/**
 * Convenciones: NNN_1_frente.jpg, NNN_2_dorso.jpg, NNN_video.mp4
 * También: NNN-frente, NNN-dorso, NNN_1, NNN_2; jpg/jpeg/png/webp/mp4.
 */
export function parseImportMediaFileName(
  fileName: string,
): ParsedImportMedia | null {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const keyMatch = base.match(/^(\d+)/);
  if (!keyMatch) return null;
  const importKey = keyMatch[1];
  const lower = base.toLowerCase();
  const ext = (lower.match(/\.(jpe?g|png|webp|mp4)$/) || [])[1];
  if (!ext) return null;

  if (ext === 'mp4' || /(?:^|[_-])video(?:[_./-]|$)/i.test(lower)) {
    return { importKey, slot: 'video', fileName: base };
  }

  const isFront =
    /frente/i.test(lower) ||
    /[_-]1(?:[_./-]|$)/.test(lower) ||
    /[_-]1_/.test(lower);
  const isBack =
    /dorso/i.test(lower) ||
    /[_-]2(?:[_./-]|$)/.test(lower) ||
    /[_-]2_/.test(lower);

  if (isFront && !isBack) return { importKey, slot: 'front', fileName: base };
  if (isBack && !isFront) return { importKey, slot: 'back', fileName: base };

  if (/^\d+[_-]1\./i.test(lower)) {
    return { importKey, slot: 'front', fileName: base };
  }
  if (/^\d+[_-]2\./i.test(lower)) {
    return { importKey, slot: 'back', fileName: base };
  }

  return null;
}

export type GroupedImportMedia = {
  importKey: string;
  front?: File;
  back?: File;
  video?: File;
};

export function groupImportMediaFiles(files: File[]): {
  groups: GroupedImportMedia[];
  ignored: string[];
} {
  const map = new Map<string, GroupedImportMedia>();
  const ignored: string[] = [];
  for (const file of files) {
    const parsed = parseImportMediaFileName(file.name);
    if (!parsed) {
      ignored.push(file.name);
      continue;
    }
    const g = map.get(parsed.importKey) || { importKey: parsed.importKey };
    if (parsed.slot === 'front') g.front = file;
    else if (parsed.slot === 'back') g.back = file;
    else g.video = file;
    map.set(parsed.importKey, g);
  }
  return {
    groups: [...map.values()].sort((a, b) =>
      a.importKey.localeCompare(b.importKey, undefined, { numeric: true }),
    ),
    ignored,
  };
}
