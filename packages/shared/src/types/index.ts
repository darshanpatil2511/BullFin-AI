/**
 * Shared domain types used across the BullFin-AI monorepo.
 * Keep this file free of runtime imports — types only.
 */

// ============================================================
// Auth / Users
// ============================================================

export type UserRole = 'investor' | 'advisor' | 'admin';

export interface UserProfile {
  id: string; // Supabase auth.users.id (uuid)
  email: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Portfolios & Holdings
// ============================================================

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  baseCurrency: string; // ISO 4217, e.g. 'USD'
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  id: string;
  portfolioId: string;
  symbol: string; // uppercased ticker
  shares: number;
  purchasePrice: number;
  purchaseDate: string; // ISO date (YYYY-MM-DD)
  sector: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingInput {
  symbol: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string;
  sector?: string | null;
  notes?: string | null;
}

// ============================================================
// AI Chat
// ============================================================

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  portfolioId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Reports
// ============================================================

export interface Report {
  id: string;
  userId: string;
  portfolioId: string;
  title: string;
  storagePath: string; // path in Supabase storage bucket
  createdAt: string;
}

// ============================================================
// API envelopes
// ============================================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
