# BarberHQ — odbiór dostawy, zgłoszenie problemu i powiązana dosyłka

25 października 2026. **Projekt zatwierdzony przez właściciela odpowiedzią „tak” po przeglądzie dokumentu.** Przegląd pod kątem planowania nie wykazał istotnych luk. Akceptacja obejmuje przygotowanie planu; nie oznacza wdrożenia ani zgody na migrację lub publikację.

## Cel i ustalenia właściciela

Salon ma przyjąć dobre produkty na stan, nawet jeżeli pozostałe sztuki są uszkodzone lub ich brakuje. Problem musi być widoczny dla HQ i mieć własną historię. Pracownik nadal korzysta z procedur w bibliotece dokumentów, aby wiedzieć, co fizycznie zrobić z produktem. Formularz i asystent nie tworzą zasad postępowania.

Potwierdzone w rozmowie:

- oddzielny, trwały zapis odbioru i zgłoszenie problemu;
- przyjęcie dobrych sztuk, bez blokowania całej dostawy;
- HQ organizuje dosyłkę jako osobne, powiązane zamówienie, korzystające ze zwykłego procesu zatwierdzenia, wysyłki i odbioru;
- sprawa kończy się po odebraniu brakujących dobrych sztuk;
- uszkodzone sztuki nie wracają automatycznie na stan HQ; ich fizyczne traktowanie wynika z procedury;
- pomysł powiadomień Firebase o statusach ma pozostać zapisany jako dalsze rozszerzenie.

## Podejście i alternatywy

**Wybrane:** oddzielny odbiór i sprawa problemowa. Zamówienie pokazuje podsumowanie obu, a dosyłka jest nowym zamówieniem powiązanym z pierwotną sprawą. Pozwala to zachować obecny model jednego transferu na zamówienie.

Rozważone alternatywy:

1. Jeden rozszerzony status i opis na zamówieniu. Mniej obiektów, ale miesza ilości przyjęte, problem oraz działania HQ; gorzej pokazuje kolejne nieudane próby dosłania.
2. Kilka transferów wewnątrz jednego zamówienia. Możliwe, lecz wymaga przebudowania obecnego klucza Transfer=requestId oraz unikalności ruchów/komend. W prostym wariancie nie jest potrzebne: osobne zamówienia na dosyłki mają własne istniejące transfery i ruchy.

Zatwierdzony projekt zastępuje zasadę pełnego, nienaruszonego odbioru z projektu z7 października wyłącznie w zakresie odbioru i powiązanych zgłoszeń. Obecna aplikacja nadal realizuje stary model do czasu wdrożenia. Nie zmieniamy projektu rozpoznawania produktów ani dyktowania zamówień.

## Zakres pierwszej wersji — propozycje projektanta

- Jedna końcowa weryfikacja każdej wysłanej dostawy; można w niej przyjąć część dobrych sztuk i zaklasyfikować resztę. To nie jest harmonogram kilku planowych paczek dla jednego transferu.
- Kategorie ilości dla oczekiwanego produktu: dobre, uszkodzone, brakujące. Inny dostarczony produkt nie jest automatycznie zamiennikiem: oczekiwane sztuki pozostają brakujące, a opis zgłoszenia rejestruje faktycznie otrzymany produkt/kod. Nadwyżki i przyjmowanie innych SKU wymagają odrębnego późniejszego przepływu.
- Jeden zbiorczy problem dla pierwotnego odbioru, z pozycjami produktowymi. Kolejne nieprawidłowe dosyłki dopisują zdarzenia do tej samej sprawy, bez tworzenia drugiego zobowiązania na te same sztuki.
- Jedna aktywna dosyłka na sprawę. Kolejna jest możliwa po końcowym sprawdzeniu poprzedniej lub jej odrzuceniu przed wysyłką. Brak anulowania po wysyłce.
- Pierwsza wersja zapisuje opis, identyfikator dostawy, produkt/kod, ilości i partię lub informację, że jej nie ustalono. Zdjęcia, jeżeli wymaga ich procedura i można je zrobić bezpiecznie, przekazywane są dotychczasowym kanałem wskazanym w procedurze. Nowy uploader załączników nie jest częścią tej wersji.
- Księgowane odbiory są nieedytowalne. Korekty pomyłek po zatwierdzeniu, zwroty, utylizacja, roszczenia i rozliczenia pieniężne pozostają osobnymi, przyszłymi procesami; aplikacja nie symuluje ich zmianą statusu zgłoszenia.

Są to jawne propozycje ograniczające zakres, a nie dodatkowe ustalenia przypisane właścicielowi.

## Co oznaczają statusy

### Zamówienie i dostawa

Obecne PENDING_APPROVAL → RESERVED → DISPATCHED oraz REJECTED pozostają. Po sprawdzeniu dostawy:

| Wynik | Stan zamówienia | Znaczenie |
| --- | --- | --- |
| Wszystkie oczekiwane sztuki dobre | RECEIVED | Cała ta dostawa została poprawnie przyjęta |
| Co najmniej jedna sztuka uszkodzona lub brakująca | RECEIVED_WITH_ISSUE | Weryfikacja tej dostawy zapisana; istnieje zgłoszenie |

Etykieta drugiego stanu: „Dostawa z problemem”, również gdy dobrych sztuk jest0. Nie wyświetlamy wtedy „Odebrano wszystko”. Stan pierwotnego zamówienia pozostaje historycznie RECEIVED_WITH_ISSUE także po udanej dosyłce. Osobno pokazujemy wynik sprawy.

### Sprawa prowadzona przez HQ

| Stan | Co widzi pracownik |
| --- | --- |
| OPEN | Zgłoszenie czeka na HQ |
| IN_REVIEW | HQ zajmuje się sprawą |
| REPLACEMENT_IN_PROGRESS | Istnieje aktywne zamówienie na dosyłkę; obok jego faktyczny status |
| RESOLVED | Wszystkie dobre sztuki z dosyłek przyjęto; „Dosyłka odebrana” |

Odrzucona dosyłka nie rozwiązuje sprawy; wraca ona do IN_REVIEW. Nieprawidłowy odbiór dosyłki pozostawia sprawę otwartą dla nadal brakującej liczby dobrych sztuk. Stan RESOLVED wylicza serwer z przyjętych ilości; nie ma przycisku zamykającego niezaspokojone zgłoszenie samą notatką HQ.

RESOLVED oznacza uzupełnienie dobrych produktów. Nie jest potwierdzeniem wykonania instrukcji bezpieczeństwa, zwrotu, usunięcia uszkodzonych produktów ani uznania roszczenia przez przewoźnika.

## Ilości i ruchy — przykład sprawdzalny

Dla jednego produktu zamówiono i wysłano10. Salon stwierdza8 dobrych i2 uszkodzone albo brakujące.

| Zdarzenie | Zmiana dobrego stocku HQ | Zmiana dobrego stocku salonu | Nierozliczone dobre sztuki w sprawie |
| --- | ---: | ---: | ---: |
| Wysyłka pierwotna10 | −10 | 0 | Jeszcze nie ustalono |
| Weryfikacja:8 dobrych,2 problemowe | 0 | +8 | 2 |
| Utworzenie dosyłki2 | 0 | 0 | 2, z aktywną dosyłką |
| Zatwierdzenie dosyłki | 0; rezerwacja2 | 0 | 2 |
| Faktyczna wysyłka dosyłki2 | −2; zwolnienie rezerwacji2 | 0 | 2 |
| Poprawny odbiór dosyłki2 | 0 | +2 | 0; sprawa rozwiązana |

Łącznie wysłano12, przyjęto na dobry stan10. Pierwotny transfer zachowuje wysłano10/przyjęto dobrych8, a transfer dosyłki wysłano2/przyjęto dobrych2. Nie przepisujemy historii pierwotnego odbioru na10 i nie księgujemy tych samych8 ponownie.

Dla każdej pozycji końcowego odbioru:

`goodQuantity + damagedQuantity + missingQuantity = dispatchedQuantity`

Każda składowa jest nieujemną liczbą całkowitą. Dopuszczalne są0 dobrych i cała ilość problemowa. Wszystkie oczekiwane produkty muszą wystąpić dokładnie raz; nie wolno dopisać obcego SKU, zmienić salonu ani przekroczyć ilości wysłanej.

Stan dostępny salonu rośnie tylko o goodQuantity. Uszkodzone sztuki są fizycznie obecne, lecz niedostępne do sprzedaży/użycia; ich liczba jest widoczna w zapisie odbioru/sprawie, oddzielona od Inventory.onHand. Brakujące sztuki nie są fizycznym stanem salonu ani uszkodzeniem. Samo zgłoszenie lub jego zamknięcie nie przywraca ich HQ.

Po końcowej weryfikacji ta przesyłka nie pozostaje w „w drodze” tylko dlatego, że2 sztuki zaklasyfikowano jako problem. Dotychczasowy wzór dispatched−received wymaga zmiany: osobno pokazujemy ilości niesprawdzonej przesyłki w drodze, dobre przyjęte, uszkodzone i brakujące. Zera nie ukrywają rozbieżności — pozostaje ona jawnie w sprawie.

### Kolejna nieprawidłowa dosyłka

Pierwotny problem ma2 sztuki. Dosyłka2 dostarcza1 dobrą i1 uszkodzoną: salon otrzymuje+1, a sprawa nadal wymaga1 dobrej sztuki. Następna dosyłka może zawierać1, nie2 ani3. Uszkodzenie dosyłki jest kolejnym faktem w historii i nie zwiększa pierwotnego zobowiązania z2 do3.

Dla pozycji sprawy:

- initialAffectedQuantity pochodzi z problemowych sztuk pierwotnej dostawy;
- replacementAcceptedQuantity jest sumą dobrych sztuk z powiązanych dosyłek, każda zaksięgowana raz;
- outstandingQuantity = initialAffectedQuantity − replacementAcceptedQuantity;
- nowa dosyłka jest tworzona tylko bez aktywnej dosyłki; domyślnie obejmuje wszystkie aktualne outstandingQuantity, bez ręcznego zwiększania lub zmiany SKU.

Każda kolejna dosyłka jest bezpośrednio powiązana z tą samą sprawą i jej zamówieniem pierwotnym, nie łańcuchem nowych niezależnych reklamacji.

## Widok salonu i HQ

### Salon — zapis odbioru

Z istniejącego widoku wysłanego zamówienia pracownik otwiera „Sprawdź dostawę”. Dla każdej pozycji widzi oczekiwaną ilość i wpisuje liczbę dobrych, uszkodzonych oraz brakujących sztuk. Przy problemie podaje opis; identyfikator salonu, zamówienia i produktu system zna z bieżącego uprawnionego kontekstu.

Podsumowanie przed potwierdzeniem jasno pokazuje, ile sztuk wejdzie na stan oraz co zostanie zgłoszone HQ. Jedno jawne zatwierdzenie zapisuje cały odbiór, dobre ruchy i powiązane zgłoszenie atomowo. Błąd jednej pozycji nie może pozostawić połowy zapisów.

Po zapisie: „Przyjęto8 dobrych sztuk. Zgłoszono problem z2 sztukami”, numer sprawy i jej status. W szczegółach widać obie historie oraz powiązane dosyłki. Dane nie mogą sugerować, że uszkodzone sztuki są dostępne do zamawiania/użycia.

### HQ — prowadzenie sprawy

Kolejka problemów należy do istniejącego obszaru Requests/HQ. Osobny filtr „Problemy z dostawą” i licznik obejmują niezamknięte sprawy bez względu na stan historycznego zamówienia. Nie dokładamy odrębnego produktu ani systemu ticketowego.

HQ widzi salon, pierwotną dostawę, ilości per produkt, opis, odnośniki do procedur, historię oraz aktualny brak dobrych sztuk. Może rozpocząć obsługę, zapisać odpowiedź/instrukcję dla salonu i jawnie utworzyć dosyłkę. Odpowiedź HQ nie nadpisuje opublikowanej procedury ani nie wykonuje ruchu magazynowego.

„Utwórz dosyłkę” tworzy powiązane zamówienie w PENDING_APPROVAL. HQ zatwierdza je i wysyła obecnymi działaniami. Brak stocku pozostawia je oczekujące i nie rozwiązuje sprawy. Gdy w międzyczasie zmienił się stan lub wersja sprawy, serwer odrzuca stare żądanie i pokazuje aktualne ilości.

MVP nie tworzy otwartej sesji czatu. Odpowiedzi i zmiany statusu są zwykłymi, trwałymi zdarzeniami w sprawie.

### Powrót i kontekst

Nowe zagnieżdżone widoki stosują wspólny Back button i obecny spacing projektu. Powrót zachowuje uprawniony salon, filtr i stronę listy. Wejście w PDF z formularza odbioru zachowuje niezapisane ilości/opis w pamięci bieżącej sesji; powrót prowadzi do tego formularza. Znaczniki powrotu są ograniczonymi typami/ID, nigdy dowolnym adresem przekierowania. Zmiana zweryfikowanego konta/firmy/salonu usuwa niezgodny stan; przejściowy błąd odczytu nie udaje pustego formularza.

## Procedury: instrukcja fizyczna pozostaje w dokumentach

Formularz i sprawa udostępniają „Jak postąpić z tym produktem?” z właściwym dokumentem i jego oryginalnym PDF. Dla demo są to istniejące syntetyczne DAM-001 i DIS-001; w produkcie powiązanie typu problemu z dokumentem musi pochodzić z danych zarządzanych przez HQ, nie ze stałych nazw produktu lub kodów dokumentów w komponentach.

System wybiera aktualną opublikowaną, dostępną dla tej firmy wersję. Przy zapisie zgłoszenia zachowuje identyfikator wersji/sekcji, jeżeli została wskazana, aby historia nie udawała, że pracownik widział późniejszą instrukcję. Powiązanie nie jest potwierdzeniem przeczytania dokumentu. Źródła wycofane nie omijają obecnej kontroli dostępu; pokazujemy ich niedostępność i link do aktualnego dokumentu.

Brak właściwej procedury jest wyraźnie zgłaszany wraz z kontaktem do HQ przez istniejący kanał; nie blokuje bezpiecznego zapisania faktów i dobrych ilości ani nie generuje instrukcji zastępczych. Asystent RAG pozostaje opcjonalną pomocą z cytowaniami. Awaria modelu nie blokuje formularza, zapisu sprawy ani otwarcia znanego PDF. Żadne wskazanie asystenta nie klika odbioru, dosyłki ani zamknięcia za człowieka.

Istniejące dokumenty syntetyczne nie autoryzują automatycznej wymiany, zwrotu ani utylizacji. W nowym przepływie dosyłkę zatwierdza HQ. Instrukcje fizycznego postępowania nadal wymagają właściwych zatwierdzonych dokumentów; wdrożenie funkcji nie zmienia corpus ani treści dokumentów samoistnie.

## Dane i granice implementacji

Nazwy techniczne można doprecyzować w planie, znaczenia pozostają stałe:

| Zapis | Odpowiedzialność |
| --- | --- |
| DeliveryReceipt / DeliveryReceiptItem | Nieedytowalna weryfikacja jednej dostawy; ilości dobre/uszkodzone/brakujące, actor, czas, źródłowy transfer |
| DeliveryIssue / DeliveryIssueItem | Sprawa pierwotnego odbioru; początkowa problemowa ilość, liczba dobrych sztuk z dosyłek, stan/revision |
| DeliveryIssueEvent | Historia rozpoczęcia obsługi, odpowiedzi HQ, dosyłek i ich wyników; powiązanie z konkretną dostawą |
| Replacement request link | Nowy ReplenishmentRequest wskazuje sprawę; jego pozycje odpowiadają produktom i pozostałym ilościom tej sprawy |
| Procedure binding/reference | Powiązanie typu problemu z dokumentem w firmie oraz wskazany przy sprawie historyczny odnośnik |

Nie zmieniamy kardynalności Transfer=requestId. Dosyłki mają nowe request/transfer/item IDs, więc ich wysyłka nie nadpisuje pierwotnego StockMovement. Odbiór nadaje TransferItem.receivedQuantity jednoznaczne znaczenie „dobre zaksięgowane sztuki”; fizyczne i problemowe ilości są w nowym zapisie i jawnych DTO. Wymagane są zmiany wszystkich wyliczeń w drodze, status history, filtrów i kontekstu stockowego.

Dla pierwotnego odbioru i każdej dosyłki zapis receipt jest unikalny na transfer. Dobre sztuki powodują jeden ruch RECEIPT na pozycję; dla0 dobrych ruch stockowy nie powstaje, lecz receipt/audit pozostają. Po zapisaniu końcowej weryfikacji zwalniamy dotychczasowe ActiveRequest slots. Niezamknięte sprawy są osobnym zbiorem; nie udają przesyłek w drodze i nie blokują technicznie stworzenia powiązanej dosyłki.

Tworzenie powiązanej dosyłki jest serwerową komendą HQ, nie swobodnym polem w zwykłym formularzu Submit. Sprawdza firmę, salon, sprawę, brak aktywnej dosyłki i aktualne outstandingQuantity oraz istniejące konflikty ActiveRequest. Konflikt ze zwykłym aktywnym zamówieniem jest jawny i nie omijamy go ukrytym drugim ruchem. Utworzenie nowego zamówienia, wszystkich pozycji/slotów i powiązania ze sprawą jest atomowe.

Zapis odbioru atomowo obejmuje autoryzację, oczekiwaną rewizję, komplet klasyfikacji, zmianę dobrych balansów, ruchy, receipt, stan zamówienia, zgłoszenie lub aktualizację tej samej sprawy, zwolnienie slotów i audyt/idempotencję. Dopiero commit może tworzyć zdarzenie do powiadomienia. Proces aplikacyjny nie wykonuje sekwencji niezależnych zapisów na produkt.

### Autoryzacja, retry i współbieżność

- Salon zapisuje odbiór i widzi sprawy tylko przypisanych salonów; HQ obsługuje sprawy swojej firmy i zachowuje istniejącą możliwość odbioru w uprawnionym kontekście salonu.
- Kwoty, typ problemu, stan i powiązania waliduje serwer/SQL, nie model ani sam formularz. Brak zgody na podmianę produktu.
- Każda komenda ma idempotency key, kanoniczny payload i oczekiwaną rewizję. Replay wymaga ponownej autoryzacji; zmiana ilości pod tym samym kluczem jest konfliktem.
- Utrata odpowiedzi wymaga uzgodnienia tego samego payload/key. Nie ponawiamy z nowym kluczem i nie dodajemy drugiego receipt, ruchu, zdarzenia lub dosyłki.
- Obecna unikalność ActionReceipt=request+action może obsłużyć jeden końcowy odbiór, ale nie wiele odpowiedzi/zmian sprawy. Dla komend sprawy trzeba osobnego niezmiennego potwierdzenia/wiązania klucza i unikalnej rewizji zdarzenia. Plan ma określić tę granicę, zamiast kopiować stare ograniczenie w nowe akcje.
- Dwa równoległe odbiory, dwa kliknięcia utworzenia dosyłki, odbiór kontra nowa dosyłka oraz dwa rozstrzygnięcia muszą dać jeden wynik lub kontrolowany stale/conflict. Nigdy podwójne dodanie dobrego stanu ani dosyłkę ponad zobowiązanie.
- Receipt i powiązania historyczne nie są edytowane z browser connectora; komendy pozostają chronione przez Auth/App Check oraz uprawnienia transakcyjne.

## Firebase notifications — odrębne rozszerzenie

Właściciel poprosił o zapisanie pomysłu Firebase Cloud Messaging. Pierwszy odbiór/sprawa nie zależy od wdrożenia push. Szczegóły i źródła Firebase są w [notatkach rozszerzeń](../../implementation/future-work.md#powiadomienia-o-statusie--firebase).

Proponowany dalszy kierunek: trwałe zdarzenie w transakcji SQL → worker Cloud Functions → skrzynka w aplikacji i opcjonalny FCM. Zdarzenia obejmują zgłoszenie do HQ, utworzenie i wysyłkę dosyłki, odpowiedź HQ, odbiór oraz rozwiązanie sprawy. Odbiorców wyznaczają uprawnienia, kliknięcie powiadomienia pobiera aktualny stan. Brak zgody na push lub błąd wysyłki nie cofa stocku. Dostarczenie push nie jest odbiorem paczki ani potwierdzeniem przeczytania sprawy.

Nie uruchamiamy usług, nie wysyłamy wiadomości, nie rozszerzamy uprawnień ani nie publikujemy nowego service workera na podstawie tego dokumentu.

## Przejście i migracja

Istniejące RECEIVED są historycznie pełne i nienaruszone: ewentualny backfill nowych receipts używa zapisanych ruchów i timestampów, zachowuje actor i pochodzenie „historyczny zapis”, nie wykonuje ponownie stock command. Nie wnioskujemy otwartego problemu ze starego DISPATCHED ani nie tworzymy fikcyjnych danych o uszkodzeniu.

Migracja zachowuje request IDs, ilości, salda, istniejące ActionReceipts/ActionKeys, produkty, członkostwa, ustawienia i całą wiedzę/PDF. Nowe tabele operacyjne wymagają włączenia do jawnego resetu demo z kontrolą celu i porównaniem zachowania wiedzy. Nie wolno ich dodać do szerokiego czyszczenia przez przypadek.

Nowy stan i payload odbioru wymagają skoordynowanej aktualizacji kontraktów, SDK, callable, UI i testów. Stary RECEIVE może pozostać ograniczonym adapterem pełnego odbioru tylko po dowodzie wspólnej kanonicznej idempotencji i unikalnego receipt; w przeciwnym razie stary zapis jest blokowany kontrolowanym komunikatem o aktualizacji klienta. Nie akceptujemy dwóch dróg księgujących tę samą dostawę. Istniejące nierozpoznane pending journals/klucze muszą być uzgodnione, nie usuwane po cichu.

Przed zmianą chmury: osobny plan migracji, zatwierdzony cel i backup/restore proof, okno bez komend, porównanie sald i audytu. Powrót do starego backendu po zapisaniu częściowych odbiorów nie jest zwykłym rollbackiem frontendu. Nie resetujemy ani nie publikujemy teraz.

## Kryteria akceptacji do przyszłego planu

1. Pełny nienaruszony odbiór nadal działa i księguje każdą sztukę raz.
2. Dla10 wysłanych,8 dobrych i2 uszkodzonych lub brakujących: salon+8, osobny receipt i otwarta sprawa na2, bez dodatkowego stocku HQ.
3. Zero dobrych, przypadek mieszany wielu produktów, cała pozycja brakująca oraz cały odbiór problemowy są poprawnie reprezentowane; ujemne/ułamkowe/nadmiarowe/obce/zdublowane pozycje nie zapisują niczego.
4. Późniejsza awaria w transakcji nie pozostawia części stocku, receipt bez sprawy ani sprawy bez poprawnych ilości.
5. HQ tworzy dosyłkę dokładnie na pozostałe2. Samo stworzenie nie odejmuje fizycznego stocku. Brak stocku przy zatwierdzeniu pozostawia ją oczekującą.
6. Poprawny odbiór dosyłki+2 daje razem10 dobrych; pierwotny receipt nadal ma8, a sprawa RESOLVED. Dziennik wyjaśnia12 wysłanych wobec10 przyjętych dobrych.
7. Dosyłka1 dobra/1 uszkodzona zmniejsza zobowiązanie2→1, bez nowego niezależnego zobowiązania. Następna dosyłka jest na1. Równoległe utworzenie dwóch dosyłek lub ponowny odbiór nie podwaja efektów.
8. Utrata odpowiedzi/reload/retry zachowują ten sam klucz i wynik; zmieniony payload pod tym kluczem odrzucany. Replay po utracie uprawnień jest odrzucany.
9. Dwie firmy/salony nie widzą cudzych spraw, powiązań, dokumentów ani komend. Nie można wskazać cudzej sprawy w zwykłym Submit.
10. Back z procedury przywraca formularz z danymi; brak procedury/modelu nie fabrykuje instrukcji ani nie blokuje zapisu dobrych ilości i faktów. Historyczny odnośnik wersji i jej wycofanie respektują obecne zasady źródeł.
11. HQ i salon widzą zgodne ilości, stan sprawy i odrębne statusy przesyłek przy320/360/1280px, z obsługą klawiatury i poprawnymi loading/error/empty/stale/unknown stanami.
12. Istniejąca historia, salda, audyt i wiedza przetrwają migrację; nowe rekordy nie fałszują autorów/czasów. Dowody chmurowe i publikacja są osobną bramką.

## Następny krok

Przegląd projektu przez osobę planującą implementację, wyjaśnienie istotnych luk, zatwierdzenie dokumentu przez właściciela, następnie plan wdrożenia z testem możliwości transakcyjnych, migracją i małymi etapami. Samo potwierdzenie wariantu w rozmowie nie jest deklaracją, że funkcja już działa.


## Plan wdrożenia

[Plan etapów i weryfikacji](../plans/2026-10-25-delivery-receipts-and-issues.md) jest przygotowany do przeglądu przed implementacją.
