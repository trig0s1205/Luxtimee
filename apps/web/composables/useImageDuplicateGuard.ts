import {
  compareFingerprints,
  type ImageDuplicateMatch,
  type ImageFingerprint,
  type StoredImageDuplicate,
} from '@luxtime/shared';
import { fingerprintImageFile } from '~/utils/image-fingerprint';
import { storedDuplicateViews, type DuplicateHitView } from '~/utils/image-duplicates';

type SlotName = 'primary' | 'secondary';

type SlotState = {
  checking: boolean;
  failed: boolean;
  decision: 'keep' | null;
  fingerprint: ImageFingerprint | null;
  stored: StoredImageDuplicate[];
  hits: DuplicateHitView[];
};

function freshSlot(): SlotState {
  return {
    checking: false,
    failed: false,
    decision: null,
    fingerprint: null,
    stored: [],
    hits: [],
  };
}

export function useImageDuplicateGuard() {
  const api = useApi();
  const assets = String(useRuntimeConfig().public.apiAssetsUrl || 'http://localhost:3001');
  const slots = reactive({ primary: freshSlot(), secondary: freshSlot() });
  const generation = { primary: 0, secondary: 0 };

  function hitsFor(slot: SlotName): DuplicateHitView[] {
    const state = slots[slot];
    const otherName: SlotName = slot === 'primary' ? 'secondary' : 'primary';
    const other = slots[otherName];
    const views = storedDuplicateViews(state.stored, assets);
    if (
      state.fingerprint
      && other.fingerprint
      && compareFingerprints(state.fingerprint, other.fingerprint)
    ) {
      views.unshift({
        key: 'peer',
        title: 'En este formulario',
        detail: slot === 'primary' ? 'También es la foto secundaria' : 'También es la foto principal',
      });
    }
    return views;
  }

  function syncHits() {
    slots.primary.hits = hitsFor('primary');
    slots.secondary.hits = hitsFor('secondary');
  }

  function unresolved() {
    return (slots.primary.hits.length > 0 && slots.primary.decision !== 'keep')
      || (slots.secondary.hits.length > 0 && slots.secondary.decision !== 'keep');
  }

  async function inspect(slot: SlotName, file: File | null) {
    const token = ++generation[slot];
    slots[slot].decision = null;
    slots[slot].failed = false;
    slots[slot].stored = [];
    slots[slot].fingerprint = null;
    if (!file) {
      slots[slot].checking = false;
      syncHits();
      return;
    }
    slots[slot].checking = true;
    try {
      const fingerprint = await fingerprintImageFile(file);
      if (generation[slot] !== token) return;
      slots[slot].fingerprint = fingerprint;
      const response = await api.post<{ matches: ImageDuplicateMatch[] }>('/watches/image-duplicates', {
        items: [{
          id: slot,
          contentHash: fingerprint.contentHash,
          ...(fingerprint.perceptualHash ? { perceptualHash: fingerprint.perceptualHash } : {}),
        }],
      });
      if (generation[slot] !== token) return;
      slots[slot].stored = response.matches.find((match) => match.id === slot)?.duplicates ?? [];
    } catch {
      if (generation[slot] !== token) return;
      slots[slot].failed = true;
    } finally {
      if (generation[slot] === token) {
        slots[slot].checking = false;
        syncHits();
      }
    }
  }

  function keep(slot: SlotName) {
    slots[slot].decision = 'keep';
  }

  async function settle() {
    const started = Date.now();
    while ((slots.primary.checking || slots.secondary.checking) && Date.now() - started < 15_000) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !unresolved();
  }

  return {
    slots,
    inspect,
    keep,
    settle,
  };
}
