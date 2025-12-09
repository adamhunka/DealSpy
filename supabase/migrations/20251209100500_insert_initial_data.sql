-- migration: insert initial category data
-- description: populates the categories table with predefined product categories
--              as specified in the prd. categories are displayed in ui according
--              to display_order. the "inne" (other) category serves as fallback.
-- affected: categories table (insert only)
-- dependencies: requires categories table
-- author: database schema initialization
-- date: 2025-12-09

-- ============================================================================
-- initial categories
-- ============================================================================

-- insert predefined product categories with display order
-- these categories cover all typical grocery store product types
-- display_order determines ui sorting (lower numbers appear first)
insert into categories (name, slug, display_order) values
  ('Nabiał i Jaja', 'nabial-i-jaja', 1),
  ('Pieczywo i Cukiernia', 'pieczywo-i-cukiernia', 2),
  ('Owoce i Warzywa', 'owoce-i-warzywa', 3),
  ('Mięso i Wędliny', 'mieso-i-wedliny', 4),
  ('Ryby i Owoce Morza', 'ryby-i-owoce-morza', 5),
  ('Napoje i Alkohol', 'napoje-i-alkohol', 6),
  ('Słodycze i Przekąski', 'slodycze-i-przekaski', 7),
  ('Produkty sypkie i Dania gotowe', 'produkty-sypkie-i-dania-gotowe', 8),
  ('Mrożonki', 'mrozonki', 9),
  ('Chemia i Kosmetyki', 'chemia-i-kosmetyki', 10),
  ('Dla Domu i Zwierząt', 'dla-domu-i-zwierzat', 11),
  ('Inne', 'inne', 99);

-- ============================================================================
-- initial app configuration
-- ============================================================================

-- insert default ai prompts for ocr and llm processing
-- these can be updated by admins through the ui without code changes
insert into app_config (key, value, description) values
  (
    'ai_ocr_prompt',
    '{"prompt": "Extract all text from this flyer page including product names, prices, units, and promotional information. Preserve the exact text as it appears."}',
    'Prompt for OCR text extraction from flyer images'
  ),
  (
    'ai_llm_prompt',
    '{"prompt": "Structure the following OCR text into JSON format. Extract individual products with fields: name, price, currency, unit, description, promo_conditions, and bounding box coordinates (x, y, width, height). Categorize each product into one of the predefined categories."}',
    'Prompt for LLM structuring of OCR text into product data'
  );

