<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { LUXTIMEE_EXPERIENCE_ITEMS } from '~/constants/luxtime-experience';
import { pickRandomWatches } from '~/utils/similar-watches';

const { open, slug, closeProduct } = useProductModal();
const catalog = useCatalogData();
const cart = useCartStore();

const product = ref<WatchPublicDto | null>(null);
const loading = ref(false);
const randomWatches = ref<WatchPublicDto[]>([]);
const { watchPrimaryImage } = useMediaUrl();

watch(slug, async (s) => {
  if (!s) {
    product.value = null;
    randomWatches.value = [];
    return;
  }
  loading.value = true;
  try {
    product.value = await catalog.getBySlug(s);
    const pool = (await catalog.listCatalog({ limit: 80, available: 'true' })).data;
    randomWatches.value = pickRandomWatches(product.value, pool, 12, `modal-${s}`);
  } catch {
    product.value = null;
    randomWatches.value = [];
    closeProduct();
  } finally {
    loading.value = false;
  }
});

function addToCart() {
  if (!product.value) return;
  cart.addFromWatch(product.value);
  closeProduct();
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeProduct();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) closeProduct();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="product-detail-modal"
      @click="onOverlayClick"
    >
      <div class="product-detail-content product-detail-content--scroll">
        <button type="button" class="detail-close-btn" aria-label="Cerrar" @click="closeProduct">×</button>
        <div v-if="loading" class="detail-loading">Cargando…</div>
        <div v-else-if="product" class="detail-wrapper">
          <div class="detail-image-col">
            <div id="detail-image-container" class="detail-image-box">
              <img
                v-if="watchPrimaryImage(product)"
                :src="watchPrimaryImage(product)"
                :alt="`${product.brand.name} ${product.model}`"
                class="product-real-img"
              >
            </div>
          </div>
          <div class="detail-info-col">
            <p v-if="product.stock <= 3 && product.stock > 0" id="detail-badge" class="detail-badge">Edición limitada</p>
            <h2 id="detail-title" class="detail-title">{{ product.brand.name }} {{ product.model }}</h2>
            <p id="detail-category" class="detail-category">{{ product.movementType }}</p>
            <p id="detail-ref" class="detail-ref">Ref. {{ product.slug }}</p>
            <p id="detail-price" class="detail-price">{{ formatCop(product.retailPrice) }}</p>
            <div class="detail-actions">
              <button type="button" class="btn-add-to-cart" :disabled="product.stock === 0" @click="addToCart">
                Agregar al carrito
              </button>
              <NuxtLink
                :to="`/producto/${product.slug}`"
                class="btn-gallery-link"
                @click="closeProduct"
              >
                Ver fotos y video del reloj →
              </NuxtLink>
            </div>
            <div class="detail-experience detail-experience--gold">
              <p class="detail-experience-title">Tu Experiencia LUXTIMEE incluye:</p>
              <ul>
                <li v-for="item in LUXTIMEE_EXPERIENCE_ITEMS" :key="item.label">{{ item.label }}</li>
              </ul>
            </div>
          </div>
        </div>

        <CatalogSimilarWatchesCarousel
          v-if="randomWatches.length"
          class="product-detail-modal__carousel"
          :watches="randomWatches"
          eyebrow="Descubre más"
          title="Otros relojes del catálogo"
          :compact="true"
        />
      </div>
    </div>
  </Teleport>
</template>
