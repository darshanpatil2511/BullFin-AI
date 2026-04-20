import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(message: string, opts: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeBase(base: string): string {
  // Strip trailing slashes so we never produce '//api'.
  const trimmed = base.replace(/\/+$/, '');
  // Append '/api' unless the caller already included it (e.g. some deploys
  // route the gateway at https://api.example.com/api).
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/**
 * Thin typed fetch wrapper for the BullFin gateway. Attaches the current
 * Supabase access token, parses the JSON envelope, and raises an ApiError
 * on non-2xx responses so React Query can surface it.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await getAuthHeader()) };
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    signal: opts.signal,
  };
  if (opts.formData) {
    init.body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  init.headers = headers;

  const base = normalizeBase(API_BASE);
  const url = `${base}${path}`;
  const res = await fetch(url, init);

  if (res.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError(`${res.status} ${res.statusText}`, {
      status: res.status,
      code: 'PARSE_ERROR',
    });
  }

  if (!res.ok || (isEnvelope(payload) && payload.ok === false)) {
    const err = isEnvelope(payload) && payload.error ? payload.error : null;
    throw new ApiError(err?.message ?? `${res.status} ${res.statusText}`, {
      status: res.status,
      code: err?.code ?? 'HTTP_ERROR',
      details: err?.details,
    });
  }
  if (isEnvelope(payload) && 'data' in payload) return payload.data as T;
  return payload as T;
}

/**
 * Server-Sent Events helper for the Gemini streaming chat endpoint.
 * Returns an async iterable of parsed event objects.
 */
export async function* apiStream(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: unknown }, void, unknown> {
  const auth = await getAuthHeader();
  const base = normalizeBase(API_BASE);
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...auth },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      message = j?.error?.message ?? message;
    } catch {
      /* noop */
    }
    throw new ApiError(message, { status: res.status, code: 'STREAM_ERROR' });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseEvent(raw);
      if (parsed) yield parsed;
    }
  }
}

function parseEvent(raw: string): { event: string; data: unknown } | null {
  const lines = raw.split('\n');
  let event = 'message';
  let dataLine = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return { event, data: dataLine };
  }
}

interface Envelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}
function isEnvelope(x: unknown): x is Envelope {
  return typeof x === 'object' && x !== null && 'ok' in (x as Record<string, unknown>);
}
