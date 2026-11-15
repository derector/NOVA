export interface NovaUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export interface NovaPublicUser {
  id: string;
  username: string;
  displayName: string;
}

export interface NovaChat {
  id: string;
  participant: NovaPublicUser;
  updatedAt: string;
}

export interface NovaMessage {
  id: string;
  clientMessageId: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export interface MessagePage {
  items: NovaMessage[];
  nextCursor: string | null;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: NovaUser;
}

export interface ApiErrorPayload {
  status: number;
  message: string;
  requestId?: string;
}
