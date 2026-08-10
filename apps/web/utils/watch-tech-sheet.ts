import type { WatchPublicDto } from '@luxtime/shared';

export type TechSpecRow = { label: string; value: string };

const SPEC_KEY_LABELS: Record<string, string> = {
  movement: 'Movimiento',
  caseMaterial: 'Material de caja',
  caseDiameter: 'Diámetro de caja',
  waterResistance: 'Resistencia al agua',
};

function formatSpecKey(key: string) {
  if (SPEC_KEY_LABELS[key]) return SPEC_KEY_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function splitDescription(text?: string | null): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function buildWatchTechSpecs(watch: WatchPublicDto): TechSpecRow[] {
  const rows: TechSpecRow[] = [];
  const usedLabels = new Set<string>();

  const add = (label: string, value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || usedLabels.has(label)) return;
    usedLabels.add(label);
    rows.push({ label, value: trimmed });
  };

  add('SKU', watch.sku);
  add('Referencia', watch.reference ?? undefined);
  add('Clase / Estilo', watch.category?.name);
  add('Género', watch.gender ?? undefined);
  add('Movimiento', watch.movementType);
  add('Calibre', watch.movementCaliber ?? undefined);
  add('Diámetro de caja', watch.caseDiameter ?? undefined);
  add('Material de caja', watch.caseMaterial ?? undefined);
  add('Bisel', watch.bezelMaterial ?? undefined);
  add('Color de esfera', watch.dialColor ?? undefined);
  add('Cristal', watch.crystalType ?? undefined);
  add('Correa / Brazalete', watch.strapMaterial ?? undefined);

  if (watch.functions?.length) {
    add('Funciones', watch.functions.join(' · '));
  }

  if (watch.isLimitedEdition) {
    add('Edición limitada', watch.limitedEditionNumber ?? 'Sí');
  }

  if (watch.warrantyMonths) {
    add('Garantía', `${watch.warrantyMonths} meses`);
  }

  for (const [key, value] of Object.entries(watch.specs ?? {})) {
    if (value) add(formatSpecKey(key), value);
  }

  return rows;
}
