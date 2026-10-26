import type { WhatsappSettingDto } from '@luxtime/shared';
import { whatsappUrlFromInput } from '@luxtime/shared';
import { openWhatsAppChat } from '~/utils/whatsapp-open';

function canonicalWaUrl(url?: string | null) {
  return whatsappUrlFromInput(url);
}

export function useWhatsApp() {
  const api = useApi();
  const toast = useToast();
  const settings = useState<WhatsappSettingDto | null>('whatsapp-public', () => null);
  const loaded = useState('whatsapp-public-loaded', () => false);

  async function loadSettings(force = false) {
    if (loaded.value && !force) return settings.value;
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
    const base = canonicalWaUrl(settings.value?.url);
    if (!base) return null;
    if (!message?.trim()) return base;
    const prefix = settings.value?.messagePrefix?.trim();
    const text = prefix ? `${prefix} ${message}`.trim() : message.trim();
    return `${base}?text=${encodeURIComponent(text)}`;
  }

  async function openChat(message?: string) {
    await loadSettings(true);
    const target = buildUrl(message);
    if (!target) {
      toast.warning('WhatsApp no está configurado. Escríbenos desde la sección de contacto.');
      return false;
    }
    openWhatsAppChat(target);
    return true;
  }

  const hasWhatsApp = computed(() => Boolean(canonicalWaUrl(settings.value?.url)));

  return {
    settings: readonly(settings),
    hasWhatsApp,
    loadSettings,
    buildUrl,
    openChat,
  };
}
