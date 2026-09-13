<script setup lang="ts">
import { ref } from 'vue';
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

async function submit() {
  if (busy.value) return;
  error.value = '';
  busy.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    await router.push({ name: 'chat' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'ورود ناموفق بود.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AuthShell>
    <form class="auth-form" novalidate @submit.prevent="submit">
      <h2 class="auth-form__title">ورود به حساب</h2>
      <p class="auth-form__subtitle">خوشحالیم که دوباره می‌بینیمت.</p>

      <p v-if="error" class="auth-form__error" role="alert">{{ error }}</p>

      <AppInput
        v-model="email"
        label="ایمیل"
        type="email"
        dir="ltr"
        autocomplete="email"
        placeholder="you@example.com"
        required
      />
      <AppInput
        v-model="password"
        label="رمز عبور"
        type="password"
        dir="ltr"
        autocomplete="current-password"
        required
      />

      <AppButton type="submit" block :loading="busy">
        {{ busy ? 'در حال ورود…' : 'ورود' }}
      </AppButton>

      <p class="auth-form__switch">
        حساب ندارید؟
        <router-link to="/register">ثبت‌نام کنید</router-link>
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
