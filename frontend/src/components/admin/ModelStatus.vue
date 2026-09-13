<script setup lang="ts">
defineProps<{ isDefault?: boolean; isActive: boolean }>();
</script>

<template>
  <span v-if="isDefault" class="model-status model-status--default">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c.6 4.5 4.5 8.4 9 9-4.5.6-8.4 4.5-9 9-.6-4.5-4.5-8.4-9-9 4.5-.6 8.4-4.5 9-9Z" />
    </svg>
    پیش‌فرض
  </span>
  <span class="model-status" :class="isActive ? 'model-status--active' : 'model-status--inactive'">
    {{ isActive ? 'فعال' : 'غیرفعال' }}
  </span>
</template>

<style scoped>
.model-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.14rem 0.55rem;
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  font-weight: 500;
  border: 1px solid transparent;
}

.model-status--active {
  background: var(--success-soft);
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 25%, transparent);
}

.model-status--inactive {
  background: var(--surface-2);
  color: var(--text-3);
  border-color: var(--border);
}

.model-status--default {
  background: var(--accent-soft);
  color: var(--text-on-accent-soft);
  border-color: var(--accent-soft-border);
}
</style>
