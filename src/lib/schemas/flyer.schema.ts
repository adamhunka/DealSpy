import { z } from "zod";
import { slugSchema } from "./common.schema";

/**
 * Schema dla GET /api/flyers
 *
 * Parametry query string:
 * - store: opcjonalny slug sklepu (np. "biedronka")
 * - limit: liczba wyników (1-100, domyślnie 20)
 * - offset: przesunięcie paginacji (min 0, domyślnie 0)
 *
 * Przykład: /api/flyers?store=biedronka&limit=10&offset=0
 */
export const flyerListParamsSchema = z.object({
  store: slugSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema dla GET /api/admin/flyers
 *
 * Query parameters:
 * - store: opcjonalny slug sklepu
 * - status: opcjonalny status gazetki
 * - include_deleted: czy pokazać usunięte
 * - limit: liczba wyników (paginacja)
 * - offset: przesunięcie (paginacja)
 *
 * Przykład URL:
 * /api/admin/flyers?store=biedronka&status=published&limit=20&offset=0
 */
export const adminFlyerListParamsSchema = z.object({
  store: z.string().optional(),
  status: z.enum(["draft", "processing", "verification", "published"]).optional(),
  include_deleted: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => val === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema dla POST /api/admin/flyers
 *
 * Tworzy nową gazetkę z metadanymi.
 *
 * Waliduje:
 * - store_id jest poprawnym UUID
 * - Daty są w formacie YYYY-MM-DD
 * - valid_from <= valid_to
 * - Daty nie są w przeszłości
 */
export const createFlyerSchema = z
  .object({
    store_id: z.string().uuid("Invalid store ID format"),
    valid_from: z.string().date("Invalid date format. Expected YYYY-MM-DD"),
    valid_to: z.string().date("Invalid date format. Expected YYYY-MM-DD"),
  })
  .refine(
    (data) => {
      const from = new Date(data.valid_from);
      const to = new Date(data.valid_to);
      return from <= to;
    },
    {
      message: "valid_from must be before or equal to valid_to",
      path: ["valid_from"],
    }
  )
  .refine(
    (data) => {
      const from = new Date(data.valid_from);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return from >= today;
    },
    {
      message: "valid_from cannot be in the past",
      path: ["valid_from"],
    }
  );

/**
 * Schema dla PATCH /api/admin/flyers/:id
 *
 * Aktualizacja gazetki - wszystkie pola opcjonalne,
 * ale przynajmniej jedno musi być obecne.
 */
export const updateFlyerSchema = z
  .object({
    valid_from: z.string().date("Invalid date format. Expected YYYY-MM-DD").optional(),
    valid_to: z.string().date("Invalid date format. Expected YYYY-MM-DD").optional(),
    status: z.enum(["draft", "processing", "verification", "published"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (data) => {
      if (data.valid_from && data.valid_to) {
        const from = new Date(data.valid_from);
        const to = new Date(data.valid_to);
        return from <= to;
      }
      return true;
    },
    {
      message: "valid_from must be before or equal to valid_to",
      path: ["valid_from"],
    }
  );

/**
 * Schema dla GET /api/flyers/:id
 *
 * Parametry path:
 * - id: UUID gazetki
 *
 * Przykład: /api/flyers/123e4567-e89b-12d3-a456-426614174000
 */
export const flyerIdParamsSchema = z.object({
  id: z.string().uuid("Invalid flyer ID format"),
});

/**
 * Schema dla GET /api/flyers/:id/products
 *
 * Parametry:
 * - id: UUID gazetki (path param)
 * - limit: liczba wyników (query param)
 * - offset: przesunięcie (query param)
 *
 * Przykład: /api/flyers/123.../products?limit=50&offset=0
 */
export const flyerProductsParamsSchema = z.object({
  id: z.string().uuid("Invalid flyer ID format"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type FlyerListParams = z.infer<typeof flyerListParamsSchema>;
export type AdminFlyerListParams = z.infer<typeof adminFlyerListParamsSchema>;
export type CreateFlyerCommand = z.infer<typeof createFlyerSchema>;
export type UpdateFlyerCommand = z.infer<typeof updateFlyerSchema>;
export type FlyerIdParams = z.infer<typeof flyerIdParamsSchema>;
export type FlyerProductsParams = z.infer<typeof flyerProductsParamsSchema>;
