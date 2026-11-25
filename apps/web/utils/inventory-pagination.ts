export const INVENTORY_PAGE_SIZE = 30;

export function inventoryPageQuery(page: number, pageSize = INVENTORY_PAGE_SIZE) {
  return { page: Math.max(1, page), limit: pageSize };
}

export function mergeInventoryPage<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  if (!current.length) return incoming.slice();
  const seen = new Set(current.map((item) => item.id));
  const next = current.slice();
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

export async function loadInventoryCount<T extends { id: string }>(
  targetCount: number,
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options?: { pageSize?: number; isStale?: () => boolean },
): Promise<{ data: T[]; total: number; stale: boolean }> {
  const pageSize = options?.pageSize ?? 100;
  const isStale = options?.isStale ?? (() => false);
  const target = Math.max(1, targetCount);
  let data: T[] = [];
  let total = 0;
  let page = 1;
  while (data.length < target) {
    if (isStale()) return { data, total, stale: true };
    const res = await fetchPage(page, pageSize);
    if (isStale()) return { data, total, stale: true };
    total = res.total;
    data = mergeInventoryPage(data, res.data);
    if (res.data.length < pageSize || data.length >= total) break;
    page += 1;
  }
  return { data: data.slice(0, target), total, stale: false };
}

export async function loadInventoryWindow<T extends { id: string }>(
  pages: number,
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options?: { pageSize?: number; isStale?: () => boolean },
): Promise<{ data: T[]; total: number; pagesFetched: number; stale: boolean }> {
  const pageSize = options?.pageSize ?? INVENTORY_PAGE_SIZE;
  const isStale = options?.isStale ?? (() => false);
  let data: T[] = [];
  let total = 0;
  let pagesFetched = 0;
  const target = Math.max(1, pages);
  for (let page = 1; page <= target; page += 1) {
    if (isStale()) return { data, total, pagesFetched, stale: true };
    const res = await fetchPage(page, pageSize);
    if (isStale()) return { data, total, pagesFetched, stale: true };
    pagesFetched += 1;
    total = res.total;
    data = mergeInventoryPage(data, res.data);
    if (res.data.length < pageSize || data.length >= total) break;
  }
  return { data, total, pagesFetched, stale: false };
}
