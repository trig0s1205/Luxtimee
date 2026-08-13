<script setup lang="ts">
import type {
  CommissionConfigDto,
  HomepageConfigDto,
  PlatformConfigDto,
  ProfitConfigDto,
  WhatsappSettingDto,
} from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';
import { DEFAULT_HOMEPAGE_CONFIG } from '~/composables/useHomepageConfig';

definePageMeta({ middleware: ['admin'], keepalive: true });

const auth = useAuthStore();
const api = useApi();
const baseUrl = useApiBaseUrl();
const toast = useToast();
const { resolve: resolveMedia } = useMediaUrl();

const activeTab = ref<'cuenta' | 'plataforma' | 'index'>('cuenta');

const profile = reactive({
  name: auth.user?.name ?? '',
});

const emailForm = reactive({
  email: auth.user?.email ?? '',
  currentPassword: '',
});

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const whatsapp = reactive<WhatsappSettingDto>({ url: '', messagePrefix: '' });
const platform = reactive<PlatformConfigDto>({
  supportEmail: '',
  city: '',
  instagramUrl: '',
  tiktokUrl: '',
  facebookUrl: '',
});
const profit = reactive<ProfitConfigDto>({
  reinvestmentPercent: 35,
  ownerProfitPercent: 65,
});
const commission = reactive<CommissionConfigDto>({ percent: 5 });

const home = reactive<HomepageConfigDto>(structuredClone(DEFAULT_HOMEPAGE_CONFIG));
home.customerProof.images = Array.from({ length: 12 }, () => ({ url: '', caption: '' }));
const indexSubTab = ref<'featured' | 'founder' | 'proof' | 'statement' | 'contact'>('founder');

const profitSplitTotal = computed(() =>
  Number(profit.reinvestmentPercent || 0) + Number(profit.ownerProfitPercent || 0),
);

function syncOwnerFromReinvestment() {
  const reinvestment = Math.min(100, Math.max(0, Number(profit.reinvestmentPercent) || 0));
  profit.reinvestmentPercent = reinvestment;
  profit.ownerProfitPercent = Math.max(0, 100 - reinvestment);
}

function syncReinvestmentFromOwner() {
  const owner = Math.min(100, Math.max(0, Number(profit.ownerProfitPercent) || 0));
  profit.ownerProfitPercent = owner;
  profit.reinvestmentPercent = Math.max(0, 100 - owner);
}

const savingProfile = ref(false);
const savingEmail = ref(false);
const savingPassword = ref(false);
const savingPlatform = ref(false);
const savingIndex = ref(false);
const uploadingSlot = ref<number | null>(null);

const carouselFilled = computed(
  () => home.founder.carouselImages.filter((u) => Boolean(u?.trim())).length,
);

useAsyncData('admin-config', async () => {
  profile.name = auth.user?.name ?? '';
  emailForm.email = auth.user?.email ?? '';

  const whatsappRes = await api.get<WhatsappSettingDto>('/settings/whatsapp').catch(() => null);
  if (whatsappRes) Object.assign(whatsapp, whatsappRes);

  if (auth.isSuperAdmin) {
    const [platformRes, profitRes, commissionRes] = await Promise.all([
      api.get<PlatformConfigDto>('/settings/platform').catch(() => null),
      api.get<ProfitConfigDto>('/settings/profit').catch(() => null),
      api.get<CommissionConfigDto>('/settings/commission').catch(() => null),
    ]);
    if (platformRes) Object.assign(platform, platformRes);
    if (profitRes) {
      profit.reinvestmentPercent = profitRes.reinvestmentPercent ?? 35;
      profit.ownerProfitPercent = profitRes.ownerProfitPercent ?? (100 - profit.reinvestmentPercent);
    }
    if (commissionRes) commission.percent = commissionRes.percent;
  }

  const homepageRes = await api.get<HomepageConfigDto>('/settings/homepage').catch(() => null);
  if (homepageRes) {
    Object.assign(home.featured, homepageRes.featured);
    Object.assign(home.founder, homepageRes.founder);
    Object.assign(home.valueProps, homepageRes.valueProps);
    Object.assign(home.statement, homepageRes.statement);
    Object.assign(home.contact, homepageRes.contact);
    home.founder.carouselImages = Array.from(
      { length: 5 },
      (_, i) => homepageRes.founder.carouselImages?.[i] ?? '',
    );
    home.founder.storyParagraphs = homepageRes.founder.storyParagraphs?.length
      ? [...homepageRes.founder.storyParagraphs]
      : ['', ''];
    home.valueProps.items = homepageRes.valueProps.items?.length
      ? homepageRes.valueProps.items.map((item) => ({ ...item }))
      : [];
    if (homepageRes.customerProof) {
      Object.assign(home.customerProof, homepageRes.customerProof);
      home.customerProof.images = Array.from({ length: 12 }, (_, i) => ({
        url: homepageRes.customerProof?.images?.[i]?.url ?? '',
        caption: homepageRes.customerProof?.images?.[i]?.caption ?? '',
      }));
    }
  }

  return true;
}, { lazy: true });

async function saveProfile() {
  savingProfile.value = true;
  try {
    const res = await api.patch<{ user: typeof auth.user }>('/auth/me', {
      name: profile.name.trim(),
    });
    if (res.user) auth.setUser(res.user, auth.isLocalSession);
    toast.success('Perfil actualizado.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo actualizar el perfil.'));
  } finally {
    savingProfile.value = false;
  }
}

async function saveEmail() {
  savingEmail.value = true;
  try {
    const res = await api.patch<{ user: typeof auth.user }>('/auth/me/email', {
      email: emailForm.email.trim(),
      currentPassword: emailForm.currentPassword || undefined,
    });
    if (res.user) auth.setUser(res.user, false);
    emailForm.currentPassword = '';
    toast.success('Correo actualizado.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo cambiar el correo.'));
  } finally {
    savingEmail.value = false;
  }
}

async function savePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    toast.warning('Las contraseñas no coinciden.');
    return;
  }
  savingPassword.value = true;
  try {
    await api.patch('/auth/me/password', {
      currentPassword: passwordForm.currentPassword || undefined,
      newPassword: passwordForm.newPassword,
    });
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    toast.success('Contraseña actualizada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo cambiar la contraseña.'));
  } finally {
    savingPassword.value = false;
  }
}

async function savePlatformSettings() {
  if (profitSplitTotal.value !== 100) {
    toast.warning('Reinversión y ganancia libre deben sumar 100%.');
    return;
  }

  savingPlatform.value = true;
  try {
    await Promise.all([
      api.patch('/settings/whatsapp', { ...whatsapp }),
      api.patch('/settings/platform', { ...platform }),
      api.patch('/settings/profit', {
        reinvestmentPercent: Number(profit.reinvestmentPercent),
        ownerProfitPercent: Number(profit.ownerProfitPercent),
      }),
      api.patch('/settings/commission', { percent: Number(commission.percent) }),
    ]);
    toast.success('Configuración de plataforma guardada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar la configuración.'));
  } finally {
    savingPlatform.value = false;
  }
}

async function saveIndexSettings() {
  if (home.founder.enabled && carouselFilled.value !== 5) {
    toast.warning('Debes cargar exactamente 5 fotos para el carrusel del fundador.');
    return;
  }

  savingIndex.value = true;
  try {
    await api.patch('/settings/homepage', {
      featured: { ...home.featured },
      founder: {
        ...home.founder,
        carouselImages: [...home.founder.carouselImages],
        storyParagraphs: [...home.founder.storyParagraphs],
      },
      valueProps: {
        ...home.valueProps,
        items: home.valueProps.items.map((item) => ({ ...item })),
      },
      customerProof: {
        ...home.customerProof,
        images: home.customerProof.images
          .filter((img) => img.url?.trim())
          .map((img) => ({
            url: img.url.trim(),
            caption: img.caption?.trim() || undefined,
          })),
      },
      statement: { ...home.statement },
      contact: { ...home.contact },
    });
    toast.success('Configuración Index guardada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar el Index.'));
  } finally {
    savingIndex.value = false;
  }
}

function addParagraph() {
  home.founder.storyParagraphs.push('');
}

function removeParagraph(i: number) {
  home.founder.storyParagraphs.splice(i, 1);
}

function addValueProp() {
  home.valueProps.items.push({ icon: '✦', title: '', description: '' });
}

function removeValueProp(i: number) {
  home.valueProps.items.splice(i, 1);
}

async function uploadCarouselSlot(slot: number, file: File) {
  uploadingSlot.value = slot;
  try {
    const fd = new FormData();
    fd.append('images', file);
    const res = await $fetch<{ urls: string[] }>(
      `${baseUrl}/settings/homepage/upload-founder-images`,
      { method: 'POST', body: fd, credentials: 'include' },
    );
    const url = res.urls[0];
    if (!url) throw new Error('Sin URL');
    const prev = home.founder.carouselImages[slot];
    home.founder.carouselImages[slot] = url;
    if (prev && prev !== url) {
      await api.del(`/settings/homepage/founder-image?url=${encodeURIComponent(prev)}`).catch(() => null);
    }
    toast.success(slot === 0 ? 'Foto principal actualizada.' : `Foto ${slot + 1} actualizada.`);
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'Error al subir la imagen.'));
  } finally {
    uploadingSlot.value = null;
  }
}

function onSlotFileChange(slot: number, e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void uploadCarouselSlot(slot, file);
  input.value = '';
}

async function clearCarouselSlot(slot: number) {
  const prev = home.founder.carouselImages[slot];
  home.founder.carouselImages[slot] = '';
  if (prev) {
    await api.del(`/settings/homepage/founder-image?url=${encodeURIComponent(prev)}`).catch(() => null);
  }
}

const uploadingSignature = ref(false);

async function uploadSignatureImage(file: File) {
  uploadingSignature.value = true;
  try {
    const fd = new FormData();
    fd.append('images', file);
    const res = await $fetch<{ urls: string[] }>(
      `${baseUrl}/settings/homepage/upload-founder-images`,
      { method: 'POST', body: fd, credentials: 'include' },
    );
    const url = res.urls[0];
    if (!url) throw new Error('Sin URL');
    const prev = home.founder.signatureImageUrl;
    home.founder.signatureImageUrl = url;
    if (prev && prev !== url) {
      await api.del(`/settings/homepage/founder-image?url=${encodeURIComponent(prev)}`).catch(() => null);
    }
    toast.success('Foto de firma actualizada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'Error al subir la foto de firma.'));
  } finally {
    uploadingSignature.value = false;
  }
}

function onSignatureFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void uploadSignatureImage(file);
  input.value = '';
}

async function clearSignatureImage() {
  const prev = home.founder.signatureImageUrl;
  home.founder.signatureImageUrl = '';
  if (prev) {
    await api.del(`/settings/homepage/founder-image?url=${encodeURIComponent(prev)}`).catch(() => null);
  }
}

useSeoMeta({ title: 'Configuración — LUXTIMEE Admin' });
</script>

<template>
  <div class="admin-config" :class="{ 'admin-config--wide': activeTab === 'index' }">
    <UiToastContainer />
    <UiSectionHeader label="Sistema" title="Configuración" />

    <div class="admin-config-tabs">
      <button
        type="button"
        class="admin-config-tab"
        :class="{ 'admin-config-tab--active': activeTab === 'cuenta' }"
        @click="activeTab = 'cuenta'"
      >
        Mi cuenta
      </button>
      <button
        v-if="auth.isSuperAdmin"
        type="button"
        class="admin-config-tab"
        :class="{ 'admin-config-tab--active': activeTab === 'plataforma' }"
        @click="activeTab = 'plataforma'"
      >
        Plataforma
      </button>
      <button
        type="button"
        class="admin-config-tab"
        :class="{ 'admin-config-tab--active': activeTab === 'index' }"
        @click="activeTab = 'index'"
      >
        Index
      </button>
    </div>

    <!-- CUENTA -->
    <div v-if="activeTab === 'cuenta'" class="admin-config-panels">
      <section class="admin-config-card">
        <h2>Datos personales</h2>
        <div class="admin-config-fields">
          <label>
            <span>Nombre</span>
            <UiLuxInput v-model="profile.name" placeholder="Tu nombre" />
          </label>
        </div>
        <UiLuxButton :disabled="savingProfile" @click="saveProfile">
          {{ savingProfile ? 'Guardando...' : 'Guardar perfil' }}
        </UiLuxButton>
      </section>

      <section class="admin-config-card">
        <h2>Cambiar correo</h2>
        <p class="admin-config-hint">Si ya tienes contraseña, debes confirmarla para cambiar el correo.</p>
        <div class="admin-config-fields">
          <label>
            <span>Nuevo correo</span>
            <UiLuxInput v-model="emailForm.email" type="email" placeholder="correo@luxtime.co" />
          </label>
          <label>
            <span>Contraseña actual</span>
            <UiLuxInput v-model="emailForm.currentPassword" type="password" />
          </label>
        </div>
        <UiLuxButton :disabled="savingEmail" @click="saveEmail">
          {{ savingEmail ? 'Guardando...' : 'Actualizar correo' }}
        </UiLuxButton>
      </section>

      <section class="admin-config-card">
        <h2>Cambiar contraseña</h2>
        <p class="admin-config-hint">Mínimo 6 caracteres. Si es tu primera vez, deja vacía la contraseña actual.</p>
        <div class="admin-config-fields">
          <label>
            <span>Contraseña actual</span>
            <UiLuxInput v-model="passwordForm.currentPassword" type="password" />
          </label>
          <label>
            <span>Nueva contraseña</span>
            <UiLuxInput v-model="passwordForm.newPassword" type="password" />
          </label>
          <label>
            <span>Confirmar contraseña</span>
            <UiLuxInput v-model="passwordForm.confirmPassword" type="password" />
          </label>
        </div>
        <UiLuxButton :disabled="savingPassword" @click="savePassword">
          {{ savingPassword ? 'Guardando...' : 'Actualizar contraseña' }}
        </UiLuxButton>
      </section>
    </div>

    <!-- PLATAFORMA -->
    <div v-else-if="activeTab === 'plataforma' && auth.isSuperAdmin" class="admin-config-panels">
      <section class="admin-config-card">
        <h2>WhatsApp comercial</h2>
        <div class="admin-config-fields">
          <label>
            <span>URL wa.me</span>
            <UiLuxInput v-model="whatsapp.url" placeholder="https://wa.me/573000000000" />
          </label>
          <label>
            <span>Prefijo del mensaje</span>
            <UiLuxInput v-model="whatsapp.messagePrefix" placeholder="Hola LUXTIMEE, deseo comprar:" />
          </label>
        </div>
      </section>

      <section class="admin-config-card">
        <h2>Marca y contacto público</h2>
        <div class="admin-config-fields">
          <label>
            <span>Correo de soporte</span>
            <UiLuxInput v-model="platform.supportEmail" type="email" placeholder="help@luxtime.co" />
          </label>
          <label>
            <span>Ciudad / ubicación</span>
            <UiLuxInput v-model="platform.city" placeholder="Piedecuesta, Santander — Colombia" />
          </label>
          <label>
            <span>Instagram</span>
            <UiLuxInput v-model="platform.instagramUrl" placeholder="https://www.instagram.com/LUXTIMEE" />
          </label>
          <label>
            <span>TikTok</span>
            <UiLuxInput v-model="platform.tiktokUrl" placeholder="https://www.tiktok.com/@LUXTIMEE" />
          </label>
          <label>
            <span>Facebook</span>
            <UiLuxInput v-model="platform.facebookUrl" placeholder="https://www.facebook.com/LUXTIMEE" />
          </label>
        </div>
      </section>

      <section class="admin-config-card">
        <h2>Finanzas y dashboard de ganancia</h2>
        <p class="admin-config-hint">
          Estos porcentajes alimentan el dashboard de ganancia. Los cambios aplican de inmediato en los cálculos del periodo.
        </p>
        <div class="admin-config-fields admin-config-fields--grid">
          <label>
            <span>% Comisión secretaría</span>
            <UiLuxInput v-model="commission.percent" type="number" min="0" max="100" step="0.01" />
          </label>
          <label>
            <span>% Fondo de reinversión</span>
            <UiLuxInput
              v-model="profit.reinvestmentPercent"
              type="number"
              min="0"
              max="100"
              @change="syncOwnerFromReinvestment"
            />
          </label>
          <label>
            <span>% Ganancia libre del dueño</span>
            <UiLuxInput
              v-model="profit.ownerProfitPercent"
              type="number"
              min="0"
              max="100"
              @change="syncReinvestmentFromOwner"
            />
          </label>
        </div>
        <p class="admin-config-hint" :class="{ 'admin-config-hint--warn': profitSplitTotal !== 100 }">
          Reparto de ganancia neta: {{ profitSplitTotal }}% (debe ser 100%).
          La comisión se calcula sobre el margen bruto (ingresos − costos) y se sincroniza con el inventario.
        </p>
      </section>

      <section class="admin-config-card admin-config-card--links">
        <h2>Accesos rápidos</h2>
        <div class="admin-config-links">
          <NuxtLink to="/admin/envios">Tarifas de envío</NuxtLink>
          <NuxtLink to="/admin/catalog-settings">Marcas y clases</NuxtLink>
          <NuxtLink to="/admin/garantias">Historias de garantías</NuxtLink>
          <NuxtLink to="/admin/cuidados">Plantillas de cuidados</NuxtLink>
        </div>
      </section>

      <UiLuxButton :disabled="savingPlatform" @click="savePlatformSettings">
        {{ savingPlatform ? 'Guardando...' : 'Guardar configuración de plataforma' }}
      </UiLuxButton>
    </div>

    <!-- INDEX -->
    <div v-else-if="activeTab === 'index'" class="admin-config-panels">
      <div class="admin-index-subtabs">
        <button
          v-for="tab in [
            { id: 'founder', label: 'Fundador' },
            { id: 'featured', label: 'Colección' },
            { id: 'proof', label: 'Reseñas visuales' },
            { id: 'statement', label: 'Statement' },
            { id: 'contact', label: 'Contacto' },
          ]"
          :key="tab.id"
          type="button"
          class="admin-config-tab admin-config-tab--sub"
          :class="{ 'admin-config-tab--active': indexSubTab === tab.id }"
          @click="indexSubTab = tab.id as typeof indexSubTab"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Fundador -->
      <template v-if="indexSubTab === 'founder'">
        <section class="admin-config-card">
          <div class="admin-card-head">
            <h2>Quién es LUXTIMEE</h2>
            <label class="admin-toggle-label">
              <input v-model="home.founder.enabled" type="checkbox" />
              Activo
            </label>
          </div>
          <div class="admin-config-fields">
            <label>
              <span>Badge</span>
              <UiLuxInput v-model="home.founder.badge" />
            </label>
            <label>
              <span>Título</span>
              <UiLuxInput v-model="home.founder.title" />
            </label>
            <label>
              <span>Título cursiva</span>
              <UiLuxInput v-model="home.founder.titleEm" />
            </label>
            <label>
              <span>Cita</span>
              <textarea v-model="home.founder.quote" class="admin-textarea" rows="2" />
            </label>
            <label>
              <span>Firma — nombre</span>
              <UiLuxInput v-model="home.founder.signatureName" />
            </label>
            <label>
              <span>Firma — rol</span>
              <UiLuxInput v-model="home.founder.signatureRole" />
            </label>
          </div>

          <div class="admin-signature-photo">
            <span class="admin-field-group-label">Foto circular de firma</span>
            <div class="admin-signature-photo-row">
              <div class="admin-signature-photo-preview">
                <img
                  v-if="home.founder.signatureImageUrl"
                  :src="resolveMedia(home.founder.signatureImageUrl)"
                  alt="Firma"
                />
                <span v-else>LX</span>
              </div>
              <div class="admin-signature-photo-actions">
                <label class="admin-file-btn">
                  {{ uploadingSignature ? 'Subiendo...' : (home.founder.signatureImageUrl ? 'Cambiar' : 'Subir foto') }}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    :disabled="uploadingSignature"
                    @change="onSignatureFileChange"
                  />
                </label>
                <button
                  v-if="home.founder.signatureImageUrl"
                  type="button"
                  class="admin-icon-btn"
                  @click="clearSignatureImage"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="admin-field-group">
            <span class="admin-field-group-label">Historia (párrafos)</span>
            <div
              v-for="(_, i) in home.founder.storyParagraphs"
              :key="i"
              class="admin-paragraph-row"
            >
              <textarea v-model="home.founder.storyParagraphs[i]" class="admin-textarea" rows="3" />
              <button type="button" class="admin-icon-btn" @click="removeParagraph(i)">✕</button>
            </div>
            <button type="button" class="admin-add-btn" @click="addParagraph">+ Párrafo</button>
          </div>
        </section>

        <section class="admin-config-card">
          <h2>Carrusel coverflow (5 fotos obligatorias)</h2>
          <p class="admin-config-hint">
            La foto 1 es la principal (aparece primero). Luego gira suavemente hacia la izquierda.
            Progreso: {{ carouselFilled }} / 5
          </p>
          <div class="admin-carousel-slots">
            <div
              v-for="(img, i) in home.founder.carouselImages"
              :key="i"
              class="admin-carousel-slot"
              :class="{ 'admin-carousel-slot--main': i === 0, 'admin-carousel-slot--filled': Boolean(img) }"
            >
              <span class="admin-carousel-slot-label">
                {{ i === 0 ? 'Principal' : `Foto ${i + 1}` }}
              </span>
              <div class="admin-carousel-slot-preview">
                <img v-if="img" :src="resolveMedia(img)" :alt="`Slot ${i + 1}`" />
                <span v-else class="admin-carousel-slot-empty">Sin imagen</span>
              </div>
              <div class="admin-carousel-slot-actions">
                <label class="admin-file-btn">
                  {{ uploadingSlot === i ? 'Subiendo...' : (img ? 'Cambiar' : 'Subir') }}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    :disabled="uploadingSlot !== null"
                    @change="onSlotFileChange(i, $event)"
                  />
                </label>
                <button
                  v-if="img"
                  type="button"
                  class="admin-icon-btn"
                  @click="clearCarouselSlot(i)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- Colección -->
      <section v-else-if="indexSubTab === 'featured'" class="admin-config-card">
        <div class="admin-card-head">
          <h2>Sección Colección</h2>
          <label class="admin-toggle-label">
            <input v-model="home.featured.enabled" type="checkbox" />
            Activo
          </label>
        </div>
        <div class="admin-config-fields">
          <label><span>Label</span><UiLuxInput v-model="home.featured.label" /></label>
          <label><span>Título</span><UiLuxInput v-model="home.featured.titleLead" /></label>
          <label><span>Título cursiva</span><UiLuxInput v-model="home.featured.titleEm" /></label>
          <label>
            <span>Intro</span>
            <textarea v-model="home.featured.intro" class="admin-textarea" rows="3" />
          </label>
          <label><span>CTA texto</span><UiLuxInput v-model="home.featured.ctaText" /></label>
          <label><span>CTA link</span><UiLuxInput v-model="home.featured.ctaLink" /></label>
        </div>
      </section>

      <!-- Reseñas visuales -->
      <section v-else-if="indexSubTab === 'proof'" class="admin-config-card">
        <div class="admin-card-head">
          <h2>Reseñas visuales (index)</h2>
          <label class="admin-toggle-label">
            <input v-model="home.customerProof.enabled" type="checkbox" />
            Activo
          </label>
        </div>
        <p class="admin-config-hint">
          Pega URLs de Cloudinary externo (cuenta dedicada). No se suben archivos al servidor LUXTIMEE.
        </p>
        <div class="admin-config-fields">
          <label><span>Label</span><UiLuxInput v-model="home.customerProof.label" /></label>
          <label><span>Título</span><UiLuxInput v-model="home.customerProof.title" /></label>
          <label><span>Título cursiva</span><UiLuxInput v-model="home.customerProof.titleEm" /></label>
          <label>
            <span>Subtítulo</span>
            <textarea v-model="home.customerProof.subtitle" class="admin-textarea" rows="2" />
          </label>
        </div>
        <div class="admin-field-group">
          <span class="admin-field-group-label">Imágenes (URL + caption opcional)</span>
          <div
            v-for="(img, i) in home.customerProof.images"
            :key="i"
            class="admin-proof-row"
          >
            <span class="admin-proof-row__index">{{ i + 1 }}</span>
            <UiLuxInput v-model="img.url" placeholder="https://res.cloudinary.com/..." />
            <UiLuxInput v-model="img.caption" placeholder="Ej: Entrega en Bogotá" />
          </div>
        </div>
      </section>

      <!-- Statement -->
      <section v-else-if="indexSubTab === 'statement'" class="admin-config-card">
        <div class="admin-card-head">
          <h2>Statement</h2>
          <label class="admin-toggle-label">
            <input v-model="home.statement.enabled" type="checkbox" />
            Activo
          </label>
        </div>
        <div class="admin-config-fields">
          <label><span>Texto</span><UiLuxInput v-model="home.statement.text" /></label>
          <label><span>Énfasis</span><UiLuxInput v-model="home.statement.textEm" /></label>
          <label><span>Sub</span><UiLuxInput v-model="home.statement.sub" /></label>
        </div>
      </section>

      <!-- Contacto -->
      <section v-else-if="indexSubTab === 'contact'" class="admin-config-card">
        <div class="admin-card-head">
          <h2>Contacto</h2>
          <label class="admin-toggle-label">
            <input v-model="home.contact.enabled" type="checkbox" />
            Activo
          </label>
        </div>
        <div class="admin-config-fields">
          <label><span>Label</span><UiLuxInput v-model="home.contact.label" /></label>
          <label><span>Título</span><UiLuxInput v-model="home.contact.title" /></label>
          <label><span>Título cursiva</span><UiLuxInput v-model="home.contact.titleEm" /></label>
          <label>
            <span>Cuerpo</span>
            <textarea v-model="home.contact.body" class="admin-textarea" rows="3" />
          </label>
          <label><span>CTA</span><UiLuxInput v-model="home.contact.ctaText" /></label>
          <label><span>Mensaje WhatsApp</span><UiLuxInput v-model="home.contact.whatsappMessage" /></label>
        </div>
      </section>

      <div class="admin-index-save">
        <UiLuxButton :disabled="savingIndex" @click="saveIndexSettings">
          {{ savingIndex ? 'Guardando...' : 'Guardar Index' }}
        </UiLuxButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-config {
  max-width: 760px;
}

.admin-config--wide {
  max-width: 980px;
}

.admin-config-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.admin-config-tab {
  padding: 10px 18px;
  background: transparent;
  border: var(--border-hairline);
  color: var(--lux-white-dim);
  font-family: var(--lux-font-body);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.admin-config-tab--active {
  color: var(--lux-gold);
  border-color: rgba(200, 169, 110, 0.35);
}

.admin-config-tab--sub {
  padding: 8px 14px;
  font-size: 10px;
}

.admin-index-subtabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.admin-config-panels {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-config-card {
  padding: 22px;
  border: var(--border-hairline);
  background: rgba(255, 255, 255, 0.02);
}

.admin-config-card h2 {
  margin: 0 0 16px;
  font-family: var(--lux-font-display);
  font-size: 22px;
  font-weight: 400;
  color: var(--lux-white);
}

.admin-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 8px;
}

.admin-card-head h2 {
  margin: 0;
}

.admin-toggle-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  color: var(--lux-white-dim);
  cursor: pointer;
}

.admin-config-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.admin-config-fields--grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.admin-config-fields label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-config-fields label span,
.admin-field-group-label {
  font-family: var(--lux-font-body);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lux-white-dim);
}

.admin-config-hint {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lux-white-dim);
}

.admin-config-hint--warn {
  color: #e8c97a;
}

.admin-config-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.admin-config-links a {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lux-gold);
  text-decoration: none;
}

.admin-textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--lux-white);
  padding: 0.625rem 0.875rem;
  font-family: var(--lux-font-body);
  font-size: 0.875rem;
  resize: vertical;
  outline: none;
}

.admin-textarea:focus {
  border-color: rgba(200, 169, 110, 0.45);
}

.admin-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.admin-paragraph-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.admin-paragraph-row .admin-textarea {
  flex: 1;
}

.admin-icon-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: var(--lux-white-dim);
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  font-size: 0.75rem;
}

.admin-icon-btn:hover {
  border-color: rgba(220, 53, 69, 0.4);
  color: #f87171;
}

.admin-add-btn {
  align-self: flex-start;
  background: transparent;
  border: 1px dashed rgba(200, 169, 110, 0.4);
  border-radius: 4px;
  color: var(--lux-gold);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.5rem 1rem;
}

.admin-valueprop-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.admin-signature-photo {
  margin: 0 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.admin-signature-photo-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.admin-signature-photo-preview {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(200, 169, 110, 0.4);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(200, 169, 110, 0.08);
  font-family: var(--lux-font-display);
  font-size: 0.85rem;
  color: var(--lux-gold);
  flex-shrink: 0;
}

.admin-signature-photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-signature-photo-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.admin-carousel-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.admin-carousel-slot {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-carousel-slot--main {
  border-color: rgba(200, 169, 110, 0.45);
}

.admin-carousel-slot-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lux-gold);
}

.admin-carousel-slot-preview {
  aspect-ratio: 3 / 4;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 2px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-carousel-slot-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-carousel-slot-empty {
  font-size: 11px;
  color: var(--lux-white-dim);
  opacity: 0.6;
}

.admin-carousel-slot-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.admin-proof-row {
  display: grid;
  grid-template-columns: 28px 1fr 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.admin-proof-row__index {
  font-size: 11px;
  color: var(--lux-white-dim);
  text-align: center;
}

.admin-file-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  border: 1px solid rgba(200, 169, 110, 0.35);
  color: var(--lux-gold);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.admin-file-btn input {
  display: none;
}

.admin-index-save {
  position: sticky;
  bottom: 0;
  padding: 12px 0 4px;
  background: linear-gradient(to top, var(--lux-black, #0a0a0a) 60%, transparent);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .admin-config-fields--grid {
    grid-template-columns: 1fr;
  }
}
</style>



