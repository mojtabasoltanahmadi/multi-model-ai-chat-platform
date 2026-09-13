<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthShell from '../components/auth/AuthShell.vue';
import AppInput from '../components/ui/AppInput.vue';
import AppButton from '../components/ui/AppButton.vue';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const auth = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);
const touched = ref(false);

const MIN_PASSWORD = 8;

const emailError = computed(() => {
  if (!touched.value) return '';
  const value = email.value.trim();
  if (!value) return 'ایمیل الزامی است.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'ایمیل معتبر وارد کنید.';
  return '';
});

const passwordError = computed(() => {
  if (!touched.value) return '';
  if (!password.value) return 'رمز عبور الزامی است.';
  if (password.value.length < MIN_PASSWORD) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  return '';
});

async function submit() {
  touched.value = true;
  if (emailError.value || passwordError.value) return;
  error.value = '';
  busy.value = true;
  try {
    await auth.register(email.value.trim(), password.value);
    await router.push({ name: 'chat' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'ثبت‌نام ناموفق بود.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthShell>
    <form class="auth-form" novalidate @submit.prevent="submit">
      <h2 class="auth-form__title">ساخت حساب</h2>
      <p class="auth-form__subtitle">در چند ثانیه عضو شوید.</p>

      <p v-if="error" class="auth-form__error" role="alert">{{ error }}</p>

      <AppInput
        v-model="email"
        label="ایمیل"
        type="email"
        dir="ltr"
        autocomplete="email"
        placeholder="you@example.com"
        :error="emailError"
        required
      />
      <AppInput
        v-model="password"
        label="رمز عبور"
        type="password"
        dir="ltr"
        autocomplete="new-password"
        hint="حداقل ۸ کاراکتر"
        :error="passwordError"
        required
      />

      <AppButton type="submit" block :loading="busy">
        {{ busy ? 'در حال ساخت حساب…' : 'ثبت‌نام' }}
      </AppButton>

      <p class="auth-form__switch">
        قبلاً ثبت‌نام کرده‌اید؟
        <router-link to="/login">وارد شوید</router-link>
      </p>
    </form>
  </AuthShell>
</template>

<style scoped>
.auth-form {
  display: grid;
  gap: 0.9rem;
}

.auth-form__title {
  font-size: 1.25rem;
}

.auth-form__subtitle {
  font-size: 0.85rem;
  color: var(--text-2);
  margin-bottom: 0.4rem;
}

.auth-form__error {
  padding: 0.6rem 0.9rem;
  background: var(--danger-soft);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  color: var(--danger);
}

.auth-form__switch {
  font-size: 0.82rem;
  color: var(--text-2);
  text-align: center;
  margin-top: 0.4rem;
}
</style>
