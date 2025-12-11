import { z } from "zod";
import { slugSchema } from "./common.schema";

/**
 * Schema walidacji parametru slug dla category
 *
 * Wymagania:
 * - slug nie może być pusty
 * - maksymalnie 100 znaków (dla bezpieczeństwa)
 * - tylko małe litery, cyfry i myślniki (^[a-z0-9-]+$)
 */
export const categorySlugParamSchema = z.object({
  slug: slugSchema,
});

export type CategorySlugParams = z.infer<typeof categorySlugParamSchema>;
