/**
 * Stub the env vars the config module validates so tests don't need a real
 * Supabase or Gemini key. Kept here rather than in individual tests so every
 * test file starts from the same baseline.
 */

process.env.SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key-placeholder-for-unit-tests';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key-placeholder';
process.env.GEMINI_API_KEY ??= 'test-gemini-key-placeholder';
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'error';
