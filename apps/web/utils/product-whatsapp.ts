import { formatProductWatchName } from '@luxtime/shared';

export function buildProductWhatsappMessage(input: {
  brand: string;
  model: string;
  sku: string;
}) {
  const name = formatProductWatchName(input.brand, input.model);
  const watch = name ? ` ${name}` : '';
  return `Hola LUXTIMEE, quiero comprar el reloj${watch}. SKU: ${input.sku.trim()}`;
}
