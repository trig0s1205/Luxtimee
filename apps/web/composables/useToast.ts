type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);

  function add(message: string, tone: ToastTone = 'info') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toasts.value.push({ id, message, tone });
    setTimeout(() => remove(id), 4000);
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts: readonly(toasts),
    success: (message: string) => add(message, 'success'),
    error: (message: string) => add(message, 'error'),
    warning: (message: string) => add(message, 'warning'),
    info: (message: string) => add(message, 'info'),
    remove,
  };
}
