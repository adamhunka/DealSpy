import type { APIRoute } from "astro";
import { z } from "zod";
import { ConfigService } from "@/lib/services/config.service";
import { configKeySchema, updateConfigSchema } from "@/lib/schemas/config.schema";
import { createSuccessResponse, createErrorResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";

/**
 * GET /api/admin/config/:key
 *
 * Pobiera pojedyncze ustawienie konfiguracyjne po kluczu
 *
 * Authorization: Admin only (sprawdzane przez checkAdminAccess)
 *
 * Path params:
 * - key: string (1-100 znaków)
 *
 * Response:
 * - 200: ApiResponse<ConfigDTO>
 * - 400: Bad Request (nieprawidłowy klucz)
 * - 401: Unauthorized (brak autentykacji)
 * - 403: Forbidden (brak roli admin)
 * - 404: Not Found (klucz nie istnieje)
 * - 500: Internal Server Error
 */

export const prerender = false;

export const GET: APIRoute = async (context) => {
  // Sprawdzenie uprawnień admin
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);

  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    const key = context.params.key;
    if (!key) {
      return createErrorResponse("VALIDATION_ERROR", "Key parameter is required", 400);
    }

    // Walidacja klucza
    const validatedKey = configKeySchema.parse(key);

    const configService = new ConfigService(context.locals.supabase);
    const config = await configService.getConfigByKey(validatedKey);

    if (!config) {
      return createErrorResponse("NOT_FOUND", "Configuration key not found", 404);
    }

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Error fetching config by key:", error);

    // Obsługa błędów walidacji Zod
    if (error instanceof z.ZodError) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid key parameter", 400, formatZodErrors(error));
    }

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch configuration", 500);
  }
};

/**
 * PUT /api/admin/config/:key
 *
 * Tworzy lub aktualizuje ustawienie konfiguracyjne
 *
 * Authorization: Admin only (sprawdzane przez checkAdminAccess)
 *
 * Path params:
 * - key: string (1-100 znaków)
 *
 * Request body:
 * - value: Record<string, unknown> (obiekt JSONB)
 * - description: string | undefined (max 500 znaków, opcjonalne)
 *
 * Response:
 * - 200: ApiResponse<ConfigDTO>
 * - 400: Bad Request (nieprawidłowa walidacja)
 * - 401: Unauthorized (brak autentykacji)
 * - 403: Forbidden (brak roli admin)
 * - 500: Internal Server Error
 */

export const PUT: APIRoute = async (context) => {
  // Sprawdzenie uprawnień admin
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);

  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    const key = context.params.key;
    if (!key) {
      return createErrorResponse("VALIDATION_ERROR", "Key parameter is required", 400);
    }

    // Walidacja klucza
    const validatedKey = configKeySchema.parse(key);

    // Parsowanie i walidacja body
    let body;
    try {
      body = await context.request.json();
    } catch {
      return createErrorResponse("VALIDATION_ERROR", "Invalid JSON in request body", 400);
    }

    const validatedBody = updateConfigSchema.parse(body);

    const configService = new ConfigService(context.locals.supabase);
    const config = await configService.upsertConfig(validatedKey, validatedBody);

    return createSuccessResponse(config);
  } catch (error) {
    console.error("Error upserting config:", error);

    // Obsługa błędów walidacji Zod
    if (error instanceof z.ZodError) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request data", 400, formatZodErrors(error));
    }

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to update configuration", 500);
  }
};
