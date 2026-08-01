import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  tag: string;
}

@Injectable()
export class MemoryCacheService {
  private readonly store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number, tag: string) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tag,
    });
  }

  invalidateTag(tag: string) {
    for (const [key, entry] of this.store) {
      if (entry.tag === tag) this.store.delete(key);
    }
  }

  invalidateTags(tags: string[]) {
    for (const tag of tags) this.invalidateTag(tag);
  }
}
