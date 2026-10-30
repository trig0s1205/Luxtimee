export function buildProductWhatsappMessage(input: {
  brand: string;
  model: string;
  sku: string;
}) {
  const name = `${input.brand} ${input.model}`.replace(/\s+/g, ' ').trim();
  const sku = input.sku.trim();
  return `Hola, quiero comprar ${name}. SKU: ${sku}`;
}
