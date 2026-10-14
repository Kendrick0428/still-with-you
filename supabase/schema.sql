-- Still With You: account data.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each person can only ever read or change their own row.
alter table public.user_data enable row level security;

drop policy if exists "Read own data" on public.user_data;
create policy "Read own data" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Insert own data" on public.user_data;
create policy "Insert own data" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own data" on public.user_data;
create policy "Update own data" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own data" on public.user_data;
create policy "Delete own data" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Memory Vault photos, videos and recordings: a private bucket with one folder per person (named by their user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault', 'vault', false, 52428800, array['image/*', 'video/*', 'audio/*'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Vault: read own files" on storage.objects;
create policy "Vault: read own files" on storage.objects
  for select to authenticated using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Vault: add own files" on storage.objects;
create policy "Vault: add own files" on storage.objects
  for insert to authenticated with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Vault: replace own files" on storage.objects;
create policy "Vault: replace own files" on storage.objects
  for update to authenticated using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Vault: delete own files" on storage.objects;
create policy "Vault: delete own files" on storage.objects
  for delete to authenticated using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);
