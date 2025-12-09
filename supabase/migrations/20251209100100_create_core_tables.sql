-- migration: create core tables (profiles, stores, categories)
-- description: creates the foundational tables for user profiles with role management,
--              store/retail chain dictionary, and product category taxonomy.
-- affected: profiles, stores, categories tables
-- dependencies: requires uuid-ossp and moddatetime extensions
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- profiles table
-- ============================================================================

-- extends supabase auth.users with role management for admins
-- one-to-one relationship with auth.users
-- cascade delete ensures profile is removed when user is deleted
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on profiles
  for each row execute function moddatetime(updated_at);

-- optimize queries filtering for admin users
create index idx_profiles_role on profiles(role) where role = 'admin';

-- enable row level security
alter table profiles enable row level security;

-- anon users cannot read profiles
create policy "anon_cannot_read_profiles"
  on profiles for select
  to anon
  using (false);

-- authenticated users can read their own profile
create policy "authenticated_can_read_own_profile"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

-- authenticated users cannot insert profiles (managed by triggers)
create policy "authenticated_cannot_insert_profiles"
  on profiles for insert
  to authenticated
  with check (false);

-- authenticated users can update their own profile
create policy "authenticated_can_update_own_profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- authenticated users cannot delete profiles
create policy "authenticated_cannot_delete_profiles"
  on profiles for delete
  to authenticated
  using (false);

-- admins can read all profiles
create policy "admins_can_read_all_profiles"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- stores table
-- ============================================================================

-- dictionary of retail stores/chains (e.g., biedronka, lidl, kaufland)
-- stores contain multiple flyers over time
create table stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on stores
  for each row execute function moddatetime(updated_at);

-- optimize url-based lookups (e.g., /stores/biedronka)
create index idx_stores_slug on stores(slug);

-- enable row level security
alter table stores enable row level security;

-- anon users can read all stores
create policy "anon_can_read_stores"
  on stores for select
  to anon
  using (true);

-- authenticated users can read all stores
create policy "authenticated_can_read_stores"
  on stores for select
  to authenticated
  using (true);

-- only admins can insert stores
create policy "admins_can_insert_stores"
  on stores for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update stores
create policy "admins_can_update_stores"
  on stores for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete stores
-- warning: cascade delete will remove all associated flyers and their data
create policy "admins_can_delete_stores"
  on stores for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- categories table
-- ============================================================================

-- product category taxonomy (e.g., dairy, bakery, fruits & vegetables)
-- categories are predefined and rarely change
-- products must belong to exactly one category
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- optimize url-based lookups (e.g., /categories/nabial-i-jaja)
create index idx_categories_slug on categories(slug);

-- optimize ui rendering by display order
create index idx_categories_display_order on categories(display_order);

-- enable row level security
alter table categories enable row level security;

-- anon users can read all categories
create policy "anon_can_read_categories"
  on categories for select
  to anon
  using (true);

-- authenticated users can read all categories
create policy "authenticated_can_read_categories"
  on categories for select
  to authenticated
  using (true);

-- only admins can insert categories
create policy "admins_can_insert_categories"
  on categories for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update categories
create policy "admins_can_update_categories"
  on categories for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- admins cannot delete categories (products reference them)
-- to remove a category, first reassign all products to another category
create policy "admins_cannot_delete_categories"
  on categories for delete
  to authenticated
  using (false);

