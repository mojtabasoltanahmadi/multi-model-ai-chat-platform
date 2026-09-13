<script setup lang="ts">
import { useToast } from '../../composables/useToast';

const { toasts, dismiss } = useToast();

const icons: Record<string, string> = {
  success: 'M20 6 9 17l-5-5',
  error: 'M12 8v5m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 8h.01M12 12v5m9-5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.kind}`"
          role="status"
        >
          <svg
            class="toast__icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="icons[toast.kind]" />
          </svg>
          <p class="toast__message">{{ toast.message }}</p>
          <button
            type="button"
            class="toast__dismiss"
            aria-label="بستن پیام"
            @click="dismiss(toast.id)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 1.2rem;
  inset-inline-start: 50%;
  translate: 50% 0;
  z-index: var(--z-toast);
  display: grid;
  gap: 0.5rem;
  justify-items: center;
  width: min(26rem, calc(100vw - 2rem));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.65rem 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
}

.toast__icon {
  flex-shrink: 0;
}

.toast--success .toast__icon {
  color: var(--success);
}

.toast--error .toast__icon {
  color: var(--danger);
}

.toast--info .toast__icon {
  color: var(--info);
}

.toast__message {
  flex: 1;
  font-size: 0.85rem;
}

.toast__dismiss {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-3);
}

.toast__dismiss:hover {
  color: var(--text-1);
  background: var(--surface-2);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--motion-normal) var(--ease-out),
    transform var(--motion-normal) var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
