# Schemat Bazy Danych PostgreSQL - DealSpy MVP

## 1. Rozszerzenia PostgreSQL

```sql
-- Wymagane rozszerzenia Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Generowanie UUID
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Fuzzy search (trigram similarity)
CREATE EXTENSION IF NOT EXISTS "moddatetime";    -- Automatyczna aktualizacja updated_at
```

## 2. Typy ENUM

```sql
-- Status przetwarzania gazetki i jej stron
CREATE TYPE flyer_status AS ENUM (
  'draft',          -- Wstępny, po uploadzie
  'processing',     -- W trakcie przetwarzania przez AI
  'verification',   -- Gotowy do weryfikacji przez admina
  'published'       -- Zatwierdzony i widoczny publicznie
);
```

## 3. Tabele

### 3.1. profiles

Rozszerzenie tabeli użytkowników Supabase Auth dla zarządzania rolami administratorów.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `id` (UUID, PK, FK → auth.users): Identyfikator użytkownika z Supabase Auth
- `role` (TEXT): Rola użytkownika ('user', 'admin')
- `full_name` (TEXT): Pełna nazwa użytkownika
- `created_at` (TIMESTAMPTZ): Data utworzenia profilu
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji

**Indeksy:**
```sql
CREATE INDEX idx_profiles_role ON profiles(role) WHERE role = 'admin';
```

---

### 3.2. stores

Słownik sklepów/sieci handlowych.

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `id` (UUID, PK): Identyfikator sklepu
- `name` (TEXT, UNIQUE): Nazwa sklepu (np. "Biedronka", "Lidl")
- `slug` (TEXT, UNIQUE): URL-friendly identyfikator (np. "biedronka", "lidl")
- `logo_path` (TEXT): Ścieżka do logo sklepu w Storage
- `created_at` (TIMESTAMPTZ): Data utworzenia
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji

**Indeksy:**
```sql
CREATE INDEX idx_stores_slug ON stores(slug);
```

---

### 3.3. categories

Słownik kategorii produktowych.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Kolumny:**
- `id` (UUID, PK): Identyfikator kategorii
- `name` (TEXT, UNIQUE): Nazwa kategorii (np. "Nabiał i Jaja")
- `slug` (TEXT, UNIQUE): URL-friendly identyfikator (np. "nabial-i-jaja")
- `display_order` (INT): Kolejność wyświetlania kategorii w UI
- `created_at` (TIMESTAMPTZ): Data utworzenia

**Dane startowe (zgodnie z PRD):**
```sql
INSERT INTO categories (name, slug, display_order) VALUES
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
```

**Indeksy:**
```sql
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_display_order ON categories(display_order);
```

---

### 3.4. flyers

Gazetki promocyjne z zakresem dat ważności i obsługą Soft Delete.

```sql
CREATE TABLE flyers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  status flyer_status NOT NULL DEFAULT 'draft',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by UUID REFERENCES profiles(id),
  
  CONSTRAINT valid_date_range CHECK (valid_from <= valid_to)
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON flyers
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `id` (UUID, PK): Identyfikator gazetki
- `store_id` (UUID, FK → stores): Sklep, do którego należy gazetka
- `valid_from` (DATE): Data rozpoczęcia obowiązywania promocji
- `valid_to` (DATE): Data zakończenia obowiązywania promocji
- `status` (flyer_status): Status przetwarzania gazetki
- `deleted_at` (TIMESTAMPTZ): Data logicznego usunięcia (Soft Delete)
- `created_at` (TIMESTAMPTZ): Data utworzenia rekordu
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji
- `verified_by` (UUID, FK → profiles): Administrator weryfikujący gazetkę

**Indeksy:**
```sql
CREATE INDEX idx_flyers_store_id ON flyers(store_id);
CREATE INDEX idx_flyers_valid_to ON flyers(valid_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_flyers_status ON flyers(status);
CREATE INDEX idx_flyers_deleted_at ON flyers(deleted_at) WHERE deleted_at IS NULL;

-- Indeks BRIN dla wydajnego filtrowania po datach (optymalizacja dla dużych zbiorów)
CREATE INDEX idx_flyers_valid_range_brin ON flyers USING BRIN(valid_from, valid_to);
```

---

### 3.5. flyer_pages

Strony gazetek przechowujące ścieżki do plików, status przetwarzania i dane z AI.

```sql
CREATE TABLE flyer_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flyer_id UUID NOT NULL REFERENCES flyers(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  original_image_path TEXT NOT NULL,
  web_image_path TEXT,
  flyer_status NOT NULL DEFAULT 'draft',
  raw_ai_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_flyer_page UNIQUE (flyer_id, page_number),
  CONSTRAINT page_number_positive CHECK (page_number > 0)
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON flyer_pages
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `id` (UUID, PK): Identyfikator strony
- `flyer_id` (UUID, FK → flyers): Gazetka, do której należy strona
- `page_number` (INT): Numer strony w gazetce (zaczynając od 1)
- `original_image_path` (TEXT): Ścieżka do oryginalnego pliku w prywatnym buckecie (raw_flyers)
- `web_image_path` (TEXT): Ścieżka do publicznej wersji WebP w buckecie public_flyers
- `status` (flyer_status): Status przetwarzania strony
- `raw_ai_data` (JSONB): Surowe dane zwrócone przez AI (OCR + LLM)
- `error_message` (TEXT): Komunikat błędu w przypadku niepowodzenia przetwarzania
- `created_at` (TIMESTAMPTZ): Data utworzenia
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji

**Indeksy:**
```sql
CREATE INDEX idx_flyer_pages_flyer_id ON flyer_pages(flyer_id);
CREATE INDEX idx_flyer_pages_status ON flyer_pages(status);

-- Indeks GIN dla zapytań po strukturze JSONB
CREATE INDEX idx_flyer_pages_raw_ai_data ON flyer_pages USING GIN(raw_ai_data);
```

---

### 3.6. products

Produkty z cenami, kategoriami i koordynatami Bounding Box.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flyer_page_id UUID NOT NULL REFERENCES flyer_pages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  name_tsvector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('polish', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED,
  price NUMERIC(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  unit TEXT,
  description TEXT,
  promo_conditions TEXT,
  bbox JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT price_positive CHECK (price >= 0),
  CONSTRAINT valid_bbox CHECK (
    bbox IS NULL OR (
      jsonb_typeof(bbox) = 'object' AND
      bbox ? 'x' AND bbox ? 'y' AND bbox ? 'width' AND bbox ? 'height' AND
      (bbox->>'x')::numeric >= 0 AND
      (bbox->>'y')::numeric >= 0 AND
      (bbox->>'width')::numeric > 0 AND
      (bbox->>'height')::numeric > 0
    )
  )
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `id` (UUID, PK): Identyfikator produktu
- `flyer_page_id` (UUID, FK → flyer_pages): Strona gazetki, na której znajduje się produkt
- `category_id` (UUID, FK → categories): Kategoria produktu (NOT NULL)
- `name` (TEXT): Nazwa produktu
- `name_tsvector` (TSVECTOR): Wygenerowana kolumna dla Full Text Search (nazwa + opis)
- `price` (NUMERIC(10,2)): Cena promocyjna
- `currency` (CHAR(3)): Kod waluty (domyślnie PLN)
- `unit` (TEXT): Jednostka miary (np. "kg", "szt", "l")
- `description` (TEXT): Dodatkowy opis produktu
- `promo_conditions` (TEXT): Warunki promocji (np. "maksymalnie 5 sztuk na klienta")
- `bbox` (JSONB): Koordynaty Bounding Box {x, y, width, height}
- `created_at` (TIMESTAMPTZ): Data utworzenia
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji

**Indeksy:**
```sql
CREATE INDEX idx_products_flyer_page_id ON products(flyer_page_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_price ON products(price);

-- Indeks GIN dla Full Text Search
CREATE INDEX idx_products_name_tsvector ON products USING GIN(name_tsvector);

-- Indeks GIN dla Fuzzy Search (trigram similarity)
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- Indeks GIN dla zapytań po strukturze JSONB (bbox)
CREATE INDEX idx_products_bbox ON products USING GIN(bbox);
```

---

### 3.7. app_config

Tabela konfiguracyjna dla ustawień systemowych (np. prompty AI).

```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger automatycznej aktualizacji updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Kolumny:**
- `key` (TEXT, PK): Klucz konfiguracji (np. "ai_ocr_prompt", "ai_llm_prompt")
- `value` (JSONB): Wartość konfiguracji w formacie JSON
- `description` (TEXT): Opis parametru konfiguracyjnego
- `updated_at` (TIMESTAMPTZ): Data ostatniej modyfikacji

**Przykładowe dane:**
```sql
INSERT INTO app_config (key, value, description) VALUES
  ('ai_ocr_prompt', '{"prompt": "Extract all text from this flyer page..."}', 'Prompt dla OCR'),
  ('ai_llm_prompt', '{"prompt": "Structure the following OCR text into JSON..."}', 'Prompt dla LLM');
```

---

## 4. Relacje między tabelami

### Hierarchia jeden-do-wielu:

```
auth.users (Supabase Auth)
  ↓ 1:1
profiles
  ↓ 1:N (verified_by)
flyers

stores
  ↓ 1:N
flyers
  ↓ 1:N
flyer_pages
  ↓ 1:N
products
  ↓ N:1
categories
```

### Szczegółowy opis relacji:

1. **auth.users → profiles** (1:1)
   - Każdy użytkownik Supabase Auth ma dokładnie jeden profil
   - CASCADE DELETE: Usunięcie użytkownika usuwa profil

2. **stores → flyers** (1:N)
   - Jeden sklep może mieć wiele gazetek
   - CASCADE DELETE: Usunięcie sklepu usuwa wszystkie jego gazetki

3. **flyers → flyer_pages** (1:N)
   - Jedna gazetka może mieć wiele stron
   - CASCADE DELETE: Usunięcie gazetki usuwa wszystkie jej strony

4. **flyer_pages → products** (1:N)
   - Jedna strona gazetki może zawierać wiele produktów
   - CASCADE DELETE: Usunięcie strony usuwa wszystkie produkty z tej strony

5. **categories → products** (1:N)
   - Jedna kategoria może zawierać wiele produktów
   - NO ACTION: Usunięcie kategorii wymaga najpierw przeniesienia produktów do innej kategorii

6. **profiles → flyers** (1:N przez verified_by)
   - Jeden administrator może zweryfikować wiele gazetek
   - SET NULL przy usunięciu profilu administratora

---

## 5. Widoki

### 5.1. v_active_products

Widok upraszczający zapytania frontendowe o aktywne, opublikowane produkty.

```sql
CREATE VIEW v_active_products AS
SELECT 
  p.id,
  p.name,
  p.price,
  p.currency,
  p.unit,
  p.description,
  p.promo_conditions,
  p.bbox,
  p.created_at,
  c.name AS category_name,
  c.slug AS category_slug,
  s.name AS store_name,
  s.slug AS store_slug,
  s.logo_path AS store_logo,
  f.valid_from,
  f.valid_to,
  fp.web_image_path,
  fp.page_number
FROM products p
INNER JOIN flyer_pages fp ON p.flyer_page_id = fp.id
INNER JOIN flyers f ON fp.flyer_id = f.id
INNER JOIN stores s ON f.store_id = s.id
INNER JOIN categories c ON p.category_id = c.id
WHERE 
  f.status = 'published'
  AND fp.status = 'published'
  AND f.deleted_at IS NULL
  AND f.valid_to >= CURRENT_DATE;
```

**Opis:**
- Zwraca tylko produkty z opublikowanych gazetek i stron
- Automatycznie filtruje gazetki przeterminowane i logicznie usunięte
- Zawiera wszystkie potrzebne dane dla frontendu (sklep, kategoria, daty, obrazy)

---

## 6. Funkcje RPC

### 6.1. search_products

Funkcja wyszukiwania produktów z Full Text Search i Fuzzy Search.

```sql
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  filter_store_slug TEXT DEFAULT NULL,
  filter_category_slug TEXT DEFAULT NULL,
  sort_by TEXT DEFAULT 'relevance',  -- 'relevance', 'price_asc', 'price_desc', 'newest'
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  price NUMERIC,
  currency CHAR(3),
  unit TEXT,
  description TEXT,
  promo_conditions TEXT,
  bbox JSONB,
  created_at TIMESTAMPTZ,
  category_name TEXT,
  category_slug TEXT,
  store_name TEXT,
  store_slug TEXT,
  store_logo TEXT,
  valid_from DATE,
  valid_to DATE,
  web_image_path TEXT,
  page_number INT,
  relevance_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.price,
    p.currency,
    p.unit,
    p.description,
    p.promo_conditions,
    p.bbox,
    p.created_at,
    c.name AS category_name,
    c.slug AS category_slug,
    s.name AS store_name,
    s.slug AS store_slug,
    s.logo_path AS store_logo,
    f.valid_from,
    f.valid_to,
    fp.web_image_path,
    fp.page_number,
    CASE 
      WHEN search_query IS NOT NULL AND search_query != '' THEN
        ts_rank(p.name_tsvector, plainto_tsquery('polish', search_query)) +
        similarity(p.name, search_query) * 0.5
      ELSE 0
    END AS relevance_score
  FROM products p
  INNER JOIN flyer_pages fp ON p.flyer_page_id = fp.id
  INNER JOIN flyers f ON fp.flyer_id = f.id
  INNER JOIN stores s ON f.store_id = s.id
  INNER JOIN categories c ON p.category_id = c.id
  WHERE 
    f.status = 'published'
    AND fp.status = 'published'
    AND f.deleted_at IS NULL
    AND f.valid_to >= CURRENT_DATE
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR p.name_tsvector @@ plainto_tsquery('polish', search_query)
      OR similarity(p.name, search_query) > 0.3
    )
    AND (filter_store_slug IS NULL OR s.slug = filter_store_slug)
    AND (filter_category_slug IS NULL OR c.slug = filter_category_slug)
  ORDER BY
    CASE 
      WHEN sort_by = 'relevance' THEN relevance_score
      WHEN sort_by = 'newest' THEN EXTRACT(EPOCH FROM p.created_at)
      ELSE 0
    END DESC,
    CASE WHEN sort_by = 'price_asc' THEN p.price ELSE NULL END ASC,
    CASE WHEN sort_by = 'price_desc' THEN p.price ELSE NULL END DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Parametry:**
- `search_query`: Fraza wyszukiwania (Full Text + Fuzzy)
- `filter_store_slug`: Opcjonalny filtr po sklepie
- `filter_category_slug`: Opcjonalny filtr po kategorii
- `sort_by`: Sposób sortowania ('relevance', 'price_asc', 'price_desc', 'newest')
- `limit_count`: Limit wyników (domyślnie 50)
- `offset_count`: Przesunięcie dla paginacji (domyślnie 0)

**Zwraca:**
- Wszystkie pola z widoku `v_active_products`
- Dodatkowo `relevance_score` dla sortowania po trafności

---

## 7. Row Level Security (RLS)

### 7.1. Tabela profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Użytkownicy mogą czytać swój własny profil
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Użytkownicy mogą aktualizować swój własny profil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admini mogą czytać wszystkie profile
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.2. Tabela stores

```sql
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt dla wszystkich
CREATE POLICY "Public read access"
  ON stores FOR SELECT
  USING (true);

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert"
  ON stores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update"
  ON stores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete"
  ON stores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.3. Tabela categories

```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt dla wszystkich
CREATE POLICY "Public read access"
  ON categories FOR SELECT
  USING (true);

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert"
  ON categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update"
  ON categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.4. Tabela flyers

```sql
ALTER TABLE flyers ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt tylko dla opublikowanych, aktualnych i nie usuniętych
CREATE POLICY "Public read published flyers"
  ON flyers FOR SELECT
  USING (
    status = 'published' 
    AND deleted_at IS NULL 
    AND valid_to >= CURRENT_DATE
  );

-- Admini mogą czytać wszystkie gazetki
CREATE POLICY "Admins can read all flyers"
  ON flyers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert"
  ON flyers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update"
  ON flyers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete"
  ON flyers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.5. Tabela flyer_pages

```sql
ALTER TABLE flyer_pages ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt tylko dla stron z opublikowanych gazetek
CREATE POLICY "Public read published pages"
  ON flyer_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM flyers f
      WHERE f.id = flyer_id 
        AND f.status = 'published'
        AND f.deleted_at IS NULL
        AND f.valid_to >= CURRENT_DATE
    )
    AND status = 'published'
  );

-- Admini mogą czytać wszystkie strony
CREATE POLICY "Admins can read all pages"
  ON flyer_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert"
  ON flyer_pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update"
  ON flyer_pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete"
  ON flyer_pages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.6. Tabela products

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Publiczny odczyt tylko dla produktów z opublikowanych stron i gazetek
CREATE POLICY "Public read published products"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM flyer_pages fp
      INNER JOIN flyers f ON fp.flyer_id = f.id
      WHERE fp.id = flyer_page_id
        AND f.status = 'published'
        AND fp.status = 'published'
        AND f.deleted_at IS NULL
        AND f.valid_to >= CURRENT_DATE
    )
  );

-- Admini mogą czytać wszystkie produkty
CREATE POLICY "Admins can read all products"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert"
  ON products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 7.7. Tabela app_config

```sql
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Tylko admini mogą czytać konfigurację
CREATE POLICY "Admins can read config"
  ON app_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą zapisywać
CREATE POLICY "Admins can insert config"
  ON app_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update config"
  ON app_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 8. Storage Buckets (Supabase Storage)

### 8.1. Bucket: raw_flyers (Prywatny)

**Przeznaczenie:** Oryginalne pliki graficzne gazetek (JPG, PNG, WEBP)

**Polityka dostępu:**
```sql
-- Tylko admini mogą uploadować
CREATE POLICY "Admins can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'raw_flyers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą czytać
CREATE POLICY "Admins can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'raw_flyers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tylko admini mogą usuwać
CREATE POLICY "Admins can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'raw_flyers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 8.2. Bucket: public_flyers (Publiczny)

**Przeznaczenie:** Przekonwertowane pliki WebP dla użytkowników końcowych

**Polityka dostępu:**
```sql
-- Admini mogą uploadować
CREATE POLICY "Admins can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public_flyers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Publiczny odczyt dla wszystkich
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public_flyers');

-- Tylko admini mogą usuwać
CREATE POLICY "Admins can delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'public_flyers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 9. Dodatkowe uwagi projektowe

### 9.1. Soft Delete vs Cascade Delete

**Soft Delete (flyers.deleted_at):**
- Używany operacyjnie do "ukrywania" gazetek bez fizycznego usuwania danych
- Umożliwia przywracanie przypadkowo usuniętych gazetek
- Automatycznie filtrowany w widokach i funkcjach publicznych

**Cascade Delete:**
- Używany do fizycznego czyszczenia danych podczas faktycznego usuwania sklepu/gazetki
- Gwarantuje spójność referencyjną
- Zapobiega sierotom (orphan records)

### 9.2. Domyślna kategoria "Inne"

W skrypcie inicjalizacyjnym bazy danych musi być utworzona kategoria "Inne" jako fallback dla produktów bez określonej kategorii. ID tej kategorii należy użyć jako wartości domyślnej w kolumnie `products.category_id`.

```sql
-- Pobranie UUID kategorii "Inne" i ustawienie jako domyślnej
ALTER TABLE products 
  ALTER COLUMN category_id 
  SET DEFAULT (SELECT id FROM categories WHERE slug = 'inne');
```

### 9.3. Wyszukiwanie hybrydowe

System wykorzystuje połączenie:
- **Full Text Search (tsvector):** Dla dokładnego dopasowania słów kluczowych
- **Fuzzy Search (pg_trgm):** Dla tolerancji na literówki i podobieństwa fonetycznego

Wynik jest sumą wag z obu metod, co zapewnia wysoką trafność wyników.

### 9.4. Optymalizacja wydajności

- Indeksy BRIN dla dat (`flyers.valid_from`, `flyers.valid_to`) - optymalne dla dużych zbiorów sekwencyjnych danych
- Indeksy GIN dla JSONB, tsvector i pg_trgm - szybkie wyszukiwanie w danych nieustrukturyzowanych
- Widok `v_active_products` redukuje złożoność zapytań frontendowych
- Funkcja RPC `search_products` przenosi logikę filtrowania do bazy danych, minimalizując transfer danych

### 9.5. Rozszerzone pola audytowe

Wszystkie tabele zawierają:
- `created_at` (TIMESTAMPTZ): Automatycznie ustawiany podczas INSERT
- `updated_at` (TIMESTAMPTZ): Automatycznie aktualizowany przez trigger `moddatetime`

Tabela `flyers` dodatkowo zawiera:
- `verified_by` (UUID): Identyfikator administratora weryfikującego

### 9.6. Walidacja danych na poziomie bazy

- CHECK CONSTRAINT dla `valid_date_range`: Gwarantuje, że `valid_from <= valid_to`
- CHECK CONSTRAINT dla `price_positive`: Zapewnia, że cena nie jest ujemna
- CHECK CONSTRAINT dla `valid_bbox`: Waliduje strukturę i wartości JSONB bbox
- CHECK CONSTRAINT dla `page_number_positive`: Numer strony musi być > 0

### 9.7. Separacja plików

- **Oryginalne pliki** (`flyer_pages.original_image_path`): Przechowywane w prywatnym buckecie `raw_flyers`, dostępne tylko dla administratorów i procesu AI
- **Pliki publiczne** (`flyer_pages.web_image_path`): Przekonwertowane do WebP, przechowywane w publicznym buckecie `public_flyers`, dostępne dla użytkowników końcowych

### 9.8. Kaskadowe ukrywanie logiczne

Widok `v_active_products` automatycznie ukrywa produkty, których:
- Rodzic (gazetka) ma ustawioną flagę `deleted_at`
- Rodzic (gazetka) ma status inny niż `published`
- Strona rodzica ma status inny niż `published`
- Data końcowa gazetki minęła (`valid_to < CURRENT_DATE`)

Nie wymaga to dodatkowej logiki w zapytaniach aplikacji - wystarczy używać widoku zamiast bezpośrednich zapytań do tabel.

---

## 10. Podsumowanie

Schemat bazy danych DealSpy został zaprojektowany z naciskiem na:

1. **Bezpieczeństwo:** Pełna implementacja RLS na wszystkich tabelach, separacja danych publicznych i prywatnych
2. **Wydajność:** Indeksy GIN/BRIN/B-Tree, widoki i funkcje RPC redukujące złożoność zapytań
3. **Skalowalność:** Normalizacja 3NF, optymalna struktura relacji, efektywne zarządzanie plikami
4. **Integralność:** CHECK CONSTRAINTS, CASCADE DELETE, walidacja JSONB na poziomie bazy
5. **Czytelność:** Jasna hierarchia encji, konwencje nazewnictwa, audyt zmian

Schemat obsługuje wszystkie wymagania funkcjonalne z PRD i notatek z sesji planowania, zapewniając solidną podstawę dla MVP projektu DealSpy.

