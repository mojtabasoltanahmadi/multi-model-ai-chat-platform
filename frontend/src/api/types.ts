/** API contract types — mirror the backend entities (see docs/API.md). */

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant';
/**
 * Lifecycle of an assistant turn. Persisted on the backend row, so a refresh
 * mid-stream can read the latest value from PostgreSQL instead of guessing.
 *  - 'pending'    : row exists, AI has not started yet
 *  - 'streaming'  : AI is producing deltas (in-memory on the server)
 *  - 'completed'  : AI finished successfully
 *  - 'interrupted': client disconnected mid-stream; partial content kept
 *  - 'failed'     : AI call failed; errorMessage has the detail
 *
 * User rows have status = null.
 */
export type MessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'interrupted'
  | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus | null;
  errorMessage: string | null;
  modelId: string | null;
  /** Client-generated idempotency token; present on user rows. */
  clientMessageId: string | null;
  createdAt: string;
}

export type AiProviderKind = 'mock' | 'openai-compatible';

/** Model as returned by the API — the provider API key is never included. */
export interface AiModel {
  id: string;
  name: string;
  provider: AiProviderKind;
  externalModelId: string;
  baseUrl: string | null;
  isActive: boolean;
  /** Available to users on the FREE plan (independent of isActive). */
  isFree: boolean;
  isDefault: boolean;
  createdAt: string;
  hasApiKey: boolean;
}

export interface SendMessagePayload {
  content: string;
  modelId?: string;
  /**
   * Client-generated idempotency token (≤ 64 chars). Two requests with the
   * same token for the same conversation reuse the original user row and
   * emit `replay: true` in the meta event. If the same token is reused with
   * different content, the backend rejects with 400.
   *
   * Optional: when omitted, `Idempotency-Key` HTTP header is also accepted
   * by the backend as a fallback.
   */
  clientMessageId?: string;
}

export interface CreateModelPayload {
  name: string;
  provider: AiProviderKind;
  externalModelId: string;
  baseUrl?: string;
  apiKey?: string;
  isActive?: boolean;
  isFree?: boolean;
}

export interface UpdateModelPayload {
  name?: string;
  provider?: AiProviderKind;
  externalModelId?: string;
  baseUrl?: string | null;
  apiKey?: string;
  isActive?: boolean;
  isFree?: boolean;
}
