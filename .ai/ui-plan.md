# Architektura UI dla DealSpy

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika DealSpy opiera się na modelu hybrydowym, wykorzystującym **Astro 5** jako szkielet aplikacji. Projekt realizuje założenie wyraźnej separacji (Separation of Concerns) między szybkim, publicznym widokiem dla użytkowników (Gości), a interaktywnym panelem zarządzania dla Administratorów.

### Kluczowe założenia architektoniczne:

1.  **Dual Layout System**:
    *   `PublicLayout`: Skupiony na SEO, Core Web Vitals i renderowaniu po stronie serwera (SSR). Wykorzystuje statyczne komponenty Astro tam, gdzie to możliwe, oraz lekkie wyspy React (Islands Architecture) dla interaktywności (np. filtry, karuzele).
    *   `AdminLayout`: Chroniony przez Middleware, zawiera logikę sesji, sidebar nawigacyjny i globalny kontekst stanu aplikacji (np. powiadomienia, stan uploadu). Renderowany głównie jako aplikacja SPA wewnątrz Astro.

2.  **Mobile-First Design**:
    *   Publiczny interfejs projektowany priorytetowo pod urządzenia mobilne (touch targets, gesty swipe, Drawery zamiast Modali na mobile).
    *   Panel Admina zoptymalizowany pod Desktop (duże ekrany) ze względu na specyfikę pracy z mapowaniem produktów na obrazach (Split-Screen).

3.  **Strategia wyświetlania obrazów**:
    *   Zamiast generowania tysięcy małych plików po stronie serwera, UI wykorzystuje **CSS Clip-path**.
    *   Przeglądarka pobiera jeden zoptymalizowany obraz strony gazetki (WebP), a "wycinki" produktów są renderowane dynamicznie poprzez style CSS na podstawie koordynatów (`bbox`) z bazy danych. Zmniejsza to koszty storage i liczbę żądań HTTP.

4.  **Zarządzanie stanem**:
    *   **Public**: URL Search Params jako "Single Source of Truth" dla wyszukiwania i filtrów (umożliwia łatwe udostępnianie linków).
    *   **Admin**: React State / Context API + React Hook Form dla formularzy. Astro Actions do mutacji danych.

---

## 2. Lista widoków

### A. Kontekst Publiczny (Dostęp Gościa)

#### 1. Strona Główna (Dashboard Publiczny)
*   **Ścieżka:** `/`
*   **Cel:** Natychmiastowe zaangażowanie użytkownika i przekierowanie do wyszukiwania lub konkretnego sklepu.
*   **Kluczowe informacje:** Pasek wyszukiwania, lista sklepów (kafelki), sekcja "Ostatnie okazje".
*   **Komponenty:** `HeroSearch`, `StoreGrid`, `RecentProductsRail` (poziomy scroll), `BottomNav` (mobile).
*   **UX/A11y:** Focus na wyszukiwarce po załadowaniu. Duże obszary klikalne dla sklepów. Skeleton loading dla produktów.

#### 2. Wyniki Wyszukiwania i Listing
*   **Ścieżka:** `/szukaj` (parametry: `?q=...&store=...&cat=...`)
*   **Cel:** Umożliwienie znalezienia konkretnego produktu i porównania cen.
*   **Kluczowe informacje:** Lista produktów, aktywne filtry, sortowanie, stan "brak wyników".
*   **Komponenty:** `FilterSidebar` (Desktop) / `FilterDrawer` (Mobile), `ProductCard`, `SortDropdown`, `InfiniteScrollTrigger`.
*   **UX/A11y:** Zachowanie pozycji scrolla przy powrocie. Filtry dostępne z klawiatury. Komunikaty o błędach wyszukiwania.

#### 3. Szczegóły Produktu (Modal/Page)
*   **Ścieżka:** `/produkt/[id]` (oraz jako Intercepting Route/Modal na liście)
*   **Cel:** Prezentacja oferty, kontekstu (data ważności) i dowodu (wycinek gazetki).
*   **Kluczowe informacje:** Nazwa, cena, jednostka, nazwa sklepu, daty obowiązywania, **Wycinek z gazetki** (Clip-path).
*   **Komponenty:** `ProductClippedImage`, `PriceTag`, `ValidityBadge`, `StoreInfoLink`.
*   **UX/A11y:** Przycisk "Zamknij" łatwo dostępny kciukiem na mobile. Nawigacja do pełnej gazetki ("Zobacz całą gazetkę").

#### 4. Profil Sklepu
*   **Ścieżka:** `/sklepy/[slug]`
*   **Cel:** Agregacja wszystkich aktywnych gazetek danej sieci.
*   **Kluczowe informacje:** Logo, lista aktywnych gazetek, lista archiwizowanych (opcjonalnie).
*   **Komponenty:** `StoreHeader`, `FlyerCard`.

#### 5. Przeglądarka Gazetki
*   **Ścieżka:** `/gazetki/[id]`
*   **Cel:** Cyfrowa imitacja przeglądania papierowej gazetki.
*   **Kluczowe informacje:** Obrazy stron, nawigacja (poprzednia/następna), lista produktów na danej stronie.
*   **Komponenty:** `FlyerCarousel` (obsługa gestów swipe), `PageProductsList` (pod stroną).
*   **UX:** Preloading sąsiednich stron. Zoom na dwuklik.

---

### B. Kontekst Administratora (Dostęp Chroniony)

#### 6. Logowanie Admina
*   **Ścieżka:** `/admin/login`
*   **Cel:** Bezpieczne uwierzytelnienie.
*   **Komponenty:** `LoginForm` (email/password).
*   **Bezpieczeństwo:** Przekierowanie zalogowanych użytkowników. Obsługa błędów autoryzacji.

#### 7. Dashboard Admina
*   **Ścieżka:** `/admin`
*   **Cel:** Szybki podgląd stanu systemu i zadań do wykonania.
*   **Kluczowe informacje:** Liczba gazetek w procesie, oczekujące weryfikacje, ostatnio dodane.
*   **Komponenty:** `StatsCards`, `TodoTable` (linki do weryfikacji).

#### 8. Zarządzanie Gazetkami (Lista)
*   **Ścieżka:** `/admin/gazetki`
*   **Cel:** Przegląd wszystkich gazetek i ich statusów (Draft, Processing, Published).
*   **Komponenty:** `DataTable` (z filtrowaniem i sortowaniem), `StatusBadge`, `ActionMenu` (Edytuj, Usuń, Publikuj).

#### 9. Kreator Nowej Gazetki (Upload)
*   **Ścieżka:** `/admin/gazetki/nowa`
*   **Cel:** Wgranie plików i inicjalizacja procesu AI.
*   **Kluczowe informacje:** Formularz metadanych (Sklep, Daty), Strefa zrzutu plików.
*   **Komponenty:** `MetadataForm`, `FileUploader` (Drag&Drop, podgląd miniatur, progress bar), `ProcessButton`.
*   **UX:** Walidacja plików przed wysłaniem. Ostrzeżenie przed zamknięciem karty w trakcie uploadu.

#### 10. Studio Weryfikacji (Kluczowy Widok)
*   **Ścieżka:** `/admin/weryfikacja/[pageId]`
*   **Cel:** Korekta danych zwróconych przez AI (Human-in-the-loop).
*   **Układ:** Split-screen (Lewo: Obraz, Prawo: Formularz/Lista).
*   **Kluczowe komponenty:**
    *   **ImageCanvas:** Interaktywny obraz z możliwością rysowania prostokątów (BBox), zoomowania (pan & zoom).
    *   **ProductList:** Lista wykrytych produktów.
    *   **ProductEditor:** Formularz edycji wybranego produktu.
*   **UX:** Skróty klawiszowe (Ctrl+S zapisz, Strzałki nawigacja). Synchronizacja hover (najechane na liście podświetla na obrazie i vice versa). Wizualne oznaczanie zweryfikowanych produktów.

#### 11. Konfiguracja i Sklepy
*   **Ścieżka:** `/admin/sklepy`, `/admin/ustawienia`
*   **Cel:** CRUD słowników i ustawień globalnych (np. Prompty AI).
*   **Komponenty:** `StoreForm` (z uploadem logo), `JsonEditor` (dla configu).

---

## 3. Mapa podróży użytkownika (User Journey)

### Scenariusz A: Gość szuka taniego masła
1.  **Wejście:** Użytkownik wchodzi na stronę główną.
2.  **Akcja:** Wpisuje "Masło" w główny pasek wyszukiwania.
3.  **Wyniki:** System przenosi na widok `/szukaj?q=Masło`. Wyświetla listę produktów z różnych sklepów.
4.  **Filtrowanie:** Użytkownik klika "Sortuj: Cena rosnąco".
5.  **Szczegóły:** Użytkownik klika w najtańszy produkt.
6.  **Weryfikacja:** Otwiera się Modal. Użytkownik widzi wycinek z gazetki, sprawdza "Maksymalnie 3 sztuki".
7.  **Kontekst:** Użytkownik klika "Zobacz całą gazetkę", aby sprawdzić inne promocje w tym sklepie.
8.  **Eksploracja:** Przegląda gazetkę w widoku karuzeli `/gazetki/[id]`.

### Scenariusz B: Administrator procesuje nową gazetkę
1.  **Upload:** Admin wchodzi w "Dodaj gazetkę", wybiera "Biedronka", ustawia daty, wrzuca 10 plików JPG.
2.  **Przetwarzanie:** Klika "Prześlij i procesuj". System uploaduje pliki i w tle uruchamia AI.
3.  **Oczekiwanie:** Status zmienia się na "Processing". Admin widzi pasek postępu (polling).
4.  **Weryfikacja:** Status zmienia się na "Do weryfikacji". Admin wchodzi w pierwszą stronę.
5.  **Korekta:**
    *   Widzi, że AI pominęło cenę przy jednym produkcie.
    *   Klika w produkt na liście -> Obraz centruje się na nim.
    *   Poprawia cenę w formularzu.
    *   Zauważa brakujący produkt. Rysuje nowy BBox na obrazie -> Wypełnia nazwę i cenę.
6.  **Zatwierdzenie:** Klika "Zatwierdź stronę". Przechodzi do następnej.
7.  **Publikacja:** Po zatwierdzeniu wszystkich stron, klika "Opublikuj gazetkę". Oferty stają się widoczne dla Gości.

---

## 4. Układ i struktura nawigacji

### Public Layout
*   **Header (Sticky):**
    *   Logo (powrót do home).
    *   Search Bar (na mobile zwija się do ikony lupy).
    *   Menu Burger (Mobile) / Linki (Desktop): Sklepy, Gazetki.
*   **Main Content:** Szerokość kontenera z max-width, responsywny padding.
*   **Footer:** Linki prawne, Social media.
*   **Mobile Bottom Bar (Opcjonalnie):** Home, Szukaj, Sklepy (dla łatwiejszej nawigacji kciukiem).

### Admin Layout
*   **Sidebar (Desktop) / Drawer (Mobile):**
    *   Sekcja użytkownika (Avatar, Wyloguj).
    *   Nawigacja główna: Dashboard, Gazetki, Sklepy.
    *   Nawigacja systemowa: Ustawienia, Logi (opcjonalnie).
*   **Top Bar:**
    *   Breadcrumbs (Ścieżka okruszkowa) – kluczowe dla głębokiej struktury (Gazetki > [ID] > Strona [NR]).
    *   Wskaźnik statusu systemu (np. "AI Services: Online").
*   **Content Area:** Główny obszar roboczy z paddingiem.

---

## 5. Kluczowe komponenty UI

1.  **`ProductClippedImage`**
    *   Komponent wyświetlający "wykadrowany" produkt bez fizycznego cięcia obrazu.
    *   Używa: `background-image: url(pełna_strona.webp)`, `background-position`, `background-size` oraz kontenera o wymiarach proporcjonalnych do `bbox`.
    *   Cel: Optymalizacja wydajności i transferu.

2.  **`VerificationCanvas` (Admin)**
    *   Wrapper na bibliotekę canvas/svg. Umożliwia rysowanie prostokątów na obrazie.
    *   Obsługuje przeliczanie koordynatów relatywnych (%) na absolutne (px) przy zmianie rozmiaru okna.
    *   Funkcje: Highlight, Resize handles, Drag & Drop (przesuwanie bboxa).

3.  **`FilterDrawer` (Public Mobile)**
    *   Wysuwany panel od dołu ekranu (Sheet).
    *   Zawiera akordeony dla kategorii i sklepów.
    *   Przycisk "Pokaż X wyników" (Sticky bottom).

4.  **`StatusBadge`**
    *   Wizualna reprezentacja stanu (Draft: szary, Processing: animowany niebieski/żółty, Verification: pomarańczowy, Published: zielony).
    *   Używany w listach gazetek i stron.

5.  **`ApiErrorBouncer`**
    *   Niewidoczny komponent lub HOC (Higher Order Component) obsługujący błędy globalne.
    *   Przechwytuje błędy 401 (wygasła sesja) i przekierowuje do logowania.
    *   Wyświetla toasty dla błędów 4xx/5xx.

