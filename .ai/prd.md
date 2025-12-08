# Dokument wymagań produktu (PRD) - DealSpy

## 1. Przegląd produktu

DealSpy to aplikacja internetowa typu Aggregator Promocji, której celem jest cyfryzacja i ustrukturyzowanie ofert handlowych pochodzących z papierowych gazetek promocyjnych sieci handlowych. System rozwiązuje problem manualnego przeglądania wielostronicowych plików graficznych poprzez zastosowanie hybrydowego przetwarzania AI (OCR + LLM) oraz weryfikacji przez człowieka (Human-in-the-loop).

Platforma jest skierowana do dwóch grup odbiorców:
1. Administratorów - odpowiedzialnych za wprowadzanie danych, zasilanie systemu obrazami gazetek i weryfikację poprawności odczytów AI.
2. Użytkowników końcowych (Gości) - poszukujących najtańszych produktów spożywczych i przemysłowych, korzystających z szybkiej wyszukiwarki i porównywarki cen.

Aplikacja jest budowana w architekturze Mobile-First dla widoku publicznego, wykorzystując Astro 5 (SSR) i Supabase, co zapewnia wysoką wydajność i niskie opóźnienia.

## 2. Problem użytkownika

Obecnie konsumenci chcący znaleźć najlepsze promocje w sklepach stacjonarnych muszą:
- Odwiedzać wiele stron internetowych różnych sieci handlowych.
- Pobierać i przeglądać nieporęczne pliki PDF lub galerie zdjęć.
- Ręcznie porównywać ceny między sklepami (brak możliwości wyszukiwania konkretnego produktu, np. "masło", w wielu gazetkach jednocześnie).
- Weryfikować daty ważności gazetek, często natrafiając na nieaktualne oferty.

Dla Administratora problemem jest czasochłonność ręcznego przepisywania danych z gazetek do bazy danych. DealSpy automatyzuje ten proces, redukując go do roli nadzorczej (weryfikacja i korekta).

## 3. Wymagania funkcjonalne

### 3.1. Panel Administratora (Back-office)
- System uwierzytelniania (Logowanie e-mail/hasło) tylko dla zdefiniowanych administratorów.
- Zarządzanie listą sklepów (Nazwa, Logo).
- Moduł uploadu gazetek:
  - Obsługa plików graficznych (JPG, PNG, WEBP).
  - Limit wielkości pliku: 10MB.
  - Możliwość wgrania wielu stron jednocześnie dla jednej gazetki.
  - Przypisanie daty obowiązywania (od-do) dla całej gazetki.
- Przetwarzanie AI:
  - Sekwencyjne przetwarzanie: OCR (ekstrakcja tekstu i koordynatów) -> LLM (strukturyzacja danych do JSON).
  - Próba automatycznego dopasowania Bounding Box (ramki na zdjęciu) do wykrytego produktu.
- Panel Weryfikacji (Human-in-the-loop):
  - Widok split-screen: Oryginał strony gazetki vs. Formularz edycji produktu.
  - Możliwość ręcznego rysowania/poprawiania Bounding Box na obrazie (Crop).
  - Edycja pól: Nazwa, Cena, Jednostka, Opis/Warunki, Kategoria.
  - Możliwość ręcznego dodania produktu pominiętego przez AI.
  - Przycisk "Zatwierdź stronę" publikujący produkty.

### 3.2. Interfejs Publiczny (Front-office)
- Strona główna (Dashboard):
  - Sekcja "Ostatnio dodane okazje".
  - Lista sklepów (kafelki) prowadząca do widoku gazetek danego sklepu.
- Wyszukiwarka produktów:
  - Wyszukiwanie pełnotekstowe (Full Text Search) po nazwie produktu i opisie.
  - Wyniki prezentowane w formie listy kart produktów.
- Filtrowanie i Sortowanie:
  - Sortowanie: Od najnowszych, Cena rosnąco, Cena malejąco.
  - Filtrowanie po sklepie.
  - Filtrowanie po kategorii.
- Szczegóły produktu:
  - Wyświetlanie wykadrowanego fragmentu gazetki (na podstawie Bounding Box).
  - Informacja o cenie, sklepie i dacie ważności oferty.
  - Tekstowe warunki promocji.
- Responsywność: Pełne dostosowanie do urządzeń mobilnych (Mobile-first).

### 3.3. Logika Systemowa i Dane
- Struktura kategorii (zamknięta lista startowa):
  1. Nabiał i Jaja
  2. Pieczywo i Cukiernia
  3. Owoce i Warzywa
  4. Mięso i Wędliny
  5. Ryby i Owoce Morza
  6. Napoje i Alkohol
  7. Słodycze i Przekąski
  8. Produkty sypkie i Dania gotowe
  9. Mrożonki
  10. Chemia i Kosmetyki
  11. Dla Domu i Zwierząt
  12. Inne
- Optymalizacja obrazów:
  - Oryginały przechowywane w prywatnym buckecie (dla Admina/AI).
  - Publiczne wersje przekonwertowane do WebP (max 1000px szerokości) dla użytkowników.
- Automatyzacja widoczności:
  - Produkty i gazetki, których data końcowa minęła, są automatycznie ukrywane w widokach publicznych (soft delete lub filtr w zapytaniu).

## 4. Granice produktu

### W ZAKRESIE (In-Scope)
- Obsługa formatów wejściowych: JPG, PNG, WEBP.
- Ręczny upload plików przez panel administratora.
- Przetwarzanie OCR i strukturyzacja danych przez LLM.
- Ręczna weryfikacja i poprawa danych przez administratora.
- Publiczny dostęp dla niezalogowanych użytkowników (Gości).
- Wyszukiwanie i przeglądanie ofert.

### POZA ZAKRESEM (Out-of-Scope)
- Rejestracja i logowanie dla użytkowników końcowych (brak profili, ulubionych, list zakupowych).
- Automatyczne pobieranie (scraping) gazetek ze stron sklepów.
- Obsługa plików PDF (wymagana wcześniejsza konwersja do obrazów poza systemem).
- System powiadomień (e-mail, push, SMS).
- Geolokalizacja użytkownika i wskazywanie najbliższego sklepu.
- System rekomendacji oparty na historii wyszukiwania.
- Zaawansowana analityka zachowań użytkowników.

## 5. Historyjki użytkowników

### Uwierzytelnianie i Bezpieczeństwo

#### US-001 Logowanie Administratora
- ID: US-001
- Tytuł: Logowanie do panelu administracyjnego
- Opis: Jako Administrator chcę zalogować się do systemu przy użyciu e-maila i hasła, aby uzyskać dostęp do funkcji zarządzania treścią.
- Kryteria akceptacji:
  1. Użytkownik widzi formularz logowania na dedykowanej ścieżce (np. /admin).
  2. Podanie poprawnych danych przekierowuje do Dashboardu Administratora.
  3. Podanie błędnych danych wyświetla komunikat błędu.
  4. Sesja użytkownika jest zachowana po odświeżeniu strony.
  5. Próba wejścia na podstrony /admin bez sesji skutkuje przekierowaniem do logowania.

#### US-002 Wylogowanie Administratora
- ID: US-002
- Tytuł: Wylogowanie z systemu
- Opis: Jako Administrator chcę móc się wylogować, aby zapobiec nieautoryzowanemu dostępowi do panelu na współdzielonym urządzeniu.
- Kryteria akceptacji:
  1. Przycisk wylogowania jest dostępny w widocznym miejscu panelu admina.
  2. Kliknięcie powoduje zakończenie sesji i przekierowanie na stronę główną lub stronę logowania.

### Zarządzanie Sklepami i Gazetkami (Administrator)

#### US-003 Dodawanie nowej gazetki
- ID: US-003
- Tytuł: Upload zdjęć gazetki
- Opis: Jako Administrator chcę wgrać pliki graficzne reprezentujące strony gazetki i przypisać je do konkretnego sklepu oraz okresu obowiązywania.
- Kryteria akceptacji:
  1. Admin wybiera sklep z listy.
  2. Admin definiuje datę początkową i końcową obowiązywania.
  3. Admin może wybrać wiele plików z dysku (drag & drop lub wybór plików).
  4. System weryfikuje format (jpg/png/webp) i rozmiar (<10MB).
  5. Po zatwierdzeniu pliki są wysyłane na serwer, a w bazie tworzony jest rekord gazetki ze statusem "Draft" (lub "Do przetworzenia").

#### US-004 Uruchomienie przetwarzania AI
- ID: US-004
- Tytuł: Ekstrakcja danych z obrazu
- Opis: Jako Administrator chcę, aby system automatycznie odczytał produkty ze zdjęć, abym nie musiał wpisywać ich ręcznie.
- Kryteria akceptacji:
  1. Proces uruchamia się automatycznie po uploadzie lub na żądanie przyciskiem.
  2. System wykonuje OCR na obrazie.
  3. System przesyła tekst z OCR do LLM w celu ustrukturyzowania.
  4. Po zakończeniu, status strony gazetki zmienia się na "Do weryfikacji".
  5. W przypadku błędu API, system informuje o niepowodzeniu.

#### US-005 Panel weryfikacji danych (Human-in-the-loop)
- ID: US-005
- Tytuł: Weryfikacja i korekta wykrytych produktów
- Opis: Jako Administrator chcę widzieć wykryte produkty obok oryginalnego zdjęcia, aby poprawić błędy w cenie, nazwie lub kadrze.
- Kryteria akceptacji:
  1. Ekran podzielony na dwie części: podgląd obrazu (z możliwością zoomu) i lista produktów.
  2. Kliknięcie w produkt na liście podświetla jego przybliżoną lokalizację na obrazie (jeśli wykryto).
  3. Admin może edytować każde pole: Nazwa, Cena, Jednostka, Kategoria (dropdown), Opis.
  4. Admin może narysować lub poprawić prostokąt (Bounding Box) na obrazie, który definiuje wycinek produktu.
  5. Admin może usunąć błędnie wykryty produkt (np. reklamę).

#### US-006 Ręczne dodawanie produktu
- ID: US-006
- Tytuł: Dodanie pominiętego produktu
- Opis: Jako Administrator chcę ręcznie dodać produkt, którego AI nie wykryło, zaznaczając go na zdjęciu.
- Kryteria akceptacji:
  1. Przycisk "Dodaj produkt" w panelu weryfikacji.
  2. Admin rysuje obszar produktu na zdjęciu gazetki.
  3. Admin wypełnia formularz z danymi produktu.
  4. Produkt jest dodawany do listy na danej stronie.

#### US-007 Publikacja gazetki
- ID: US-007
- Tytuł: Zatwierdzenie i publikacja
- Opis: Jako Administrator chcę zatwierdzić zweryfikowane strony, aby stały się widoczne dla użytkowników.
- Kryteria akceptacji:
  1. Możliwość zmiany statusu gazetki z "Draft" na "Opublikowana".
  2. Tylko opublikowane gazetki i ich produkty są widoczne w API publicznym.

### Przeglądanie Ofert (Użytkownik Końcowy)

#### US-008 Dashboard (Strona główna)
- ID: US-008
- Tytuł: Przeglądanie najnowszych okazji
- Opis: Jako Użytkownik chcę widzieć ostatnio dodane promocje zaraz po wejściu na stronę, aby być na bieżąco.
- Kryteria akceptacji:
  1. Sekcja wyświetlająca siatkę produktów posortowaną wg daty dodania (malejąco).
  2. Sekcja z listą sklepów (logo + nazwa).
  3. Interfejs ładuje się szybko (SSR).

#### US-009 Wyszukiwanie produktów
- ID: US-009
- Tytuł: Wyszukiwanie tekstowe
- Opis: Jako Użytkownik chcę wpisać nazwę produktu w pasek wyszukiwania, aby znaleźć wszystkie aktualne promocje na ten towar.
- Kryteria akceptacji:
  1. Pasek wyszukiwania dostępny w nagłówku.
  2. Wpisanie frazy (np. "kawa") i zatwierdzenie wyświetla listę pasujących produktów.
  3. Wyniki zawierają tylko aktualne oferty (nieprzeterminowane).
  4. Wyszukiwanie jest odporne na wielkość liter.

#### US-010 Szczegóły produktu i wycinek gazetki
- ID: US-010
- Tytuł: Podgląd szczegółów i wycinka
- Opis: Jako Użytkownik chcę zobaczyć oryginalny wycinek gazetki dla danego produktu, aby przeczytać drobny druk i zweryfikować ofertę.
- Kryteria akceptacji:
  1. Kliknięcie w kartę produktu otwiera widok szczegółów (modal lub nowa strona).
  2. Wyświetlany jest obraz (WebP) wykadrowany zgodnie z Bounding Boxem ustawionym przez admina.
  3. Wyświetlane są dane tekstowe: Cena, Sklep, Data ważności, Warunki.

#### US-011 Filtrowanie i Sortowanie wyników
- ID: US-011
- Tytuł: Sortowanie listy produktów
- Opis: Jako Użytkownik chcę posortować wyniki wyszukiwania po cenie, aby znaleźć najtańszą ofertę.
- Kryteria akceptacji:
  1. Dropdown z opcjami: "Najnowsze", "Cena: rosnąco", "Cena: malejąco".
  2. Zmiana opcji natychmiastowo przeładowuje listę wyników.

#### US-012 Przeglądanie gazetek sklepu
- ID: US-012
- Tytuł: Widok strony sklepu
- Opis: Jako Użytkownik chcę wejść w profil sklepu (np. Biedronka), aby zobaczyć listę jego aktualnych gazetek.
- Kryteria akceptacji:
  1. Kliknięcie w logo sklepu przenosi do widoku sklepu.
  2. Lista dostępnych gazetek z datami obowiązywania.
  3. Kliknięcie w gazetkę pozwala przeglądać jej strony (opcjonalnie: lub listę produktów z tej gazetki).

### Systemowe

#### US-013 Automatyczne ukrywanie ofert
- ID: US-013
- Tytuł: Wygasanie ofert
- Opis: Jako Użytkownik nie chcę widzieć ofert, które są już nieaktualne.
- Kryteria akceptacji:
  1. System automatycznie filtruje zapytania do bazy danych, wykluczając rekordy, gdzie data końcowa < data dzisiejsza.
  2. Nie jest wymagana akcja administratora do archiwizacji.

## 6. Metryki sukcesu

- Skuteczność AI (Pre-verification Accuracy): Minimum 75% produktów na stronie gazetki jest poprawnie zidentyfikowanych (nazwa + cena) przed interwencją administratora.
- Czas ładowania (Performance): First Contentful Paint (FCP) na stronie głównej poniżej 2.0s na urządzeniach mobilnych (sieć 4G).
- Jakość danych (Data Integrity): 100% opublikowanych ofert posiada poprawną cenę i przypisany obraz (wycinek) - zapewnione przez proces Human-in-the-loop.
- Czytelność (Mobile UX): 100% obrazów publicznych serwowanych w formacie WebP dla zminimalizowania transferu danych.

