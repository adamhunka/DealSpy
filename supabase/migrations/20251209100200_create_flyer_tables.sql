-- migration: create flyer-related tables (flyers, flyer_pages, products)
-- description: creates the core promotional flyer management tables including
--              flyers with validity dates, individual flyer pages with ai processing,
--              and products with pricing, categories, and bounding box coordinates.
-- affected: flyers, flyer_pages, products tables
-- dependencies: requires stores, categories, profiles tables and flyer_status enum
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- flyers table
-- ============================================================================

-- promotional flyers from retail stores with validity date ranges
-- supports soft delete for operational hiding without data loss
-- status tracks ai processing and admin verification workflow
create table flyers (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  status flyer_status not null default 'draft',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_by uuid references profiles(id) on delete set null,
  
  constraint valid_date_range check (valid_from <= valid_to)
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on flyers
  for each row execute function moddatetime(updated_at);

-- optimize queries by store (e.g., all biedronka flyers)
create index idx_flyers_store_id on flyers(store_id);

-- optimize queries for active flyers (exclude soft-deleted)
create index idx_flyers_deleted_at on flyers(deleted_at) where deleted_at is null;

-- optimize filtering by processing status
create index idx_flyers_status on flyers(status);

-- optimize date-based queries (e.g., flyers valid today)
-- partial index excludes soft-deleted flyers
create index idx_flyers_valid_to on flyers(valid_to) where deleted_at is null;

-- brin index for efficient date range filtering on large datasets
-- brin indexes are space-efficient for chronologically inserted data
create index idx_flyers_valid_range_brin on flyers using brin(valid_from, valid_to);

-- enable row level security
alter table flyers enable row level security;

-- anon users can only read published, active, non-deleted flyers
create policy "anon_can_read_published_flyers"
  on flyers for select
  to anon
  using (
    status = 'published' 
    and deleted_at is null 
    and valid_to >= current_date
  );

-- authenticated users can read published, active, non-deleted flyers
create policy "authenticated_can_read_published_flyers"
  on flyers for select
  to authenticated
  using (
    status = 'published' 
    and deleted_at is null 
    and valid_to >= current_date
  );

-- admins can read all flyers regardless of status or deletion
create policy "admins_can_read_all_flyers"
  on flyers for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can insert flyers
create policy "admins_can_insert_flyers"
  on flyers for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update flyers
create policy "admins_can_update_flyers"
  on flyers for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete flyers
-- warning: cascade delete will remove all associated pages and products
-- consider using soft delete (deleted_at) instead
create policy "admins_can_delete_flyers"
  on flyers for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- flyer_pages table
-- ============================================================================

-- individual pages of flyers with image paths and ai processing results
-- original_image_path: private bucket (raw_flyers) for high-res originals
-- web_image_path: public bucket (public_flyers) for optimized webp versions
-- raw_ai_data: jsonb field storing complete ocr + llm response
create table flyer_pages (
  id uuid primary key default uuid_generate_v4(),
  flyer_id uuid not null references flyers(id) on delete cascade,
  page_number int not null,
  original_image_path text not null,
  web_image_path text,
  status flyer_status not null default 'draft',
  raw_ai_data jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unique_flyer_page unique (flyer_id, page_number),
  constraint page_number_positive check (page_number > 0)
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on flyer_pages
  for each row execute function moddatetime(updated_at);

-- optimize queries by parent flyer
create index idx_flyer_pages_flyer_id on flyer_pages(flyer_id);

-- optimize filtering by processing status
create index idx_flyer_pages_status on flyer_pages(status);

-- gin index enables efficient querying of jsonb structure
-- useful for searching ai response data or debugging
create index idx_flyer_pages_raw_ai_data on flyer_pages using gin(raw_ai_data);

-- enable row level security
alter table flyer_pages enable row level security;

-- anon users can only read pages from published, active flyers
create policy "anon_can_read_published_pages"
  on flyer_pages for select
  to anon
  using (
    status = 'published'
    and exists (
      select 1 from flyers f
      where f.id = flyer_id 
        and f.status = 'published'
        and f.deleted_at is null
        and f.valid_to >= current_date
    )
  );

-- authenticated users can read pages from published, active flyers
create policy "authenticated_can_read_published_pages"
  on flyer_pages for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from flyers f
      where f.id = flyer_id 
        and f.status = 'published'
        and f.deleted_at is null
        and f.valid_to >= current_date
    )
  );

-- admins can read all pages regardless of status
create policy "admins_can_read_all_pages"
  on flyer_pages for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can insert flyer pages
create policy "admins_can_insert_pages"
  on flyer_pages for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update flyer pages
create policy "admins_can_update_pages"
  on flyer_pages for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete flyer pages
-- warning: cascade delete will remove all associated products
create policy "admins_can_delete_pages"
  on flyer_pages for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================================
-- products table
-- ============================================================================

-- promotional products extracted from flyer pages via ai
-- includes pricing, category, text search vectors, and bounding box coordinates
-- name_tsvector: generated column for full-text search (postgres fts)
-- bbox: jsonb object with x, y, width, height for ui overlays
create table products (
  id uuid primary key default uuid_generate_v4(),
  flyer_page_id uuid not null references flyer_pages(id) on delete cascade,
  category_id uuid not null references categories(id),
  name text not null,
  name_tsvector tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored,
  price numeric(10, 2) not null,
  currency char(3) not null default 'PLN',
  unit text,
  description text,
  promo_conditions text,
  bbox jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint price_positive check (price >= 0),
  constraint valid_bbox check (
    bbox is null or (
      jsonb_typeof(bbox) = 'object' and
      bbox ? 'x' and bbox ? 'y' and bbox ? 'width' and bbox ? 'height' and
      (bbox->>'x')::numeric >= 0 and
      (bbox->>'y')::numeric >= 0 and
      (bbox->>'width')::numeric > 0 and
      (bbox->>'height')::numeric > 0
    )
  )
);

-- automatically update updated_at column on row modification
create trigger handle_updated_at before update on products
  for each row execute function moddatetime(updated_at);

-- optimize queries by creation date
create index idx_products_created_at on products(created_at desc);

-- optimize queries by parent flyer page
create index idx_products_flyer_page_id on products(flyer_page_id);

-- optimize filtering by category (e.g., all dairy products)
create index idx_products_category_id on products(category_id);

-- optimize sorting and filtering by price
create index idx_products_price on products(price);

-- gin index for full-text search using generated tsvector column
-- enables fast keyword-based product search in polish language
create index idx_products_name_tsvector on products using gin(name_tsvector);

-- gin index for fuzzy search using trigram similarity
-- enables typo-tolerant search (e.g., "mlko" matches "mleko")
create index idx_products_name_trgm on products using gin(name gin_trgm_ops);

-- gin index for querying bbox jsonb structure
create index idx_products_bbox on products using gin(bbox);

-- enable row level security
alter table products enable row level security;

-- anon users can only read products from published pages and flyers
create policy "anon_can_read_published_products"
  on products for select
  to anon
  using (
    exists (
      select 1 from flyer_pages fp
      inner join flyers f on fp.flyer_id = f.id
      where fp.id = flyer_page_id
        and f.status = 'published'
        and fp.status = 'published'
        and f.deleted_at is null
        and f.valid_to >= current_date
    )
  );

-- authenticated users can read products from published pages and flyers
create policy "authenticated_can_read_published_products"
  on products for select
  to authenticated
  using (
    exists (
      select 1 from flyer_pages fp
      inner join flyers f on fp.flyer_id = f.id
      where fp.id = flyer_page_id
        and f.status = 'published'
        and fp.status = 'published'
        and f.deleted_at is null
        and f.valid_to >= current_date
    )
  );

-- admins can read all products regardless of status
create policy "admins_can_read_all_products"
  on products for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can insert products
create policy "admins_can_insert_products"
  on products for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can update products
create policy "admins_can_update_products"
  on products for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- only admins can delete products
create policy "admins_can_delete_products"
  on products for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

