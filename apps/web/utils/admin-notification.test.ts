import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminDocumentTitle,
  adminTabTitle,
  formatUnreadBadge,
} from './admin-document-title';
import {
  formatRelativeTime,
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

test('el admin no hereda el título público y conserva el contador', () => {
  const fallback = 'Notificaciones — LUXTIMEE';
  const publicTitle = 'Relojes de lujo en Bucaramanga y Piedecuesta | LUXTIMEE';
  assert.equal(adminDocumentTitle(publicTitle, 0, fallback), 'Notificaciones — Luxtimee Admin');
  assert.equal(adminDocumentTitle('Notificaciones', 0, fallback), 'Notificaciones — Luxtimee Admin');
  assert.equal(adminDocumentTitle('Inventario — LUXTIMEE Admin', 0, 'Inventario — LUXTIMEE'), 'Inventario — Luxtimee Admin');
  assert.equal(adminDocumentTitle('Inventario — LUXTIMEE Admin', 4, 'Inventario — LUXTIMEE'), '(4) Luxtimee Admin');
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
  assert.equal(
    notificationMessage('PRE_ORDER_SUSPENDED', { readableId: 'P-4' }),
    'Prepedido #P-4 quedó suspendido',
  );
  assert.equal(
    notificationMessage('PRE_ORDER_REACTIVATED', { readableId: 'P-4' }),
    'Prepedido #P-4 fue reactivado',
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
  assert.equal(
    notificationHref('PRE_ORDER_REACTIVATED', { orderId: 're-1' }),
    '/admin/pre-pedidos/activos?id=re-1',
  );
  assert.equal(
    notificationHref('PRE_ORDER_REMINDER', { orderId: 'cron-1' }),
    '/admin/pre-pedidos/activos?id=cron-1',
  );
  assert.equal(
    notificationHref('PRE_ORDER_SUSPENDED', { orderId: 'su-1' }),
    '/admin/pre-pedidos/suspendidos?id=su-1',
  );
  assert.equal(
    notificationHref('PRE_ORDER_CONFIRMED', { orderId: 'ok-1' }),
    '/admin/pedidos/detal?id=ok-1',
  );
});

test('la fecha relativa usa minutos', () => {
  const now = Date.parse('2026-11-01T15:00:00.000Z');
  assert.equal(formatRelativeTime('2026-11-01T14:55:00.000Z', now), 'hace 5 min');
});
