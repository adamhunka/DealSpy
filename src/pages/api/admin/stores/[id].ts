// src/pages/api/admin/stores/[id].ts
import type { APIRoute } from "astro";
import { storeIdParamSchema, updateStoreSchema } from "@/lib/schemas/store.schema";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { StoreService } from "@/lib/services/store.service";

export const prerender = false;

/**
 * GET /api/admin/stores/:id - Pobierz szczegóły sklepu
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  // Walidacja ID
  const idValidation = storeIdParamSchema.safeParse({ id: params.id });
  if (!idValidation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid store ID", 400, formatZodErrors(idValidation.error));
  }

  try {
    const storeService = new StoreService(locals.supabase);
    const store = await storeService.getStoreById(idValidation.data.id);

    if (!store) {
      return createErrorResponse("NOT_FOUND", "Store not found", 404);
    }

    return createSuccessResponse(store);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching store:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch store", 500);
  }
};

/**
 * PUT /api/admin/stores/:id - Zaktualizuj sklep
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  // Walidacja ID
  const idValidation = storeIdParamSchema.safeParse({ id: params.id });
  if (!idValidation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid store ID", 400, formatZodErrors(idValidation.error));
  }

  try {
    const body = await request.json();
    const validation = updateStoreSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid data", 400, formatZodErrors(validation.error));
    }

    const storeService = new StoreService(locals.supabase);
    const updatedStore = await storeService.updateStore(idValidation.data.id, validation.data);

    if (!updatedStore) {
      return createErrorResponse("NOT_FOUND", "Store not found", 404);
    }

    return createSuccessResponse(updatedStore);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SLUG_EXISTS") {
        return createErrorResponse("CONFLICT", "Store with this slug already exists", 409, [
          { field: "slug", message: "Ten slug jest już używany" },
        ]);
      }

      // eslint-disable-next-line no-console
      console.error("Error updating store:", error);
    }

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to update store", 500);
  }
};

/**
 * DELETE /api/admin/stores/:id - Usuń sklep
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  // Walidacja ID
  const idValidation = storeIdParamSchema.safeParse({ id: params.id });
  if (!idValidation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid store ID", 400, formatZodErrors(idValidation.error));
  }

  try {
    const storeService = new StoreService(locals.supabase);
    const deleted = await storeService.deleteStore(idValidation.data.id);

    if (!deleted) {
      return createErrorResponse("NOT_FOUND", "Store not found", 404);
    }

    return createSuccessResponse({ id: idValidation.data.id, deleted: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error deleting store:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to delete store", 500);
  }
};
