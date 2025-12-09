import type { APIRoute } from "astro";
import { z } from "zod";
import { StoreService } from "@/lib/services/store.service";
import { storeSlugParamSchema } from "@/lib/schemas/store.schema";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";

/**
 * Wyłącz pre-rendering dla tego endpointa
 */
export const prerender = false;

/**
 * GET /api/stores/:slug
 *
 * Zwraca szczegóły pojedynczego sklepu
 *
 * Endpoint jest publiczny - nie wymaga autoryzacji
 *
 * URL Parameters:
 * - slug (string, required) - URL-friendly identyfikator sklepu
 *   Format: lowercase letters, numbers, hyphens only
 *   Example: "biedronka", "lidl-plus"
 *
 * Response format (200 OK):
 * {
 *   "data": {
 *     "id": "uuid",
 *     "name": "Biedronka",
 *     "slug": "biedronka",
 *     "logo_url": "https://...",
 *     "created_at": "2025-01-01T00:00:00.000Z"
 *   }
 * }
 *
 * Error responses:
 * - 400 VALIDATION_ERROR - nieprawidłowy format slug
 * - 404 NOT_FOUND - sklep o podanym slug nie istnieje
 * - 500 INTERNAL_SERVER_ERROR - błąd bazy danych lub serwera
 *
 * @param context - Astro API context
 * @param context.params - URL parameters (zawiera slug)
 * @param context.locals - Request locals (zawiera supabase)
 * @returns Response - HTTP response z JSON
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    let validatedParams;
    try {
      validatedParams = storeSlugParamSchema.parse({
        slug: params.slug,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid store slug format", 400, details);
      }
      throw error;
    }

    const { slug } = validatedParams;
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const storeService = new StoreService(supabase);
    const store = await storeService.getStoreBySlug(slug);

    if (!store) {
      return createErrorResponse("NOT_FOUND", "Store not found", 404);
    }

    return createSuccessResponse(store, 200, 600);
  } catch (error) {
    console.error(`Error in GET /api/stores/${params.slug}:`, error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch store", 500);
  }
};
