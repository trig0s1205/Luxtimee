<script setup lang="ts">
import type { AppLocale } from '~/stores/locale';

const { t, locale, setLocale } = useLocale();
const open = ref(false);

const options: { value: AppLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

const currentLabel = computed(() =>
  options.find((o) => o.value === locale.value)?.label ?? 'English',
);

function pick(value: AppLocale) {
  setLocale(value);
  open.value = false;
}

function onClickOutside(e: MouseEvent) {
  const el = document.getElementById('locale-switcher');
  if (el && !el.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div id="locale-switcher" class="nav-locale">
    <button
      type="button"
      class="nav-locale-btn"
      :aria-label="t('lang.label')"
      @click.stop="open = !open"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      {{ currentLabel }}
      <span class="nav-locale-caret" :class="{ open }">▾</span>
    </button>
    <ul v-if="open" class="nav-locale-menu">
      <li v-for="opt in options" :key="opt.value">
        <button
          type="button"
          :class="{ active: locale === opt.value }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
