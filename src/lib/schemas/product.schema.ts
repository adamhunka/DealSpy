import { z } from "zod";
import { slugSchema } from "./common.schema";

export const productIdParamSchema = z.object({
  id: z.string({ required_error: "Product ID is required" }).uuid("Invalid product ID format"),
});

export const productSearchQuerySchema = z.object({
  q: z.string().max(200, "Search query is too long").optional(),
  store: slugSchema.optional(),
  category: slugSchema.optional(),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const productRecentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Schema dla produktu wykrytego przez AI
 *
 * Używany do walidacji odpowiedzi z LLM przed zapisem do bazy.
 * AI może zwrócić invalid strukturę - zawsze walidujemy!
 */
export const detectedProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(255, "Product name is too long"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  unit: z.string().optional(),
  description: z.string().max(1000, "Description is too long").optional(),
  bbox: z
    .object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    })
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Schema dla tablicy produktów z AI
 */
export const detectedProductsSchema = z.array(detectedProductSchema);

export type ProductIdParams = z.infer<typeof productIdParamSchema>;
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
export type ProductRecentQuery = z.infer<typeof productRecentQuerySchema>;
export type DetectedProductSchema = z.infer<typeof detectedProductSchema>;
