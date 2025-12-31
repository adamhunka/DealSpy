-- migration: create store logos bucket
-- description: creates public storage bucket for store logos
--              admins can upload/update/delete, everyone can read
-- affected: storage.buckets, storage.objects policies
-- dependencies: requires profiles table
-- author: store management feature
-- date: 2025-12-31

-- ============================================================================
-- store-logos bucket
-- ============================================================================

-- public bucket for store logos
-- admins can manage, everyone can read
insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true);

-- ============================================================================
-- store-logos bucket policies
-- ============================================================================

-- only admins can upload logo files
create policy "admins_can_upload_store_logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-logos' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- everyone can read logo files (including anon)
create policy "anyone_can_read_store_logos"
  on storage.objects for select
  using (bucket_id = 'store-logos');

-- only admins can update logo files
create policy "admins_can_update_store_logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-logos' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete logo files
create policy "admins_can_delete_store_logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-logos' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

