import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ChatSession {
  id: string;
  title: string;
  portfolio_id: string | null;
  updated_at: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const chatKeys = {
  sessions: ['chat', 'sessions'] as const,
  session: (id: string) => ['chat', 'session', id] as const,
};

export function useChatSessions() {
  return useQuery({
    queryKey: chatKeys.sessions,
    queryFn: () => apiFetch<ChatSession[]>('/chat/sessions'),
  });
}

export function useChatSession(id: string | undefined) {
  return useQuery({
    queryKey: id ? chatKeys.session(id) : ['chat', 'session', 'unknown'],
    enabled: Boolean(id),
    queryFn: () =>
      apiFetch<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/sessions/${id}`),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/chat/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
  });
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch<ChatSession>(`/chat/sessions/${id}`, { method: 'PATCH', body: { title } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chatKeys.sessions });
    },
  });
}
