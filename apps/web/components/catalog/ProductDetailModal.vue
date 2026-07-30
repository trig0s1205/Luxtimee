<script setup lang="ts">
import type { WatchPublicDto } from '@luxtime/shared';
import { formatCop } from '~/utils/format';
import { LUXTIME_EXPERIENCE_ITEMS } from '~/constants/luxtime-experience';

const { open, slug, closeProduct } = useProductModal();
const catalog = useCatalogData();
const cart = useCartStore();
const { openChat } = useWhatsApp();

const product = ref<WatchPublicDto | null>(null);
const loading = ref(false);
const { watchPrimaryImage } = useMediaUrl();
watch(slug, async (s) => {
  if (!s) {
    product.value = null;
    return;
  }
  loading.value = true;
  try {
    product.value = await catalog.getBySlug(s);
  } catch {
    product.value = null;
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

async function consultWhatsApp() {
  if (!product.value) return;
  await openChat(`Me interesa: ${product.value.brand.name} ${product.value.model} (Ref. ${product.value.slug})`);
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
      <div class="product-detail-content">
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
              <button type="button" class="btn-whatsapp" @click="consultWhatsApp">
                💬 Consultar por WhatsApp
              </button>
            </div>
            <div class="detail-experience">
              <p class="detail-experience-title">Tu Experiencia Luxtime incluye:</p>
              <ul>
                <li v-for="item in LUXTIME_EXPERIENCE_ITEMS" :key="item.label">{{ item.label }}</li>
              </ul>
            </div>
            <NuxtLink :to="`/producto/${product.slug}`" class="detail-full-link" @click="closeProduct">
              Ver fotos y video del reloj →
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
