import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerPageIdParamsSchema, processFlyerPageSchema } from "@/lib/schemas/flyer.schema";
import { FlyerService } from "@/lib/services/flyer.service";
import { AIService } from "@/lib/services/ai.service";
import type { ProcessPageResponse } from "@/types";

export const prerender = false;

/**
 * POST /api/admin/flyer-pages/:id/process
 *
 * Uruchamia przetwarzanie AI strony gazetki
 *
 * Proces jest ASYNCHRONICZNY:
 * - Endpoint zwraca 202 Accepted natychmiast
 * - AI processing działa w tle
 * - Klient może poll'ować status przez GET /api/admin/flyer-pages/:id
 */
export const POST: APIRoute = async ({ params, locals, request }) => {
  // 1. Autoryzacja
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  // 2. Walidacja ID
  const pageId = params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });

  if (!validation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid page ID format", 400, formatZodErrors(validation.error));
  }

  // 3. Parse i waliduj body
  const body = await request.json();
  const bodyValidation = processFlyerPageSchema.safeParse(body);

  if (!bodyValidation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400, formatZodErrors(bodyValidation.error));
  }

  const { reprocess } = bodyValidation.data;

  // 4. Pobierz stronę
  const flyerService = new FlyerService(locals.supabase);
  const page = await flyerService.getFlyerPageById(validation.data.id);

  if (!page) {
    return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
  }

  // 5. Sprawdź czy można przetworzyć
  /**
   * Logika biznesowa:
   * - Jeśli reprocess=false, nie przetwarzaj stron w statusie 'verification' lub 'published'
   * - Jeśli reprocess=true, przetwarzaj zawsze (nawet published)
   */
  if (!reprocess && ["verification", "published"].includes(page.status)) {
    return createErrorResponse(
      "INVALID_STATUS_TRANSITION",
      "Page already processed. Use reprocess=true to process again.",
      400
    );
  }

  // 6. Sprawdź API key
  const apiKey = import.meta.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error("OPENROUTER_API_KEY not configured");
    return createErrorResponse("INTERNAL_SERVER_ERROR", "AI service not configured", 500);
  }

  // 7. Trigger AI processing (async - fire and forget)
  /**
   * WAŻNE: NIE czekamy na zakończenie AI!
   *
   * Zwracamy 202 Accepted natychmiast, a processing działa w tle.
   *
   * Dlaczego?
   * - AI może trwać 10-60s (timeout HTTP)
   * - Lepszy UX - klient widzi progress
   * - Możliwość batch processing (wiele stron jednocześnie)
   */
  const aiService = new AIService(locals.supabase, apiKey);

  // Fire and forget - nie await!
  aiService.processPage(validation.data.id).catch((error) => {
    // Loguj błędy ale nie fail endpoint
    // eslint-disable-next-line no-console
    console.error("Background AI processing failed:", { error, pageId });
  });

  // 8. Response
  const response: ProcessPageResponse = {
    id: validation.data.id,
    status: "processing",
    message: "AI processing started",
  };

  /**
   * HTTP 202 Accepted - request przyjęty, przetwarzanie w toku
   *
   * Klient powinien:
   * 1. Otrzymać 202 Accepted
   * 2. Poll'ować GET /api/admin/flyer-pages/:id co 2-5s
   * 3. Sprawdzać status field
   * 4. Gdy status='verification' → processing zakończony
   */
  return createSuccessResponse(response, 202);
};
