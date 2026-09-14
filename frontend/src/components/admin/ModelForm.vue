<script setup lang="ts">
import { reactive, ref } from 'vue';
import AppModal from '../ui/AppModal.vue';
import AppInput from '../ui/AppInput.vue';
import AppButton from '../ui/AppButton.vue';
import type { AiProviderKind, CreateModelPayload } from '../../api/types';

interface ModelFormState {
  name: string;
  provider: AiProviderKind;
  externalModelId: string;
  baseUrl: string;
  apiKey: string;
  isFree: boolean;
}

const emit = defineEmits<{ submit: [values: CreateModelPayload]; close: [] }>();

const values = reactive<ModelFormState>({
  name: '',
  provider: 'mock',
  externalModelId: '',
  baseUrl: '',
  apiKey: '',
  isFree: true,
});

const submitting = ref(false);
const validation = ref({ name: '', externalModelId: '' });

function validate(): boolean {
  validation.value = {
    name: values.name.trim() ? '' : 'نام مدل الزامی است.',
    externalModelId: values.externalModelId.trim() ? '' : 'شناسه مدل الزامی است.',
  };
  return !validation.value.name && !validation.value.externalModelId;
}

async function submit() {
  if (!validate() || submitting.value) return;
  submitting.value = true;
  try {
    emit('submit', {
      name: values.name.trim(),
      provider: values.provider,
      externalModelId: values.externalModelId.trim(),
      baseUrl: values.baseUrl.trim() || undefined,
      apiKey: values.apiKey.trim() || undefined,
      isFree: values.isFree,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppModal title="افزودن مدل جدید" size="md" @close="emit('close')">
    <form class="model-form" novalidate @submit.prevent="submit">
      <AppInput
        v-model="values.name"
        label="نام نمایشی"
        placeholder="مثلاً GPT-4o mini"
        :error="validation.name"
        required
      />

      <div class="model-form__field">
        <span class="model-form__label">نوع ارائه‌دهنده</span>
        <div class="model-form__providers" role="radiogroup" aria-label="نوع ارائه‌دهنده">
          <button
            type="button"
            role="radio"
            class="model-form__provider"
            :aria-checked="values.provider === 'mock'"
            :class="{ 'model-form__provider--active': values.provider === 'mock' }"
            @click="values.provider = 'mock'"
          >
            <strong>ماک</strong>
            <span>آزمایشی، بدون کلید</span>
          </button>
          <button
            type="button"
            role="radio"
            class="model-form__provider"
            :aria-checked="values.provider === 'openai-compatible'"
            :class="{ 'model-form__provider--active': values.provider === 'openai-compatible' }"
            @click="values.provider = 'openai-compatible'"
          >
            <strong>سازگار با OpenAI</strong>
            <span>OpenAI و سرویس‌های مشابه</span>
          </button>
        </div>
      </div>

      <AppInput
        v-model="values.externalModelId"
        label="شناسه مدل نزد ارائه‌دهنده"
        dir="ltr"
        placeholder="gpt-4o-mini"
        :error="validation.externalModelId"
        required
      />
      <AppInput
        v-model="values.baseUrl"
        label="آدرس پایه (اختیاری)"
        dir="ltr"
        placeholder="https://api.openai.com/v1"
      />
      <AppInput
        v-model="values.apiKey"
        label="کلید API (اختیاری برای ماک)"
        type="password"
        dir="ltr"
        autocomplete="off"
        placeholder="sk-…"
      />

      <div class="model-form__field">
        <span class="model-form__label">دسترسی طرح رایگان</span>
        <button
          type="button"
          class="model-form__free-toggle"
          role="switch"
          :aria-checked="values.isFree"
          @click="values.isFree = !values.isFree"
        >
          <span class="model-form__free-text">
            <strong>{{ values.isFree ? 'رایگان' : 'پریمیوم' }}</strong>
            <span>
              {{
                values.isFree
                  ? 'کاربران طرح رایگان می‌توانند این مدل را انتخاب کنند'
                  : 'این مدل برای کاربران طرح رایگان در دسترس نخواهد بود'
              }}
            </span>
          </span>
          <span class="model-form__free-knob" aria-hidden="true"></span>
        </button>
      </div>

      <p class="model-form__note">
        کلید API فقط در سرور ذخیره می‌شود و هرگز نمایش داده نمی‌شود. اولین مدل فعال و رایگان،
        به‌طور خودکار پیش‌فرض می‌شود.
      </p>
    </form>

    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">انصراف</AppButton>
      <AppButton :loading="submitting" @click="submit">ذخیره مدل</AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.model-form {
  display: grid;
  gap: 0.9rem;
}

.model-form__field {
  display: grid;
  gap: 0.4rem;
}

.model-form__label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-2);
}

.model-form__providers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.model-form__provider {
  display: grid;
  gap: 0.1rem;
  padding: 0.65rem 0.8rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: right;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

.model-form__provider strong {
  font-size: 0.84rem;
  font-weight: 600;
}

.model-form__provider span {
  font-size: 0.7rem;
  color: var(--text-3);
}

.model-form__provider--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.model-form__provider--active span {
  color: var(--text-on-accent-soft);
}

.model-form__note {
  font-size: 0.72rem;
  color: var(--text-3);
  background: var(--surface-inset);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.75rem;
}

/* free-plan toggle (switch) */
.model-form__free-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
  padding: 0.65rem 0.8rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: right;
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease-out);
}

.model-form__free-toggle:hover {
  border-color: var(--border-strong);
}

.model-form__free-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.model-form__free-text {
  display: grid;
  gap: 0.1rem;
}

.model-form__free-text strong {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-1);
}

.model-form__free-text span {
  font-size: 0.7rem;
  color: var(--text-3);
}

.model-form__free-knob {
  position: relative;
  flex-shrink: 0;
  width: 2.4rem;
  height: 1.35rem;
  border-radius: var(--radius-full);
  background: var(--surface-3);
  border: 1px solid var(--border);
  transition: background var(--motion-fast) var(--ease-out);
}

.model-form__free-knob::after {
  content: '';
  position: absolute;
  top: 50%;
  inset-inline-start: 0.15rem;
  translate: 0 -50%;
  width: 1rem;
  height: 1rem;
  border-radius: var(--radius-full);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  transition: inset-inline-start var(--motion-fast) var(--ease-out);
}

.model-form__free-toggle[aria-checked='true'] .model-form__free-knob {
  background: var(--info);
  border-color: var(--info);
}

.model-form__free-toggle[aria-checked='true'] .model-form__free-knob::after {
  inset-inline-start: calc(100% - 1.15rem);
}

@media (max-width: 640px) {
  .model-form__providers {
    grid-template-columns: 1fr;
  }
}
</style>
