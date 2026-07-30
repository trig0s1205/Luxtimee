<script setup lang="ts">
import type { InventoryInsightWatchDto, InventoryInsightsDto } from '@luxtime/shared';
import { GLOBAL_INVENTORY_LOW_THRESHOLD } from '@luxtime/shared';

defineProps<{
  insights: InventoryInsightsDto | null;
  loading?: boolean;
}>();

type InsightCard = {
  key: string;
  label: string;
  hint: string;
  watch: InventoryInsightWatchDto | null;
  metric: string;
  critical?: boolean;
};

function cards(data: InventoryInsightsDto): InsightCard[] {
  return [
    {
      key: 'lowest',
      label: 'Menor stock',
      hint: 'Priorizar reposición',
      watch: data.lowestStock,
      metric: data.lowestStock ? `${data.lowestStock.stock} uds.` : '—',
      critical: (data.lowestStock?.stock ?? 0) <= 2,
    },
    {
      key: 'highest',
      label: 'Mayor stock',
      hint: 'Capital inmovilizado',
      watch: data.highestStock,
      metric: data.highestStock ? `${data.highestStock.stock} uds.` : '—',
    },
    {
      key: 'oldest',
      label: 'Más tiempo en inventario',
      hint: 'Candidato a promoción',
      watch: data.oldestInStock,
      metric: data.oldestInStock ? `${data.oldestInStock.daysInInventory} días` : '—',
    },
    {
      key: 'least',
      label: 'Menos ventas',
      hint: 'Impulsar publicidad',
      watch: data.leastSold,
      metric: data.leastSold ? `${data.leastSold.unitsSold} vendidas` : '—',
    },
    {
      key: 'most',
      label: 'Más ventas',
      hint: 'Referencia comercial',
      watch: data.mostSold,
      metric: data.mostSold ? `${data.mostSold.unitsSold} vendidas` : '—',
    },
  ];
}
</script>

<template>
  <section class="inventory-insights">
    <div class="inventory-insights-header">
      <div>
        <p class="inventory-insights-label">Panel interno</p>
        <h2 class="inventory-insights-title">Resumen de inventario</h2>
      </div>
      <div class="inventory-insights-totals">
        <div class="inventory-insights-total" :class="{ critical: (insights?.totalUnits ?? 0) <= GLOBAL_INVENTORY_LOW_THRESHOLD }">
          <span>{{ insights?.totalUnits ?? '—' }}</span>
          <small>unidades totales</small>
        </div>
        <div class="inventory-insights-total">
          <span>{{ insights?.totalSkus ?? '—' }}</span>
          <small>SKUs activos</small>
        </div>
        <div class="inventory-insights-total" :class="{ critical: (insights?.outOfStockCount ?? 0) > 0 }">
          <span>{{ insights?.outOfStockCount ?? '—' }}</span>
          <small>agotados</small>
        </div>
      </div>
    </div>

    <div v-if="loading && !insights" class="inventory-insights-grid">
      <article v-for="i in 5" :key="i" class="inventory-insight-card">Cargando...</article>
    </div>

    <div v-else-if="insights" class="inventory-insights-grid">
      <article
        v-for="card in cards(insights)"
        :key="card.key"
        class="inventory-insight-card"
        :class="{ critical: card.critical }"
      >
        <p class="inventory-insight-label">{{ card.label }}</p>
        <p class="inventory-insight-metric">{{ card.metric }}</p>
        <div v-if="card.watch" class="inventory-insight-watch">
          <img v-if="card.watch.image" :src="card.watch.image" :alt="card.watch.model" loading="lazy">
          <div>
            <strong>{{ card.watch.brand }} {{ card.watch.model }}</strong>
            <span v-if="card.watch.reference">Ref. {{ card.watch.reference }}</span>
            <small>{{ card.hint }}</small>
          </div>
        </div>
        <p v-else class="inventory-insight-empty">Sin datos</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.inventory-insights {
  border: var(--border-hairline);
  padding: 20px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.01);
}

.inventory-insights-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.inventory-insights-label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lux-gold);
  margin-bottom: 6px;
}

.inventory-insights-title {
  font-family: var(--lux-font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--lux-white);
}

.inventory-insights-totals {
  display: flex;
  gap: 12px;
}

.inventory-insights-total {
  min-width: 92px;
  padding: 10px 12px;
  border: var(--border-hairline);
  text-align: center;
}

.inventory-insights-total span {
  display: block;
  font-family: var(--lux-font-display);
  font-size: 20px;
  color: var(--lux-white);
}

.inventory-insights-total small {
  display: block;
  margin-top: 4px;
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.inventory-insights-total.critical {
  border-color: rgba(232, 93, 93, 0.45);
  background: rgba(232, 93, 93, 0.06);
}

.inventory-insights-total.critical span {
  color: #e85d5d;
}

.inventory-insights-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.inventory-insight-card {
  border: var(--border-hairline);
  padding: 14px;
  min-height: 150px;
}

.inventory-insight-card.critical {
  border-color: rgba(232, 93, 93, 0.35);
  background: rgba(232, 93, 93, 0.04);
}

.inventory-insight-label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
  margin-bottom: 8px;
}

.inventory-insight-metric {
  font-family: var(--lux-font-display);
  font-size: 24px;
  color: var(--lux-white);
  margin-bottom: 12px;
}

.inventory-insight-watch {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.inventory-insight-watch img {
  width: 42px;
  height: 42px;
  object-fit: cover;
  border: var(--border-hairline);
}

.inventory-insight-watch strong {
  display: block;
  font-family: var(--lux-font-body);
  font-size: 12px;
  color: var(--lux-white);
  margin-bottom: 2px;
}

.inventory-insight-watch span,
.inventory-insight-watch small {
  display: block;
  font-family: var(--lux-font-body);
  font-size: 10px;
  color: var(--lux-white-dim);
}

.inventory-insight-watch small {
  margin-top: 6px;
  color: var(--lux-gold);
}

.inventory-insight-empty {
  font-family: var(--lux-font-body);
  font-size: 12px;
  color: var(--lux-white-dim);
}

@media (max-width: 1200px) {
  .inventory-insights-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .inventory-insights-header {
    flex-direction: column;
  }

  .inventory-insights-totals {
    width: 100%;
    flex-wrap: wrap;
  }

  .inventory-insights-grid {
    grid-template-columns: 1fr;
  }
}
</style>
