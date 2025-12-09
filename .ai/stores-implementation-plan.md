# API Endpoint Implementation Plan: Stores

## 1. Przegląd punktu końcowego

Implementacja dwóch publicznych endpointów REST API do odczytu danych o sklepach:

- **GET /api/stores** - Lista wszystkich sklepów z logo
- **GET /api/stores/:slug** - Szczegóły pojedynczego sklepu

Endpointy są publiczne, nie wymagają autoryzacji. Zwracają dane w formacie `StoreDTO` z pełnymi URL-ami do logo w Supabase Storage.

**Główne zadania:**
- Pobranie danych z tabeli `stores` przez Supabase client
- Transformacja `Store` entity → `StoreDTO` (konwersja `logo_path` → `logo_url`)
- Walidacja parametrów wejściowych (slug)
- Obsługa błędów (404, 500) zgodnie ze standardowym formatem `ApiError`

---

## 2. Szczegóły żądania

### 2.1 GET /api/stores

**Metoda HTTP:** GET

**Struktura URL:** `/api/stores`

**Parametry:**
- Wymagane: Brak
- Opcjonalne: Brak

**Request Headers:**
- `Accept: application/json` (opcjonalnie)

**Request Body:** Brak (GET request)

**Przykładowe żądanie:**
```http
GET /api/stores HTTP/1.1
Host: example.com
Accept: application/json
```

### 2.2 GET /api/stores/:slug

**Metoda HTTP:** GET

**Struktura URL:** `/api/stores/:slug`

**Parametry:**
- Wymagane:
  - `slug` (path parameter, string): URL-friendly identyfikator sklepu (np. "biedronka", "lidl")
    - Format: lowercase letters, numbers, hyphens
    - Regex: `^[a-z0-9-]+$`
    - Min length: 1
    - Max length: 100 (rekomendowane)
- Opcjonalne: Brak

**Request Headers:**
- `Accept: application/json` (opcjonalnie)

**Request Body:** Brak (GET request)

**Przykładowe żądanie:**
```http
GET /api/stores/biedronka HTTP/1.1
Host: example.com
Accept: application/json
```

---

## 3. Wykorzystywane typy

### 3.1 DTOs (Data Transfer Objects)

**StoreDTO** (src/types.ts, linie 60-66)
```typescript
export interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  created_at: string;
}
```

**ApiResponse<T>** (src/types.ts, linie 600-603)
```typescript
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}
```

**ApiError** (src/types.ts, linie 624-630)
```typescript
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

### 3.2 Database Entities

**Store** (src/types.ts, linia 13)
```typescript
export type Store = Tables<"stores">;
// Struktura:
// {
//   id: string (UUID)
//   name: string
//   slug: string
//   logo_path: string | null
//   created_at: string
//   updated_at: string
// }
```

### 3.3 Validation Schemas (Zod)

**Slug Validation Schema** (do utworzenia w endpoint lub service)
```typescript
import { z } from "zod";

const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1, "Store slug is required")
    .max(100, "Store slug is too long")
    .regex(/^[a-z0-9-]+$/, "Store slug must contain only lowercase letters, numbers, and hyphens")
});
```

### 3.4 Command Models

Nie dotyczy - endpointy tylko do odczytu (GET).

---

## 4. Szczegóły odpowiedzi

### 4.1 GET /api/stores

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Biedronka",
      "slug": "biedronka",
      "logo_url": "https://[supabase-project-url]/storage/v1/object/public/store-logos/biedronka.webp",
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Lidl",
      "slug": "lidl",
      "logo_url": "https://[supabase-project-url]/storage/v1/object/public/store-logos/lidl.webp",
      "created_at": "2025-01-02T00:00:00.000Z"
    }
  ]
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch stores"
  }
}
```

### 4.2 GET /api/stores/:slug

**Response 200 OK:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Biedronka",
    "slug": "biedronka",
    "logo_url": "https://[supabase-project-url]/storage/v1/object/public/store-logos/biedronka.webp",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid store slug format",
    "details": [
      {
        "field": "slug",
        "message": "Store slug must contain only lowercase letters, numbers, and hyphens"
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
    "message": "Store not found"
  }
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch store"
  }
}
```

**Content-Type:** `application/json`

**Encoding:** UTF-8

---

## 5. Przepływ danych

### 5.1 GET /api/stores

```
Client Request
    ↓
Astro API Route (/src/pages/api/stores/index.ts)
    ↓
[Walidacja] - Brak parametrów do walidacji
    ↓
StoreService.getAllStores()
    ↓
Supabase Client Query:
    SELECT id, name, slug, logo_path, created_at
    FROM stores
    ORDER BY name ASC
    ↓
Transform Store[] → StoreDTO[]
    - Konwersja logo_path → logo_url
    - Użycie Supabase Storage Public URL API
    - Filtracja pól (bez updated_at)
    ↓
Return ApiResponse<StoreDTO[]>
    ↓
HTTP 200 Response
```

**Szczegóły transformacji:**
```typescript
function transformToStoreDTO(store: Store): StoreDTO {
  const logoUrl = store.logo_path 
    ? supabase.storage.from('store-logos').getPublicUrl(store.logo_path).data.publicUrl
    : getDefaultLogoUrl();
  
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    logo_url: logoUrl,
    created_at: store.created_at
  };
}
```

### 5.2 GET /api/stores/:slug

```
Client Request (slug: "biedronka")
    ↓
Astro API Route (/src/pages/api/stores/[slug].ts)
    ↓
Extract slug from params
    ↓
[Walidacja Zod]
    - Sprawdź format slug (regex: ^[a-z0-9-]+$)
    - Sprawdź długość (min 1, max 100)
    ↓ [Invalid]
    └─→ HTTP 400 (VALIDATION_ERROR)
    ↓ [Valid]
StoreService.getStoreBySlug(slug)
    ↓
Supabase Client Query:
    SELECT id, name, slug, logo_path, created_at
    FROM stores
    WHERE slug = $1
    LIMIT 1
    ↓
[Check Result]
    ↓ [Empty]
    └─→ HTTP 404 (NOT_FOUND)
    ↓ [Found]
Transform Store → StoreDTO
    - Konwersja logo_path → logo_url
    ↓
Return ApiResponse<StoreDTO>
    ↓
HTTP 200 Response
```

**Interakcje z zewnętrznymi serwisami:**
1. **Supabase PostgreSQL** - zapytania do tabeli `stores`
2. **Supabase Storage** - generowanie publicznych URL do logo

---

## 6. Względy bezpieczeństwa

### 6.1 Autoryzacja i Autentykacja

**Status:** Nie wymagana (publiczne endpointy)

Endpointy są całkowicie publiczne. Każdy użytkownik może odczytać listę sklepów i ich szczegóły bez logowania.

**Uzasadnienie:**
- Dane sklepów (nazwy, loga, slug) są informacjami publicznymi
- Brak wrażliwych danych osobowych lub biznesowych
- Potrzebne dla niezalogowanych użytkowników przeglądających gazetki

### 6.2 Walidacja danych wejściowych

**1. Walidacja slug (GET /api/stores/:slug):**

Użyj Zod schema do walidacji:
```typescript
const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1, "Store slug is required")
    .max(100, "Store slug is too long")
    .regex(/^[a-z0-9-]+$/, "Store slug must contain only lowercase letters, numbers, and hyphens")
});
```

**Cel:**
- Zapobieganie SQL Injection (choć Supabase używa parametryzowanych queries)
- Zapobieganie Path Traversal attacks
- Walidacja formatu zgodnego z założeniami bazodanowymi

**Implementacja:**
```typescript
try {
  const { slug } = slugParamSchema.parse({ slug: params.slug });
  // Continue with validated slug
} catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid store slug format",
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 6.3 SQL Injection Prevention

**Mechanizm:** Supabase Client używa parametryzowanych queries automatycznie.

**Przykład bezpiecznego query:**
```typescript
// Supabase automatycznie escapuje parametry
const { data, error } = await supabase
  .from('stores')
  .select('id, name, slug, logo_path, created_at')
  .eq('slug', slug)  // Bezpieczne - parametryzowane
  .single();
```

**Nie używaj:** Raw SQL queries z konkatenacją stringów.

### 6.4 Rate Limiting

**Rekomendacja:** Implementacja opcjonalna na poziomie middleware lub reverse proxy (np. Nginx).

**Sugerowane limity:**
- GET /api/stores: 100 requests/min per IP
- GET /api/stores/:slug: 200 requests/min per IP

**Implementacja:** 
- Middleware Astro z in-memory store lub Redis
- Lub konfiguracja na poziomie DigitalOcean Load Balancer

### 6.5 CORS (Cross-Origin Resource Sharing)

**Konfiguracja:** Astro domyślnie obsługuje same-origin requests. Dla API publicznego rozważ:

```typescript
// astro.config.mjs
export default defineConfig({
  // ...
  vite: {
    server: {
      cors: {
        origin: '*', // lub konkretne domeny
        methods: ['GET'],
        allowedHeaders: ['Content-Type']
      }
    }
  }
});
```

### 6.6 Data Exposure

**Dane publiczne:**
- ✅ Nazwa sklepu
- ✅ Slug
- ✅ Logo (public URL)
- ✅ Data utworzenia

**Dane ukryte (nie eksponowane w API):**
- ❌ `updated_at` - wewnętrzne metadane
- ❌ Szczegóły konfiguracji Supabase Storage

**Implementacja:** Service layer filtruje dane zgodnie z definicją `StoreDTO`.

---

## 7. Obsługa błędów

### 7.1 Kategorie błędów

#### 7.1.1 Błędy walidacji (400 Bad Request)

**Przypadki:**
- Pusty slug
- Slug w niewłaściwym formacie (wielkie litery, specjalne znaki)
- Slug za długi (>100 znaków)

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid store slug format",
    "details": [
      {
        "field": "slug",
        "message": "Store slug must contain only lowercase letters, numbers, and hyphens"
      }
    ]
  }
}
```

**Logging:** Nie loguj (to błąd użytkownika, nie systemu)

**Implementacja:**
```typescript
catch (error) {
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid store slug format",
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    } as ApiError), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### 7.1.2 Błędy Not Found (404)

**Przypadki:**
- Sklep o podanym slug nie istnieje w bazie

**Response:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Store not found"
  }
}
```

**Logging:** Opcjonalnie loguj jako info/debug (może wskazywać na przestarzałe linki)

**Implementacja:**
```typescript
const store = await storeService.getStoreBySlug(slug);

if (!store) {
  console.info(`Store not found: ${slug}`);
  return new Response(JSON.stringify({
    error: {
      code: "NOT_FOUND",
      message: "Store not found"
    }
  } as ApiError), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### 7.1.3 Błędy serwera (500 Internal Server Error)

**Przypadki:**
- Błąd połączenia z Supabase
- Błąd zapytania SQL (tabela nie istnieje, brak uprawnień)
- Błąd Supabase Storage API (przy generowaniu URL)
- Nieobsłużony exception

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch stores"
  }
}
```

**Logging:** Zawsze loguj szczegóły błędu

**Implementacja:**
```typescript
try {
  const stores = await storeService.getAllStores();
  // ...
} catch (error) {
  console.error('Failed to fetch stores:', error);
  
  return new Response(JSON.stringify({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch stores"
    }
  } as ApiError), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 7.2 Error Response Format

Wszystkie błędy muszą być zgodne z interfejsem `ApiError`:

```typescript
interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

**Kody błędów:**
- `VALIDATION_ERROR` (400)
- `NOT_FOUND` (404)
- `INTERNAL_SERVER_ERROR` (500)

### 7.3 Mapowanie błędów Supabase

**Supabase PostgrestError:**
```typescript
if (error) {
  console.error('Supabase error:', error);
  
  // Mapowanie konkretnych kodów błędów Supabase (opcjonalnie)
  if (error.code === 'PGRST116') {
    // No rows returned (ale używamy .single() z maybeSingle())
  }
  
  // Domyślnie: 500
  return new Response(JSON.stringify({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch store"
    }
  } as ApiError), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 7.4 Centralized Error Handling

**Rekomendacja:** Utwórz helper function dla spójnej obsługi błędów:

```typescript
// src/lib/helpers/api-error.helper.ts
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: ErrorDetail[]
): Response {
  return new Response(JSON.stringify({
    error: { code, message, details }
  } as ApiError), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## 8. Rozważania dotyczące wydajności

### 8.1 Potencjalne wąskie gardła

#### 8.1.1 Zapytania do bazy danych

**Problem:**
- GET /api/stores może być częste (np. na stronie głównej)
- Tabela `stores` powinna być mała (<100 wierszy), ale każde zapytanie to roundtrip do Supabase

**Optymalizacje:**

1. **Indexing (już zaimplementowane):**
   ```sql
   CREATE INDEX idx_stores_slug ON stores(slug);
   ```
   
2. **Query optimization:**
   ```typescript
   // Pobierz tylko potrzebne kolumny
   .select('id, name, slug, logo_path, created_at')
   ```

3. **Caching (rekomendowane):**
   - In-memory cache dla GET /api/stores (TTL: 5-10 min)
   - Edge caching przez CDN (CloudFlare, DigitalOcean Spaces)
   - Response headers: `Cache-Control: public, max-age=300`

**Implementacja cache (przykład):**
```typescript
// Simple in-memory cache
const storeCache = {
  data: null as StoreDTO[] | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 minutes
};

export async function getAllStores(): Promise<StoreDTO[]> {
  const now = Date.now();
  
  if (storeCache.data && (now - storeCache.timestamp) < storeCache.TTL) {
    return storeCache.data;
  }
  
  // Fetch from DB
  const stores = await fetchStoresFromDB();
  
  storeCache.data = stores;
  storeCache.timestamp = now;
  
  return stores;
}
```

#### 8.1.2 Supabase Storage URL Generation

**Problem:**
- Każde wywołanie `supabase.storage.from().getPublicUrl()` generuje URL
- Dla listy sklepów może to być 10-50 wywołań

**Optymalizacje:**

1. **Batch processing:** Wszystkie URL generowane w jednej iteracji (już optymalne z `.map()`)

2. **Memoization:** Cache wygenerowanych URL w pamięci

3. **Pre-computed URLs (rekomendowane):**
   - Dodaj kolumnę `logo_url` do tabeli `stores` (computed lub trigger)
   - Lub użyj database view z wyliczonymi URL

**Przykład database view:**
```sql
CREATE VIEW stores_with_urls AS
SELECT 
  id, 
  name, 
  slug, 
  CASE 
    WHEN logo_path IS NOT NULL 
    THEN 'https://[supabase-url]/storage/v1/object/public/store-logos/' || logo_path
    ELSE 'https://[supabase-url]/storage/v1/object/public/store-logos/default.webp'
  END as logo_url,
  created_at
FROM stores;
```

#### 8.1.3 Network Latency

**Problem:**
- Roundtrip do Supabase (może być w innym regionie)

**Optymalizacje:**

1. **Edge Functions:** Rozważ Supabase Edge Functions blisko użytkowników

2. **CDN:** DigitalOcean Spaces + CDN dla statycznych response'ów

3. **Connection pooling:** Supabase automatycznie zarządza pool'em połączeń

### 8.2 Strategie optymalizacji

#### 8.2.1 HTTP Caching

**Response Headers dla GET /api/stores:**
```typescript
return new Response(JSON.stringify(response), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    'ETag': generateETag(response),
    'Vary': 'Accept-Encoding'
  }
});
```

**Response Headers dla GET /api/stores/:slug:**
```typescript
headers: {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200',
  'ETag': generateETag(response)
}
```

#### 8.2.2 Compression

**Implementacja:** Włącz gzip/brotli compression na poziomie Astro/Vite

```javascript
// astro.config.mjs
export default defineConfig({
  vite: {
    build: {
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: true }
      }
    }
  }
});
```

#### 8.2.3 Monitoring i Metryki

**Zbieraj metryki:**
- Response time (p50, p95, p99)
- Error rate
- Cache hit rate
- Database query duration

**Narzędzia:**
- Supabase Dashboard (query insights)
- Application logs
- APM (Application Performance Monitoring) - np. Sentry, DataDog

### 8.3 Limity wydajności

**Oczekiwane:**
- GET /api/stores: <100ms (z cache), <300ms (bez cache)
- GET /api/stores/:slug: <150ms (z index), <400ms (cold start)

**Alerty:**
- Response time >1s
- Error rate >1%
- Database connection errors

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury projektu

**Zadania:**
1. Upewnij się, że typy w `src/types.ts` są aktualne (StoreDTO, ApiResponse, ApiError)
2. Sprawdź, czy istnieje folder `src/lib/services` - jeśli nie, utwórz go
3. Sprawdź, czy istnieje folder `src/lib/helpers` - jeśli nie, utwórz go
4. Sprawdź, czy Supabase client jest poprawnie skonfigurowany w `src/db/supabase.client.ts`

**Oczekiwany rezultat:**
- Struktura folderów gotowa
- Typy TypeScript dostępne

---

### Krok 2: Utworzenie validation schemas

**Lokalizacja:** `src/lib/schemas/store.schema.ts` (nowy plik)

**Zadania:**
1. Zainstaluj Zod (jeśli nie jest zainstalowane): `npm install zod`
2. Utwórz plik `src/lib/schemas/store.schema.ts`
3. Zdefiniuj schema walidacji slug:

```typescript
import { z } from "zod";

/**
 * Schema walidacji parametru slug dla store
 */
export const storeSlugParamSchema = z.object({
  slug: z
    .string({ required_error: "Store slug is required" })
    .min(1, "Store slug cannot be empty")
    .max(100, "Store slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Store slug must contain only lowercase letters, numbers, and hyphens"
    ),
});

export type StoreSlugParams = z.infer<typeof storeSlugParamSchema>;
```

**Test:**
```typescript
// Przykłady poprawnych slug
storeSlugParamSchema.parse({ slug: "biedronka" }); // ✅
storeSlugParamSchema.parse({ slug: "lidl-plus" }); // ✅
storeSlugParamSchema.parse({ slug: "abc123" }); // ✅

// Przykłady niepoprawnych slug
storeSlugParamSchema.parse({ slug: "" }); // ❌
storeSlugParamSchema.parse({ slug: "Biedronka" }); // ❌ (uppercase)
storeSlugParamSchema.parse({ slug: "biedronka!" }); // ❌ (special char)
```

**Oczekiwany rezultat:**
- Plik `src/lib/schemas/store.schema.ts` utworzony
- Schema gotowa do użycia w endpointach

---

### Krok 3: Utworzenie helper functions dla obsługi błędów

**Lokalizacja:** `src/lib/helpers/api-response.helper.ts` (nowy plik)

**Zadania:**
1. Utwórz plik `src/lib/helpers/api-response.helper.ts`
2. Zaimplementuj helper functions:

```typescript
import type { ApiError, ApiResponse, ErrorCode, ErrorDetail } from "@/types";

/**
 * Tworzy standardowy error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: ErrorDetail[]
): Response {
  const errorBody: ApiError = {
    error: {
      code,
      message,
      ...(details && details.length > 0 && { details }),
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * Tworzy standardowy success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  cacheMaxAge?: number
): Response {
  const responseBody: ApiResponse<T> = { data };

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };

  if (cacheMaxAge) {
    headers["Cache-Control"] = 
      `public, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`;
  }

  return new Response(JSON.stringify(responseBody), {
    status,
    headers,
  });
}

/**
 * Konwertuje błędy Zod na format ApiError details
 */
export function formatZodErrors(error: any): ErrorDetail[] {
  if (!error.errors) return [];
  
  return error.errors.map((e: any) => ({
    field: e.path.join(".") || "unknown",
    message: e.message,
  }));
}
```

**Oczekiwany rezultat:**
- Plik `src/lib/helpers/api-response.helper.ts` utworzony
- Helper functions gotowe do użycia

---

### Krok 4: Implementacja StoreService

**Lokalizacja:** `src/lib/services/store.service.ts` (nowy plik)

**Zadania:**
1. Utwórz plik `src/lib/services/store.service.ts`
2. Zaimplementuj metody pobierania i transformacji danych:

```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { Store, StoreDTO } from "@/types";

/**
 * Service do zarządzania danymi sklepów
 */
export class StoreService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Transformuje Store entity do StoreDTO
   */
  private transformToDTO(store: Store): StoreDTO {
    // Generuj publiczny URL dla logo
    const logoUrl = store.logo_path
      ? this.supabase.storage
          .from("store-logos")
          .getPublicUrl(store.logo_path).data.publicUrl
      : this.getDefaultLogoUrl();

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logo_url: logoUrl,
      created_at: store.created_at,
    };
  }

  /**
   * Zwraca URL domyślnego loga (gdy sklep nie ma własnego)
   */
  private getDefaultLogoUrl(): string {
    return this.supabase.storage
      .from("store-logos")
      .getPublicUrl("default.webp").data.publicUrl;
  }

  /**
   * Pobiera wszystkie sklepy
   */
  async getAllStores(): Promise<StoreDTO[]> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, slug, logo_path, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch stores from database:", error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return [];
    }

    return data.map((store) => this.transformToDTO(store));
  }

  /**
   * Pobiera pojedynczy sklep po slug
   */
  async getStoreBySlug(slug: string): Promise<StoreDTO | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, slug, logo_path, created_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch store with slug "${slug}":`, error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return null;
    }

    return this.transformToDTO(data);
  }
}
```

**Uwagi:**
- Używamy `.maybeSingle()` zamiast `.single()` - nie rzuca błędu gdy brak wyniku
- Service rzuca wyjątki przy błędach DB - obsługa w route handler
- Transformacja do DTO ukrywa szczegóły implementacji storage

**Oczekiwany rezultat:**
- Plik `src/lib/services/store.service.ts` utworzony
- Logika biznesowa wyodrębniona z API routes

---

### Krok 5: Implementacja GET /api/stores endpoint

**Lokalizacja:** `src/pages/api/stores/index.ts` (nowy plik)

**Zadania:**
1. Utwórz folder `src/pages/api/stores` (jeśli nie istnieje)
2. Utwórz plik `src/pages/api/stores/index.ts`
3. Zaimplementuj endpoint handler:

```typescript
import type { APIRoute } from "astro";
import { StoreService } from "@/lib/services/store.service";
import { createErrorResponse, createSuccessResponse } from "@/lib/helpers/api-response.helper";

export const prerender = false;

/**
 * GET /api/stores
 * 
 * Zwraca listę wszystkich sklepów
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Pobierz Supabase client z context
    const supabase = locals.supabase;
    
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        "Service temporarily unavailable",
        500
      );
    }

    // Utwórz instancję service
    const storeService = new StoreService(supabase);

    // Pobierz sklepy
    const stores = await storeService.getAllStores();

    // Zwróć response z cache headers (5 minut)
    return createSuccessResponse(stores, 200, 300);
    
  } catch (error) {
    console.error("Error in GET /api/stores:", error);
    
    return createErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to fetch stores",
      500
    );
  }
};
```

**Uwagi:**
- `export const prerender = false` - wyłącza pre-rendering dla API route
- Supabase client pobierany z `locals` (ustawiony w middleware)
- Cache-Control: 300s (5 minut) dla optymalizacji
- Wszystkie błędy catchowane i logowane

**Test manualny:**
```bash
curl http://localhost:4321/api/stores
```

**Oczekiwany rezultat:**
- Endpoint zwraca listę sklepów w formacie JSON
- Response zawiera header Cache-Control
- Błędy są poprawnie obsługiwane

---

### Krok 6: Implementacja GET /api/stores/:slug endpoint

**Lokalizacja:** `src/pages/api/stores/[slug].ts` (nowy plik)

**Zadania:**
1. Utwórz plik `src/pages/api/stores/[slug].ts`
2. Zaimplementuj endpoint handler z walidacją:

```typescript
import type { APIRoute } from "astro";
import { z } from "zod";
import { StoreService } from "@/lib/services/store.service";
import { storeSlugParamSchema } from "@/lib/schemas/store.schema";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodErrors,
} from "@/lib/helpers/api-response.helper";

export const prerender = false;

/**
 * GET /api/stores/:slug
 * 
 * Zwraca szczegóły pojedynczego sklepu
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Walidacja parametru slug
    let validatedParams;
    try {
      validatedParams = storeSlugParamSchema.parse({ slug: params.slug });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          "Invalid store slug format",
          400,
          formatZodErrors(error)
        );
      }
      throw error;
    }

    // Pobierz Supabase client z context
    const supabase = locals.supabase;
    
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        "Service temporarily unavailable",
        500
      );
    }

    // Utwórz instancję service
    const storeService = new StoreService(supabase);

    // Pobierz sklep
    const store = await storeService.getStoreBySlug(validatedParams.slug);

    // Sprawdź czy znaleziono
    if (!store) {
      return createErrorResponse(
        "NOT_FOUND",
        "Store not found",
        404
      );
    }

    // Zwróć response z cache headers (10 minut)
    return createSuccessResponse(store, 200, 600);
    
  } catch (error) {
    console.error(`Error in GET /api/stores/${params.slug}:`, error);
    
    return createErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to fetch store",
      500
    );
  }
};
```

**Uwagi:**
- Walidacja slug przez Zod przed query do DB
- Cache-Control: 600s (10 minut) - dłużej niż lista
- Zwraca 404 gdy sklep nie istnieje
- Szczegółowe error details dla błędów walidacji

**Test manualny:**
```bash
# Prawidłowy slug
curl http://localhost:4321/api/stores/biedronka

# Nieprawidłowy slug (uppercase)
curl http://localhost:4321/api/stores/Biedronka

# Nieistniejący sklep
curl http://localhost:4321/api/stores/nieistniejacy-sklep
```

**Oczekiwany rezultat:**
- Endpoint zwraca szczegóły sklepu dla prawidłowego slug
- 400 dla nieprawidłowego formatu
- 404 dla nieistniejącego sklepu

---

### Krok 7: Konfiguracja Supabase Client w middleware

**Lokalizacja:** `src/middleware/index.ts`

**Zadania:**
1. Sprawdź czy middleware już istnieje
2. Upewnij się, że Supabase client jest dostępny w `locals`:

```typescript
import type { MiddlewareHandler } from "astro";
import { createServerClient } from "@/db/supabase.client";

export const onRequest: MiddlewareHandler = async ({ locals, request }, next) => {
  // Utwórz Supabase client
  locals.supabase = createServerClient(request);

  // Kontynuuj request
  return next();
};
```

**Uwagi:**
- Jeśli middleware już istnieje, upewnij się że ustawia `locals.supabase`
- Client powinien być tworzony per-request

**Oczekiwany rezultat:**
- Supabase client dostępny w każdym API route przez `locals.supabase`

---

### Krok 8: Konfiguracja TypeScript dla locals

**Lokalizacja:** `src/env.d.ts` (lub `astro.env.d.ts`)

**Zadania:**
1. Sprawdź czy plik `src/env.d.ts` istnieje
2. Dodaj typ dla `locals.supabase`:

```typescript
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    supabase: import("@/db/supabase.client").SupabaseClient;
  }
}
```

**Oczekiwany rezultat:**
- TypeScript rozpoznaje `locals.supabase` w API routes
- Autocomplete działa dla metod Supabase

---

### Krok 9: Testowanie manualne

**Zadania:**

1. **Uruchom dev server:**
   ```bash
   npm run dev
   ```

2. **Test GET /api/stores:**
   ```bash
   curl http://localhost:4321/api/stores | jq
   ```
   
   Sprawdź:
   - ✅ Status 200
   - ✅ Response zawiera array sklepów
   - ✅ Każdy sklep ma wszystkie wymagane pola (id, name, slug, logo_url, created_at)
   - ✅ logo_url zawiera pełny URL (zaczyna się od https://)

3. **Test GET /api/stores/:slug (prawidłowy):**
   ```bash
   curl http://localhost:4321/api/stores/biedronka | jq
   ```
   
   Sprawdź:
   - ✅ Status 200
   - ✅ Response zawiera szczegóły sklepu
   - ✅ Wszystkie pola zgodne ze StoreDTO

4. **Test GET /api/stores/:slug (nieprawidłowy format):**
   ```bash
   curl http://localhost:4321/api/stores/BIEDRONKA | jq
   ```
   
   Sprawdź:
   - ✅ Status 400
   - ✅ error.code = "VALIDATION_ERROR"
   - ✅ error.details zawiera informacje o błędzie

5. **Test GET /api/stores/:slug (nieistniejący):**
   ```bash
   curl http://localhost:4321/api/stores/xyz123 | jq
   ```
   
   Sprawdź:
   - ✅ Status 404
   - ✅ error.code = "NOT_FOUND"
   - ✅ error.message = "Store not found"

**Oczekiwany rezultat:**
- Wszystkie testy przechodzą
- Response zgodne ze specyfikacją
- Błędy obsługiwane poprawnie

---

### Krok 10: Testowanie cache headers

**Zadania:**

1. **Sprawdź cache headers dla GET /api/stores:**
   ```bash
   curl -I http://localhost:4321/api/stores
   ```
   
   Sprawdź:
   - ✅ `Cache-Control: public, max-age=300, stale-while-revalidate=600`
   - ✅ `Content-Type: application/json; charset=utf-8`

2. **Sprawdź cache headers dla GET /api/stores/:slug:**
   ```bash
   curl -I http://localhost:4321/api/stores/biedronka
   ```
   
   Sprawdź:
   - ✅ `Cache-Control: public, max-age=600, stale-while-revalidate=1200`

**Oczekiwany rezultat:**
- Cache headers ustawione poprawnie
- Optymalizacja wydajności włączona

---

### Krok 11: Weryfikacja logowania błędów

**Zadania:**

1. **Symuluj błąd bazy danych** (wyłącz Supabase lub użyj nieprawidłowych credentials)

2. **Sprawdź logi serwera:**
   ```
   Error in GET /api/stores: Error: Database query failed
   Failed to fetch stores from database: [szczegóły błędu Supabase]
   ```

3. **Sprawdź response:**
   - ✅ Status 500
   - ✅ error.code = "INTERNAL_SERVER_ERROR"
   - ✅ error.message nie ujawnia szczegółów technicznych

**Oczekiwany rezultat:**
- Błędy logowane do console
- Response nie ujawnia wrażliwych informacji
- Użytkownik dostaje czytelny komunikat

---

### Krok 12: Code review i refactoring

**Zadania:**

1. **Sprawdź zgodność z regułami projektu:**
   - ✅ Używa Supabase z `locals` (nie bezpośrednio import)
   - ✅ Używa Zod do walidacji
   - ✅ Logika w service, nie w route
   - ✅ Early returns dla błędów
   - ✅ Guard clauses na początku funkcji
   - ✅ Brak niepotrzebnych `else` statements

2. **Sprawdź TypeScript:**
   - ✅ Brak błędów kompilacji
   - ✅ Brak `any` types
   - ✅ Wszystkie typy importowane z `@/types`

3. **Sprawdź formatting:**
   ```bash
   npm run lint
   npm run format
   ```

4. **Popraw linter errors** (jeśli są)

**Oczekiwany rezultat:**
- Kod zgodny z wytycznymi projektu
- Brak błędów TypeScript i linter
- Kod sformatowany

---

### Krok 13: Dokumentacja

**Zadania:**

1. **Dodaj JSDoc do wszystkich public functions:**
   - StoreService.getAllStores()
   - StoreService.getStoreBySlug()
   - Helper functions

2. **Dodaj komentarze do złożonej logiki** (jeśli jest)

3. **Opcjonalnie:** Aktualizuj README.md z przykładami użycia API

**Przykład JSDoc:**
```typescript
/**
 * Pobiera wszystkie sklepy z bazy danych i transformuje do DTO
 * 
 * @returns Promise<StoreDTO[]> Lista sklepów z pełnymi URL do logo
 * @throws Error gdy zapytanie do bazy danych się nie powiedzie
 * 
 * @example
 * const stores = await storeService.getAllStores();
 * // [{ id: "...", name: "Biedronka", slug: "biedronka", ... }]
 */
async getAllStores(): Promise<StoreDTO[]> {
  // ...
}
```

**Oczekiwany rezultat:**
- Kod dobrze udokumentowany
- Łatwy do zrozumienia dla innych developerów

---

### Krok 14: Deployment checklist

**Zadania:**

1. **Sprawdź environment variables:**
   - ✅ SUPABASE_URL
   - ✅ SUPABASE_ANON_KEY
   - ✅ Configured w production (DigitalOcean)

2. **Sprawdź Supabase Storage:**
   - ✅ Bucket `store-logos` istnieje
   - ✅ Bucket jest publiczny
   - ✅ Domyślne logo `default.webp` jest uploaded

3. **Sprawdź Supabase RLS (Row Level Security):**
   - ✅ Polityki pozwalają na publiczny odczyt tabeli `stores`
   - ✅ Brak polityk blokujących SELECT

4. **Sprawdź performance w production:**
   - ✅ Response time <500ms
   - ✅ Cache działa poprawnie
   - ✅ CDN włączony (jeśli dotyczy)

**Oczekiwany rezultat:**
- Aplikacja gotowa do deploy
- Wszystkie dependencies skonfigurowane

---

### Krok 15: Monitoring i metryki

**Zadania:**

1. **Skonfiguruj monitoring:**
   - Supabase Dashboard → Query Performance
   - Application logs w DigitalOcean

2. **Ustaw alerty:**
   - Response time >1s
   - Error rate >1%

3. **Śledź metryki:**
   - Liczba requestów GET /api/stores
   - Liczba requestów GET /api/stores/:slug
   - Cache hit rate
   - Najczęściej wyszukiwane slug

**Oczekiwany rezultat:**
- Monitoring włączony
- Alerty skonfigurowane
- Możliwość śledzenia performance

---

## 10. Podsumowanie

Po wykonaniu wszystkich kroków otrzymasz:

✅ **2 działające endpointy:**
- GET /api/stores - lista sklepów
- GET /api/stores/:slug - szczegóły sklepu

✅ **Zgodność z best practices:**
- Service layer dla logiki biznesowej
- Walidacja Zod dla input
- Standardowy format błędów
- Cache headers dla performance

✅ **Bezpieczeństwo:**
- Walidacja wszystkich input
- Brak SQL injection
- Brak data exposure

✅ **Wydajność:**
- Cache headers (5-10 min)
- Optymalne zapytania DB
- Index na kolumnie slug

✅ **Maintainability:**
- Czysty, udokumentowany kod
- Zgodność z project guidelines
- Łatwe do testowania i rozszerzania

**Kolejne kroki:**
- Implementuj pozostałe endpointy (categories, products, flyers)
- Rozważ dodanie rate limiting
- Dodaj automated tests (unit + integration)
- Monitoruj performance w production

