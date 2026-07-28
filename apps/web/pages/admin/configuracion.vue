<script setup lang="ts">
import type {
  CommissionConfigDto,
  PlatformConfigDto,
  ProfitConfigDto,
  WhatsappSettingDto,
} from '@luxtime/shared';
import { extractApiErrorMessage } from '~/utils/api-error';

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'] });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();

if (!auth.loaded) await auth.fetchMe();

const activeTab = ref<'cuenta' | 'plataforma'>('cuenta');

const profile = reactive({
  name: auth.user?.name ?? '',
  phone: auth.user?.phone ?? '',
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
const profit = reactive<ProfitConfigDto>({ defaultProfitPercent: 30 });
const commission = reactive<CommissionConfigDto>({ percent: 5 });

const savingProfile = ref(false);
const savingEmail = ref(false);
const savingPassword = ref(false);
const savingPlatform = ref(false);

await useAsyncData('admin-config', async () => {
  profile.name = auth.user?.name ?? '';
  profile.phone = auth.user?.phone ?? '';
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
    if (profitRes) profit.defaultProfitPercent = profitRes.defaultProfitPercent;
    if (commissionRes) commission.percent = commissionRes.percent;
  }

  return true;
});

async function saveProfile() {
  savingProfile.value = true;
  try {
    const res = await api.patch<{ user: typeof auth.user }>('/auth/me', {
      name: profile.name.trim(),
      phone: profile.phone.trim() || undefined,
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
  savingPlatform.value = true;
  try {
    await Promise.all([
      api.patch('/settings/whatsapp', { ...whatsapp }),
      api.patch('/settings/platform', { ...platform }),
      api.patch('/settings/profit', { defaultProfitPercent: Number(profit.defaultProfitPercent) }),
      api.patch('/settings/commission', { percent: Number(commission.percent) }),
    ]);
    toast.success('Configuración de plataforma guardada.');
  } catch (err: unknown) {
    toast.error(extractApiErrorMessage(err, 'No se pudo guardar la configuración.'));
  } finally {
    savingPlatform.value = false;
  }
}

useSeoMeta({ title: 'Configuración — Luxtime Admin' });
</script>

<template>
  <div class="admin-config">
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
    </div>

    <div v-if="activeTab === 'cuenta'" class="admin-config-panels">
      <section class="admin-config-card">
        <h2>Datos personales</h2>
        <div class="admin-config-fields">
          <label>
            <span>Nombre</span>
            <UiLuxInput v-model="profile.name" placeholder="Tu nombre" />
          </label>
          <label>
            <span>Teléfono</span>
            <UiLuxInput v-model="profile.phone" placeholder="+57 300 000 0000" />
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
            <UiLuxInput v-model="emailForm.currentPassword" type="password" placeholder="••••••••" />
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
            <UiLuxInput v-model="passwordForm.currentPassword" type="password" placeholder="••••••••" />
          </label>
          <label>
            <span>Nueva contraseña</span>
            <UiLuxInput v-model="passwordForm.newPassword" type="password" placeholder="••••••••" />
          </label>
          <label>
            <span>Confirmar contraseña</span>
            <UiLuxInput v-model="passwordForm.confirmPassword" type="password" placeholder="••••••••" />
          </label>
        </div>
        <UiLuxButton :disabled="savingPassword" @click="savePassword">
          {{ savingPassword ? 'Guardando...' : 'Actualizar contraseña' }}
        </UiLuxButton>
      </section>
    </div>

    <div v-else-if="auth.isSuperAdmin" class="admin-config-panels">
      <section class="admin-config-card">
        <h2>WhatsApp comercial</h2>
        <div class="admin-config-fields">
          <label>
            <span>URL wa.me</span>
            <UiLuxInput v-model="whatsapp.url" placeholder="https://wa.me/573000000000" />
          </label>
          <label>
            <span>Prefijo del mensaje</span>
            <UiLuxInput v-model="whatsapp.messagePrefix" placeholder="Hola Luxtime, deseo comprar:" />
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
            <UiLuxInput v-model="platform.instagramUrl" placeholder="https://www.instagram.com/luxtime" />
          </label>
          <label>
            <span>TikTok</span>
            <UiLuxInput v-model="platform.tiktokUrl" placeholder="https://www.tiktok.com/@luxtime" />
          </label>
          <label>
            <span>Facebook</span>
            <UiLuxInput v-model="platform.facebookUrl" placeholder="https://www.facebook.com/luxtime" />
          </label>
        </div>
      </section>

      <section class="admin-config-card">
        <h2>Finanzas</h2>
        <div class="admin-config-fields admin-config-fields--grid">
          <label>
            <span>% Margen por defecto</span>
            <UiLuxInput v-model="profit.defaultProfitPercent" type="number" min="0" max="100" />
          </label>
          <label>
            <span>% Comisión secretaría</span>
            <UiLuxInput v-model="commission.percent" type="number" min="0" max="100" step="0.01" />
          </label>
        </div>
        <p class="admin-config-hint">
          La comisión se sincroniza con todos los relojes del inventario.
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
  </div>
</template>

<style scoped>
.admin-config {
  max-width: 760px;
}

.admin-config-tabs {
  display: flex;
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

.admin-config-fields label span {
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

@media (max-width: 640px) {
  .admin-config-fields--grid {
    grid-template-columns: 1fr;
  }
}
</style>
