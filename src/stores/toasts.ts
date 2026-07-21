import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
}

/** Auto-dismiss delays from REBUILD.md §2.1: longer when there is a button. */
const PLAIN_DURATION_MS = 3000
const ACTION_DURATION_MS = 5000

interface ToastState {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: ({ message, variant, action }) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant, action }],
    }))

    const duration = action ? ACTION_DURATION_MS : PLAIN_DURATION_MS
    setTimeout(() => get().dismiss(id), duration)

    return id
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/**
 * Convenience wrappers so call sites read as `toast.error('...')` rather than
 * spelling out the variant every time.
 */
export const toast = {
  info: (message: string, action?: ToastAction) =>
    useToastStore.getState().show({ message, variant: 'info', action }),
  success: (message: string, action?: ToastAction) =>
    useToastStore.getState().show({ message, variant: 'success', action }),
  error: (message: string, action?: ToastAction) =>
    useToastStore.getState().show({ message, variant: 'error', action }),
}
