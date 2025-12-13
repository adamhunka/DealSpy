import { z } from "zod";
import type { ApiError, ApiResponse, ErrorCode, ErrorDetail, PaginationMeta } from "@/types";

/**
 * Tworzy standardowy error response w formacie ApiError
 *
 * @param code - Kod błędu (np. "VALIDATION_ERROR")
 * @param message - Czytelny komunikat dla użytkownika
 * @param status - HTTP status code (400, 404, 500, etc.)
 * @param details - Opcjonalne szczegóły błędów (np. z Zod)
 *
 * @returns Response object gotowy do zwrócenia z API route
 *
 * @example
 * return createErrorResponse(
 *   "NOT_FOUND",
 *   "Store not found",
 *   404
 * );
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: ErrorDetail[]
): Response {
  const errorBody: ApiError = {
    error: {
      code,
      message,
      ...(details && details.length > 0 && { details }),
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * Tworzy standardowy success response w formacie ApiResponse<T>
 *
 * @param data - Dane do zwrócenia (dowolny typ T)
 * @param status - HTTP status code (domyślnie 200)
 * @param cacheMaxAge - Opcjonalnie: czas cache w sekundach
 *
 * @returns Response object gotowy do zwrócenia z API route
 *
 * Dlaczego funkcja jest generyczna (<T>)?
 * - Może zwrócić różne typy danych (StoreDTO, StoreDTO[], etc.)
 * - TypeScript sprawdzi czy przekazujemy właściwy typ
 *
 * @example
 * const stores: StoreDTO[] = [...];
 * return createSuccessResponse(stores, 200, 300);
 */
export function createSuccessResponse<T>(
  data: T,
  status = 200,
  pagination?: PaginationMeta,
  cacheMaxAge?: number
): Response {
  const responseBody: ApiResponse<T> = {
    data,
    ...(pagination && { pagination }),
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };

  if (cacheMaxAge) {
    headers["Cache-Control"] = `public, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`;
  }

  return new Response(JSON.stringify(responseBody), {
    status,
    headers,
  });
}

/**
 * Konwertuje błędy Zod na format ApiError details
 *
 * @param error - Błąd z Zod (ZodError)
 * @returns Array szczegółów błędów w formacie ErrorDetail[]
 *
 * @example
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     const details = formatZodErrors(error);
 *     // details = [{ field: "slug", message: "Invalid format" }]
 *   }
 * }
 */
export function formatZodErrors(error: z.ZodError): ErrorDetail[] {
  return error.errors.map((issue) => ({
    field: issue.path.join(".") || "unknown",
    message: issue.message,
  }));
}
