import { z } from "zod";
import { slugSchema } from "./common.schema";

/**
 * Schema walidacji parametru ID dla store
 *
 * Wymagania:
 * - ID musi być prawidłowym UUID (format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 *
 * Dlaczego UUID?
 * - Bezpieczeństwo: nie można zgadnąć ID innych sklepów
 * - Unikalność: gwarantowana przez bazę danych
 * - Zgodność z Supabase/PostgreSQL
 */
export const storeIdParamSchema = z.object({
  id: z.string().uuid("Nieprawidłowe ID sklepu"),
});

/**
 * Schema walidacji parametru slug dla store
 *
 * Wymagania:
 * - slug nie może być pusty
 * - maksymalnie 100 znaków (dla bezpieczeństwa)
 * - tylko małe litery, cyfry i myślniki (^[a-z0-9-]+$)
 *
 * Dlaczego te wymagania?
 * - lowercase only: slug używane w URL, URLs są case-sensitive
 * - bez znaków specjalnych: zapobiega atakom path traversal (/../../etc/passwd)
 * - max length: zapobiega DoS przez długie stringi
 */
export const storeSlugParamSchema = z.object({
  slug: slugSchema,
});

/**
 * Schema dla tworzenia nowego sklepu
 *
 * Endpoint: POST /api/admin/stores
 */
export const createStoreSchema = z.object({
  name: z
    .string({ required_error: "Nazwa jest wymagana" })
    .min(1, "Nazwa jest wymagana")
    .max(100, "Nazwa moe mieć maksymalnie 100 znaków")
    .trim(),
  slug: slugSchema,
  logo_file: z.string().optional(),
});

/**
 * Schema dla aktualizacji sklepu
 *
 * Endpoint: PUT /api/admin/stores/:id
 *
 * Wszystkie pola opcjonalne - można zaktualizować tylko wybrane
 */
export const updateStoreSchema = z.object({
  name: z
    .string()
    .min(1, "Nazwa nie moe być pusta")
    .max(100, "Nazwa moe mieć maksymalnie 100 znaków")
    .trim()
    .optional(),

  slug: slugSchema.optional(),

  logo_file: z.string().optional(),
});

/**
 * TypeScript type wygenerowany ze schema
 *
 * Używamy z.infer<> do automatycznego wygenerowania typu
 * Dzięki temu mamy pewność, że type zawsze jest zgodny ze schema
 */
export type StoreIdParams = z.infer<typeof storeIdParamSchema>;
export type StoreSlugParams = z.infer<typeof storeSlugParamSchema>;
export type CreateStoreCommand = z.infer<typeof createStoreSchema>;
export type UpdateStoreCommand = z.infer<typeof updateStoreSchema>;
