import { z } from "zod";

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
  slug: z
    .string({ required_error: "Store slug is required" })
    .min(1, "Store slug cannot be empty")
    .max(100, "Store slug is too long")
    .regex(/^[a-z0-9-]+$/, "Store slug must contain only lowercase letters, numbers, and hyphens"),
});

/**
 * TypeScript type wygenerowany ze schema
 *
 * Używamy z.infer<> do automatycznego wygenerowania typu
 * Dzięki temu mamy pewność, że type zawsze jest zgodny ze schema
 */
export type StoreSlugParams = z.infer<typeof storeSlugParamSchema>;
