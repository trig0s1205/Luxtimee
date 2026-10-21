export function formatOrderExtras(item: {
  extrasSnapshot?: Array<{ name: string; quantity: number }> | null;
  packageName?: string | null;
}) {
  const extras = (item.extrasSnapshot ?? [])
    .filter((extra) => extra.quantity > 0)
    .map((extra) => `${extra.quantity} ${extra.name} extra`);
  const parts = [...extras];
  if (item.packageName) parts.push(`Paquete: ${item.packageName}`);
  return parts.join(' · ');
}
