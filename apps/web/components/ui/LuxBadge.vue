<script setup lang="ts">
defineProps<{
  tone?: 'gold' | 'limited' | 'mayorista' | 'detal' | 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado' | 'local' | 'nacional';
}>();
</script>

<template>
  <span
    class="lux-badge"
    :class="{
      'lux-badge--gold': tone === 'gold' || tone === 'limited',
      'lux-badge--mayorista': tone === 'mayorista',
      'lux-badge--detal': tone === 'detal',
      'lux-badge--pendiente': tone === 'pendiente',
      'lux-badge--pagado': tone === 'pagado',
      'lux-badge--enviado': tone === 'enviado',
      'lux-badge--entregado': tone === 'entregado',
      'lux-badge--cancelado': tone === 'cancelado',
      'lux-badge--local': tone === 'local',
      'lux-badge--nacional': tone === 'nacional',
    }"
  >
    <slot />
  </span>
</template>

<style scoped>
.lux-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 600;
  border-radius: 2px;
}

.lux-badge--gold,
.lux-badge--limited {
  background: var(--lux-gold, #c8a96e);
  color: var(--lux-black, #0a0a0a);
}

.lux-badge--mayorista {
  border: 1px solid var(--lux-gold, #c8a96e);
  color: var(--lux-gold, #c8a96e);
}

.lux-badge--detal {
  border: 1px solid var(--lux-white-dim, #888);
  color: var(--lux-white-dim, #888);
}

.lux-badge--pendiente {
  color: #e2c98a;
  background: rgba(226, 201, 138, 0.12);
  border: 1px solid rgba(226, 201, 138, 0.35);
}

.lux-badge--pagado {
  color: #4cdf8b;
  background: rgba(76, 223, 139, 0.12);
  border: 1px solid rgba(76, 223, 139, 0.35);
}

.lux-badge--enviado {
  color: #7eb8ff;
  background: rgba(126, 184, 255, 0.12);
  border: 1px solid rgba(126, 184, 255, 0.35);
}

.lux-badge--entregado {
  color: var(--lux-gold, #c8a96e);
  background: rgba(200, 169, 110, 0.15);
  border: 1px solid rgba(200, 169, 110, 0.35);
}

.lux-badge--cancelado {
  color: #ff8888;
  background: rgba(255, 136, 136, 0.1);
  border: 1px solid rgba(255, 136, 136, 0.35);
}

.lux-badge--local {
  color: #9edfff;
  background: rgba(158, 223, 255, 0.1);
  border: 1px solid rgba(158, 223, 255, 0.3);
}

.lux-badge--nacional {
  color: #c9a0ff;
  background: rgba(201, 160, 255, 0.1);
  border: 1px solid rgba(201, 160, 255, 0.3);
}
</style>
