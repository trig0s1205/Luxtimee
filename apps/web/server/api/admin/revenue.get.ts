import type { RevenueDashboardDto, RevenueRange } from '@luxtime/shared';
import { getHeader } from 'h3';

const VALID_RANGES = new Set<RevenueRange>(['today', '1_week', '1_month', 'historical']);

function parseRange(value: string | undefined): RevenueRange {
  if (value && VALID_RANGES.has(value as RevenueRange)) {
    return value as RevenueRange;
  }
  return '1_month';
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const cookie = getHeader(event, 'cookie');
  if (!cookie) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' });
  }

  const query = getQuery(event);
  const range = parseRange(typeof query.range === 'string' ? query.range : undefined);

  try {
    return await $fetch<RevenueDashboardDto>(`${config.public.apiBaseUrl}/dashboards/revenue`, {
      headers: { cookie },
      query: { range },
    });
  } catch (error: unknown) {
    console.error('[revenue] proxy error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'No se pudieron obtener los ingresos.',
    });
  }
});
