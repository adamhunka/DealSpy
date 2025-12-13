# API Endpoint Implementation Plan: Flyers (Public)

## 1. Przegląd punktów końcowych

Ten plan opisuje implementację trzech publicznych endpointów API do przeglądania gazetek promocyjnych:

1. **GET /api/flyers** - Lista aktywnych, opublikowanych gazetek z możliwością filtrowania po sklepie
2. **GET /api/flyers/:id** - Szczegóły pojedynczej gazetki ze stronami
3. **GET /api/flyers/:id/products** - Lista wszystkich produktów z danej gazetki

Endpointy są publiczne (nie wymagają autentykacji) i służą użytkownikom końcowym do przeglądania aktualnych promocji.

### Główne funkcjonalności:
- Wyświetlanie tylko opublikowanych gazetek (status = 'published')
- Automatyczne filtrowanie gazetek usuniętych (deleted_at IS NULL)
- Wyświetlanie tylko aktywnych gazetek (valid_to >= CURRENT_DATE) dla listy
- Paginacja dla wszystkich list
- Filtrowanie po sklepie
- Generowanie pełnych URL-i do obrazków z Supabase Storage

---

## 2. Szczegóły żądań

### 2.1. GET /api/flyers

**Metoda HTTP:** GET

**Struktura URL:** `/api/flyers`

**Query Parameters:**
- **Opcjonalne:**
  - `store` (string) - Slug sklepu do filtrowania
  - `limit` (integer) - Liczba wyników na stronę (default: 20, min: 1, max: 100)
  - `offset` (integer) - Przesunięcie dla paginacji (default: 0, min: 0)

**Request Body:** Brak

**Przykład żądania:**
```
GET /api/flyers?store=biedronka&limit=20&offset=0
```

---

### 2.2. GET /api/flyers/:id

**Metoda HTTP:** GET

**Struktura URL:** `/api/flyers/:id`

**Path Parameters:**
- **Wymagane:**
  - `id` (UUID) - Identyfikator gazetki

**Query Parameters:** Brak

**Request Body:** Brak

**Przykład żądania:**
```
GET /api/flyers/123e4567-e89b-12d3-a456-426614174000
```

---

### 2.3. GET /api/flyers/:id/products

**Metoda HTTP:** GET

**Struktura URL:** `/api/flyers/:id/products`

**Path Parameters:**
- **Wymagane:**
  - `id` (UUID) - Identyfikator gazetki

**Query Parameters:**
- **Opcjonalne:**
  - `limit` (integer) - Liczba wyników na stronę (default: 50, min: 1, max: 100)
  - `offset` (integer) - Przesunięcie dla paginacji (default: 0, min: 0)

**Request Body:** Brak

**Przykład żądania:**
```
GET /api/flyers/123e4567-e89b-12d3-a456-426614174000/products?limit=50&offset=0
```

---

## 3. Wykorzystywane typy

### 3.1. DTOs (Data Transfer Objects)

Z pliku `src/types.ts`:

**FlyerListItemDTO** - Gazetka na liście:
```typescript
interface FlyerListItemDTO {
  id: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  valid_from: string;
  valid_to: string;
  page_count: number;
  created_at: string;
}
```

**FlyerPageDTO** - Strona gazetki:
```typescript
interface FlyerPageDTO {
  id: string;
  page_number: number;
  web_image_url: string;
  product_count: number;
}
```

**FlyerDetailDTO** - Szczegóły gazetki:
```typescript
interface FlyerDetailDTO extends FlyerListItemDTO {
  pages: FlyerPageDTO[];
}
```

**FlyerProductDTO** - Produkt w kontekście gazetki:
```typescript
interface FlyerProductDTO {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  category_name: string;
  category_slug: string;
  page_number: number;
  web_image_url: string;
  bbox: BBox | null;
}
```

**BBox** - Współrzędne produktu na obrazku:
```typescript
interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### 3.2. Typy pomocnicze

**ApiResponse<T>** - Wrapper dla odpowiedzi:
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

**PaginationParams** - Parametry paginacji:
```typescript
interface PaginationParams {
  limit?: number;
  offset?: number;
}
```

**ApiError** - Format błędu:
```typescript
interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

### 3.3. Schematy walidacji Zod

Nowe schematy do utworzenia w `src/lib/schemas/flyer.schema.ts`:

```typescript
import { z } from 'zod';

// GET /api/flyers
export const FlyerListParamsSchema = z.object({
  store: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/flyers/:id
export const FlyerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// GET /api/flyers/:id/products
export const FlyerProductsParamsSchema = z.object({
  id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
```

---

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/flyers

**Status 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "store_logo": "https://[url]/store-logos/biedronka.webp",
      "valid_from": "2025-01-10",
      "valid_to": "2025-01-16",
      "page_count": 12,
      "created_at": "2025-01-09T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 8
  }
}
```

---

### 4.2. GET /api/flyers/:id

**Status 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "store_logo": "https://[url]/store-logos/biedronka.webp",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "page_count": 12,
    "created_at": "2025-01-09T10:00:00Z",
    "pages": [
      {
        "id": "uuid",
        "page_number": 1,
        "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
        "product_count": 24
      }
    ]
  }
}
```

---

### 4.3. GET /api/flyers/:id/products

**Status 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Masło Extra 200g",
      "price": 4.99,
      "currency": "PLN",
      "unit": "szt",
      "category_name": "Nabiał i Jaja",
      "category_slug": "nabial-i-jaja",
      "page_number": 1,
      "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
      "bbox": {
        "x": 120,
        "y": 340,
        "width": 280,
        "height": 320
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 156
  }
}
```

---

## 5. Przepływ danych

### 5.1. GET /api/flyers

```
1. Request → Astro Endpoint (/api/flyers/index.ts)
   ↓
2. Walidacja query params (Zod schema)
   ↓
3. FlyerService.listFlyers(params)
   ↓
4. Query do Supabase:
   - SELECT z flyers JOIN stores
   - WHERE status = 'published'
   - AND deleted_at IS NULL
   - AND valid_to >= CURRENT_DATE
   - AND (store_id = X jeśli podano filtr)
   - LEFT JOIN do policzenia stron (COUNT)
   - ORDER BY valid_from DESC
   - LIMIT/OFFSET dla paginacji
   ↓
5. Transformacja danych:
   - Generowanie pełnych URL-i dla logo sklepu
   - Mapowanie do FlyerListItemDTO[]
   ↓
6. Zwrócenie ApiResponse<FlyerListItemDTO[]> z paginacją
```

**Zapytanie SQL (pseudo-kod):**
```sql
SELECT 
  f.id,
  s.name as store_name,
  s.slug as store_slug,
  s.logo_path,
  f.valid_from,
  f.valid_to,
  f.created_at,
  COUNT(fp.id) as page_count
FROM flyers f
INNER JOIN stores s ON f.store_id = s.id
LEFT JOIN flyer_pages fp ON f.id = fp.flyer_id
WHERE f.status = 'published'
  AND f.deleted_at IS NULL
  AND f.valid_to >= CURRENT_DATE
  AND (f.store_id = $1 OR $1 IS NULL)  -- filtr po sklepie
GROUP BY f.id, s.name, s.slug, s.logo_path
ORDER BY f.valid_from DESC
LIMIT $2 OFFSET $3;
```

---

### 5.2. GET /api/flyers/:id

```
1. Request → Astro Endpoint (/api/flyers/[id].ts)
   ↓
2. Walidacja path param (UUID)
   ↓
3. FlyerService.getFlyerById(id)
   ↓
4. Query do Supabase:
   - SELECT z flyers JOIN stores
   - WHERE id = :id
   - AND status = 'published'
   - AND deleted_at IS NULL
   ↓
5. Jeśli nie znaleziono → return null
   ↓
6. Query do stron gazetki:
   - SELECT z flyer_pages
   - WHERE flyer_id = :id
   - ORDER BY page_number ASC
   - LEFT JOIN do policzenia produktów
   ↓
7. Transformacja danych:
   - Generowanie URL-i dla obrazków
   - Mapowanie do FlyerDetailDTO
   ↓
8. Zwrócenie ApiResponse<FlyerDetailDTO>
```

**Zapytanie SQL dla gazetki (pseudo-kod):**
```sql
SELECT 
  f.id,
  f.valid_from,
  f.valid_to,
  f.created_at,
  s.name as store_name,
  s.slug as store_slug,
  s.logo_path
FROM flyers f
INNER JOIN stores s ON f.store_id = s.id
WHERE f.id = $1
  AND f.status = 'published'
  AND f.deleted_at IS NULL;
```

**Zapytanie SQL dla stron (pseudo-kod):**
```sql
SELECT 
  fp.id,
  fp.page_number,
  fp.web_image_path,
  COUNT(p.id) as product_count
FROM flyer_pages fp
LEFT JOIN products p ON fp.id = p.flyer_page_id
WHERE fp.flyer_id = $1
GROUP BY fp.id, fp.page_number, fp.web_image_path
ORDER BY fp.page_number ASC;
```

---

### 5.3. GET /api/flyers/:id/products

```
1. Request → Astro Endpoint (/api/flyers/[id]/products.ts)
   ↓
2. Walidacja path param + query params
   ↓
3. FlyerService.checkFlyerExists(id) - sprawdź czy gazetka istnieje
   ↓
4. Jeśli nie istnieje lub nie jest published → 404
   ↓
5. FlyerService.getFlyerProducts(id, { limit, offset })
   ↓
6. Query do Supabase:
   - SELECT z products
   - JOIN flyer_pages
   - JOIN categories
   - WHERE flyer_pages.flyer_id = :id
   - ORDER BY page_number, product name
   - LIMIT/OFFSET
   ↓
7. Transformacja danych:
   - Generowanie URL-i dla obrazków stron
   - Mapowanie do FlyerProductDTO[]
   ↓
8. Zwrócenie ApiResponse<FlyerProductDTO[]> z paginacją
```

**Zapytanie SQL (pseudo-kod):**
```sql
SELECT 
  p.id,
  p.name,
  p.price,
  p.currency,
  p.unit,
  p.bbox,
  c.name as category_name,
  c.slug as category_slug,
  fp.page_number,
  fp.web_image_path
FROM products p
INNER JOIN flyer_pages fp ON p.flyer_page_id = fp.id
INNER JOIN categories c ON p.category_id = c.id
WHERE fp.flyer_id = $1
ORDER BY fp.page_number ASC, p.name ASC
LIMIT $2 OFFSET $3;
```

---

## 6. Względy bezpieczeństwa

### 6.1. Autentykacja i autoryzacja

- **Brak wymagań autentykacji:** Endpointy są publiczne
- **RLS (Row Level Security) w Supabase:**
  - Policy dla tabeli `flyers` musi zezwalać na SELECT tylko dla `status = 'published'` i `deleted_at IS NULL`
  - Policy dla tabeli `flyer_pages` musi być powiązana z published flyers
  - Policy dla tabeli `products` musi być powiązana z published flyers

### 6.2. Walidacja danych wejściowych

**Wszystkie parametry muszą być walidowane przez Zod:**
- UUID format dla `id`
- Zakres wartości dla `limit` (1-100)
- Nieujemne wartości dla `offset`
- Slug format dla `store` (alfanumeryczne + myślniki)

**Walidacja biznesowa:**
- Sprawdzenie czy store o danym slug istnieje
- Sprawdzenie czy gazetka jest published i nie usunięta
- Sprawdzenie czy gazetka jest aktywna (dla listy)

### 6.3. Zabezpieczenie przed atakami

**SQL Injection:**
- Używanie parametryzowanych zapytań przez Supabase SDK
- Wszystkie wartości są escapowane automatycznie

**DoS (Denial of Service):**
- Limit maksymalny 100 wyników na stronę
- Rozważyć rate limiting na poziomie middleware (np. 100 requestów/minutę)
- Timeout dla zapytań do bazy danych (np. 10 sekund)

**Data Exposure:**
- Nie zwracamy wrażliwych danych (raw_ai_data, original_image_path, error_message)
- Tylko publiczne URL-e do obrazków webp
- Nie zwracamy `deleted_at`, `verified_by`, `updated_at`

### 6.4. CORS i CSP

- Konfiguracja CORS w middleware Astro dla publicznych endpointów
- Content-Security-Policy headers dla odpowiedzi

### 6.5. Monitoring i logging

- Logowanie wszystkich błędów 500
- Monitorowanie częstotliwości requestów
- Alerty przy podejrzanej aktywności (np. wiele 404)

---

## 7. Obsługa błędów

### 7.1. Kody statusu i scenariusze

#### 400 Bad Request
**Kiedy:** Nieprawidłowe parametry żądania

**Scenariusze:**
- Nieprawidłowy format UUID dla `id`
- `limit` < 1 lub > 100
- `offset` < 0
- Nieprawidłowy format `store` slug

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "id",
        "message": "Invalid UUID format"
      }
    ]
  }
}
```

---

#### 404 Not Found
**Kiedy:** Zasób nie został znaleziony

**Scenariusze dla GET /api/flyers/:id:**
- Gazetka o podanym ID nie istnieje
- Gazetka istnieje ale nie jest opublikowana (status != 'published')
- Gazetka została usunięta (deleted_at IS NOT NULL)

**Scenariusze dla GET /api/flyers/:id/products:**
- Gazetka nie istnieje lub nie jest dostępna publicznie

**Scenariusze dla GET /api/flyers (z filtrem store):**
- Store o podanym slug nie istnieje → zwracamy pustą listę (nie 404)

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Flyer not found or not available"
  }
}
```

---

#### 500 Internal Server Error
**Kiedy:** Nieoczekiwany błąd serwera

**Scenariusze:**
- Błąd połączenia z bazą danych
- Timeout zapytania
- Błąd generowania URL-i z Supabase Storage
- Nieoczekiwany błąd transformacji danych

**Przykład odpowiedzi:**
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

**Uwaga:** Szczegóły błędu są logowane po stronie serwera, ale nie są zwracane klientowi.

---

### 7.2. Centralizacja obsługi błędów

Używamy helpera `src/lib/helpers/api-response.helper.ts`:

```typescript
// Już istnieje w projekcie
export function successResponse<T>(data: T, pagination?: PaginationMeta): ApiResponse<T>
export function errorResponse(code: ErrorCode, message: string, details?: ErrorDetail[]): ApiError
```

### 7.3. Try-catch w endpointach

Wszystkie endpointy powinny mieć strukturę:

```typescript
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 1. Walidacja parametrów
    // 2. Wywołanie serwisu
    // 3. Zwrócenie success response
  } catch (error) {
    // Centralna obsługa błędów
    if (error instanceof ZodError) {
      return errorResponse("VALIDATION_ERROR", ...);
    }
    if (error instanceof NotFoundError) {
      return errorResponse("NOT_FOUND", ...);
    }
    // Log error details
    console.error("Unexpected error:", error);
    return errorResponse("INTERNAL_SERVER_ERROR", ...);
  }
};
```

---

## 8. Rozważania dotyczące wydajności

### 8.2. Caching

**HTTP Caching:**
- Nagłówki `Cache-Control` dla odpowiedzi
- `Cache-Control: public, max-age=300` (5 minut) dla GET /api/flyers
- `Cache-Control: public, max-age=600` (10 minut) dla GET /api/flyers/:id
- `ETag` headers dla walidacji cache

**Redis (opcjonalnie w przyszłości):**
- Cache dla często pobieranych gazetek
- Invalidacja cache przy aktualizacji gazetki

### 8.3. Paginacja i limity

**Zalecenia:**
- Domyślne limity: 20 dla list gazetek, 50 dla produktów
- Maksymalny limit: 100 (zabezpieczenie przed nadmiernym obciążeniem)
- Informowanie użytkownika o `has_more` w pagination meta

**Cursor-based pagination (przyszłość):**
- Rozważyć implementację dla lepszej wydajności przy dużych offsetach
- Obecnie offset-based jest wystarczające

### 8.4. Generowanie URL-i

**Optymalizacja:**
- Przechowywanie base URL Supabase Storage w konfiguracji (env variable)
- Budowanie URL-i przez konkatenację stringów zamiast query do Storage API
- Format: `${SUPABASE_STORAGE_URL}/public_flyers/${store_slug}/${valid_from}/page-${number}.webp`

---

## 9. Kroki implementacji

### Krok 1: Utworzenie schematu walidacji
**Plik:** `src/lib/schemas/flyer.schema.ts`

**Zadania:**
1. Zaimportować Zod
2. Utworzyć `FlyerListParamsSchema` z walidacją dla store, limit, offset
3. Utworzyć `FlyerIdParamsSchema` z walidacją UUID
4. Utworzyć `FlyerProductsParamsSchema` łączący ID + paginację
5. Wyeksportować wszystkie schematy

**Definicja gotowości:**
- Wszystkie schematy są przetestowane z poprawnymi i błędnymi danymi
- Typy TypeScript są wyprowadzone z Zod schemas

---

### Krok 2: Utworzenie serwisu FlyerService
**Plik:** `src/lib/services/flyer.service.ts`

**Zadania:**
1. Utworzyć klasę lub moduł `FlyerService`
2. Zaimplementować metodę `listFlyers()`:
   - Przyjmuje parametry: store?, limit, offset
   - Wykonuje query z JOIN do stores
   - Liczy strony przez LEFT JOIN + COUNT
   - Filtruje po status, deleted_at, valid_to, store_id
   - Zwraca { flyers: FlyerListItemDTO[], total: number }
3. Zaimplementować metodę `getFlyerById()`:
   - Przyjmuje id
   - Pobiera gazetkę z JOIN do stores
   - Pobiera strony z COUNT produktów
   - Zwraca FlyerDetailDTO | null
4. Zaimplementować metodę `getFlyerProducts()`:
   - Przyjmuje flyerId, limit, offset
   - Pobiera produkty z JOIN do categories i flyer_pages
   - Zwraca { products: FlyerProductDTO[], total: number }
5. Zaimplementować helper `generateStorageUrl()`:
   - Buduje pełny URL z ścieżki relatywnej

**Definicja gotowości:**
- Wszystkie metody działają poprawnie z testowymi danymi
- Transformacja danych bazodanowych do DTO jest kompletna
- URL-e są generowane prawidłowo
- Obsługa przypadków null/undefined

---

### Krok 3: Implementacja GET /api/flyers
**Plik:** `src/pages/api/flyers/index.ts`

**Zadania:**
1. Utworzyć handler `GET`
2. Zaznaczyć `export const prerender = false`
3. Walidować query params przez `FlyerListParamsSchema`
4. Wywołać `FlyerService.listFlyers()`
5. Zbudować `ApiResponse` z `successResponse()`
6. Obsłużyć błędy walidacji (400) i serwera (500)
7. Zwrócić `Response` z odpowiednimi nagłówkami:
   - `Content-Type: application/json`
   - `Cache-Control: public, max-age=300`

**Definicja gotowości:**
- Endpoint zwraca poprawne dane dla różnych scenariuszy
- Paginacja działa prawidłowo
- Filtrowanie po sklepie działa
- Błędy są obsługiwane zgodnie z planem

---

### Krok 4: Implementacja GET /api/flyers/:id
**Plik:** `src/pages/api/flyers/[id].ts`

**Zadania:**
1. Utworzyć handler `GET`
2. Zaznaczyć `export const prerender = false`
3. Walidować path param `id` przez `FlyerIdParamsSchema`
4. Wywołać `FlyerService.getFlyerById(id)`
5. Jeśli null → zwrócić 404
6. Zbudować `ApiResponse` z `successResponse()`
7. Obsłużyć błędy walidacji i 404
8. Zwrócić `Response` z nagłówkami cache

**Definicja gotowości:**
- Endpoint zwraca szczegóły gazetki ze stronami
- 404 dla nieistniejących lub niepublikowanych gazetek
- Lista stron jest posortowana po page_number

---

### Krok 5: Implementacja GET /api/flyers/:id/products
**Plik:** `src/pages/api/flyers/[id]/products.ts`

**Zadania:**
1. Utworzyć katalog `flyers/[id]` jeśli nie istnieje
2. Utworzyć handler `GET`
3. Zaznaczyć `export const prerender = false`
4. Walidować path param + query params przez `FlyerProductsParamsSchema`
5. Sprawdzić czy gazetka istnieje i jest published (można reużyć `getFlyerById`)
6. Jeśli nie → zwrócić 404
7. Wywołać `FlyerService.getFlyerProducts(id, { limit, offset })`
8. Zbudować `ApiResponse` z paginacją
9. Obsłużyć błędy
10. Zwrócić `Response` z nagłówkami

**Definicja gotowości:**
- Endpoint zwraca produkty z gazetki
- 404 dla nieistniejącej gazetki
- Paginacja działa prawidłowo
- Produkty są posortowane po stronie i nazwie

### Krok 10: Code review i refaktoryzacja

**Zadania:**
1. Przegląd kodu przez zespół
2. Sprawdzenie zgodności z coding practices z .ai/rules
3. Optymalizacja wydajności
4. Poprawa czytelności
5. Usunięcie duplikacji kodu

**Definicja gotowości:**
- Code review zaakceptowane
- Brak oczywistych problemów z wydajnością
- Kod jest zgodny z guidelines


