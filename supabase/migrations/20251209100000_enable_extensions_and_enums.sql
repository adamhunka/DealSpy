-- migration: enable postgresql extensions and create enum types
-- description: enables required postgresql extensions for uuid generation, 
--              full-text search, fuzzy search, and automatic timestamp updates.
--              creates enum type for flyer and flyer page processing status.
-- affected: extensions, enum types
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- extensions
-- ============================================================================

-- enable uuid generation for primary keys
create extension if not exists "uuid-ossp" schema extensions;

-- enable trigram similarity matching for fuzzy search on product names
create extension if not exists "pg_trgm" schema extensions;

-- enable automatic updated_at column management via triggers
create extension if not exists "moddatetime" schema extensions;

-- ============================================================================
-- enum types
-- ============================================================================

-- status enum for flyers and flyer pages processing workflow
-- draft:        initial status after upload
-- processing:   currently being processed by ai (ocr + llm)
-- verification: ready for admin review and verification
-- published:    approved by admin and visible to public users
create type flyer_status as enum (
  'draft',
  'processing',
  'verification',
  'published'
);

