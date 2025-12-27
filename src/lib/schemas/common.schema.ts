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

/**
 * Dozwolone typy MIME dla logo sklepu
 */
export const ALLOWED_LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Rozszerzenia plików dla logo sklepu
 */
export const ALLOWED_LOGO_EXTENSIONS = ".jpg, .jpeg, .png, .webp";

/**
 * Maksymalny rozmiar pliku logo w  bytes (2MB)
 */
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Maksymalny rozmiar pliku logo w MB
 */
export const MAX_LOGO_SIZE_MB = MAX_LOGO_SIZE_BYTES / (1024 * 1024);

/**
 * Typ dla dozwolonych MIME types
 */
export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

/**
 * Schema dla base64 encoded image
 *
 * Uzywane gdy plik jest wysyłany jako string w JSON
 */
export const base64ImageSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,/, "Nieprawidłowy format base64 image")
  .refine((value) => {
    const base64Length = value.split(",")[1]?.length || 0;
    const approximateSize = (base64Length * 3) / 4;
    return approximateSize <= MAX_LOGO_SIZE_BYTES * 1.5;
  }, "Plik jest za duy (max ${MAX_LOGO_SIZE_MB}MB)")
  .optional();

export type Slug = z.infer<typeof slugSchema>;
