import { reactive } from 'vue';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const state = reactive<{ toasts: Toast[] }>({ toasts: [] });
let nextId = 1;

function show(kind: ToastKind, message: string, duration = 4000): void {
  const toast: Toast = { id: nextId++, kind, message };
  state.toasts.push(toast);
  window.setTimeout(() => dismiss(toast.id), duration);
}

function dismiss(id: number): void {
  const index = state.toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) state.toasts.splice(index, 1);
}

export function useToast() {
  return {
    toasts: state.toasts,
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message, 6000),
    info: (message: string) => show('info', message),
    dismiss,
  };
}
