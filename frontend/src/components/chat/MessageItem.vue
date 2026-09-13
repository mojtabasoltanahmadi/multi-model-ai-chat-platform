<script setup lang="ts">
import { computed, ref } from 'vue';
import AppAvatar from '../ui/AppAvatar.vue';
import { renderMarkdown } from '../../utils/markdown';
import { formatTime } from '../../utils/format';
import type { Message } from '../../api/types';

interface Props {
  message: Message;
  /** Model name for assistant attribution; fallback «دستیار هوشمند». */
  modelName?: string;
  streaming?: boolean;
}

const props = withDefaults(defineProps<Props>(), { streaming: false, modelName: '' });

const copied = ref(false);
const isUser = computed(() => props.message.role === 'user');
const isError = computed(() => props.message.status === 'error');

const html = computed(() => {
  if (props.message.role !== 'assistant' || props.streaming) return '';
  return renderMarkdown(props.message.content);
});

/** During streaming, markdown is rendered progressively; plain text + caret reads calmer. */
const streamingHtml = computed(() => (props.streaming ? renderMarkdown(props.message.content) : ''));

async function copy() {
  try {
    await navigator.clipboard.writeText(props.message.content);
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1600);
  } catch {
    /* clipboard unavailable (e.g. insecure context) — silently ignore */
  }
}
</script>

<template>
  <article class="message" :class="isUser ? 'message--user' : 'message--assistant'">
    <div v-if="!isUser" class="message__meta">
      <AppAvatar :name="modelName || 'دستیار'" :size="24" />
      <span class="message__author">{{ modelName || 'دستیار هوشمند' }}</span>
      <span class="message__time ltr">{{ formatTime(message.createdAt) }}</span>
    </div>

    <div
      class="message__body"
      :class="{
        'message__body--streaming': streaming,
        'message__body--error': isError,
      }"
      :dir="isUser ? 'auto' : undefined"
    >
      <!-- eslint-disable-next-line vue/no-v-html — sanitized: markdown-it runs with html:false -->
      <div
        v-if="isUser"
        class="message__content message__content--user"
      >{{ message.content }}</div>
      <div
        v-else-if="streaming"
        class="message__content message__content--streaming"
      >
        <!-- eslint-disable-next-line vue/no-v-html — sanitized: markdown-it runs with html:false -->
        <span v-html="streamingHtml"></span><span class="message__caret" aria-hidden="true"></span>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html — sanitized: markdown-it runs with html:false -->
      <div v-else class="message__content" v-html="html"></div>

      <p v-if="isError && message.errorMessage" class="message__error-note">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 8h.01M12 12v5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        {{ message.errorMessage }}
      </p>
    </div>

    <div v-if="!isUser && !streaming" class="message__actions">
      <button
        type="button"
        class="message__action"
        :aria-label="copied ? 'کپی شد' : 'کپی پاسخ'"
        :title="copied ? 'کپی شد' : 'کپی پاسخ'"
        @click="copy"
      >
        <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
    </div>
  </article>
</template>

<style scoped>
.message {
  display: grid;
  gap: 0.45rem;
  animation: message-in var(--motion-normal) var(--ease-out);
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* --- user message: subtle distinct surface, aligned to the inline start --- */
.message--user {
  justify-items: start;
}

.message__body--streaming {
  min-height: 1.6rem;
}

.message--user .message__body {
  max-width: min(46rem, 100%);
}

.message__content--user {
  padding: 0.65rem 1rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent-soft-border);
  border-radius: var(--radius-lg);
  border-start-end-radius: var(--radius-xs);
  font-size: 0.9rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* --- assistant message: workspace content, no heavy bubble --- */
.message--assistant {
  gap: 0.35rem;
}

.message__meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.message__author {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-1);
}

.message__time {
  font-size: 0.7rem;
  color: var(--text-3);
}

.message__body {
  min-width: 0;
}

.message__content {
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.message--assistant .message__body {
  padding-inline-start: 2.1rem; /* aligns with the avatar column */
}

/* markdown typography */
.message__content :deep(p) {
  margin: 0 0 0.7rem;
}

.message__content :deep(p:last-child) {
  margin-bottom: 0;
}

.message__content :deep(ul),
.message__content :deep(ol) {
  margin: 0.4rem 0 0.8rem;
  padding-inline-start: 1.4rem;
}

.message__content :deep(li) {
  margin-bottom: 0.25rem;
}

.message__content :deep(h1),
.message__content :deep(h2),
.message__content :deep(h3),
.message__content :deep(h4) {
  font-size: 1em;
  margin: 1rem 0 0.4rem;
}

.message__content :deep(a) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message__content :deep(blockquote) {
  margin: 0.6rem 0;
  padding: 0.35rem 0.9rem;
  border-inline-start: 3px solid var(--accent-soft-border);
  background: var(--surface-inset);
  border-radius: var(--radius-xs);
  color: var(--text-2);
}

.message__content :deep(pre) {
  margin: 0.6rem 0 0.9rem;
  padding: 0.85rem 1rem;
  background: var(--surface-inset);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.8rem;
  line-height: 1.7;
  text-align: left;
  direction: ltr;
}

.message__content :deep(code) {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.82em;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  padding: 0.05em 0.35em;
}

.message__content :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
}

.message__content :deep(table) {
  border-collapse: collapse;
  font-size: 0.82rem;
  margin: 0.6rem 0;
}

.message__content :deep(th),
.message__content :deep(td) {
  border: 1px solid var(--border);
  padding: 0.3rem 0.65rem;
}

/* streaming */
.message__content--streaming {
  display: inline;
}

.message__caret {
  display: inline-block;
  width: 0.5rem;
  height: 1.05rem;
  margin-inline-start: 0.15rem;
  vertical-align: text-bottom;
  border-radius: var(--radius-xs);
  background: var(--accent);
  animation: caret-pulse 1s var(--ease-in-out) infinite;
}

@keyframes caret-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

/* error */
.message__body--error .message__content {
  color: var(--text-2);
}

.message__error-note {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--danger);
}

/* actions */
.message__actions {
  display: flex;
  gap: 0.25rem;
  padding-inline-start: 2.1rem;
}

.message__action {
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-3);
  transition:
    background var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}

.message__action:hover {
  background: var(--surface-2);
  color: var(--text-1);
}
</style>
