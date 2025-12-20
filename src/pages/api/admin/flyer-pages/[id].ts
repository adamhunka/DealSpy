import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerPageIdParamsSchema, updateFlyerPageSchema } from "@/lib/schemas/flyer.schema";
import { FlyerService } from "@/lib/services/flyer.service";
import { StorageService } from "@/lib/services/storage.service";

export const prerender = false;

/**
 * GET /api/admin/flyer-pages/:id
 *
 * Pobiera szczegóły strony gazetki z raw_ai_data
 *
 * Multi-method endpoint - ten plik obsługuje GET, PATCH, DELETE
 * Astro automatycznie routuje na podstawie HTTP method
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  const pageId = params.id;
  const validation = flyerPageIdParamsSchema.safeParse({ id: pageId });

  if (!validation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid page ID format", 400, formatZodErrors(validation.error));
  }

  const flyerService = new FlyerService(locals.supabase);
  const page = await flyerService.getFlyerPageById(validation.data.id);

  if (!page) {
    return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
  }

  return createSuccessResponse(page, 200);
};

/**
 * PATCH /api/admin/flyer-pages/:id
 *
 * Aktualizuje status strony gazetki
 */
export const PATCH: APIRoute = async ({ params, locals, request }) => {
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
  const bodyValidation = updateFlyerPageSchema.safeParse(body);

  if (!bodyValidation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400, formatZodErrors(bodyValidation.error));
  }

  const { status: newStatus } = bodyValidation.data;

  // 4. Pobierz current page
  const flyerService = new FlyerService(locals.supabase);
  const page = await flyerService.getFlyerPageById(validation.data.id);

  if (!page) {
    return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
  }

  // 5. Waliduj status transition
  /**
   * Status transition rules - logika biznesowa
   *
   * Dozwolone przejścia:
   * - draft → processing, verification, published
   * - processing → draft (error), verification (success)
   * - verification → published (approved), draft (rejected)
   * - published → verification (unpublish)
   */
  const allowedTransitions: Record<string, string[]> = {
    draft: ["processing", "verification", "published"],
    processing: ["draft", "verification"],
    verification: ["published", "draft"],
    published: ["verification"],
  };

  if (!allowedTransitions[page.status]?.includes(newStatus)) {
    return createErrorResponse(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from ${page.status} to ${newStatus}`,
      400
    );
  }

  // 6. Update status
  const result = await flyerService.updatePageStatus(validation.data.id, newStatus);

  // 7. Response
  return createSuccessResponse(result, 200);
};

/**
 * DELETE /api/admin/flyer-pages/:id
 *
 * Usuwa stronę gazetki wraz z plikami i produktami
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
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

  // 3. Pobierz stronę (potrzebujemy ścieżek do plików)
  /**
   * NIE używamy FlyerService.getFlyerPageById() bo zwraca DTO z URLami
   * Potrzebujemy raw paths z bazy
   */
  const { data: page, error: fetchError } = await locals.supabase
    .from("flyer_pages")
    .select("id, status, original_image_path, web_image_path")
    .eq("id", validation.data.id)
    .maybeSingle();

  if (fetchError || !page) {
    return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
  }

  // 4. Business rule - nie usuwaj published
  /**
   * Możesz wymusić, że published strony nie można usunąć
   * (trzeba najpierw unpublish)
   */
  if (page.status === "published") {
    return createErrorResponse("INVALID_STATUS_TRANSITION", "Cannot delete published page. Unpublish first.", 400);
  }

  // 5. Usuń pliki ze Storage
  /**
   * WAŻNE: Kolejność operacji!
   *
   * 1. Usuń pliki ze Storage
   * 2. Usuń rekord z bazy
   *
   * Dlaczego taka kolejność?
   * - Jeśli Storage fail → nie usuwamy z bazy (dane konsystentne)
   * - Jeśli DB fail → mamy orphaned files (mniejszy problem niż broken DB references)
   */
  const storageService = new StorageService(locals.supabase);

  try {
    // Usuń original image
    if (page.original_image_path) {
      await storageService.deleteFile("raw_flyers", page.original_image_path);
    }

    // Usuń WebP image
    if (page.web_image_path) {
      await storageService.deleteFile("public_flyers", page.web_image_path);
    }
  } catch (error) {
    /**
     * Jeśli Storage delete fail, logujemy ale NIE przerywamy
     *
     * Możliwe scenariusze:
     * - Plik już nie istnieje (OK)
     * - Network error (Temporary)
     *
     * Lepiej mieć orphaned files niż broken DB
     */
    // eslint-disable-next-line no-console
    console.error("Failed to delete storage files:", {
      error,
      pageId,
      paths: {
        original: page.original_image_path,
        web: page.web_image_path,
      },
    });

    // Kontynuuj z usunięciem z bazy
  }

  // 6. Usuń z bazy (CASCADE deletes products)
  /**
   * ON DELETE CASCADE w DB schema:
   *
   * products.flyer_page_id FK → flyer_pages.id ON DELETE CASCADE
   *
   * Gdy usuwamy flyer_page, automatycznie usuwają się wszystkie produkty
   */
  const flyerService = new FlyerService(locals.supabase);

  try {
    await flyerService.deletePage(validation.data.id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to delete flyer page:", { error, pageId });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to delete page", 500);
  }

  // 7. Return 204 No Content
  /**
   * HTTP 204 - operacja sukces, brak zawartości do zwrócenia
   *
   * Response body jest puste (null)
   */
  return new Response(null, { status: 204 });
};

