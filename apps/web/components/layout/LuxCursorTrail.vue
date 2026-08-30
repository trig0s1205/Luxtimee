<script setup lang="ts">
const route = useRoute();
const { open: productModalOpen } = useProductModal();
const { open: cartDrawerOpen } = useCartDrawer();

const enabled = computed(() => {
  if (!isLuxCursorTrailRoute(route.path)) return false;
  if (productModalOpen.value || cartDrawerOpen.value) return false;
  return true;
});

const { trail, hasFinePointer, reducedMotion, trailDotStyle } = useLuxCursorTrail(enabled);

const visible = computed(() =>
  enabled.value && hasFinePointer.value && !reducedMotion.value && trail.value.length > 0,
);
</script>

<template>
  <div
    v-show="visible"
    class="lux-cursor-trail"
    aria-hidden="true"
  >
    <div
      v-for="dot in trail"
      :key="dot.id"
      class="lux-cursor-trail__dot"
      :style="trailDotStyle(dot)"
    />
  </div>
</template>

<style scoped>
.lux-cursor-trail {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 45;
  overflow: hidden;
}

.lux-cursor-trail__dot {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgba(255, 244, 220, 0.42) 0%,
    rgba(226, 201, 138, 0.22) 30%,
    rgba(200, 169, 110, 0.06) 55%,
    transparent 72%
  );
  filter: blur(0.5px);
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 1023px) {
  .lux-cursor-trail {
    display: none !important;
  }
}
</style>
