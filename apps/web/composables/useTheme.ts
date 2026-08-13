const STORAGE_KEY = 'luxtimee-theme';

export type ThemeMode = 'dark' | 'light';

export function useTheme() {
  const theme = useState<ThemeMode>('luxtimee-theme', () => 'dark');

  function applyTheme(mode: ThemeMode) {
    if (!import.meta.client) return;
    theme.value = mode;
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    if (!import.meta.client) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const mode: ThemeMode = stored === 'light' ? 'light' : 'dark';
    applyTheme(mode);
  }

  const isDark = computed(() => theme.value === 'dark');

  return { theme, isDark, toggleTheme, initTheme, applyTheme };
}
