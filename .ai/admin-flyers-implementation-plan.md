# API Endpoint Implementation Plan: Admin Flyer Management

## 1. Przegląd punktów końcowych

Ten plan obejmuje implementację pięciu endpointów REST API do administracyjnego zarządzania gazetkami promocyjnymi:

1. **GET /api/admin/flyers** - Lista wszystkich gazetek z możliwością filtrowania (w tym usuniętych i draft)
2. **GET /api/admin/flyers/:id** - Szczegółowe informacje o gazetce wraz ze stronami i statusem przetwarzania
3. **POST /api/admin/flyers** - Tworzenie nowej gazetki z metadanymi
4. **PATCH /api/admin/flyers/:id** - Aktualizacja metadanych lub statusu gazetki
5. **DELETE /api/admin/flyers/:id** - Soft delete gazetki

Wszystkie endpointy wymagają uwierzytelnienia i autoryzacji na poziomie administratora.

---

## 2. Szczegóły żądań

### 2.1. GET /api/admin/flyers

**Metoda HTTP:** GET

**Struktura URL:** `/api/admin/flyers`

**Parametry zapytania:**
- **Opcjonalne:**
  - `store` (string) - Slug sklepu do filtrowania
  - `status` (enum) - Status gazetki: `draft` | `published` | `expired`
  - `include_deleted` (boolean) - Czy uwzględnić usunięte gazetki (domyślnie: `false`)
  - `limit` (number) - Liczba wyników na stronę (domyślnie: `20`, max: `100`)
  - `offset` (number) - Przesunięcie dla paginacji (domyślnie: `0`)

**Request Body:** Brak

---

### 2.2. GET /api/admin/flyers/:id

**Metoda HTTP:** GET

**Struktura URL:** `/api/admin/flyers/:id`

**Parametry ścieżki:**
- **Wymagane:**
  - `id` (UUID) - Identyfikator gazetki

**Parametry zapytania:** Brak

**Request Body:** Brak

---

### 2.3. POST /api/admin/flyers

**Metoda HTTP:** POST

**Struktura URL:** `/api/admin/flyers`

**Parametry:** Brak

**Request Body:**
```typescript
{
  store_id: string;      // UUID sklepu
  valid_from: string;    // Format: YYYY-MM-DD
  valid_to: string;      // Format: YYYY-MM-DD
}
```

**Walidacja:**
- `store_id` - poprawny UUID, sklep musi istnieć
- `valid_from` - poprawna data w formacie ISO 8601
- `valid_to` - poprawna data w formacie ISO 8601
- `valid_from` musi być <= `valid_to`
- Daty nie mogą być w przeszłości (względem dzisiejszej daty)

---

### 2.4. PATCH /api/admin/flyers/:id

**Metoda HTTP:** PATCH

**Struktura URL:** `/api/admin/flyers/:id`

**Parametry ścieżki:**
- **Wymagane:**
  - `id` (UUID) - Identyfikator gazetki

**Request Body:**
```typescript
{
  valid_from?: string;     // Format: YYYY-MM-DD
  valid_to?: string;       // Format: YYYY-MM-DD
  status?: FlyerStatus;    // 'draft' | 'published' | 'expired'
}
```

**Walidacja:**
- Co najmniej jedno pole musi być obecne
- `valid_from` i `valid_to` - jeśli podane, muszą być w poprawnym formacie
- Jeśli oba są podane, `valid_from` <= `valid_to`
- `status` - musi być jednym z dozwolonych wartości enum

---

### 2.5. DELETE /api/admin/flyers/:id

**Metoda HTTP:** DELETE

**Struktura URL:** `/api/admin/flyers/:id`

**Parametry ścieżki:**
- **Wymagane:**
  - `id` (UUID) - Identyfikator gazetki

**Request Body:** Brak

---

## 3. Wykorzystywane typy

### 3.1. DTOs (Data Transfer Objects)

```typescript
// Lista gazetek dla administratora
interface AdminFlyerListItemDTO {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  total_pages: number;
  verified_pages: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  verified_by: string | null;
  verified_by_name: string | null;
}

// Szczegóły strony gazetki dla administratora
interface AdminFlyerPageDetailDTO {
  id: string;
  flyer_id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: string;
  product_count: number;
  has_raw_ai_data: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Szczegóły gazetki dla administratora
interface AdminFlyerDetailDTO {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  pages: AdminFlyerPageDetailDTO[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  verified_by: string | null;
  verified_by_name: string | null;
}
```

### 3.2. Command Models

```typescript
// Tworzenie nowej gazetki
interface CreateFlyerCommand {
  store_id: string;
  valid_from: string;
  valid_to: string;
}

// Aktualizacja gazetki
interface UpdateFlyerCommand {
  valid_from?: string;
  valid_to?: string;
  status?: FlyerStatus;
}

// Parametry zapytania dla listy gazetek
interface AdminFlyerListParams {
  store?: string;
  status?: FlyerStatus;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}
```

### 3.3. Typy pomocnicze

```typescript
type FlyerStatus = 'draft' | 'published' | 'expired';

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}
```

### 3.4. Schematy Zod

Wszystkie schematy Zod będą zlokalizowane w `src/lib/schemas/flyer.schema.ts`:

```typescript
// Walidacja parametrów zapytania dla listy gazetek
export const adminFlyerListParamsSchema = z.object({
  store: z.string().optional(),
  status: z.enum(['draft', 'published', 'expired']).optional(),
  include_deleted: z.string().optional().transform(val => val === 'true'),
  limit: z.string().optional().transform(val => {
    const num = Number(val);
    return isNaN(num) ? 20 : Math.min(Math.max(1, num), 100);
  }),
  offset: z.string().optional().transform(val => {
    const num = Number(val);
    return isNaN(num) ? 0 : Math.max(0, num);
  })
});

// Walidacja UUID dla parametrów ścieżki
export const flyerIdParamsSchema = z.object({
  id: z.string().uuid('Invalid flyer ID format')
});

// Walidacja tworzenia gazetki
export const createFlyerSchema = z.object({
  store_id: z.string().uuid('Invalid store ID format'),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD')
}).refine(data => {
  const from = new Date(data.valid_from);
  const to = new Date(data.valid_to);
  return from <= to;
}, {
  message: 'valid_from must be before or equal to valid_to',
  path: ['valid_from']
}).refine(data => {
  const from = new Date(data.valid_from);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return from >= today;
}, {
  message: 'valid_from cannot be in the past',
  path: ['valid_from']
});

// Walidacja aktualizacji gazetki
export const updateFlyerSchema = z.object({
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD').optional(),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD').optional(),
  status: z.enum(['draft', 'published', 'expired']).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
}).refine(data => {
  if (data.valid_from && data.valid_to) {
    const from = new Date(data.valid_from);
    const to = new Date(data.valid_to);
    return from <= to;
  }
  return true;
}, {
  message: 'valid_from must be before or equal to valid_to',
  path: ['valid_from']
});
```

---

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/admin/flyers

**Sukces (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "store_id": "223e4567-e89b-12d3-a456-426614174001",
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "valid_from": "2024-01-15",
      "valid_to": "2024-01-28",
      "status": "published",
      "total_pages": 12,
      "verified_pages": 10,
      "deleted_at": null,
      "created_at": "2024-01-10T10:00:00Z",
      "updated_at": "2024-01-12T14:30:00Z",
      "verified_by": "admin-uuid",
      "verified_by_name": "Jan Kowalski"
    }
  ],
  "meta": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

**Błędy:**
- **400 Bad Request** - Nieprawidłowe parametry zapytania
- **401 Unauthorized** - Brak sesji użytkownika
- **403 Forbidden** - Użytkownik nie jest administratorem
- **500 Internal Server Error** - Błąd serwera

---

### 4.2. GET /api/admin/flyers/:id

**Sukces (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "store_id": "223e4567-e89b-12d3-a456-426614174001",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "valid_from": "2024-01-15",
    "valid_to": "2024-01-28",
    "status": "published",
    "pages": [
      {
        "id": "page-uuid-1",
        "flyer_id": "123e4567-e89b-12d3-a456-426614174000",
        "page_number": 1,
        "original_image_url": "https://storage.url/original/page1.jpg",
        "web_image_url": "https://storage.url/web/page1.webp",
        "status": "processed",
        "product_count": 8,
        "has_raw_ai_data": true,
        "error_message": null,
        "created_at": "2024-01-10T10:05:00Z",
        "updated_at": "2024-01-10T10:15:00Z"
      }
    ],
    "deleted_at": null,
    "created_at": "2024-01-10T10:00:00Z",
    "updated_at": "2024-01-12T14:30:00Z",
    "verified_by": "admin-uuid",
    "verified_by_name": "Jan Kowalski"
  }
}
```

**Błędy:**
- **400 Bad Request** - Nieprawidłowy format UUID
- **401 Unauthorized** - Brak sesji użytkownika
- **403 Forbidden** - Użytkownik nie jest administratorem
- **404 Not Found** - Gazetka nie istnieje
- **500 Internal Server Error** - Błąd serwera

---

### 4.3. POST /api/admin/flyers

**Sukces (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "store_id": "223e4567-e89b-12d3-a456-426614174001",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "valid_from": "2024-01-15",
    "valid_to": "2024-01-28",
    "status": "draft",
    "pages": [],
    "deleted_at": null,
    "created_at": "2024-01-10T10:00:00Z",
    "updated_at": "2024-01-10T10:00:00Z",
    "verified_by": null,
    "verified_by_name": null
  }
}
```

**Błędy:**
- **400 Bad Request** - Nieprawidłowe dane wejściowe
- **401 Unauthorized** - Brak sesji użytkownika
- **403 Forbidden** - Użytkownik nie jest administratorem
- **404 Not Found** - Sklep o podanym ID nie istnieje
- **500 Internal Server Error** - Błąd serwera

---

### 4.4. PATCH /api/admin/flyers/:id

**Sukces (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "store_id": "223e4567-e89b-12d3-a456-426614174001",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "valid_from": "2024-01-16",
    "valid_to": "2024-01-29",
    "status": "published",
    "pages": [...],
    "deleted_at": null,
    "created_at": "2024-01-10T10:00:00Z",
    "updated_at": "2024-01-12T15:00:00Z",
    "verified_by": "admin-uuid",
    "verified_by_name": "Jan Kowalski"
  }
}
```

**Błędy:**
- **400 Bad Request** - Nieprawidłowe dane wejściowe lub brak pól do aktualizacji
- **401 Unauthorized** - Brak sesji użytkownika
- **403 Forbidden** - Użytkownik nie jest administratorem
- **404 Not Found** - Gazetka nie istnieje
- **500 Internal Server Error** - Błąd serwera

---

### 4.5. DELETE /api/admin/flyers/:id

**Sukces (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "deleted": true,
    "deleted_at": "2024-01-12T16:00:00Z"
  }
}
```

**Błędy:**
- **400 Bad Request** - Nieprawidłowy format UUID
- **401 Unauthorized** - Brak sesji użytkownika
- **403 Forbidden** - Użytkownik nie jest administratorem
- **404 Not Found** - Gazetka nie istnieje lub została już usunięta
- **500 Internal Server Error** - Błąd serwera

---

## 5. Przepływ danych

### 5.1. GET /api/admin/flyers

```
1. Request → Astro Server Endpoint
2. Middleware → Dodanie supabase client do context.locals
3. Endpoint → Walidacja parametrów zapytania (Zod)
4. Endpoint → Sprawdzenie autoryzacji administratora
5. Endpoint → Wywołanie FlyerService.listAdminFlyers()
6. Service → Query do Supabase:
   - SELECT z flyers JOIN stores
   - WHERE warunki (store, status, deleted_at)
   - ORDER BY created_at DESC
   - LIMIT i OFFSET dla paginacji
7. Service → Transformacja danych do AdminFlyerListItemDTO
8. Service → COUNT(*) dla meta.total
9. Endpoint → createSuccessResponse() z danymi i meta
10. Response → JSON z listą gazetek i metadanymi paginacji
```

### 5.2. GET /api/admin/flyers/:id

```
1. Request → Astro Server Endpoint
2. Middleware → Dodanie supabase client do context.locals
3. Endpoint → Walidacja parametru :id (Zod)
4. Endpoint → Sprawdzenie autoryzacji administratora
5. Endpoint → Wywołanie FlyerService.getAdminFlyerById()
6. Service → Query do Supabase:
   - SELECT z flyers JOIN stores WHERE flyers.id = :id
7. Service → Query do Supabase:
   - SELECT z flyer_pages WHERE flyer_id = :id ORDER BY page_number
8. Service → Dla każdej strony:
   - Generowanie URL-i obrazów (Supabase Storage)
   - COUNT produktów z products WHERE flyer_page_id = page.id
9. Service → Transformacja danych do AdminFlyerDetailDTO
10. Endpoint → createSuccessResponse() z danymi
11. Response → JSON ze szczegółami gazetki
```

### 5.3. POST /api/admin/flyers

```
1. Request → Astro Server Endpoint
2. Middleware → Dodanie supabase client do context.locals
3. Endpoint → Parsowanie JSON body
4. Endpoint → Walidacja body (Zod - createFlyerSchema)
5. Endpoint → Sprawdzenie autoryzacji administratora
6. Endpoint → Wywołanie FlyerService.createFlyer()
7. Service → Sprawdzenie czy sklep istnieje (stores WHERE id = store_id)
8. Service → INSERT do flyers:
   - store_id, valid_from, valid_to
   - status = 'draft'
   - created_at, updated_at = NOW()
9. Service → SELECT utworzonej gazetki z JOIN stores
10. Service → Transformacja danych do AdminFlyerDetailDTO
11. Endpoint → createSuccessResponse() z kodem 201
12. Response → JSON z nowo utworzoną gazetką
```

### 5.4. PATCH /api/admin/flyers/:id

```
1. Request → Astro Server Endpoint
2. Middleware → Dodanie supabase client do context.locals
3. Endpoint → Parsowanie JSON body
4. Endpoint → Walidacja :id (Zod)
5. Endpoint → Walidacja body (Zod - updateFlyerSchema)
6. Endpoint → Sprawdzenie autoryzacji administratora
7. Endpoint → Wywołanie FlyerService.updateFlyer()
8. Service → Sprawdzenie czy gazetka istnieje (flyers WHERE id = :id)
9. Service → UPDATE flyers SET:
   - Tylko przekazane pola (valid_from, valid_to, status)
   - updated_at = NOW()
10. Service → SELECT zaktualizowanej gazetki z JOIN stores i pages
11. Service → Transformacja danych do AdminFlyerDetailDTO
12. Endpoint → createSuccessResponse() z danymi
13. Response → JSON z zaktualizowaną gazetką
```

### 5.5. DELETE /api/admin/flyers/:id

```
1. Request → Astro Server Endpoint
2. Middleware → Dodanie supabase client do context.locals
3. Endpoint → Walidacja :id (Zod)
4. Endpoint → Sprawdzenie autoryzacji administratora
5. Endpoint → Wywołanie FlyerService.deleteFlyer()
6. Service → Sprawdzenie czy gazetka istnieje i nie jest usunięta
7. Service → UPDATE flyers SET:
   - deleted_at = NOW()
   - updated_at = NOW()
8. Service → Zwrócenie informacji o usunięciu
9. Endpoint → createSuccessResponse() z informacją
10. Response → JSON potwierdzający usunięcie
```

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie

**Implementacja:**
- Wykorzystanie Supabase Auth przez `context.locals.supabase`
- Sprawdzenie sesji użytkownika: `await supabase.auth.getSession()`
- Jeśli brak sesji → **401 Unauthorized**

**Kod:**
```typescript
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  return createErrorResponse(401, 'UNAUTHORIZED', 'Authentication required');
}
```

### 6.2. Autoryzacja

**Implementacja:**
- Sprawdzenie roli użytkownika z metadanych sesji lub tabeli użytkowników
- Weryfikacja czy użytkownik ma rolę `admin`
- Jeśli nie jest adminem → **403 Forbidden**

**Możliwe podejścia:**
1. **Metadane sesji:** `session.user.user_metadata.role === 'admin'`
2. **Query do bazy:** `SELECT role FROM user_roles WHERE user_id = session.user.id`

**Kod:**
```typescript
const userId = session.user.id;
const { data: userRole } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .single();

if (userRole?.role !== 'admin') {
  return createErrorResponse(403, 'FORBIDDEN', 'Admin access required');
}
```

**Uwaga:** Należy zdefiniować dokładny mechanizm przechowywania i weryfikacji ról użytkowników zgodnie z architekturą projektu.

### 6.3. Walidacja danych wejściowych

**Implementacja:**
- Wszystkie dane wejściowe walidowane przez Zod przed przetworzeniem
- Użycie `formatZodErrors()` do zwracania przyjaznych komunikatów błędów
- Walidacja typów, formatów, zakresów wartości

**Kod:**
```typescript
const validation = createFlyerSchema.safeParse(requestBody);
if (!validation.success) {
  return createErrorResponse(
    400,
    'VALIDATION_ERROR',
    'Invalid request data',
    formatZodErrors(validation.error)
  );
}
```

### 6.4. Walidacja UUID

**Implementacja:**
- Wszystkie identyfikatory (ID gazetek, sklepów) walidowane jako UUID v4
- Zapobiega SQL injection i nieprawidłowym zapytaniom

### 6.5. Ochrona przed SQL Injection

**Implementacja:**
- Wykorzystanie Supabase SDK z prepared statements
- Nigdy nie konkatenowanie SQL-a z danymi użytkownika
- Wszystkie parametry przekazywane przez metody SDK (`.eq()`, `.insert()`, etc.)

### 6.6. Rate Limiting

**Zalecenie:**
- Implementacja rate limiting na poziomie middleware lub proxy (np. Cloudflare, Nginx)
- Limit zapytań na użytkownika/IP (np. 100 req/min dla endpointów admin)

### 6.7. HTTPS

**Wymaganie:**
- Wszystkie komunikacje przez HTTPS
- Brak transmisji danych uwierzytelniających przez HTTP

---

## 7. Obsługa błędów

### 7.1. Format błędów

Wszystkie błędy zwracane w standardowym formacie `ApiError`:

```typescript
interface ApiError {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

interface ErrorDetail {
  field: string;
  message: string;
}
```

### 7.3. Implementacja obsługi błędów

**W Astro Server Endpoint:**
```typescript
try {
  // Walidacja
  const validation = schema.safeParse(data);
  if (!validation.success) {
    return createErrorResponse(
      400,
      'VALIDATION_ERROR',
      'Invalid request data',
      formatZodErrors(validation.error)
    );
  }

  // Autoryzacja
  if (!isAdmin) {
    return createErrorResponse(403, 'FORBIDDEN', 'Admin access required');
  }

  // Logika biznesowa
  const result = await service.method();
  
  if (!result) {
    return createErrorResponse(404, 'NOT_FOUND', 'Resource not found');
  }

  return createSuccessResponse(result);
  
} catch (error) {
  console.error('Endpoint error:', error);
  return createErrorResponse(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred'
  );
}
```

**W Service:**
```typescript
async methodName() {
  try {
    const { data, error } = await this.supabase
      .from('table')
      .select()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Database operation failed');
    }

    if (!data || data.length === 0) {
      return null; // Endpoint zwróci 404
    }

    return this.transformToDTO(data);
    
  } catch (error) {
    console.error('Service error:', error);
    throw error; // Propaguj do endpoint
  }
}
```

---

## 8. Wydajność

### 8.1. Optymalizacje zapytań bazodanowych

**1. Indeksy:**
- Wykorzystanie istniejących indeksów z `db-plan.md`:
  - BRIN index na `flyers(valid_from, valid_to)` - szybkie filtrowanie po zakresach dat
  - B-tree index na `flyers(status)` - szybkie filtrowanie po statusie
  - B-tree index na `flyers(store_id)` - JOIN z stores
  - B-tree index na `flyer_pages(flyer_id)` - JOIN z pages
  - Partial index na `flyers(deleted_at)` - efektywne zapytania z `include_deleted`

**2. SELECT tylko potrzebnych kolumn:**
```typescript
.select('id, store_id, valid_from, valid_to, status, ...')
```
Zamiast `.select('*')` - zmniejszenie transferu danych.

**3. Użycie COUNT(*) OVER() dla paginacji:**
```sql
SELECT *, COUNT(*) OVER() as total_count FROM flyers ...
```
Jeden query zamiast dwóch (SELECT + COUNT).

**4. JOIN vs wielokrotne zapytania:**
- Preferowanie JOINów dla relacji 1:1 (flyers → stores)
- Oddzielne zapytania dla relacji 1:N gdy N może być duże (flyer → pages)

### 8.2. Paginacja

**Implementacja:**
- Domyślny `limit`: 20
- Maksymalny `limit`: 100 (walidacja w Zod)
- Użycie `OFFSET` i `LIMIT` w queries
- Zwracanie `PaginationMeta` w każdej liście

**Zalecenie:**
- Dla dużych zbiorów danych rozważyć cursor-based pagination zamiast offset-based

### 8.3. Caching

**Potencjalne miejsca na cache:**
- Lista sklepów (rzadko się zmienia)
- Enums (status, role)

**Implementacja (opcjonalna):**
- In-memory cache w Service (np. Map z TTL)
- Redis dla cache między instancjami

**Uwaga:** Cache invalidation dla mutacji (POST, PATCH, DELETE)

### 8.4. Generowanie URL-i obrazów

**Optymalizacja:**
- Metoda `generateStorageUrl()` w Service
- Wykorzystanie publicznych URL-i Supabase Storage
- Możliwość cache URL-i na poziomie CDN

### 8.5. N+1 Query Problem

**Potencjalny problem:**
- GET /api/admin/flyers/:id pobiera listę stron, a następnie dla każdej strony liczy produkty

**Rozwiązanie:**
- Użycie jednego zapytania z LEFT JOIN i GROUP BY:
```sql
SELECT 
  fp.*,
  COUNT(p.id) as product_count
FROM flyer_pages fp
LEFT JOIN products p ON p.flyer_page_id = fp.id
WHERE fp.flyer_id = :flyer_id
GROUP BY fp.id
ORDER BY fp.page_number
```

---

## 9. Kroki implementacji

### Krok 1: Przygotowanie schematów Zod

**Plik:** `src/lib/schemas/flyer.schema.ts`

**Zadania:**
1. Dodać `adminFlyerListParamsSchema` dla GET /api/admin/flyers
2. Dodać `createFlyerSchema` dla POST /api/admin/flyers
3. Dodać `updateFlyerSchema` dla PATCH /api/admin/flyers/:id
4. Upewnić się, że `flyerIdParamsSchema` istnieje (walidacja UUID)
5. Dodać wszystkie custom validations (date ranges, refine clauses)

**Testowanie:**
- Unit testy dla każdego schematu z przykładowymi danymi valid/invalid

---

### Krok 2: Rozszerzenie Service Layer

**Plik:** `src/lib/services/flyer.service.ts`

**Zadania:**

1. **Dodać metodę `listAdminFlyers()`:**
   - Parametry: `AdminFlyerListParams`
   - Zwraca: `{ flyers: AdminFlyerListItemDTO[], total: number }`
   - Implementacja:
     - Query z JOIN stores
     - Filtrowanie (store, status, include_deleted)
     - Paginacja (limit, offset)
     - Liczenie total z COUNT(*) OVER() lub osobne query
     - Transformacja do DTO

2. **Dodać metodę `getAdminFlyerById()`:**
   - Parametry: `id: string`
   - Zwraca: `AdminFlyerDetailDTO | null`
   - Implementacja:
     - Query flyers + JOIN stores
     - Query flyer_pages
     - Dla każdej strony: count produktów
     - Generowanie URL-i obrazów
     - Transformacja do DTO

3. **Dodać metodę `createFlyer()`:**
   - Parametry: `CreateFlyerCommand`
   - Zwraca: `AdminFlyerDetailDTO`
   - Implementacja:
     - Sprawdzenie czy sklep istnieje
     - INSERT nowej gazetki (status = 'draft')
     - Pobranie utworzonej gazetki z details
     - Transformacja do DTO

4. **Dodać metodę `updateFlyer()`:**
   - Parametry: `id: string, command: UpdateFlyerCommand`
   - Zwraca: `AdminFlyerDetailDTO | null`
   - Implementacja:
     - Sprawdzenie czy gazetka istnieje
     - UPDATE tylko przekazanych pól
     - Pobranie zaktualizowanej gazetki z details
     - Transformacja do DTO

5. **Dodać metodę `deleteFlyer()`:**
   - Parametry: `id: string`
   - Zwraca: `{ id: string, deleted: boolean, deleted_at: string } | null`
   - Implementacja:
     - Sprawdzenie czy gazetka istnieje i nie jest usunięta
     - UPDATE: deleted_at = NOW()
     - Zwrócenie informacji o usunięciu

6. **Dodać helper `checkStoreExists()`:**
   - Parametry: `store_id: string`
   - Zwraca: `boolean`
   - Użycie w `createFlyer()`

**Testowanie:**
- Unit testy dla każdej metody z mockami Supabase
- Integration testy z rzeczywistą bazą (dev/staging)

---

### Krok 3: Implementacja helper dla autoryzacji

**Plik:** `src/lib/helpers/auth.helper.ts` (nowy)

**Zadania:**

1. **Dodać funkcję `checkAdminAccess()`:**
   ```typescript
   export async function checkAdminAccess(
     supabase: SupabaseClient
   ): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
     // 1. Pobranie sesji
     const { data: { session }, error: sessionError } = await supabase.auth.getSession();
     
     if (sessionError || !session) {
       return { isAdmin: false, userId: null, error: 'Authentication required' };
     }

     // 2. Sprawdzenie roli (implementacja zależna od architektury projektu)
     const userId = session.user.id;
     const isAdmin = await checkUserRole(supabase, userId);

     if (!isAdmin) {
       return { isAdmin: false, userId, error: 'Admin access required' };
     }

     return { isAdmin: true, userId };
   }

   async function checkUserRole(supabase: SupabaseClient, userId: string): Promise<boolean> {
     // Opcja 1: Z metadanych sesji
     // return session.user.user_metadata.role === 'admin';

     // Opcja 2: Z tabeli bazy danych
     const { data } = await supabase
       .from('user_roles')
       .select('role')
       .eq('user_id', userId)
       .single();
     
     return data?.role === 'admin';
   }
   ```

2. **Dostosować implementację do faktycznej struktury ról w projekcie**

**Testowanie:**
- Unit testy z różnymi scenariuszami (brak sesji, nie-admin, admin)

---

### Krok 4: Implementacja endpointów

#### 4.1. GET /api/admin/flyers

**Plik:** `src/pages/api/admin/flyers/index.ts`

**Kod:**
```typescript
import type { APIRoute } from 'astro';
import { FlyerService } from '@/lib/services/flyer.service';
import { adminFlyerListParamsSchema } from '@/lib/schemas/flyer.schema';
import { createErrorResponse, createSuccessResponse, formatZodErrors } from '@/lib/helpers/api-response.helper';
import { checkAdminAccess } from '@/lib/helpers/auth.helper';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const supabase = locals.supabase;

    // 1. Sprawdzenie autoryzacji
    const { isAdmin, error: authError } = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return createErrorResponse(
        authError === 'Authentication required' ? 401 : 403,
        authError === 'Authentication required' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        authError!
      );
    }

    // 2. Parsowanie i walidacja parametrów
    const params = {
      store: url.searchParams.get('store') || undefined,
      status: url.searchParams.get('status') || undefined,
      include_deleted: url.searchParams.get('include_deleted') || undefined,
      limit: url.searchParams.get('limit') || undefined,
      offset: url.searchParams.get('offset') || undefined,
    };

    const validation = adminFlyerListParamsSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(validation.error)
      );
    }

    // 3. Wywołanie service
    const flyerService = new FlyerService(supabase);
    const { flyers, total } = await flyerService.listAdminFlyers(validation.data);

    // 4. Zwrócenie odpowiedzi
    return createSuccessResponse(flyers, {
      total,
      limit: validation.data.limit || 20,
      offset: validation.data.offset || 0,
    });

  } catch (error) {
    console.error('GET /api/admin/flyers error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
```

---

#### 4.2. GET /api/admin/flyers/:id

**Plik:** `src/pages/api/admin/flyers/[id].ts`

**Kod:**
```typescript
import type { APIRoute } from 'astro';
import { FlyerService } from '@/lib/services/flyer.service';
import { flyerIdParamsSchema } from '@/lib/schemas/flyer.schema';
import { createErrorResponse, createSuccessResponse, formatZodErrors } from '@/lib/helpers/api-response.helper';
import { checkAdminAccess } from '@/lib/helpers/auth.helper';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const supabase = locals.supabase;

    // 1. Sprawdzenie autoryzacji
    const { isAdmin, error: authError } = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return createErrorResponse(
        authError === 'Authentication required' ? 401 : 403,
        authError === 'Authentication required' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        authError!
      );
    }

    // 2. Walidacja parametru :id
    const validation = flyerIdParamsSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(validation.error)
      );
    }

    // 3. Wywołanie service
    const flyerService = new FlyerService(supabase);
    const flyer = await flyerService.getAdminFlyerById(validation.data.id);

    if (!flyer) {
      return createErrorResponse(404, 'NOT_FOUND', 'Flyer not found');
    }

    // 4. Zwrócenie odpowiedzi
    return createSuccessResponse(flyer);

  } catch (error) {
    console.error('GET /api/admin/flyers/:id error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
```

---

#### 4.3. POST /api/admin/flyers

**Plik:** `src/pages/api/admin/flyers/index.ts` (rozszerzenie o POST)

**Kod:**
```typescript
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const supabase = locals.supabase;

    // 1. Sprawdzenie autoryzacji
    const { isAdmin, error: authError } = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return createErrorResponse(
        authError === 'Authentication required' ? 401 : 403,
        authError === 'Authentication required' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        authError!
      );
    }

    // 2. Parsowanie body
    const body = await request.json();

    // 3. Walidacja body
    const validation = createFlyerSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(validation.error)
      );
    }

    // 4. Wywołanie service
    const flyerService = new FlyerService(supabase);
    const flyer = await flyerService.createFlyer(validation.data);

    if (!flyer) {
      return createErrorResponse(404, 'NOT_FOUND', 'Store not found');
    }

    // 5. Zwrócenie odpowiedzi z kodem 201
    return createSuccessResponse(flyer, undefined, 201);

  } catch (error) {
    console.error('POST /api/admin/flyers error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
```

---

#### 4.4. PATCH /api/admin/flyers/:id

**Plik:** `src/pages/api/admin/flyers/[id].ts` (rozszerzenie o PATCH)

**Kod:**
```typescript
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const supabase = locals.supabase;

    // 1. Sprawdzenie autoryzacji
    const { isAdmin, error: authError } = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return createErrorResponse(
        authError === 'Authentication required' ? 401 : 403,
        authError === 'Authentication required' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        authError!
      );
    }

    // 2. Walidacja parametru :id
    const paramsValidation = flyerIdParamsSchema.safeParse(params);
    if (!paramsValidation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(paramsValidation.error)
      );
    }

    // 3. Parsowanie body
    const body = await request.json();

    // 4. Walidacja body
    const validation = updateFlyerSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(validation.error)
      );
    }

    // 5. Wywołanie service
    const flyerService = new FlyerService(supabase);
    const flyer = await flyerService.updateFlyer(
      paramsValidation.data.id,
      validation.data
    );

    if (!flyer) {
      return createErrorResponse(404, 'NOT_FOUND', 'Flyer not found');
    }

    // 6. Zwrócenie odpowiedzi
    return createSuccessResponse(flyer);

  } catch (error) {
    console.error('PATCH /api/admin/flyers/:id error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
```

---

#### 4.5. DELETE /api/admin/flyers/:id

**Plik:** `src/pages/api/admin/flyers/[id].ts` (rozszerzenie o DELETE)

**Kod:**
```typescript
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const supabase = locals.supabase;

    // 1. Sprawdzenie autoryzacji
    const { isAdmin, error: authError } = await checkAdminAccess(supabase);
    if (!isAdmin) {
      return createErrorResponse(
        authError === 'Authentication required' ? 401 : 403,
        authError === 'Authentication required' ? 'UNAUTHORIZED' : 'FORBIDDEN',
        authError!
      );
    }

    // 2. Walidacja parametru :id
    const validation = flyerIdParamsSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        formatZodErrors(validation.error)
      );
    }

    // 3. Wywołanie service
    const flyerService = new FlyerService(supabase);
    const result = await flyerService.deleteFlyer(validation.data.id);

    if (!result) {
      return createErrorResponse(404, 'NOT_FOUND', 'Flyer not found');
    }

    // 4. Zwrócenie odpowiedzi
    return createSuccessResponse(result);

  } catch (error) {
    console.error('DELETE /api/admin/flyers/:id error:', error);
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
```

---

### Krok 6: Dokumentacja

**Zadania:**

1. **Aktualizacja API documentation:**
   - Dodać przykłady żądań (curl, JavaScript fetch)
   - Dodać przykłady odpowiedzi
   - Udokumentować wszystkie kody błędów

2. **README / Wiki:**
   - Instrukcja autoryzacji dla endpointów admin
   - Proces uzyskania dostępu admin

3. **Code comments:**
   - JSDoc dla wszystkich metod service
   - Komentarze dla złożonych validacji

---

## 10. Checklist implementacyjny

### Przygotowanie

- [ ] Przeczytanie całego planu implementacji
- [ ] Zapoznanie się ze specyfikacją API (`api-plan.md`)
- [ ] Zapoznanie się ze schematem bazy danych (`db-plan.md`)
- [ ] Przegląd istniejącego kodu (`FlyerService`, `api-response.helper`)

### Implementacja

- [ ] **Krok 1:** Schematy Zod
  - [ ] `adminFlyerListParamsSchema`
  - [ ] `createFlyerSchema`
  - [ ] `updateFlyerSchema`
  - [ ] Testy schematów

- [ ] **Krok 2:** Service Layer
  - [ ] `listAdminFlyers()`
  - [ ] `getAdminFlyerById()`
  - [ ] `createFlyer()`
  - [ ] `updateFlyer()`
  - [ ] `deleteFlyer()`
  - [ ] `checkStoreExists()`
  - [ ] Testy service

- [ ] **Krok 3:** Auth Helper
  - [ ] `checkAdminAccess()`
  - [ ] Integracja z systemem ról
  - [ ] Testy auth

- [ ] **Krok 4:** Endpointy
  - [ ] GET /api/admin/flyers
  - [ ] GET /api/admin/flyers/:id
  - [ ] POST /api/admin/flyers
  - [ ] PATCH /api/admin/flyers/:id
  - [ ] DELETE /api/admin/flyers/:id

---

**Koniec planu implementacji**