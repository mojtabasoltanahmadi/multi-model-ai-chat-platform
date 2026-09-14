<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import AppSidebar from '../components/layout/AppSidebar.vue';
import ChatHeader from '../components/chat/ChatHeader.vue';
import EmptyChat from '../components/chat/EmptyChat.vue';
import MessageItem from '../components/chat/MessageItem.vue';
import MessageComposer from '../components/chat/MessageComposer.vue';
import AppSkeleton from '../components/ui/AppSkeleton.vue';
import { api, streamChatMessage, type StreamHandle } from '../api/client';
import type { AiModel, Conversation, Message } from '../api/types';
import { useToast } from '../composables/useToast';

const toast = useToast();

// ---- data ----
const conversations = ref<Conversation[]>([]);
const conversationsLoading = ref(true);
const activeId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const messagesLoading = ref(false);
const models = ref<AiModel[]>([]);
const selectedModelId = ref('');
const drawerOpen = ref(false);
const error = ref('');

/** Desktop collapse state (ChatGPT-style rail); persisted per machine. */
const sidebarCollapsed = ref(readCollapsedPreference());

function readCollapsedPreference(): boolean {
  try {
    // Strict comparison: any invalid stored value falls back to expanded.
    return localStorage.getItem('hooshyar.sidebar-collapsed') === 'true';
  } catch {
    return false;
  }
}

watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem('hooshyar.sidebar-collapsed', String(value));
  } catch {
    /* storage unavailable (private mode) — keep state in memory only */
  }
});

// streaming placeholder id inside the messages list
const STREAM_ID = '__streaming__';
const streaming = ref(false);
const streamHandle = ref<StreamHandle | null>(null);

const completedMessages = computed(() =>
  messages.value.filter((message) => message.id !== STREAM_ID),
);
const streamingMessage = computed(
  () => messages.value.find((message) => message.id === STREAM_ID) ?? null,
);
const activeConversation = computed(
  () => conversations.value.find((conversation) => conversation.id === activeId.value) ?? null,
);
const activeModel = computed(
  () => models.value.find((model) => model.id === selectedModelId.value) ?? null,
);

onMounted(async () => {
  await Promise.all([loadConversations(), loadModels()]);
});

async function loadConversations() {
  conversationsLoading.value = true;
  try {
    conversations.value = await api<Conversation[]>('/conversations');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'خطا';
  } finally {
    conversationsLoading.value = false;
  }
}

async function loadModels() {
  try {
    models.value = await api<AiModel[]>('/models');
    const fallback = models.value.find((model) => model.isDefault) ?? models.value[0];
    if (fallback) selectedModelId.value = fallback.id;
  } catch {
    models.value = [];
  }
}

// ---- conversations ----
async function selectConversation(id: string) {
  if (id === activeId.value || streaming.value) return;
  activeId.value = id;
  error.value = '';
  await loadMessages();
}

async function createConversation(): Promise<Conversation> {
  const conversation = await api<Conversation>('/conversations', { method: 'POST', body: {} });
  conversations.value.unshift(conversation);
  activeId.value = conversation.id;
  messages.value = [];
  return conversation;
}

async function loadMessages() {
  if (!activeId.value) {
    messages.value = [];
    return;
  }
  messagesLoading.value = true;
  try {
    const result = await api<{ conversation: Conversation; messages: Message[] }>(
      `/conversations/${activeId.value}`,
    );
    messages.value = result.messages;
    await scrollToBottom(true);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'خطا';
  } finally {
    messagesLoading.value = false;
  }
}

function startNewConversation() {
  if (streaming.value) return;
  activeId.value = null;
  messages.value = [];
}

// ---- sending / streaming ----
async function send(content: string) {
  if (streaming.value) return;
  error.value = '';

  try {
    if (!activeId.value) await createConversation();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'ساخت گفتگو ناموفق بود.';
    return;
  }

  const conversationId = activeId.value;
  if (!conversationId) return;

  const optimisticUser: Message = {
    id: `local-${Date.now()}`,
    conversationId,
    role: 'user',
    content,
    status: null,
    errorMessage: null,
    modelId: null,
    createdAt: new Date().toISOString(),
  };
  const placeholder: Message = {
    id: STREAM_ID,
    conversationId,
    role: 'assistant',
    content: '',
    status: null,
    errorMessage: null,
    modelId: null,
    createdAt: new Date().toISOString(),
  };
  messages.value.push(optimisticUser, placeholder);
  // Stream deltas must mutate the row through the array's reactive proxy.
  // Writing to the raw `placeholder` literal bypasses Vue's proxy, so the
  // template would never re-render until some unrelated state change.
  const streamingRow = messages.value[messages.value.length - 1] as Message;
  streaming.value = true;
  pinnedToBottom.value = true;
  await scrollToBottom();

  let accumulated = '';
  const finish = () => {
    streaming.value = false;
    streamHandle.value = null;
    void loadConversations(); // refresh titles and ordering
  };

  streamHandle.value = streamChatMessage(
    conversationId,
    { content, modelId: selectedModelId.value || undefined },
    {
      onMeta: ({ userMessage: persisted }) => {
        const optimistic = messages.value.find((m) => m.id === optimisticUser.id);
        if (optimistic) Object.assign(optimistic, persisted);
        streamingRow.modelId = persisted.modelId;
      },
      onDelta: ({ text }) => {
        accumulated += text;
        streamingRow.content = accumulated;
        void scrollToBottom();
      },
      onDone: ({ assistantMessage }) => {
        // Promote the placeholder to the persisted message (real id/content).
        Object.assign(streamingRow, assistantMessage);
        finish();
      },
      onError: (message) => {
        // Keep the partial answer visible, marked as failed — the backend
        // has already persisted it with status "error".
        streamingRow.id = `local-error-${Date.now()}`;
        streamingRow.status = 'error';
        streamingRow.errorMessage = message;
        toast.error(message);
        finish();
      },
    },
  );
}

function stopStreaming() {
  streamHandle.value?.abort();
  // The backend persists the partial answer with status "error", but the aborted
  // connection delivers no further events — finalize the UI state here.
  const row = streamingMessage.value;
  if (row) {
    row.id = `local-stopped-${Date.now()}`;
    row.status = 'error';
    if (!row.errorMessage) row.errorMessage = 'تولید پاسخ متوقف شد.';
  }
  streaming.value = false;
  streamHandle.value = null;
  void loadConversations();
}

// ---- scrolling: never yank the user back up ----
const scroller = ref<HTMLElement | null>(null);
const pinnedToBottom = ref(true);

function onScroll() {
  const element = scroller.value;
  if (!element) return;
  pinnedToBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
}

async function scrollToBottom(force = false) {
  await nextTick();
  const element = scroller.value;
  if (element && (force || pinnedToBottom.value)) element.scrollTop = element.scrollHeight;
}
</script>

<template>
  <div class="chat-page">
    <Transition name="fade">
      <div v-if="drawerOpen" class="chat-page__overlay" @click="drawerOpen = false"></div>
    </Transition>

    <AppSidebar
      :conversations="conversations"
      :active-id="activeId"
      :loading="conversationsLoading"
      :open="drawerOpen"
      :collapsed="sidebarCollapsed"
      @select="selectConversation"
      @create="startNewConversation"
      @close="drawerOpen = false"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
    />

    <main class="chat">
      <ChatHeader
        :title="activeConversation?.title ?? 'گفتگوی تازه'"
        :models="models"
        :model-id="selectedModelId"
        @update:model-id="selectedModelId = $event"
        @open-menu="drawerOpen = true"
      />

      <div ref="scroller" class="chat__messages" @scroll.passive="onScroll">
        <EmptyChat v-if="!activeId && !conversationsLoading" @pick="send" />

        <div v-else-if="messagesLoading" class="chat__loading" aria-label="در حال بارگذاری پیام‌ها">
          <div v-for="row in 3" :key="row" class="chat__loading-row">
            <AppSkeleton :lines="2" :width="row % 2 ? '60%' : '40%'" />
          </div>
        </div>

        <div v-else class="chat__stream">
          <MessageItem
            v-for="message in completedMessages"
            :key="message.id"
            :message="message"
            :model-name="models.find((m) => m.id === message.modelId)?.name"
          />
          <MessageItem
            v-if="streamingMessage"
            :message="streamingMessage"
            :model-name="activeModel?.name"
            streaming
          />
        </div>
      </div>

      <MessageComposer
        :models="models"
        :model-id="selectedModelId"
        :streaming="streaming"
        :hint="activeId ? '' : 'ارسال اولین پیام، گفتگو را به‌صورت خودکار می‌سازد.'"
        @send="send"
        @stop="stopStreaming"
        @update:model-id="selectedModelId = $event"
      />
    </main>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: 100dvh;
  overflow: hidden;
}

.chat-page__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer-overlay);
  background: color-mix(in srgb, var(--text-1) 30%, transparent);
}

.chat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.6rem 1.5rem;
}

.chat__stream {
  display: grid;
  gap: 1.3rem;
  max-width: calc(var(--chat-measure) + 3rem);
  margin-inline: auto;
}

.chat__loading {
  max-width: calc(var(--chat-measure) + 3rem);
  margin-inline: auto;
  display: grid;
  gap: 1.4rem;
}

.chat__loading-row {
  display: grid;
  gap: 0.5rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-normal) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1023px) {
  .chat__messages {
    padding: 1.2rem 0.9rem;
  }
}
</style>
