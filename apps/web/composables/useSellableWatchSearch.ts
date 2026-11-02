import type { PaginatedResponse, WatchStaffDto } from '@luxtime/shared';
import { isAbortError } from '~/utils/api-error';

const RESULT_LIMIT = 100;

export function useSellableWatchSearch() {
  const api = useApi();
  const query = ref('');
  const results = ref<WatchStaffDto[]>([]);
  const total = ref(0);
  const pending = ref(false);
  const finishedTerm = ref('');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abort: AbortController | null = null;

  function clear() {
    if (timer) clearTimeout(timer);
    abort?.abort();
    query.value = '';
    results.value = [];
    total.value = 0;
    finishedTerm.value = '';
    pending.value = false;
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void run();
    }, 300);
  }

  async function run() {
    const term = query.value.trim();
    abort?.abort();
    if (term.length < 2) {
      results.value = [];
      total.value = 0;
      finishedTerm.value = '';
      pending.value = false;
      return;
    }
    const controller = new AbortController();
    abort = controller;
    pending.value = true;
    try {
      const res = await api.get<PaginatedResponse<WatchStaffDto>>('/watches', {
        search: term,
        page: 1,
        limit: RESULT_LIMIT,
        availability: 'sellable',
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      results.value = res.data;
      total.value = res.total;
      finishedTerm.value = term;
    } catch (err: unknown) {
      if (isAbortError(err) || controller.signal.aborted) return;
      results.value = [];
      total.value = 0;
      finishedTerm.value = term;
    } finally {
      if (abort === controller) pending.value = false;
    }
  }

  return { query, results, total, pending, finishedTerm, schedule, clear };
}
