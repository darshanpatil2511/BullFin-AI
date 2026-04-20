-- ============================================================
-- BullFin-AI — Storage buckets for uploaded CSVs and generated PDF reports.
-- Supabase Storage owns the `storage.objects` table and uses RLS on it.
-- ============================================================

-- Bucket: portfolio-uploads (private, CSV uploads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-uploads',
  'portfolio-uploads',
  false,
  5242880, -- 5 MiB
  array['text/csv', 'application/vnd.ms-excel']
)
on conflict (id) do nothing;

-- Bucket: reports (private, generated PDF reports)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  10485760, -- 10 MiB
  array['application/pdf']
)
on conflict (id) do nothing;

-- Bucket: avatars (public, profile pictures)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MiB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- ---- RLS policies ----
-- The storage path convention is `<user_id>/<rest-of-path>` so we can match
-- ownership by the leading path segment.

drop policy if exists "portfolio uploads: owner all" on storage.objects;
create policy "portfolio uploads: owner all"
  on storage.objects for all
  using (
    bucket_id = 'portfolio-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'portfolio-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "reports: owner all" on storage.objects;
create policy "reports: owner all"
  on storage.objects for all
  using (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner write" on storage.objects;
create policy "avatars: owner write"
  on storage.objects for all
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
