# Rozszerzenia po bieżącym demo — notatki produktowe

25 października 2026. Wymagania i pomysły zapisane na prośbę właściciela. Nie są wdrożone; bieżący plan release nie obejmuje automatycznie zmiany obiegu stockowego ani uruchomienia push.

## Nieprawidłowa dostawa: salon ↔ HQ

### Potwierdzone przez właściciela

- Salon przyjmuje dobre sztuki na stan i zgłasza uszkodzenia albo braki dla pozostałych pozycji.
- Sam klik „produkt nie jest OK” nie wyczerpuje obsługi. Pracownik ma dostęp do procedur w bibliotece dokumentów, opisujących rzeczywiste postępowanie z produktami.
- Procedura pozostaje źródłem instrukcji. Zgłoszenie i ruch magazynowy są jawnymi czynnościami pracownika; odpowiedź asystenta nie zastępuje tych operacji.

### Co działa obecnie

Zamówienie ma pięć stanów: PENDING_APPROVAL, RESERVED, DISPATCHED, RECEIVED, REJECTED. Odbiór wymaga dokładnej ilości każdej pozycji oraz potwierdzenia, że wszystkie produkty są nienaruszone. Brak lub uszkodzenie blokuje całość: status zostaje DISPATCHED, stan salonu nie rośnie, a pracownik widzi polecenie kontaktu z HQ. Trwałego zgłoszenia problemu i jego obsługi przez HQ jeszcze nie ma.

Źródła: `shared/contracts/stock.ts`, `functions/src/stock/schemas.ts`, `functions/src/stock/repository.ts`, `web/src/app/features/request-detail/ui/request-action-dialog.ts`. To luka funkcjonalna względem nowego wymagania, a nie błąd wykonania istniejącego, zatwierdzonego modelu pełnego odbioru.

### Wybrane podejście i rozważone alternatywy

1. Rozszerzyć pojedynczy status zamówienia i formularz problemu. Mniej osobnych obiektów, ale status miesza dostawę, przyjęte ilości i rozpatrywanie zgłoszenia; kolejne dosyłki komplikują historię.
2. Oddzielić zapis odbioru od zgłoszenia problemu, pokazując ich podsumowanie na zamówieniu. **Wybrane przez właściciela**: dobry stan salonu, fizyczna dostawa i decyzja HQ mają osobne znaczenie. Pozwala to rozliczyć część dobrą oraz utrzymać sprawę brakujących/uszkodzonych sztuk.

Przykład do dalszego projektu: wysłano10, przyjęto8 dobrych, problem dotyczy2. Stan dostępny salonu rośnie o8. Uszkodzone sztuki nie stają się dobrym stanem; brakujących nie można oznaczyć jako fizycznie odebranych. HQ otrzymuje zgłoszenie, pracownik sprawdza właściwą procedurę. Decyzja HQ, ewentualny zwrot lub dosyłka muszą mieć własne ślady i ilości, bez ponownego zaksięgowania tych samych8 sztuk. Szczegółowe stany, częściowe rozstrzygnięcia i model kolejnych przesyłek wymagają projektu. Właściciel wybrał oddzielny odbiór i zgłoszenie; właściciel potwierdził także powiązaną dosyłkę przez HQ i zamknięcie sprawy po odebraniu brakujących dobrych sztuk.

Obecny Transfer ma klucz requestId, a ActionReceipt unikalność request+action. Dlatego obsługa kolejnych odbiorów/dosyłek wymaga zaprojektowania nowych identyfikatorów i idempotencji; samo dodanie etykiety statusu nie zapewni poprawnych ilości.

## Powiadomienia o statusie — Firebase

**Pomysł dodany na prośbę właściciela:** Firebase Cloud Messaging dla zmian statusu przesyłki i obiegu zgłoszeń, połączone z trwałą skrzynką powiadomień w aplikacji. To propozycja integracji, bez aktywacji usług ani wysyłania wiadomości.

Proponowane zdarzenia:

| Zdarzenie | Odbiorca |
| --- | --- |
| Nowe zamówienie / zgłoszenie problemu | Uprawnione HQ |
| Zatwierdzenie, odrzucenie, wysyłka | Uprawnieni pracownicy właściwego salonu |
| Odbiór / odbiór ze zgłoszeniem | HQ |
| Odpowiedź HQ, dosyłka, rozstrzygnięcie | Uprawnieni pracownicy salonu |

Proponowane reguły projektu:

- Stan i historia pozostają w istniejącym Firebase SQL Connect. Zmiana statusu zapisuje w tej samej transakcji trwałe zdarzenie do obsłużenia. Osobny worker Cloud Functions tworzy powiadomienia i zleca FCM; awaria push nie cofa poprawnego odbioru.
- Warto sprawdzić w projekcie `onMutationExecuted`, filtrowane po konkretnej mutacji, oraz odzyskiwanie nieobsłużonych zdarzeń. Wyzwalacz SQL Connect dostarcza wynik/zmienne mutacji, bez transakcyjnego obrazu „przed”; actor i zmiana stanu powinny pochodzić z zatwierdzonego zdarzenia biznesowego. Region triggera musi pasować do SQL; mutacja używana przez worker nie może wywoływać go w pętli. [Dokumentacja Firebase](https://firebase.google.com/docs/functions/data-connect-events).
- Trwała skrzynka i deduplikacja po zdarzeniu+odbiorcy zapewniają historię mimo odmowy push lub nieaktywnego urządzenia. Ponowne wysłanie nie może utworzyć drugiego zdarzenia ani ruchu stockowego. Odebranie push lub kliknięcie powiadomienia nie oznacza odbioru dostawy.
- Rejestracje instalacji/urządzeń wiążemy po stronie serwera z zalogowanym użytkownikiem. Odbiorców określają bieżące uprawnienia do firmy i salonu; nie publiczny temat o nazwie salonu. Firebase zaleca tematy dla informacji publicznych, a bezpośrednie adresowanie dla małych grup. [FCM topics](https://firebase.google.com/docs/cloud-messaging/topic-messaging).
- Web push (PWA, FCM, rejestracja urządzeń, powiadomienia o zatwierdzeniu, odrzuceniu i wysyłce) jest zaprojektowany i wdrażany osobno: [projekt PWA + push](../superpowers/specs/2026-11-02-pwa-push-design.md). Poniżej zostaje tylko trwała skrzynka powiadomień, odbiory HQ i e-mail.
- Po kliknięciu otwieramy właściwy request/sprawę i pobieramy aktualny stan. Stan powiadomienia „odczytane” jest oddzielony od statusu przesyłki. Rejestracje wygasłe, wylogowanie, zmiana członkostwa oraz opóźnione/duplikowane zdarzenia wymagają testów.

Kolejność proponowana do decyzji: ustalenie obiegu nieprawidłowej dostawy → trwałe zdarzenia i skrzynka → opcjonalne push FCM. E-mail można rozważyć później jako drugi kanał. Firebase In-App Messaging nie jest tu proponowaną skrzynką zdarzeń operacyjnych.

## Projekt wybranego wariantu

Właściciel wybrał oddzielny odbiór/sprawę oraz prosty model dosyłki jako nowego powiązanego zamówienia. [Zatwierdzony projekt](../superpowers/specs/2026-10-25-delivery-receipts-and-issues-design.md) opisuje8 dobrych+2 problemowe → dosyłka2 → razem10 dobrych, bez przepisywania pierwotnego ruchu. Nie jest to jeszcze wdrożenie ani plan publikacji.

[Plan wdrożenia](../superpowers/plans/2026-10-25-delivery-receipts-and-issues.md): osiem etapów od dowodu transakcji po migrację i gotową paczkę. Plan wymaga przeglądu przed rozpoczęciem implementacji; FCM pozostaje kolejnym, osobnym rozszerzeniem.

## Usunięcie dopisków demo i synthetic z interfejsu

28 października 2026 — właściciel doprecyzował, że chodzi o widoczne przyrostki i dopiski „demo” / „synthetic”, które dodają szumu.

- Docelowo usunąć zbędne widoczne oznaczenia, przyrostki i dopiski DEMO / synthetic w interfejsie i prezentowanych nazwach.
- To porządkowanie tekstów i oznaczeń. Nie obejmuje usuwania danych, dokumentów, opcji pochodzenia ani zmiany zapisanego pochodzenia dokumentów.

To zapis docelowego wymagania, bez bieżącej zmiany aplikacji ani publikacji. Zastępuje wcześniejszą, zbyt szeroką interpretację obejmującą usuwanie przykładowych danych i dokumentów.
