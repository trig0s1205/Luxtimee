import type { FaqItem } from '@luxtime/shared';

export function normalizeFaqItems(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): FaqItem | null => {
      if (!item || typeof item !== 'object') return null;
      const question = String((item as { question?: unknown }).question ?? '').trim();
      const answer = String((item as { answer?: unknown }).answer ?? '').trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((item): item is FaqItem => item !== null);
}

export const DEFAULT_HOMEPAGE_FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Cómo compro un reloj en LUXTIMEE?',
    answer: 'Eliges el modelo en el catálogo, lo agregas al carrito y completas el checkout. Confirmamos disponibilidad y tiempos por WhatsApp antes de despachar.',
  },
  {
    question: '¿Hacen envíos a todo Colombia?',
    answer: 'Sí. Enviamos a nivel nacional con transportadora. En Piedecuesta y área metropolitana de Bucaramanga también ofrecemos entrega local coordinada.',
  },
  {
    question: '¿Cuánto tarda en llegar mi pedido?',
    answer: 'Los tiempos dependen de tu ciudad. Te confirmamos la fecha estimada al cerrar la compra. Los envíos nacionales suelen tardar entre 2 y 5 días hábiles.',
  },
  {
    question: '¿Qué métodos de pago aceptan?',
    answer: 'Transferencia bancaria, Nequi, Daviplata y otros medios acordados por WhatsApp. El pago se confirma antes del despacho.',
  },
  {
    question: '¿Los relojes tienen garantía?',
    answer: 'Cada pieza incluye garantía según la ficha del modelo. Cubre defectos de fabricación; el plazo se indica en la descripción del reloj.',
  },
  {
    question: '¿Puedo ver el reloj antes de comprarlo?',
    answer: 'Publicamos fotos y video reales de cada referencia. Si estás en Santander, podemos coordinar una cita para ver la pieza.',
  },
];

type LegacyStatementConfig = {
  enabled?: boolean;
  text?: string;
  textEm?: string;
  sub?: string;
  label?: string;
  title?: string;
  titleEm?: string;
  items?: unknown;
};

export function migrateHomepageFaqConfig(
  faq?: Partial<import('@luxtime/shared').HomepageFaqConfig> | null,
  legacyStatement?: LegacyStatementConfig | null,
): import('@luxtime/shared').HomepageFaqConfig {
  const source = faq ?? legacyStatement;
  const items = normalizeFaqItems(source?.items);
  const enabled = source?.enabled ?? true;

  return {
    enabled,
    label: source?.label?.trim() || 'Preguntas frecuentes',
    title: source?.title?.trim() || 'Resolvemos',
    titleEm: source?.titleEm?.trim() || 'tus dudas',
    items: items.length ? items : DEFAULT_HOMEPAGE_FAQ_ITEMS,
  };
}
