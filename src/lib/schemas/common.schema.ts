import { z } from "zod";

/**
 * Reużywalny schemat walidacji slug
 *
 * Używany przez wszystkie zasoby: categories, stores, products, flyers, etc.
 *
 * Wymagania:
 * - slug nie może być pusty
 * - maksymalnie 100 znaków (zapobiega DoS przez długie stringi)
 * - tylko małe litery, cyfry i myślniki (^[a-z0-9-]+$)
 *
 * Bezpieczeństwo:
 * - Regex blokuje path traversal (brak . i /)
 * - Regex blokuje SQL injection (brak ', ;, --, etc.)
 * - Max length zapobiega DoS attacks
 *
 * @example
 * // Używanie w category schema
 * export const categorySlugParamSchema = z.object({
 *   slug: slugSchema
 * });
 *
 * // Używanie w store schema
 * export const storeSlugParamSchema = z.object({
 *   slug: slugSchema
 * });
 */
export const slugSchema = z
  .string({ required_error: "Slug is required" })
  .min(1, "Slug cannot be empty")
  .max(100, "Slug is too long")
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");

export type Slug = z.infer<typeof slugSchema>;
