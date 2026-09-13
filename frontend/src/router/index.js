import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import ChatView from '../views/ChatView.vue';
import AdminModelsView from '../views/AdminModelsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/', name: 'chat', component: ChatView },
    {
      path: '/admin/models',
      name: 'admin-models',
      component: AdminModelsView,
      meta: { adminOnly: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuth();
  if (to.meta.guestOnly && auth.isLoggedIn()) return { name: 'chat' };
  if (!to.meta.guestOnly && !auth.isLoggedIn()) return { name: 'login' };
  if (to.meta.adminOnly && !auth.isAdmin()) return { name: 'chat' };
  return true;
});
