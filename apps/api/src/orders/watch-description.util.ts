import type { Brand, Category, Watch } from '@prisma/client';

type WatchForDescription = Watch & {
  brand: Brand;
  category?: Category | null;
};

function formatDialColor(color?: string | null) {
  if (!color?.trim()) return null;
  const normalized = color.trim().toLowerCase();
  if (normalized.includes('cara') || normalized.includes('esfera')) return normalized;
  return `cara ${normalized}`;
}

export function formatWatchOrderLabel(watch: WatchForDescription) {
  const parts: string[] = [`${watch.brand.name} ${watch.model}`.trim()];

  if (watch.reference?.trim()) parts.push(`Ref. ${watch.reference.trim()}`);
  const dial = formatDialColor(watch.dialColor);
  if (dial) parts.push(dial);
  if (watch.caseMaterial?.trim()) parts.push(watch.caseMaterial.trim());
  if (watch.caseDiameter?.trim()) parts.push(watch.caseDiameter.trim());
  if (watch.bezelMaterial?.trim()) parts.push(`bisel ${watch.bezelMaterial.trim()}`);
  if (watch.strapMaterial?.trim()) parts.push(watch.strapMaterial.trim());
  if (watch.movementType?.trim()) parts.push(watch.movementType.trim());
  if (watch.category?.name?.trim()) parts.push(watch.category.name.trim());
  if (watch.isLimitedEdition) {
    parts.push(watch.limitedEditionNumber?.trim() ? `Ed. ${watch.limitedEditionNumber.trim()}` : 'Edición limitada');
  }

  return parts.join(', ');
}
