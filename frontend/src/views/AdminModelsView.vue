<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuth } from '../stores/auth';

const auth = useAuth();

const models = ref([]);
const error = ref('');
const notice = ref('');
const busy = ref(false);

const form = ref(emptyForm());
const showForm = ref(false);

function emptyForm() {
  return {
    name: '',
    provider: 'mock',
    externalModelId: '',
    baseUrl: '',
    apiKey: '',
    isActive: true,
  };
}

onMounted(load);

async function load() {
  error.value = '';
  try {
    models.value = await api('/admin/models');
  } catch (e) {
    error.value = e.message;
  }
}

async function createModel() {
  error.value = '';
  notice.value = '';
  busy.value = true;
  try {
    await api('/admin/models', { method: 'POST', body: form.value });
    form.value = emptyForm();
    showForm.value = false;
    await load();
    notice.value = 'مدل ساخته شد.';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function toggleActive(model) {
  error.value = '';
  notice.value = '';
  try {
    await api(`/admin/models/${model.id}`, {
      method: 'PATCH',
      body: { isActive: !model.isActive },
    });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function makeDefault(model) {
  error.value = '';
  notice.value = '';
  try {
    await api(`/admin/models/${model.id}/default`, { method: 'POST' });
    await load();
    notice.value = `«${model.name}» پیش‌فرض شد.`;
  } catch (e) {
    error.value = e.message;
  }
}

async function removeModel(model) {
  error.value = '';
  notice.value = '';
  try {
    await api(`/admin/models/${model.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function logout() {
  auth.clearAuth();
  window.location.assign('/login');
}
</script>

<template>
  <main class="admin-page">
    <header>
      <h1>مدیریت مدل‌های هوش مصنوعی</h1>
      <div style="display: flex; gap: 0.5rem">
        <router-link to="/" class="muted-link">بازگشت به چت</router-link>
        <button class="secondary" @click="logout">خروج</button>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <p v-else-if="notice" class="muted-link">{{ notice }}</p>

    <div v-if="!showForm" style="text-align: left">
      <button @click="showForm = true">+ افزودن مدل</button>
    </div>

    <form v-else class="model-form" @submit.prevent="createModel">
      <h3>مدل جدید</h3>
      <div class="field">
        <label>نام نمایشی</label>
        <input v-model="form.name" required maxlength="100" placeholder="مثلاً GPT-4o" />
      </div>
      <div class="field">
        <label>نوع ارائه‌دهنده</label>
        <select v-model="form.provider">
          <option value="mock">ماک (آزمایشی، بدون کلید)</option>
          <option value="openai-compatible">سازگار با OpenAI</option>
        </select>
      </div>
      <div class="field">
        <label>شناسه مدل نزد ارائه‌دهنده</label>
        <input v-model="form.externalModelId" required dir="ltr" placeholder="gpt-4o-mini" />
      </div>
      <div class="field">
        <label>آدرس پایه (اختیاری)</label>
        <input v-model="form.baseUrl" dir="ltr" placeholder="https://api.openai.com/v1" />
      </div>
      <div class="field">
        <label>کلید API (اختیاری برای ماک)</label>
        <input v-model="form.apiKey" dir="ltr" type="password" placeholder="sk-…" />
      </div>
      <div class="field">
        <label>وضعیت</label>
        <select v-model="form.isActive">
          <option :value="true">فعال</option>
          <option :value="false">غیرفعال</option>
        </select>
      </div>
      <div class="full row-actions" style="justify-content: flex-end">
        <button type="button" class="secondary" @click="showForm = false">انصراف</button>
        <button type="submit" :disabled="busy">{{ busy ? 'در حال ذخیره…' : 'ذخیره' }}</button>
      </div>
    </form>

    <table>
      <thead>
        <tr>
          <th>نام</th>
          <th>نوع</th>
          <th>شناسه</th>
          <th>وضعیت</th>
          <th>عملیات</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="model in models" :key="model.id">
          <td>
            {{ model.name }}
            <span v-if="model.isDefault" class="badge default">پیش‌فرض</span>
          </td>
          <td>{{ model.provider === 'mock' ? 'ماک' : 'سازگار با OpenAI' }}</td>
          <td dir="ltr">{{ model.externalModelId }}</td>
          <td>
            <span class="badge" :class="{ active: model.isActive }">
              {{ model.isActive ? 'فعال' : 'غیرفعال' }}
            </span>
          </td>
          <td>
            <div class="row-actions">
              <button v-if="!model.isDefault && model.isActive" @click="makeDefault(model)">
                پیش‌فرض‌سازی
              </button>
              <button v-if="!model.isDefault" class="secondary" @click="toggleActive(model)">
                {{ model.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی' }}
              </button>
              <button v-if="!model.isDefault" class="danger" @click="removeModel(model)">حذف</button>
            </div>
          </td>
        </tr>
        <tr v-if="models.length === 0">
          <td colspan="5" class="muted-link">هنوز مدلی ثبت نشده است.</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
