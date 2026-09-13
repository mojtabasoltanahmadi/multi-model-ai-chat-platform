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
export type MessageStatus = 'completed' | 'error';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus | null;
  errorMessage: string | null;
  modelId: string | null;
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
  isDefault: boolean;
  createdAt: string;
  hasApiKey: boolean;
}

export interface SendMessagePayload {
  content: string;
  modelId?: string;
}

export interface CreateModelPayload {
  name: string;
  provider: AiProviderKind;
  externalModelId: string;
  baseUrl?: string;
  apiKey?: string;
  isActive?: boolean;
}

export interface UpdateModelPayload {
  name?: string;
  provider?: AiProviderKind;
  externalModelId?: string;
  baseUrl?: string | null;
  apiKey?: string;
  isActive?: boolean;
}
