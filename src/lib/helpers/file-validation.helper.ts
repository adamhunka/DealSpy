import {
  ALLOWED_LOGO_MIME_TYPES,
  MAX_LOGO_SIZE_BYTES,
  MAX_LOGO_SIZE_MB,
  type AllowedLogoMimeType,
} from "../schemas/common.schema";

/**
 * Rezultat walidacji pliku
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Waliduje plik logo
 *
 * Single Source of Truth dla walidacji plików logo.
 * Używane w komponentach React przed wysłaniem do API.
 *
 * @param file - plik do walidacji
 * @returns wynik walidacji z opcjonalnym komunikatem błędu
 *
 * @example
 * const result = validateLogoFile(file);
 * if (!result.isValid) {
 *   toast.error(result.error);
 * }
 */
export function validateLogoFile(file: File): FileValidationResult {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type as AllowedLogoMimeType)) {
    const formats = ALLOWED_LOGO_MIME_TYPES.map((t) => t.split("/")[1].toUpperCase()).join(",");

    return {
      isValid: false,
      error: `Dozwolone formaty: ${formats}`,
    };
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Maksymalny rozmiar pliku to ${MAX_LOGO_SIZE_MB}MB`,
    };
  }

  if (!file.type.startsWith("image/")) {
    return {
      isValid: false,
      error: "Plik nie jest obrazem",
    };
  }

  return { isValid: true };
}

/**
 * Konwertuje File do base64 string
 *
 * Używane gdy chcemy wysłać plik jako JSON (nie FormData)
 *
 * @param file - plik do konwersji
 * @returns Promise z base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      reject(new Error("Nie udało się odczytać pliku"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Formatuje rozmiar w bytes do czytelnej formy
 *
 * @param bytes - rozmiar w bytes
 * @returns sformatowany string (np. "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "o Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}
