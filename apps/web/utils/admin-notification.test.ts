import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminTabTitle,
  formatRelativeTime,
  formatUnreadBadge,
  notificationHref,
  notificationMessage,
} from './admin-notification';

test('el contador oculta 0 y tapa en 99+', () => {
  assert.equal(formatUnreadBadge(0), '');
  assert.equal(formatUnreadBadge(3), '3');
  assert.equal(formatUnreadBadge(100), '99+');
});

test('el título de la pestaña antepone las no leídas', () => {
  assert.equal(adminTabTitle('Inventario — LUXTIMEE', 0), 'Inventario — LUXTIMEE');
  assert.equal(adminTabTitle('Inventario — LUXTIMEE', 3), '(3) Luxtimee Admin');
});

test('los tipos de notificación se leen en español', () => {
  assert.equal(
    notificationMessage('NEW_PRE_ORDER', { readableId: 'P-12' }),
    'Nuevo prepedido #P-12',
  );
  assert.equal(
    notificationMessage('PRE_ORDER_REMINDER', { readableId: 'P-12' }),
    'Prepedido #P-12 lleva más de 2 horas sin atender',
  );
  assert.equal(
    notificationMessage('PRE_ORDER_CONFIRMED', { readableId: 'P-12' }),
    'Abono confirmado en #P-12',
  );
  assert.equal(
    notificationMessage('ORDER_STATUS_CHANGED', { readableId: 'P-9', status: 'ENVIADO' }),
    'Pedido #P-9 cambió a Enviado',
  );
});

test('el enlace abre el prepedido o el pedido', () => {
  assert.equal(
    notificationHref('NEW_PRE_ORDER', { orderId: 'abc' }),
    '/admin/pre-pedidos/activos?id=abc',
  );
  assert.equal(
    notificationHref('ORDER_STATUS_CHANGED', { orderId: 'xyz' }),
    '/admin/pedidos/detal?id=xyz',
  );
});

test('la fecha relativa usa minutos', () => {
  const now = Date.parse('2026-11-01T15:00:00.000Z');
  assert.equal(formatRelativeTime('2026-11-01T14:55:00.000Z', now), 'hace 5 min');
});
