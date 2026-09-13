<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
  <!-- The Hooshyar spark: one recognizable product mark used everywhere. -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    class="brand-mark"
  >
    <rect width="32" height="32" rx="9" class="brand-mark__tile" />
    <path
      d="M16 6.5c.5 4.9 4.6 9 9.5 9.5-4.9.5-9 4.6-9.5 9.5-.5-4.9-4.6-9-9.5-9.5 4.9-.5 9-4.6 9.5-9.5Z"
      class="brand-mark__spark"
    />
    <circle cx="23.2" cy="8.8" r="2" class="brand-mark__dot" />
  </svg>
</template>

<style scoped>
.brand-mark__tile {
  fill: var(--accent);
}

.brand-mark__spark {
  fill: var(--on-accent);
}

.brand-mark__dot {
  fill: var(--on-accent);
  opacity: 0.85;
}
</style>
