import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerPageIdParamSchema, createProductSchema } from "@/lib/schemas/product.schema";
import { ProductService } from "@/lib/services/product.service";
import { FlyerService } from "@/lib/services/flyer.service";
import { CategoryService } from "@/lib/services/category.service";

export const prerender = false;

/**
 * GET /api/admin/flyer-pages/:pageId/products
 *
 * Pobiera wszystkie produkty na stronie gazetki.
 * Używane przez admina podczas weryfikacji produktów wykrytych przez AI.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja pageId
    const validation = flyerPageIdParamSchema.safeParse(params);
    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid page ID format", 400, formatZodErrors(validation.error));
    }

    const { pageId } = validation.data;

    // 3. Sprawdź czy strona istnieje
    const flyerService = new FlyerService(locals.supabase);
    const pageExists = await flyerService.checkFlyerPageExists(pageId);
    if (!pageExists) {
      return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
    }

    // 4. Pobierz produkty
    const productService = new ProductService(locals.supabase);
    const products = await productService.getProductsByPageId(pageId);

    // 5. Zwróć sukces
    return createSuccessResponse(products, 200);
  } catch (error) {
    console.error("GET /api/admin/flyer-pages/:pageId/products error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};

/**
 * POST /api/admin/flyer-pages/:pageId/products
 *
 * Tworzy nowy produkt na stronie gazetki (ręczne dodanie przez admina).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    // 1. Autoryzacja
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    // 2. Walidacja pageId
    const paramValidation = flyerPageIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid page ID format",
        400,
        formatZodErrors(paramValidation.error)
      );
    }

    const { pageId } = paramValidation.data;

    // 3. Parse i waliduj body
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse("VALIDATION_ERROR", "Invalid JSON body", 400);
    }

    const bodyValidation = createProductSchema.safeParse(body);
    if (!bodyValidation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        formatZodErrors(bodyValidation.error)
      );
    }

    const command = bodyValidation.data;

    // 4. Sprawdź czy strona istnieje
    const flyerService = new FlyerService(locals.supabase);
    const pageExists = await flyerService.checkFlyerPageExists(pageId);
    if (!pageExists) {
      return createErrorResponse("NOT_FOUND", "Flyer page not found", 404);
    }

    // 5. Sprawdź czy kategoria istnieje
    const categoryService = new CategoryService(locals.supabase);
    const categoryExists = await categoryService.checkCategoryExists(command.category_id);
    if (!categoryExists) {
      return createErrorResponse("VALIDATION_ERROR", "Category not found", 400);
    }

    // 6. Utwórz produkt
    const productService = new ProductService(locals.supabase);
    const product = await productService.createProduct(pageId, command);

    if (!product) {
      // To nie powinno się zdarzyć (sprawdziliśmy pageId i category_id)
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to create product", 500);
    }

    // 7. Zwróć sukces
    return createSuccessResponse(product, 201);
  } catch (error) {
    console.error("POST /api/admin/flyer-pages/:pageId/products error:", { error, params });
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};

