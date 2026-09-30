# BarberHQ — widoki, elementy i stany UI

**Aktualizacja 29 września 2026 · zatwierdzony zakres handoffu.** Opis po polsku; robocze etykiety UI po angielsku, zgodnie z briefem. Nazwy produktów i salonów zachowują polskie znaki. Lista wynika z [wymagań](../../.claude/specs/barberhq-replenishment-assistant.md) i [wspólnych kontraktów](../implementation/shared-contracts.md). Handoff jest dostępny w [design_handoff_barberhq](../../design_handoff_barberhq/SPEC.md); jego rozszerzenia są celowe i zaakceptowane. [Specyfikacja rozszerzeń](../../.claude/specs/approved-design-extensions.md) opisuje kontrakty i zachowanie backendu. Przegląd wizualny i test implementacji pozostają osobnymi krokami.

Projektujemy **6 głównych widoków oraz zakładkę biblioteki dokumentów**, wspólną ramę aplikacji i warianty komponentów/dialogów. Panel zamawiania jest częścią panelu salonu, a źródło odpowiedzi można rozwinąć w asystencie; nie potrzebują osobnych stron. Angular Material dostarcza standardowe kontrolki. Komponenty biznesowe i układ są własne, oparte na wspólnym motywie.

## 0. Wspólna rama aplikacji

**Elementy:** nazwa aplikacji/marki, oznaczenie środowiska demo, aktualny użytkownik i rola, nazwa salonu, nawigacja zależna od uprawnień, wylogowanie. Wybór salonu wyłącznie spośród przypisanych lokalizacji i tylko gdy jest ich kilka. Bez ogólnodostępnego przełącznika „salon/HQ”. Akcje i nawigacja bez uprawnień są niewidoczne. Prototypowe „Reset demo data” nie nadaje salonowi/HQ prawa do resetu — pozostaje narzędziem operatora poza zwykłym UI.

**Warianty:** nawigacja salonu; nawigacja HQ; mobilne menu; ładowanie uprawnień; użytkownik zalogowany bez przydzielonego dostępu; wygaśnięcie sesji; brak uprawnień do otwartego zasobu; nieznana trasa. Te ostatnie to proste komunikaty z właściwą akcją, nie rozbudowane osobne moduły.

Brak połączenia lub błąd pobierania nie może wyglądać jak pusty magazyn. Pokazuj brak danych albo ostatnie znane dane z czasem odświeżenia. Nie potwierdzaj sukcesu operacji przed odpowiedzią serwera. Stan komunikuje tekst/ikona, nie tylko kolor.

## 1. Logowanie

**Adres:** `/login` — proponowana nazwa trasy logowania.

**Elementy:** nazwa aplikacji, email, hasło, pokaż/ukryj hasło, `Sign in`, walidacja i komunikat błędu. Demo korzysta z przygotowanych kont; bez rejestracji i wyboru roli w formularzu.

| Stan | Zachowanie |
|---|---|
| Początkowy | Pusty formularz i etykiety pól |
| Niepoprawne dane wejściowe | Błędy przy polach, bez wysyłania niepoprawnego formularza |
| Logowanie trwa | Wskaźnik postępu, blokada ponownego wysłania |
| Błąd logowania/sieci | Czytelna informacja i możliwość ponowienia |
| Sprawdzanie dostępu | Po uwierzytelnieniu oczekiwanie na uprawnienia |
| Brak przydziału | Komunikat o braku dostępu oraz wylogowanie; bez odsłaniania danych biznesowych |
| Sukces | Przejście do salonu lub HQ, bez dodatkowego ekranu sukcesu |

## 2. Panel salonu

**Adres:** `/salons/:salonId`.

**Elementy:** nazwa salonu, czas odświeżenia i `Refresh`, lista sześciu produktów z pojemnością i lokalnym stanem, aktywne zamówienia z ilością/statusami oraz panel nowego zamówienia. Przykład: Legnicka, Pomada Matowa 100 ml, lokalnie 2 sztuki. Nie pokazuj cen jako kosztu transferu. Przy lokalnym on-hand ≤2 pokaż statyczny chip „Low stock” z ikoną i delikatnym tłem wiersza. Próg jest jednym ustawieniem demo; nie stanowi docelowego zapasu ani automatycznego zamówienia. „Request” w wierszu otwiera Manual z wybranym produktem.

### Panel nowego zamówienia — wspólny koszyk Assistant / Manual

Jedna lista pod obiema zakładkami: produkt, ilość 1–99, HQ available, lokalnie teraz → po pełnym odbiorze, usuń oraz etykieta pochodzenia. Manual dodaje jeden produkt; Assistant może dodać kilka. Duplikaty łączą ilości; suma >99 wymaga poprawy. Przełączenie zakładki zachowuje listę. „Submit” tworzy osobną prośbę dla każdego produktu. W fazie 4 ukryj zakładkę Assistant. Projekcja zapasu nie jest potwierdzeniem odbioru.

| Stan | Elementy i akcje |
|---|---|
| Początkowy | Pole prośby, przykładowe zdanie, `Prepare request`, dostępny formularz ręczny |
| Ręczny | Wybór produktu, ilość 1–99, `Add` do wspólnej listy, edycja/usuwanie wierszy i jawne `Submit requests` |
| Przygotowanie przez AI | Wskaźnik pracy; tylko rzeczywiste komunikaty o wykonanych działaniach, jeżeli backend je dostarcza |
| Doprecyzowanie | Pytanie przy konkretnym wierszu, wybór realnych produktów, np. Matowa/Dry Matt/Cement; Submit zablokowany do wyjaśnienia/usunięcia wszystkich niejasnych pozycji |
| Propozycja gotowa | Jeden lub kilka wierszy, salon, ilości, dostępność HQ, warunkowa projekcja stanu, „No stock reserved yet”, korekta i `Submit requests` |
| Brak zapasu | Dostępne versus potrzebne i ostrzeżenie nieblokujące wysłania prośby. Bez obietnicy realizacji. HQ/backend blokuje zatwierdzenie przy braku zapasu |
| Istniejące zamówienie | Pozycja wyłączona z wysyłania, `Open existing request`; pozostałe poprawne produkty można wysłać |
| AI niedostępne/limit/czas minął | Wyjaśnienie, zachowana treść i przejście do formularza ręcznego |
| Wysyłanie | Akcja zablokowana przed podwójnym kliknięciem, postęp |
| Wynik nieznany po przerwaniu połączenia | „Checking request status”, sprawdzenie lub ponowienie tej samej akcji; brak fałszywego komunikatu o niepowodzeniu |
| Wysłane | Lista potwierdzonych próśb i osobne linki do każdej |
| Częściowy sukces | Wynik każdego wiersza: utworzone, już aktywne, odrzucone lub nieznane; ponowienie tylko niepotwierdzonych pozycji z ich dotychczasowymi kluczami |

**Stany list:** ładowanie; dane; brak aktywnych zamówień; błąd z ponowieniem; odświeżanie/nieaktualne dane. Zero przy produkcie to rzeczywisty stan, a nie placeholder podczas ładowania. Niewysłany draft nie jest zapisanym zamówieniem i znika przy odświeżeniu. Klucze i niezmienne dane rozpoczętych operacji przechowaj do ich uzgodnienia po odświeżeniu; nie udawaj, że przerwany ekran cofnął wysłanie.

## 3. Szczegóły zamówienia / dostawy

**Adres:** `/requests/:requestId`. Jeden widok, z akcjami zależnymi od statusu i roli.

**Elementy:** identyfikator, produkt/pojemność, HQ → salon, ilość zamówiona/wysłana/odebrana, aktualny status, oś historii z aktorami i czasem, odpowiednie do uprawnień stany zapasu, obszar następnej akcji. Niewykonany etap oznacz jako oczekujący; nie dopisuj przyszłych dat lub zdarzeń.

| Stan biznesowy | Salon docelowy | HQ |
|---|---|---|
| Oczekuje na zatwierdzenie | Podgląd, oczekiwanie | `Approve` / `Reject` |
| Zatwierdzone i zarezerwowane | Podgląd, oczekiwanie na wysyłkę | `Confirm dispatch` |
| Wysłane | `Confirm receipt`; informacja, co zrobić przy uszkodzeniu/braku | Podgląd, oczekiwanie na odbiór |
| Odebrane | Podsumowanie 2/2/2; brak kolejnej akcji odbioru | Podsumowanie, brak kolejnej wysyłki |
| Odrzucone | Informacja o odrzuceniu; możliwość rozpoczęcia nowej prośby z panelu salonu | Podgląd, bez wysyłki |

Nie wymagaj powodu odrzucenia jako nowego pola backendu. Nie dodawaj anulowania po zatwierdzeniu, edycji wysłanego zamówienia ani częściowej realizacji.

**Warianty techniczne:** ładowanie; nie znaleziono/brak dostępu bez ujawniania cudzego zasobu; operacja w toku; niewystarczający zapas przy zatwierdzaniu; status zmieniony przez inną osobę; błąd; wynik nieznany; potwierdzony sukces/rozpoznana powtórzona akcja. Przy nieaktualnym stanie odśwież i wymagaj ponownego sprawdzenia akcji.

### Dialogi potwierdzenia

| Dialog | Zawartość |
|---|---|
| Zatwierdzenie | Produkt, ilość, odbiorca, dostępność HQ, informacja o rezerwacji, potwierdź/anuluj |
| Odrzucenie | Podsumowanie prośby, potwierdź/anuluj |
| Wysyłka | Produkt, ilość i salon, potwierdzenie faktycznej wysyłki, wpływ na magazyn HQ |
| Odbiór | Oczekiwana ilość, potwierdzenie odebranej ilości i że wszystkie sztuki są nieuszkodzone |

Każdy dialog ma wariant gotowy, wysyłanie i błąd. Anulowanie przed wysłaniem niczego nie zapisuje; zamknięcie po rozpoczęciu operacji nie oznacza jej cofnięcia.

Jeżeli liczba odebranych sztuk jest inna lub produkt uszkodzony, blokuj zwykły odbiór i pokaż przejście do procedur. Zamówienie pozostaje wysłane/nierozwiązane, bez dodania towaru do zapasów. Nie twórz nowego statusu backendu „Damaged”.

## 4. Panel HQ

**Adres:** `/hq`.

**Elementy:** kolejka do zatwierdzenia i sekcja gotowa do wysyłki; wiersze z salonem, produktem, ilością, czasem i statusem; `Open request`; `Refresh`; dostępność magazynu przy przeglądaniu prośby. Można użyć kart/zakładek zamiast dwóch tabel, zachowując ten sam zakres.

Akcje w wierszach, jeśli występują, otwierają te same dialogi i wykonują te same polecenia co szczegóły zamówienia. Nie projektuj drugiej logiki zatwierdzania.

**Stany:** ładowanie; prośby oczekujące; zarezerwowane do wysyłki; pusta pojedyncza sekcja; cała kolejka pusta; niewystarczający zapas; akcja w toku; prośba obsłużona przez inną osobę; błąd/ponowienie. Po wysyłce prośba znika z listy do wysyłki, ale jej szczegóły pozostają dostępne.

Bez osobnego dashboardu analitycznego, wykresów produkcji i zbiorczego zatwierdzania.

## 5. Asystent procedur

**Adres:** `/procedures`.

**Elementy:** pole pytania, `Ask`, przykład pytania o uszkodzony produkt, aktualne pytanie i odpowiedź w krokach, odwołania do źródeł, karty źródeł i `Open PDF`. Rozwijana karta zawiera dokładny fragment, tytuł, wersję, sekcję, numer fizycznej strony i oznaczenie pochodzenia.

| Stan | Co pokazujemy |
|---|---|
| Początkowy | Krótkie objaśnienie, pole i przykład pytania |
| Wyszukiwanie/przygotowanie | Wskaźnik pracy; osobne etapy tylko przy rzeczywistych zdarzeniach z backendu |
| Odpowiedź | Kroki z cytowaniami i dostępem do fragmentów/PDF |
| Doprecyzowanie | Konkretne pytanie, np. czy produkt jest uszkodzony czy brakuje go w dostawie |
| Niewystarczające źródła | Jasna informacja o brakującej wiedzy, możliwość zmiany pytania; bez wygenerowanej procedury |
| Błąd/limit/timeout | Komunikat, zachowane pytanie, ponowienie gdy możliwe |
| Źródło zmieniło się podczas odpowiedzi | Informacja o konieczności ponowienia zapytania; brak publikacji odpowiedzi jako aktualnej |

Odpowiedź dotycząca procedury i jej źródła muszą mieć widoczne „Synthetic demo procedure — not an actual Not Bad Stuff policy”. Publiczny przewodnik produktowy ma własną etykietę nieoficjalnego opracowania i nie stanowi dowodu na wewnętrzną politykę.

Brak zapisywanej historii rozmów i bocznej listy poprzednich czatów. Nowe pytanie zastępuje aktualny wynik. Brak przycisków wysłania zgłoszenia, przyznania zamiennika, korekty zapasów lub wysłania emaila. Scenariusz Zakładowej jest niezależny od zakończonego transferu Legnickiej.

### 5b. Biblioteka dokumentów

**Adres:** `/procedures?tab=documents`. Salon: zakładki Assistant / Documents. HQ: nawigacja Procedure docs i zarządzanie biblioteką.

**Elementy wspólne:** tytuł, wersja, rodzaj/etykieta pochodzenia, bieżący lub Superseded, `Open`. Salon widzi dozwolone opublikowane wersje. HQ dodatkowo widzi stan przetwarzania, `Add document`, `Review and publish`, `Retry` i `Delete`.

| Stan / dialog | Zawartość i zachowanie |
|---|---|
| Ładowanie / pusto / błąd | Czytelny komunikat, Retry; pusty stan HQ z Add document |
| Dodawanie PDF | Drop zone/file picker, tytuł, język, rodzaj źródła, nowy dokument lub zastąpienie istniejącego; limity 10 MiB/30 stron |
| Wysyłanie / przetwarzanie | Faktyczny etap z serwera; można wrócić później, bez udawanego procentu kompletności |
| Plik nieobsługiwany | Przyczyna: format, szyfrowanie, rozmiar, skan lub nieobsługiwany układ; brak publikacji |
| Oczekuje na przegląd | Oryginalny PDF i wyekstrahowany tekst każdej strony; jawne potwierdzenie pełnego przeglądu przed publikacją |
| Gotowy / nowa wersja | Dopiero potwierdzona publikacja zmienia bieżące źródło; poprzednia wersja otrzymuje Superseded |
| Błąd / konflikt wersji | Poprzednie źródło pozostaje aktywne; Retry lub odświeżenie i ponowny przegląd |
| Usuwanie | Dialog nazywa wersję i wyjaśnia odebranie dostępu przy zachowaniu prywatnego oryginału/audytu; usunięcie bieżącej nie przywraca starej |
| Brak uprawnień / cofnięty dostęp | Akcja/źródło niedostępne; odśwież listę bez ujawniania cudzych danych |

Nie ma edytora treści PDF ani panelu OCR. Importowane procedury demo nadal mają etykietę syntetycznego materiału. Publikacja oznacza gotowość do demonstracyjnego wyszukiwania, nie oficjalną akceptację polityki firmy.

## 6. Podgląd oryginalnego PDF

**Adres:** `/procedures/sources/:versionId?page=N&chunk=CHUNK_ID`; wejście z biblioteki może nie mieć chunk.

**Elementy:** powrót do odpowiedzi, tytuł, wersja, etykieta pochodzenia, numer strony/liczba stron, poprzednia/następna strona, powiększanie/obrót, podświetlenie cytowanego fragmentu oraz pobranie przez autoryzowany dostęp. Powrót w tej samej sesji powinien zachować bieżące pytanie/odpowiedź w pamięci; nie wymaga historii rozmów w bazie.

**Stany:** pobieranie; otwarty na cytowanej stronie z dokładnym podświetleniem; brak geometrii z uczciwym komunikatem i fragmentem tekstu; błędny chunk/wersja; błąd pobierania z ponowieniem; błąd renderowania z opcją pobrania; brak dostępu/cofnięty dostęp; historyczna wersja z oznaczeniem „Superseded”; niepoprawny numer strony z komunikatem i poprawną nawigacją.

Nie pokazuj ścieżek Storage, tokenów ani wymyślonych numerów stron. Przykładowa strona 2 w handoffie dotyczy jego sample PDF; implementacja bierze stronę i prostokąty z ekstrakcji właściwej wersji. PDF.js renderuje stronę i nakłada prostokąty w tej samej transformacji, również przy zoomie/obrocie. Nie wyznaczaj podświetlenia modelem ani na sztywno. Biblioteka i upload są opisane w 5b; edytor PDF pozostaje poza zakresem.

## Zestaw makiet do przygotowania w Claude Design

Najpierw pełne widoki przy jednej wspólnej szerokości desktopowej:

1. Logowanie.
2. Panel Legnickiej: lokalnie 2 Matowa, bez aktywnych próśb.
3. Ten sam panel z propozycją zamówienia 2 sztuk i dostępnością HQ 18.
4. Szczegóły oczekującej prośby w roli HQ.
5. Panel HQ z osobnymi prośbami oczekującymi i gotowymi do wysyłki — bez duplikowania tego samego zamówienia w obu sekcjach.
6. Szczegóły wysłanego zamówienia w roli Legnickiej i dialog odbioru.
7. Szczegóły zakończone: 2/2/2, HQ16, Legnicka4, w drodze0.
8. Procedury: pytanie Zakładowej, odpowiedź z widoczną etykietą i rozwiniętym źródłem.
9. PDF na cytowanej stronie z podświetlonym fragmentem.
10. Koszyk trzech produktów: poprawny, niejednoznaczny, częściowo wysłany.
11. Biblioteka w roli salonu i HQ; upload, przegląd, gotowa nowa wersja, błąd oraz usuwanie.

Warianty krytyczne można pokazać jako osobne fragmenty/komponenty: niejednoznaczny produkt, brak zapasu, istniejąca prośba, nieaktualny stan, nieznany wynik operacji, niezgodny odbiór, brak źródeł, AI niedostępne i brak dostępu. Pozostałe dialogi i stany formularzy przedstaw jako warianty komponentów, bez ponownego rysowania całej strony.

Dodaj mobilny panel salonu, odbiór i odpowiedź z cytowaniami. Ustal zachowanie tabel/kart bez poziomego przewijania całej strony; na małej szerokości źródła mogą pojawiać się pod odpowiedzią.

## Przekazanie agentowi

Eksport ZIP/HTML, zrzuty wybranych widoków, opis motywu i spis przedstawionych wariantów. Każdą makietę oznacz numerem widoku, rolą, stanem i szerokością. Rozszerzenia obecnego handoffu są zatwierdzone; reguły retry, publikacji i geometrii doprecyzowuje specyfikacja rozszerzeń. HTML jest referencją wizualną, nie kodem do bezpośredniego portowania.

W fazie 4 powstają manualny koszyk, biblioteka z zarządzaniem HQ, niski stan oraz PDF viewer z podświetleniem. Faza 5 dodaje przygotowanie wielu pozycji przez AI, a faza 6 odpowiedzi RAG. Można zaprojektować je razem, ale niewdrożone funkcje nie powinny udawać działających w aplikacji.
