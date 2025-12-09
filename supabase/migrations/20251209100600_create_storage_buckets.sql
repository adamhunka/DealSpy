-- migration: create storage buckets and policies
-- description: creates two storage buckets for flyer images:
--              - raw_flyers: private bucket for high-resolution originals (admin only)
--              - public_flyers: public bucket for optimized webp versions (public read)
--              configures rls policies for secure access control.
-- affected: storage.buckets, storage.objects policies
-- dependencies: requires profiles table
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- storage buckets
-- ============================================================================

-- private bucket for original high-resolution flyer images
-- only admins can upload, read, and delete files
-- used by ai processing pipeline and admin verification interface
insert into storage.buckets (id, name, public)
values ('raw_flyers', 'raw_flyers', false);

-- public bucket for optimized webp flyer images
-- admins can upload and delete, but everyone can read
-- used by frontend to display flyer pages to end users
insert into storage.buckets (id, name, public)
values ('public_flyers', 'public_flyers', true);

-- ============================================================================
-- raw_flyers bucket policies
-- ============================================================================

-- only admins can upload files to raw_flyers bucket
create policy "admins_can_upload_raw_flyers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'raw_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can read files from raw_flyers bucket
create policy "admins_can_read_raw_flyers"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'raw_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update files in raw_flyers bucket
create policy "admins_can_update_raw_flyers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'raw_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete files from raw_flyers bucket
create policy "admins_can_delete_raw_flyers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'raw_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- public_flyers bucket policies
-- ============================================================================

-- only admins can upload files to public_flyers bucket
create policy "admins_can_upload_public_flyers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'public_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- everyone can read files from public_flyers bucket (including anon)
create policy "anyone_can_read_public_flyers"
  on storage.objects for select
  using (bucket_id = 'public_flyers');

-- only admins can update files in public_flyers bucket
create policy "admins_can_update_public_flyers"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'public_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete files from public_flyers bucket
create policy "admins_can_delete_public_flyers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'public_flyers' and
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

