# API Endpoint Implementation Plan: Configuration & Profile Management (Admin)

## 1. Przegląd punktów końcowych

Ten plan obejmuje implementację 5 endpointów administracyjnych dla zarządzania konfiguracją systemową i profilami użytkowników:

### Configuration Management
- **GET /api/admin/config** - Pobieranie wszystkich ustawień konfiguracyjnych systemu
- **GET /api/admin/config/:key** - Pobieranie pojedynczego ustawienia konfiguracyjnego
- **PUT /api/admin/config/:key** - Aktualizacja lub utworzenie ustawienia konfiguracyjnego

### Profile Management
- **GET /api/admin/profile** - Pobieranie profilu aktualnie zalogowanego admina
- **PATCH /api/admin/profile** - Aktualizacja profilu aktualnie zalogowanego admina

Wszystkie endpointy wymagają autentykacji i roli administratora. Służą do zarządzania kluczowymi parametrami systemowymi (np. prompty AI) oraz danymi profilu administratora.

---

## 2. Szczegóły żądań

### 2.1. GET /api/admin/config

**Metoda HTTP:** GET  
**Struktura URL:** `/api/admin/config`  
**Parametry:**
- Wymagane: brak
- Opcjonalne: brak
**Request Body:** brak  
**Authorization:** Admin only (middleware sprawdza role)

### 2.2. GET /api/admin/config/:key

**Metoda HTTP:** GET  
**Struktura URL:** `/api/admin/config/:key`  
**Parametry:**
- Wymagane:
  - `key` (string, path parameter): Klucz konfiguracji (np. "ai_ocr_prompt")
- Opcjonalne: brak
**Request Body:** brak  
**Authorization:** Admin only

### 2.3. PUT /api/admin/config/:key

**Metoda HTTP:** PUT  
**Struktura URL:** `/api/admin/config/:key`  
**Parametry:**
- Wymagane:
  - `key` (string, path parameter): Klucz konfiguracji
  - `value` (JSONB, body): Wartość konfiguracji w formacie JSON
- Opcjonalne:
  - `description` (string, body): Opis parametru konfiguracyjnego (max 500 znaków)
**Request Body:**
```json
{
  "value": {
    "prompt": "Updated prompt text..."
  },
  "description": "Updated description"
}
```
**Authorization:** Admin only

### 2.4. GET /api/admin/profile

**Metoda HTTP:** GET  
**Struktura URL:** `/api/admin/profile`  
**Parametry:**
- Wymagane: brak
- Opcjonalne: brak
**Request Body:** brak  
**Authorization:** Admin only (używa `auth.uid()` z contextu)

### 2.5. PATCH /api/admin/profile

**Metoda HTTP:** PATCH  
**Struktura URL:** `/api/admin/profile`  
**Parametry:**
- Wymagane: brak (wszystkie pola opcjonalne)
- Opcjonalne:
  - `full_name` (string, body): Pełna nazwa użytkownika (1-100 znaków)
**Request Body:**
```json
{
  "full_name": "Jan Kowalski"
}
```
**Authorization:** Admin only  
**Uwaga:** Nie można zmieniać pola `role` przez ten endpoint

---

## 3. Wykorzystywane typy

### 3.1. Istniejące typy z src/types.ts

**DTOs:**
- `ConfigDTO` - reprezentacja elementu konfiguracji
- `ProfileDTO` - reprezentacja profilu admina

**Command Models:**
- `UpdateConfigCommand` - dane do aktualizacji konfiguracji
- `UpdateProfileCommand` - dane do aktualizacji profilu

**Pomocnicze:**
- `ApiResponse<T>` - wrapper dla response
- `ApiError` - format błędu
- `ErrorCode` - kody błędów

### 3.2. Typy do wykorzystania w implementacji

```typescript
// Response types
type ConfigListResponse = ApiResponse<ConfigDTO[]>;
type ConfigDetailResponse = ApiResponse<ConfigDTO>;
type ProfileResponse = ApiResponse<ProfileDTO>;

// Database types
type AppConfig = Tables<"app_config">;
type Profile = Tables<"profiles">;
```

---

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/admin/config

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "key": "ai_ocr_prompt",
      "value": {
        "prompt": "Extract all text from this flyer page..."
      },
      "description": "Prompt for OCR extraction",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    {
      "key": "ai_llm_prompt",
      "value": {
        "prompt": "Structure the following OCR text..."
      },
      "description": "Prompt for LLM structuring",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Brak autentykacji
- `403 Forbidden` - Brak roli admin
- `500 Internal Server Error` - Błąd bazy danych

### 4.2. GET /api/admin/config/:key

**Success Response (200 OK):**
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
- `401 Unauthorized` - Brak autentykacji
- `403 Forbidden` - Brak roli admin
- `404 Not Found` - Klucz konfiguracji nie istnieje
- `500 Internal Server Error` - Błąd bazy danych

### 4.3. PUT /api/admin/config/:key

**Success Response (200 OK):**
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
- `400 Bad Request` - Nieprawidłowy JSON w polu value lub nieprawidłowa walidacja
- `401 Unauthorized` - Brak autentykacji
- `403 Forbidden` - Brak roli admin
- `500 Internal Server Error` - Błąd bazy danych

### 4.4. GET /api/admin/profile

**Success Response (200 OK):**
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
- `401 Unauthorized` - Brak autentykacji
- `404 Not Found` - Profil nie istnieje (edge case)
- `500 Internal Server Error` - Błąd bazy danych

### 4.5. PATCH /api/admin/profile

**Success Response (200 OK):**
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
- `400 Bad Request` - Nieprawidłowa walidacja (np. zbyt długa nazwa)
- `401 Unauthorized` - Brak autentykacji
- `500 Internal Server Error` - Błąd bazy danych

---

## 5. Przepływ danych

### 5.1. GET /api/admin/config

```
Request → Middleware (auth check) → Endpoint Handler
                                          ↓
                                   ConfigService.getAllConfigs()
                                          ↓
                                   Supabase: SELECT * FROM app_config
                                          ↓
                                   Transform to ConfigDTO[]
                                          ↓
                                   Return ApiResponse<ConfigDTO[]>
```

### 5.2. GET /api/admin/config/:key

```
Request → Middleware (auth check) → Endpoint Handler
                                          ↓
                                   Validate :key parameter
                                          ↓
                                   ConfigService.getConfigByKey(key)
                                          ↓
                                   Supabase: SELECT * FROM app_config WHERE key = ?
                                          ↓
                                   Check if exists (404 if not)
                                          ↓
                                   Transform to ConfigDTO
                                          ↓
                                   Return ApiResponse<ConfigDTO>
```

### 5.3. PUT /api/admin/config/:key

```
Request → Middleware (auth check) → Endpoint Handler
                                          ↓
                                   Validate :key and body (Zod)
                                          ↓
                                   ConfigService.upsertConfig(key, data)
                                          ↓
                                   Supabase: INSERT INTO app_config ... ON CONFLICT (key) DO UPDATE
                                          ↓
                                   Transform to ConfigDTO
                                          ↓
                                   Return ApiResponse<ConfigDTO>
```

### 5.4. GET /api/admin/profile

```
Request → Middleware (auth check) → Endpoint Handler
                                          ↓
                                   Get user ID from context.locals.supabase.auth.getUser()
                                          ↓
                                   ProfileService.getProfileById(userId) OR inline query
                                          ↓
                                   Supabase: SELECT * FROM profiles WHERE id = ?
                                   JOIN with auth.users for email
                                          ↓
                                   Transform to ProfileDTO
                                          ↓
                                   Return ApiResponse<ProfileDTO>
```

### 5.5. PATCH /api/admin/profile

```
Request → Middleware (auth check) → Endpoint Handler
                                          ↓
                                   Validate body (Zod)
                                          ↓
                                   Get user ID from context.locals.supabase.auth.getUser()
                                          ↓
                                   ProfileService.updateProfile(userId, data) OR inline query
                                          ↓
                                   Supabase: UPDATE profiles SET ... WHERE id = ?
                                          ↓
                                   Fetch updated profile with email
                                          ↓
                                   Transform to ProfileDTO
                                          ↓
                                   Return ApiResponse<ProfileDTO>
```

---

## 6. Względy bezpieczeństwa

### 6.1. Autentykacja i Autoryzacja

**Middleware (src/middleware/index.ts):**
- Wszystkie endpointy wymagają autentykacji przez Supabase Auth
- Middleware sprawdza, czy użytkownik jest zalogowany
- Middleware sprawdza, czy użytkownik ma rolę `admin` w tabeli `profiles`
- Jeśli warunki nie są spełnione, zwraca 401 lub 403

**Implementacja:**
```typescript
// Przykładowa logika w middleware
const { data: { user } } = await context.locals.supabase.auth.getUser();
if (!user) {
  return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }), { status: 401 });
}

const { data: profile } = await context.locals.supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'admin') {
  return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Admin role required" } }), { status: 403 });
}
```

### 6.2. Walidacja danych wejściowych

**PUT /api/admin/config/:key:**
- `key`: 1-100 znaków, string
- `value`: musi być prawidłowym obiektem JSON (JSONB)
- `description`: opcjonalne, max 500 znaków

**PATCH /api/admin/profile:**
- `full_name`: opcjonalne, 1-100 znaków
- Sprawdzenie, czy nie próbuje się zmienić pola `role` (ignorowanie lub błąd)

**Schemat Zod (do utworzenia):**
```typescript
// src/lib/schemas/config.schema.ts
export const updateConfigSchema = z.object({
  value: z.record(z.unknown()),
  description: z.string().max(500).optional(),
});

export const configKeySchema = z.string().min(1).max(100);

// src/lib/schemas/profile.schema.ts (jeśli nie istnieje)
export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
});
```

### 6.3. SQL Injection

- Używamy Supabase client, który automatycznie sanityzuje zapytania
- Wszystkie parametry przekazywane przez `.eq()`, `.insert()`, `.update()` są bezpieczne

### 6.4. JSON Injection

- Pole `value` w app_config jest typu JSONB
- PostgreSQL automatycznie waliduje JSON przed zapisem
- Dodatkowo, Zod schema sprawdza, czy wartość jest obiektem

### 6.5. Rate Limiting

- Należy rozważyć dodanie rate limitingu dla endpointów admin (opcjonalne)
- Można to zaimplementować w middleware lub za pomocą zewnętrznej biblioteki

---

## 7. Obsługa błędów

### 7.1. Wspólne błędy dla wszystkich endpointów

| Kod | Scenariusz | Response Body |
|-----|------------|---------------|
| 401 | Brak tokenu auth lub nieprawidłowy token | `{ "error": { "code": "UNAUTHORIZED", "message": "Not authenticated" } }` |
| 403 | Użytkownik nie ma roli admin | `{ "error": { "code": "FORBIDDEN", "message": "Admin role required" } }` |
| 500 | Błąd bazy danych lub inny błąd serwera | `{ "error": { "code": "INTERNAL_SERVER_ERROR", "message": "An error occurred" } }` |

### 7.2. Błędy specyficzne dla endpointów

**GET /api/admin/config/:key:**
- `404 Not Found` - Klucz konfiguracji nie istnieje w bazie danych

**PUT /api/admin/config/:key:**
- `400 Bad Request` - Nieprawidłowy format JSON w polu `value`
- `400 Bad Request` - Walidacja Zod nie przeszła (np. zbyt długi opis)

**PATCH /api/admin/profile:**
- `400 Bad Request` - Walidacja Zod nie przeszła (np. zbyt długa nazwa)
- `404 Not Found` - Profil użytkownika nie istnieje (edge case, nie powinno się zdarzyć)

### 7.3. Implementacja obsługi błędów

**Helper funkcja (src/lib/helpers/api-response.helper.ts):**

Sprawdzić, czy istnieje funkcja do obsługi błędów. Jeśli nie, należy ją utworzyć:

```typescript
export function handleError(error: unknown): Response {
  console.error('API Error:', error);
  
  // Zod validation error
  if (error instanceof z.ZodError) {
    return new Response(JSON.stringify({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  
  // Supabase error
  if (error && typeof error === 'object' && 'code' in error) {
    // Handle specific Supabase errors
  }
  
  // Default error
  return new Response(JSON.stringify({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred"
    }
  }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
```

---

## 9. Etapy wdrożenia

### 9.1. Przygotowanie - Schematy walidacji

1. **Utworzyć plik `src/lib/schemas/config.schema.ts`:**
   ```typescript
   import { z } from "zod";

   export const configKeySchema = z.string().min(1).max(100);

   export const updateConfigSchema = z.object({
     value: z.record(z.unknown()),
     description: z.string().max(500).optional(),
   });
   ```

2. **Sprawdzić/utworzyć `src/lib/schemas/profile.schema.ts`:**
   ```typescript
   import { z } from "zod";

   export const updateProfileSchema = z.object({
     full_name: z.string().min(1).max(100).optional(),
   });
   ```

### 9.2. Przygotowanie - Service Layer

3. **Utworzyć plik `src/lib/services/config.service.ts`:**
   ```typescript
   import type { SupabaseClient } from "../db/supabase.client";
   import type { ConfigDTO, UpdateConfigCommand } from "../types";

   export class ConfigService {
     constructor(private supabase: SupabaseClient) {}

     async getAllConfigs(): Promise<ConfigDTO[]> {
       const { data, error } = await this.supabase
         .from("app_config")
         .select("*")
         .order("key");

       if (error) throw error;
       return data as ConfigDTO[];
     }

     async getConfigByKey(key: string): Promise<ConfigDTO | null> {
       const { data, error } = await this.supabase
         .from("app_config")
         .select("*")
         .eq("key", key)
         .single();

       if (error) {
         if (error.code === "PGRST116") return null; // Not found
         throw error;
       }
       return data as ConfigDTO;
     }

     async upsertConfig(
       key: string,
       command: UpdateConfigCommand
     ): Promise<ConfigDTO> {
       const { data, error } = await this.supabase
         .from("app_config")
         .upsert({
           key,
           value: command.value,
           description: command.description,
         })
         .select()
         .single();

       if (error) throw error;
       return data as ConfigDTO;
     }
   }
   ```

4. **Opcjonalnie utworzyć `src/lib/services/profile.service.ts`** (może być też inline w endpointach):
   ```typescript
   import type { SupabaseClient } from "../db/supabase.client";
   import type { ProfileDTO, UpdateProfileCommand } from "../types";

   export class ProfileService {
     constructor(private supabase: SupabaseClient) {}

     async getProfileByIdWithEmail(userId: string, email: string): Promise<ProfileDTO> {
       const { data, error } = await this.supabase
         .from("profiles")
         .select("*")
         .eq("id", userId)
         .single();

       if (error) throw error;
       
       return {
         id: data.id,
         email: email,
         role: data.role,
         full_name: data.full_name,
         created_at: data.created_at,
         updated_at: data.updated_at,
       } as ProfileDTO;
     }

     async updateProfile(
       userId: string,
       command: UpdateProfileCommand
     ): Promise<void> {
       const { error } = await this.supabase
         .from("profiles")
         .update({
           full_name: command.full_name,
         })
         .eq("id", userId);

       if (error) throw error;
     }
   }
   ```

### 9.3. Implementacja endpointów - Configuration

5. **Utworzyć katalog i plik `src/pages/api/admin/config/index.ts`:**
   ```typescript
   import type { APIRoute } from "astro";
   import { ConfigService } from "../../../../lib/services/config.service";
   import { successResponse, errorResponse } from "../../../../lib/helpers/api-response.helper";

   export const prerender = false;

   export const GET: APIRoute = async (context) => {
     try {
       const configService = new ConfigService(context.locals.supabase);
       const configs = await configService.getAllConfigs();
       
       return successResponse(configs);
     } catch (error) {
       return errorResponse(error);
     }
   };
   ```

6. **Utworzyć plik `src/pages/api/admin/config/[key].ts`:**
   ```typescript
   import type { APIRoute } from "astro";
   import { ConfigService } from "../../../../lib/services/config.service";
   import { configKeySchema, updateConfigSchema } from "../../../../lib/schemas/config.schema";
   import { successResponse, errorResponse, notFoundResponse } from "../../../../lib/helpers/api-response.helper";

   export const prerender = false;

   export const GET: APIRoute = async (context) => {
     try {
       const key = context.params.key;
       if (!key) {
         return errorResponse(new Error("Key parameter is required"), 400);
       }

       const validatedKey = configKeySchema.parse(key);
       const configService = new ConfigService(context.locals.supabase);
       const config = await configService.getConfigByKey(validatedKey);

       if (!config) {
         return notFoundResponse("Configuration key not found");
       }

       return successResponse(config);
     } catch (error) {
       return errorResponse(error);
     }
   };

   export const PUT: APIRoute = async (context) => {
     try {
       const key = context.params.key;
       if (!key) {
         return errorResponse(new Error("Key parameter is required"), 400);
       }

       const validatedKey = configKeySchema.parse(key);
       const body = await context.request.json();
       const validatedBody = updateConfigSchema.parse(body);

       const configService = new ConfigService(context.locals.supabase);
       const config = await configService.upsertConfig(validatedKey, validatedBody);

       return successResponse(config);
     } catch (error) {
       return errorResponse(error);
     }
   };
   ```

### 9.4. Implementacja endpointów - Profile

7. **Utworzyć plik `src/pages/api/admin/profile.ts`:**
   ```typescript
   import type { APIRoute } from "astro";
   import { ProfileService } from "../../../lib/services/profile.service";
   import { updateProfileSchema } from "../../../lib/schemas/profile.schema";
   import { successResponse, errorResponse } from "../../../lib/helpers/api-response.helper";

   export const prerender = false;

   export const GET: APIRoute = async (context) => {
     try {
       const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();
       
       if (authError || !user) {
         return new Response(
           JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
           { status: 401, headers: { "Content-Type": "application/json" } }
         );
       }

       const profileService = new ProfileService(context.locals.supabase);
       const profile = await profileService.getProfileByIdWithEmail(user.id, user.email!);

       return successResponse(profile);
     } catch (error) {
       return errorResponse(error);
     }
   };

   export const PATCH: APIRoute = async (context) => {
     try {
       const { data: { user }, error: authError } = await context.locals.supabase.auth.getUser();
       
       if (authError || !user) {
         return new Response(
           JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
           { status: 401, headers: { "Content-Type": "application/json" } }
         );
       }

       const body = await context.request.json();
       const validatedBody = updateProfileSchema.parse(body);

       const profileService = new ProfileService(context.locals.supabase);
       await profileService.updateProfile(user.id, validatedBody);

       // Fetch updated profile
       const profile = await profileService.getProfileByIdWithEmail(user.id, user.email!);

       return successResponse(profile);
     } catch (error) {
       return errorResponse(error);
     }
   };
   ```

### 9.5. Aktualizacja helpera dla response

8. **Sprawdzić/zaktualizować `src/lib/helpers/api-response.helper.ts`:**
   - Upewnić się, że istnieją funkcje: `successResponse()`, `errorResponse()`, `notFoundResponse()`
   - Jeśli nie istnieją, dodać je zgodnie z przykładami w sekcji 7.3


### 9.8. Deployment considerations

12. **Przed deploymentem:**
    - Sprawdzić, czy tabela `app_config` zawiera dane inicjalne (prompty AI)
    - Sprawdzić, czy middleware sprawdza rolę admin
    - Upewnić się, że zmienne środowiskowe Supabase są poprawnie skonfigurowane

---
