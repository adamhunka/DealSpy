# API Endpoint Implementation Plan: Products API

## 1. Przegląd punktów końcowych

Implementacja trzech publicznych endpointów API do przeglądania i wyszukiwania produktów promocyjnych z gazetek:

- **GET /api/products** - Wyszukiwanie i filtrowanie produktów z pełną funkcjonalnością full-text search i fuzzy search
- **GET /api/products/:id** - Szczegóły pojedynczego produktu
- **GET /api/products/recent** - Lista ostatnio dodanych produktów

Wszystkie endpointy są publiczne (bez autentykacji), zwracają tylko aktywne i opublikowane produkty z niewygas­łych gazetek, wykorzystują view `v_active_products` oraz RPC function `search_products()` dla wydajnego wyszukiwania.

## 2. Szczegóły żądań

### 2.1. GET /api/products

**Metoda HTTP:** GET

**Struktura URL:** `/api/products`

**Query Parameters:**

Wymagane:
- Brak

Opcjonalne:
- `q` (string) - Zapytanie wyszukiwania (full-text + fuzzy search), max 200 znaków
- `store` (string) - Filtrowanie po slug sklepu (format: `[a-z0-9-]+`)
- `category` (string) - Filtrowanie po slug kategorii (format: `[a-z0-9-]+`)
- `sort` (string) - Metoda sortowania:
  - `relevance` - sortowanie po trafności (domyślne gdy `q` podane)
  - `newest` - sortowanie po dacie dodania (domyślne gdy brak `q`)
  - `price_asc` - sortowanie po cenie rosnąco
  - `price_desc` - sortowanie po cenie malejąco
- `limit` (integer) - Liczba wyników na stronę (domyślnie: 20, max: 100, min: 1)
- `offset` (integer) - Przesunięcie dla paginacji (domyślnie: 0, min: 0)

**Request Body:** N/A (GET request)

**Przykładowe zapytania:**
```
GET /api/products?q=masło&limit=20
GET /api/products?category=nabial-i-jaja&sort=price_asc
GET /api/products?store=biedronka&category=nabial-i-jaja&limit=50
```

### 2.2. GET /api/products/:id

**Metoda HTTP:** GET

**Struktura URL:** `/api/products/:id`

**Path Parameters:**

Wymagane:
- `id` (UUID) - Identyfikator produktu w formacie UUID

**Query Parameters:** Brak

**Request Body:** N/A (GET request)

**Przykładowe zapytanie:**
```
GET /api/products/550e8400-e29b-41d4-a716-446655440000
```

### 2.3. GET /api/products/recent

**Metoda HTTP:** GET

**Struktura URL:** `/api/products/recent`

**Query Parameters:**

Wymagane:
- Brak

Opcjonalne:
- `limit` (integer) - Liczba produktów do zwrócenia (domyślnie: 10, max: 50, min: 1)

**Request Body:** N/A (GET request)

**Przykładowe zapytanie:**
```
GET /api/products/recent?limit=20
```

## 3. Wykorzystywane typy

### 3.1. DTOs (z src/types.ts)

**ProductDTO** - Bazowa reprezentacja produktu:
```typescript
interface ProductDTO {
  // Dane z products
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  description: string | null;
  promo_conditions: string | null;
  bbox: BBox | null;
  created_at: string;
  
  // Dane z categories
  category_name: string;
  category_slug: string;
  
  // Dane z stores (przez flyers)
  store_name: string;
  store_slug: string;
  store_logo: string;
  
  // Dane z flyers
  valid_from: string;
  valid_to: string;
  
  // Dane z flyer_pages
  web_image_url: string;
  page_number: number;
}
```

**ProductSearchDTO** - Produkt w wynikach wyszukiwania (extends ProductDTO):
```typescript
interface ProductSearchDTO extends ProductDTO {
  relevance_score: number;
}
```

**ProductRecentDTO** - Produkt na liście "ostatnio dodane" (Omit z ProductDTO):
```typescript
type ProductRecentDTO = Omit<ProductDTO, "bbox" | "description" | "promo_conditions">;
```

**BBox** - Współrzędne produktu na obrazku gazetki:
```typescript
interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**ApiResponse<T>** - Standardowy wrapper odpowiedzi:
```typescript
interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}
```

**PaginationMeta** - Metadane paginacji:
```typescript
interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  has_more?: boolean;
}
```

**ProductSearchParams** - Parametry wyszukiwania:
```typescript
interface ProductSearchParams extends PaginationParams {
  q?: string;
  store?: string;
  category?: string;
  sort?: SortOption;
}
```

**SortOption** - Opcje sortowania:
```typescript
type SortOption = "relevance" | "newest" | "price_asc" | "price_desc";
```

### 3.2. Validation Schemas (do stworzenia w src/lib/schemas/product.schema.ts)

**productIdParamSchema** - Walidacja UUID produktu:
```typescript
export const productIdParamSchema = z.object({
  id: z
    .string({ required_error: "Product ID is required" })
    .uuid("Invalid product ID format")
});

export type ProductIdParams = z.infer<typeof productIdParamSchema>;
```

**productSearchQuerySchema** - Walidacja query params dla wyszukiwania:
```typescript
export const productSearchQuerySchema = z.object({
  q: z
    .string()
    .max(200, "Search query is too long")
    .optional(),
  store: slugSchema.optional(),
  category: slugSchema.optional(),
  sort: z
    .enum(["relevance", "newest", "price_asc", "price_desc"])
    .optional(),
  limit: z.coerce
    .number({ invalid_type_error: "Limit must be a number" })
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20),
  offset: z.coerce
    .number({ invalid_type_error: "Offset must be a number" })
    .int("Offset must be an integer")
    .min(0, "Offset cannot be negative")
    .default(0)
});

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
```

**productRecentQuerySchema** - Walidacja query params dla recent:
```typescript
export const productRecentQuerySchema = z.object({
  limit: z.coerce
    .number({ invalid_type_error: "Limit must be a number" })
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(10)
});

export type ProductRecentQuery = z.infer<typeof productRecentQuerySchema>;
```

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/products

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Masło Extra 200g",
      "price": 4.99,
      "currency": "PLN",
      "unit": "szt",
      "description": "Masło ekstra z polskiego mleka",
      "promo_conditions": "Maksymalnie 3 sztuki na klienta",
      "bbox": {
        "x": 120,
        "y": 340,
        "width": 280,
        "height": 320
      },
      "category_name": "Nabiał i Jaja",
      "category_slug": "nabial-i-jaja",
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "store_logo": "https://[url]/store-logos/biedronka.webp",
      "valid_from": "2025-01-10",
      "valid_to": "2025-01-16",
      "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
      "page_number": 1,
      "relevance_score": 0.87,
      "created_at": "2025-01-09T12:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 156
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      {
        "field": "limit",
        "message": "Limit cannot exceed 100"
      }
    ]
  }
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to search products"
  }
}
```

### 4.2. GET /api/products/:id

**Response 200 OK:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Masło Extra 200g",
    "price": 4.99,
    "currency": "PLN",
    "unit": "szt",
    "description": "Masło ekstra z polskiego mleka",
    "promo_conditions": "Maksymalnie 3 sztuki na klienta",
    "bbox": {
      "x": 120,
      "y": 340,
      "width": 280,
      "height": 320
    },
    "category_name": "Nabiał i Jaja",
    "category_slug": "nabial-i-jaja",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "store_logo": "https://[url]/store-logos/biedronka.webp",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
    "page_number": 1,
    "created_at": "2025-01-09T12:00:00Z"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid product ID",
    "details": [
      {
        "field": "id",
        "message": "Invalid product ID format"
      }
    ]
  }
}
```

**Response 404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch product"
  }
}
```

### 4.3. GET /api/products/recent

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Masło Extra 200g",
      "price": 4.99,
      "currency": "PLN",
      "unit": "szt",
      "category_name": "Nabiał i Jaja",
      "category_slug": "nabial-i-jaja",
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "store_logo": "https://[url]/store-logos/biedronka.webp",
      "valid_from": "2025-01-10",
      "valid_to": "2025-01-16",
      "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
      "page_number": 1,
      "created_at": "2025-01-09T12:00:00Z"
    }
  ]
}
```

**Response 400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      {
        "field": "limit",
        "message": "Limit cannot exceed 50"
      }
    ]
  }
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch recent products"
  }
}
```

## 5. Przepływ danych

### 5.1. GET /api/products - Wyszukiwanie produktów

```
1. Request → Astro API Route Handler (GET)
   ↓
2. Walidacja query params przez Zod (productSearchQuerySchema)
   ↓ (jeśli invalid)
   └→ Return 400 Bad Request z details
   ↓ (jeśli valid)
3. Pobranie Supabase client z locals
   ↓ (jeśli brak)
   └→ Return 500 Internal Server Error
   ↓
4. Inicjalizacja ProductService(supabase)
   ↓
5. Wywołanie productService.searchProducts(params)
   ↓
6. ProductService wywołuje RPC function search_products()
   - RPC używa view v_active_products (filtruje wygasłe/niepublikowane)
   - Full-text search przez name_tsvector (indeks GIN)
   - Fuzzy search przez trigram similarity (indeks GIN)
   - Filtrowanie po store_slug i category_slug (indeksy)
   - Sortowanie według parametru sort
   - LIMIT i OFFSET dla paginacji
   - COUNT(*) OVER() dla total
   ↓ (jeśli database error)
   └→ Log error → Throw Error → Return 500
   ↓
7. ProductService transformuje wyniki do ProductSearchDTO[]
   - Mapowanie kolumn z JOIN na DTO fields
   - Dodanie relevance_score
   ↓
8. Zwrócenie ApiResponse z data i pagination
   - Cache-Control header (public, max-age=300)
   ↓
9. Response 200 OK
```

**Interakcje z bazą danych:**
- **RPC Function:** `search_products(search_query, store_filter, category_filter, sort_method, page_limit, page_offset)`
- **View:** `v_active_products` - automatycznie filtruje produkty z aktywnych gazetek
- **Indeksy wykorzystywane:**
  - `idx_products_name_tsvector` (GIN) - Full-Text Search
  - `idx_products_name_trgm` (GIN) - Fuzzy Search
  - `idx_products_price` - Sortowanie po cenie
  - `idx_products_category_id` - Filtrowanie po kategorii
  - Indeksy z tabel powiązanych (stores, categories, flyers)

### 5.2. GET /api/products/:id - Szczegóły produktu

```
1. Request → Astro API Route Handler (GET)
   ↓
2. Walidacja path param :id przez Zod (productIdParamSchema)
   ↓ (jeśli invalid UUID)
   └→ Return 400 Bad Request z details
   ↓ (jeśli valid)
3. Pobranie Supabase client z locals
   ↓ (jeśli brak)
   └→ Return 500 Internal Server Error
   ↓
4. Inicjalizacja ProductService(supabase)
   ↓
5. Wywołanie productService.getProductById(id)
   ↓
6. ProductService query do v_active_products view
   - SELECT z JOIN (products, categories, stores, flyers, flyer_pages)
   - WHERE id = :id
   - Automatyczne filtrowanie przez RLS policy
   - .maybeSingle() - zwraca null jeśli nie znaleziono
   ↓ (jeśli database error)
   └→ Log error → Throw Error → Return 500
   ↓ (jeśli not found)
   └→ Return 404 Not Found
   ↓
7. ProductService transformuje wynik do ProductDTO
   - Mapowanie kolumn z JOIN na DTO fields
   ↓
8. Zwrócenie ApiResponse z data
   - Cache-Control header (public, max-age=600)
   ↓
9. Response 200 OK
```

**Interakcje z bazą danych:**
- **View:** `v_active_products` - automatycznie filtruje niepublikowane/wygasłe produkty
- **RLS Policy:** Zapewnia że tylko published products są dostępne
- **Indeksy wykorzystywane:**
  - Primary key index na products.id (automatyczny)
  - Foreign key indexes dla JOIN operations

### 5.3. GET /api/products/recent - Ostatnio dodane produkty

```
1. Request → Astro API Route Handler (GET)
   ↓
2. Walidacja query params przez Zod (productRecentQuerySchema)
   ↓ (jeśli invalid)
   └→ Return 400 Bad Request z details
   ↓ (jeśli valid)
3. Pobranie Supabase client z locals
   ↓ (jeśli brak)
   └→ Return 500 Internal Server Error
   ↓
4. Inicjalizacja ProductService(supabase)
   ↓
5. Wywołanie productService.getRecentProducts(limit)
   ↓
6. ProductService query do v_active_products view
   - SELECT z JOIN (products, categories, stores, flyers, flyer_pages)
   - SELECT bez bbox, description, promo_conditions
   - ORDER BY created_at DESC
   - LIMIT :limit
   ↓ (jeśli database error)
   └→ Log error → Throw Error → Return 500
   ↓
7. ProductService transformuje wyniki do ProductRecentDTO[]
   - Mapowanie kolumn (bez bbox, description, promo_conditions)
   ↓
8. Zwrócenie ApiResponse z data
   - Cache-Control header (public, max-age=180)
   ↓
9. Response 200 OK
```

**Interakcje z bazą danych:**
- **View:** `v_active_products`
- **Indeksy wykorzystywane:**
  - Index na products.created_at dla sortowania (należy dodać jeśli nie istnieje)
  - Foreign key indexes dla JOIN operations

## 6. Względy bezpieczeństwa

### 6.1. Autoryzacja i Autentykacja

**Typ dostępu:** Publiczny (bez wymagania autentykacji)

**Uzasadnienie:**
- Endpointy służą do przeglądania publicznych promocji
- Nie ma dostępu do danych użytkowników ani funkcji administracyjnych
- View `v_active_products` i RLS policies zapewniają że tylko opublikowane produkty są widoczne

**Środki bezpieczeństwa:**
- Rate limiting powinien być zaimplementowany na poziomie middleware lub proxy (np. max 100 req/min per IP)
- Cache headers zmniejszają obciążenie bazy danych

### 6.2. Walidacja danych wejściowych

**SQL Injection:**
- ✅ Wszystkie parametry walidowane przez Zod schemas
- ✅ UUID format validation dla product ID
- ✅ Slug validation przez regex `^[a-z0-9-]+$` (blokuje `'`, `;`, `--`, `..`, `/`)
- ✅ Supabase automatycznie używa prepared statements
- ✅ RPC function używa parametrów, nie konkatenacji stringów

**XSS (Cross-Site Scripting):**
- ✅ Content-Type: application/json zapobiega interpretacji jako HTML
- ✅ Max length validation dla search query (200 chars)
- ✅ JSON.stringify automatycznie escape'uje znaki specjalne
- ⚠️ Frontend musi escapować dane przed wyświetleniem w HTML

**Path Traversal:**
- ✅ Slug regex blokuje `.` i `/`
- ✅ UUID validation zapobiega path traversal w :id param

**DoS (Denial of Service):**
- ✅ Max limit dla paginacji (100 dla search, 50 dla recent)
- ✅ Max length dla query string (200 chars)
- ✅ Min/max validation dla wszystkich numeric params
- ✅ Cache headers zmniejszają obciążenie (300s dla search, 600s dla id, 180s dla recent)
- ⚠️ Brak rate limiting na poziomie API (powinien być w middleware)

**CORS:**
- ⚠️ Należy skonfigurować odpowiednie CORS headers jeśli frontend będzie na innej domenie
- Domyślnie Astro obsługuje same-origin requests

### 6.3. Ochrona danych

**Information Disclosure:**
- ✅ View `v_active_products` automatycznie filtruje niepublikowane produkty
- ✅ RLS policies na poziomie Supabase zapewniają dodatkową warstwę bezpieczeństwa
- ✅ Brak eksponowania internal IDs (tylko UUIDs)
- ✅ Error messages nie ujawniają szczegółów implementacji (np. "Database query failed" zamiast SQL error)

**Data Integrity:**
- ✅ Read-only operations (GET) nie modyfikują danych
- ✅ Wszystkie transformacje w service layer

### 6.4. Checklist bezpieczeństwa

- [ ] Rate limiting zaimplementowany (middleware lub Supabase)
- [ ] CORS headers skonfigurowane jeśli potrzebne
- [ ] Cache headers ustawione odpowiednio
- [ ] Wszystkie validation schemas przetestowane
- [ ] Error handling nie ujawnia szczegółów technicznych
- [ ] Monitoring/logging błędów serwera (nie user errors)
- [ ] Database indexes zoptymalizowane
- [ ] RLS policies skonfigurowane w Supabase
- [ ] View v_active_products utworzony
- [ ] RPC function search_products() utworzona

## 7. Obsługa błędów

### 7.1. Błędy walidacji (400 Bad Request)

**Scenariusze:**
- Invalid UUID format dla product ID
- Limit > max allowed (100 dla search, 50 dla recent)
- Offset < 0
- Invalid slug format (zawiera niedozwolone znaki)
- Invalid sort option
- Non-numeric values dla limit/offset
- Query string > 200 chars

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      {
        "field": "limit",
        "message": "Limit cannot exceed 100"
      },
      {
        "field": "sort",
        "message": "Invalid enum value. Expected 'relevance' | 'newest' | 'price_asc' | 'price_desc'"
      }
    ]
  }
}
```

**Implementacja:**
```typescript
try {
  const params = productSearchQuerySchema.parse(urlParams);
} catch (error) {
  if (error instanceof z.ZodError) {
    const details = formatZodErrors(error);
    return createErrorResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
  }
}
```

### 7.2. Błędy Not Found (404)

**Scenariusze:**
- Product ID nie istnieje w bazie
- Product istnieje ale jest niepublikowany (filtrowany przez view)
- Product istnieje ale gazetka wygasła (filtrowany przez view)

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}
```

**Implementacja:**
```typescript
const product = await productService.getProductById(id);

if (!product) {
  return createErrorResponse("NOT_FOUND", "Product not found", 404);
}
```

**Uwaga:** Nie rozróżniamy czy product nie istnieje czy jest niepublikowany - to information disclosure vulnerability.

### 7.3. Błędy serwera (500 Internal Server Error)

**Scenariusze:**
- Supabase client nie jest dostępny w locals
- Database connection error
- RPC function error
- View v_active_products nie istnieje
- Unexpected exceptions w service layer
- Timeout podczas query

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to search products"
  }
}
```

**Implementacja:**
```typescript
try {
  const supabase = locals.supabase;
  
  if (!supabase) {
    console.error("Supabase client not available in locals");
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
  }
  
  const productService = new ProductService(supabase);
  const results = await productService.searchProducts(params);
  
  return createSuccessResponse(results, 200, 300);
} catch (error) {
  console.error("Error in GET /api/products:", error);
  return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to search products", 500);
}
```

**Logging:**
- ✅ Log szczegółowe błędy do console.error (dla debugging)
- ✅ Zwróć generyczny error message do użytkownika (security)
- ❌ Nie loguj błędów walidacji (to user errors, nie system errors)

### 7.4. Edge Cases

**Pusta lista wyników:**
- Status: 200 OK (nie 404!)
- Response: `{ "data": [], "pagination": { ... } }`
- Uzasadnienie: Query było poprawne, po prostu brak wyników

**Wszystkie parametry opcjonalne:**
- GET /api/products (bez query params)
- Zwraca wszystkie aktywne produkty z domyślną paginacją
- Sort: "newest" (domyślne gdy brak `q`)

**Duplikaty w wynikach:**
- Nie powinny wystąpić - product.id jest unique
- Jeśli występują → database integrity issue → log error

**Brak store_logo:**
- logo_url powinno być zawsze string (nawet pusty lub default)
- Frontend powinien obsłużyć fallback image

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

**Database Queries:**
- ❌ Full-text search może być wolny dla dużych tabel
  - ✅ Mitigacja: Indeks GIN na name_tsvector
- ❌ Fuzzy search (trigram) może być wolny
  - ✅ Mitigacja: Indeks GIN na name (gin_trgm_ops)
- ❌ Multiple JOINs (products → flyer_pages → flyers → stores + categories)
  - ✅ Mitigacja: Foreign key indexes, view v_active_products materialized?
- ❌ COUNT(*) OVER() dla total może być wolny dla dużych wyników
  - ⚠️ Rozważyć cache lub approximate count dla bardzo dużych tabel

**Paginacja:**
- ❌ Large offset może być wolny (OFFSET 10000 LIMIT 20)
  - ⚠️ Rozważyć cursor-based pagination dla bardzo dużych dataset'ów
  - ✅ Na razie: limit max offset lub użyć keyset pagination

**N+1 Queries:**
- ✅ Wszystkie dane pobierane w jednym query przez JOIN
- ✅ Brak iteracji przez results z dodatkowymi queries

### 8.2. Strategie optymalizacji

**Caching:**

HTTP Cache Headers:
```typescript
// GET /api/products - często się zmienia
Cache-Control: public, max-age=300, stale-while-revalidate=600

// GET /api/products/:id - rzadko się zmienia
Cache-Control: public, max-age=600, stale-while-revalidate=1200

// GET /api/products/recent - często się zmienia
Cache-Control: public, max-age=180, stale-while-revalidate=360
```

Uzasadnienie wartości:
- `public` - może być cache'owane przez CDN i browser
- `max-age` - czas świeżości danych
- `stale-while-revalidate` - serve stale content podczas revalidation (lepsze UX)

Redis/Memcached (przyszłość):
- Cache search results per query params (cache key: hash of params)
- TTL: 5 minut dla search, 10 minut dla product details
- Invalidacja: on product update/delete

**Database Indexes:**

Wymagane (z db-plan.md):
```sql
-- Już istnieją:
CREATE INDEX idx_products_name_tsvector ON products USING GIN(name_tsvector);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_flyer_page_id ON products(flyer_page_id);

-- Należy dodać:
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

**View Optimization:**

Rozważyć materialized view dla v_active_products jeśli query jest wolne:
```sql
CREATE MATERIALIZED VIEW v_active_products AS
  SELECT ... FROM products JOIN ...;

-- Refresh co godzinę lub on-demand
REFRESH MATERIALIZED VIEW CONCURRENTLY v_active_products;
```

Plusy:
- Bardzo szybkie query (precomputed JOINs)
- Brak overhead przy każdym request

Minusy:
- Dane nie są real-time (opóźnienie do refreshu)
- Wymaga periodic refresh job

**RPC Function Optimization:**

Zapewnić że search_products() używa:
- Prepared statements (automatyczne w Supabase)
- EXPLAIN ANALYZE do optymalizacji query planu
- Limit query execution time (timeout)

**Pagination Optimization:**

Dla bardzo dużych offset'ów rozważyć keyset pagination:
```sql
-- Zamiast OFFSET 10000 LIMIT 20
SELECT * FROM products WHERE id > :last_id ORDER BY id LIMIT 20;
```

### 8.3. Monitoring i metryki

**Kluczowe metryki do monitorowania:**
- Response time (p50, p95, p99)
- Error rate (4xx vs 5xx)
- Cache hit rate
- Database query time
- Number of requests per endpoint
- Most common search queries

**Alarmy:**
- Response time > 2s (p95)
- Error rate > 5%
- Database connection pool exhausted
- Cache hit rate < 70%

**Performance Budget:**
- GET /api/products: < 1s (p95)
- GET /api/products/:id: < 500ms (p95)
- GET /api/products/recent: < 300ms (p95)

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie schematu walidacji

**Plik:** `src/lib/schemas/product.schema.ts`

**Zadania:**
1. Importuj zależności: `zod`, `slugSchema` z `common.schema`
2. Utwórz `productIdParamSchema` z walidacją UUID
3. Utwórz `productSearchQuerySchema` z walidacją wszystkich query params
4. Utwórz `productRecentQuerySchema` z walidacją limit param
5. Wyeksportuj typy TypeScript używając `z.infer<>`

**Kryteria akceptacji:**
- [ ] Wszystkie schemas walidują zgodnie ze specyfikacją
- [ ] TypeScript types są eksportowane
- [ ] Dokumentacja (komentarze) opisuje wymagania
- [ ] Schemas są przetestowane (unit tests)

**Szacowany czas:** 30 minut

---

### Krok 2: Implementacja ProductService

**Plik:** `src/lib/services/product.service.ts`

**Zadania:**
1. Importuj typy: `SupabaseClient`, DTOs z `@/types`, `Product`, `BBox`
2. Zdefiniuj typy dla query results (bez użycia `any`):
   ```typescript
   // Typ dla pojedynczego produktu z tabeli products
   type ProductSelect = Pick<
     Product,
     "id" | "name" | "price" | "currency" | "unit" | "description" | 
     "promo_conditions" | "bbox" | "created_at"
   >;
   
   // Typ dla produktu z JOIN (products + categories + stores + flyers + flyer_pages)
   // Te pola nie istnieją w Product, więc definiujemy nowy typ
   type ProductWithRelations = ProductSelect & {
     category_name: string;
     category_slug: string;
     store_name: string;
     store_slug: string;
     store_logo: string;
     valid_from: string;
     valid_to: string;
     web_image_url: string;
     page_number: number;
   };
   
   // Typ dla search results (z relevance_score)
   type ProductSearchResult = ProductWithRelations & {
     relevance_score: number;
   };
   
   // Typ dla recent products (bez bbox, description, promo_conditions)
   type ProductRecentSelect = Omit<ProductWithRelations, "bbox" | "description" | "promo_conditions">;
   ```
3. Utwórz klasę `ProductService` z constructor przyjmującym `supabase`
4. Implementuj prywatne metody transformacji z właściwymi typami:
   - `transformToProductDTO(product: ProductWithRelations): ProductDTO`
   - `transformToProductSearchDTO(product: ProductSearchResult): ProductSearchDTO`
   - `transformToProductRecentDTO(product: ProductRecentSelect): ProductRecentDTO`
5. Implementuj metodę `searchProducts(params: ProductSearchParams)`:
   - Wywołaj RPC function `search_products()`
   - Obsłuż błędy bazy danych
   - Transform results do `ProductSearchDTO[]`
   - Zwróć obiekt z `data` i `pagination`
6. Implementuj metodę `getProductById(id: string)`:
   - Query view `v_active_products` z JOIN
   - `.eq('id', id).maybeSingle()`
   - Obsłuż błędy
   - Transform result do `ProductDTO` lub null
7. Implementuj metodę `getRecentProducts(limit: number)`:
   - Query view `v_active_products`
   - SELECT bez bbox, description, promo_conditions
   - ORDER BY created_at DESC LIMIT :limit
   - Obsłuż błędy
   - Transform results do `ProductRecentDTO[]`

**Przykładowa struktura:**
```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { Product, ProductDTO, ProductSearchDTO, ProductRecentDTO, BBox } from "@/types";

// Typy dla query results (zamiast any)
type ProductSelect = Pick<
  Product,
  "id" | "name" | "price" | "currency" | "unit" | "description" | 
  "promo_conditions" | "bbox" | "created_at"
>;

type ProductWithRelations = ProductSelect & {
  category_name: string;
  category_slug: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  valid_from: string;
  valid_to: string;
  web_image_url: string;
  page_number: number;
};

type ProductSearchResult = ProductWithRelations & {
  relevance_score: number;
};

type ProductRecentSelect = Omit<ProductWithRelations, "bbox" | "description" | "promo_conditions">;

export class ProductService {
  constructor(private supabase: SupabaseClient) {}
  
  private transformToProductDTO(product: ProductWithRelations): ProductDTO {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      unit: product.unit,
      description: product.description,
      promo_conditions: product.promo_conditions,
      bbox: product.bbox as BBox | null,
      created_at: product.created_at,
      category_name: product.category_name,
      category_slug: product.category_slug,
      store_name: product.store_name,
      store_slug: product.store_slug,
      store_logo: product.store_logo,
      valid_from: product.valid_from,
      valid_to: product.valid_to,
      web_image_url: product.web_image_url,
      page_number: product.page_number,
    };
  }
  
  private transformToProductSearchDTO(product: ProductSearchResult): ProductSearchDTO {
    return {
      ...this.transformToProductDTO(product),
      relevance_score: product.relevance_score,
    };
  }
  
  private transformToProductRecentDTO(product: ProductRecentSelect): ProductRecentDTO {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      unit: product.unit,
      created_at: product.created_at,
      category_name: product.category_name,
      category_slug: product.category_slug,
      store_name: product.store_name,
      store_slug: product.store_slug,
      store_logo: product.store_logo,
      valid_from: product.valid_from,
      valid_to: product.valid_to,
      web_image_url: product.web_image_url,
      page_number: product.page_number,
    };
  }
  
  async searchProducts(params: ProductSearchParams) { 
    // Implementation here
  }
  
  async getProductById(id: string): Promise<ProductDTO | null> { 
    // Implementation here
  }
  
  async getRecentProducts(limit: number): Promise<ProductRecentDTO[]> { 
    // Implementation here
  }
}
```

**Kryteria akceptacji:**
- [ ] Service używa SupabaseClient type z `@/db/supabase.client.ts`
- [ ] **NIE używa typu `any`** - wszystkie query results mają właściwe typy
- [ ] Typy dla query results są zdefiniowane (ProductSelect, ProductWithRelations, etc.)
- [ ] Wszystkie błędy bazy danych są obsłużone (try-catch)
- [ ] Błędy są logowane do console.error z kontekstem
- [ ] Metody zwracają właściwe DTOs
- [ ] Early returns dla error conditions
- [ ] Kod jest czytelny i dobrze udokumentowany
- [ ] TypeScript type-checker nie zgłasza błędów

**Szacowany czas:** 2-3 godziny

---

### Krok 3: Implementacja GET /api/products

**Plik:** `src/pages/api/products/index.ts`

**Zadania:**
1. Importuj: `APIRoute`, service, helper, schema
2. Dodaj `export const prerender = false`
3. Implementuj handler `GET`:
   - Pobierz query params z `url.searchParams`
   - Waliduj przez `productSearchQuerySchema.parse()`
   - Obsłuż `ZodError` → return 400 z details
   - Pobierz `supabase` z `locals`
   - Guard clause: jeśli brak supabase → return 500
   - Inicjalizuj `ProductService`
   - Wywołaj `searchProducts(params)`
   - Obsłuż błędy → return 500
   - Return success response z cache headers (300s)

**Przykładowa struktura:**
```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { ProductService } from "@/lib/services/product.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";
import { productSearchQuerySchema } from "@/lib/schemas/product.schema";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // 1. Parse query params
    const queryParams = Object.fromEntries(url.searchParams);
    
    // 2. Validate
    let params;
    try {
      params = productSearchQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
      }
      throw error;
    }
    
    // 3. Get supabase client
    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }
    
    // 4. Call service
    const productService = new ProductService(supabase);
    const results = await productService.searchProducts(params);
    
    // 5. Return success
    return createSuccessResponse(results, 200, 300);
  } catch (error) {
    console.error("Error in GET /api/products:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to search products", 500);
  }
};
```

**Kryteria akceptacji:**
- [ ] Endpoint zwraca 200 OK dla valid requests
- [ ] Endpoint zwraca 400 Bad Request dla invalid params
- [ ] Endpoint zwraca 500 Internal Server Error dla database errors
- [ ] Cache-Control headers są ustawione (300s)
- [ ] Pusta lista zwraca 200 OK z pustym array
- [ ] Pagination metadata jest zwracana
- [ ] Wszystkie error cases są obsłużone

**Szacowany czas:** 1 godzina

---

### Krok 4: Implementacja GET /api/products/:id

**Plik:** `src/pages/api/products/[id].ts`

**Zadania:**
1. Importuj zależności
2. Dodaj `export const prerender = false`
3. Implementuj handler `GET`:
   - Pobierz `id` z `params`
   - Waliduj przez `productIdParamSchema.parse()`
   - Obsłuż `ZodError` → return 400
   - Pobierz `supabase` z `locals`
   - Guard clause: jeśli brak → return 500
   - Inicjalizuj `ProductService`
   - Wywołaj `getProductById(id)`
   - Guard clause: jeśli null → return 404
   - Return success response z cache headers (600s)
   - Obsłuż błędy → return 500

**Przykładowa struktura:**
```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { ProductService } from "@/lib/services/product.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";
import { productIdParamSchema } from "@/lib/schemas/product.schema";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Validate path param
    let validatedParams;
    try {
      validatedParams = productIdParamSchema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid product ID", 400, details);
      }
      throw error;
    }
    
    // 2. Get supabase client
    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }
    
    // 3. Call service
    const productService = new ProductService(supabase);
    const product = await productService.getProductById(validatedParams.id);
    
    // 4. Guard clause for not found
    if (!product) {
      return createErrorResponse("NOT_FOUND", "Product not found", 404);
    }
    
    // 5. Return success
    return createSuccessResponse({ data: product }, 200, 600);
  } catch (error) {
    console.error(`Error in GET /api/products/:id:`, error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch product", 500);
  }
};
```

**Kryteria akceptacji:**
- [ ] Endpoint zwraca 200 OK dla existing product
- [ ] Endpoint zwraca 400 Bad Request dla invalid UUID
- [ ] Endpoint zwraca 404 Not Found dla non-existing product
- [ ] Endpoint zwraca 500 Internal Server Error dla database errors
- [ ] Cache-Control headers są ustawione (600s)
- [ ] Response format zgodny z ApiResponse<ProductDTO>

**Szacowany czas:** 45 minut

---

### Krok 5: Implementacja GET /api/products/recent

**Plik:** `src/pages/api/products/recent.ts`

**Zadania:**
1. Importuj zależności
2. Dodaj `export const prerender = false`
3. Implementuj handler `GET`:
   - Pobierz query params z `url.searchParams`
   - Waliduj przez `productRecentQuerySchema.parse()`
   - Obsłuż `ZodError` → return 400
   - Pobierz `supabase` z `locals`
   - Guard clause: jeśli brak → return 500
   - Inicjalizuj `ProductService`
   - Wywołaj `getRecentProducts(limit)`
   - Return success response z cache headers (180s)
   - Obsłuż błędy → return 500

**Przykładowa struktura:**
```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { ProductService } from "@/lib/services/product.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";
import { productRecentQuerySchema } from "@/lib/schemas/product.schema";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // 1. Parse and validate query params
    const queryParams = Object.fromEntries(url.searchParams);
    
    let params;
    try {
      params = productRecentQuerySchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
      }
      throw error;
    }
    
    // 2. Get supabase client
    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }
    
    // 3. Call service
    const productService = new ProductService(supabase);
    const products = await productService.getRecentProducts(params.limit);
    
    // 4. Return success
    return createSuccessResponse({ data: products }, 200, 180);
  } catch (error) {
    console.error("Error in GET /api/products/recent:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch recent products", 500);
  }
};
```

**Kryteria akceptacji:**
- [ ] Endpoint zwraca 200 OK dla valid requests
- [ ] Endpoint zwraca 400 Bad Request dla invalid limit
- [ ] Endpoint zwraca 500 Internal Server Error dla database errors
- [ ] Cache-Control headers są ustawione (180s)
- [ ] Products są sortowane po created_at DESC
- [ ] Response nie zawiera bbox, description, promo_conditions

**Szacowany czas:** 30 minut

---

### Krok 6: Dodanie brakujących indeksów w bazie danych

**Lokalizacja:** Migracja Supabase lub SQL script

**Zadania:**
1. Sprawdź czy istnieje index `idx_products_created_at`
2. Jeśli nie istnieje, dodaj:
   ```sql
   CREATE INDEX CONCURRENTLY idx_products_created_at 
   ON products(created_at DESC);
   ```
3. Sprawdź performance view `v_active_products` (EXPLAIN ANALYZE)
4. Rozważ materialized view jeśli potrzebne

**Kryteria akceptacji:**
- [ ] Index `idx_products_created_at` istnieje
- [ ] Query dla recent products używa tego indexu (sprawdź EXPLAIN)
- [ ] View `v_active_products` ma rozsądny query plan

**Szacowany czas:** 30 minut

---

### Krok 7: Testowanie manualne

**Zadania:**
1. **GET /api/products:**
   - Test bez parametrów → zwraca wszystkie produkty
   - Test z `q` → zwraca przefiltrowane wyniki
   - Test z `store` i `category` → filtruje poprawnie
   - Test wszystkich opcji `sort`
   - Test paginacji (`limit`, `offset`)
   - Test invalid params → 400
   - Test limit > 100 → 400
   - Test pustej listy → 200 z []

2. **GET /api/products/:id:**
   - Test valid UUID → 200 z produktem
   - Test invalid UUID → 400
   - Test non-existing UUID → 404
   - Test expired product → 404 (filtrowane przez view)

3. **GET /api/products/recent:**
   - Test bez parametrów → 10 produktów
   - Test z `limit=20` → 20 produktów
   - Test limit > 50 → 400
   - Test sortowania (newest first)

4. **Cache headers:**
   - Sprawdź czy response zawiera Cache-Control
   - Sprawdź czy wartości są poprawne (300s, 600s, 180s)

5. **Error handling:**
   - Wyłącz Supabase → 500
   - Invalid database state → 500
   - Wszystkie error responses w formacie ApiError

**Narzędzia:**
- cURL lub Postman
- Browser DevTools (Network tab)
- Database client (sprawdzić query plans)

**Kryteria akceptacji:**
- [ ] Wszystkie happy paths działają
- [ ] Wszystkie error cases są obsłużone
- [ ] Response format zgodny ze specyfikacją
- [ ] Cache headers są ustawione
- [ ] Performance jest akceptowalna (< 1s)

**Szacowany czas:** 2 godziny

---

### Krok 8: Code review i dokumentacja

**Zadania:**
1. **Code review:**
   - Sprawdź zgodność z cursor rules (backend, astro, shared)
   - Sprawdź error handling (early returns, guard clauses)
   - Sprawdź TypeScript types (brak `any`)
   - Sprawdź komentarze i dokumentację
   - Sprawdź consistent code style

2. **Dokumentacja:**
   - Zaktualizuj API docs jeśli potrzebne
   - Dodaj przykłady użycia do README
   - Dodaj komentarze JSDoc do public methods
   - Opisz environment variables jeśli potrzebne

3. **Linting:**
   - Uruchom linter: `npm run lint`
   - Popraw wszystkie błędy i warningi
   - Uruchom type checking: `npm run type-check`

**Kryteria akceptacji:**
- [ ] Kod przechodzi code review
- [ ] Brak linter errors
- [ ] Brak TypeScript errors
- [ ] Dokumentacja jest aktualna
- [ ] Kod jest zgodny z project conventions

**Szacowany czas:** 1 godzina

---

### Krok 9: Deploy i monitoring

**Zadania:**
1. **Pre-deploy checklist:**
   - [ ] Wszystkie testy manualne przeszły
   - [ ] Linter i type-checker nie zgłaszają błędów
   - [ ] Database migrations są applied
   - [ ] Environment variables są ustawione
   - [ ] Cache configuration jest poprawna

2. **Deploy:**
   - Merge do main branch
   - Deploy przez GitHub Actions / Docker
   - Sprawdź deployment logs

3. **Post-deploy verification:**
   - Smoke test wszystkich endpointów na production
   - Sprawdź monitoring dashboards
   - Sprawdź error logs
   - Sprawdź database performance

4. **Monitoring setup:**
   - Skonfiguruj alerty dla error rate > 5%
   - Skonfiguruj alerty dla response time > 2s
   - Skonfiguruj dashboard dla API metrics

**Kryteria akceptacji:**
- [ ] Endpoints działają na production
- [ ] Brak critical errors w logs
- [ ] Performance jest akceptowalna
- [ ] Monitoring jest skonfigurowane
- [ ] Alerty są skonfigurowane

**Szacowany czas:** 1-2 godziny

---

## Podsumowanie szacowanego czasu

| Krok | Zadanie | Czas |
|------|---------|------|
| 1 | Validation schemas | 30 min |
| 2 | ProductService | 2-3 h |
| 3 | GET /api/products | 1 h |
| 4 | GET /api/products/:id | 45 min |
| 5 | GET /api/products/recent | 30 min |
| 6 | Database indexes | 30 min |
| 7 | Testing manualne | 2 h |
| 8 | Code review | 1 h |
| 9 | Deploy | 1-2 h |
| **TOTAL** | | **9-11 godzin** |

---

## Notatki dla implementujących

### Najważniejsze punkty:

1. **Bezpieczeństwo przede wszystkim:**
   - Zawsze waliduj input przez Zod
   - Nigdy nie trust user input
   - Używaj prepared statements (automatyczne w Supabase)
   - Nie ujawniaj szczegółów błędów w response

2. **Performance matters:**
   - Używaj odpowiednich indeksów
   - Dodaj cache headers
   - Monitoruj query performance
   - Rozważ materialized views dla ciężkich queries

3. **Error handling:**
   - Early returns dla błędów
   - Guard clauses na początku funkcji
   - Loguj błędy serwera (nie user errors)
   - Zwracaj czytelne error messages

4. **Code quality:**
   - Podążaj za cursor rules
   - Piszę czytelny, self-documenting code
   - Dodawaj komentarze dla skomplikowanej logiki
   - Testuj wszystkie edge cases
   - **NIGDY nie używaj typu `any`** - zawsze definiuj właściwe typy
   - Dla query results z JOIN definiuj dedykowane typy (ProductWithRelations, etc.)

5. **Współpraca z zespołem:**
   - Komunikuj problemy wcześnie
   - Pytaj jeśli coś jest niejasne
   - Review code innych devs
   - Dziel się wiedzą

### Potencjalne problemy:

1. **View v_active_products nie istnieje:**
   - Należy stworzyć przed implementacją endpointów
   - Sprawdź db-plan.md dla definicji

2. **RPC function search_products() nie istnieje:**
   - Należy stworzyć w Supabase
   - Sprawdź db-plan.md dla implementacji

3. **Store logo paths vs URLs:**
   - Upewnij się że logo_path jest konwertowane na pełny URL
   - Może wymagać helper function

4. **Timezone handling:**
   - Wszystkie daty powinny być w UTC
   - Frontend konwertuje do local timezone

5. **Large result sets:**
   - Rozważ cursor-based pagination dla bardzo dużych offset'ów
   - Monitoruj performance

---

## Checklist przed merge do main

- [ ] Wszystkie schemas walidacji są zaimplementowane i przetestowane
- [ ] ProductService jest zaimplementowany z proper error handling
- [ ] Wszystkie 3 endpointy są zaimplementowane
- [ ] Database indexes są dodane
- [ ] Linter nie zgłasza błędów
- [ ] TypeScript type-checker nie zgłasza błędów
- [ ] Wszystkie testy manualne przeszły
- [ ] Cache headers są skonfigurowane
- [ ] Error handling jest kompletny
- [ ] Code review został przeprowadzony
- [ ] Dokumentacja jest aktualna
- [ ] Environment variables są udokumentowane
- [ ] Deploy checklist został zrealizowany

---

**Powodzenia z implementacją! 🚀**

