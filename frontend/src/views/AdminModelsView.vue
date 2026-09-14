<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BrandMark from '../components/ui/BrandMark.vue';
import AppButton from '../components/ui/AppButton.vue';
import AppModal from '../components/ui/AppModal.vue';
import AppSkeleton from '../components/ui/AppSkeleton.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import ModelTable from '../components/admin/ModelTable.vue';
import ModelForm from '../components/admin/ModelForm.vue';
import { api } from '../api/client';
import type { AiModel, CreateModelPayload } from '../api/types';
import { useAuth } from '../composables/useAuth';
import { useToast } from '../composables/useToast';

const router = useRouter();
const auth = useAuth();
const toast = useToast();

const models = ref<AiModel[]>([]);
const loading = ref(true);
const loadError = ref(false);
const showCreateForm = ref(false);
const pendingDelete = ref<AiModel | null>(null);
const actionBusy = ref(false);

onMounted(load);

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    models.value = await api<AiModel[]>('/admin/models');
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

async function createModel(values: CreateModelPayload) {
  actionBusy.value = true;
  try {
    await api('/admin/models', { method: 'POST', body: values });
    showCreateForm.value = false;
    toast.success('مدل با موفقیت ساخته شد.');
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ساخت مدل ناموفق بود.');
  } finally {
    actionBusy.value = false;
  }
}

async function setDefault(model: AiModel) {
  actionBusy.value = true;
  try {
    await api(`/admin/models/${model.id}/default`, { method: 'POST' });
    await load();
    toast.success(`«${model.name}» پیش‌فرض شد.`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'عملیات ناموفق بود.');
  } finally {
    actionBusy.value = false;
  }
}

async function toggleActive(model: AiModel) {
  actionBusy.value = true;
  try {
    await api(`/admin/models/${model.id}`, {
      method: 'PATCH',
      body: { isActive: !model.isActive },
    });
    await load();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'عملیات ناموفق بود.');
  } finally {
    actionBusy.value = false;
  }
}

async function removeModel() {
  const model = pendingDelete.value;
  if (!model) return;
  actionBusy.value = true;
  try {
    await api(`/admin/models/${model.id}`, { method: 'DELETE' });
    pendingDelete.value = null;
    await load();
    toast.success(`«${model.name}» حذف شد.`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'حذف ناموفق بود.');
  } finally {
    actionBusy.value = false;
  }
}

function goBack() {
  void router.push({ name: 'chat' });
}

function logout() {
  auth.logout();
  void router.push({ name: 'login' });
}
</script>

<template>
  <main class="admin">
    <header class="admin__header">
      <div class="admin__brand">
        <BrandMark :size="26" />
        <div>
          <h1 class="admin__title">مدیریت مدل‌های هوش مصنوعی</h1>
          <p class="admin__subtitle">
            مدل‌ها را فعال/غیرفعال کنید و مدل پیش‌فرض گفتگو را انتخاب کنید.
          </p>
        </div>
      </div>
      <div class="admin__header-actions">
        <AppButton variant="ghost" size="sm" @click="goBack">بازگشت به چت</AppButton>
        <AppButton variant="ghost" size="sm" @click="logout">خروج</AppButton>
      </div>
    </header>

    <ErrorState
      v-if="loadError"
      title="بارگذاری مدل‌ها ناموفق بود"
      description="ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید."
      action-label="تلاش دوباره"
      icon="offline"
      @action="load"
    />

    <template v-else>
      <div class="admin__toolbar">
        <p class="admin__count">
          {{ models.length.toLocaleString('fa-IR') }} مدل
          <template v-if="models.some((m) => m.isDefault)">
            · پیش‌فرض: {{ models.find((m) => m.isDefault)?.name }}
          </template>
        </p>
        <AppButton :loading="actionBusy" @click="showCreateForm = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          افزودن مدل
        </AppButton>
      </div>

      <div v-if="loading" class="admin__loading">
        <AppSkeleton :lines="1" width="30%" />
        <AppSkeleton :lines="6" width="100%" />
      </div>

      <ModelTable
        v-else
        :models="models"
        @set-default="setDefault"
        @toggle-active="toggleActive"
        @remove="pendingDelete = $event"
      />

      <p v-if="!loading && models.length === 0" class="admin__empty">
        هنوز مدلی ثبت نشده است. اولین مدل را اضافه کنید تا گفتگو شروع شود.
      </p>
    </template>

    <ModelForm
      v-if="showCreateForm"
      @submit="createModel"
      @close="showCreateForm = false"
    />

    <AppModal
      v-if="pendingDelete"
      title="حذف مدل"
      @close="pendingDelete = null"
    >
      <p class="admin__confirm-text">
        آیا از حذف «{{ pendingDelete.name }}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="pendingDelete = null">انصراف</AppButton>
        <AppButton
          variant="danger"
          :loading="actionBusy"
          @click="removeModel"
        >
          حذف مدل
        </AppButton>
      </template>
    </AppModal>
  </main>
</template>

<style scoped>
.admin {
  max-width: 62rem;
  margin: 0 auto;
  padding: 2rem 1.4rem 3rem;
  display: grid;
  gap: 1.2rem;
}

.admin__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.admin__brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.admin__title {
  font-size: 1.1rem;
}

.admin__subtitle {
  font-size: 0.8rem;
  color: var(--text-2);
}

.admin__header-actions {
  display: flex;
  gap: 0.4rem;
}

.admin__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  flex-wrap: wrap;
}

.admin__count {
  font-size: 0.82rem;
  color: var(--text-2);
}

.admin__loading {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.admin__empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-2);
  font-size: 0.88rem;
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
}

.admin__confirm-text {
  font-size: 0.88rem;
  color: var(--text-1);
}
</style>
