import type { APIRoute } from "astro";
import { z } from "zod";
import { FlyerService } from "@/lib/services/flyer.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerListParamsSchema } from "@/lib/schemas/flyer.schema";

export const prerender = false;

/**
 * GET /api/flyers
 *
 * Zwraca listę aktywnych, opublikowanych gazetek promocyjnych
 *
 * Query params:
 * - store (optional): slug sklepu do filtrowania
 * - limit (optional, default 20): liczba wyników na stronę
 * - offset (optional, default 0): przesunięcie dla paginacji
 *
 * Response 200:
 * {
 *   "data": FlyerListItemDTO[],
 *   "pagination": {
 *     "limit": 20,
 *     "offset": 0,
 *     "total": 5,
 *     "has_more": false
 *   }
 * }
 *
 * Response 400: Błąd walidacji parametrów
 * Response 500: Błąd serwera
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const queryParams = Object.fromEntries(url.searchParams);

    let params;
    try {
      params = flyerListParamsSchema.parse(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
      }
      throw error;
    }

    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const flyerService = new FlyerService(supabase);
    const { flyers, total } = await flyerService.listFlyers(params);

    const pagination = {
      limit: params.limit,
      offset: params.offset,
      total,
      has_more: params.offset + params.limit < total,
    };

    return createSuccessResponse(flyers, 200, pagination, 300);
  } catch (error) {
    console.error("Error in GET /api/flyers:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to list flyers", 500);
  }
};
