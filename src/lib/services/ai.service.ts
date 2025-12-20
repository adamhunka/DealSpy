import type { SupabaseClient } from "@/db/supabase.client";
import type { RawAIData, BBox } from "@/types";
import type { Json } from "@/db/database.types";
import { z } from "zod";
import { detectedProductsSchema } from "@/lib/schemas/product.schema";

const OPENROUTER_BASE_URL = import.meta.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const AI_TIMEOUT = 60000;

interface OCRResult {
  text: string;
  confidence: number;
}

interface StructuredProduct {
  name: string;
  price: string;
  unit?: string;
  description?: string;
  bbox?: BBox;
  confidence?: number;
}

export class AIService {
  constructor(
    private supabase: SupabaseClient,
    private apiKey: string
  ) {}

  /**
   * Główna metoda - przetwarzanie całej strony
   *
   * Ten proces jest DŁUGI (10-60s), dlatego uruchamiamy go asynchronicznie.
   * Endpoint zwraca 202 Accepted natychmiast, a processing działa w tle.
   *
   * @param pageId - ID strony do przetworzenia
   * @returns RawAIData - dane z OCR i LLM
   *
   * @throws Error jeśli cokolwiek pójdzie nie tak
   */
  async processPage(pageId: string): Promise<RawAIData> {
    const { data: page, error } = await this.supabase
      .from("flyer_pages")
      .select("id, original_image_path, status")
      .eq("id", pageId)
      .maybeSingle();

    if (error || !page) {
      throw new Error("Page not found");
    }

    await this.supabase
      .from("flyer_pages")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pageId);

    try {
      const prompts = await this.getPrompt();
      const imageUrl = await this.generateSignedUrl("raw_flyers", page.original_image_path);
      const ocrResult = await this.extractTextFromImage(imageUrl, prompts.ocrPrompt, prompts.ocrModel);
      const products = await this.structureProductData(ocrResult.text, prompts.llmPrompt, prompts.llmModel);
      const rawAIData: RawAIData = {
        ocr_text: ocrResult.text,
        detected_products: products,
      };

      await this.saveRawAIData(pageId, rawAIData);
      await this.createProductFromAI(pageId, products);

      await this.supabase
        .from("flyer_pages")
        .update({
          status: "verification",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pageId);

      return rawAIData;
    } catch (error) {
      await this.supabase
        .from("flyer_pages")
        .update({
          status: "draft",
          error_message: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pageId);

      throw error;
    }
  }

  /**
   * Krok 1: OCR - ekstrakcja tekstu z obrazu
   *
   * Używamy Vision Model (Google Gemini 2.0 Flash)
   *
   * @param imageUrl - URL do obrazu (signed URL z Storage)
   * @param prompt - prompt OCR (instrukcje dla AI)
   * @param model - nazwa modelu OpenRouter
   * @returns tekst i confidence
   */
  private async extractTextFromImage(imageUrl: string, prompt: string, model: string): Promise<OCRResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dealspy.app",
          "X-Title": "DealSpy Admin",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        confidence: 0.9,
      };
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === "AbortError") {
        throw new Error("AI processing timeout");
      }
      throw error;
    }
  }

  /**
   * Krok 2: LLM - strukturyzacja tekstu do JSON
   *
   * Używamy Language Model (Claude 3.5 Sonnet)
   *
   * @param ocrText - tekst z OCR
   * @param prompt - prompt LLM (instrukcje strukturyzacji)
   * @param model - nazwa modelu OpenRouter
   * @returns tablica produktów
   */
  private async structureProductData(ocrText: string, prompt: string, model: string): Promise<StructuredProduct[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://dealspy.app",
          "X-Title": "DealSpy Admin",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: `${prompt}\n\nOCR Text:\n${ocrText}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);

      // Waliduj używając schematu z product.schema.ts
      const validated = detectedProductsSchema.parse(parsed.products || []);

      return validated;
    } catch (error) {
      clearTimeout(timeout);

      if ((error as Error).name === "AbortError") {
        throw new Error("LLM timeout - AI service too slow");
      }

      if (error instanceof z.ZodError) {
        // eslint-disable-next-line no-console
        console.error("Invalid AI response structure:", error.errors);
        throw new Error("AI returned invalid product structure");
      }

      throw error;
    }
  }

  private async saveRawAIData(pageId: string, data: RawAIData): Promise<void> {
    const { error } = await this.supabase
      .from("flyer_pages")
      .update({
        raw_ai_data: data as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pageId);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to save raw AI data;", { error, pageId });
      throw new Error("database update failed");
    }
  }

  private async createProductFromAI(pageId: string, products: StructuredProduct[]): Promise<void> {
    if (products.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("No products detected by AI:", pageId);
      return;
    }

    const { data: category } = await this.supabase.from("categories").select("id").eq("slug", "inne").maybeSingle();

    if (!category) {
      // eslint-disable-next-line no-console
      console.error("Default category not found");
      throw new Error("database query failed");
    }

    const inserts = products.map((product) => ({
      flyer_page_id: pageId,
      name: product.name,
      price: parseFloat(product.price),
      currency: "PLN",
      unit: product.unit || null,
      description: product.description || null,
      promo_conditions: null,
      category_id: category.id,
      bbox: (product.bbox as unknown as Json) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase.from("products").insert(inserts);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create products from AI:", { error, pageId });
      throw new Error("database insert failed");
    }
  }

  private async getPrompt(): Promise<{
    ocrPrompt: string;
    llmPrompt: string;
    ocrModel: string;
    llmModel: string;
  }> {
    const { data, error } = await this.supabase
      .from("app_config")
      .select("key, value")
      .in("key", ["ai_ocr_prompt", "ai_llm_prompt", "ai_ocr_model", "ai_llm_model"]);

    if (error || !data) {
      throw new Error("Failed to load AI configuration");
    }

    // Helper do bezpiecznego wyciągania wartości string
    const getConfigValue = (key: string, defaultValue: string): string => {
      const row = data.find((r) => r.key === key);

      // Jeśli nie ma klucza w bazie, użyj defaultu
      if (!row) {
        return defaultValue;
      }

      // Jeśli value jest string, zwróć go (wartość z bazy!)
      if (typeof row.value === "string") {
        return row.value;
      }

      // Jeśli value ma inny typ (shouldn't happen), użyj defaultu
      // eslint-disable-next-line no-console
      console.warn(`Config value for ${key} is not a string, using default`);
      return defaultValue;
    };

    return {
      ocrPrompt: getConfigValue("ai_ocr_prompt", "Extract all text from this image."),
      llmPrompt: getConfigValue("ai_llm_prompt", "Structure the following text into products."),
      ocrModel: getConfigValue("ai_ocr_model", "google/gemini-2.0-flash-exp:free"),
      llmModel: getConfigValue("ai_llm_model", "anthropic/claude-3.5-sonnet"),
    };
  }

  private async generateSignedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, 3600);

    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message || "Unknown error"}`);
    }

    return data.signedUrl;
  }
}
