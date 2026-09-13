import { computed, reactive } from 'vue';
import { api, clearSession, loadSession, onSessionExpired, saveSession } from '../api/client';
import type { AuthResponse, User } from '../api/types';

interface AuthState {
  user: User | null;
  token: string | null;
}

const initialSession = loadSession();
const state = reactive<AuthState>({
  user: initialSession?.user ?? null,
  token: initialSession?.accessToken ?? null,
});

onSessionExpired(() => {
  state.user = null;
  state.token = null;
});

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(state.token));
  const isAdmin = computed(() => state.user?.role === 'admin');

  async function login(email: string, password: string): Promise<void> {
    const result = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveSession(result);
    state.token = result.accessToken;
    state.user = result.user;
  }

  async function register(email: string, password: string): Promise<void> {
    const result = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password },
    });
    saveSession(result);
    state.token = result.accessToken;
    state.user = result.user;
  }

  function logout(): void {
    clearSession();
    state.token = null;
    state.user = null;
  }

  return { state, isLoggedIn, isAdmin, login, register, logout };
}
