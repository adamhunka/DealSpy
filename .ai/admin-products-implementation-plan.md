# API Endpoint Implementation Plan: Admin Product Management

## 1. Przegląd punktów końcowych

Ten plan opisuje implementację 4 endpointów REST API do zarządzania produktami w panelu administratora. Endpointy pozwalają na:
- Przeglądanie produktów na stronie gazetki
- Ręczne dodawanie produktów przez admina
- Edycję produktów wykrytych przez AI
- Usuwanie fałszywych pozytywów z detekcji AI

Wszystkie endpointy wymagają uwierzytelnienia i uprawnień administratora.

**Endpointy do implementacji:**
1. `GET /api/admin/flyer-pages/:pageId/products` - Lista produktów na stronie
2. `POST /api/admin/flyer-pages/:pageId/products` - Utworzenie produktu
3. `PUT /api/admin/products/:id` - Aktualizacja produktu
4. `DELETE /api/admin/products/:id` - Usunięcie produktu

## 2. Szczegóły żądań

### 2.1. GET /api/admin/flyer-pages/:pageId/products

**Metoda HTTP:** GET

**Struktura URL:** `/api/admin/flyer-pages/{pageId}/products`

**Parametry:**
- **Path Parameters:**
  - `pageId` (UUID, wymagany) - ID strony gazetki

**Request Body:** Brak

**Cel:** Pobranie wszystkich produktów znajdujących się na danej stronie gazetki do weryfikacji przez admina.

---

### 2.2. POST /api/admin/flyer-pages/:pageId/products

**Metoda HTTP:** POST

**Struktura URL:** `/api/admin/flyer-pages/{pageId}/products`

**Parametry:**
- **Path Parameters:**
  - `pageId` (UUID, wymagany) - ID strony gazetki

**Request Body (JSON):**
```json
{
  "name": "Jogurt Naturalny 150g",
  "price": 1.49,
  "currency": "PLN",
  "unit": "szt",
  "description": "Jogurt naturalny bez dodatków",
  "promo_conditions": null,
  "category_id": "uuid",
  "bbox": {
    "x": 450,
    "y": 120,
    "width": 200,
    "height": 250
  }
}
```

**Pola wymagane:**
- `name` (string, 1-200 znaków) - Nazwa produktu
- `price` (number, >= 0, max 2 miejsca dziesiętne) - Cena produktu
- `category_id` (UUID) - ID kategorii produktu

**Pola opcjonalne:**
- `currency` (string, 3 znaki, domyślnie "PLN") - Kod waluty
- `unit` (string, max 20 znaków) - Jednostka miary (np. "kg", "szt", "l")
- `description` (string, max 500 znaków) - Opis produktu
- `promo_conditions` (string, max 500 znaków) - Warunki promocji
- `bbox` (object) - Współrzędne Bounding Box:
  - `x` (number, >= 0) - Pozycja X
  - `y` (number, >= 0) - Pozycja Y
  - `width` (number, > 0) - Szerokość
  - `height` (number, > 0) - Wysokość

**Cel:** Ręczne dodanie produktu przez admina, gdy AI nie wykryło produktu lub wykryło go nieprawidłowo.

---

### 2.3. PUT /api/admin/products/:id

**Metoda HTTP:** PUT

**Struktura URL:** `/api/admin/products/{id}`

**Parametry:**
- **Path Parameters:**
  - `id` (UUID, wymagany) - ID produktu

**Request Body (JSON - wszystkie pola opcjonalne):**
```json
{
  "name": "Masło Extra 200g",
  "price": 4.49,
  "currency": "PLN",
  "unit": "szt",
  "description": "Updated description",
  "promo_conditions": "Maksymalnie 5 sztuk na klienta",
  "category_id": "uuid",
  "bbox": {
    "x": 125,
    "y": 345,
    "width": 285,
    "height": 325
  }
}
```

**Pola (wszystkie opcjonalne, ale przynajmniej jedno wymagane):**
- `name` (string, 1-200 znaków) - Nazwa produktu
- `price` (number, >= 0, max 2 miejsca dziesiętne) - Cena produktu
- `currency` (string, 3 znaki) - Kod waluty
- `unit` (string, max 20 znaków) - Jednostka miary
- `description` (string, max 500 znaków) - Opis produktu
- `promo_conditions` (string, max 500 znaków) - Warunki promocji
- `category_id` (UUID) - ID kategorii produktu
- `bbox` (object lub null) - Współrzędne Bounding Box

**Cel:** Korekta danych produktu wykrytego przez AI podczas procesu weryfikacji.

---

### 2.4. DELETE /api/admin/products/:id

**Metoda HTTP:** DELETE

**Struktura URL:** `/api/admin/products/{id}`

**Parametry:**
- **Path Parameters:**
  - `id` (UUID, wymagany) - ID produktu

**Request Body:** Brak

**Cel:** Usunięcie produktu, np. fałszywego pozytywu z detekcji AI.

## 3. Wykorzystywane typy

### 3.1. DTO (Data Transfer Objects)

Z pliku `src/types.ts`:

**AdminProductDTO** (linie 371-384):
```typescript
export interface AdminProductDTO {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  description: string | null;
  promo_conditions: string | null;
  bbox: BBox | null;
  created_at: string;
  updated_at: string;
  category_id: string;
  category_name: string;
}
```

**BBox** (linie 97-102):
```typescript
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### 3.2. Command Models

Z pliku `src/types.ts`:

**CreateProductCommand** (linie 535-544):
```typescript
export interface CreateProductCommand {
  name: string;
  price: number;
  currency?: string;
  unit?: string | null;
  description?: string | null;
  promo_conditions?: string | null;
  category_id: string;
  bbox?: BBox | null;
}
```

**UpdateProductCommand** (linie 552-562):
```typescript
export interface UpdateProductCommand {
  name?: string;
  price?: number;
  currency?: string;
  unit?: string | null;
  description?: string | null;
  promo_conditions?: string | null;
  category_id?: string;
  bbox?: BBox | null;
}
```

### 3.3. Encje bazodanowe

Z pliku `src/types.ts`:

**Product** (linia 28):
```typescript
export type Product = Tables<"products">;
```

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/admin/flyer-pages/:pageId/products

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Masło Extra 200g",
      "price": 4.99,
      "currency": "PLN",
      "unit": "szt",
      "description": "Masło ekstra z polskiego mleka",
      "promo_conditions": "Maksymalnie 3 sztuki na klienta",
      "category_id": "uuid",
      "category_name": "Nabiał i Jaja",
      "bbox": {
        "x": 120,
        "y": 340,
        "width": 280,
        "height": 320
      },
      "created_at": "2025-01-09T11:20:00Z",
      "updated_at": "2025-01-09T11:20:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Nieprawidłowy format pageId
- `401 Unauthorized` - Brak uwierzytelnienia
- `403 Forbidden` - Brak uprawnień admina
- `404 Not Found` - Strona gazetki nie istnieje
- `500 Internal Server Error` - Błąd bazy danych

---

### 4.2. POST /api/admin/flyer-pages/:pageId/products

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Jogurt Naturalny 150g",
    "price": 1.49,
    "currency": "PLN",
    "unit": "szt",
    "description": "Jogurt naturalny bez dodatków",
    "promo_conditions": null,
    "category_id": "uuid",
    "category_name": "Nabiał i Jaja",
    "bbox": {
      "x": 450,
      "y": 120,
      "width": 200,
      "height": 250
    },
    "created_at": "2025-01-09T15:45:00Z",
    "updated_at": "2025-01-09T15:45:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Nieprawidłowe dane (błędy walidacji), kategoria nie istnieje, nieprawidłowy pageId
- `401 Unauthorized` - Brak uwierzytelnienia
- `403 Forbidden` - Brak uprawnień admina
- `404 Not Found` - Strona gazetki nie istnieje
- `500 Internal Server Error` - Błąd bazy danych

---

### 4.3. PUT /api/admin/products/:id

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Masło Extra 200g",
    "price": 4.49,
    "currency": "PLN",
    "unit": "szt",
    "description": "Updated description",
    "promo_conditions": "Maksymalnie 5 sztuk na klienta",
    "category_id": "uuid",
    "category_name": "Nabiał i Jaja",
    "bbox": {
      "x": 125,
      "y": 345,
      "width": 285,
      "height": 325
    },
    "created_at": "2025-01-09T11:20:00Z",
    "updated_at": "2025-01-09T16:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Nieprawidłowe dane (błędy walidacji), kategoria nie istnieje, brak pól do aktualizacji
- `401 Unauthorized` - Brak uwierzytelnienia
- `403 Forbidden` - Brak uprawnień admina
- `404 Not Found` - Produkt nie istnieje
- `500 Internal Server Error` - Błąd bazy danych

---

### 4.4. DELETE /api/admin/products/:id

**Success Response (204 No Content):**
Brak body

**Error Responses:**
- `400 Bad Request` - Nieprawidłowy format ID
- `401 Unauthorized` - Brak uwierzytelnienia
- `403 Forbidden` - Brak uprawnień admina
- `404 Not Found` - Produkt nie istnieje
- `500 Internal Server Error` - Błąd bazy danych

## 5. Przepływ danych

### 5.1. GET /api/admin/flyer-pages/:pageId/products

```
[Request] GET /api/admin/flyer-pages/:pageId/products
    ↓
[Middleware] Supabase client injection (locals.supabase)
    ↓
[Auth] checkAdminAccess() → sprawdza sesję i rolę
    ↓ (401/403 jeśli brak dostępu)
[Validation] flyerPageIdParamSchema → walidacja pageId
    ↓ (400 jeśli nieprawidłowy UUID)
[Service] ProductService.getProductsByPageId(pageId)
    ↓
[Database Query] SELECT z JOIN:
    - products
    - JOIN categories (category_id)
    - WHERE flyer_page_id = pageId
    - ORDER BY name ASC
    ↓
[Transform] Product[] → AdminProductDTO[]
    - Dodanie category_name z JOIN
    - Konwersja bbox (JSONB → BBox)
    ↓ (404 jeśli strona nie istnieje, [] jeśli brak produktów)
[Response] 200 OK + ApiResponse<AdminProductDTO[]>
```

**Uwagi:**
- Pusta tablica produktów to poprawny wynik (200 OK), nie 404
- 404 tylko gdy sama strona gazetki nie istnieje

---

### 5.2. POST /api/admin/flyer-pages/:pageId/products

```
[Request] POST /api/admin/flyer-pages/:pageId/products + JSON body
    ↓
[Middleware] Supabase client injection
    ↓
[Auth] checkAdminAccess()
    ↓ (401/403 jeśli brak dostępu)
[Validation] 
    - flyerPageIdParamSchema → walidacja pageId
    - createProductSchema → walidacja body
    ↓ (400 jeśli nieprawidłowe dane)
[Service] ProductService.createProduct(pageId, command)
    ↓
[Check] Czy flyer_page istnieje?
    ↓ (404 jeśli nie)
[Check] Czy category_id istnieje?
    ↓ (400 jeśli nie - validation error)
[Database INSERT] products table:
    - flyer_page_id = pageId
    - category_id = command.category_id
    - name, price, currency, unit, description, promo_conditions
    - bbox (JSONB)
    - created_at, updated_at (auto)
    ↓
[Database Query] SELECT utworzonego produktu z JOIN categories
    ↓
[Transform] Product → AdminProductDTO
    ↓
[Response] 201 Created + ApiResponse<AdminProductDTO>
```

**Uwagi:**
- currency domyślnie "PLN" jeśli nie podano
- bbox konwertowane do JSONB przez Supabase
- Foreign key constraint na category_id sprawdzony przez bazę

---

### 5.3. PUT /api/admin/products/:id

```
[Request] PUT /api/admin/products/:id + JSON body
    ↓
[Middleware] Supabase client injection
    ↓
[Auth] checkAdminAccess()
    ↓ (401/403 jeśli brak dostępu)
[Validation]
    - productIdParamSchema → walidacja id
    - updateProductSchema → walidacja body
    ↓ (400 jeśli nieprawidłowe dane lub brak pól)
[Service] ProductService.updateProduct(id, command)
    ↓
[Check] Czy produkt istnieje?
    ↓ (404 jeśli nie)
[Check] Jeśli category_id podano, czy istnieje?
    ↓ (400 jeśli nie)
[Database UPDATE] products table:
    - UPDATE tylko podanych pól
    - updated_at (auto-update przez trigger)
    ↓
[Database Query] SELECT zaktualizowanego produktu z JOIN categories
    ↓
[Transform] Product → AdminProductDTO
    ↓
[Response] 200 OK + ApiResponse<AdminProductDTO>
```

**Uwagi:**
- Tylko podane pola są aktualizowane
- updated_at aktualizowane automatycznie przez trigger `handle_updated_at`
- Walidacja category_id tylko jeśli pole jest obecne w command

---

### 5.4. DELETE /api/admin/products/:id

```
[Request] DELETE /api/admin/products/:id
    ↓
[Middleware] Supabase client injection
    ↓
[Auth] checkAdminAccess()
    ↓ (401/403 jeśli brak dostępu)
[Validation] productIdParamSchema → walidacja id
    ↓ (400 jeśli nieprawidłowy UUID)
[Service] ProductService.deleteProduct(id)
    ↓
[Check] Czy produkt istnieje?
    ↓ (404 jeśli nie)
[Database DELETE] products table WHERE id = id
    ↓
[Response] 204 No Content (brak body)
```

**Uwagi:**
- 204 No Content oznacza sukces bez zwracania danych
- Soft delete nie jest wymagane - fizyczne usunięcie z bazy

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie i Autoryzacja

**Mechanizm:**
- Wszystkie endpointy chronione przez `checkAdminAccess(supabase)`
- Sprawdzenie sesji Supabase Auth
- Sprawdzenie roli użytkownika w tabeli `profiles`
- 401 Unauthorized jeśli brak sesji
- 403 Forbidden jeśli użytkownik nie ma roli `admin`

**Implementacja:**
```typescript
const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

if (!isAdmin) {
  const status = authError === "UNAUTHORIZED" ? 401 : 403;
  const message = authError === "UNAUTHORIZED" 
    ? "Authentication required" 
    : "Admin access required";
  return createErrorResponse(authError ?? "FORBIDDEN", message, status);
}
```

### 6.2. Walidacja Danych Wejściowych

**Ochrona przed:**
- **SQL Injection:** UUID i stringi walidowane przez Zod, Supabase używa parametryzowanych zapytań
- **XSS:** Dane nie są renderowane w HTML, tylko JSON API
- **DoS przez długie stringi:** Limity długości w schematach (name: 200, description/promo_conditions: 500, unit: 20)
- **Niewłaściwe typy danych:** Zod wymusza prawidłowe typy

**Schematy Zod:**
```typescript
// Parametr pageId/productId
z.string().uuid("Invalid ID format")

// Nazwa produktu
z.string().min(1).max(200)

// Cena
z.number().min(0).max(999999.99).refine((val) => {
  return Number.isFinite(val) && /^\d+(\.\d{1,2})?$/.test(val.toString())
})

// BBox
z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1)
}).optional().nullable()
```

### 6.3. Zabezpieczenia na Poziomie Bazy Danych

**Constraints:**
- Foreign Key: `category_id` → `categories(id)` (zapobiega nieistniejącym kategoriom)
- Foreign Key: `flyer_page_id` → `flyer_pages(id)` ON DELETE CASCADE
- Check Constraint: `price >= 0`
- Check Constraint: `bbox` struktura (x, y, width, height >= 0, width/height > 0)

**Row Level Security (RLS):**
- Supabase RLS policies mogą dodatkowo ograniczyć dostęp (jeśli skonfigurowane)
- Admin role sprawdzane przez `checkAdminAccess()` przed zapytaniami

### 6.4. Ochrona przed Race Conditions

**Scenariusze:**
- Jednoczesna aktualizacja tego samego produktu przez dwóch adminów
- Usunięcie produktu podczas aktualizacji

**Mitygacja:**
- PostgreSQL transakcje zapewniają ACID
- `updated_at` automatycznie aktualizowane przez trigger
- Ostatnia aktualizacja wygrywa (Last Write Wins)
- Brak optimistic locking w obecnej wersji (możliwe rozszerzenie przez ETag)

### 6.5. Rate Limiting

**Obecnie:**
- Brak wbudowanego rate limitingu w Astro
- Można dodać przez middleware lub Supabase API limits

**Zalecenia:**
- Implementacja rate limiting per user/IP w przyszłości
- Monitoring liczby requestów w logach

## 7. Obsługa błędów

### 7.1. Format Błędów

Wszystkie błędy zwracane w standardowym formacie `ApiError`:

```typescript
interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  }
}

interface ErrorDetail {
  field: string;
  message: string;
}
```

### 7.2. Kody Błędów i Scenariusze

#### 7.2.1. GET /api/admin/flyer-pages/:pageId/products

| Status | ErrorCode | Scenariusz | Message |
|--------|-----------|------------|---------|
| 400 | VALIDATION_ERROR | Nieprawidłowy format pageId | "Invalid page ID format" |
| 401 | UNAUTHORIZED | Brak sesji użytkownika | "Authentication required" |
| 403 | FORBIDDEN | Użytkownik nie jest adminem | "Admin access required" |
| 404 | NOT_FOUND | Strona gazetki nie istnieje | "Flyer page not found" |
| 500 | INTERNAL_SERVER_ERROR | Błąd zapytania do bazy | "An unexpected error occurred" |

**Obsługa:**
```typescript
// 404: Strona nie istnieje
const page = await flyerService.getFlyerPageById(pageId);
if (!page) {
  return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
}

// 500: Błąd bazy danych
try {
  // database query
} catch (error) {
  console.error("Database error:", error);
  return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
}
```

#### 7.2.2. POST /api/admin/flyer-pages/:pageId/products

| Status | ErrorCode | Scenariusz | Message | Details |
|--------|-----------|------------|---------|---------|
| 400 | VALIDATION_ERROR | Nieprawidłowy pageId | "Invalid page ID format" | Zod errors |
| 400 | VALIDATION_ERROR | Nieprawidłowe body | "Invalid request body" | Zod errors (field-level) |
| 400 | VALIDATION_ERROR | Kategoria nie istnieje | "Category not found" | - |
| 401 | UNAUTHORIZED | Brak sesji | "Authentication required" | - |
| 403 | FORBIDDEN | Nie admin | "Admin access required" | - |
| 404 | NOT_FOUND | Strona nie istnieje | "Flyer page not found" | - |
| 500 | INTERNAL_SERVER_ERROR | Błąd bazy | "An unexpected error occurred" | - |

**Obsługa:**
```typescript
// 400: Walidacja body
const validation = createProductSchema.safeParse(body);
if (!validation.success) {
  return createErrorResponse(
    "VALIDATION_ERROR",
    "Invalid request body",
    400,
    formatZodErrors(validation.error)
  );
}

// 400: Kategoria nie istnieje
const categoryExists = await categoryService.checkCategoryExists(category_id);
if (!categoryExists) {
  return createErrorResponse("VALIDATION_ERROR", "Category not found", 400);
}

// 404: Strona nie istnieje
const page = await flyerService.getFlyerPageById(pageId);
if (!page) {
  return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
}
```

**Przykład Zod errors:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "name",
        "message": "String must contain at least 1 character(s)"
      },
      {
        "field": "price",
        "message": "Number must be greater than or equal to 0"
      },
      {
        "field": "category_id",
        "message": "Invalid UUID format"
      }
    ]
  }
}
```

#### 7.2.3. PUT /api/admin/products/:id

| Status | ErrorCode | Scenariusz | Message | Details |
|--------|-----------|------------|---------|---------|
| 400 | VALIDATION_ERROR | Nieprawidłowy id | "Invalid product ID format" | Zod errors |
| 400 | VALIDATION_ERROR | Nieprawidłowe body | "Invalid request body" | Zod errors |
| 400 | VALIDATION_ERROR | Brak pól do aktualizacji | "At least one field must be provided" | - |
| 400 | VALIDATION_ERROR | Kategoria nie istnieje | "Category not found" | - |
| 401 | UNAUTHORIZED | Brak sesji | "Authentication required" | - |
| 403 | FORBIDDEN | Nie admin | "Admin access required" | - |
| 404 | NOT_FOUND | Produkt nie istnieje | "Product not found" | - |
| 500 | INTERNAL_SERVER_ERROR | Błąd bazy | "An unexpected error occurred" | - |

**Obsługa:**
```typescript
// 400: Brak pól do aktualizacji
const validation = updateProductSchema.safeParse(body);
if (!validation.success || Object.keys(validation.data).length === 0) {
  return createErrorResponse(
    "VALIDATION_ERROR",
    "At least one field must be provided",
    400
  );
}

// 404: Produkt nie istnieje
const product = await productService.getProductByIdForAdmin(id);
if (!product) {
  return createErrorResponse("NOT_FOUND", "Product not found", 404);
}
```

#### 7.2.4. DELETE /api/admin/products/:id

| Status | ErrorCode | Scenariusz | Message |
|--------|-----------|------------|---------|
| 400 | VALIDATION_ERROR | Nieprawidłowy id | "Invalid product ID format" |
| 401 | UNAUTHORIZED | Brak sesji | "Authentication required" |
| 403 | FORBIDDEN | Nie admin | "Admin access required" |
| 404 | NOT_FOUND | Produkt nie istnieje | "Product not found" |
| 500 | INTERNAL_SERVER_ERROR | Błąd bazy | "An unexpected error occurred" |

**Obsługa:**
```typescript
// 404: Produkt nie istnieje
const deleted = await productService.deleteProduct(id);
if (!deleted) {
  return createErrorResponse("NOT_FOUND", "Product not found", 404);
}

// 204: Sukces (brak body)
return new Response(null, { status: 204 });
```

### 7.3. Logowanie Błędów

**Strategia:**
- Wszystkie błędy 500 logowane do console.error z kontekstem
- Błędy walidacji (400) nie logowane (to nie są błędy systemowe)
- Błędy autoryzacji (401/403) nie logowane (to nie są błędy systemowe)
- Błędy bazy danych logowane z pełnym stacktrace

**Przykład:**
```typescript
try {
  const products = await productService.getProductsByPageId(pageId);
} catch (error) {
  console.error("GET /api/admin/flyer-pages/:pageId/products error:", {
    error,
    pageId,
    timestamp: new Date().toISOString(),
  });
  return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
}
```

## 8. Rozważania dotyczące wydajności

### 8.1. Indeksy Bazodanowe

**Istniejące indeksy** (z pliku database schema):
```sql
CREATE INDEX idx_products_flyer_page_id ON products(flyer_page_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_name_tsvector ON products USING GIN(name_tsvector);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_bbox ON products USING GIN(bbox);
```

**Wpływ na wydajność:**
- `idx_products_flyer_page_id` - przyspiesza GET (filtrowanie po pageId)
- `idx_products_category_id` - przyspiesza JOIN z categories
- Foreign key constraints automatycznie tworzą indeksy

**Potencjalne wąskie gardła:**
- Brak - indeksy już zoptymalizowane
- Query planner PostgreSQL automatycznie wybierze najlepszy indeks


## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie schematów Zod (src/lib/schemas/product.schema.ts)

**Cel:** Dodanie schematów walidacji dla admin product endpoints.

**Zadania:**
1. Dodaj `flyerPageIdParamSchema` dla walidacji pageId
2. Dodaj `createProductSchema` dla POST body:
   - Walidacja name (1-200 znaków)
   - Walidacja price (>= 0, max 2 decimals)
   - Walidacja currency (3-char code, default "PLN")
   - Walidacja unit (max 20 znaków)
   - Walidacja description (max 500 znaków)
   - Walidacja promo_conditions (max 500 znaków)
   - Walidacja category_id (UUID)
   - Walidacja bbox (optional object z x, y, width, height)
3. Dodaj `updateProductSchema` dla PUT body:
   - Wszystkie pola opcjonalne (partial z createProductSchema)
   - Dodaj `.refine()` sprawdzający, czy przynajmniej jedno pole obecne

**Pliki do edycji:**
- `src/lib/schemas/product.schema.ts`

**Przykładowa implementacja:**
```typescript
// BBox schema (reusable)
const bboxSchema = z.object({
  x: z.number().int().min(0, "x must be >= 0"),
  y: z.number().int().min(0, "y must be >= 0"),
  width: z.number().int().min(1, "width must be > 0"),
  height: z.number().int().min(1, "height must be > 0"),
}).optional().nullable();

// Page ID param
export const flyerPageIdParamSchema = z.object({
  pageId: z.string().uuid("Invalid page ID format"),
});

// Create product schema
export const createProductSchema = z.object({
  name: z.string()
    .min(1, "Product name is required")
    .max(200, "Product name must be at most 200 characters"),
  price: z.number()
    .min(0, "Price must be >= 0")
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val.toString()), {
      message: "Price must have at most 2 decimal places"
    }),
  currency: z.string()
    .length(3, "Currency must be a 3-character code")
    .default("PLN")
    .optional(),
  unit: z.string()
    .max(20, "Unit must be at most 20 characters")
    .optional()
    .nullable(),
  description: z.string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .nullable(),
  promo_conditions: z.string()
    .max(500, "Promo conditions must be at most 500 characters")
    .optional()
    .nullable(),
  category_id: z.string().uuid("Invalid category ID format"),
  bbox: bboxSchema,
});

// Update product schema (all fields optional)
export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });

// Type exports
export type FlyerPageIdParams = z.infer<typeof flyerPageIdParamSchema>;
export type CreateProductSchema = z.infer<typeof createProductSchema>;
export type UpdateProductSchema = z.infer<typeof updateProductSchema>;
```

**Testy:**
- Sprawdź walidację prawidłowych danych
- Sprawdź błędy dla nieprawidłowych danych (za długie stringi, ujemna cena, etc.)
- Sprawdź domyślną wartość currency ("PLN")

---

### Krok 2: Rozszerzenie ProductService (src/lib/services/product.service.ts)

**Cel:** Dodanie metod CRUD dla admin panel.

**Zadania:**
1. Dodaj `getProductsByPageId(pageId: string): Promise<AdminProductDTO[]>`
   - SELECT z JOIN categories
   - WHERE flyer_page_id = pageId
   - ORDER BY name ASC
   - Transform do AdminProductDTO
   - Zwróć pustą tablicę jeśli brak produktów
   
2. Dodaj `createProduct(pageId: string, command: CreateProductCommand): Promise<AdminProductDTO | null>`
   - Sprawdź czy flyer_page exists
   - INSERT do products
   - SELECT utworzonego produktu z JOIN categories
   - Transform do AdminProductDTO
   - Zwróć null jeśli flyer_page nie istnieje
   - Obsłuż błąd foreign key (category_id)
   
3. Dodaj `updateProduct(id: string, command: UpdateProductCommand): Promise<AdminProductDTO | null>`
   - SELECT produktu (sprawdź exists)
   - UPDATE tylko podanych pól
   - SELECT zaktualizowanego produktu z JOIN categories
   - Transform do AdminProductDTO
   - Zwróć null jeśli produkt nie istnieje
   - Obsłuż błąd foreign key (category_id)
   
4. Dodaj `deleteProduct(id: string): Promise<boolean>`
   - DELETE FROM products WHERE id = id
   - Zwróć true jeśli usunięto, false jeśli nie istniał

**Pliki do edycji:**
- `src/lib/services/product.service.ts`

**Przykładowa implementacja:**

```typescript
import type { AdminProductDTO, CreateProductCommand, UpdateProductCommand } from "@/types";

// Helper type for database row with JOIN
type AdminProductRow = {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  description: string | null;
  promo_conditions: string | null;
  bbox: unknown;
  created_at: string;
  updated_at: string;
  categories: {
    id: string;
    name: string;
  };
};

export class ProductService {
  // ... existing methods ...

  /**
   * Pobiera wszystkie produkty z danej strony gazetki (admin)
   */
  async getProductsByPageId(pageId: string): Promise<AdminProductDTO[]> {
    const { data, error } = await this.supabase
      .from("products")
      .select("id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)")
      .eq("flyer_page_id", pageId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to get products by page ID:", { error, pageId });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row) => {
      const product = row as unknown as AdminProductRow;
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
        updated_at: product.updated_at,
        category_id: product.categories.id,
        category_name: product.categories.name,
      };
    });
  }

  /**
   * Tworzy nowy produkt na stronie gazetki (admin)
   */
  async createProduct(
    pageId: string,
    command: CreateProductCommand
  ): Promise<AdminProductDTO | null> {
    // Insert product
    const { data: insertedProduct, error: insertError } = await this.supabase
      .from("products")
      .insert({
        flyer_page_id: pageId,
        category_id: command.category_id,
        name: command.name,
        price: command.price,
        currency: command.currency ?? "PLN",
        unit: command.unit,
        description: command.description,
        promo_conditions: command.promo_conditions,
        bbox: command.bbox,
      })
      .select()
      .single();

    if (insertError) {
      // Foreign key violation (flyer_page_id or category_id)
      if (insertError.code === "23503") {
        console.error("Foreign key violation:", { insertError, pageId, command });
        return null;
      }
      console.error("Failed to create product:", { insertError, pageId, command });
      throw new Error("Database insert failed");
    }

    // Fetch with category name
    const { data: productWithCategory, error: fetchError } = await this.supabase
      .from("products")
      .select("id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)")
      .eq("id", insertedProduct.id)
      .single();

    if (fetchError || !productWithCategory) {
      console.error("Failed to fetch created product:", { fetchError, productId: insertedProduct.id });
      throw new Error("Database query failed");
    }

    const product = productWithCategory as unknown as AdminProductRow;
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
      updated_at: product.updated_at,
      category_id: product.categories.id,
      category_name: product.categories.name,
    };
  }

  /**
   * Aktualizuje produkt (admin)
   */
  async updateProduct(
    id: string,
    command: UpdateProductCommand
  ): Promise<AdminProductDTO | null> {
    // Check if product exists
    const { data: existingProduct, error: checkError } = await this.supabase
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to check product existence:", { checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingProduct) {
      return null; // Product not found
    }

    // Update product
    const { error: updateError } = await this.supabase
      .from("products")
      .update({
        ...(command.name !== undefined && { name: command.name }),
        ...(command.price !== undefined && { price: command.price }),
        ...(command.currency !== undefined && { currency: command.currency }),
        ...(command.unit !== undefined && { unit: command.unit }),
        ...(command.description !== undefined && { description: command.description }),
        ...(command.promo_conditions !== undefined && { promo_conditions: command.promo_conditions }),
        ...(command.category_id !== undefined && { category_id: command.category_id }),
        ...(command.bbox !== undefined && { bbox: command.bbox }),
      })
      .eq("id", id);

    if (updateError) {
      // Foreign key violation (category_id)
      if (updateError.code === "23503") {
        console.error("Foreign key violation (category_id):", { updateError, id, command });
        return null;
      }
      console.error("Failed to update product:", { updateError, id, command });
      throw new Error("Database update failed");
    }

    // Fetch updated product with category
    const { data: updatedProduct, error: fetchError } = await this.supabase
      .from("products")
      .select("id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)")
      .eq("id", id)
      .single();

    if (fetchError || !updatedProduct) {
      console.error("Failed to fetch updated product:", { fetchError, id });
      throw new Error("Database query failed");
    }

    const product = updatedProduct as unknown as AdminProductRow;
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
      updated_at: product.updated_at,
      category_id: product.categories.id,
      category_name: product.categories.name,
    };
  }

  /**
   * Usuwa produkt (admin)
   */
  async deleteProduct(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from("products")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      console.error("Failed to delete product:", { error, id });
      throw new Error("Database delete failed");
    }

    return (count ?? 0) > 0;
  }
}
```

**Uwagi:**
- Foreign key error code `23503` = constraint violation
- `updated_at` automatycznie aktualizowane przez trigger (nie trzeba ręcznie)
- Spread operator `{...(condition && { field: value })}` dla partial updates

**Testy:**
- Sprawdź tworzenie produktu z wszystkimi polami
- Sprawdź tworzenie produktu z minimalnymi polami
- Sprawdź aktualizację pojedynczego pola
- Sprawdź aktualizację wszystkich pól
- Sprawdź usunięcie produktu
- Sprawdź błędy dla nieistniejących pageId/productId/categoryId

---

### Krok 3: Dodanie CategoryService.checkCategoryExists() (src/lib/services/category.service.ts)

**Cel:** Helper method do sprawdzania czy kategoria istnieje.

**Zadania:**
1. Dodaj metodę `checkCategoryExists(categoryId: string): Promise<boolean>`
   - SELECT 1 FROM categories WHERE id = categoryId
   - Zwróć true/false

**Pliki do edycji:**
- `src/lib/services/category.service.ts`

**Przykładowa implementacja:**
```typescript
export class CategoryService {
  // ... existing methods ...

  /**
   * Sprawdza czy kategoria istnieje
   */
  async checkCategoryExists(categoryId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (error) {
      console.error("Failed to check category existence:", { error, categoryId });
      throw new Error("Database query failed");
    }

    return data !== null;
  }
}
```

**Uwaga:** Można pominąć tę metodę i polegać na foreign key constraint w bazie (endpoint zwróci generic 500). Ale explicit check daje lepszy error message (400 z "Category not found").

---

### Krok 4: Dodanie FlyerService.checkFlyerPageExists() (src/lib/services/flyer.service.ts)

**Cel:** Helper method do sprawdzania czy strona gazetki istnieje.

**Zadania:**
1. Dodaj metodę `checkFlyerPageExists(pageId: string): Promise<boolean>`
   - SELECT 1 FROM flyer_pages WHERE id = pageId
   - Zwróć true/false

**Pliki do edycji:**
- `src/lib/services/flyer.service.ts`

**Przykładowa implementacja:**
```typescript
export class FlyerService {
  // ... existing methods ...

  /**
   * Sprawdza czy strona gazetki istnieje
   */
  async checkFlyerPageExists(pageId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("flyer_pages")
      .select("id")
      .eq("id", pageId)
      .maybeSingle();

    if (error) {
      console.error("Failed to check flyer page existence:", { error, pageId });
      throw new Error("Database query failed");
    }

    return data !== null;
  }
}
```

---

### Krok 5: Implementacja GET endpoint (src/pages/api/admin/flyer-pages/[pageId]/products/index.ts)

**Cel:** GET /api/admin/flyer-pages/:pageId/products - lista produktów na stronie.

**Zadania:**
1. Utwórz plik `src/pages/api/admin/flyer-pages/[pageId]/products/index.ts`
2. Implementuj handler GET:
   - Sprawdź dostęp admin (`checkAdminAccess`)
   - Waliduj pageId (`flyerPageIdParamSchema`)
   - Sprawdź czy strona istnieje (`flyerService.checkFlyerPageExists`)
   - Pobierz produkty (`productService.getProductsByPageId`)
   - Zwróć 200 + ApiResponse<AdminProductDTO[]>

**Pliki do utworzenia:**
- `src/pages/api/admin/flyer-pages/[pageId]/products/index.ts`

**Przykładowa implementacja:**
```typescript
import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerPageIdParamSchema } from "@/lib/schemas/product.schema";
import { ProductService } from "@/lib/services/product.service";
import { FlyerService } from "@/lib/services/flyer.service";

export const prerender = false;

/**
 * GET /api/admin/flyer-pages/:pageId/products
 *
 * Pobiera wszystkie produkty na stronie gazetki.
 * Używane przez admina podczas weryfikacji produktów wykrytych przez AI.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja pageId
    const validation = flyerPageIdParamSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid page ID format",
        400,
        formatZodErrors(validation.error)
      );
    }

    const { pageId } = validation.data;

    // 3. Sprawdź czy strona istnieje
    const flyerService = new FlyerService(locals.supabase);
    const pageExists = await flyerService.checkFlyerPageExists(pageId);
    if (!pageExists) {
      return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
    }

    // 4. Pobierz produkty
    const productService = new ProductService(locals.supabase);
    const products = await productService.getProductsByPageId(pageId);

    // 5. Zwróć sukces
    return createSuccessResponse(products, 200);
  } catch (error) {
    console.error("GET /api/admin/flyer-pages/:pageId/products error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
```

**Uwagi:**
- Pusta tablica produktów to prawidłowy wynik (200 OK)
- 404 tylko jeśli sama strona nie istnieje

**Testy:**
- Wywołaj bez auth → 401
- Wywołaj jako user (nie admin) → 403
- Wywołaj z nieprawidłowym pageId → 400
- Wywołaj z nieistniejącym pageId → 404
- Wywołaj z istniejącym pageId bez produktów → 200 + []
- Wywołaj z istniejącym pageId z produktami → 200 + AdminProductDTO[]

---

### Krok 6: Implementacja POST endpoint (src/pages/api/admin/flyer-pages/[pageId]/products/index.ts)

**Cel:** POST /api/admin/flyer-pages/:pageId/products - utworzenie produktu.

**Zadania:**
1. W tym samym pliku dodaj handler POST
2. Implementuj logikę:
   - Sprawdź dostęp admin
   - Waliduj pageId
   - Waliduj body (`createProductSchema`)
   - Sprawdź czy strona istnieje
   - Sprawdź czy kategoria istnieje
   - Utwórz produkt (`productService.createProduct`)
   - Zwróć 201 + ApiResponse<AdminProductDTO>

**Pliki do edycji:**
- `src/pages/api/admin/flyer-pages/[pageId]/products/index.ts` (dodaj POST handler)

**Przykładowa implementacja:**
```typescript
import { createProductSchema } from "@/lib/schemas/product.schema";
import { CategoryService } from "@/lib/services/category.service";

/**
 * POST /api/admin/flyer-pages/:pageId/products
 *
 * Tworzy nowy produkt na stronie gazetki (ręczne dodanie przez admina).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja pageId
    const paramValidation = flyerPageIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid page ID format",
        400,
        formatZodErrors(paramValidation.error)
      );
    }

    const { pageId } = paramValidation.data;

    // 3. Parse i waliduj body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    const bodyValidation = createProductSchema.safeParse(body);
    if (!bodyValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        formatZodErrors(bodyValidation.error)
      );
    }

    const command = bodyValidation.data;

    // 4. Sprawdź czy strona istnieje
    const flyerService = new FlyerService(locals.supabase);
    const pageExists = await flyerService.checkFlyerPageExists(pageId);
    if (!pageExists) {
      return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
    }

    // 5. Sprawdź czy kategoria istnieje
    const categoryService = new CategoryService(locals.supabase);
    const categoryExists = await categoryService.checkCategoryExists(command.category_id);
    if (!categoryExists) {
      return createErrorResponse("VALIDATION_ERROR", "Category not found", 400);
    }

    // 6. Utwórz produkt
    const productService = new ProductService(locals.supabase);
    const product = await productService.createProduct(pageId, command);

    if (!product) {
      // To nie powinno się zdarzyć (sprawdziliśmy pageId i category_id)
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to create product", 500);
    }

    // 7. Zwróć sukces
    return createSuccessResponse(product, 201);
  } catch (error) {
    console.error("POST /api/admin/flyer-pages/:pageId/products error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
```

**Uwagi:**
- 201 Created dla sukcesu (nie 200)
- Sprawdzamy category_id przed INSERT (lepszy error message niż foreign key violation)
- Body może nie mieć currency → domyślnie "PLN" (schema default)

**Testy:**
- Wywołaj bez auth → 401
- Wywołaj jako user → 403
- Wywołaj z nieprawidłowym pageId → 400
- Wywołaj z nieistniejącym pageId → 404
- Wywołaj z nieistniejącym category_id → 400
- Wywołaj z nieprawidłowym body (brak name, ujemna cena, etc.) → 400 + details
- Wywołaj z prawidłowymi danymi → 201 + AdminProductDTO
- Sprawdź domyślną wartość currency ("PLN")

---

### Krok 7: Implementacja PUT endpoint (src/pages/api/admin/products/[id].ts)

**Cel:** PUT /api/admin/products/:id - aktualizacja produktu.

**Zadania:**
1. Utwórz plik `src/pages/api/admin/products/[id].ts`
2. Implementuj handler PUT:
   - Sprawdź dostęp admin
   - Waliduj id (`productIdParamSchema`)
   - Waliduj body (`updateProductSchema`)
   - Sprawdź czy przynajmniej jedno pole obecne
   - Jeśli category_id obecne, sprawdź czy istnieje
   - Zaktualizuj produkt (`productService.updateProduct`)
   - Zwróć 200 + ApiResponse<AdminProductDTO>

**Pliki do utworzenia:**
- `src/pages/api/admin/products/[id].ts`

**Przykładowa implementacja:**
```typescript
import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { productIdParamSchema, updateProductSchema } from "@/lib/schemas/product.schema";
import { ProductService } from "@/lib/services/product.service";
import { CategoryService } from "@/lib/services/category.service";

export const prerender = false;

/**
 * PUT /api/admin/products/:id
 *
 * Aktualizuje istniejący produkt (podczas weryfikacji przez admina).
 * Wszystkie pola są opcjonalne, ale przynajmniej jedno musi być obecne.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja id
    const paramValidation = productIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid product ID format",
        400,
        formatZodErrors(paramValidation.error)
      );
    }

    const { id } = paramValidation.data;

    // 3. Parse i waliduj body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    const bodyValidation = updateProductSchema.safeParse(body);
    if (!bodyValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        formatZodErrors(bodyValidation.error)
      );
    }

    const command = bodyValidation.data;

    // 4. Sprawdź czy przynajmniej jedno pole obecne (Zod refine powinno to złapać)
    if (Object.keys(command).length === 0) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "At least one field must be provided for update",
        400
      );
    }

    // 5. Jeśli category_id obecne, sprawdź czy istnieje
    if (command.category_id) {
      const categoryService = new CategoryService(locals.supabase);
      const categoryExists = await categoryService.checkCategoryExists(command.category_id);
      if (!categoryExists) {
        return createErrorResponse("VALIDATION_ERROR", "Category not found", 400);
      }
    }

    // 6. Zaktualizuj produkt
    const productService = new ProductService(locals.supabase);
    const product = await productService.updateProduct(id, command);

    if (!product) {
      return createErrorResponse("NOT_FOUND", "Product not found", 404);
    }

    // 7. Zwróć sukces
    return createSuccessResponse(product, 200);
  } catch (error) {
    console.error("PUT /api/admin/products/:id error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
```

**Uwagi:**
- 200 OK dla sukcesu (nie 201, bo to update)
- Sprawdzamy category_id tylko jeśli jest obecne w command
- Zod refine powinien sprawdzić, że przynajmniej jedno pole obecne

**Testy:**
- Wywołaj bez auth → 401
- Wywołaj jako user → 403
- Wywołaj z nieprawidłowym id → 400
- Wywołaj z nieistniejącym id → 404
- Wywołaj z pustym body {} → 400
- Wywołaj z nieistniejącym category_id → 400
- Wywołaj z jednym polem (np. tylko name) → 200 + zaktualizowany produkt
- Wywołaj ze wszystkimi polami → 200 + zaktualizowany produkt
- Sprawdź czy updated_at się zmienia

---

### Krok 8: Implementacja DELETE endpoint (src/pages/api/admin/products/[id].ts)

**Cel:** DELETE /api/admin/products/:id - usunięcie produktu.

**Zadania:**
1. W tym samym pliku dodaj handler DELETE
2. Implementuj logikę:
   - Sprawdź dostęp admin
   - Waliduj id
   - Usuń produkt (`productService.deleteProduct`)
   - Zwróć 204 No Content

**Pliki do edycji:**
- `src/pages/api/admin/products/[id].ts` (dodaj DELETE handler)

**Przykładowa implementacja:**
```typescript
/**
 * DELETE /api/admin/products/:id
 *
 * Usuwa produkt (np. fałszywy pozytyw z detekcji AI).
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja id
    const paramValidation = productIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid product ID format",
        400,
        formatZodErrors(paramValidation.error)
      );
    }

    const { id } = paramValidation.data;

    // 3. Usuń produkt
    const productService = new ProductService(locals.supabase);
    const deleted = await productService.deleteProduct(id);

    if (!deleted) {
      return createErrorResponse("NOT_FOUND", "Product not found", 404);
    }

    // 4. Zwróć sukces (204 No Content)
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/admin/products/:id error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
```

**Uwagi:**
- 204 No Content (brak response body)
- `new Response(null, { status: 204 })` zamiast `createSuccessResponse`

**Testy:**
- Wywołaj bez auth → 401
- Wywołaj jako user → 403
- Wywołaj z nieprawidłowym id → 400
- Wywołaj z nieistniejącym id → 404
- Wywołaj z istniejącym id → 204 (brak body)
- Sprawdź czy produkt rzeczywiście usunięty z bazy

---
