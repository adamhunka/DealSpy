import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse } from "@/lib/helpers/api-response.helper";
import { flyerIdParamsSchema } from "@/lib/schemas/flyer.schema";
import { FlyerService } from "@/lib/services/flyer.service";
import { StorageService } from "@/lib/services/storage.service";
import type { UploadFlyerPagesResponse } from "@/types";

export const prerender = false;

/**
 * POST /api/admin/flyers/:flyerId/pages
 *
 * Upload stron gazetki promocyjnej
 *
 * Ten endpoint:
 * 1. Przyjmuje 1 lub więcej plików obrazów (multipart/form-data)
 * 2. Konwertuje je do WebP (optymalizacja rozmiaru)
 * 3. Zapisuje oryginały i WebP do Supabase Storage
 * 4. Tworzy rekordy w bazie danych
 *
 * Autoryzacja: Tylko admin
 *
 * @param params - URL parameters (flyerId)
 * @param locals - Shared data (supabase client)
 * @param request - HTTP request object
 * @returns Response z uploaded pages lub error
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  const flyerId = params.flyerId;

  const validation = flyerIdParamsSchema.safeParse({ id: flyerId });

  if (!validation.success) {
    return createErrorResponse("VALIDATION_ERROR", "Invalid flyer ID format", 400);
  }

  const flyerService = new FlyerService(locals.supabase);
  const flyerExists = await flyerService.checkFlyerExists(validation.data.id);

  if (!flyerExists) {
    return createErrorResponse("NOT_FOUND", "Flyer not found", 404);
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return createErrorResponse("VALIDATION_ERROR", "No files provided", 400);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 10 * 1024 * 1024;

  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse("VALIDATION_ERROR", `Invalid file type: ${file.type}. Allowed: JPG, PNG, WEBP`, 400);
    }

    if (file.size > maxSize) {
      return createErrorResponse("PAYLOAD_TOO_LARGE", `File too large: ${file.name}. Maximum 10MB`, 413);
    }
  }

  const storageSlug = await flyerService.getFlyerStoreSlug(validation.data.id);

  if (!storageSlug) {
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to get flyer store", 500);
  }

  let nextPageNumber = await flyerService["getNextPageNumber"](validation.data.id);
  const storageService = new StorageService(locals.supabase);
  const uploadedPages: {
    pageNumber: number;
    originalImagePath: string;
    webImagePath: string;
  }[] = [];

  try {
    for (const file of files) {
      const pageNumber = nextPageNumber++;

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

      const originalPath = `${storageSlug}/${validation.data.id}/page-${pageNumber}-original.${ext}`;
      await storageService.uploadFile("raw_flyers", originalPath, file);

      const buffer = await file.arrayBuffer();
      const webpBLob = await storageService.convertToWebP(buffer, 1000);

      const webPath = `${storageSlug}/${validation.data.id}/page-${pageNumber}.webp`;

      await storageService.uploadFile("public_flyers", webPath, webpBLob, {
        contentType: "image/webp",
      });

      uploadedPages.push({
        pageNumber,
        originalImagePath: originalPath,
        webImagePath: webPath,
      });
    }
    const createdPages = await flyerService.createPages(validation.data.id, uploadedPages);

    const response: UploadFlyerPagesResponse = {
      flyer_id: validation.data.id,
      uploaded_pages: createdPages.map((page) => ({
        id: page.id,
        page_number: page.page_number,
        original_image_url: page.original_image_url,
        web_image_url: page.web_image_url,
        status: page.status,
        created_at: page.created_at,
      })),
    };
    return createSuccessResponse(response, 201);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to upload flyer pages:", {
      error,
      flyerId,
      fileCount: files.length,
    });

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to upload pages", 500);
  }
};
