/** Clave interna en specs; empieza con _ para ocultarse al público (isCustomerSpecKey). */
export const IMPORT_KEY_FIELD = '_importKey';

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 300;

/** Columnas técnicas (fila 2) de datos; las de seguimiento a la derecha se ignoran. */
export const IMPORT_DATA_COLUMNS = [
  '_fila',
  'importKey',
  'brand',
  'model',
  'reference',
  'category',
  'gender',
  'mechanism',
  'retailPrice',
  'wholesalePrice',
  'cost',
  'stock',
  'warrantyMonths',
  'description',
  'dialColor',
  'caseDiameter',
  'caseMaterial',
  'bezelMaterial',
  'crystalType',
  'strapMaterial',
  'waterResistance',
  'movementCaliber',
  'functions',
  'careTemplate',
  'isLimitedEdition',
  'limitedEditionNumber',
] as const;

export type ImportDataColumn = (typeof IMPORT_DATA_COLUMNS)[number];

export const REQUIRED_TECH_COLUMNS = [
  'importKey',
  'brand',
  'model',
  'retailPrice',
  'wholesalePrice',
  'stock',
] as const;

export const GENDER_VALUES = ['Hombre', 'Mujer', 'Unisex'] as const;
