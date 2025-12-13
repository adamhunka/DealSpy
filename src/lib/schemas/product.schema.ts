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

export type ProductIdParams = z.infer<typeof productIdParamSchema>;
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
export type ProductRecentQuery = z.infer<typeof productRecentQuerySchema>;
