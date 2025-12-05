# Aplikacja - {DealSpy} (MVP)

## Główny problem

Użytkownicy (klienci dyskontów i osoby szukające okazji) mają trudność ze sprawnym śledzeniem promocyjnych cen z papierowych lub skanowanych gazetek. Ręczne przeglądanie wielu gazetek jest czasochłonne i podatne na pomyłki. Administratorzy (osoby wprowadzające gazetki) potrzebują narzędzia, które przyspieszy ekstrakcję listy produktów i cen z obrazów gazetek, pozostawiając ostateczną korektę człowiekowi.

Korzyści rozwiązania:
- Szybsze wyszukiwanie promocyjnych ofert.
- Centralna baza produktów z gazetki ułatwiająca porównania.
- Minimalizacja ręcznej pracy przez automatyczną ekstrakcję z obrazów.

## Najmniejszy zestaw funkcjonalności

MVP koncentruje się na prostym, powtarzalnym workflow: upload gazetek → OCR → ekstrakcja listy produktów → ręczna korekta i zapis.

W skład MVP wchodzą:
- Upload plików JPG/PNG (admin) i przechowywanie plików (lokalnie lub w storage typu S3/Supabase).
- Pipeline OCR, który zamienia strony gazetki na surowy tekst (np. Tesseract.js w prototypie, możliwość podmiany na Google Vision/AWS Textract).
- Usługa ekstrakcji strukturalnej oparta o LLM: z surowego tekstu (i opcjonalnie bbox/pozycji) generuje listę produktów z polami:
  - `name` (nazwa produktu)
  - `price` (cena)
  - `unit` (np. 1szt, kg, opak.)
  - `page` (numer strony)
  - `bbox` (opcjonalnie — bounding box pozycji na stronie)
- Admin UI (React) do przeglądu wyników ekstrakcji, ręcznej edycji/akceptacji/usuwania produktów oraz zapisu do bazy.
- Prosta baza danych (Postgres/Supabase) z tabelami: `uploads`, `pages`, `raw_ocr`, `extracted_products`, `users`.
- Minimalna autoryzacja dla konta admin (prosty login/magic link).
- Prosty mechanizm kolejkowania z retry (lokalny / in-process queue wystarczy przy wolnym wolumenie ~30 plików tygodniowo).
- Obsługa dwóch sieci (Biedronka, Lidl) jako źródła danych, bez specjalnych reguł różnicujących layouty.
 - Widok listy produktów w promocji (publiczny/administracyjny) z możliwością filtrowania po sklepie i po kategorii produktu.

Założenia operacyjne:
- Ręczne wgrywanie gazetki przez admina (brak scrapingu).
- Średni wolumen: ~30 plików tygodniowo.
- Admin poprawia wynik ekstrakcji — nie wymagamy wysokiej automatycznej dokładności na starcie.

## Co NIE wchodzi w zakres MVP

Funkcje i usprawnienia, które zostają odłożone do wersji późniejszych:
- Automatyczne pozyskiwanie (scraping) gazetek ze stron sklepów.
- Powiadomienia (email/SMS/push) o promocjach.
- Zaawansowane de-duping i konsolidacja produktów między różnymi sieciami z użyciem embeddings.
- Hostowanie lokalnych LLM lub budowanie rozbudowanych rozwiązań on-premise — na MVP wykorzystamy chmurowe API lub prosty LLM.
- Pełna automatyczna normalizacja jednostek i cen w różnych formatach (może być częściowo wsparta regułami).
- Publiczny portal/udostępnianie wyników użytkownikom końcowym (MVP zakłada wewnętrzny admin workflow).
- Skalowanie na duże wolumeny, rozproszone przetwarzanie i zaawansowana orkiestracja (Kubernetes) — zamiast tego prosty deployment (Vercel/Render + Supabase/S3).

## Kryteria sukcesu

Co uznajemy za sukces MVP:
- Działający workflow: admin może wgrać plik gazety → system uruchamia OCR → LLM zwraca listę produktów → admin może przejrzeć, edytować i zapisać produkty do bazy.
- Produkty zapisane w bazie z przynajmniej tymi polami: `name`, `price`, `unit`, `page`.
- Obsługa docelowego wolumenu: pipeline działa stabilnie przy ~30 plikach tygodniowo bez ręcznej interwencji poza korektami w UI.
- Czas od uploadu do dostępności wyników w UI: akceptowalny (np. < 10 minut dla pojedynczego uploadu w prototypie).
- UX admina: możliwość szybkiej korekty wyników (edycja wielu elementów, szybkie zatwierdzanie/usuwanie).
- Prosty plan deploymentu i podstawowa dokumentacja: instrukcja uruchomienia lokalnie oraz deployu (Vercel/Render + Supabase).

- Lista produktów w promocji dostępna w UI z filtrowaniem po sklepie i kategorii; filtrowanie powinno być responsywne i zwracać wyniki w czasie akceptowalnym (np. < 2s).

Metryki jakości (proponowane, nieblokujące wydania MVP):
- Procent pozycji, które admin nie musi poprawić ręcznie (cel początkowy: ≥ 50% automatycznie poprawnych pól, później poprawiać).
- Średni czas potrzebny adminowi na korektę jednej strony gazetki (cel: < 3 minuty/strona).
