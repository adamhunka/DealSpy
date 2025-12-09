-- migration: create app configuration table
-- description: creates the application configuration table for storing system settings
--              such as ai prompts, feature flags, and other runtime configuration.
--              values are stored as jsonb for flexibility.
-- affected: app_config table
-- dependencies: requires moddatetime extension
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- app_config table
-- ============================================================================

-- key-value store for application configuration
-- primarily used for ai prompts that can be updated without code deployment
-- jsonb values allow complex nested configuration structures
create table app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on app_config
  for each row execute function moddatetime(updated_at);

-- enable row level security
alter table app_config enable row level security;

-- anon users cannot read configuration
create policy "anon_cannot_read_config"
  on app_config for select
  to anon
  using (false);

-- authenticated non-admin users cannot read configuration
create policy "authenticated_cannot_read_config"
  on app_config for select
  to authenticated
  using (false);

-- only admins can read configuration
create policy "admins_can_read_config"
  on app_config for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can insert configuration
create policy "admins_can_insert_config"
  on app_config for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update configuration
create policy "admins_can_update_config"
  on app_config for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete configuration
create policy "admins_can_delete_config"
  on app_config for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

