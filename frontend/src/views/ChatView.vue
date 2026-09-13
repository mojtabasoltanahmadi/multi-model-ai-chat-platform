<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, streamChatMessage } from '../api/client';
import { useAuth } from '../stores/auth';

const router = useRouter();
const auth = useAuth();

const conversations = ref([]);
const activeConversationId = ref(null);
const messages = ref([]);
const models = ref([]);
const selectedModelId = ref('');
const draft = ref('');
const streaming = ref(false);
const error = ref('');
const loadingMessages = ref(false);
const messagesEl = ref(null);

const activeConversation = computed(() =>
  conversations.value.find((c) => c.id === activeConversationId.value),
);

onMounted(async () => {
  await Promise.all([loadConversations(), loadModels()]);
});

async function loadConversations() {
  try {
    conversations.value = await api('/conversations');
  } catch (e) {
    error.value = e.message;
  }
}

async function loadModels() {
  try {
    models.value = await api('/models');
    const fallback = models.value.find((m) => m.isDefault) ?? models.value[0];
    selectedModelId.value = fallback?.id ?? '';
  } catch {
    models.value = [];
  }
}

async function selectConversation(id) {
  if (streaming.value) return;
  activeConversationId.value = id;
  error.value = '';
  await loadMessages();
}

async function loadMessages() {
  if (!activeConversationId.value) {
    messages.value = [];
    return;
  }
  loadingMessages.value = true;
  try {
    const result = await api(`/conversations/${activeConversationId.value}`);
    messages.value = result.messages;
    await scrollToBottom();
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingMessages.value = false;
  }
}

async function createConversation() {
  if (streaming.value) return;
  try {
    const conversation = await api('/conversations', { method: 'POST', body: {} });
    conversations.value.unshift(conversation);
    activeConversationId.value = conversation.id;
    messages.value = [];
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}

async function send() {
  const content = draft.value.trim();
  if (!content || !activeConversationId.value || streaming.value) return;

  error.value = '';
  streaming.value = true;
  draft.value = '';

  // Optimistic user bubble + streaming assistant placeholder.
  const tempUserId = `temp-user-${Date.now()}`;
  const streamingId = 'streaming-assistant';
  messages.value.push({ id: tempUserId, role: 'user', content });
  messages.value.push({ id: streamingId, role: 'assistant', content: '', streaming: true });
  await scrollToBottom();

  let accumulated = '';

  const done = () => {
    streaming.value = false;
  };

  streamChatMessage(activeConversationId.value, {
    content,
    modelId: selectedModelId.value || undefined,
    onMeta: async ({ userMessage }) => {
      const optimistic = messages.value.find((m) => m.id === tempUserId);
      if (optimistic) Object.assign(optimistic, userMessage);
    },
    onDelta: async ({ text }) => {
      accumulated += text;
      const bubble = messages.value.find((m) => m.id === streamingId);
      if (bubble) bubble.content = accumulated;
      await scrollToBottom();
    },
    onDone: async ({ assistantMessage }) => {
      const bubble = messages.value.find((m) => m.id === streamingId);
      if (bubble) Object.assign(bubble, assistantMessage, { streaming: false });
      done();
      refreshConversationList();
    },
    onError: async (message) => {
      const bubble = messages.value.find((m) => m.id === streamingId);
      if (bubble) {
        bubble.streaming = false;
        bubble.status = 'error';
        bubble.errorMessage = message;
        if (!bubble.content) bubble.content = '';
      }
      error.value = message;
      done();
      refreshConversationList();
    },
  });
}

async function refreshConversationList() {
  // Title may have been auto-generated from the first message.
  await loadConversations();
}

async function scrollToBottom() {
  await nextTick();
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}

function logout() {
  auth.clearAuth();
  router.push({ name: 'login' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="chat-shell">
    <aside class="sidebar">
      <header>
        <strong>چت هوشمند</strong>
        <button class="secondary" @click="createConversation">+ گفتگوی جدید</button>
      </header>
      <nav class="conversation-list">
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-item"
          :class="{ active: conversation.id === activeConversationId }"
          :title="conversation.title"
          @click="selectConversation(conversation.id)"
        >
          {{ conversation.title }}
        </button>
        <p v-if="conversations.length === 0" class="muted-link">
          هنوز گفتگویی ندارید. یکی بسازید!
        </p>
      </nav>
      <footer style="display: grid; gap: 0.4rem">
        <p class="muted-link" style="margin: 0">{{ auth.state.user?.email }}</p>
        <router-link v-if="auth.isAdmin()" to="/admin/models" class="muted-link">
          پنل مدیریت مدل‌ها
        </router-link>
        <button class="secondary" @click="logout">خروج</button>
      </footer>
    </aside>

    <main class="chat-main">
      <header class="chat-header">
        <strong>{{ activeConversation?.title ?? 'گفتگو را انتخاب کنید' }}</strong>
        <div class="model-picker">
          <label for="model">مدل:</label>
          <select id="model" v-model="selectedModelId">
            <option v-if="models.length === 0" value="" disabled>مدلی موجود نیست</option>
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}{{ model.isDefault ? ' (پیش‌فرض)' : '' }}
            </option>
          </select>
        </div>
      </header>

      <div ref="messagesEl" class="messages">
        <div v-if="!activeConversationId" class="empty-state">
          <h2>به چت هوشمند خوش آمدید 👋</h2>
          <p>از نوار کنار یک گفتگوی جدید بسازید و اولین پیام را بفرستید.</p>
        </div>
        <p v-else-if="loadingMessages" class="empty-state">در حال بارگذاری…</p>
        <template v-else>
          <div
            v-for="message in messages"
            :key="message.id"
            class="bubble"
            :class="[message.role, { 'status-error': message.status === 'error' }]"
          >
            {{ message.content }}<span v-if="message.streaming" class="typing-dot"></span>
            <span v-if="message.status === 'error' && message.errorMessage" class="bubble-tag">
              ⚠️ {{ message.errorMessage }}
            </span>
          </div>
          <p v-if="messages.length === 0" class="empty-state">اولین پیام را بفرستید.</p>
        </template>
      </div>

      <div v-if="error" class="error-banner" style="margin: 0 1.4rem">{{ error }}</div>

      <form class="composer" @submit.prevent="send">
        <textarea
          v-model="draft"
          placeholder="پیام خود را بنویسید…"
          :disabled="!activeConversationId || streaming"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button type="submit" :disabled="!draft.trim() || !activeConversationId || streaming">
          {{ streaming ? 'در حال پاسخ…' : 'ارسال' }}
        </button>
      </form>
    </main>
  </div>
</template>
