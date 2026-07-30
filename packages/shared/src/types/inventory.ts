export interface InventoryInsightWatchDto {
  id: string;
  model: string;
  brand: string;
  reference: string | null;
  image: string | null;
  stock: number;
  unitsSold: number;
  createdAt: string;
  daysInInventory: number;
}

export interface InventoryInsightsDto {
  totalUnits: number;
  totalSkus: number;
  outOfStockCount: number;
  lowestStock: InventoryInsightWatchDto | null;
  highestStock: InventoryInsightWatchDto | null;
  oldestInStock: InventoryInsightWatchDto | null;
  leastSold: InventoryInsightWatchDto | null;
  mostSold: InventoryInsightWatchDto | null;
}
