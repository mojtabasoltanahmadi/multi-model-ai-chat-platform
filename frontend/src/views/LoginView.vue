<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useAuth } from '../stores/auth';

const router = useRouter();
const auth = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const result = await api('/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    });
    auth.setAuth(result.accessToken, result.user);
    router.push({ name: 'chat' });
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main>
    <form class="auth-card" @submit.prevent="submit">
      <h1>ورود به چت هوشمند</h1>
      <div v-if="error" class="error-banner">{{ error }}</div>
      <div class="field">
        <label for="email">ایمیل</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" dir="ltr" />
      </div>
      <div class="field">
        <label for="password">رمز عبور</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          dir="ltr"
        />
      </div>
      <button type="submit" :disabled="busy">{{ busy ? 'در حال ورود…' : 'ورود' }}</button>
      <p class="muted-link">حساب ندارید؟ <router-link to="/register">ثبت‌نام کنید</router-link></p>
    </form>
  </main>
</template>
