# API Endpoint Implementation Plan: Categories

## 1. Przegląd punktu końcowego

Implementujemy dwa publiczne endpointy REST API do zarządzania kategoriami produktów:

- **GET /api/categories** - zwraca listę wszystkich predefiniowanych kategorii produktowych
- **GET /api/categories/:slug** - zwraca szczegóły pojedynczej kategorii na podstawie slug

### Cel biznesowy

Kategorie są statycznym słownikiem używanym do klasyfikacji produktów w gazetkach promocyjnych. Endpointy umożliwiają:
- Wyświetlanie nawigacji kategorii w UI
- Filtrowanie produktów według kategorii
- Walidację kategorii przy dodawaniu produktów (admin panel)

### Charakterystyka

- **Publiczne** - nie wymagają autoryzacji
- **Read-only** - tylko GET, brak modyfikacji przez API
- **Statyczne** - 12 kategorii inicjalizowanych przy migracji
- **Cache-friendly** - dane rzadko się zmieniają, można agresywnie cachować

---

## 2. Szczegóły żądania

### GET /api/categories

Zwraca listę wszystkich kategorii posortowanych według `display_order`.

**Metoda HTTP:** GET

**Struktura URL:** `/api/categories`

**Parametry:**
- Wymagane: brak
- Opcjonalne: brak
- Query params: brak

**Request Headers:**
```
Accept: application/json
```

**Request Body:** Brak (GET request)

**Przykładowe żądanie:**
```bash
curl -X GET https://dealspy.pl/api/categories \
  -H "Accept: application/json"
```

---

### GET /api/categories/:slug

Zwraca szczegóły pojedynczej kategorii na podstawie slug.

**Metoda HTTP:** GET

**Struktura URL:** `/api/categories/:slug`

**Parametry:**
- Wymagane:
  - `slug` (string) - URL-friendly identyfikator kategorii
    - Format: lowercase letters, numbers, hyphens only
    - Regex: `^[a-z0-9-]+$`
    - Max length: 100 znaków
    - Przykłady: "nabial-i-jaja", "owoce-i-warzywa"
    
- Opcjonalne: brak

**Request Headers:**
```
Accept: application/json
```

**Request Body:** Brak (GET request)

**Przykładowe żądanie:**
```bash
curl -X GET https://dealspy.pl/api/categories/nabial-i-jaja \
  -H "Accept: application/json"
```

---

## 3. Wykorzystywane typy

### DTOs (src/types.ts)

#### CategoryDTO
```typescript
export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
}
```

**Użycie:** Response body dla obu endpointów

**Różnice względem Category entity:**
- Brak pola `updated_at` (nie potrzebne na frontendzie)
- Wszystkie pola są wymagane (nie nullable)

### Database Entities (src/types.ts)

#### Category
```typescript
export type Category = Tables<"categories">;
```

**Struktura z bazy:**
```typescript
{
  id: string;              // UUID
  name: string;            // "Nabiał i Jaja"
  slug: string;            // "nabial-i-jaja"
  display_order: number;   // 1
  created_at: string;      // ISO 8601 timestamp
  updated_at?: string;     // ISO 8601 timestamp (opcjonalne)
}
```

### Validation Schemas (do stworzenia)

#### categorySlugParamSchema (src/lib/schemas/category.schema.ts)
```typescript
export const categorySlugParamSchema = z.object({
  slug: z
    .string({ required_error: "Category slug is required" })
    .min(1, "Category slug cannot be empty")
    .max(100, "Category slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Category slug must contain only lowercase letters, numbers, and hyphens"
    ),
});

export type CategorySlugParams = z.infer<typeof categorySlugParamSchema>;
```

### Helper Types (src/types.ts - już istnieją)

#### ApiResponse<T>
```typescript
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}
```

**Użycie:** Wrapper dla wszystkich success responses

#### ApiError
```typescript
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

**Użycie:** Format wszystkich error responses

---

## 4. Szczegóły odpowiedzi

### GET /api/categories

#### Success Response (200 OK)

**Format:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "name": "Nabiał i Jaja",
      "slug": "nabial-i-jaja",
      "display_order": 1,
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "name": "Pieczywo i Cukiernia",
      "slug": "pieczywo-i-cukiernia",
      "display_order": 2,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
    // ... pozostałe 10 kategorii
  ]
}
```

**Headers:**
```
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```

**Uwagi:**
- Zawsze zwraca 12 kategorii (lub 0 jeśli baza jest pusta)
- Posortowane według `display_order` ASC
- Agresywne cachowanie (1h cache, 2h stale-while-revalidate)

#### Error Response (500 Internal Server Error)

**Format:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch categories"
  }
}
```

**Kiedy:** Błąd połączenia z bazą danych lub brak klienta Supabase

---

### GET /api/categories/:slug

#### Success Response (200 OK)

**Format:**
```json
{
  "data": {
    "id": "uuid-1",
    "name": "Nabiał i Jaja",
    "slug": "nabial-i-jaja",
    "display_order": 1,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

**Headers:**
```
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```

#### Error Response (400 Validation Error)

**Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid category slug format",
    "details": [
      {
        "field": "slug",
        "message": "Category slug must contain only lowercase letters, numbers, and hyphens"
      }
    ]
  }
}
```

**Kiedy:** Slug nie spełnia wymagań regex (zawiera uppercase, spacje, znaki specjalne)

**Przykładowe nieprawidłowe slugi:**
- `"Nabiał"` - wielkie litery
- `"nabial i jaja"` - spacje
- `"nabial&jaja"` - znaki specjalne
- `""` - pusty string
- `"a".repeat(101)` - za długi

#### Error Response (404 Not Found)

**Format:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Category not found"
  }
}
```

**Kiedy:** Slug ma prawidłowy format, ale kategoria nie istnieje w bazie

#### Error Response (500 Internal Server Error)

**Format:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch category"
  }
}
```

**Kiedy:** Błąd połączenia z bazą danych lub brak klienta Supabase

---

## 5. Przepływ danych

### Architektura warstwowa

```
Client Request
     ↓
API Route Handler (/api/categories/[slug].ts)
     ↓ (walidacja parametrów)
Validation Layer (Zod schema)
     ↓ (wywołanie service)
Service Layer (CategoryService)
     ↓ (query do bazy)
Supabase Client
     ↓ (PostgreSQL)
Database (categories table)
     ↓ (zwracanie danych)
Service Layer (transformacja entity → DTO)
     ↓
API Route Handler (formatowanie response)
     ↓
Client Response
```

### Szczegółowy przepływ dla GET /api/categories

1. **Request przyjęty przez Astro** - `/api/categories`

2. **API Route Handler** (`src/pages/api/categories/index.ts`)
   - Sprawdzenie dostępności `locals.supabase`
   - Utworzenie instance CategoryService

3. **CategoryService.getAllCategories()**
   - Query: `SELECT id, name, slug, display_order, created_at FROM categories ORDER BY display_order ASC`
   - Sprawdzenie błędów query
   - Transformacja każdego rekordu: Category → CategoryDTO (usunięcie updated_at)
   - Zwrócenie `CategoryDTO[]`

4. **Response formatting**
   - Wrap w `ApiResponse<CategoryDTO[]>`
   - Dodanie nagłówków Cache-Control
   - Status 200 OK

5. **Error handling** (jeśli wystąpi błąd)
   - Catch błędu w route handler
   - Log do console.error()
   - Zwrócenie ApiError z odpowiednim kodem i statusem

### Szczegółowy przepływ dla GET /api/categories/:slug

1. **Request przyjęty przez Astro** - `/api/categories/nabial-i-jaja`

2. **Parameter extraction**
   - `params.slug` = "nabial-i-jaja"

3. **Validation** (Zod)
   - Parse `categorySlugParamSchema`
   - Jeśli invalid → return 400 VALIDATION_ERROR

4. **API Route Handler** (`src/pages/api/categories/[slug].ts`)
   - Sprawdzenie dostępności `locals.supabase`
   - Utworzenie instance CategoryService

5. **CategoryService.getCategoryBySlug(slug)**
   - Query: `SELECT id, name, slug, display_order, created_at FROM categories WHERE slug = $1 LIMIT 1`
   - Sprawdzenie błędów query
   - Jeśli nie znaleziono → return null
   - Transformacja: Category → CategoryDTO
   - Zwrócenie `CategoryDTO | null`

6. **Response formatting**
   - Jeśli null → return 404 NOT_FOUND
   - Jeśli data → wrap w `ApiResponse<CategoryDTO>`
   - Dodanie nagłówków Cache-Control
   - Status 200 OK

7. **Error handling** (jeśli wystąpi błąd)
   - Catch błędu w route handler
   - Log do console.error()
   - Zwrócenie ApiError z odpowiednim kodem i statusem

### Interakcje z zewnętrznymi serwisami

**Supabase (PostgreSQL):**
- Jedyne zewnętrzne połączenie
- Connection pooling przez Supabase client
- Timeout domyślny Supabase (60s)
- Retry logic wbudowany w Supabase SDK

**Brak interakcji z:**
- Storage (kategorie nie mają obrazów)
- Authentication (publiczne endpointy)
- External APIs

---

## 6. Względy bezpieczeństwa

### Uwierzytelnianie i autoryzacja

**Wniosek:** Endpointy są **publiczne** - nie wymagają uwierzytelniania.

**Uzasadnienie:**
- Kategorie są publicznym słownikiem
- Potrzebne do wyświetlania nawigacji
- Brak wrażliwych danych
- Read-only access

**Implementacja:**
- Brak sprawdzania `Authorization` header
- Brak sprawdzania sesji użytkownika
- Brak RLS policies (dane publiczne)

### Walidacja danych wejściowych

#### 1. Slug validation (Zod schema)

**Zagrożenia:**
- Path Traversal: `../../../etc/passwd`
- SQL Injection: `'; DROP TABLE categories; --`
- DoS przez długie stringi: `"a".repeat(1000000)`

**Mitigacja:**
```typescript
z.string()
  .min(1)                    // Nie może być pusty
  .max(100)                  // Max 100 znaków (DoS prevention)
  .regex(/^[a-z0-9-]+$/)     // Tylko lowercase, cyfry, myślniki
```

**Dlaczego to działa:**
- Regex blokuje `../` (brak `.` ani `/`)
- Regex blokuje SQL special chars (`'`, `;`, `-`, `--`)
- Max length zapobiega DoS
- Supabase używa prepared statements (dodatkowa warstwa)

#### 2. Supabase client validation

**Sprawdzanie:**
```typescript
if (!locals.supabase) {
  return createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "Service temporarily unavailable",
    500
  );
}
```

**Dlaczego:**
- Zapobiega crash aplikacji jeśli middleware nie dodał supabase do locals
- Graceful degradation

### Rate Limiting (opcjonalne - do rozważenia w przyszłości)

**Problem:** Publiczne endpointy mogą być spamowane

**Rozwiązanie (do implementacji później):**
```typescript
// Middleware w src/middleware/index.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minuta
  max: 100,                  // 100 requestów na IP
  message: "Too many requests, please try again later"
});
```

**Obecnie:** Brak rate limiting (priorytet niski dla MVP)

### Sanityzacja outputu

**Nie potrzebna dla kategorii:**
- Dane inicjalizowane przez migrację (zaufane źródło)
- Brak user-generated content
- Brak HTML/JavaScript w danych

**Jeśli w przyszłości admin będzie mógł edytować:**
- Dodać sanityzację HTML (DOMPurify)
- Escape special characters
- Validate against XSS

### Headers bezpieczeństwa

**Cache-Control:**
```
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```

**Dlaczego:**
- `public` - może być cachowane przez CDN
- `max-age=3600` - 1h cache (dane rzadko się zmieniają)
- `stale-while-revalidate=7200` - może serwować stare dane przez 2h podczas revalidacji

**Brak innych headerów (nie potrzebne dla API):**
- X-Frame-Options (API nie renderuje HTML)
- CSP (API nie renderuje HTML)
- CORS (domyślnie same-origin, jeśli potrzebne - dodać later)

### Logowanie i monitoring

**Co logujemy:**
```typescript
console.error("Failed to fetch categories from database:", error);
console.error(`Failed to fetch category with slug "${slug}":`, error);
```

**Czego NIE logujemy:**
- User input (potencjalnie wrażliwe)
- Full stack traces w production
- Database credentials

**Best practices:**
- Używać structured logging (JSON) w production
- Dodać request ID dla tracingu
- Monitorować rate błędów 500

---

## 7. Obsługa błędów

### Hierarchia błędów

```
Error (najszerszy)
  ↓
Database Error (błąd Supabase)
  ↓
Query Error (konkretny query failed)
  ↓
Validation Error (Zod)
```

### Katalog błędów

#### 1. Validation Error (400)

**Kiedy:** Slug nie spełnia wymagań formatu

**Przykłady:**
```typescript
// Uppercase letters
GET /api/categories/Nabial → 400 VALIDATION_ERROR

// Spaces
GET /api/categories/nabial i jaja → 400 VALIDATION_ERROR

// Special characters
GET /api/categories/nabial&jaja → 400 VALIDATION_ERROR

// Empty
GET /api/categories/ → 400 VALIDATION_ERROR (lub 404 zależnie od routingu)

// Too long (>100 chars)
GET /api/categories/a...{101 chars}...a → 400 VALIDATION_ERROR
```

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid category slug format",
    "details": [
      {
        "field": "slug",
        "message": "Category slug must contain only lowercase letters, numbers, and hyphens"
      }
    ]
  }
}
```

**Handling w kodzie:**
```typescript
try {
  const validatedParams = categorySlugParamSchema.parse({ slug: params.slug });
} catch (error) {
  if (error instanceof z.ZodError) {
    const details = formatZodErrors(error);
    return createErrorResponse(
      "VALIDATION_ERROR",
      "Invalid category slug format",
      400,
      details
    );
  }
  throw error; // Re-throw jeśli to nie Zod error
}
```

#### 2. Not Found (404)

**Kiedy:** Slug ma prawidłowy format, ale kategoria nie istnieje

**Przykłady:**
```typescript
// Kategoria nie istnieje
GET /api/categories/non-existent-slug → 404 NOT_FOUND

// Typo w nazwie
GET /api/categories/nabial-i-jajo → 404 NOT_FOUND (prawidłowe: nabial-i-jaja)
```

**Response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Category not found"
  }
}
```

**Handling w kodzie:**
```typescript
const category = await categoryService.getCategoryBySlug(slug);

if (!category) {
  return createErrorResponse("NOT_FOUND", "Category not found", 404);
}
```

#### 3. Internal Server Error (500)

**Kiedy:** 
- Błąd połączenia z bazą danych
- Brak klienta Supabase w locals
- Unexpected error

**Przykłady:**
```typescript
// Database connection timeout
// Database nie odpowiada
// Supabase credentials invalid
```

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch category"
  }
}
```

**Handling w kodzie:**
```typescript
// Check Supabase client
if (!locals.supabase) {
  console.error("Supabase client not available in locals");
  return createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "Service temporarily unavailable",
    500
  );
}

// Catch all unexpected errors
try {
  // ... business logic
} catch (error) {
  console.error(`Error in GET /api/categories/${params.slug}:`, error);
  return createErrorResponse(
    "INTERNAL_SERVER_ERROR",
    "Failed to fetch category",
    500
  );
}
```

### Error logging strategy

**Console.error() dla:**
- Database errors (zawsze)
- Unexpected errors (zawsze)
- Missing dependencies (Supabase client)

**NIE logujemy do console:**
- Validation errors (400) - to normalne przypadki biznesowe
- Not Found (404) - to normalne przypadki biznesowe

**Format logów:**
```typescript
// ❌ Bad - niejasne
console.error("Error:", error);

// ✅ Good - context + error
console.error("Failed to fetch categories from database:", error);
console.error(`Failed to fetch category with slug "${slug}":`, error);
console.error("Supabase client not available in locals");
```

### Error recovery

**Database timeout:**
- Brak auto-retry (Supabase SDK ma wbudowany retry)
- Return 500 natychmiast
- Client może retry z exponential backoff

**Partial failures:**
- Nie dotyczy - albo wszystkie kategorie, albo error
- Nie zwracamy partial data

**Graceful degradation:**
- Jeśli brak Supabase client → 500 (nie crash)
- Jeśli baza pusta → zwróć pustą tablicę []

---

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

#### 1. Database queries

**Problem:** Query do Postgres przy każdym request

**Mitigacja:**
- Agresywne cachowanie (Cache-Control: max-age=3600)
- Proste queries (SELECT bez JOINów)
- Indeks na `slug` i `display_order` (już w migracji)

**Benchmarks (expected):**
- Query time: <5ms (indexed lookup)
- Total response time: <50ms

#### 2. JSON serialization

**Problem:** Serializacja 12 kategorii do JSON

**Mitigacja:**
- Mały payload (~2KB dla wszystkich kategorii)
- JSON.stringify() jest bardzo szybki dla małych objectów

**Benchmarks (expected):**
- Serialization time: <1ms

#### 3. Network latency

**Problem:** Round trip client ↔ server ↔ database

**Mitigacja:**
- CDN caching (Cloudflare/Vercel)
- Edge functions (jeśli dostępne)
- Compression (gzip/brotli)

#### 4. Cold starts (Serverless)

**Problem:** First request po deploy może być wolny

**Mitigacja:**
- Keep-alive connections do Supabase
- Warm-up requests po deploy
- Connection pooling

### Strategie optymalizacji

#### 1. Caching strategy

**Level 1: Browser cache**
```
Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```
- Browser może cachować przez 1h
- Może serwować stale data przez 2h podczas revalidacji

**Level 2: CDN cache (opcjonalne)**
```typescript
// W przyszłości: Cloudflare Cache API
const cache = await caches.open('api-cache');
const cached = await cache.match(request);
if (cached) return cached;
```

**Level 3: Application cache (opcjonalne)**
```typescript
// W przyszłości: In-memory cache
const categoriesCache = new Map<string, CategoryDTO[]>();
```

**Invalidation:**
- Kategorie są statyczne → cache może być długoterminowy
- Jeśli w przyszłości będą edytowalne → dodać cache invalidation

#### 2. Database optimization

**Indeksy (już w migracji):**
```sql
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_display_order ON categories(display_order);
```

**Query optimization:**
```sql
-- ✅ Good: Select tylko potrzebne kolumny
SELECT id, name, slug, display_order, created_at
FROM categories
WHERE slug = $1;

-- ❌ Bad: Select wszystkich kolumn
SELECT * FROM categories WHERE slug = $1;
```

**Connection pooling:**
- Używamy Supabase client → pooling handled automatically
- Max connections: 100 (default Supabase)

#### 3. Payload optimization

**Compression:**
- Gzip/Brotli włączony na poziomie serwera (Astro/Vercel)
- Payload size: ~2KB uncompressed → ~500B compressed

**Response size:**
- GET /api/categories: ~2KB (12 kategorii)
- GET /api/categories/:slug: ~200B (1 kategoria)

#### 4. Monitoring

**Metryki do trackowania:**
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database query time
- Cache hit rate

**Tools:**
- Sentry dla error tracking
- New Relic / DataDog dla APM
- Grafana dla custom dashboards

**Alerty:**
- Response time > 200ms (p95)
- Error rate > 1%
- Database connection pool exhausted

---

## 9. Kroki implementacji

### Krok 1: Przygotowanie środowiska

**1.1. Weryfikacja struktury katalogów**

Sprawdź czy istnieją katalogi:
```bash
ls -la src/lib/services/
ls -la src/lib/schemas/
ls -la src/pages/api/
```

Jeśli nie - utwórz:
```bash
mkdir -p src/lib/services
mkdir -p src/lib/schemas
mkdir -p src/pages/api/categories
```

**1.2. Weryfikacja typów**

Sprawdź czy `src/types.ts` zawiera:
- `Category` type (Tables<"categories">)
- `CategoryDTO` interface
- `ApiResponse<T>` interface
- `ApiError` interface

Jeśli brak - dodaj zgodnie z sekcją 3 tego planu.

**1.3. Weryfikacja migracji**

Sprawdź czy tabela `categories` istnieje:
```sql
SELECT * FROM categories LIMIT 1;
```

Sprawdź czy dane startowe są załadowane (12 kategorii):
```sql
SELECT COUNT(*) FROM categories; -- Oczekiwane: 12
```

Jeśli brak - uruchom migrację zgodnie z `.ai/db-plan.md` sekcja 3.3.

---

### Krok 2: Implementacja validation schema

**2.1. Utwórz plik `src/lib/schemas/category.schema.ts`**

```typescript
import { z } from "zod";

/**
 * Schema walidacji parametru slug dla category
 *
 * Wymagania:
 * - slug nie może być pusty
 * - maksymalnie 100 znaków (dla bezpieczeństwa)
 * - tylko małe litery, cyfry i myślniki (^[a-z0-9-]+$)
 *
 * Dlaczego te wymagania?
 * - lowercase only: slug używane w URL, URLs są case-sensitive
 * - bez znaków specjalnych: zapobiega atakom path traversal
 * - max length: zapobiega DoS przez długie stringi
 */
export const categorySlugParamSchema = z.object({
  slug: z
    .string({ required_error: "Category slug is required" })
    .min(1, "Category slug cannot be empty")
    .max(100, "Category slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Category slug must contain only lowercase letters, numbers, and hyphens"
    ),
});

/**
 * TypeScript type wygenerowany ze schema
 */
export type CategorySlugParams = z.infer<typeof categorySlugParamSchema>;
```

**2.2. Testy walidacji (opcjonalne - manual testing)**

```typescript
// Test cases:
categorySlugParamSchema.parse({ slug: "nabial-i-jaja" });           // ✅ Pass
categorySlugParamSchema.parse({ slug: "owoce-i-warzywa" });         // ✅ Pass
categorySlugParamSchema.parse({ slug: "Nabial" });                  // ❌ Fail (uppercase)
categorySlugParamSchema.parse({ slug: "nabial i jaja" });           // ❌ Fail (spaces)
categorySlugParamSchema.parse({ slug: "" });                        // ❌ Fail (empty)
categorySlugParamSchema.parse({ slug: "a".repeat(101) });           // ❌ Fail (too long)
```

---

### Krok 3: Implementacja CategoryService

**3.1. Utwórz plik `src/lib/services/category.service.ts`**

```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { Category, CategoryDTO } from "@/types";

/**
 * Type reprezentujący Category bez pola updated_at
 * Używany gdy selectujemy tylko konkretne pola z bazy
 */
type CategorySelect = Pick<Category, "id" | "name" | "slug" | "display_order" | "created_at">;

/**
 * Service do zarządzania danymi kategorii
 *
 * Odpowiedzialność:
 * - Pobieranie danych z bazy przez Supabase
 * - Transformacja Category entity → CategoryDTO
 * - Obsługa błędów bazy danych
 *
 * Nie odpowiada za:
 * - Walidację parametrów URL (to robi endpoint)
 * - Formatowanie HTTP response (to robią helpers)
 * - Autoryzację (endpointy są publiczne)
 */
export class CategoryService {
  /**
   * Constructor przyjmuje Supabase client (Dependency Injection)
   *
   * @param supabase - Instance Supabase client
   */
  constructor(private supabase: SupabaseClient) {}

  /**
   * Transformuje Category entity do CategoryDTO
   *
   * Transformacje:
   * - Usuwamy pole updated_at
   *
   * @param category - Category entity z bazy danych (bez updated_at)
   * @returns CategoryDTO gotowe do wysłania przez API
   */
  private transformToDTO(category: CategorySelect): CategoryDTO {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      display_order: category.display_order,
      created_at: category.created_at,
    };
  }

  /**
   * Pobiera wszystkie kategorie z bazy danych
   *
   * Przepływ:
   * 1. Query do Supabase z sortowaniem po display_order
   * 2. Sprawdzenie błędów
   * 3. Transformacja każdego Category → CategoryDTO
   * 4. Zwrócenie tablicy CategoryDTO[]
   *
   * @returns Promise<CategoryDTO[]> - lista kategorii
   * @throws Error gdy zapytanie do bazy się nie powiedzie
   */
  async getAllCategories(): Promise<CategoryDTO[]> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id, name, slug, display_order, created_at")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch categories from database:", error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return [];
    }

    return data.map((category: CategorySelect) => this.transformToDTO(category));
  }

  /**
   * Pobiera pojedynczą kategorię po slug
   *
   * Przepływ:
   * 1. Query z WHERE slug = $slug
   * 2. Sprawdzenie błędów
   * 3. Jeśli nie znaleziono, zwróć null
   * 4. Jeśli znaleziono, transformuj do DTO
   *
   * @param slug - URL-friendly identyfikator kategorii
   * @returns Promise<CategoryDTO | null> - kategoria lub null jeśli nie znaleziono
   * @throws Error gdy zapytanie do bazy się nie powiedzie
   */
  async getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id, name, slug, display_order, created_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch category with slug "${slug}":`, error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return null;
    }

    return this.transformToDTO(data);
  }
}
```

**3.2. Weryfikacja service**

Sprawdź czy:
- [x] Service importuje właściwe typy z `@/types`
- [x] Service używa `SupabaseClient` z `@/db/supabase.client`
- [x] Metody są async i zwracają Promise
- [x] Errors są logowane do console.error()
- [x] Not found zwraca null (nie throw Error)

---

### Krok 4: Implementacja GET /api/categories

**4.1. Utwórz plik `src/pages/api/categories/index.ts`**

```typescript
import type { APIRoute } from "astro";
import { CategoryService } from "@/lib/services/category.service";
import { createErrorResponse, createSuccessResponse } from "@/lib/halpers/api-response.helper";

/**
 * Wyłącz pre-rendering dla tego endpointa
 */
export const prerender = false;

/**
 * GET /api/categories
 *
 * Zwraca listę wszystkich kategorii produktowych
 *
 * Endpoint jest publiczny - nie wymaga autoryzacji
 *
 * Response format (200 OK):
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "Nabiał i Jaja",
 *       "slug": "nabial-i-jaja",
 *       "display_order": 1,
 *       "created_at": "2025-01-01T00:00:00.000Z"
 *     },
 *     // ... 11 more categories
 *   ]
 * }
 *
 * Error responses:
 * - 500 INTERNAL_SERVER_ERROR - błąd bazy danych lub serwera
 *
 * @param context - Astro API context
 * @param context.locals - Request locals (zawiera supabase)
 * @returns Response - HTTP response z JSON
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const categoryService = new CategoryService(supabase);
    const categories = await categoryService.getAllCategories();

    return createSuccessResponse(categories, 200, 3600);
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch categories", 500);
  }
};
```

**4.2. Weryfikacja endpointa**

Sprawdź czy:
- [x] `export const prerender = false` na początku pliku
- [x] Handler ma sygnaturę `export const GET: APIRoute`
- [x] Sprawdzamy dostępność `locals.supabase`
- [x] Service jest inicjalizowany z supabase client
- [x] Success response ma cache (3600s = 1h)
- [x] Errors są logowane i zwracają 500

**4.3. Test endpointa**

```bash
# Test 1: Success case
curl -i http://localhost:4321/api/categories

# Expected: 200 OK + JSON array z 12 kategoriami
# Expected header: Cache-Control: public, max-age=3600, ...

# Test 2: Database unavailable (wymaga manual disconnect)
# Expected: 500 Internal Server Error
```

---

### Krok 5: Implementacja GET /api/categories/:slug

**5.1. Utwórz plik `src/pages/api/categories/[slug].ts`**

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { CategoryService } from "@/lib/services/category.service";
import { categorySlugParamSchema } from "@/lib/schemas/category.schema";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";

/**
 * Wyłącz pre-rendering dla tego endpointa
 */
export const prerender = false;

/**
 * GET /api/categories/:slug
 *
 * Zwraca szczegóły pojedynczej kategorii
 *
 * Endpoint jest publiczny - nie wymaga autoryzacji
 *
 * URL Parameters:
 * - slug (string, required) - URL-friendly identyfikator kategorii
 *   Format: lowercase letters, numbers, hyphens only
 *   Example: "nabial-i-jaja", "owoce-i-warzywa"
 *
 * Response format (200 OK):
 * {
 *   "data": {
 *     "id": "uuid",
 *     "name": "Nabiał i Jaja",
 *     "slug": "nabial-i-jaja",
 *     "display_order": 1,
 *     "created_at": "2025-01-01T00:00:00.000Z"
 *   }
 * }
 *
 * Error responses:
 * - 400 VALIDATION_ERROR - nieprawidłowy format slug
 * - 404 NOT_FOUND - kategoria o podanym slug nie istnieje
 * - 500 INTERNAL_SERVER_ERROR - błąd bazy danych lub serwera
 *
 * @param context - Astro API context
 * @param context.params - URL parameters (zawiera slug)
 * @param context.locals - Request locals (zawiera supabase)
 * @returns Response - HTTP response z JSON
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Validate slug parameter
    let validatedParams;
    try {
      validatedParams = categorySlugParamSchema.parse({
        slug: params.slug,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid category slug format", 400, details);
      }
      throw error;
    }

    const { slug } = validatedParams;

    // 2. Check Supabase client availability
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    // 3. Fetch category from database
    const categoryService = new CategoryService(supabase);
    const category = await categoryService.getCategoryBySlug(slug);

    // 4. Handle not found
    if (!category) {
      return createErrorResponse("NOT_FOUND", "Category not found", 404);
    }

    // 5. Return success response with cache
    return createSuccessResponse(category, 200, 3600);
  } catch (error) {
    console.error(`Error in GET /api/categories/${params.slug}:`, error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch category", 500);
  }
};
```

**5.2. Weryfikacja endpointa**

Sprawdź czy:
- [x] `export const prerender = false` na początku pliku
- [x] Handler ma sygnaturę `export const GET: APIRoute`
- [x] Walidacja slug jest pierwsza (early return pattern)
- [x] Sprawdzamy dostępność `locals.supabase`
- [x] Service jest inicjalizowany z supabase client
- [x] Not found zwraca 404
- [x] Success response ma cache (3600s = 1h)
- [x] Errors są logowane i zwracają 500

**5.3. Test endpointa**

```bash
# Test 1: Success case - valid category
curl -i http://localhost:4321/api/categories/nabial-i-jaja

# Expected: 200 OK + JSON object z kategorią
# Expected header: Cache-Control: public, max-age=3600, ...

# Test 2: Not found - valid format but doesn't exist
curl -i http://localhost:4321/api/categories/non-existent-category

# Expected: 404 Not Found
# Expected body: {"error": {"code": "NOT_FOUND", ...}}

# Test 3: Validation error - uppercase
curl -i http://localhost:4321/api/categories/Nabial

# Expected: 400 Bad Request
# Expected body: {"error": {"code": "VALIDATION_ERROR", "details": [...]}}

# Test 4: Validation error - spaces
curl -i "http://localhost:4321/api/categories/nabial i jaja"

# Expected: 400 Bad Request

# Test 5: Validation error - special characters
curl -i http://localhost:4321/api/categories/nabial\&jaja

# Expected: 400 Bad Request

# Test 6: Empty slug (może zwrócić 404 od Astro routera)
curl -i http://localhost:4321/api/categories/

# Expected: 404 (lub przekierowanie do GET /api/categories)
```

---

### Krok 6: Testowanie integracyjne

**6.1. Przygotowanie danych testowych**

Sprawdź czy w bazie są wszystkie 12 kategorii:
```sql
SELECT id, name, slug, display_order FROM categories ORDER BY display_order;
```

Oczekiwany wynik:
```
1. Nabiał i Jaja (nabial-i-jaja)
2. Pieczywo i Cukiernia (pieczywo-i-cukiernia)
3. Owoce i Warzywa (owoce-i-warzywa)
4. Mięso i Wędliny (mieso-i-wedliny)
5. Ryby i Owoce Morza (ryby-i-owoce-morza)
6. Napoje i Alkohol (napoje-i-alkohol)
7. Słodycze i Przekąski (slodycze-i-przekaski)
8. Produkty sypkie i Dania gotowe (produkty-sypkie-i-dania-gotowe)
9. Mrożonki (mrozonki)
10. Chemia i Kosmetyki (chemia-i-kosmetyki)
11. Dla Domu i Zwierząt (dla-domu-i-zwierzat)
99. Inne (inne)
```

**6.2. Test flow: GET /api/categories**

```bash
# Request
curl -X GET http://localhost:4321/api/categories \
  -H "Accept: application/json" \
  -i

# Verify:
# - Status: 200 OK
# - Content-Type: application/json; charset=utf-8
# - Cache-Control: public, max-age=3600, stale-while-revalidate=7200
# - Body: Array z 12 obiektami
# - Objects mają pola: id, name, slug, display_order, created_at
# - Sortowanie: display_order ASC (1, 2, 3, ..., 99)
```

**6.3. Test flow: GET /api/categories/:slug (success)**

```bash
# Request
curl -X GET http://localhost:4321/api/categories/nabial-i-jaja \
  -H "Accept: application/json" \
  -i

# Verify:
# - Status: 200 OK
# - Content-Type: application/json; charset=utf-8
# - Cache-Control: public, max-age=3600, stale-while-revalidate=7200
# - Body: Object z kategoriami
# - Object ma pola: id, name, slug, display_order, created_at
# - name = "Nabiał i Jaja"
# - slug = "nabial-i-jaja"
```

**6.4. Test flow: GET /api/categories/:slug (not found)**

```bash
# Request
curl -X GET http://localhost:4321/api/categories/non-existent \
  -H "Accept: application/json" \
  -i

# Verify:
# - Status: 404 Not Found
# - Content-Type: application/json; charset=utf-8
# - Body: {"error": {"code": "NOT_FOUND", "message": "Category not found"}}
# - NO Cache-Control header (errors nie są cachowane)
```

**6.5. Test flow: GET /api/categories/:slug (validation error)**

```bash
# Request - uppercase
curl -X GET http://localhost:4321/api/categories/Nabial \
  -H "Accept: application/json" \
  -i

# Verify:
# - Status: 400 Bad Request
# - Content-Type: application/json; charset=utf-8
# - Body: {"error": {"code": "VALIDATION_ERROR", "message": "...", "details": [...]}}
# - details[0].field = "slug"
# - details[0].message zawiera "lowercase"
```

**6.6. Test edge cases**

```bash
# Edge case 1: Very long slug (>100 chars)
curl -X GET http://localhost:4321/api/categories/$(python -c "print('a'*101)") \
  -H "Accept: application/json" \
  -i
# Expected: 400 Validation Error

# Edge case 2: Empty slug
curl -X GET http://localhost:4321/api/categories/ \
  -i
# Expected: 404 (od Astro routera) lub redirect do /api/categories

# Edge case 3: Slug with special characters
curl -X GET "http://localhost:4321/api/categories/nabial%26jaja" \
  -i
# Expected: 400 Validation Error

# Edge case 4: Slug with spaces (URL encoded)
curl -X GET "http://localhost:4321/api/categories/nabial%20i%20jaja" \
  -i
# Expected: 400 Validation Error
```

**6.7. Test caching**

```bash
# Request 1: Initial request
time curl http://localhost:4321/api/categories
# Note response time: ~50ms (database query)

# Request 2: Cached request (jeśli włączony cache)
time curl http://localhost:4321/api/categories
# Note response time: ~5ms (from cache)

# Verify Cache-Control header:
curl -I http://localhost:4321/api/categories
# Expected: Cache-Control: public, max-age=3600, stale-while-revalidate=7200
```

---

### Krok 7: Weryfikacja bezpieczeństwa

**7.1. Test: Path traversal attack**

```bash
# Attempt 1: Directory traversal
curl http://localhost:4321/api/categories/../../../etc/passwd
# Expected: 400 Validation Error (regex blokuje ../)

# Attempt 2: Encoded traversal
curl http://localhost:4321/api/categories/%2e%2e%2f%2e%2e%2f
# Expected: 400 Validation Error (Astro może zdekodować, ale regex blokuje)
```

**7.2. Test: SQL injection**

```bash
# Attempt 1: Classic SQL injection
curl "http://localhost:4321/api/categories/nabial'; DROP TABLE categories; --"
# Expected: 400 Validation Error (regex blokuje ; i ')

# Attempt 2: Boolean-based blind SQL injection
curl "http://localhost:4321/api/categories/nabial OR 1=1"
# Expected: 400 Validation Error (regex blokuje spacje i =)
```

**7.3. Test: XSS attack (output)**

```bash
# Attempt: XSS in slug (nie powinno być możliwe, ale test)
curl "http://localhost:4321/api/categories/<script>alert('XSS')</script>"
# Expected: 400 Validation Error (regex blokuje <, >, spacje)
```

**7.4. Test: DoS through long strings**

```bash
# Attempt: Very long slug
curl http://localhost:4321/api/categories/$(python -c "print('a'*100000)")
# Expected: 400 Validation Error (max 100 chars)
```

**7.5. Verify Supabase client safety**

Sprawdź w kodzie:
- [x] `locals.supabase` jest sprawdzany przed użyciem
- [x] Service używa `.maybeSingle()` (nie `.single()` który może throw)
- [x] Queries używają `.eq()` (parametryzowane, nie string concatenation)
- [x] Nie zwracamy raw database errors do client

---

### Krok 8: Optymalizacja i monitoring

**8.1. Verify database indexes**

```sql
-- Check if indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'categories';

-- Expected indexes:
-- 1. categories_pkey (PRIMARY KEY on id)
-- 2. idx_categories_slug (INDEX on slug)
-- 3. idx_categories_display_order (INDEX on display_order)
```

**8.2. Measure query performance**

```sql
-- Explain query for getAllCategories
EXPLAIN ANALYZE
SELECT id, name, slug, display_order, created_at
FROM categories
ORDER BY display_order ASC;

-- Expected: Seq Scan (tylko 12 rekordów, index nie potrzebny)
-- Execution time: <1ms

-- Explain query for getCategoryBySlug
EXPLAIN ANALYZE
SELECT id, name, slug, display_order, created_at
FROM categories
WHERE slug = 'nabial-i-jaja';

-- Expected: Index Scan using idx_categories_slug
-- Execution time: <1ms
```

**8.3. Measure endpoint performance**

```bash
# Test 1: GET /api/categories
time curl http://localhost:4321/api/categories > /dev/null
# Expected: <100ms (cold start), <50ms (warm)

# Test 2: GET /api/categories/:slug
time curl http://localhost:4321/api/categories/nabial-i-jaja > /dev/null
# Expected: <100ms (cold start), <50ms (warm)
```

**8.4. Set up monitoring (opcjonalne - future work)**

Dodaj metryki do śledzenia:
```typescript
// W przyszłości: Dodać tracking
const startTime = Date.now();
// ... business logic
const duration = Date.now() - startTime;
console.log(`GET /api/categories took ${duration}ms`);
```

**8.5. Verify caching**

```bash
# Check response headers
curl -I http://localhost:4321/api/categories

# Verify:
# - Cache-Control: public, max-age=3600, stale-while-revalidate=7200
# - Content-Type: application/json; charset=utf-8

# Test browser caching (w przeglądarce)
# 1. Open DevTools > Network
# 2. Load page with categories
# 3. Reload page
# 4. Verify: Second load shows "(from disk cache)" or "(from memory cache)"
```

---

### Krok 9: Dokumentacja

**9.1. Dodaj komentarze JSDoc**

Sprawdź czy wszystkie pliki mają:
- [x] Opis modułu na górze pliku
- [x] JSDoc dla każdej funkcji/metody publicznej
- [x] Przykłady użycia (@example) dla złożonej logiki
- [x] Opisy parametrów (@param) i return values (@returns)

**9.2. Zaktualizuj API documentation**

Jeśli masz `.ai/api-plan.md`, sprawdź czy dokumentacja jest aktualna:
- [x] Request/Response examples są poprawne
- [x] Error codes są udokumentowane
- [x] Query parameters są opisane
- [x] Authentication requirements są jasne

**9.3. Dodaj przykłady użycia (opcjonalne)**

Utwórz `examples/categories-api-usage.md`:
```markdown
# Categories API Usage Examples

## Fetch all categories

\`\`\`javascript
const response = await fetch('/api/categories');
const { data } = await response.json();
console.log(data); // Array of 12 categories
\`\`\`

## Fetch single category

\`\`\`javascript
const response = await fetch('/api/categories/nabial-i-jaja');
const { data } = await response.json();
console.log(data.name); // "Nabiał i Jaja"
\`\`\`

## Error handling

\`\`\`javascript
const response = await fetch('/api/categories/invalid-slug');
if (!response.ok) {
  const { error } = await response.json();
  console.error(error.code, error.message);
}
\`\`\`
```

---

### Krok 10: Deployment checklist

Przed deploymentem do production, sprawdź:

**10.1. Environment variables**

```bash
# Verify .env file has:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbG...
```

**10.2. Database**

- [x] Migracja `categories` table została uruchomiona
- [x] Dane startowe (12 kategorii) zostały załadowane
- [x] Indeksy zostały utworzone (slug, display_order)
- [x] RLS policies są wyłączone (lub allow public read)

**10.3. Code quality**

```bash
# Run linter
npm run lint

# Run type check
npm run type-check

# Build project
npm run build
```

**10.4. API testing**

- [x] Wszystkie testy z Kroku 6 przechodzą
- [x] Wszystkie testy bezpieczeństwa z Kroku 7 przechodzą
- [x] Performance jest akceptowalny (Krok 8)

**10.5. Monitoring setup (opcjonalne)**

- [ ] Error tracking (Sentry)
- [ ] APM (New Relic / DataDog)
- [ ] Logging (CloudWatch / Papertrail)
- [ ] Alerts (PagerDuty / OpsGenie)

**10.6. Documentation**

- [x] README.md zawiera informacje o API
- [x] API documentation jest zaktualizowana
- [x] Code jest skomentowany (JSDoc)

**10.7. Security review**

- [x] Walidacja wszystkich inputów (slug)
- [x] Brak SQL injection vectors
- [x] Brak XSS vectors
- [x] Brak path traversal vectors
- [x] Errors nie ujawniają wrażliwych danych

**10.8. Performance review**

- [x] Caching headers są ustawione
- [x] Database queries są zoptymalizowane
- [x] Payload size jest minimalny
- [x] Response time < 100ms (p95)

---

## Podsumowanie

Po wykonaniu wszystkich kroków, powinieneś mieć:

✅ Dwa w pełni funkcjonalne endpointy:
  - `GET /api/categories` - lista wszystkich kategorii
  - `GET /api/categories/:slug` - szczegóły kategorii

✅ CategoryService z metodami:
  - `getAllCategories()` - pobiera wszystkie kategorie
  - `getCategoryBySlug()` - pobiera kategorię po slug

✅ Walidację parametrów (Zod schema):
  - `categorySlugParamSchema` - walidacja slug

✅ Obsługę błędów:
  - 400 Validation Error
  - 404 Not Found
  - 500 Internal Server Error

✅ Bezpieczeństwo:
  - Walidacja przeciwko path traversal
  - Walidacja przeciwko SQL injection
  - DoS prevention (max length)

✅ Performance:
  - Caching (1h cache, 2h stale-while-revalidate)
  - Database indexes (slug, display_order)
  - Query optimization (select tylko potrzebne kolumny)

✅ Testowanie:
  - Integration tests (success, not found, validation errors)
  - Security tests (path traversal, SQL injection)
  - Performance tests (response time)

✅ Dokumentację:
  - JSDoc comments w kodzie
  - API documentation
  - Usage examples

Endpoint jest gotowy do deployment i użycia w produkcji! 🚀

