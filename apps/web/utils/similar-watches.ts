import type { WatchPublicDto } from '@luxtime/shared';
import { equalsInsensitive } from '~/utils/catalog-filters';

const SIMILAR_RATIO = 0.6;

function similarityScore(current: WatchPublicDto, candidate: WatchPublicDto): number {
  let score = 0;

  if (current.brand.id === candidate.brand.id) score += 50;
  if (current.category?.id && candidate.category?.id === current.category.id) score += 20;
  if (current.dialColor && candidate.dialColor && equalsInsensitive(current.dialColor, candidate.dialColor)) {
    score += 25;
  }
  if (current.caseMaterial && candidate.caseMaterial && equalsInsensitive(current.caseMaterial, candidate.caseMaterial)) {
    score += 15;
  }
  if (current.bezelMaterial && candidate.bezelMaterial && equalsInsensitive(current.bezelMaterial, candidate.bezelMaterial)) {
    score += 10;
  }
  if (current.strapMaterial && candidate.strapMaterial && equalsInsensitive(current.strapMaterial, candidate.strapMaterial)) {
    score += 8;
  }
  if (current.gender && candidate.gender && equalsInsensitive(current.gender, candidate.gender)) score += 10;
  if (equalsInsensitive(current.movementType, candidate.movementType)) score += 6;

  const priceBase = Math.max(current.retailPrice, 1);
  const priceDiff = Math.abs(current.retailPrice - candidate.retailPrice) / priceBase;
  if (priceDiff < 0.15) score += 15;
  else if (priceDiff < 0.3) score += 8;

  return score;
}

// PRNG con semilla para que servidor y cliente generen el mismo orden.
function seededRandom(seed: string) {
  let hash = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = seededRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function mixSimilarAndDiscovery(similar: WatchPublicDto[], discovery: WatchPublicDto[]): WatchPublicDto[] {
  const mixed: WatchPublicDto[] = [];
  let similarIndex = 0;
  let discoveryIndex = 0;

  while (similarIndex < similar.length || discoveryIndex < discovery.length) {
    for (let i = 0; i < 2 && similarIndex < similar.length; i++) {
      mixed.push(similar[similarIndex++]!);
    }
    if (discoveryIndex < discovery.length) mixed.push(discovery[discoveryIndex++]!);
  }

  return mixed;
}

export function rankSimilarWatches(current: WatchPublicDto, catalog: WatchPublicDto[]): WatchPublicDto[] {
  return catalog
    .filter((item) => item.id !== current.id && item.slug !== current.slug && item.stock > 0)
    .map((item) => ({ item, score: similarityScore(current, item) }))
    .sort((a, b) => b.score - a.score || a.item.retailPrice - b.item.retailPrice)
    .map(({ item }) => item);
}

export function buildRelatedWatches(
  current: WatchPublicDto,
  catalog: WatchPublicDto[],
  total = 20,
): WatchPublicDto[] {
  const ranked = rankSimilarWatches(current, catalog);
  if (ranked.length <= total) return ranked;

  const similarCount = Math.min(Math.ceil(total * SIMILAR_RATIO), ranked.length);
  const similar = ranked.slice(0, similarCount);
  const discovery = seededShuffle(ranked.slice(similarCount), current.id).slice(0, total - similar.length);

  return mixSimilarAndDiscovery(similar, discovery).slice(0, total);
}

export function pickRandomWatches(
  current: WatchPublicDto,
  catalog: WatchPublicDto[],
  total = 12,
  seed = current.slug,
): WatchPublicDto[] {
  const pool = catalog.filter(
    (item) => item.id !== current.id && item.slug !== current.slug && item.stock > 0,
  );
  return seededShuffle(pool, seed).slice(0, total);
}
