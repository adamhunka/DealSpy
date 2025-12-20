import sharp from "sharp";
import type { SupabaseClient } from "@/db/supabase.client";

/**
 * StorageService - serwis do operacji na Supabase Storage
 *
 * Odpowiada za:
 * - Upload plików do bucketów
 * - Usuwanie plików
 * - Konwersję obrazów do WebP
 * - Generowanie URLi (public i signed)
 */
export class StorageService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Upload pliku do Supabase Storage
   *
   * @param bucket - nazwa bucketu (np. 'raw_flyers', 'public_flyers')
   * @param path - ścieżka w buckecie (np. 'biedronka/flyer-123/page-1.jpg')
   * @param file - plik do uploadu (File lub Blob)
   * @param options - opcje uploadu (np. contentType)
   * @returns ścieżka i URL do pliku
   *
   * @throws Error jeśli upload się nie powiedzie
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: File | Blob,
    options?: { contentType?: string }
  ): Promise<{ path: string; url: string }> {
    const arrayBuffer = await file.arrayBuffer();

    const { data, error } = await this.supabase.storage.from(bucket).upload(path, arrayBuffer, {
      contentType: options?.contentType || file.type,
      upsert: false,
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Storage upload failed:", { error, bucket, path });
      throw new Error(`Failed to upload file to ${bucket}/${path}: ${error.message}`);
    }

    const url = this.generatePublicUrl(bucket, data.path);
    return { path: data.path, url };
  }

  /**
   * Usuwa plik z Supabase Storage
   *
   * @param bucket - nazwa bucketu
   * @param path - ścieżka do pliku
   *
   * @throws Error jeśli usunięcie się nie powiedzie
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(bucket).remove([path]);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Storage delete failed:", { error, bucket, path });
      throw new Error(`Failed to delete file from ${bucket}/${path}: ${error.message}`);
    }
  }

  /**
   * Konwertuje obraz do formatu WebP
   *
   * WebP jest nowoczesnym formatem obrazów który:
   * - Jest 25-35% mniejszy niż JPG przy tej samej jakości
   * - Wspierany przez wszystkie nowoczesne przeglądarki
   * - Szybciej się ładuje = lepsza UX
   *
   * @param imageBuffer - obraz jako ArrayBuffer
   * @param maxWidth - maksymalna szerokość (zachowuje proporcje)
   * @returns obraz WebP jako Blob
   *
   * @throws Error jeśli konwersja się nie powiedzie
   */
  async convertToWebP(imageBuffer: ArrayBuffer, maxWidth = 1000): Promise<Blob> {
    try {
      const buffer = await sharp(imageBuffer)
        .resize(maxWidth, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .webp({ quality: 85 })
        .toBuffer();

      return new Blob([buffer as BlobPart], { type: "image/webp" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("WebP conversion failed:", error);
      throw new Error(`Failed to convert image to WebP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generuje publiczny URL do pliku
   *
   * Dla public bucketów - każdy może odczytać bez autoryzacji
   *
   * @param bucket - nazwa bucketu
   * @param path - ścieżka do pliku
   * @returns pełny URL
   */
  generatePublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Generuje signed URL do pliku (z expiration)
   *
   * Dla private bucketów - URL wygasa po określonym czasie
   * Używamy dla raw_flyers (dostęp tylko dla adminów)
   *
   * @param bucket - nazwa bucketu
   * @param path - ścieżka do pliku
   * @param expiresIn - czas wygaśnięcia w sekundach (default: 1h)
   * @returns signed URL
   *
   * @throws Error jeśli generowanie się nie powiedzie
   */
  async generateSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

    if (error || !data) {
      // eslint-disable-next-line no-console
      console.error("Failed to generate signed URL:", { error, bucket, path });
      throw new Error(`Failed to generate signed URL: ${error?.message || "Unknown error"}`);
    }

    return data.signedUrl;
  }
}
