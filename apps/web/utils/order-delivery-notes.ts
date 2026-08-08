import type { OrderDto } from '@luxtime/shared';

export function orderHasDeliveryNotes(order: OrderDto) {
  return order.items.some((item) => item.deliveryNote?.trim());
}

export function orderDeliveryNotes(order: OrderDto) {
  return order.items
    .filter((item) => item.deliveryNote?.trim())
    .map((item) => ({
      id: item.id,
      label: item.productName,
      note: item.deliveryNote!.trim(),
    }));
}
