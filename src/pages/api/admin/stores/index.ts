// src/pages/api/admin/stores/index.ts
import type { APIRoute } from "astro";
import { createStoreSchema } from "@/lib/schemas/store.schema";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { StoreService } from "@/lib/services/store.service";

export const prerender = false;

/**
 * POST /api/admin/stores - Utwórz nowy sklep
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    const body = await request.json();
    const validation = createStoreSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid data", 400, formatZodErrors(validation.error));
    }

    const storeService = new StoreService(locals.supabase);
    const newStore = await storeService.createStore(validation.data);

    return createSuccessResponse(newStore, 201);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SLUG_EXISTS") {
        return createErrorResponse("CONFLICT", "Store with this slug already exists", 409, [
          { field: "slug", message: "Ten slug jest już używany" },
        ]);
      }

      console.error("Error creating store:", error);
    }

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to create store", 500);
  }
};

/**
 * GET /api/admin/stores - Lista wszystkich sklepów
 */
export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase;

  // Autoryzacja
  const { isAdmin, error: authError } = await checkAdminAccess(supabase);

  if (authError === "UNAUTHORIZED") {
    return createErrorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  if (!isAdmin) {
    return createErrorResponse("FORBIDDEN", "Admin access required", 403);
  }

  try {
    // Delegacja do serwisu
    const storeService = new StoreService(supabase);
    const stores = await storeService.getAllStores();

    return createSuccessResponse(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch stores", 500);
  }
};
