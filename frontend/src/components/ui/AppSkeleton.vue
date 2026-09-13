<script setup lang="ts">
withDefaults(defineProps<{ lines?: number; width?: string }>(), { lines: 1 });
</script>

<template>
  <div class="app-skeleton" aria-hidden="true">
    <div
      v-for="line in lines"
      :key="line"
      class="skeleton app-skeleton__line"
      :style="{ width: line === lines ? width ?? '70%' : '100%' }"
    ></div>
  </div>
</template>

<style scoped>
.app-skeleton {
  display: grid;
  gap: 0.55rem;
}

.app-skeleton__line {
  height: 0.85rem;
}
</style>
