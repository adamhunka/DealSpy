import { z } from "zod";
import { slugSchema } from "./common.schema";

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
 * TypeScript type wygenerowany ze schema
 *
 * Używamy z.infer<> do automatycznego wygenerowania typu
 * Dzięki temu mamy pewność, że type zawsze jest zgodny ze schema
 */
export type StoreSlugParams = z.infer<typeof storeSlugParamSchema>;
