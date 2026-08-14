const STORAGE_KEY = 'luxtimee-theme';

export type ThemeMode = 'dark' | 'light';

function readStoredTheme(): ThemeMode {
  if (!import.meta.client) return 'dark';
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function isAdminPath(path: string) {
  return path.startsWith('/admin');
}

export function useTheme() {
  const theme = useState<ThemeMode>('luxtimee-theme', () => 'dark');

  function applyTheme(mode: ThemeMode) {
    if (!import.meta.client) return;
    theme.value = mode;
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  function applyStoredTheme() {
    if (!import.meta.client) return;
    const mode = readStoredTheme();
    theme.value = mode;
    document.documentElement.setAttribute('data-theme', mode);
  }

  function forceDarkTheme() {
    if (!import.meta.client) return;
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  function syncThemeForRoute(path: string) {
    if (!import.meta.client) return;
    if (isAdminPath(path)) {
      forceDarkTheme();
      return;
    }
    applyStoredTheme();
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    if (!import.meta.client) return;
    applyStoredTheme();
  }

  const isDark = computed(() => theme.value === 'dark');

  return {
    theme,
    isDark,
    toggleTheme,
    initTheme,
    applyTheme,
    syncThemeForRoute,
  };
}
