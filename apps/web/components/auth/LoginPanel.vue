<script setup lang="ts">
import type { AuthConfigDto, AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import { DEV_ACCOUNT_HINTS, LOCAL_AUTH_ENABLED } from '~/utils/local-auth';
import { isSafeRedirect, storeAuthRedirect } from '~/utils/auth-redirect';

const props = defineProps<{
  redirect?: string | null;
}>();

const STAFF_ROLES = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

const route = useRoute();
const auth = useAuthStore();
const { loginWithGoogle, mockLogin, credentialLogin, redirectAfterLogin } = useAuth();
const api = useApi();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const fieldErrors = ref<{ email?: string; password?: string }>({});

const config = ref<AuthConfigDto>({ googleEnabled: false, mockEnabled: false });

try {
  config.value = await api.get<AuthConfigDto>('/auth/config');
} catch {
  /* API apagada: seguimos con login local */
}

const redirectTarget = computed(() => {
  const fromProp = props.redirect;
  const fromQuery = typeof route.query.redirect === 'string' ? route.query.redirect : null;
  const candidate = fromProp ?? fromQuery;
  return isSafeRedirect(candidate) ? candidate : null;
});

const queryError = computed(() => {
  if (route.query.error === 'forbidden') {
    return 'Tu cuenta no tiene permisos para acceder al panel de administración.';
  }
  return '';
});

function validateForm() {
  fieldErrors.value = {};
  const trimmedEmail = email.value.trim();
  const trimmedPassword = password.value;

  if (!trimmedEmail) {
    fieldErrors.value.email = 'El correo es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    fieldErrors.value.email = 'Ingresa un correo válido.';
  }

  if (!trimmedPassword) {
    fieldErrors.value.password = 'La contraseña es obligatoria.';
  } else if (trimmedPassword.length < 4) {
    fieldErrors.value.password = 'Mínimo 4 caracteres.';
  }

  return Object.keys(fieldErrors.value).length === 0;
}

function handleGoogleLogin() {
  error.value = '';
  if (redirectTarget.value) storeAuthRedirect(redirectTarget.value);
  loginWithGoogle(redirectTarget.value ?? undefined);
}

async function submitLogin(preset?: { email: string; password: string }) {
  error.value = '';
  if (preset) {
    email.value = preset.email;
    password.value = preset.password;
  }
  if (!validateForm()) return;

  loading.value = true;
  try {
    let user = null;

    if (config.value.mockEnabled) {
      const name = DEV_ACCOUNT_HINTS.find((a) => a.email === email.value.trim().toLowerCase())?.name
        ?? email.value.split('@')[0];
      user = await mockLogin(email.value, name);
    } else {
      try {
        user = await credentialLogin(email.value, password.value);
      } catch (loginErr) {
        if (LOCAL_AUTH_ENABLED) {
          user = auth.localLogin(email.value, password.value);
        } else {
          throw loginErr;
        }
      }
    }

    if (!user || !STAFF_ROLES.has(user.role)) {
      await auth.logout();
      error.value = 'Tu cuenta no tiene permisos para acceder al panel de administración.';
      return;
    }

    await navigateTo(redirectAfterLogin(user, redirectTarget.value));
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] }; message?: string };
    const msg = err.data?.message ?? err.message;
    error.value = Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo iniciar sesión.');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-card reveal visible">
    <p class="auth-eyebrow">Acceso seguro</p>
    <h1 class="auth-title">Iniciar <em>sesión</em></h1>
    <p class="auth-subtitle">
      Acceso exclusivo para el equipo administrativo de LUXTIMEE.
    </p>

    <p v-if="queryError" class="auth-alert auth-alert--warning">{{ queryError }}</p>
    <p v-if="error" class="auth-alert auth-alert--error">{{ error }}</p>

    <form class="auth-form" @submit.prevent="submitLogin()">
      <div class="auth-field">
        <label for="login-email">Correo</label>
        <UiLuxInput
          id="login-email"
          v-model="email"
          type="email"
          placeholder="alvaro@luxtime.co"
          autocomplete="email"
        />
        <p v-if="fieldErrors.email" class="auth-field-error">{{ fieldErrors.email }}</p>
      </div>

      <div class="auth-field">
        <label for="login-password">Contraseña</label>
        <UiLuxInput
          id="login-password"
          v-model="password"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
        />
        <p v-if="fieldErrors.password" class="auth-field-error">{{ fieldErrors.password }}</p>
      </div>

      <button type="submit" class="btn-primary auth-submit" :disabled="loading">
        {{ loading ? 'Ingresando…' : 'Entrar' }}
      </button>
    </form>

    <div v-if="LOCAL_AUTH_ENABLED" class="auth-quick">
      <p class="auth-quick-label">Acceso rápido (desarrollo)</p>
      <div class="auth-quick-row">
        <button
          type="button"
          class="btn-ghost"
          :disabled="loading"
          @click="submitLogin({ email: 'alvaro@luxtime.co', password: 'luxtime' })"
        >
          Super Admin
        </button>
        <button
          type="button"
          class="btn-ghost"
          :disabled="loading"
          @click="submitLogin({ email: 'lidia@luxtime.co', password: 'luxtime' })"
        >
          Admin
        </button>
      </div>
      <p class="auth-dev-hint">Contraseña dev: <strong>LUXTIMEE</strong></p>
    </div>

    <template v-if="config.googleEnabled">
      <div class="auth-divider"><span>o</span></div>
      <button
        type="button"
        class="auth-google-btn"
        :disabled="loading"
        @click="handleGoogleLogin"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continuar con Google
      </button>
    </template>

    <NuxtLink to="/" class="auth-back">← Volver al inicio</NuxtLink>
  </div>
</template>
