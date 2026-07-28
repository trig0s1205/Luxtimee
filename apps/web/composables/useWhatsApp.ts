import type { WhatsappSettingDto } from '@luxtime/shared';

function isValidWaUrl(url?: string | null) {
  if (!url?.trim()) return false;
  const normalized = url.trim();
  if (normalized === 'https://wa.me/' || normalized === 'https://wa.me') return false;
  return normalized.startsWith('https://wa.me/') || normalized.startsWith('http://wa.me/');
}

export function useWhatsApp() {
  const api = useApi();
  const toast = useToast();
  const settings = useState<WhatsappSettingDto | null>('whatsapp-public', () => null);
  const loaded = useState('whatsapp-public-loaded', () => false);

  async function loadSettings() {
    if (loaded.value) return settings.value;
    try {
      settings.value = await api.get<WhatsappSettingDto>('/settings/whatsapp/public');
    } catch {
      settings.value = null;
    } finally {
      loaded.value = true;
    }
    return settings.value;
  }

  function buildUrl(message?: string) {
    const url = settings.value?.url;
    if (!isValidWaUrl(url)) return null;
    const base = url!.trim();
    if (!message?.trim()) return base;
    const prefix = settings.value?.messagePrefix?.trim();
    const text = prefix ? `${prefix} ${message}`.trim() : message.trim();
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}text=${encodeURIComponent(text)}`;
  }

  async function openChat(message?: string) {
    await loadSettings();
    const target = buildUrl(message);
    if (!target) {
      toast.warning('WhatsApp no está configurado. Escríbenos desde la sección de contacto.');
      return false;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
    return true;
  }

  const hasWhatsApp = computed(() => isValidWaUrl(settings.value?.url));

  return {
    settings: readonly(settings),
    hasWhatsApp,
    loadSettings,
    buildUrl,
    openChat,
  };
}
