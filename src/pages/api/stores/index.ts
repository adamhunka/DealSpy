import type { APIRoute } from "astro";
import { StoreService } from "@/lib/services/store.service";
import { createErrorResponse, createSuccessResponse } from "@/lib/helpers/api-response.helper";

/**
 * Wyłącz pre-rendering dla tego endpointa
 *
 * Bez tego Astro spróbuje wygenerować statyczny plik w build time
 * API routes muszą działać dynamicznie w runtime
 */
export const prerender = false;

/**
 * GET /api/stores
 *
 * Zwraca listę wszystkich sklepów z logo
 *
 * Endpoint jest publiczny - nie wymaga autoryzacji
 *
 * Response format:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "name": "Biedronka",
 *       "slug": "biedronka",
 *       "logo_url": "https://...",
 *       "created_at": "2025-01-01T00:00:00.000Z"
 *     }
 *   ]
 * }
 *
 * Error responses:
 * - 500 INTERNAL_SERVER_ERROR - błąd bazy danych lub serwera
 *
 * @param context - Astro API context (zawiera locals, request, etc.)
 * @returns Response - HTTP response z JSON
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const storeService = new StoreService(supabase);
    const stores = await storeService.getAllStores();

    return createSuccessResponse(stores, 200, 300);
  } catch (error) {
    console.error("Error in GET /api/stores:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch stores", 500);
  }
};
