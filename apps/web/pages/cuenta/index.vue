<script setup lang="ts">
definePageMeta({ middleware: ['customer'], layout: 'account' });

const auth = useAuthStore();
const { t } = useLocale();

const displayName = computed(() => auth.user?.name ?? 'Carlos Mendoza');

const activeOrder = ref({
  id: 'LT-84920',
  model: 'Rolex Submariner Date',
  image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=160&h=160&fit=crop',
  currentStep: 1,
});

const activeWarranty = ref({
  model: 'Patek Philippe Nautilus',
  ref: 'Ref. 5711',
  monthsLeft: 18,
  coveragePercent: 75,
});

const wishlist = ref([
  {
    id: '1',
    brand: 'Audemars Piguet',
    model: 'Royal Oak',
    slug: 'audemars-piguet-royal-oak',
    image: 'https://images.unsplash.com/photo-1547996160-81dfaaffebfe?w=100&h=100&fit=crop',
  },
  {
    id: '2',
    brand: 'Omega',
    model: 'Speedmaster',
    slug: 'omega-speedmaster',
    image: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=100&h=100&fit=crop',
  },
]);

const savedProfile = ref({
  addressLines: ['Carrera 15 # 93-47', 'Chicó Norte', 'Bogotá, Colombia'],
  phone: '+57 *** *** 4589',
});

const orderSteps = computed(() => [
  { key: 'processing', label: t('account.stepProcessing'), state: 'filled' as const },
  { key: 'shipped', label: t('account.stepShipped'), state: 'hollow' as const },
  { key: 'delivered', label: t('account.stepDelivered'), state: 'inactive' as const },
]);

async function handleLogout() {
  await auth.logout();
  await navigateTo('/');
}

useSeoMeta({ title: 'Club Élite — Luxtime' });
</script>

<template>
  <div class="elite-portal">
    <header class="elite-portal-header">
      <div>
        <h1 class="elite-portal-title">{{ t('account.hello') }}, {{ displayName }}</h1>
        <p class="elite-portal-subtitle">{{ t('account.eliteSubtitle') }}</p>
      </div>
      <div class="elite-member-badge">★ {{ t('account.memberBadge') }}</div>
    </header>

    <div class="elite-grid">
      <div class="elite-main">
        <section class="elite-card">
          <h2 class="elite-card-title">{{ t('account.activeOrders') }}</h2>
          <div class="elite-order-row">
            <div class="elite-order-thumb">
              <img :src="activeOrder.image" :alt="activeOrder.model" loading="lazy">
            </div>
            <div class="elite-order-body">
              <div class="elite-order-top">
                <div>
                  <p class="elite-order-name">{{ activeOrder.model }}</p>
                  <p class="elite-order-id">{{ t('account.order') }} #{{ activeOrder.id }}</p>
                </div>
                <NuxtLink :to="`/cuenta/pedidos`" class="elite-link">{{ t('account.viewDetails') }}</NuxtLink>
              </div>
              <div class="elite-stepper">
                <div class="elite-stepper-track">
                  <div class="elite-stepper-track-fill" />
                </div>
                <div class="elite-stepper-steps">
                  <div v-for="step in orderSteps" :key="step.key" class="elite-step">
                    <span
                      class="elite-step-dot"
                      :class="{
                        filled: step.state === 'filled',
                        hollow: step.state === 'hollow',
                        inactive: step.state === 'inactive',
                      }"
                    />
                    <span
                      class="elite-step-label"
                      :class="{ active: step.state !== 'inactive' }"
                    >
                      {{ step.label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="elite-card">
          <h2 class="elite-card-title">{{ t('account.activeWarranties') }}</h2>
          <p class="elite-warranty-name">{{ activeWarranty.model }}</p>
          <p class="elite-warranty-ref">{{ activeWarranty.ref }}</p>
          <div class="elite-warranty-header">
            <span class="elite-warranty-label">{{ t('account.remainingCoverage') }}</span>
            <span class="elite-warranty-months">{{ activeWarranty.monthsLeft }} {{ t('account.months') }}</span>
          </div>
          <div class="elite-progress-bar">
            <div
              class="elite-progress-fill"
              :style="{ width: `${activeWarranty.coveragePercent}%` }"
            />
          </div>
          <NuxtLink to="/cuenta/garantias" class="elite-btn-outline">{{ t('account.requestSupport') }}</NuxtLink>
        </section>
      </div>

      <aside class="elite-side">
        <section class="elite-card">
          <h2 class="elite-card-title">{{ t('account.wishlistTitle') }}</h2>
          <article v-for="item in wishlist" :key="item.id" class="elite-wishlist-item">
            <div class="elite-wishlist-thumb">
              <img :src="item.image" :alt="`${item.brand} ${item.model}`" loading="lazy">
            </div>
            <div>
              <p class="elite-wishlist-brand">{{ item.brand }}</p>
              <p class="elite-wishlist-model">{{ item.model }}</p>
              <NuxtLink :to="`/producto/${item.slug}`" class="elite-link">{{ t('account.viewWatch') }}</NuxtLink>
            </div>
          </article>
        </section>

        <section class="elite-card">
          <h2 class="elite-card-title">{{ t('account.savedData') }}</h2>
          <div class="elite-saved-block">
            <p class="elite-saved-label">{{ t('account.mainAddress') }}</p>
            <p class="elite-saved-text">
              <span v-for="(line, i) in savedProfile.addressLines" :key="i">
                {{ line }}<br v-if="i < savedProfile.addressLines.length - 1">
              </span>
            </p>
          </div>
          <div class="elite-saved-block">
            <p class="elite-saved-label">{{ t('account.securePhone') }}</p>
            <p class="elite-saved-text">{{ savedProfile.phone }}</p>
          </div>
          <NuxtLink to="/cuenta/datos" class="elite-btn-outline full">{{ t('account.editProfile') }}</NuxtLink>
        </section>
      </aside>
    </div>

    <button type="button" class="elite-logout" @click="handleLogout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      {{ t('account.logout') }}
    </button>
  </div>
</template>
