# API Endpoint Implementation Plan: Admin Flyer Pages Management

## 1. Przegląd punktów końcowych

Ten plan obejmuje implementację 5 endpointów REST API do zarządzania stronami gazetek promocyjnych w panelu administracyjnym:

1. **POST /api/admin/flyers/:flyerId/pages** - Upload i tworzenie stron gazetki
2. **GET /api/admin/flyer-pages/:id** - Pobranie szczegółów strony z danymi AI
3. **POST /api/admin/flyer-pages/:id/process** - Przetwarzanie strony przez AI (OCR + LLM)
4. **PATCH /api/admin/flyer-pages/:id** - Aktualizacja statusu strony
5. **DELETE /api/admin/flyer-pages/:id** - Usunięcie strony i powiązanych zasobów

Wszystkie endpointy wymagają autoryzacji i roli admin. Implementacja obejmuje:
- Upload i konwersję obrazów (JPG/PNG → WebP)
- Integrację z AI do ekstrakcji danych z obrazów
- Zarządzanie statusami przetwarzania
- Operacje na Supabase Storage (2 buckety: raw_flyers, public_flyers)

---

## 2. Szczegóły żądań

### 2.1. POST /api/admin/flyers/:flyerId/pages

**Cel:** Upload jednej lub wielu stron gazetki, konwersja do WebP i zapis metadanych do bazy.

**Metoda HTTP:** POST

**Struktura URL:** `/api/admin/flyers/{flyerId}/pages`

**Path Parameters:**
- `flyerId` (string, UUID, wymagany) - ID gazetki

**Content-Type:** `multipart/form-data`

**Request Body (FormData):**
```typescript
files: File[] // JPG, PNG, WEBP, max 10MB każdy
```

**Walidacja:**
- Formaty: tylko image/jpeg, image/png, image/webp (sprawdzanie MIME type)
- Rozmiar: max 10MB per file
- Minimum 1 plik wymagany
- Flyer musi istnieć i nie być usunięty

**Headers wymagane:**
- `Authorization: Bearer <token>` (z Supabase auth)

---

### 2.2. GET /api/admin/flyer-pages/:id

**Cel:** Pobranie szczegółowych informacji o stronie, włącznie z raw_ai_data (JSON z OCR i wykrytymi produktami).

**Metoda HTTP:** GET

**Struktura URL:** `/api/admin/flyer-pages/{id}`

**Path Parameters:**
- `id` (string, UUID, wymagany) - ID strony gazetki

**Query Parameters:** brak

**Walidacja:**
- ID musi być poprawnym UUID

---

### 2.3. POST /api/admin/flyer-pages/:id/process

**Cel:** Uruchomienie przetwarzania AI strony (OCR + strukturyzacja danych przez LLM).

**Metoda HTTP:** POST

**Struktura URL:** `/api/admin/flyer-pages/{id}/process`

**Path Parameters:**
- `id` (string, UUID, wymagany) - ID strony gazetki

**Request Body (JSON):**
```json
{
  "reprocess": false
}
```

**Parametry Body:**
- `reprocess` (boolean, opcjonalny, default: false) - Czy przetwarzać ponownie stronę już przetworzoną

**Walidacja:**
- ID musi być poprawnym UUID
- Jeśli reprocess=false, strona nie może mieć status='verification' lub 'published'
- Strona musi mieć original_image_path

---

### 2.4. PATCH /api/admin/flyer-pages/:id

**Cel:** Manualna aktualizacja statusu strony (np. po weryfikacji przez admina).

**Metoda HTTP:** PATCH

**Struktura URL:** `/api/admin/flyer-pages/{id}`

**Path Parameters:**
- `id` (string, UUID, wymagany) - ID strony gazetki

**Request Body (JSON):**
```json
{
  "status": "published"
}
```

**Parametry Body:**
- `status` (string, enum, wymagany) - Nowy status strony
  - Wartości: `"draft"`, `"processing"`, `"verification"`, `"published"`

**Walidacja:**
- ID musi być poprawnym UUID
- Status musi być jedną z dozwolonych wartości
- Przejścia statusów muszą być logiczne:
  - draft → processing, verification, published
  - processing → draft (error), verification (success)
  - verification → published, draft (reject)
  - published → verification (unpublish)

---

### 2.5. DELETE /api/admin/flyer-pages/:id

**Cel:** Usunięcie strony gazetki wraz z plikami ze storage i produktami z bazy (CASCADE).

**Metoda HTTP:** DELETE

**Struktura URL:** `/api/admin/flyer-pages/{id}`

**Path Parameters:**
- `id` (string, UUID, wymagany) - ID strony gazetki

**Query Parameters:** brak

**Walidacja:**
- ID musi być poprawnym UUID
- Strona nie powinna być w statusie 'published' (opcjonalna walidacja biznesowa)

---

## 3. Wykorzystywane typy

### 3.1. Istniejące typy z src/types.ts

**DTO:**
```typescript
// Response dla GET /api/admin/flyer-pages/:id
interface AdminFlyerPageRawDTO {
  id: string;
  flyer_id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  raw_ai_data: RawAIData | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Używane w listach (np. w AdminFlyerDetailDTO)
interface AdminFlyerPageDetailDTO {
  id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  product_count: number;
  has_raw_ai_data: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Struktura danych AI
interface RawAIData {
  ocr_text: string;
  detected_products: DetectedProduct[];
}

interface DetectedProduct {
  name: string;
  price: string;
  unit?: string;
  description?: string;
  bbox?: BBox;
  confidence?: number;
}

type FlyerStatus = "draft" | "processing" | "verification" | "published";
```

**Command Models:**
```typescript
// Request body dla POST /api/admin/flyer-pages/:id/process
interface ProcessFlyerPageCommand {
  reprocess?: boolean;
}

// Request body dla PATCH /api/admin/flyer-pages/:id
interface UpdateFlyerPageCommand {
  status: FlyerStatus;
}

// FormData dla POST /api/admin/flyers/:flyerId/pages
type UploadFlyerPagesCommand = FormData;
```

### 3.2. Nowe typy pomocnicze do dodania

Dodać do `src/types.ts`:

```typescript
/**
 * UploadedPageInfo - informacje o uploadowanej stronie
 * 
 * Response item w POST /api/admin/flyers/:flyerId/pages
 */
export interface UploadedPageInfo {
  id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  created_at: string;
}

/**
 * UploadFlyerPagesResponse - pełny response z upload endpoint
 */
export interface UploadFlyerPagesResponse {
  flyer_id: string;
  uploaded_pages: UploadedPageInfo[];
}

/**
 * ProcessPageResponse - response z process endpoint
 */
export interface ProcessPageResponse {
  id: string;
  status: FlyerStatus;
  message: string;
}

/**
 * UpdatePageResponse - response z update endpoint
 */
export interface UpdatePageResponse {
  id: string;
  status: FlyerStatus;
  updated_at: string;
}
```

---

## 4. Szczegóły odpowiedzi

### 4.1. POST /api/admin/flyers/:flyerId/pages

**201 Created:**
```json
{
  "data": {
    "flyer_id": "uuid",
    "uploaded_pages": [
      {
        "id": "uuid",
        "page_number": 1,
        "original_image_url": "https://.../raw_flyers/store-slug/flyer-id/page-1-original.jpg",
        "web_image_url": "https://.../public_flyers/store-slug/flyer-id/page-1.webp",
        "status": "draft",
        "created_at": "2025-01-09T10:30:00Z"
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid file format, size, or no files
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not admin role
- `404 Not Found` - Flyer not found
- `413 Payload Too Large` - File > 10MB
- `500 Internal Server Error` - Storage/DB error

---

### 4.2. GET /api/admin/flyer-pages/:id

**200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "flyer_id": "uuid",
    "page_number": 1,
    "original_image_url": "https://...",
    "web_image_url": "https://...",
    "status": "verification",
    "raw_ai_data": {
      "ocr_text": "Full text...",
      "detected_products": [
        {
          "name": "Masło Extra",
          "price": "4.99",
          "unit": "200g",
          "bbox": { "x": 120, "y": 340, "width": 280, "height": 320 },
          "confidence": 0.92
        }
      ]
    },
    "error_message": null,
    "created_at": "2025-01-09T10:30:00Z",
    "updated_at": "2025-01-09T11:15:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid UUID
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not admin role
- `404 Not Found` - Page not found
- `500 Internal Server Error` - Database error

---

### 4.3. POST /api/admin/flyer-pages/:id/process

**202 Accepted:**
```json
{
  "data": {
    "id": "uuid",
    "status": "processing",
    "message": "AI processing started"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Already processed (unless reprocess=true)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not admin role
- `404 Not Found` - Page not found
- `500 Internal Server Error` - AI service error
- `503 Service Unavailable` - AI service unavailable

---

### 4.4. PATCH /api/admin/flyer-pages/:id

**200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "status": "published",
    "updated_at": "2025-01-09T15:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid status or transition
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not admin role
- `404 Not Found` - Page not found
- `500 Internal Server Error` - Database error

---

### 4.5. DELETE /api/admin/flyer-pages/:id

**204 No Content** - Empty body

**Error Responses:**
- `400 Bad Request` - Cannot delete published page (optional business rule)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not admin role
- `404 Not Found` - Page not found
- `500 Internal Server Error` - Database/storage error

---

## 5. Przepływ danych

### 5.1. POST /api/admin/flyers/:flyerId/pages

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐
│ Client  │────▶│ Endpoint │────▶│   Storage   │────▶│ Converter│────▶│ Storage  │
│         │     │ Handler  │     │   Service   │     │  (WebP)  │     │ Service  │
└─────────┘     └──────────┘     └─────────────┘     └──────────┘     └──────────┘
                      │                                                      │
                      │                                                      │
                      ▼                                                      ▼
                ┌──────────┐                                          ┌──────────┐
                │   Auth   │                                          │ Database │
                │  Helper  │                                          │  Insert  │
                └──────────┘                                          └──────────┘
```

**Kroki:**
1. Walidacja autoryzacji (checkAdminAccess)
2. Walidacja flyerId (UUID)
3. Sprawdzenie czy flyer istnieje (FlyerService.checkFlyerExists)
4. Parsowanie multipart/form-data (Astro.request.formData())
5. Walidacja plików (format, rozmiar)
6. Pobranie store_slug dla ścieżki (query do flyers)
7. Określenie następnego page_number (query do flyer_pages)
8. **Dla każdego pliku:**
   - Upload oryginału do raw_flyers: `{store_slug}/{flyer_id}/page-{n}-original.{ext}`
   - Konwersja do WebP (max 1000px width)
   - Upload WebP do public_flyers: `{store_slug}/{flyer_id}/page-{n}.webp`
   - Insert rekordu do flyer_pages
9. Zwrot listy utworzonych stron

**Używane serwisy:**
- `checkAdminAccess()` - auth.helper.ts
- `FlyerService.checkFlyerExists()` - flyer.service.ts
- `StorageService.uploadImageFile()` - NOWY
- `StorageService.convertToWebP()` - NOWY
- `FlyerPageService.createPages()` - NOWY (lub w FlyerService)

---

### 5.2. GET /api/admin/flyer-pages/:id

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Client  │────▶│ Endpoint │────▶│  Service │────▶│ Database │
│         │     │ Handler  │     │          │     │  Query   │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │
                      │                                  │
                      ▼                                  ▼
                ┌──────────┐                       ┌──────────┐
                │   Auth   │                       │   DTO    │
                │  Helper  │                       │Transform │
                └──────────┘                       └──────────┘
```

**Kroki:**
1. Walidacja autoryzacji
2. Walidacja id (UUID)
3. Query do flyer_pages z JOIN do flyers (dla store info)
4. Jeśli nie znaleziono → 404
5. Generowanie URLs dla obrazów (generateStorageUrl)
6. Transformacja do AdminFlyerPageRawDTO
7. Return 200 z data

**Używane serwisy:**
- `checkAdminAccess()` - auth.helper.ts
- `FlyerService.getFlyerPageById()` - rozszerzenie flyer.service.ts
- `FlyerService.generateStorageUrl()` - istniejąca metoda

---

### 5.3. POST /api/admin/flyer-pages/:id/process

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Client  │────▶│ Endpoint │────▶│  Service │────▶│   OCR    │────▶│   LLM    │
│         │     │ Handler  │     │          │     │ (Vision) │     │(Structure)│
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │                │
                      │                                  │                │
                      ▼                                  ▼                ▼
                ┌──────────┐                       ┌──────────────────────────┐
                │ Database │                       │   Update raw_ai_data +   │
                │  Status  │                       │  Create products records │
                │  Update  │                       └──────────────────────────┘
                └──────────┘
```

**Kroki:**
1. Walidacja autoryzacji
2. Walidacja id i reprocess param
3. Pobranie strony z DB
4. Sprawdzenie czy można przetworzyć (status, reprocess flag)
5. **Update status → 'processing'**
6. Pobranie obrazu z raw_flyers (signed URL lub download)
7. **OCR Call:** OpenRouter API z vision model (google/gemini-2.0-flash-exp:free)
   - Input: obraz + prompt OCR
   - Output: tekst + bounding boxes
8. **LLM Call:** OpenRouter API (anthropic/claude-3.5-sonnet)
   - Input: tekst OCR + prompt strukturyzacji
   - Output: JSON z produktami
9. **Update flyer_pages:**
   - raw_ai_data = { ocr_text, detected_products }
   - status = 'verification'
10. **Create products:** Dla każdego detected_product:
    - Insert do products (page_id, name, price, category, bbox)
11. **Error handling:** Jeśli błąd AI:
    - status = 'draft'
    - error_message = error details
12. Return 202 Accepted

**Używane serwisy:**
- `AIService.processPage()` - NOWY
- `AIService.extractTextFromImage()` - NOWY
- `AIService.structureProductData()` - NOWY
- `ProductService.createFromAI()` - NOWY
- `FlyerService.updatePageStatus()` - rozszerzenie

**AI Prompts (zapisane w app_config):**
- `ai_ocr_prompt` - prompt dla OCR (vision model)
- `ai_llm_prompt` - prompt dla strukturyzacji (LLM)

---

### 5.4. PATCH /api/admin/flyer-pages/:id

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Client  │────▶│ Endpoint │────▶│  Service │────▶│ Database │
│         │     │ Handler  │     │          │     │  Update  │
└─────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │
                      │                                  │
                      ▼                                  ▼
                ┌──────────┐                       ┌──────────┐
                │Validation│                       │  Return  │
                │  Status  │                       │   DTO    │
                │Transition│                       └──────────┘
                └──────────┘
```

**Kroki:**
1. Walidacja autoryzacji
2. Walidacja id (UUID) i status (enum)
3. Pobranie current status z DB
4. Walidacja status transition (optional business logic)
5. Update flyer_pages SET status = :status, updated_at = NOW()
6. Return 200 z updated data

**Status transitions (opcjonalna logika):**
- draft → processing, verification, published
- processing → draft, verification
- verification → published, draft
- published → verification

**Używane serwisy:**
- `FlyerService.updatePageStatus()` - rozszerzenie

---

### 5.5. DELETE /api/admin/flyer-pages/:id

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Client  │────▶│ Endpoint │────▶│  Service │────▶│ Database │────▶│ Storage  │
│         │     │ Handler  │     │          │     │  DELETE  │     │  DELETE  │
└─────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                                  │
                      │                                  │
                      ▼                                  ▼
                ┌──────────┐                       ┌──────────┐
                │ Business │                       │ CASCADE  │
                │   Rule   │                       │ Products │
                │  Check   │                       └──────────┘
                └──────────┘
```

**Kroki:**
1. Walidacja autoryzacji
2. Walidacja id (UUID)
3. Pobranie strony z DB (page, paths, status)
4. Business rule check (np. nie usuwaj published)
5. **Usunięcie plików ze Storage:**
   - Delete from raw_flyers: original_image_path
   - Delete from public_flyers: web_image_path
6. **Delete z DB:** DELETE FROM flyer_pages WHERE id = :id
   - CASCADE automatically deletes all products
7. Return 204 No Content

**Używane serwisy:**
- `FlyerService.deletePage()` - rozszerzenie
- `StorageService.deleteFile()` - NOWY

---

## 6. Względy bezpieczeństwa

### 6.1. Autoryzacja i autentykacja

**Wszystkie endpointy wymagają:**
- Aktywnej sesji użytkownika (Supabase Auth)
- Roli admin w tabeli profiles

**Implementacja:**
```typescript
// W każdym endpoint handler
const { isAdmin, error } = await checkAdminAccess(context.locals.supabase);

if (!isAdmin) {
  const status = getAuthErrorStatus(error!);
  const message = getAuthErrorMessage(error!);
  return createErrorResponse(error!, message, status);
}
```

**Używany helper:** `auth.helper.ts` (już istnieje)

---

### 6.2. Upload plików - zabezpieczenia

**Walidacja MIME type (nie tylko extension):**
```typescript
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

for (const file of files) {
  if (!allowedMimeTypes.includes(file.type)) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      `Invalid file type: ${file.type}. Allowed: JPG, PNG, WEBP`,
      400
    );
  }
}
```

**Limit rozmiaru:**
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
  return createErrorResponse(
    'PAYLOAD_TOO_LARGE',
    `File too large: ${file.name}. Max 10MB`,
    413
  );
}
```

**Sanityzacja nazw plików:**
```typescript
// NIE używaj oryginalnej nazwy pliku w ścieżce
// UŻYJ: generowanej ścieżki z UUID i numerem strony

const sanitizedPath = `${storeSlug}/${flyerId}/page-${pageNumber}-original.${ext}`;
// Nie: `${storeSlug}/${flyerId}/${file.name}` ← path traversal risk
```

**Content-Type sniffing prevention:**
- Supabase Storage automatycznie ustawia Content-Type
- Dla public_flyers bucket wymuś image/webp

---

### 6.3. Storage security

**Buckety:**
1. **raw_flyers** - PRIVATE
   - Dostęp tylko dla admina
   - RLS policy: SELECT WHERE auth.role() = 'admin'
   - Signed URLs z expiry dla preview

2. **public_flyers** - PUBLIC
   - Read-only dla wszystkich
   - Write tylko dla service_role

**RLS Policies (Supabase):**
```sql
-- raw_flyers bucket
CREATE POLICY "Admin read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'raw_flyers' AND auth.role() = 'authenticated');

CREATE POLICY "Service role write"
ON storage.objects FOR INSERT
USING (bucket_id = 'raw_flyers' AND auth.role() = 'service_role');

-- public_flyers bucket
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'public_flyers');

CREATE POLICY "Service role write"
ON storage.objects FOR INSERT
USING (bucket_id = 'public_flyers' AND auth.role() = 'service_role');
```

**Implementacja:**
- Backend używa service_role client dla uploadów
- Frontend wyświetla public URLs dla public_flyers
- Frontend pobiera signed URLs dla raw_flyers (admin tylko)

---

### 6.4. AI Processing security

**Rate limiting:**
- Limit requestów do OpenRouter API
- Implementacja: simple in-memory counter lub Redis
- Przykład: max 10 processingów równocześnie

**Timeout protection:**
```typescript
const AI_TIMEOUT = 60000; // 60s

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

try {
  const response = await fetch(openRouterUrl, {
    signal: controller.signal,
    // ...
  });
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('AI processing timeout');
  }
}
```

**Validation AI response:**
```typescript
// Waliduj strukturę przed zapisem do DB
const aiResponseSchema = z.object({
  ocr_text: z.string(),
  detected_products: z.array(z.object({
    name: z.string(),
    price: z.string(),
    unit: z.string().optional(),
    // ...
  }))
});

const validated = aiResponseSchema.safeParse(aiResponse);
if (!validated.success) {
  throw new Error('Invalid AI response structure');
}
```

**Sanityzacja danych:**
- Escape HTML w danych produktów przed wyświetleniem
- Max length dla text fields (np. name: 255, description: 1000)

**API Key security:**
- OpenRouter API key w environment variables (import.meta.env.OPENROUTER_API_KEY)
- Nigdy nie loguj API key
- Rotacja keyów regularnie

---

### 6.5. Database security

**RLS Policies dla flyer_pages:**
```sql
-- Tylko admini mogą czytać wszystkie strony
CREATE POLICY "Admin read all pages"
ON flyer_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Tylko admini mogą modyfikować strony
CREATE POLICY "Admin modify pages"
ON flyer_pages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

**SQL Injection prevention:**
- Używamy Supabase client (prepared statements automatyczne)
- NIE konstruujemy raw SQL queries

**JSONB injection w raw_ai_data:**
- Walidacja struktury przed zapisem (zod schema)
- PostgreSQL automatycznie waliduje JSON syntax

---

## 7. Obsługa błędów

### 7.1. Standardowy format błędów

Wszystkie błędy zwracane w formacie ApiError (już zdefiniowany):

```typescript
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [  // opcjonalne, dla walidacji
      {
        "field": "field_name",
        "message": "Field-specific error"
      }
    ]
  }
}
```

---

### 7.2. POST /api/admin/flyers/:flyerId/pages - Błędy

| Status | Code | Message | Scenariusz |
|--------|------|---------|------------|
| 400 | VALIDATION_ERROR | No files provided | Brak plików w request |
| 400 | VALIDATION_ERROR | Invalid file type: {type} | Nieprawidłowy MIME type |
| 400 | VALIDATION_ERROR | Invalid flyer ID format | flyerId nie jest UUID |
| 401 | UNAUTHORIZED | Authentication required | Brak sesji |
| 403 | FORBIDDEN | Admin access required | Brak roli admin |
| 404 | NOT_FOUND | Flyer not found | flyerId nie istnieje |
| 413 | PAYLOAD_TOO_LARGE | File too large: {name} | Plik > 10MB |
| 500 | INTERNAL_SERVER_ERROR | Storage upload failed | Błąd Supabase Storage |
| 500 | INTERNAL_SERVER_ERROR | Database error | Błąd zapisu do DB |

**Error handling w kodzie:**
```typescript
try {
  // Upload logic
} catch (error) {
  console.error('Failed to upload flyer pages:', {
    error,
    flyerId,
    fileCount: files.length,
    userId: context.locals.userId
  });
  
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'Failed to upload pages. Please try again.',
    500
  );
}
```

---

### 7.3. GET /api/admin/flyer-pages/:id - Błędy

| Status | Code | Message | Scenariusz |
|--------|------|---------|------------|
| 400 | VALIDATION_ERROR | Invalid page ID format | id nie jest UUID |
| 401 | UNAUTHORIZED | Authentication required | Brak sesji |
| 403 | FORBIDDEN | Admin access required | Brak roli admin |
| 404 | NOT_FOUND | Flyer page not found | id nie istnieje |
| 500 | INTERNAL_SERVER_ERROR | Database error | Błąd query |

---

### 7.4. POST /api/admin/flyer-pages/:id/process - Błędy

| Status | Code | Message | Scenariusz |
|--------|------|---------|------------|
| 400 | VALIDATION_ERROR | Invalid page ID format | id nie jest UUID |
| 400 | INVALID_STATUS_TRANSITION | Page already processed | reprocess=false i status≠draft |
| 401 | UNAUTHORIZED | Authentication required | Brak sesji |
| 403 | FORBIDDEN | Admin access required | Brak roli admin |
| 404 | NOT_FOUND | Flyer page not found | id nie istnieje |
| 500 | INTERNAL_SERVER_ERROR | AI processing failed | Błąd OpenRouter |
| 503 | SERVICE_UNAVAILABLE | AI service temporarily unavailable | OpenRouter down |

**Szczególna obsługa błędów AI:**
```typescript
try {
  await AIService.processPage(pageId);
} catch (error) {
  // Zapisz błąd w bazie
  await supabase
    .from('flyer_pages')
    .update({
      status: 'draft',
      error_message: error.message,
      updated_at: new Date().toISOString()
    })
    .eq('id', pageId);
  
  // Log szczegółów
  console.error('AI processing failed:', {
    error,
    pageId,
    timestamp: new Date().toISOString()
  });
  
  // Zwróć odpowiedni błąd
  if (error.message.includes('timeout')) {
    return createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'AI service timeout. Please try again later.',
      503
    );
  }
  
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'AI processing failed. The error has been logged.',
    500
  );
}
```

---

### 7.5. PATCH /api/admin/flyer-pages/:id - Błędy

| Status | Code | Message | Scenariusz |
|--------|------|---------|------------|
| 400 | VALIDATION_ERROR | Invalid page ID format | id nie jest UUID |
| 400 | VALIDATION_ERROR | Invalid status value | status nie jest enum |
| 400 | INVALID_STATUS_TRANSITION | Cannot transition from {old} to {new} | Niedozwolone przejście |
| 401 | UNAUTHORIZED | Authentication required | Brak sesji |
| 403 | FORBIDDEN | Admin access required | Brak roli admin |
| 404 | NOT_FOUND | Flyer page not found | id nie istnieje |
| 500 | INTERNAL_SERVER_ERROR | Database error | Błąd update |

**Status transition validation:**
```typescript
const allowedTransitions: Record<FlyerStatus, FlyerStatus[]> = {
  draft: ['processing', 'verification', 'published'],
  processing: ['draft', 'verification'],
  verification: ['published', 'draft'],
  published: ['verification']
};

if (!allowedTransitions[currentStatus].includes(newStatus)) {
  return createErrorResponse(
    'INVALID_STATUS_TRANSITION',
    `Cannot transition from ${currentStatus} to ${newStatus}`,
    400
  );
}
```

---

### 7.6. DELETE /api/admin/flyer-pages/:id - Błędy

| Status | Code | Message | Scenariusz |
|--------|------|---------|------------|
| 400 | VALIDATION_ERROR | Invalid page ID format | id nie jest UUID |
| 400 | INVALID_STATUS_TRANSITION | Cannot delete published page | Business rule |
| 401 | UNAUTHORIZED | Authentication required | Brak sesji |
| 403 | FORBIDDEN | Admin access required | Brak roli admin |
| 404 | NOT_FOUND | Flyer page not found | id nie istnieje |
| 500 | INTERNAL_SERVER_ERROR | Failed to delete files | Storage error |
| 500 | INTERNAL_SERVER_ERROR | Database error | Delete error |

**Transactional delete:**
```typescript
// Najpierw usuń pliki, potem DB
// Jeśli storage error → nie usuwaj z DB

try {
  // 1. Delete from storage
  await storageService.deleteFile('raw_flyers', originalPath);
  await storageService.deleteFile('public_flyers', webPath);
  
  // 2. Delete from DB (cascade deletes products)
  const { error } = await supabase
    .from('flyer_pages')
    .delete()
    .eq('id', pageId);
  
  if (error) throw error;
  
  return new Response(null, { status: 204 });
  
} catch (error) {
  console.error('Failed to delete page:', { error, pageId });
  
  // Rollback? W przypadku storage lepiej zostawić orphaned files
  // niż mieć DB records bez plików
  
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'Failed to delete page',
    500
  );
}
```

---

### 7.7. Logowanie błędów

**Format structured logs:**
```typescript
console.error('Operation failed:', {
  operation: 'upload_flyer_pages',
  error: error.message,
  stack: error.stack,
  context: {
    flyerId,
    userId,
    fileCount,
    timestamp: new Date().toISOString()
  }
});
```

**Poziomy logowania:**
- `console.error()` - błędy systemowe (500, 503)
- `console.warn()` - błędy biznesowe (400, 404)
- `console.info()` - operacje sukces (201, 200) - opcjonalnie

**Nie loguj:**
- Haseł, tokenów, API keys
- Pełnych file contents
- PII (Personally Identifiable Information) - chyba że GDPR compliance

---

## 8. Rozważania dotyczące wydajności

### 8.1. Upload performance

**Problem:** Upload wielu dużych plików może być wolny

**Optymalizacje:**
1. **Parallel uploads do Storage:**
```typescript
// Zamiast sekwencyjnego uploadu
const uploadPromises = files.map(file => 
  storageService.uploadFile(bucket, path, file)
);
const results = await Promise.all(uploadPromises);
```

2. **Streaming conversion:**
- Nie ładuj całego pliku do memory
- Użyj streaming API dla konwersji WebP

3. **Progressive responses:**
- Rozważ WebSocket lub Server-Sent Events dla długich operacji
- Lub: endpoint zwraca 202 Accepted, frontend poll'uje status

**Limity:**
- Max 10 plików per request (business rule)
- Total payload max 50MB (10MB × 5 plików rekomendowane)

---

### 8.2. AI Processing performance

**Problem:** AI processing może trwać 10-60s per page

**Rozwiązanie: Asynchronous processing**

**Option A: Background jobs (recommended)**
```typescript
// Endpoint tylko uruchamia job
POST /api/admin/flyer-pages/:id/process
→ Returns 202 Accepted immediately
→ Job queue processes in background

// Frontend poll'uje status
GET /api/admin/flyer-pages/:id
→ Sprawdza status field
```

**Option B: Webhooks/SSE**
- Server wysyła notification po zakończeniu
- Wymaga dodatkowej infrastruktury

**Implementacja job queue:**
- Prosty: setImmediate/setTimeout (dev only)
- Production: BullMQ + Redis, Inngest, Trigger.dev

**Retry logic:**
- Max 3 retry attempts dla AI errors
- Exponential backoff: 5s, 15s, 45s
- Po 3 failures: status='draft', error_message zapisany

---

### 8.3. Database query optimization

**Problem:** Query do flyer_pages może być wolne z dużymi raw_ai_data

**Optymalizacje:**
1. **Selective fields:**
```typescript
// GET list - nie pobieraj raw_ai_data
.select('id, page_number, status, updated_at')

// GET detail - pobieraj raw_ai_data tylko gdy potrzebne
.select('*, raw_ai_data')
```

2. **Indeksy (już w DB plan):**
```sql
CREATE INDEX idx_flyer_pages_flyer_id ON flyer_pages(flyer_id);
CREATE INDEX idx_flyer_pages_status ON flyer_pages(status);
CREATE INDEX idx_flyer_pages_raw_ai_data ON flyer_pages USING GIN(raw_ai_data);
```

3. **Paginacja dla list queries:**
- Domyślnie limit=20
- Max limit=100
- Używaj offset dla paginacji

---

### 8.4. Storage optimization

**Problem:** Przechowywanie 2 wersji każdego obrazu (original + webp)

**Strategie:**
1. **Retention policy:**
- Usuń oryginały po 90 dniach (jeśli flyer expired)
- Zachowaj tylko WebP dla archiwalnych gazetek

2. **CDN caching:**
- Supabase Storage ma built-in CDN
- Cache-Control headers dla public_flyers

3. **Lazy processing:**
- Upload original → status=draft
- Konwertuj WebP dopiero przed publish
- Trade-off: wolniejsze publishowanie vs szybszy upload

**Rekomendacja:**
- Konwertuj WebP od razu (jak w specyfikacji)
- Mniejsze pliki = szybsze ładowanie dla userów
- Koszt storage < koszt bandwidth

---

### 8.5. Rate limiting

**Endpoint limits (recommended):**
- POST /api/admin/flyers/:flyerId/pages: 10 req/min per user
- POST /api/admin/flyer-pages/:id/process: 5 req/min per user
- GET endpoints: 100 req/min per user
- DELETE endpoints: 20 req/min per user

**Implementacja:**
- Simple: in-memory Map z timestamps (dev)
- Production: Upstash Redis + @upstash/ratelimit

**Response:**
```typescript
// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 30 seconds.",
    "details": [
      {
        "field": "rate_limit",
        "message": "Retry after 30s"
      }
    ]
  }
}
```

**Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000000
Retry-After: 30
```

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury i typów

**Cel:** Dodanie nowych typów i schematów walidacji

**Pliki do modyfikacji:**
1. `src/types.ts` - dodać nowe typy pomocnicze:
   - `UploadedPageInfo`
   - `UploadFlyerPagesResponse`
   - `ProcessPageResponse`
   - `UpdatePageResponse`

2. `src/lib/schemas/flyer.schema.ts` - dodać nowe schematy:
   - `flyerPageIdParamsSchema` - walidacja UUID
   - `processFlyerPageSchema` - walidacja reprocess param
   - `updateFlyerPageSchema` - walidacja status enum
   - `uploadFileSchema` - walidacja plików (optional, może być inline)

**Przykład schema:**
```typescript
// src/lib/schemas/flyer.schema.ts

export const flyerPageIdParamsSchema = z.object({
  id: z.string().uuid('Invalid flyer page ID format'),
});

export const processFlyerPageSchema = z.object({
  reprocess: z.boolean().optional().default(false),
});

export const updateFlyerPageSchema = z.object({
  status: z.enum(['draft', 'processing', 'verification', 'published']),
});

export type FlyerPageIdParams = z.infer<typeof flyerPageIdParamsSchema>;
export type ProcessFlyerPageCommand = z.infer<typeof processFlyerPageSchema>;
export type UpdateFlyerPageCommand = z.infer<typeof updateFlyerPageSchema>;
```

**Czas:** 1-2h

---

### Krok 2: Implementacja StorageService

**Cel:** Helper do operacji na Supabase Storage

**Plik:** `src/lib/services/storage.service.ts` (NOWY)

**Metody:**
```typescript
class StorageService {
  constructor(private supabase: SupabaseClient) {}
  
  async uploadFile(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: { contentType?: string }
  ): Promise<{ path: string; url: string }>;
  
  async deleteFile(
    bucket: string,
    path: string
  ): Promise<void>;
  
  async convertToWebP(
    imageBuffer: ArrayBuffer,
    maxWidth: number
  ): Promise<Blob>;
  
  generatePublicUrl(
    bucket: string,
    path: string
  ): string;
  
  async generateSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number
  ): Promise<string>;
}
```

**Dependencies:**
- Sharp library dla konwersji WebP: `npm install sharp`
- Lub Canvas API (browser-based) - ale Sharp lepsze dla server-side

**Implementacja konwersji WebP:**
```typescript
import sharp from 'sharp';

async convertToWebP(
  imageBuffer: ArrayBuffer,
  maxWidth = 1000
): Promise<Blob> {
  const buffer = await sharp(imageBuffer)
    .resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: 85 })
    .toBuffer();
  
  return new Blob([buffer], { type: 'image/webp' });
}
```

**Czas:** 3-4h

---

### Krok 3: Rozszerzenie FlyerService o metody dla pages

**Cel:** Dodanie metod do zarządzania stronami gazetek

**Plik:** `src/lib/services/flyer.service.ts` (rozszerzenie istniejącego)

**Nowe metody:**
```typescript
class FlyerService {
  // ... istniejące metody ...
  
  /**
   * Tworzy rekordy stron gazetki w bazie
   * 
   * Używane po uploadzie plików do storage
   */
  async createPages(
    flyerId: string,
    pages: Array<{
      pageNumber: number;
      originalImagePath: string;
      webImagePath: string;
    }>
  ): Promise<AdminFlyerPageDetailDTO[]>;
  
  /**
   * Pobiera pojedynczą stronę z raw_ai_data
   */
  async getFlyerPageById(
    pageId: string
  ): Promise<AdminFlyerPageRawDTO | null>;
  
  /**
   * Aktualizuje status strony
   */
  async updatePageStatus(
    pageId: string,
    status: FlyerStatus,
    errorMessage?: string
  ): Promise<{ id: string; status: FlyerStatus; updated_at: string }>;
  
  /**
   * Usuwa stronę z bazy (bez plików - to robi handler)
   */
  async deletePage(
    pageId: string
  ): Promise<boolean>;
  
  /**
   * Pomocnicza: pobiera next page number dla gazetki
   */
  private async getNextPageNumber(flyerId: string): Promise<number>;
  
  /**
   * Pomocnicza: pobiera store_slug dla gazetki (do ścieżek)
   */
  async getFlyerStoreSlug(flyerId: string): Promise<string | null>;
}
```

**Implementacja przykład - createPages:**
```typescript
async createPages(
  flyerId: string,
  pages: Array<{
    pageNumber: number;
    originalImagePath: string;
    webImagePath: string;
  }>
): Promise<AdminFlyerPageDetailDTO[]> {
  const inserts = pages.map(page => ({
    flyer_id: flyerId,
    page_number: page.pageNumber,
    original_image_path: page.originalImagePath,
    web_image_path: page.webImagePath,
    status: 'draft' as FlyerStatus,
  }));
  
  const { data, error } = await this.supabase
    .from('flyer_pages')
    .insert(inserts)
    .select('id, page_number, original_image_path, web_image_path, status, raw_ai_data, error_message, created_at, updated_at, products (count)');
  
  if (error) {
    console.error('Failed to create flyer pages:', { error, flyerId, pages });
    throw new Error('Database insert failed');
  }
  
  return data.map(row => ({
    id: row.id,
    page_number: row.page_number,
    original_image_url: this.generateStorageUrl('raw_flyers', row.original_image_path),
    web_image_url: this.generateStorageUrl('public_flyers', row.web_image_path),
    status: row.status,
    product_count: row.products?.[0]?.count ?? 0,
    has_raw_ai_data: row.raw_ai_data !== null,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
```

**Czas:** 4-5h

---

### Krok 4: Implementacja AIService

**Cel:** Serwis do przetwarzania obrazów przez OpenRouter AI

**Plik:** `src/lib/services/ai.service.ts` (NOWY)

**Konfiguracja:**
```typescript
// .env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

// W bazie (app_config):
ai_ocr_prompt: "Extract all text from this grocery flyer image..."
ai_llm_prompt: "Structure the following OCR text into JSON..."
ai_ocr_model: "google/gemini-2.0-flash-exp:free"
ai_llm_model: "anthropic/claude-3.5-sonnet"
```

**Klasa AIService:**
```typescript
interface OCRResult {
  text: string;
  confidence: number;
}

interface StructuredProduct {
  name: string;
  price: string;
  unit?: string;
  description?: string;
  bbox?: BBox;
  confidence?: number;
}

class AIService {
  constructor(
    private supabase: SupabaseClient,
    private apiKey: string
  ) {}
  
  /**
   * Główna metoda - przetwarzanie całej strony
   */
  async processPage(
    pageId: string
  ): Promise<RawAIData>;
  
  /**
   * Krok 1: OCR - ekstrakcja tekstu z obrazu
   */
  private async extractTextFromImage(
    imageUrl: string,
    prompt: string
  ): Promise<OCRResult>;
  
  /**
   * Krok 2: LLM - strukturyzacja tekstu do JSON
   */
  private async structureProductData(
    ocrText: string,
    prompt: string
  ): Promise<StructuredProduct[]>;
  
  /**
   * Krok 3: Zapis raw_ai_data do bazy
   */
  private async saveRawAIData(
    pageId: string,
    data: RawAIData
  ): Promise<void>;
  
  /**
   * Krok 4: Utworzenie produktów z AI data
   */
  private async createProductsFromAI(
    pageId: string,
    products: StructuredProduct[]
  ): Promise<void>;
  
  /**
   * Pomocnicza: pobierz prompty z app_config
   */
  private async getPrompts(): Promise<{
    ocrPrompt: string;
    llmPrompt: string;
    ocrModel: string;
    llmModel: string;
  }>;
}
```

**Implementacja processPage:**
```typescript
async processPage(pageId: string): Promise<RawAIData> {
  // 1. Pobierz stronę z DB
  const { data: page, error } = await this.supabase
    .from('flyer_pages')
    .select('original_image_path, status')
    .eq('id', pageId)
    .single();
  
  if (error || !page) {
    throw new Error('Page not found');
  }
  
  // 2. Update status → processing
  await this.supabase
    .from('flyer_pages')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', pageId);
  
  try {
    // 3. Pobierz prompty z config
    const { ocrPrompt, llmPrompt, ocrModel, llmModel } = await this.getPrompts();
    
    // 4. Generuj URL do obrazu (signed URL dla private bucket)
    const imageUrl = await this.generateSignedUrl('raw_flyers', page.original_image_path);
    
    // 5. OCR - ekstrakcja tekstu
    const ocrResult = await this.extractTextFromImage(imageUrl, ocrPrompt);
    
    // 6. LLM - strukturyzacja
    const products = await this.structureProductData(ocrResult.text, llmPrompt);
    
    // 7. Zbuduj RawAIData
    const rawAIData: RawAIData = {
      ocr_text: ocrResult.text,
      detected_products: products,
    };
    
    // 8. Zapisz do bazy
    await this.saveRawAIData(pageId, rawAIData);
    
    // 9. Utwórz produkty
    await this.createProductsFromAI(pageId, products);
    
    // 10. Update status → verification
    await this.supabase
      .from('flyer_pages')
      .update({ 
        status: 'verification',
        error_message: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', pageId);
    
    return rawAIData;
    
  } catch (error) {
    // Error handling - status → draft, zapisz error
    await this.supabase
      .from('flyer_pages')
      .update({
        status: 'draft',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId);
    
    console.error('AI processing failed:', { error, pageId });
    throw error;
  }
}
```

**Implementacja extractTextFromImage (OCR):**
```typescript
private async extractTextFromImage(
  imageUrl: string,
  prompt: string
): Promise<OCRResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://dealspy.app',
      'X-Title': 'DealSpy Admin',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error(`OCR API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    confidence: 0.9 // OpenRouter nie zwraca confidence, hardcode
  };
}
```

**Implementacja structureProductData (LLM):**
```typescript
private async structureProductData(
  ocrText: string,
  prompt: string
): Promise<StructuredProduct[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://dealspy.app',
      'X-Title': 'DealSpy Admin',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'user',
          content: prompt + '\n\n' + ocrText
        }
      ],
      response_format: { type: 'json_object' }
    })
  });
  
  if (!response.ok) {
    throw new Error(`LLM API error: ${response.statusText}`);
  }
  
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  
  // Walidacja struktury
  const schema = z.array(z.object({
    name: z.string(),
    price: z.string(),
    unit: z.string().optional(),
    description: z.string().optional(),
    bbox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }).optional(),
    confidence: z.number().optional()
  }));
  
  return schema.parse(parsed.products);
}
```

**Czas:** 6-8h (including testing with real API)

---

### Krok 5: Implementacja endpoint POST /api/admin/flyers/:flyerId/pages

**Cel:** Upload stron gazetki

**Plik:** `src/pages/api/admin/flyers/[flyerId]/pages.ts` (NOWY)

**Struktura:**
```typescript
export const prerender = false;

import type { APIContext } from 'astro';
import { checkAdminAccess, getAuthErrorStatus, getAuthErrorMessage } from '@/lib/helpers/auth.helper';
import { createErrorResponse, createSuccessResponse } from '@/lib/helpers/api-response.helper';
import { flyerIdParamsSchema } from '@/lib/schemas/flyer.schema';
import { FlyerService } from '@/lib/services/flyer.service';
import { StorageService } from '@/lib/services/storage.service';
import type { UploadFlyerPagesResponse } from '@/types';

export async function POST(context: APIContext): Promise<Response> {
  // 1. Auth check
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);
  if (!isAdmin) {
    return createErrorResponse(
      authError!,
      getAuthErrorMessage(authError!),
      getAuthErrorStatus(authError!)
    );
  }
  
  // 2. Validate flyerId
  const flyerId = context.params.flyerId;
  const validation = flyerIdParamsSchema.safeParse({ id: flyerId });
  if (!validation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid flyer ID format',
      400
    );
  }
  
  // 3. Check flyer exists
  const flyerService = new FlyerService(context.locals.supabase);
  const flyerExists = await flyerService.checkFLyerExists(flyerId!);
  if (!flyerExists) {
    return createErrorResponse('NOT_FOUND', 'Flyer not found', 404);
  }
  
  // 4. Parse multipart/form-data
  const formData = await context.request.formData();
  const files = formData.getAll('files') as File[];
  
  if (files.length === 0) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'No files provided',
      400
    );
  }
  
  // 5. Validate files
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        `Invalid file type: ${file.type}. Allowed: JPG, PNG, WEBP`,
        400
      );
    }
    
    if (file.size > maxSize) {
      return createErrorResponse(
        'PAYLOAD_TOO_LARGE',
        `File too large: ${file.name}. Maximum 10MB`,
        413
      );
    }
  }
  
  // 6. Get store slug and next page number
  const storeSlug = await flyerService.getFlyerStoreSlug(flyerId!);
  if (!storeSlug) {
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Failed to get flyer store',
      500
    );
  }
  
  let nextPageNumber = await flyerService['getNextPageNumber'](flyerId!);
  
  // 7. Upload files and create pages
  const storageService = new StorageService(context.locals.supabase);
  const uploadedPages: UploadedPageInfo[] = [];
  
  try {
    for (const file of files) {
      const pageNumber = nextPageNumber++;
      const ext = file.name.split('.').pop() || 'jpg';
      
      // Upload original
      const originalPath = `${storeSlug}/${flyerId}/page-${pageNumber}-original.${ext}`;
      await storageService.uploadFile('raw_flyers', originalPath, file);
      
      // Convert to WebP
      const buffer = await file.arrayBuffer();
      const webpBlob = await storageService.convertToWebP(buffer, 1000);
      
      // Upload WebP
      const webPath = `${storeSlug}/${flyerId}/page-${pageNumber}.webp`;
      await storageService.uploadFile('public_flyers', webPath, webpBlob, {
        contentType: 'image/webp'
      });
      
      uploadedPages.push({
        pageNumber,
        originalImagePath: originalPath,
        webImagePath: webPath
      });
    }
    
    // 8. Create DB records
    const createdPages = await flyerService.createPages(flyerId!, uploadedPages);
    
    // 9. Response
    const response: UploadFlyerPagesResponse = {
      flyer_id: flyerId!,
      uploaded_pages: createdPages.map(page => ({
        id: page.id,
        page_number: page.page_number,
        original_image_url: page.original_image_url,
        web_image_url: page.web_image_url,
        status: page.status,
        created_at: page.created_at
      }))
    };
    
    return createSuccessResponse(response, 201);
    
  } catch (error) {
    console.error('Failed to upload flyer pages:', {
      error,
      flyerId,
      fileCount: files.length
    });
    
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Failed to upload pages',
      500
    );
  }
}
```

**Czas:** 3-4h

---

### Krok 6: Implementacja endpoint GET /api/admin/flyer-pages/:id

**Cel:** Pobranie szczegółów strony z raw_ai_data

**Plik:** `src/pages/api/admin/flyer-pages/[id].ts` (NOWY - multi-method)

```typescript
export const prerender = false;

import type { APIContext } from 'astro';
import { checkAdminAccess, getAuthErrorStatus, getAuthErrorMessage } from '@/lib/helpers/auth.helper';
import { createErrorResponse, createSuccessResponse } from '@/lib/helpers/api-response.helper';
import { flyerPageIdParamsSchema, updateFlyerPageSchema } from '@/lib/schemas/flyer.schema';
import { formatZodErrors } from '@/lib/helpers/api-response.helper';
import { FlyerService } from '@/lib/services/flyer.service';
import { StorageService } from '@/lib/services/storage.service';

export async function GET(context: APIContext): Promise<Response> {
  // 1. Auth
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);
  if (!isAdmin) {
    return createErrorResponse(
      authError!,
      getAuthErrorMessage(authError!),
      getAuthErrorStatus(authError!)
    );
  }
  
  // 2. Validate ID
  const pageId = context.params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });
  if (!validation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid page ID format',
      400,
      formatZodErrors(validation.error)
    );
  }
  
  // 3. Get page
  const flyerService = new FlyerService(context.locals.supabase);
  const page = await flyerService.getFlyerPageById(pageId!);
  
  if (!page) {
    return createErrorResponse('NOT_FOUND', 'Flyer page not found', 404);
  }
  
  return createSuccessResponse(page, 200);
}

export async function PATCH(context: APIContext): Promise<Response> {
  // Implementacja w kolejnym kroku
}

export async function DELETE(context: APIContext): Promise<Response> {
  // Implementacja w kolejnym kroku
}
```

**Czas:** 2h

---

### Krok 7: Implementacja endpoint POST /api/admin/flyer-pages/:id/process

**Cel:** Trigger przetwarzania AI

**Plik:** `src/pages/api/admin/flyer-pages/[id]/process.ts` (NOWY)

```typescript
export const prerender = false;

import type { APIContext } from 'astro';
import { checkAdminAccess, getAuthErrorStatus, getAuthErrorMessage } from '@/lib/helpers/auth.helper';
import { createErrorResponse, createSuccessResponse } from '@/lib/helpers/api-response.helper';
import { flyerPageIdParamsSchema, processFlyerPageSchema } from '@/lib/schemas/flyer.schema';
import { formatZodErrors } from '@/lib/helpers/api-response.helper';
import { FlyerService } from '@/lib/services/flyer.service';
import { AIService } from '@/lib/services/ai.service';
import type { ProcessPageResponse } from '@/types';

export async function POST(context: APIContext): Promise<Response> {
  // 1. Auth
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);
  if (!isAdmin) {
    return createErrorResponse(
      authError!,
      getAuthErrorMessage(authError!),
      getAuthErrorStatus(authError!)
    );
  }
  
  // 2. Validate ID
  const pageId = context.params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });
  if (!validation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid page ID format',
      400,
      formatZodErrors(validation.error)
    );
  }
  
  // 3. Parse body
  const body = await context.request.json();
  const bodyValidation = processFlyerPageSchema.safeParse(body);
  if (!bodyValidation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid request body',
      400,
      formatZodErrors(bodyValidation.error)
    );
  }
  
  const { reprocess } = bodyValidation.data;
  
  // 4. Get page
  const flyerService = new FlyerService(context.locals.supabase);
  const page = await flyerService.getFlyerPageById(pageId!);
  
  if (!page) {
    return createErrorResponse('NOT_FOUND', 'Flyer page not found', 404);
  }
  
  // 5. Check if already processed
  if (!reprocess && ['verification', 'published'].includes(page.status)) {
    return createErrorResponse(
      'INVALID_STATUS_TRANSITION',
      'Page already processed. Use reprocess=true to process again.',
      400
    );
  }
  
  // 6. Trigger AI processing (async)
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'AI service not configured',
      500
    );
  }
  
  const aiService = new AIService(context.locals.supabase, apiKey);
  
  // Option A: Synchronous (blocking) - simple but slow
  // try {
  //   await aiService.processPage(pageId!);
  // } catch (error) {
  //   return createErrorResponse(
  //     'INTERNAL_SERVER_ERROR',
  //     'AI processing failed',
  //     500
  //   );
  // }
  
  // Option B: Asynchronous (fire and forget) - recommended
  // Don't await, return 202 immediately
  aiService.processPage(pageId!).catch(error => {
    console.error('Background AI processing failed:', { error, pageId });
  });
  
  // 7. Response
  const response: ProcessPageResponse = {
    id: pageId!,
    status: 'processing',
    message: 'AI processing started'
  };
  
  return createSuccessResponse(response, 202);
}
```

**Czas:** 3h

---

### Krok 8: Implementacja endpoint PATCH /api/admin/flyer-pages/:id

**Cel:** Aktualizacja statusu strony

**Dodać do:** `src/pages/api/admin/flyer-pages/[id].ts`

```typescript
export async function PATCH(context: APIContext): Promise<Response> {
  // 1. Auth
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);
  if (!isAdmin) {
    return createErrorResponse(
      authError!,
      getAuthErrorMessage(authError!),
      getAuthErrorStatus(authError!)
    );
  }
  
  // 2. Validate ID
  const pageId = context.params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });
  if (!validation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid page ID format',
      400,
      formatZodErrors(validation.error)
    );
  }
  
  // 3. Parse body
  const body = await context.request.json();
  const bodyValidation = updateFlyerPageSchema.safeParse(body);
  if (!bodyValidation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid request body',
      400,
      formatZodErrors(bodyValidation.error)
    );
  }
  
  const { status } = bodyValidation.data;
  
  // 4. Get current page
  const flyerService = new FlyerService(context.locals.supabase);
  const page = await flyerService.getFlyerPageById(pageId!);
  
  if (!page) {
    return createErrorResponse('NOT_FOUND', 'Flyer page not found', 404);
  }
  
  // 5. Optional: Validate status transition
  const allowedTransitions: Record<string, string[]> = {
    draft: ['processing', 'verification', 'published'],
    processing: ['draft', 'verification'],
    verification: ['published', 'draft'],
    published: ['verification']
  };
  
  if (!allowedTransitions[page.status]?.includes(status)) {
    return createErrorResponse(
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from ${page.status} to ${status}`,
      400
    );
  }
  
  // 6. Update status
  const result = await flyerService.updatePageStatus(pageId!, status);
  
  return createSuccessResponse(result, 200);
}
```

**Czas:** 2h

---

### Krok 9: Implementacja endpoint DELETE /api/admin/flyer-pages/:id

**Cel:** Usunięcie strony i plików

**Dodać do:** `src/pages/api/admin/flyer-pages/[id].ts`

```typescript
export async function DELETE(context: APIContext): Promise<Response> {
  // 1. Auth
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);
  if (!isAdmin) {
    return createErrorResponse(
      authError!,
      getAuthErrorMessage(authError!),
      getAuthErrorStatus(authError!)
    );
  }
  
  // 2. Validate ID
  const pageId = context.params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });
  if (!validation.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid page ID format',
      400,
      formatZodErrors(validation.error)
    );
  }
  
  // 3. Get page (need paths for storage deletion)
  const { data: page, error: fetchError } = await context.locals.supabase
    .from('flyer_pages')
    .select('id, status, original_image_path, web_image_path')
    .eq('id', pageId!)
    .maybeSingle();
  
  if (fetchError || !page) {
    return createErrorResponse('NOT_FOUND', 'Flyer page not found', 404);
  }
  
  // 4. Optional: Business rule - cannot delete published
  if (page.status === 'published') {
    return createErrorResponse(
      'INVALID_STATUS_TRANSITION',
      'Cannot delete published page. Unpublish first.',
      400
    );
  }
  
  // 5. Delete from storage
  const storageService = new StorageService(context.locals.supabase);
  
  try {
    if (page.original_image_path) {
      await storageService.deleteFile('raw_flyers', page.original_image_path);
    }
    
    if (page.web_image_path) {
      await storageService.deleteFile('public_flyers', page.web_image_path);
    }
  } catch (error) {
    console.error('Failed to delete storage files:', {
      error,
      pageId,
      paths: {
        original: page.original_image_path,
        web: page.web_image_path
      }
    });
    
    // Continue with DB deletion even if storage fails
    // Better to have orphaned files than broken DB references
  }
  
  // 6. Delete from DB (cascade deletes products)
  const { error: deleteError } = await context.locals.supabase
    .from('flyer_pages')
    .delete()
    .eq('id', pageId!);
  
  if (deleteError) {
    console.error('Failed to delete flyer page:', { error: deleteError, pageId });
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Failed to delete page',
      500
    );
  }
  
  // 7. Return 204 No Content
  return new Response(null, { status: 204 });
}
```

**Czas:** 2h

---

### Krok 10: Testy manualne i integracyjne

**Cel:** Weryfikacja działania wszystkich endpointów

**Scenariusze testowe:**

1. **POST Upload pages:**
   - Upload 1 pliku JPG → 201
   - Upload 3 plików PNG → 201
   - Upload pliku > 10MB → 413
   - Upload PDF → 400
   - Upload bez plików → 400
   - Upload do nieistniejącej gazetki → 404
   - Upload bez auth → 401
   - Upload jako user (nie admin) → 403

2. **GET Page detail:**
   - Pobranie istniejącej strony → 200
   - Pobranie z raw_ai_data → 200 (sprawdź strukturę)
   - Pobranie nieistniejącej → 404
   - Invalid UUID → 400

3. **POST Process:**
   - Process draft page → 202
   - Sprawdź status change do 'processing' → 200 (GET)
   - Po zakończeniu sprawdź 'verification' → 200 (GET)
   - Process bez reprocess=true → 400
   - Process z reprocess=true → 202

4. **PATCH Update status:**
   - draft → published → 200
   - verification → published → 200
   - published → draft → 400 (invalid transition)
   - Invalid status → 400

5. **DELETE Page:**
   - Delete draft page → 204
   - Delete published page → 400
   - Sprawdź czy pliki usunięte (Storage)
   - Sprawdź czy produkty usunięte (DB)

**Tools:**
- Postman/Insomnia dla API testing
- Supabase Dashboard dla DB verification
- Supabase Storage Browser dla files verification

**Czas:** 4-5h

---

### Krok 11: Dokumentacja i cleanup

**Cel:** Dokumentacja API i kod cleanup

**Zadania:**
1. Dodać JSDoc comments do wszystkich nowych metod
2. Uzupełnić README z przykładami użycia
3. Cleanup console.logs (zostawić tylko errors)
4. Code review checklist:
   - Wszystkie errory są obsłużone?
   - Walidacja we wszystkich endpointach?
   - Storage files są czyszczone przy DELETE?
   - Status transitions są sensowne?
   - AI timeouts są ustawione?

**Czas:** 2-3h


## Zależności do instalacji

```json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

```bash
npm install sharp
```

---

## Zmienne środowiskowe

Dodać do `.env`:
```env
# OpenRouter AI
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Supabase (już istnieją)
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Następne kroki po implementacji

1. **Monitoring:**
   - Setup monitoring dla AI processing failures
   - Alert gdy storage > 80% capacity
   - Track AI costs (OpenRouter usage)

2. **Optymalizacje:**
   - Implementacja proper job queue (BullMQ)
   - Caching dla prompts z app_config
   - Rate limiting middleware

3. **Rozszerzenia:**
   - Batch processing endpoint (process all pages)
   - Webhook notifications po zakończeniu processing
   - Admin dashboard ze statistics

---

**Koniec planu implementacji**

