# REST API Plan - DealSpy

## 1. Overview

This REST API plan is designed for the DealSpy MVP application, a promotional flyer aggregator that uses AI (OCR + LLM) to digitize paper promotional materials from retail stores. The API serves two primary user groups:

- **Administrators**: Manage stores, upload flyers, verify AI-extracted data, and publish content
- **End Users (Guests)**: Browse, search, and compare promotional offers without authentication

**Technology Stack:**
- Backend: Supabase (PostgreSQL + BaaS)
- Authentication: Supabase Auth
- Frontend: Astro 5 with React 19
- AI Processing: Openrouter.ai

**Key Design Principles:**
- RESTful resource-based architecture
- Leverage Supabase RLS for security
- Optimize for mobile performance (< 2.0s FCP)
- Support SSR with Astro for public routes
- Minimal custom API layer (use Supabase client where appropriate)

---

## 2. Resources

| Resource | Database Table | Description | Access |
|----------|---------------|-------------|--------|
| Profiles | `profiles` | User profiles with role management | Admin (own profile), Public (read own) |
| Stores | `stores` | Retail store/chain master data | Public (read), Admin (full CRUD) |
| Categories | `categories` | Product category dictionary (12 predefined) | Public (read), Admin (update) |
| Flyers | `flyers` | Promotional flyer metadata with validity dates | Public (published only), Admin (full CRUD) |
| Flyer Pages | `flyer_pages` | Individual pages of flyers with AI data | Public (published only), Admin (full CRUD) |
| Products | `products` | Products extracted from flyer pages | Public (active only), Admin (full CRUD) |
| App Config | `app_config` | System configuration (AI prompts, settings) | Admin only |

---

## 3. Authentication & Authorization

### Authentication Mechanism

**Supabase Auth** is used for all authentication operations:

- **Admin Login**: Use Supabase Auth client SDK with email/password
- **Session Management**: Handled by Supabase (JWT tokens in cookies/localStorage)
- **No Custom Endpoints**: Leverage built-in `supabase.auth.signIn()`, `signOut()`, `getSession()`

### Authorization Strategy

**Row Level Security (RLS)** policies automatically enforce access control:

1. **Public Access (Unauthenticated)**:
   - Read published stores, categories
   - Read active products (via `v_active_products` view)
   - Read published flyers and pages

2. **Admin Access (Authenticated with role='admin')**:
   - Full CRUD on all resources
   - Access to draft/processing flyers
   - Access to raw AI data and private storage

**Implementation**: 
- Astro middleware checks `auth.uid()` and user role from Supabase session
- API endpoints use authenticated Supabase client
- RLS policies automatically filter queries based on user context

### Protected Route Pattern

```typescript
// Astro middleware example
export async function onRequest({ request, locals, redirect }, next) {
  const supabase = createClient(/* ... */)
  const { data: { session } } = await supabase.auth.getSession()
  
  if (request.url.includes('/api/admin/') && !session) {
    return redirect('/admin/login')
  }
  
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    
    if (request.url.includes('/api/admin/') && profile?.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }
  }
  
  return next()
}
```

---

## 4. API Endpoints

### 4.1 Public Endpoints

#### 4.1.1 Stores

##### GET /api/stores

List all stores with logo URLs.

**Query Parameters:**
- None (returns all stores, typically small dataset)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Biedronka",
      "slug": "biedronka",
      "logo_url": "https://[supabase-url]/storage/v1/object/public/store-logos/biedronka.webp",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error`: Database error

---

##### GET /api/stores/:slug

Get single store by slug.

**Path Parameters:**
- `slug` (string): Store slug (e.g., "lidl")

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Lidl",
    "slug": "lidl",
    "logo_url": "https://[supabase-url]/storage/v1/object/public/store-logos/lidl.webp",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Store not found
- `500 Internal Server Error`: Database error

---

#### 4.1.2 Categories

##### GET /api/categories

List all product categories with display order.

**Query Parameters:**
- None (returns all 12 predefined categories)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Nabiał i Jaja",
      "slug": "nabial-i-jaja",
      "display_order": 1,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "name": "Pieczywo i Cukiernia",
      "slug": "pieczywo-i-cukiernia",
      "display_order": 2,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error`: Database error

---

##### GET /api/categories/:slug

Get single category by slug.

**Path Parameters:**
- `slug` (string): Category slug (e.g., "nabial-i-jaja")

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Nabiał i Jaja",
    "slug": "nabial-i-jaja",
    "display_order": 1,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Category not found
- `500 Internal Server Error`: Database error

---

#### 4.1.3 Products (Public Search & Browse)

##### GET /api/products

Search and filter products using the `search_products` RPC function.

**Query Parameters:**
- `q` (string, optional): Search query (full-text + fuzzy search)
- `store` (string, optional): Filter by store slug
- `category` (string, optional): Filter by category slug
- `sort` (string, optional): Sort method
  - `relevance` (default if `q` provided)
  - `newest` (default if no `q`)
  - `price_asc`
  - `price_desc`
- `limit` (integer, optional): Results per page (default: 20, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response 200 OK:**
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

**Error Responses:**
- `400 Bad Request`: Invalid query parameters (e.g., limit > 100)
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- Uses `search_products()` RPC function from database
- Automatically filters expired flyers (via `v_active_products` view)
- Returns only published products
- Full-text search uses Polish dictionary
- Fuzzy search has 0.3 similarity threshold

---

##### GET /api/products/:id

Get detailed information for a single product.

**Path Parameters:**
- `id` (uuid): Product ID

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
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

**Error Responses:**
- `404 Not Found`: Product not found or not published
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- Query `v_active_products` view (automatically filters unpublished/expired)
- RLS policy ensures only published products are visible

---

##### GET /api/products/recent

Get recently added products for dashboard.

**Query Parameters:**
- `limit` (integer, optional): Number of products (default: 10, max: 50)

**Response 200 OK:**
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
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "store_logo": "https://[url]/store-logos/biedronka.webp",
      "valid_from": "2025-01-10",
      "valid_to": "2025-01-16",
      "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
      "created_at": "2025-01-09T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid limit parameter
- `500 Internal Server Error`: Database error

---

#### 4.1.4 Flyers (Public)

##### GET /api/flyers

List published, active flyers with optional store filter.

**Query Parameters:**
- `store` (string, optional): Filter by store slug
- `limit` (integer, optional): Results per page (default: 20, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response 200 OK:**
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

**Error Responses:**
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- RLS policy automatically filters to published, non-deleted flyers
- Additional filter: `valid_to >= CURRENT_DATE`

---

##### GET /api/flyers/:id

Get single flyer details with pages.

**Path Parameters:**
- `id` (uuid): Flyer ID

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "store_logo": "https://[url]/store-logos/biedronka.webp",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "created_at": "2025-01-09T10:00:00Z",
    "pages": [
      {
        "id": "uuid",
        "page_number": 1,
        "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-1.webp",
        "product_count": 24
      },
      {
        "id": "uuid",
        "page_number": 2,
        "web_image_url": "https://[url]/public_flyers/biedronka/2025-01-10/page-2.webp",
        "product_count": 18
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found`: Flyer not found or not published
- `500 Internal Server Error`: Database error

---

##### GET /api/flyers/:id/products

Get all products from a specific flyer.

**Path Parameters:**
- `id` (uuid): Flyer ID

**Query Parameters:**
- `limit` (integer, optional): Results per page (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response 200 OK:**
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

**Error Responses:**
- `404 Not Found`: Flyer not found or not published
- `500 Internal Server Error`: Database error

---

### 4.2 Admin Endpoints

All admin endpoints require authentication and admin role. Protected by Astro middleware checking session and profile role.

#### 4.2.1 Store Management (Admin)

##### POST /api/admin/stores

Create a new store.

**Authorization:** Admin only

**Request Body:**
```json
{
  "name": "Kaufland",
  "slug": "kaufland",
  "logo_file": "base64_encoded_image_or_file_upload"
}
```

**Response 201 Created:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Kaufland",
    "slug": "kaufland",
    "logo_url": "https://[url]/store-logos/kaufland.webp",
    "created_at": "2025-01-09T14:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data (missing fields, invalid slug format)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `409 Conflict`: Store name or slug already exists
- `500 Internal Server Error`: Database or storage error

**Validation Rules:**
- `name`: Required, 1-100 characters, unique
- `slug`: Required, lowercase, alphanumeric with hyphens, unique
- `logo_file`: Optional, valid image format (JPEG/PNG/WEBP), max 5MB

---

##### PUT /api/admin/stores/:id

Update an existing store.

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Store ID

**Request Body:**
```json
{
  "name": "Kaufland Plus",
  "slug": "kaufland-plus",
  "logo_file": "base64_encoded_image_or_file_upload"
}
```

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Kaufland Plus",
    "slug": "kaufland-plus",
    "logo_url": "https://[url]/store-logos/kaufland-plus.webp",
    "updated_at": "2025-01-09T15:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Store not found
- `409 Conflict`: Name or slug already exists
- `500 Internal Server Error`: Database or storage error

---

##### DELETE /api/admin/stores/:id

Delete a store (cascade deletes all associated flyers).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Store ID

**Response 204 No Content**

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Store not found
- `409 Conflict`: Cannot delete store with active flyers (optional business rule)
- `500 Internal Server Error`: Database error

---

#### 4.2.2 Flyer Management (Admin)

##### GET /api/admin/flyers

List all flyers (including drafts, expired, deleted) with filtering.

**Authorization:** Admin only

**Query Parameters:**
- `store` (string, optional): Filter by store slug
- `status` (string, optional): Filter by status (draft, processing, verification, published)
- `include_deleted` (boolean, optional): Include soft-deleted flyers (default: false)
- `limit` (integer, optional): Results per page (default: 20, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "uuid",
      "store_name": "Biedronka",
      "store_slug": "biedronka",
      "valid_from": "2025-01-10",
      "valid_to": "2025-01-16",
      "status": "verification",
      "page_count": 12,
      "verified_pages": 8,
      "deleted_at": null,
      "verified_by": "uuid",
      "verified_by_name": "Jan Kowalski",
      "created_at": "2025-01-09T10:00:00Z",
      "updated_at": "2025-01-09T12:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 45
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `500 Internal Server Error`: Database error

---

##### GET /api/admin/flyers/:id

Get detailed flyer information including all pages and processing status.

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer ID

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "store_id": "uuid",
    "store_name": "Biedronka",
    "store_slug": "biedronka",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "status": "verification",
    "deleted_at": null,
    "verified_by": "uuid",
    "verified_by_name": "Jan Kowalski",
    "created_at": "2025-01-09T10:00:00Z",
    "updated_at": "2025-01-09T12:30:00Z",
    "pages": [
      {
        "id": "uuid",
        "page_number": 1,
        "original_image_url": "https://[url]/raw_flyers/[path].jpg",
        "web_image_url": "https://[url]/public_flyers/[path].webp",
        "status": "published",
        "product_count": 24,
        "has_raw_ai_data": true,
        "error_message": null,
        "created_at": "2025-01-09T10:05:00Z",
        "updated_at": "2025-01-09T12:30:00Z"
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Flyer not found
- `500 Internal Server Error`: Database error

---

##### POST /api/admin/flyers

Create a new flyer with metadata (without uploading pages yet).

**Authorization:** Admin only

**Request Body:**
```json
{
  "store_id": "uuid",
  "valid_from": "2025-01-10",
  "valid_to": "2025-01-16"
}
```

**Response 201 Created:**
```json
{
  "data": {
    "id": "uuid",
    "store_id": "uuid",
    "store_name": "Biedronka",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "status": "draft",
    "created_at": "2025-01-09T10:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data (missing fields, invalid date range)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Store not found
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `store_id`: Required, must exist in stores table
- `valid_from`: Required, ISO 8601 date
- `valid_to`: Required, ISO 8601 date, must be >= valid_from
- Status automatically set to 'draft'

---

##### PATCH /api/admin/flyers/:id

Update flyer metadata or change status.

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer ID

**Request Body (all fields optional):**
```json
{
  "valid_from": "2025-01-11",
  "valid_to": "2025-01-17",
  "status": "published"
}
```

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "store_id": "uuid",
    "store_name": "Biedronka",
    "valid_from": "2025-01-11",
    "valid_to": "2025-01-17",
    "status": "published",
    "verified_by": "uuid",
    "updated_at": "2025-01-09T15:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data (invalid status transition, invalid date range)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Flyer not found
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `valid_from` / `valid_to`: If provided, must maintain valid_from <= valid_to
- `status`: Must be one of: draft, processing, verification, published
- When changing status to 'published', set `verified_by` to current admin's ID

---

##### DELETE /api/admin/flyers/:id

Soft delete a flyer (sets deleted_at timestamp).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer ID

**Response 204 No Content**

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Flyer not found
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- Sets `deleted_at` to current timestamp (soft delete)
- Flyer remains in database but filtered out of public queries
- Can be restored by setting `deleted_at` to NULL via PATCH endpoint

---

#### 4.2.3 Flyer Page Management (Admin)

##### POST /api/admin/flyers/:flyerId/pages

Upload one or more pages for a flyer.

**Authorization:** Admin only

**Path Parameters:**
- `flyerId` (uuid): Flyer ID

**Request Body (multipart/form-data):**
```
files: File[] (JPG, PNG, WEBP, max 10MB each)
```

**Response 201 Created:**
```json
{
  "data": {
    "flyer_id": "uuid",
    "uploaded_pages": [
      {
        "id": "uuid",
        "page_number": 1,
        "original_image_url": "https://[url]/raw_flyers/[path].jpg",
        "status": "draft",
        "created_at": "2025-01-09T10:30:00Z"
      },
      {
        "id": "uuid",
        "page_number": 2,
        "original_image_url": "https://[url]/raw_flyers/[path].jpg",
        "status": "draft",
        "created_at": "2025-01-09T10:30:05Z"
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid files (wrong format, too large, empty)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Flyer not found
- `413 Payload Too Large`: File exceeds 10MB
- `500 Internal Server Error`: Storage or database error

**Validation Rules:**
- File formats: JPG, PNG, WEBP only (check MIME type)
- File size: Max 10MB per file
- Files stored in `raw_flyers` bucket (private)
- Page numbers assigned sequentially based on existing pages
- Initial status: 'draft'

**Implementation Steps:**
1. Validate file formats and sizes
2. Upload original files to `raw_flyers` bucket with path: `{store_slug}/{flyer_id}/page-{n}-original.{ext}`
3. Convert to WebP (max 1000px width) and upload to `public_flyers` bucket with path: `{store_slug}/{flyer_id}/page-{n}.webp`
4. Create `flyer_pages` records with both paths
5. Return created page records

---

##### GET /api/admin/flyer-pages/:id

Get single page details including raw AI data.

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer page ID

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "flyer_id": "uuid",
    "page_number": 1,
    "original_image_url": "https://[url]/raw_flyers/[path].jpg",
    "web_image_url": "https://[url]/public_flyers/[path].webp",
    "status": "verification",
    "raw_ai_data": {
      "ocr_text": "Full extracted text...",
      "detected_products": [
        {
          "name": "Masło Extra",
          "price": "4.99",
          "unit": "200g",
          "bbox": {"x": 120, "y": 340, "width": 280, "height": 320},
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
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page not found
- `500 Internal Server Error`: Database error

---

##### POST /api/admin/flyer-pages/:id/process

Trigger AI processing (OCR + LLM) for a flyer page.

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer page ID

**Request Body (optional):**
```json
{
  "reprocess": false
}
```

**Response 202 Accepted:**
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
- `400 Bad Request`: Page already processed (unless reprocess=true)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page not found
- `500 Internal Server Error`: Database or AI service error

**Implementation Steps:**
1. Update page status to 'processing'
2. Fetch original image from `raw_flyers` bucket
3. Call OCR service (Openrouter.ai with vision model) to extract text and coordinates
4. Call LLM service (Openrouter.ai) to structure OCR text into JSON
5. Store result in `raw_ai_data` JSONB field
6. Create product records from structured data
7. Update page status to 'verification'
8. Handle errors: Set status to 'draft', store error in `error_message` field

**AI Processing Flow:**
```typescript
// Pseudo-code
async function processPage(pageId: string) {
  // Step 1: OCR
  const ocrResult = await openrouter.chat({
    model: "google/gemini-2.0-flash-exp:free",
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: originalImageUrl },
        { type: "text", text: aiOcrPrompt }
      ]
    }]
  })
  
  // Step 2: LLM Structuring
  const structuredData = await openrouter.chat({
    model: "anthropic/claude-3.5-sonnet",
    messages: [{
      role: "user",
      content: aiLlmPrompt + ocrResult.text
    }],
    response_format: { type: "json_object" }
  })
  
  // Step 3: Store and Create Products
  await updatePageRawAiData(pageId, {
    ocr_text: ocrResult.text,
    detected_products: structuredData.products
  })
  
  for (const product of structuredData.products) {
    await createProduct(pageId, product)
  }
}
```

---

##### PATCH /api/admin/flyer-pages/:id

Update page status manually (e.g., mark as verified).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer page ID

**Request Body:**
```json
{
  "status": "published"
}
```

**Response 200 OK:**
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
- `400 Bad Request`: Invalid status
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page not found
- `500 Internal Server Error`: Database error

---

##### DELETE /api/admin/flyer-pages/:id

Delete a flyer page (cascade deletes all products on the page).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Flyer page ID

**Response 204 No Content**

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page not found
- `500 Internal Server Error`: Database or storage error

**Implementation Notes:**
- Deletes files from both `raw_flyers` and `public_flyers` buckets
- Cascade deletes all associated products (via FK constraint)

---

#### 4.2.4 Product Management (Admin)

##### GET /api/admin/flyer-pages/:pageId/products

Get all products on a flyer page for verification.

**Authorization:** Admin only

**Path Parameters:**
- `pageId` (uuid): Flyer page ID

**Response 200 OK:**
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
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page not found
- `500 Internal Server Error`: Database error

---

##### POST /api/admin/flyer-pages/:pageId/products

Create a new product on a flyer page (manual addition).

**Authorization:** Admin only

**Path Parameters:**
- `pageId` (uuid): Flyer page ID

**Request Body:**
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

**Response 201 Created:**
```json
{
  "data": {
    "id": "uuid",
    "flyer_page_id": "uuid",
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
    "created_at": "2025-01-09T15:45:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data (validation errors)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Page or category not found
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `name`: Required, 1-200 characters
- `price`: Required, >= 0, max 2 decimal places
- `currency`: Optional, default 'PLN', must be 3-character code
- `unit`: Optional, max 20 characters
- `description`: Optional, max 500 characters
- `promo_conditions`: Optional, max 500 characters
- `category_id`: Required, must exist in categories table
- `bbox`: Optional, must have valid structure:
  - `x`, `y`, `width`, `height` all required if bbox provided
  - All values must be >= 0
  - `width` and `height` must be > 0

---

##### PUT /api/admin/products/:id

Update an existing product (during verification).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Product ID

**Request Body (all fields optional):**
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

**Response 200 OK:**
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
    "updated_at": "2025-01-09T16:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data (validation errors)
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Product or category not found
- `500 Internal Server Error`: Database error

**Validation Rules:** Same as POST product

---

##### DELETE /api/admin/products/:id

Delete a product (e.g., remove false positive from AI).

**Authorization:** Admin only

**Path Parameters:**
- `id` (uuid): Product ID

**Response 204 No Content**

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Product not found
- `500 Internal Server Error`: Database error

---

#### 4.2.5 Configuration Management (Admin)

##### GET /api/admin/config

Get all system configuration settings.

**Authorization:** Admin only

**Response 200 OK:**
```json
{
  "data": [
    {
      "key": "ai_ocr_prompt",
      "value": {
        "prompt": "Extract all text from this flyer page. Identify product names, prices, units, and their coordinates..."
      },
      "description": "Prompt for OCR extraction",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    {
      "key": "ai_llm_prompt",
      "value": {
        "prompt": "Structure the following OCR text into a JSON array of products with fields: name, price, unit, description..."
      },
      "description": "Prompt for LLM structuring",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `500 Internal Server Error`: Database error

---

##### GET /api/admin/config/:key

Get a single configuration value.

**Authorization:** Admin only

**Path Parameters:**
- `key` (string): Configuration key (e.g., "ai_ocr_prompt")

**Response 200 OK:**
```json
{
  "data": {
    "key": "ai_ocr_prompt",
    "value": {
      "prompt": "Extract all text from this flyer page..."
    },
    "description": "Prompt for OCR extraction",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `404 Not Found`: Configuration key not found
- `500 Internal Server Error`: Database error

---

##### PUT /api/admin/config/:key

Update or create a configuration value.

**Authorization:** Admin only

**Path Parameters:**
- `key` (string): Configuration key

**Request Body:**
```json
{
  "value": {
    "prompt": "Updated prompt text..."
  },
  "description": "Updated description"
}
```

**Response 200 OK:**
```json
{
  "data": {
    "key": "ai_ocr_prompt",
    "value": {
      "prompt": "Updated prompt text..."
    },
    "description": "Updated description",
    "updated_at": "2025-01-09T16:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid JSON in value field
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not admin role
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `key`: Required, 1-100 characters
- `value`: Required, must be valid JSON
- `description`: Optional, max 500 characters

---

#### 4.2.6 Profile Management (Admin)

##### GET /api/admin/profile

Get current admin's profile.

**Authorization:** Admin only

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@dealspy.com",
    "role": "admin",
    "full_name": "Jan Kowalski",
    "created_at": "2024-12-01T10:00:00Z",
    "updated_at": "2025-01-09T16:45:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Database error

**Implementation Notes:**
- Uses `auth.uid()` to fetch profile
- Email comes from Supabase Auth user

---

##### PATCH /api/admin/profile

Update current admin's profile (name only, role changes not allowed).

**Authorization:** Admin only

**Request Body:**
```json
{
  "full_name": "Jan Kowalski"
}
```

**Response 200 OK:**
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@dealspy.com",
    "role": "admin",
    "full_name": "Jan Kowalski",
    "updated_at": "2025-01-09T17:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Database error

**Validation Rules:**
- `full_name`: Optional, 1-100 characters
- Cannot change `role` field

---

## 5. Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "price",
        "message": "Price must be a positive number"
      },
      {
        "field": "category_id",
        "message": "Category not found"
      }
    ]
  }
}
```

### Standard Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Request data failed validation |
| 400 | `INVALID_DATE_RANGE` | valid_from must be <= valid_to |
| 400 | `INVALID_STATUS_TRANSITION` | Invalid status change |
| 401 | `UNAUTHORIZED` | Authentication required |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists (unique constraint) |
| 413 | `PAYLOAD_TOO_LARGE` | File size exceeds limit |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | External service (AI, storage) unavailable |

---

## 6. Validation & Business Logic

### 6.1 Validation Rules Summary

#### Stores
- `name`: Required, unique, 1-100 characters
- `slug`: Required, unique, lowercase alphanumeric with hyphens, 1-100 characters
- `logo_file`: Optional, JPG/PNG/WEBP, max 5MB

#### Categories
- `name`: Required, unique, 1-100 characters
- `slug`: Required, unique, lowercase alphanumeric with hyphens, 1-100 characters
- `display_order`: Integer, >= 0

#### Flyers
- `store_id`: Required, must exist
- `valid_from`: Required, ISO 8601 date
- `valid_to`: Required, ISO 8601 date, must be >= valid_from
- `status`: Must be one of: draft, processing, verification, published

#### Flyer Pages
- `flyer_id`: Required, must exist
- `page_number`: Required, > 0, unique per flyer
- `files`: JPG/PNG/WEBP only, max 10MB each

#### Products
- `flyer_page_id`: Required, must exist
- `category_id`: Required, must exist
- `name`: Required, 1-200 characters
- `price`: Required, >= 0, max 2 decimal places
- `currency`: Optional, default 'PLN', 3 characters
- `unit`: Optional, max 20 characters
- `description`: Optional, max 500 characters
- `promo_conditions`: Optional, max 500 characters
- `bbox`: Optional, but if provided:
  - Must include: x, y, width, height
  - x, y >= 0
  - width, height > 0

#### App Config
- `key`: Required, 1-100 characters
- `value`: Required, valid JSON
- `description`: Optional, max 500 characters

### 6.2 Business Logic Implementation

#### Flyer Status Lifecycle
```
draft -> processing -> verification -> published
```

- **draft**: Initial state after creation/upload
- **processing**: Automatically set when AI processing starts
- **verification**: Set after AI completes successfully
- **published**: Set by admin after verification (makes public)

**Transitions:**
- draft -> processing: Via POST /api/admin/flyer-pages/:id/process
- processing -> verification: Automatic after successful AI processing
- processing -> draft: Automatic after AI processing error
- verification -> published: Via PATCH /api/admin/flyers/:id
- Any state -> draft: Allowed for reprocessing

#### Soft Delete Strategy

Flyers use soft delete (`deleted_at` field):
- DELETE endpoint sets `deleted_at` to current timestamp
- Public queries filter `WHERE deleted_at IS NULL`
- Admin queries can include deleted with `include_deleted=true` parameter
- Restore by PATCH with `deleted_at: null`

#### Automatic Expiration

Products/flyers are automatically hidden when expired:
- Public endpoints use `v_active_products` view
- View includes filter: `valid_to >= CURRENT_DATE`
- No manual archiving needed
- Admin can still view expired flyers

#### Image Processing Pipeline

On flyer page upload:
1. Validate file (format, size)
2. Upload original to `raw_flyers` bucket (private)
   - Path: `{store_slug}/{flyer_id}/page-{n}-original.{ext}`
3. Convert to WebP (max 1000px width)
4. Upload WebP to `public_flyers` bucket (public)
   - Path: `{store_slug}/{flyer_id}/page-{n}.webp`
5. Store both paths in `flyer_pages` table

#### AI Processing Pipeline

On POST /api/admin/flyer-pages/:id/process:
1. Update status to 'processing'
2. Fetch original image from `raw_flyers`
3. Call OCR API (Openrouter.ai):
   - Model: google/gemini-2.0-flash-exp:free (vision)
   - Extract text and coordinates
4. Call LLM API (Openrouter.ai):
   - Model: anthropic/claude-3.5-sonnet
   - Structure OCR text to JSON
5. Store raw result in `raw_ai_data` field
6. Create product records from structured data
7. Update status to 'verification'
8. On error:
   - Set status back to 'draft'
   - Store error in `error_message` field

#### Search & Filtering

Public product search (GET /api/products):
- Uses `search_products()` RPC function
- Combines Full-Text Search (tsvector) and Fuzzy Search (pg_trgm)
- Relevance score: `ts_rank() + similarity() * 0.5`
- Filters applied: published status, not deleted, not expired
- Polish language dictionary for stemming
- Fuzzy similarity threshold: 0.3

#### Verification Workflow

1. Admin views flyer pages in verification status
2. For each page:
   - GET /api/admin/flyer-pages/:pageId/products
   - View split screen: original image + product list
3. Admin edits/adds/deletes products:
   - PUT /api/admin/products/:id (edit)
   - POST /api/admin/flyer-pages/:pageId/products (add)
   - DELETE /api/admin/products/:id (delete)
4. Admin approves page:
   - PATCH /api/admin/flyer-pages/:id with status='published'
5. When all pages verified, admin publishes flyer:
   - PATCH /api/admin/flyers/:id with status='published'

---

## 7. Performance Optimizations

### 7.1 Caching Strategy

**Static Resources:**
- Store logos: Cache-Control: public, max-age=31536000 (1 year)
- Flyer images (public_flyers): Cache-Control: public, max-age=604800 (1 week)

**API Responses:**
- GET /api/stores: Cache-Control: public, max-age=3600 (1 hour)
- GET /api/categories: Cache-Control: public, max-age=86400 (1 day)
- GET /api/products: Cache-Control: public, max-age=300 (5 minutes)
- GET /api/products/:id: Cache-Control: public, max-age=600 (10 minutes)

**Admin Endpoints:**
- No caching (Cache-Control: no-store)

### 7.2 Pagination Best Practices

- Default limit: 20 items
- Max limit: 100 items
- Use offset-based pagination for simplicity
- Return total count in pagination object

**Example Response:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 156,
    "has_more": true
  }
}
```

### 7.3 Database Optimizations

- Use `v_active_products` view for all public product queries
- Leverage BRIN indexes for date range queries
- Use GIN indexes for full-text and fuzzy search
- Batch product creation during AI processing

### 7.4 Image Optimization

- Convert all images to WebP format
- Max width: 1000px (maintain aspect ratio)
- Quality: 85 for public images
- Original images kept in private bucket for reprocessing

### 7.5 Rate Limiting

Recommended rate limits (per IP):
- Public endpoints: 100 requests/minute
- Admin endpoints: 300 requests/minute
- File upload: 20 requests/hour
- AI processing: 50 requests/hour

---

## 8. Security Considerations

### 8.1 Authentication Flow

1. Admin visits `/admin` route
2. If not authenticated, redirected to `/admin/login`
3. Admin submits email/password
4. Astro calls `supabase.auth.signInWithPassword()`
5. Supabase returns JWT token stored in httpOnly cookie
6. Subsequent requests include token
7. Middleware validates token and checks role

### 8.2 RLS Policy Enforcement

All database queries use Supabase client with user context:
- Public queries: Anonymous client (RLS enforces published-only access)
- Admin queries: Authenticated client with admin role

RLS policies automatically enforce:
- Public users: Read published/active resources only
- Admin users: Full CRUD on all resources

### 8.3 File Upload Security

1. **Validation:**
   - Check file MIME type (not just extension)
   - Verify file size <= 10MB
   - Scan for malicious content (optional)

2. **Storage:**
   - Use unique file names (UUID-based)
   - Segregate private/public storage
   - Set proper CORS headers

3. **Access Control:**
   - `raw_flyers` bucket: Admin only (via RLS)
   - `public_flyers` bucket: Public read (via RLS)

### 8.4 Input Sanitization

- Validate all input against expected types/formats
- Sanitize HTML in text fields (if rendered)
- Escape SQL inputs (Supabase client handles this)
- Validate JSON structure for JSONB fields

### 8.5 API Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

---

## 9. API Versioning

### Current Version: v1

All endpoints are implicitly version 1. Future breaking changes will use path-based versioning:
- Current: `/api/products`
- Future: `/api/v2/products`

Version 1 will be maintained for backwards compatibility for at least 12 months after v2 release.

---

## 10. Implementation Roadmap

### Phase 1: Core Public API (Week 1-2)
- [ ] GET /api/stores
- [ ] GET /api/categories
- [ ] GET /api/products (search & filter)
- [ ] GET /api/products/:id
- [ ] GET /api/products/recent
- [ ] GET /api/flyers

### Phase 2: Admin Authentication & Store Management (Week 2-3)
- [ ] Astro middleware for auth
- [ ] POST /api/admin/stores
- [ ] PUT /api/admin/stores/:id
- [ ] DELETE /api/admin/stores/:id

### Phase 3: Flyer Upload & Management (Week 3-4)
- [ ] POST /api/admin/flyers
- [ ] POST /api/admin/flyers/:flyerId/pages
- [ ] GET /api/admin/flyers
- [ ] GET /api/admin/flyers/:id
- [ ] PATCH /api/admin/flyers/:id
- [ ] DELETE /api/admin/flyers/:id

### Phase 4: AI Processing (Week 4-5)
- [ ] POST /api/admin/flyer-pages/:id/process
- [ ] OCR integration (Openrouter.ai)
- [ ] LLM integration (Openrouter.ai)
- [ ] Raw AI data storage
- [ ] Error handling & retry logic

### Phase 5: Verification & Product Management (Week 5-6)
- [ ] GET /api/admin/flyer-pages/:pageId/products
- [ ] POST /api/admin/flyer-pages/:pageId/products
- [ ] PUT /api/admin/products/:id
- [ ] DELETE /api/admin/products/:id
- [ ] PATCH /api/admin/flyer-pages/:id

### Phase 6: Configuration & Polish (Week 6-7)
- [ ] GET /api/admin/config
- [ ] PUT /api/admin/config/:key
- [ ] GET /api/admin/profile
- [ ] PATCH /api/admin/profile
- [ ] Rate limiting
- [ ] Comprehensive error handling
- [ ] API documentation (OpenAPI spec)

---

## 11. Testing Strategy

### Unit Tests
- Validation functions
- Business logic helpers
- Data transformation utilities

### Integration Tests
- Each API endpoint
- Authentication/authorization flows
- Database operations
- File upload/storage

### End-to-End Tests
- Complete flyer upload workflow
- AI processing pipeline
- Verification and publication flow
- Public search and browse

### Performance Tests
- Load testing for public endpoints
- Concurrent user simulation
- Database query performance
- Image processing throughput

---

## 12. Monitoring & Logging

### Metrics to Track
- Request rate per endpoint
- Response time (p50, p95, p99)
- Error rate by type
- AI processing success rate
- Storage usage (buckets)
- Database query performance

### Logging Strategy
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Include: timestamp, endpoint, user_id, request_id, duration
- Sensitive data: Redact passwords, tokens
- Error logs: Include stack trace, context

### Alerts
- Error rate > 5%
- Response time p95 > 2s
- AI processing failures > 20%
- Storage quota > 80%
- Database connection pool exhausted

---

## 13. Documentation

### API Documentation Format
- OpenAPI 3.0 specification
- Interactive documentation (Swagger UI)
- Code examples in TypeScript
- Hosted at `/api/docs`

### Admin Documentation
- User guide for flyer upload workflow
- Best practices for verification
- AI processing troubleshooting
- Configuration management guide

---

## Appendix A: Example Use Cases

### Use Case 1: User Searches for "masło"

1. User enters "masło" in search bar
2. Frontend calls: `GET /api/products?q=masło&sort=price_asc&limit=20`
3. API calls `search_products()` RPC function
4. Returns products sorted by price (ascending)
5. Frontend displays product cards with images

### Use Case 2: Admin Uploads New Flyer

1. Admin selects store, dates, files
2. Frontend calls: `POST /api/admin/flyers` with metadata
3. Receives flyer ID
4. Frontend calls: `POST /api/admin/flyers/{id}/pages` with files
5. API uploads to storage, creates page records
6. Admin triggers processing: `POST /api/admin/flyer-pages/{id}/process`
7. AI extracts products, creates records
8. Admin verifies products, makes corrections
9. Admin publishes: `PATCH /api/admin/flyers/{id}` with status='published'

### Use Case 3: User Views Product Details

1. User clicks product card
2. Frontend calls: `GET /api/products/{id}`
3. API returns product data with image URL
4. Frontend displays modal with:
   - Cropped flyer image (using bbox)
   - Product details
   - Store, price, validity dates

---

## Appendix B: Database Query Examples

### Get Active Products with Full Details
```sql
SELECT * FROM v_active_products
WHERE name_tsvector @@ plainto_tsquery('polish', 'masło')
ORDER BY price ASC
LIMIT 20;
```

### Search Products Using RPC
```sql
SELECT * FROM search_products(
  'masło',
  'biedronka',
  'nabial-i-jaja',
  'price_asc',
  20,
  0
);
```

### Get Flyers for Verification
```sql
SELECT f.*, s.name AS store_name,
  COUNT(fp.id) AS page_count,
  COUNT(fp.id) FILTER (WHERE fp.status = 'published') AS verified_pages
FROM flyers f
JOIN stores s ON f.store_id = s.id
LEFT JOIN flyer_pages fp ON f.id = fp.flyer_id
WHERE f.status = 'verification'
  AND f.deleted_at IS NULL
GROUP BY f.id, s.name
ORDER BY f.created_at DESC;
```

---

## Appendix C: AI Prompt Templates

### OCR Prompt (stored in app_config)
```
Extract all visible text from this promotional flyer page. For each product you identify:

1. Product name (full text as shown)
2. Price (numerical value with decimal separator)
3. Unit of measure (e.g., kg, szt, l)
4. Any promotional conditions or restrictions
5. Bounding box coordinates (x, y, width, height) for the product area

Return the extracted text in a structured format that preserves spatial relationships between elements.
```

### LLM Structuring Prompt (stored in app_config)
```
Structure the following OCR-extracted text from a promotional flyer into a JSON array of products.

For each product, extract:
- name: Full product name
- price: Numerical price value
- unit: Unit of measure
- description: Any additional descriptive text
- promo_conditions: Promotional conditions or restrictions
- bbox: Bounding box coordinates {x, y, width, height}

Guidelines:
- Prices should be numerical values (use decimal point)
- If unit is missing, try to infer from context or use "szt"
- Combine related text into single product entries
- Ignore header/footer text and store branding
- If coordinates are approximate, provide best estimate

Return valid JSON only, no additional text.

OCR Text:
{ocr_text}
```

---

This comprehensive API plan provides a solid foundation for implementing the DealSpy MVP. The plan prioritizes security through Supabase RLS, performance through caching and optimized queries, and maintainability through clear separation of concerns and consistent error handling.

