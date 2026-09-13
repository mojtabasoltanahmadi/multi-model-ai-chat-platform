const TOKEN_KEY = 'ai_chat_token';
const USER_KEY = 'ai_chat_user';

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Tiny reactive auth store (no external state library needed for the MVP). */
const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: readJson(USER_KEY),
};

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function useAuth() {
  return {
    state,
    setAuth,
    clearAuth,
    isLoggedIn: () => Boolean(state.token),
    isAdmin: () => state.user?.role === 'admin',
  };
}
