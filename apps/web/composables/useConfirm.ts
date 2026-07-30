export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: ((value: boolean) => void) | null;
};

const defaultState = (): ConfirmState => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  destructive: false,
  resolve: null,
});

export function useConfirm() {
  const state = useState<ConfirmState>('lux-confirm-dialog', defaultState);

  function confirm(options: string | ConfirmOptions): Promise<boolean> {
    const opts = typeof options === 'string' ? { title: options } : options;

    return new Promise((resolve) => {
      state.value = {
        open: true,
        title: opts.title,
        message: opts.message ?? '',
        confirmLabel: opts.confirmLabel ?? 'Confirmar',
        cancelLabel: opts.cancelLabel ?? 'Cancelar',
        destructive: opts.destructive ?? false,
        resolve,
      };
    });
  }

  function accept() {
    state.value.resolve?.(true);
    close();
  }

  function cancel() {
    state.value.resolve?.(false);
    close();
  }

  function close() {
    state.value.open = false;
    state.value.resolve = null;
  }

  return {
    state: readonly(state),
    confirm,
    accept,
    cancel,
    close,
  };
}
