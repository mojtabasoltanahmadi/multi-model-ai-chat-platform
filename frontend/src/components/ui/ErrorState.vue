<script setup lang="ts">
import AppButton from './AppButton.vue';

interface Props {
  title: string;
  description?: string;
  actionLabel?: string;
  icon?: 'offline' | 'generic';
}

withDefaults(defineProps<Props>(), { icon: 'generic' });
const emit = defineEmits<{ action: [] }>();
</script>

<template>
  <div class="error-state">
    <div class="error-state__art" aria-hidden="true">
      <svg v-if="icon === 'offline'" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M5 12.5a10 10 0 0 1 5.2-2.7M2.5 9a15 15 0 0 1 6-3.4M21.5 9a15 15 0 0 0-9.2-3.5M8.5 15.5a6 6 0 0 1 7 0" />
        <circle cx="12" cy="19" r="1" fill="currentColor" />
        <path d="m3 3 18 18" />
      </svg>
      <svg v-else width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4m0 4h.01" />
      </svg>
    </div>
    <h3 class="error-state__title">{{ title }}</h3>
    <p v-if="description" class="error-state__description">{{ description }}</p>
    <AppButton v-if="actionLabel" variant="secondary" size="sm" @click="emit('action')">
      {{ actionLabel }}
    </AppButton>
  </div>
</template>

<style scoped>
.error-state {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  text-align: center;
  padding: 2.5rem 1.5rem;
}

.error-state__art {
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: var(--radius-full);
  background: var(--danger-soft);
  color: var(--danger);
}

.error-state__title {
  font-size: 0.98rem;
}

.error-state__description {
  max-width: 34ch;
  font-size: 0.85rem;
  color: var(--text-2);
}
</style>
