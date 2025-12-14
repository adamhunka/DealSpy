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
export type FlyerIdParams = z.infer<typeof flyerIdParamsSchema>;
export type FlyerProductsParams = z.infer<typeof flyerProductsParamsSchema>;
