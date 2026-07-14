export interface MockWatch {
  id: string;
  slug: string;
  brand: string;
  model: string;
  movementType: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  image: string;
  tag?: string;
  specs: Record<string, string>;
  warranty: string;
  care: string;
}

export const mockWatches: MockWatch[] = [
  {
    id: '1',
    slug: 'rolex-submariner-date',
    brand: 'Rolex',
    model: 'Submariner Date',
    movementType: 'Automático',
    retailPrice: 18500000,
    wholesalePrice: 16200000,
    stock: 3,
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800&q=80',
    tag: 'Más vendido',
    specs: { material: 'Acero Oystersteel', tamaño: '41mm', resistencia: '300m' },
    warranty: '12 meses — defectos de fabricación',
    care: 'Evite químicos y campos magnéticos intensos.',
  },
  {
    id: '2',
    slug: 'omega-speedmaster',
    brand: 'Omega',
    model: 'Speedmaster Moonwatch',
    movementType: 'Manual',
    retailPrice: 14200000,
    wholesalePrice: 12800000,
    stock: 2,
    image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800&q=80',
    specs: { material: 'Acero', tamaño: '42mm', resistencia: '50m' },
    warranty: '12 meses — defectos de fabricación',
    care: 'Limpie con paño suave después de cada uso.',
  },
  {
    id: '3',
    slug: 'tag-heuer-carrera',
    brand: 'TAG Heuer',
    model: 'Carrera Chronograph',
    movementType: 'Automático',
    retailPrice: 9800000,
    wholesalePrice: 8600000,
    stock: 0,
    image: 'https://images.unsplash.com/photo-1614164185128-e943481c8a70?w=800&q=80',
    tag: 'Edición limitada',
    specs: { material: 'Acero', tamaño: '44mm', resistencia: '100m' },
    warranty: '12 meses — defectos de fabricación',
    care: 'No exponga a agua salada prolongada.',
  },
  {
    id: '4',
    slug: 'cartier-santos',
    brand: 'Cartier',
    model: 'Santos de Cartier',
    movementType: 'Automático',
    retailPrice: 16800000,
    wholesalePrice: 14900000,
    stock: 1,
    image: 'https://images.unsplash.com/photo-1548171916-2d98559b21bc?w=800&q=80',
    specs: { material: 'Acero', tamaño: '39.8mm', resistencia: '100m' },
    warranty: '12 meses — defectos de fabricación',
    care: 'Guarde en estuche cuando no lo use.',
  },
];

export const wholesaleBanner =
  '¡Lleva 4 o más relojes y tu precio cambia a por mayor automáticamente!';

export function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}
