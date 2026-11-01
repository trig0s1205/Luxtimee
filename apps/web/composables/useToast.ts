type ToastTone = 'success' | 'error' | 'info' | 'warning';

type ToastAction = {
  label: string;
  onClick: () => void;
};

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);

  function add(
    message: string,
    tone: ToastTone = 'info',
    options?: { sticky?: boolean; action?: ToastAction },
  ) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toasts.value.push({ id, message, tone, action: options?.action });
    if (!options?.sticky) setTimeout(() => remove(id), 4000);
    return id;
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
    show: add,
    remove,
  };
}
