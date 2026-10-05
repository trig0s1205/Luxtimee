const STORAGE_KEY = 'luxtimee-theme';

export type ThemeMode = 'light';

export function useTheme() {
  const theme = useState<ThemeMode>('luxtimee-theme', () => 'light');

  function applyTheme() {
    if (!import.meta.client) return;
    theme.value = 'light';
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.removeItem(STORAGE_KEY);
  }

  function initTheme() {
    applyTheme();
  }

  function syncThemeForRoute(_path: string) {
    applyTheme();
  }

  return { theme, initTheme, applyTheme, syncThemeForRoute };
}
