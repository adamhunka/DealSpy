import type { Tables, Enums } from "./db/database.types";

// ============================================================================
// SEKCJA 1: TYPY BAZODANOWE (Database Entities)
// ============================================================================

/**
 * Encja Store - reprezentuje sklep w bazie danych
 *
 * Używamy Tables<'stores'> z wygenerowanych typów Supabase
 * Alias Store jest krótszy i czytelniejszy
 */
export type Store = Tables<"stores">;
/**
 * Encja Category - reprezentuje kategorię produktów
 */
export type Category = Tables<"categories">;
/**
 * Encja Flyer - reprezentuje gazetkę promocyjną
 */
export type Flyer = Tables<"flyers">;
/**
 * Encja FlyerPage - reprezentuje stronę gazetki promocyjnej
 */
export type FlyerPage = Tables<"flyer_pages">;
/**
 * Encja Product - reprezentuje produkt w bazie danych
 */
export type Product = Tables<"products">;
/**
 * Encja Profile - reprezentuje profil użytkownika
 */
export type Profile = Tables<"profiles">;
/**
 * Encja AppConfig - reprezentuje konfigurację aplikacji
 */
export type AppConfig = Tables<"app_config">;
/**
 * Encja FlyerStatus - reprezentuje status gazetki promocyjnej
 */
export type FlyerStatus = Enums<"flyer_status">;

// ============================================================================
// SEKCJA 2: DTO - ENDPOINTY PUBLICZNE
// ============================================================================

// ----------------------------------------------------------------------------
// Stores
// ----------------------------------------------------------------------------

/**
 * StoreDTO - reprezentacja sklepu dla API publicznego
 *
 * Endpoint: GET /api/stores, GET /api/stores/:slug
 *
 * Różnice względem Store entity:
 * - logo_path (string | null) -> logo_url (string) - pełny URL do loga
 * - brak updated_at - nie potrzebne na frontendzie
 */
export interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

/**
 * CategoryDTO - reprezentacja kategorii produktów
 *
 * Endpoint: GET /api/categories, GET /api/categories/:slug
 *
 * Różnice względem Category entity:
 * - brak updated_at - nie potrzebne na frontendzie
 */
export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------------

/**
 * BBox - reprezentuje współrzędne produktu na obrazku gazetki
 *
 * Używane do wyświetlania podświetlenia na zdjęciu
 */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * ProductDTO - bazowa reprezentacja produktu
 *
 * Zawiera dane z wielu tabel połączonych przez JOIN
 */
export interface ProductDTO {
  // Dane z products
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  description: string | null;
  promo_conditions: string | null;
  bbox: BBox | null;
  created_at: string;

  // Dane z categories
  category_name: string;
  category_slug: string;

  // Dane z stores (przez flyers)
  store_name: string;
  store_slug: string;
  store_logo: string;

  // Dane z flyers
  valid_from: string;
  valid_to: string;

  // Dane z flyer_pages
  web_image_url: string;
  page_number: number;
}

/**
 * ProductSearchDTO - produkt w wynikach wyszukiwania
 *
 * Endpoint: GET /api/products?q=...
 *
 * Rozszerza ProductDTO o relevance_score używany do sortowania
 */
export interface ProductSearchDTO extends ProductDTO {
  relevance_score: number;
}

/**
 * ProductRecentDTO - produkt na liście "ostatnio dodane"
 *
 * Endpoint: GET /api/products/recent
 *
 * Uproszczona wersja bez bbox i description
 */
export type ProductRecentDTO = Omit<ProductDTO, "bbox" | "description" | "promo_conditions">;

/**
 * ProductSearchParams - parametry wyszukiwania produktów
 *
 * Endpoint: GET /api/products
 *
 * Parametry:
 * - q: string - zapytanie wyszukiwania
 * - store: string - slug sklepu
 * - category: string - slug kategorii
 * - sort: string - metoda sortowania
 * - limit: number - liczba wyników na stronę
 * - offset: number - przesunięcie dla paginacji
 */
export interface ProductSearchParams extends PaginationParams {
  q?: string;
  store?: string;
  category?: string;
  sort?: SortOption;
}

// ----------------------------------------------------------------------------
// Flyers
// ----------------------------------------------------------------------------

/**
 * FlyerPageDTO - strona gazetki w kontekście listy
 *
 * Uproszczona wersja bez szczegółów przetwarzania
 */
export interface FlyerPageDTO {
  id: string;
  page_number: number;
  web_image_url: string;
  product_count: number;
}

/**
 * FlyerListItemDTO - gazetka na liście gazetek
 *
 * Endpoint: GET /api/flyers
 */
export interface FlyerListItemDTO {
  id: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  valid_from: string;
  valid_to: string;
  page_count: number;
  created_at: string;
}

/**
 * FlyerDetailDTO - szczegóły gazetki ze stronami
 *
 * Endpoint: GET /api/flyers/:id
 *
 * Rozszerza FlyerListItemDTO o tablicę stron
 */
export interface FlyerDetailDTO extends FlyerListItemDTO {
  pages: FlyerPageDTO[];
}

/**
 * FlyerProductDTO - produkt w kontekście gazetki
 *
 * Endpoint: GET /api/flyers/:id/products
 *
 * Mniej danych niż ProductDTO (nie ma store info, bo jest oczywiste)
 */
export interface FlyerProductDTO {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  category_name: string;
  category_slug: string;
  page_number: number;
  web_image_url: string;
  bbox: BBox | null;
}

// ============================================================================
// SEKCJA 3: DTO - ENDPOINTY ADMIN
// ============================================================================

// ----------------------------------------------------------------------------
// Admin - Flyers
// ----------------------------------------------------------------------------

/**
 * AdminFlyerListItemDTO - gazetka na liście w panelu admin
 *
 * Endpoint: GET /api/admin/flyers
 *
 * Zawiera dodatkowe informacje o statusie i weryfikacji
 */
export interface AdminFlyerListItemDTO {
  id: string;
  store_name: string;
  store_slug: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  page_count: number;
  verified_pages: number;
  deleted_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * AdminFlyerPageDetailDTO - szczegóły strony gazetki w panelu admin
 *
 * Zawiera ścieżki do oryginalnych obrazów i dane AI
 */
export interface AdminFlyerPageDetailDTO {
  id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  product_count: number;
  has_raw_ai_data: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * AdminFlyerDetailDTO - pełne szczegóły gazetki w panelu admin
 *
 * Endpoint: GET /api/admin/flyers/:id
 */
export interface AdminFlyerDetailDTO {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  deleted_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  created_at: string;
  updated_at: string;
  pages: AdminFlyerPageDetailDTO[];
}

// ----------------------------------------------------------------------------
// Admin - Flyer Pages
// ----------------------------------------------------------------------------

/**
 * AdminFlyerPageRawDTO - strona gazetki z surowymi danymi AI
 *
 * Endpoint: GET /api/admin/flyer-pages/:id
 *
 * Zawiera raw_ai_data - dane bezpośrednio z OCR/LLM
 */
export interface AdminFlyerPageRawDTO {
  id: string;
  flyer_id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  raw_ai_data: RawAIData | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * RawAIData - struktura danych zwracanych przez AI
 *
 * Przechowywane w flyer_pages.raw_ai_data jako JSONB
 */
export interface RawAIData {
  ocr_text: string;
  detected_products: DetectedProduct[];
}

/**
 * DetectedProduct - produkt wykryty przez AI
 *
 * Przed weryfikacją przez admina
 */
export interface DetectedProduct {
  name: string;
  price: string;
  unit?: string;
  description?: string;
  bbox?: BBox;
  confidence?: number;
}

// ----------------------------------------------------------------------------
// Admin - Products
// ----------------------------------------------------------------------------

/**
 * AdminProductDTO - produkt w panelu admin
 *
 * Endpoint: GET /api/admin/flyer-pages/:pageId/products
 *
 * Zawiera category_id do edycji
 */
export interface AdminProductDTO {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  description: string | null;
  promo_conditions: string | null;
  bbox: BBox | null;
  created_at: string;
  updated_at: string;
  category_id: string;
  category_name: string;
}

// ----------------------------------------------------------------------------
// Admin - Config
// ----------------------------------------------------------------------------

/**
 * ConfigDTO - element konfiguracji systemu
 *
 * Endpoint: GET /api/admin/config, GET /api/admin/config/:key
 */
export interface ConfigDTO {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Admin - Profile
// ----------------------------------------------------------------------------

/**
 * ProfileDTO - profil admina
 *
 * Endpoint: GET /api/admin/profile
 */
export interface ProfileDTO {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SEKCJA 4: COMMAND MODELS
// ============================================================================

/**
 * Command Models definiują strukturę danych wejściowych dla operacji
 * tworzenia i aktualizacji zasobów.
 *
 * Konwencja nazewnicza:
 * - Create[Resource]Command - dla POST
 * - Update[Resource]Command - dla PUT/PATCH
 */

// ----------------------------------------------------------------------------
// Auth Commands
// ----------------------------------------------------------------------------

/**
 * LoginCommand - dane do logowania
 *
 * Endpoint: POST /api/auth/login
 */
export interface LoginCommand {
  email: string;
  password: string;
}

/**
 * LoginResponse - odpowiedź z API logowania
 *
 * Endpoint: POST /api/auth/login
 */
export interface LoginResponse {
  success: boolean;
  redirect_url: string;
}

/**
 * LogoutResponse - odpowiedź z API wylogowania
 *
 * Endpoint: POST /api/auth/logout
 */
export interface LogoutResponse {
  success: boolean;
  redirect_url: string;
}

// ----------------------------------------------------------------------------
// Store Commands
// ----------------------------------------------------------------------------

/**
 * CreateStoreCommand - dane do utworzenia nowego sklepu
 *
 * Endpoint: POST /api/admin/stores
 */
export interface CreateStoreCommand {
  name: string;
  slug: string;
  logo_file?: string;
}

/**
 * UpdateStoreCommand - dane do aktualizacji sklepu
 *
 * Endpoint: PUT /api/admin/stores/:id
 *
 * Wszystkie pola opcjonalne - można zaktualizować tylko wybrane
 */
export interface UpdateStoreCommand {
  name?: string;
  slug?: string;
  logo_file?: string;
}

/**
 * DeleteStoreCommand - typ dla deleteStore
 *
 * Endpoint: DELETE /api/admin/stores/:id
 */
export interface DeleteStoreCommand {
  id: string;
  force?: boolean;
}

// ----------------------------------------------------------------------------
// Flyer Commands
// ----------------------------------------------------------------------------

/**
 * CreateFlyerCommand - dane do utworzenia nowej gazetki
 *
 * Endpoint: POST /api/admin/flyers
 */
export interface CreateFlyerCommand {
  store_id: string;
  valid_from: string;
  valid_to: string;
}

/**
 * UpdateFlyerCommand - dane do aktualizacji gazetki
 *
 * Endpoint: PATCH /api/admin/flyers/:id
 */
export interface UpdateFlyerCommand {
  valid_from?: string;
  valid_to?: string;
  status?: FlyerStatus;
}

/**
 * UploadFlyerPagesCommand - typ dla uploadu stron gazetki
 *
 * Endpoint: POST /api/admin/flyers/:flyerId/pages
 *
 * WAŻNE: Ten endpoint przyjmuje multipart/form-data, nie JSON.
 * W praktyce na frontendzie używamy FormData API:
 *
 * @example
 * const formData = new FormData();
 * files.forEach(file => formData.append('files', file));
 * await fetch('/api/admin/flyers/123/pages', {
 *   method: 'POST',
 *   body: formData
 * });
 *
 * Na backendzie przetwarzamy jako multipart, nie używamy tego typu bezpośrednio.
 * Ten typ jest głównie dla dokumentacji.
 */
export type UploadFlyerPagesCommand = FormData;

/**
 * ProcessFlyerPageCommand - parametry przetwarzania AI
 *
 * Endpoint: POST /api/admin/flyer-pages/:id/process
 */
export interface ProcessFlyerPageCommand {
  reprocess?: boolean;
}

/**
 * UpdateFlyerPageCommand - aktualizacja statusu strony
 *
 * Endpoint: PATCH /api/admin/flyer-pages/:id
 */
export interface UpdateFlyerPageCommand {
  status: FlyerStatus;
}

// ----------------------------------------------------------------------------
// Product Commands
// ----------------------------------------------------------------------------

/**
 * CreateProductCommand - dane do utworzenia produktu
 *
 * Endpoint: POST /api/admin/flyer-pages/:pageId/products
 */
export interface CreateProductCommand {
  name: string;
  price: number;
  currency?: string;
  unit?: string | null;
  description?: string | null;
  promo_conditions?: string | null;
  category_id: string;
  bbox?: BBox | null;
}

/**
 * UpdateProductCommand - dane do aktualizacji produktu
 *
 * Endpoint: PUT /api/admin/products/:id
 *
 * Wszystkie pola opcjonalne
 */
export interface UpdateProductCommand {
  name?: string;
  price?: number;
  currency?: string;
  unit?: string | null;
  description?: string | null;
  promo_conditions?: string | null;
  category_id?: string;
  bbox?: BBox | null;
}

// ----------------------------------------------------------------------------
// Config Commands
// ----------------------------------------------------------------------------

/**
 * UpdateConfigCommand - aktualizacja konfiguracji
 *
 * Endpoint: PUT /api/admin/config/:key
 */
export interface UpdateConfigCommand {
  value: Record<string, unknown>;
  description?: string;
}

// ----------------------------------------------------------------------------
// Profile Commands
// ----------------------------------------------------------------------------

/**
 * UpdateProfileCommand - aktualizacja profilu
 *
 * Endpoint: PATCH /api/admin/profile
 */
export interface UpdateProfileCommand {
  full_name?: string;
}

// ============================================================================
// SEKCJA 5: TYPY POMOCNICZE
// ============================================================================

/**
 * PaginationParams - parametry paginacji dla list
 *
 * Używane we wszystkich endpointach zwracających listy
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * PaginationMeta - metadane paginacji w response
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  has_more?: boolean;
}

/**
 * ApiResponse - standardowy wrapper dla response API
 *
 * Wszystkie endpointy zwracają dane w tym formacie
 */
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}

/**
 * ErrorCode - kody błędów
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_DATE_RANGE"
  | "INVALID_STATUS_TRANSITION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

/**
 * ApiError - standardowy format błędu
 */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

/**
 * ErrorDetail - szczegóły błędu walidacji
 */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * SortOption - opcje sortowania dla produktów
 */
export type SortOption = "relevance" | "newest" | "price_asc" | "price_desc";

/**
 * ProductSearchParams - parametry wyszukiwania produktów
 *
 * Endpoint: GET /api/products
 */
export interface ProductSearchParams extends PaginationParams {
  q?: string; // search query
  store?: string; // store slug
  category?: string; // category slug
  sort?: SortOption;
}

/**
 * AdminFlyerListParams - parametry filtrowania gazetek w admin
 *
 * Endpoint: GET /api/admin/flyers
 */
export interface AdminFlyerListParams extends PaginationParams {
  store?: string;
  status?: FlyerStatus;
  include_deleted?: boolean;
}

/**
 * UploadedPageInfo - informacje o uploadowanej stronie
 *
 * Response item w POST /api/admin/flyers/:flyerId/pages
 */
export interface UploadedPageInfo {
  id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus;
  created_at: string;
}

/**
 * UploadFlyerPagesResponse - pełny response z upload endpoint
 */
export interface UploadFlyerPagesResponse {
  flyer_id: string;
  uploaded_pages: UploadedPageInfo[];
}

/**
 * ProcessPageResponse - response z process endpoint
 */
export interface ProcessPageResponse {
  id: string;
  status: FlyerStatus;
  message: string;
}

// ============================================================================
// SEKCJA 6: VIEWMODEL TYPY - FRONTEND KOMPONENTY
// ============================================================================

// ----------------------------------------------------------------------------
// New Flyer Creator (Admin Panel)
// ----------------------------------------------------------------------------

/**
 * StoreOption - uproszczona reprezentacja sklepu dla selecta
 *
 * Źródło: mapowanie z StoreDTO lub Store entity
 */
export interface StoreOption {
  id: string; // UUID sklepu
  name: string; // Nazwa wyświetlana (np. "Biedronka")
  slug: string; // Slug dla URL
  logo_url?: string; // Opcjonalnie URL do loga (dla wizualizacji w select)
}

/**
 * FileUploadItem - reprezentacja pojedynczego pliku w uploaderze
 *
 * Zawiera plik, jego stan, podgląd i informacje o uploadzie
 */
export interface FileUploadItem {
  id: string; // Unikalny identyfikator (UUID v4)
  file: File; // Obiekt File z przeglądarki
  preview: string; // Data URL dla podglądu miniatury
  status: FileUploadStatus; // Status uploadu
  progress?: number; // Postęp uploadu 0-100 (tylko dla 'uploading')
  error?: string; // Komunikat błędu (tylko dla 'error')
  pageId?: string; // ID strony po uploadzie (tylko dla 'success')
}

/**
 * FileUploadStatus - możliwe stany pliku
 */
export type FileUploadStatus =
  | "pending" // Plik wybrany, czeka na upload
  | "validating" // Walidacja w toku
  | "invalid" // Plik nie przeszedł walidacji
  | "uploading" // Upload w toku
  | "success" // Upload zakończony sukcesem
  | "error"; // Błąd podczas uploadu

/**
 * FileValidationError - błąd walidacji pliku
 */
export interface FileValidationError {
  fileName: string;
  error: string; // Komunikat błędu
  code: "INVALID_TYPE" | "FILE_TOO_LARGE" | "INVALID_NAME";
}

/**
 * FlyerCreatorFormState - główny stan formularza
 *
 * Zawiera wszystkie dane potrzebne do utworzenia gazetki
 */
export interface FlyerCreatorFormState {
  // Metadane
  storeId: string | null;
  validFrom: string; // ISO date string (YYYY-MM-DD)
  validTo: string; // ISO date string (YYYY-MM-DD)

  // Pliki
  files: FileUploadItem[];

  // Opcje
  autoProcess: boolean;

  // Stan procesu
  flyerId: string | null; // ID utworzonej gazetki (po POST /api/admin/flyers)
  uploadStatus: UploadStatus;
  currentStep: string; // Komunikat o bieżącym kroku
  overallProgress: number; // Całkowity postęp 0-100
  uploadError: string | null;
}

/**
 * UploadStatus - status całego procesu uploadu
 */
export type UploadStatus =
  | "idle" // Początkowy stan
  | "creating_flyer" // Tworzenie rekordu gazetki (POST /api/admin/flyers)
  | "uploading_files" // Upload plików (POST /api/admin/flyers/:id/pages)
  | "processing_ai" // Uruchamianie AI (POST /api/admin/flyer-pages/:id/process)
  | "success" // Wszystko zakończone sukcesem
  | "error"; // Błąd krytyczny

/**
 * FlyerCreatorFormErrors - błędy walidacji formularza
 */
export interface FlyerCreatorFormErrors {
  store?: string;
  validFrom?: string;
  validTo?: string;
  dateRange?: string; // Błąd związany z zakresem dat
  files?: string; // Ogólny błąd plików
  fileValidation?: FileValidationError[]; // Szczegółowe błędy per plik
}

/**
 * UploadProgressInfo - informacje o postępie dla UploadProgress component
 */
export interface UploadProgressInfo {
  status: UploadStatus;
  progress: number; // 0-100
  currentStep: string;
  filesTotal: number;
  filesUploaded: number;
  error?: string;
}
