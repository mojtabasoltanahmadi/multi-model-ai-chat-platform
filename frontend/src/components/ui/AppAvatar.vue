<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 32 });

const initial = computed(() => {
  const trimmed = props.name.trim();
  // Persian + Latin both have well-behaved first letters; take the first grapheme-ish char.
  return trimmed ? Array.from(trimmed)[0]!.toUpperCase() : '?';
});
</script>

<template>
  <span
    class="app-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.44)}px` }"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
</template>

<style scoped>
.app-avatar {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--accent-soft);
  color: var(--text-on-accent-soft);
  font-weight: 600;
  user-select: none;
}
</style>
