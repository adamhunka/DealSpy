-- migration: create database views and rpc functions
-- description: creates the v_active_products view for simplified frontend queries
--              and the search_products rpc function for full-text and fuzzy search.
-- affected: v_active_products view, search_products function
-- dependencies: requires all core tables and indexes
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- v_active_products view
-- ============================================================================

-- materialized view of active products with all related data
-- simplifies frontend queries by joining products with stores, categories, flyers
-- automatically filters for published, active, non-deleted content
-- returns all necessary data for product display in ui
-- security invoker ensures rls policies of querying user are enforced
create view v_active_products
with (security_invoker = true) as
select 
  p.id,
  p.name,
  p.price,
  p.currency,
  p.unit,
  p.description,
  p.promo_conditions,
  p.bbox,
  p.created_at,
  c.name as category_name,
  c.slug as category_slug,
  s.name as store_name,
  s.slug as store_slug,
  s.logo_path as store_logo,
  f.valid_from,
  f.valid_to,
  fp.web_image_path,
  fp.page_number
from products p
inner join flyer_pages fp on p.flyer_page_id = fp.id
inner join flyers f on fp.flyer_id = f.id
inner join stores s on f.store_id = s.id
inner join categories c on p.category_id = c.id
where 
  -- only include published flyers and pages
  f.status = 'published'
  and fp.status = 'published'
  -- exclude soft-deleted flyers
  and f.deleted_at is null
  -- exclude expired flyers
  and f.valid_to >= current_date;

-- ============================================================================
-- search_products rpc function
-- ============================================================================

-- advanced product search function combining full-text and fuzzy search
-- parameters:
--   search_query: text phrase to search in product names and descriptions
--   filter_store_slug: optional store filter (e.g., 'biedronka')
--   filter_category_slug: optional category filter (e.g., 'nabial-i-jaja')
--   sort_by: sorting method ('relevance', 'price_asc', 'price_desc', 'newest')
--   limit_count: maximum number of results (default 50)
--   offset_count: pagination offset (default 0)
-- returns: table with product data and relevance score
-- search strategy:
--   - full-text search using tsvector for exact word matching
--   - fuzzy search using trigram similarity for typo tolerance (min 0.3 similarity)
--   - combined relevance score: ts_rank + (similarity * 0.5)
-- security: search_path is set to prevent sql injection attacks
create or replace function search_products(
  search_query text,
  filter_store_slug text default null,
  filter_category_slug text default null,
  sort_by text default 'relevance',
  limit_count int default 50,
  offset_count int default 0
)
returns table (
  id uuid,
  name text,
  price numeric,
  currency char(3),
  unit text,
  description text,
  promo_conditions text,
  bbox jsonb,
  created_at timestamptz,
  category_name text,
  category_slug text,
  store_name text,
  store_slug text,
  store_logo text,
  valid_from date,
  valid_to date,
  web_image_path text,
  page_number int,
  relevance_score real
) as $$
begin
  return query
  select 
    p.id,
    p.name,
    p.price,
    p.currency,
    p.unit,
    p.description,
    p.promo_conditions,
    p.bbox,
    p.created_at,
    c.name as category_name,
    c.slug as category_slug,
    s.name as store_name,
    s.slug as store_slug,
    s.logo_path as store_logo,
    f.valid_from,
    f.valid_to,
    fp.web_image_path,
    fp.page_number,
    case 
      when search_query is not null and search_query != '' then
        -- combine full-text search rank with trigram similarity
        -- ts_rank returns value 0-1 based on word frequency and position
        -- similarity returns value 0-1 based on trigram matching
        ts_rank(p.name_tsvector, plainto_tsquery('simple', search_query)) +
        similarity(p.name, search_query) * 0.5
      else 0
    end as relevance_score
  from products p
  inner join flyer_pages fp on p.flyer_page_id = fp.id
  inner join flyers f on fp.flyer_id = f.id
  inner join stores s on f.store_id = s.id
  inner join categories c on p.category_id = c.id
  where 
    -- only include published and active content
    f.status = 'published'
    and fp.status = 'published'
    and f.deleted_at is null
    and f.valid_to >= current_date
    -- apply search filters
    and (
      search_query is null 
      or search_query = '' 
      -- match using full-text search
      or p.name_tsvector @@ plainto_tsquery('simple', search_query)
      -- or match using fuzzy search (minimum 30% similarity)
      or similarity(p.name, search_query) > 0.3
    )
    -- apply optional store filter
    and (filter_store_slug is null or s.slug = filter_store_slug)
    -- apply optional category filter
    and (filter_category_slug is null or c.slug = filter_category_slug)
  order by
    -- sort by relevance or newest first (descending)
    case 
      when sort_by = 'relevance' then relevance_score
      when sort_by = 'newest' then extract(epoch from p.created_at)
      else 0
    end desc,
    -- sort by price ascending
    case when sort_by = 'price_asc' then p.price else null end asc,
    -- sort by price descending
    case when sort_by = 'price_desc' then p.price else null end desc
  limit limit_count
  offset offset_count;
end;
$$ language plpgsql stable
set search_path = public, extensions;

