<script setup lang="ts">
const { active, progress, bindRouter } = useStorefrontRouteProgress();
onMounted(() => bindRouter());
</script>

<template>
  <div
    class="route-progress"
    :class="{ 'route-progress--active': active }"
    aria-hidden="true"
  >
    <div
      class="route-progress__bar"
      :style="{ transform: `scaleX(${progress})` }"
    />
  </div>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  height: 2px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.route-progress--active {
  opacity: 1;
}

.route-progress__bar {
  height: 100%;
  transform-origin: left center;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--gold-light) 20%,
    var(--gold) 55%,
    var(--gold-dark) 100%
  );
  box-shadow: 0 0 18px rgba(200, 169, 110, 0.55);
  will-change: transform;
}
</style>
