<script setup lang="ts">
import ModelStatus from './ModelStatus.vue';
import AppButton from '../ui/AppButton.vue';
import { formatFullDate } from '../../utils/format';
import type { AiModel } from '../../api/types';

defineProps<{ models: AiModel[] }>();
defineEmits<{
  'set-default': [model: AiModel];
  'toggle-active': [model: AiModel];
  'toggle-free': [model: AiModel];
  remove: [model: AiModel];
}>();
</script>

<template>
  <!-- Desktop: dense table. Mobile (<768px): stacked cards. -->
  <div class="model-table">
    <table class="model-table__desktop">
      <thead>
        <tr>
          <th scope="col">مدل</th>
          <th scope="col">ارائه‌دهنده</th>
          <th scope="col">شناسه</th>
          <th scope="col">وضعیت</th>
          <th scope="col">دسترسی</th>
          <th scope="col">تاریخ افزودن</th>
          <th scope="col"><span class="visually-hidden">عملیات</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="model in models"
          :key="model.id"
          :class="{ 'model-table__row--inactive': !model.isActive }"
        >
          <td>
            <div class="model-table__name">
              {{ model.name }}
              <ModelStatus :is-default="model.isDefault" :is-active="model.isActive" :is-free="model.isFree" />
            </div>
          </td>
          <td>{{ model.provider === 'mock' ? 'ماک' : 'سازگار با OpenAI' }}</td>
          <td><span class="mono ltr model-table__id">{{ model.externalModelId }}</span></td>
          <td class="model-table__key">
            {{ model.hasApiKey ? 'کلید ثبت شده' : 'بدون کلید' }}
          </td>
          <td>
            <!-- The default is always free (backend-enforced), so its switch is
                 disabled instead of producing a 400 error on click. -->
            <button
              type="button"
              class="model-table__free-toggle"
              :class="model.isFree ? 'model-table__free-toggle--on' : 'model-table__free-toggle--off'"
              role="switch"
              :aria-checked="model.isFree"
              :aria-label="model.isFree ? 'حذف دسترسی رایگان' : 'افزودن دسترسی رایگان'"
              :disabled="model.isDefault"
              :title="model.isDefault ? 'مدل پیش‌فرض همیشه رایگان است — ابتدا مدل دیگری را پیش‌فرض کنید' : undefined"
              @click="$emit('toggle-free', model)"
            >
              رایگان
            </button>
          </td>
          <td>{{ formatFullDate(model.createdAt) }}</td>
          <td>
            <div class="model-table__actions">
              <AppButton
                v-if="!model.isDefault && model.isActive"
                variant="ghost"
                size="sm"
                @click="$emit('set-default', model)"
              >
                پیش‌فرض
              </AppButton>
              <AppButton
                v-if="!model.isDefault"
                variant="ghost"
                size="sm"
                @click="$emit('toggle-active', model)"
              >
                {{ model.isActive ? 'غیرفعال' : 'فعال' }}
              </AppButton>
              <AppButton
                v-if="!model.isDefault"
                variant="danger"
                size="sm"
                @click="$emit('remove', model)"
              >
                حذف
              </AppButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <ul class="model-table__mobile">
      <li
        v-for="model in models"
        :key="model.id"
        class="model-table__card"
        :class="{ 'model-table__card--inactive': !model.isActive }"
      >
        <div class="model-table__card-head">
          <span class="model-table__name">{{ model.name }}</span>
          <ModelStatus :is-default="model.isDefault" :is-active="model.isActive" :is-free="model.isFree" />
        </div>
        <div class="model-table__card-meta">
          <span>{{ model.provider === 'mock' ? 'ماک' : 'سازگار با OpenAI' }}</span>
          <span class="mono ltr">{{ model.externalModelId }}</span>
        </div>
        <div class="model-table__actions">
          <AppButton
            v-if="!model.isDefault && model.isActive"
            variant="ghost"
            size="sm"
            @click="$emit('set-default', model)"
          >
            پیش‌فرض
          </AppButton>
          <AppButton
            v-if="!model.isDefault"
            variant="ghost"
            size="sm"
            @click="$emit('toggle-free', model)"
          >
            {{ model.isFree ? 'حذف رایگان' : 'رایگان' }}
          </AppButton>
          <AppButton
            v-if="!model.isDefault"
            variant="ghost"
            size="sm"
            @click="$emit('toggle-active', model)"
          >
            {{ model.isActive ? 'غیرفعال' : 'فعال' }}
          </AppButton>
          <AppButton v-if="!model.isDefault" variant="danger" size="sm" @click="$emit('remove', model)">
            حذف
          </AppButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.model-table__desktop {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-1);
}

.model-table__desktop th,
.model-table__desktop td {
  padding: 0.75rem 1rem;
  text-align: right;
  font-size: 0.84rem;
  border-bottom: 1px solid var(--border-subtle);
}

.model-table__desktop th {
  background: var(--surface-2);
  color: var(--text-2);
  font-weight: 500;
  font-size: 0.76rem;
}

.model-table__desktop tr:last-child td {
  border-bottom: none;
}

.model-table__row--inactive td {
  color: var(--text-3);
}

.model-table__desktop tbody tr {
  transition: background var(--motion-fast) var(--ease-out);
}

.model-table__desktop tbody tr:hover {
  background: var(--surface-2);
}

.model-table__name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.86rem;
}

.model-table__id {
  font-size: 0.78rem;
  color: var(--text-2);
}

.model-table__key {
  color: var(--text-3);
  font-size: 0.78rem;
}

/* Free-access switch: same pill language as ModelStatus badges. */
.model-table__free-toggle {
  padding: 0.2rem 0.7rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-3);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}

.model-table__free-toggle--on {
  background: var(--info-soft);
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 25%, transparent);
}

.model-table__free-toggle--off:hover {
  border-color: var(--border-strong);
  color: var(--text-2);
}

.model-table__free-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.model-table__free-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.model-table__actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

/* mobile cards */
.model-table__mobile {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 0.7rem;
}

.model-table__card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.9rem 1rem;
  display: grid;
  gap: 0.6rem;
}

.model-table__card--inactive {
  opacity: 0.75;
}

.model-table__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.model-table__card-head .model-table__name {
  font-size: 0.9rem;
}

.model-table__card-meta {
  display: flex;
  gap: 0.9rem;
  font-size: 0.76rem;
  color: var(--text-3);
}

.model-table__card .model-table__actions {
  justify-content: flex-start;
}

@media (max-width: 767px) {
  .model-table__desktop {
    display: none;
  }

  .model-table__mobile {
    display: grid;
  }
}
</style>
