export type PosWatchDto = {
  id: string;
  sku: string;
  brandName: string;
  model: string;
  reference: string | null;
  limitedEditionNumber: string | null;
  retailPrice: number;
  stock: number;
  warrantyMonths: number;
  imageUrl: string | null;
};

export type PosCatalogWatchDto = PosWatchDto & {
  gallery: string[];
  categoryName: string | null;
  gender: string | null;
  dialColor: string | null;
  strapMaterial: string | null;
  caseMaterial: string | null;
  movementType: string;
};

export type PosCatalogFacetsDto = {
  brands: Array<{ slug: string; name: string; count: number }>;
  categories: Array<{ slug: string; name: string; count: number }>;
  genders: Array<{ value: string; count: number }>;
  dialColors: Array<{ value: string; count: number }>;
  strapMaterials: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
};

export type PosCatalogPageDto = {
  items: PosCatalogWatchDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type PosCustomerHintDto = {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerDocument: string | null;
};

export type PosSaleResultDto = {
  orderId: string;
  readableId: string;
  receiptId: string;
  receiptNumber: string;
  total: number;
  changeTotal: number;
};

export type PosMySaleDto = {
  id: string;
  readableId: string;
  createdAt: string;
  customerName: string;
  total: number;
  methods: string[];
  receiptId: string | null;
  receiptNumber: string | null;
  receiptVoided: boolean;
  status: string | null;
  sellerName: string | null;
};

export type PosCashClosingPreviewDto = {
  date: string;
  totalCash: number;
  totalTransfer: number;
  totalCard: number;
  totalOther: number;
  totalSales: number;
  salesCount: number;
  sales: Array<{
    readableId: string;
    paidAt: string;
    customerName: string;
    total: number;
    methods: string[];
  }>;
  alreadyClosed: boolean;
  closing: PosCashClosingDto | null;
};

export type PosCashClosingDto = {
  id: string;
  businessDate: string;
  userId: string;
  userName?: string | null;
  openingCash: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  totalCash: number;
  totalTransfer: number;
  totalCard: number;
  totalOther: number;
  totalSales: number;
  salesCount: number;
  notes: string | null;
  createdAt: string;
};
