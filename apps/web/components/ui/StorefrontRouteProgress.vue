<script setup lang="ts">
const { active, progress } = useStorefrontRouteProgress();
</script>

<template>
  <Teleport to="body">
    <Transition name="route-loader-fade">
      <div
        v-if="active"
        class="route-loader"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Cargando página"
      >
        <div class="route-loader__backdrop" aria-hidden="true" />
        <div class="route-loader__card">
          <div class="route-loader__spinner" aria-hidden="true">
            <span class="route-loader__ring" />
            <span class="route-loader__logo">L</span>
          </div>
          <p class="route-loader__text">Cargando</p>
          <div class="route-loader__track" aria-hidden="true">
            <div
              class="route-loader__bar"
              :style="{ transform: `scaleX(${progress})` }"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div
    class="route-progress-top"
    :class="{ 'route-progress-top--active': active }"
    aria-hidden="true"
  >
    <div
      class="route-progress-top__bar"
      :style="{ transform: `scaleX(${progress})` }"
    />
  </div>
</template>

<style scoped>
.route-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.route-loader__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(245, 242, 235, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.route-loader__card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  min-width: min(280px, calc(100vw - 48px));
  padding: 28px 32px 24px;
  border-radius: 16px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 24px 60px rgba(20, 20, 20, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.route-loader__spinner {
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
}

.route-loader__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(200, 169, 110, 0.22);
  border-top-color: var(--gold);
  border-right-color: var(--gold-light);
  animation: routeLoaderSpin 0.85s linear infinite;
}

.route-loader__logo {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  color: var(--gold-dark);
  line-height: 1;
}

.route-loader__text {
  margin: 0;
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--white-dim);
}

.route-loader__track {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(20, 20, 20, 0.08);
}

.route-loader__bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--gold-light), var(--gold), var(--gold-dark));
  box-shadow: 0 0 12px rgba(200, 169, 110, 0.45);
  will-change: transform;
}

.route-progress-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  height: 3px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.route-progress-top--active {
  opacity: 1;
}

.route-progress-top__bar {
  height: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, transparent, var(--gold-light) 15%, var(--gold) 55%, var(--gold-dark));
  box-shadow: 0 0 20px rgba(200, 169, 110, 0.55);
  will-change: transform;
}

.route-loader-fade-enter-active,
.route-loader-fade-leave-active {
  transition: opacity 0.22s ease;
}

.route-loader-fade-enter-from,
.route-loader-fade-leave-to {
  opacity: 0;
}

@keyframes routeLoaderSpin {
  to {
    transform: rotate(360deg);
  }
}
</style>
