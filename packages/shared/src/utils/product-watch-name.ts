export function formatProductWatchName(brand: string, model: string) {
  const brandName = brand.trim();
  const modelName = model.trim();
  if (!brandName) return modelName;
  if (!modelName) return brandName;
  if (brandName.localeCompare(modelName, 'es', { sensitivity: 'base' }) === 0) {
    return brandName;
  }
  return `${brandName} ${modelName}`.replace(/\s+/g, ' ').trim();
}
