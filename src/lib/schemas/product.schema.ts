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

// ============================================================================
// Admin Product Schemas
// ============================================================================

/**
 * BBox schema (reusable)
 * 
 * Waliduje współrzędne Bounding Box produktu na obrazku
 */
const bboxSchema = z
  .object({
    x: z.number().int().min(0, "x must be >= 0"),
    y: z.number().int().min(0, "y must be >= 0"),
    width: z.number().int().min(1, "width must be > 0"),
    height: z.number().int().min(1, "height must be > 0"),
  })
  .optional()
  .nullable();

/**
 * Schema dla pageId w URL
 * 
 * Endpoint: GET/POST /api/admin/flyer-pages/:pageId/products
 */
export const flyerPageIdParamSchema = z.object({
  pageId: z.string({ required_error: "Page ID is required" }).uuid("Invalid page ID format"),
});

/**
 * Schema dla tworzenia produktu przez admina
 * 
 * Endpoint: POST /api/admin/flyer-pages/:pageId/products
 */
export const createProductSchema = z.object({
  name: z
    .string({ required_error: "Product name is required" })
    .min(1, "Product name is required")
    .max(200, "Product name must be at most 200 characters"),
  price: z
    .number({ required_error: "Price is required" })
    .min(0, "Price must be >= 0")
    .refine(
      (val) => {
        // Sprawdź czy liczba ma maksymalnie 2 miejsca dziesiętne
        const str = val.toString();
        const decimalPart = str.split(".")[1];
        return !decimalPart || decimalPart.length <= 2;
      },
      {
        message: "Price must have at most 2 decimal places",
      }
    ),
  currency: z
    .string()
    .length(3, "Currency must be a 3-character code")
    .default("PLN")
    .optional(),
  unit: z.string().max(20, "Unit must be at most 20 characters").optional().nullable(),
  description: z.string().max(500, "Description must be at most 500 characters").optional().nullable(),
  promo_conditions: z
    .string()
    .max(500, "Promo conditions must be at most 500 characters")
    .optional()
    .nullable(),
  category_id: z.string({ required_error: "Category ID is required" }).uuid("Invalid category ID format"),
  bbox: bboxSchema,
});

/**
 * Schema dla aktualizacji produktu przez admina
 * 
 * Endpoint: PUT /api/admin/products/:id
 * 
 * Wszystkie pola opcjonalne, ale przynajmniej jedno wymagane
 */
export const updateProductSchema = createProductSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

// ============================================================================
// Type Exports
// ============================================================================

export type ProductIdParams = z.infer<typeof productIdParamSchema>;
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
export type ProductRecentQuery = z.infer<typeof productRecentQuerySchema>;
export type DetectedProductSchema = z.infer<typeof detectedProductSchema>;
export type FlyerPageIdParams = z.infer<typeof flyerPageIdParamSchema>;
export type CreateProductSchema = z.infer<typeof createProductSchema>;
export type UpdateProductSchema = z.infer<typeof updateProductSchema>;
