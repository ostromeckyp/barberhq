# Delivery receipts, issues and linked replacements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przyjmować dobre sztuki z nieprawidłowej dostawy, prowadzić osobną sprawę HQ i uzupełniać braki powiązanymi dosyłkami bez podwójnego księgowania.

**Architecture:** DeliveryReceipt przechowuje nieedytowalną klasyfikację jednej dostawy, a DeliveryIssue rozlicza dobre sztuki należne z dosyłek. Każda dosyłka jest nowym ReplenishmentRequest/Transfer bezpośrednio powiązanym z tą samą sprawą. Komendy serwerowe i transakcje SQL Connect utrzymują salda, idempotencję i historię; Angular odczytuje osobne DTO, a procedury pozostają w bibliotece PDF.

**Tech Stack:** Istniejące Angular22.2/Material, signals/facades, Firebase Auth/App Check, Cloud Functions/Node22, SQL Connect/PostgreSQL, wygenerowane SDK, Vitest i Playwright. Bez nowych zależności i bez FCM w tym planie.

**Spec:** [Zatwierdzony projekt](../specs/2026-10-25-delivery-receipts-and-issues-design.md). Właściciel zatwierdził dokument25 października2026 odpowiedzią „tak”.

## Global Constraints

- goodQuantity + damagedQuantity + missingQuantity = dispatchedQuantity dla każdej pozycji; nieujemne liczby całkowite,1–6 unikalnych oczekiwanych produktów, dotychczasowy limit zamawiania1–99.
- Dobre sztuki zwiększają Inventory.onHand salonu; uszkodzone/brakujące nie zwiększają dobrego stocku salonu ani HQ.
- Jeden końcowy receipt na transfer, jeden transfer na request, jedna aktywna dosyłka na sprawę. Kolejne nieprawidłowe dosyłki nie zwiększają initialAffectedQuantity.
- Sprawa kończy się tylko po odebraniu wszystkich należnych dobrych sztuk. RESOLVED nie potwierdza zwrotu, utylizacji ani wykonania procedury fizycznej.
- Zachowaj istniejące UI, wspólny Back button, spacing i kontekst salonu/listy. Nowe etykiety w obecnym angielskim UI; przykładowe polskie etykiety projektu są ich znaczeniem, nie rozpoczęciem migracji językowej.
- Zdjęcia poza nowym modułem, zgodnie z dotychczasowym kanałem procedury. Brak korekt zaksięgowanego receipt, zwrotów, refundów, zamienników i planowych wielopaczkowych dostaw w tej wersji.
- Brak odpowiedniego dokumentu/modelu nie blokuje zapisu faktów i dobrych ilości; brak instrukcji jest jawny. Żadne AI nie wykonuje komendy stockowej.
- Firebase powiadomienia pozostają w `docs/implementation/future-work.md`; bez provisioningu, wysyłania wiadomości i nowego service workera.
- Nie czytaj ani nie kopiuj plików prywatnej konfiguracji wskazanych w AGENTS.md. Testy mają twardo wymagać emulatorów; żadnych przypadkowych fixture w chmurze.
- Zachowaj brudny checkout i formatowanie właściciela. Bez stage/commit, nowej gałęzi/worktree i usuwania workspace. Te preferencje zastępują standardowe kroki commit/cleanup skillów.
- Nie reinstaluj niezmienionych zależności. Graph minimal context + jawny impact przed zmianami; po zmianach źródeł `npm run graph:update`. Brak w indeksie nie zastępuje odczytu źródła.
- Ten dokument przygotowuje lokalne wdrożenie do przeglądu. Migracja chmurowa, reset, nowe rekordy operacyjne w chmurze i publikacja wymagają konkretnego zatwierdzonego zakresu po przygotowaniu dowodów.

## Review Focus

1. Stary klient i zapisany legacy RECEIVE po migracji: brak drugiego stocku i brak cichego usunięcia nierozstrzygniętego journalu — test Task8.
2. Prawidłowa suma globalna, ale zamienione ilości między produktami/obcy productId: porównanie per transfer item, zero zapisów przy błędzie — test Task3.
3. Drugie uszkodzenie tej samej dosyłki i podwójne kliknięcie HQ: zobowiązanie2→1, nie2→3; maksymalnie jedno aktywne powiązane zamówienie — test Task4.
4. Wycofanie procedury podczas wypełniania formularza i powrót w innej sesji/salonie: brak wycieku/przekierowania i zachowanie jawnego stanu niedostępności — test Tasks5/6.
5. Zerowy dobry odbiór oraz konflikt ze zwykłym aktywnym zamówieniem: nie mylić problemu z tranzytem, nie omijać ActiveRequest i nie zamykać sprawy — test Tasks4/5/7.

## Mapa plików i ustalone interfejsy

Nowy moduł jest w `functions/src/delivery/` i `web/src/app/features/delivery/`; istniejące stock/request/procedure pliki dostają tylko punkty integracji. Nie rozbijaj całego StockRepository ani biblioteki dokumentów przy okazji.

- `shared/contracts/delivery.ts`: wspólne typy opisane poniżej.
- `dataconnect/schema/delivery.gql`, `dataconnect/server/delivery.gql`, `dataconnect/browser/delivery.gql`: dane i jawne autoryzowane operacje.
- `functions/src/delivery/{schemas,intent,repository,commands}.ts`: walidacja, kanonizacja, komendy/transakcje i callable.
- `web/src/app/features/delivery/data-access/delivery-api.ts`, `delivery.mapper.ts`: typowane odczyty/komendy; komponenty nie używają Firebase bezpośrednio.
- `web/src/app/features/delivery/feature/`: receipt facade/journal i issue facade; `ui/`: formularz, szczegóły sprawy, mały dialog konfiguracji procedur.
- Migracja w `scripts/migrations/delivery-receipts.ts`, testy w istniejących katalogach unit/integration/e2e.

Wspólne typy, zdefiniowane w Task2:

- `DeliveryQuantities = {productId:string;goodQuantity:number;damagedQuantity:number;missingQuantity:number}`.
- `ProcedureReference = {kind:'DAMAGED'|'MISSING';versionId:string;chunkId?:string}`; metadane/sekcję sprawdza serwer w firmie aktora.
- `RecordDeliveryInput = {requestId:string;expectedRevision:number;idempotencyKey:string;items:DeliveryQuantities[];report?:{description:string;batchIdentifier:string|null};procedureReferences:ProcedureReference[]}`. Referencja dostawy/salon/SKU pochodzą z uprawnionego requestu. Partia null oznacza „nie ustalono”; opis problemu1–1000 znaków, partia maksymalnie120.
- `IssueTransitionInput = {issueId:string;expectedRevision:number;idempotencyKey:string}`; `AddIssueNoteInput` dodaje `text:string` o długości1–1000 po trim.
- `SetDeliveryProcedureInput = {kind:'DAMAGED'|'MISSING';documentId:string|null;expectedRevision:number;idempotencyKey:string}`; null jawnie wyłącza powiązanie; rekord/revision pozostaje, aby uniknąć resetu wersji przy ponownym przypisaniu.
- `DeliveryAction = {type:'RECORD_RECEIPT';input:RecordDeliveryInput} | {type:'START_REVIEW'|'CREATE_REPLACEMENT';input:IssueTransitionInput} | {type:'ADD_NOTE';input:AddIssueNoteInput} | {type:'SET_PROCEDURE';input:SetDeliveryProcedureInput}`.
- `DeliveryCommandResult = {commandId:string;requestId?:string;receiptId?:string;issueId?:string;replacementRequestId?:string;requestRevision?:number;issueRevision?:number;bindingRevision?:number;replayed:boolean}`. Serializacja nie zawiera undefined; wynik jest niezmienny po commicie.
- `DeliveryIssueStatus = 'OPEN'|'IN_REVIEW'|'REPLACEMENT_IN_PROGRESS'|'RESOLVED'`.
- `DeliveryReceiptDto`: id/requestId, recordedAt/actorLabel/origin (`RECORDED` lub `LEGACY`), items, procedureReferences, rootIssueId|null.
- `DeliveryIssueDto`: id/rootRequestId/salonId/salonName/status/revision, items `{productId,productName,initialAffectedQuantity,replacementAcceptedQuantity,outstandingQuantity}`, aktywna dosyłka|null, paginowana historia zdarzeń i linki do wszystkich dosyłek.
- `DeliverySummaryDto`: receipt|null, rootIssue `{id,status,revision}`|null, replacementForIssueId|null; per item jawne dobre/uszkodzone/brakujące i inTransit.
- `DeliveryApi.recordReceipt(input)`, `.startReview(input)`, `.addNote(input)`, `.createReplacement(input)`, `.setProcedure(input)` → Promise<DeliveryCommandResult>; `.getIssue(id)`, `.listIssues({salonId?,offset,limit,status:'OPEN'|'ALL'})`, `.getReceiptContext(requestId)`, `.getProcedureBindings()` zwracają uprawnione DTO.

Przykłady asercji w zadaniach używają lokalnych nazw fixture/snapshotów z danego testu; ich oczekiwania są literalne, a wartości after odczytywane z SQL. W Task3 `readDeliverySnapshot` udostępnia także hqInventory/salonInventory dla wskazanego produktu fixture. W Task2 zapisz komplet DTO w jednym miejscu; dalsze zadania rozszerzają tylko pola odczytu wymagane przez projekt, bez nowych wariantów biznesowych.

---

### Task 1: Udowodnić transakcję odbioru i wyłączność dosyłki

**Files:** Create `tests/capabilities/delivery-receipt/{firebase.json,vitest.config.ts,transaction.test.ts}`, `dataconnect/dataconnect.yaml`, `dataconnect/schema/schema.gql`, `dataconnect/server/{connector.yaml,operations.gql}` wewnątrz tego katalogu. Create `docs/implementation/delivery-transaction-proof.md`. Reuse wzorzec `tests/capabilities/whole-request/` bez jego modyfikacji.

**Interfaces:** Osobny projekt `demo-delivery-receipt-proof`, service `delivery-receipt-proof`, SQL emulator127.0.0.1:9699, hub4406/log4506. Test-only `recordProbe({goods:[8,0],damaged:[2,0],missing:[0,3],failLast?:boolean})` i `createReplacementProbe({issueId,expectedRevision})`; nie są produkcyjnymi helperami. Wynik: udokumentowany dowód native GraphQL `@transaction`/guardów i pojedynczego zwycięzcy.

- [ ] **Step1 — Write checks:** `zero_good_line_has_receipt_but_no_stock_movement` oczekuje dwóch receipt items, dobrych sald[8,0], jednego ruchu quantity8 i problemów[2,3]. `last_guard_failure_rolls_back_all_effects` porównuje pełny snapshot przed/po. `concurrent_replacements_create_one_active_child` oczekuje jednego requestu, jednego linku i jednego wzrostu rewizji. Złe scope/rewizje pozostawiają snapshot bez zmian.

  ```ts
  expect(after.inventory.map(row => row.onHand)).toEqual([8, 0]);
  expect(after.receiptItems).toHaveLength(2);
  expect(after.movements.map(row => row.quantity)).toEqual([8]);
  expect(after.issueItems.map(row => row.initialAffectedQuantity)).toEqual([2, 3]);
  ```
- [ ] **Step2 — RED:** `node node_modules/vitest/vitest.mjs run --config tests/capabilities/delivery-receipt/vitest.config.ts`. Expected: nazwane zachowanie FAIL przy brakujących operacjach; brak emulatora/importu napraw jako infrastrukturę, nie dowód behawioralny.
- [ ] **Step3 — Implement probe:** Operacje o stałych nazwach/tabelach, maksymalnie6 slotów oraz osobne bool `moveN` dla goodQuantity>0, guard kompletności i unikalny aktywny link/revision compare-and-set. Uruchom wyłącznie nazwany emulator przez przypięty Firebase CLI z `--project demo-delivery-receipt-proof --config tests/capabilities/delivery-receipt/firebase.json`. Nie używaj produkcyjnego schematu/bazy ani all:true poza prywatną bazą probe.
- [ ] **Step4 — GREEN:** Powtórz komendę testu; wszystkie przypadki PASS, raport zawiera prawdziwą wersję CLI/emulatora. Jeśli operacje nie wyrażają atomowości, zapisz konkretny błąd i wąski projekt transakcji native SQL za tym samym API przed dalszą implementacją; nie rozdzielaj zapisu na aplikacyjne pętle. Domyślna ścieżka planu to GraphQL.
- [ ] **Step5 — Record:** Zapisz logi w workspace tego nowego planu; bez commit/stage. Zatrzymaj tylko własny emulator.

### Task 2: Kontrakty, schemat i typowane operacje odczytu

**Files:** Create `shared/contracts/delivery.ts`, `dataconnect/schema/delivery.gql`, `dataconnect/{server,browser}/delivery.gql`, `functions/src/delivery/{schemas,intent}.ts`, `tests/unit/delivery-input.test.ts`, `tests/unit/sdk-generation.test.ts`, `tests/integration/delivery-access.test.ts`. Modify `shared/contracts/stock.ts`, `dataconnect/schema/stock.gql`, `scripts/config/generate-sdk.mjs` dla jawnego lokalnego targetu; wygenerowane SDK w obecnych katalogach root/web/functions.

**Interfaces:** `parseDeliveryAction(type:DeliveryAction['type'],input:unknown):DeliveryAction`, `canonicalDeliveryPayload(action):string` sortuje produkty/referencje, pomija sam klucz; `deliveryReceiptId(requestId):string` i `deliveryIssueId(receiptId):string` są deterministycznymi hash-based ID. Schemat dodaje RECEIVED_WITH_ISSUE i nullable replacementIssueId na request.

- [ ] **Step1 — Write checks:** Waliduj0/8/2, sześć produktów, opisy/partię, ułamki/ujemne/przekroczenie99/duplikaty/nieznane pola. Ten sam zamiar przy innym porządku ma ten sam canonical payload; zmiana good→damaged zmienia payload. `foreign_salon_cannot_read_issue_or_receipt` i `browser_cannot_write_delivery_rows` korzystają z prawdziwych reguł SQL.

  ```ts
  expect(canonicalDeliveryPayload(original)).toBe(canonicalDeliveryPayload(reordered));
  expect(canonicalDeliveryPayload(original)).not.toBe(canonicalDeliveryPayload(reclassified));
  expect(() => parseDeliveryAction('RECORD_RECEIPT', negativeQuantityInput)).toThrow();
  ```
- [ ] **Step2 — RED:** `npm run test:unit -- tests/unit/delivery-input.test.ts tests/unit/sdk-generation.test.ts`; potem `BARBERHQ_TEST_MODE=emulator npm run test:integration -- tests/integration/delivery-access.test.ts`. Expected: named assertions FAIL przed implementacją, nigdy testowy target chmurowy.
- [ ] **Step3 — Implement:** Zdefiniuj kontrakty z mapy. Tabele: DeliveryReceipt (unique transfer/request, origin i opcjonalny legacyActionReceiptId), DeliveryReceiptItem (unique receipt+product), DeliveryIssue (unique rootReceipt, nullable activeReplacementRequestId), DeliveryIssueItem (unique issue+product), DeliveryIssueEvent (unique issue+revision, actor/time/type/request/note), DeliveryProcedureBinding (unique business+kind, revision), DeliveryReceiptProcedure (receipt+kind/version/chunk), DeliveryCommandReceipt i DeliveryActionKey.
  DeliveryCommandReceipt przechowuje business/actor/type/target/payloadHash/result; DeliveryActionKey unique business+actor+key wskazuje niezmienny wynik i hash. Nie dokładaj wielu powtarzalnych działań sprawy do starej unikalności ActionReceipt=request+action. Zdarzenie sprawy jest jedno na zmianę jej rewizji; jego stan/ilości mogą wskazywać jednocześnie odebranie dosyłki i rozwiązanie.
  Browser reads: `GetDeliveryReceipt`, `GetDeliveryIssue`, `ListDeliveryIssues`, `GetDeliveryProcedureBindings`; wszystkie przez membership/business i salon access, limit≤50, stabilny sort createdAt+id, historia paginowana. Backend reads: `ReadDeliveryContext`, `ReadDeliveryKey`, `ReadIssueContext`. Generuj SDK przy użyciu istniejącego CLI; generator przyjmuje jawny `--project`, wymaga go bez produkcyjnego defaultu, a npm przekazuje argumenty. `tests/unit/sdk-generation.test.ts` sprawdza brak argumentu i dokładny lokalny target bez wykonywania CLI; istniejące odwołania w runbookach dostają jawny projekt. zachowaj testowane enum postprocessing i osobny cloud SDK.
- [ ] **Step4 — GREEN:** Te same unit/integration checks, `npm run typecheck`, `npm run generate:sdk -- --project demo-barberhq`, `npm run build:functions`. Expected: PASS, wygenerowane operacje/enum mają nowy stan i uprawnienia; brak ręcznego edytowania wygenerowanego runtime.
- [ ] **Step5 — Record:** Zapisz dokładny diagram/unikalności i logi; graph update; bez commit/stage.

### Task 3: Atomowy odbiór dobrych sztuk i powstanie sprawy

**Files:** Create `functions/src/delivery/{repository,commands}.ts`, `scripts/codegen/delivery-operations.mjs`, `tests/unit/delivery-receipt.test.ts`, `tests/integration/delivery-receipt.test.ts`, `tests/support/delivery.ts`. Modify `dataconnect/server/delivery.gql`, `functions/src/index.ts`, `functions/src/stock/commands.ts`, `shared/contracts/stock.ts`, `web/src/app/features/replenishment/data-access/command-error.ts` dla controlled `CLIENT_UPDATE_REQUIRED`.

**Interfaces:** `tests/support/delivery.ts` tworzy wyłącznie lokalne fixture przez `createCloudHarness`, eksportuje `seedDispatchedDelivery(h,quantities)`, `readDeliverySnapshot(h)` i `executeDelivery(h,role,action)` używające rzeczywistego SQL/repository. Snapshot zawiera faktyczne rows inventory/receipts/items/issues/movements/keys, nie założone stałe. Produkcyjne API: `DeliveryRepository(dc).execute(uid:string,action:DeliveryAction):Promise<DeliveryCommandResult>`; `deliveryCommand(type)` eksportuje `recordDeliveryReceipt`. `receiveTransfer` pozostaje wyłącznie autoryzowanym uzgadnianiem już istniejącego legacy key/result, a nową próbę starego zapisu odrzuca CLIENT_UPDATE_REQUIRED. Nie twórz dwóch księgujących API.

- [ ] **Step1 — Write checks:** `records_8_good_2_damaged` oraz wariant missing2: HQ bez nowej zmiany, salon+8, one receipt, affected2, request RECEIVED_WITH_ISSUE, brak ActiveRequest. Pełne10 → RECEIVED/no issue. Zero dobrych → brak RECEIPT movement, lecz receipt i sprawa. `swapped_product_quantities_fail_per_item_validation` odrzuca poprawną sumę globalną przypisaną złym produktom. Snapshot dla obcego SKU, brakującej pozycji, stale revision i błędu ostatniej pozycji pozostaje bez zmian.

  ```ts
  // Fixture start: HQ18, salon2, original request/dispatch10.
  expect(after.hqInventory).toMatchObject({ onHand: 8, reserved: 0 });
  expect(after.salonInventory).toMatchObject({ onHand: 10 });
  expect(after.receiptItems[0]).toMatchObject({ goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 });
  expect(after.issues[0].items[0].initialAffectedQuantity).toBe(2);
  expect(after.activeRequests).toEqual([]);
  ```
- [ ] **Step2 — RED:** `npm run test:unit -- tests/unit/delivery-receipt.test.ts` i `BARBERHQ_TEST_MODE=emulator npm run test:integration -- tests/integration/delivery-receipt.test.ts`. Expected: named behavioral FAIL, nie brak infrastruktury.
- [ ] **Step3 — Implement:** Kanoniczne dane porównuj z uprawnionymi pozycjami DISPATCHED. Jedna transakcja zapisuje receipt/items/references, dobre inventory/movements, stan requestu, root issue/items/event gdy potrzebne, zwolnienie slotów i komendę/klucz. Dla good0 pomija ruch, nie cały receipt item. Description wymagany przy problemie; pełny poprawny odbiór nie wymaga sztucznego zgłoszenia. Reject reference do obcej/wycofanej/nigdy-opublikowanej wersji, pokazując SOURCE_CHANGED do jawnej korekty formularza; użytkownik może usunąć niedostępną referencję i zapisać fakty.
  Callable używa obecnych Auth/App Check, region europe-west1, maxInstances5 i `stockConnectorConfig`; nie zmieniaj konta, origins ani ustawień RAG. Replay po istniejącym kluczu najpierw autoryzuje bieżący scope; inny payload z tym samym kluczem to konflikt. Unique receipt na request jest ostatecznym zabezpieczeniem przed podwójnym ruchem również z nowym kluczem.
- [ ] **Step4 — GREEN:** Powtórz checks; dodaj utratę odpowiedzi po commicie i ten sam retry, dwa równoległe odbiory oraz replay po odebraniu dostępu. Expected: jeden receipt/ruch/issue/event; stary niezaksięgowany RECEIVE dostaje update-required bez zmian.
- [ ] **Step5 — Record:** Graph update i logi; bez deploymentu/commit/stage. Root helper do testów receipt jest w `tests/support/delivery.ts`, nie publiczną metodą produkcyjną.

### Task 4: Obsługa HQ i powiązane dosyłki do tej samej sprawy

**Files:** Modify `functions/src/delivery/repository.ts`, `functions/src/delivery/commands.ts`, `functions/src/index.ts`, `dataconnect/server/delivery.gql`, `scripts/codegen/delivery-operations.mjs`, `dataconnect/server/stock.gql`, `scripts/codegen/stock-operations.mjs`, `functions/src/stock/repository.ts`. Create `tests/integration/delivery-replacement.test.ts`, `tests/integration/delivery-races.test.ts`.

**Interfaces:** Callable `startDeliveryIssueReview`, `addDeliveryIssueNote`, `createDeliveryReplacement` przyjmują kontrakty Task2. Reuse normal SUBMIT/APPROVE/DISPATCH/REJECT dla późniejszych etapów zamówienia, ale powiązany request tworzy wyłącznie nowa komenda HQ. `initialAffectedQuantity` nigdy nie rośnie po utworzeniu sprawy; replacementAcceptedQuantity aktualizuje wyłącznie zaksięgowany dobry receipt powiązanej dosyłki.

- [ ] **Step1 — Write checks:** Dla sprawy2, createReplacement tworzy PENDING_APPROVAL items2 z właściwym salonem/SKU, bez inventory delta. Zwykły Submit nie może ustawić replacementIssueId. Po approve/dispatch/good receipt2: original receipt8, child2, sum good10, dispatch total12, RESOLVED. Druga próba child2 daje good1/bad1 → outstanding1, następne dziecko1, nie3; jest nadal jedna root issue. `review_and_note_retry_keep_one_event_and_stock_unchanged` weryfikuje HQ-only START_REVIEW/ADD_NOTE, ten sam klucz po utracie odpowiedzi i dokładnie jedno zdarzenie na rewizję.

  ```ts
  expect(rootReceipt.items[0].goodQuantity).toBe(8);
  expect(childReceipt.items[0].goodQuantity).toBe(2);
  expect(issue.items[0].outstandingQuantity).toBe(0);
  expect(issue.status).toBe('RESOLVED');
  expect(dispatchMovements.reduce((total, row) => total + row.quantity, 0)).toBe(12);
  ```
- [ ] **Step2 — RED:** `BARBERHQ_TEST_MODE=emulator npm run test:integration -- tests/integration/delivery-replacement.test.ts tests/integration/delivery-races.test.ts`. Expected: named FAIL przed implementacją nowych transakcji.
- [ ] **Step3 — Implement:** START_REVIEW OPEN→IN_REVIEW; ADD_NOTE do dowolnej otwartej sprawy, bez zmiany stocku; createReplacement ze stanów OPEN/IN_REVIEW tworzy wszystkie aktualne dodatnie outstanding, link i ActiveRequest atomowo, ustawia activeReplacementRequestId oraz REPLACEMENT_IN_PROGRESS. Nie pozwól klientowi wybrać ilości/SKU/salonu. Ordinary aktywny slot zwraca ALREADY_ACTIVE z uprawnionym linkiem, bez częściowego nowego zamówienia. Reject aktywnego childa czyści pointer i ustawia IN_REVIEW w tej samej transakcji odrzucenia; approval/dispatch nie czyszczą pointera. Odbiór childa dodaje good do licznika tej samej sprawy, czyści pointer i ustawia RESOLVED tylko przy wszystkich outstanding0, w przeciwnym razie IN_REVIEW. Zwykły niepowiązany request nie rozlicza sprawy.
- [ ] **Step4 — GREEN:** Te same checks plus dwa createReplacement równocześnie, retry po commicie, rejection kontra receipt, zero-good child, shortage HQ, foreign issue, stale issue/request, dwa różne keys. Expected: najwyżej jedno aktywne dziecko, nigdy replacementAccepted>initialAffected, brak podwójnego zamówienia i brak stocku po samej notatce/zamknięciu.
- [ ] **Step5 — Record:** Graph update i dowód wszystkich stanów; bez commit/stage.

### Task 5: Odczyty ilości, historii i powiązań procedur

**Files:** Create `web/src/app/features/delivery/data-access/{delivery-api,delivery.mapper}.ts`, `functions/src/delivery/procedures.ts`, `web/src/app/features/delivery/ui/delivery-procedure-settings.ts`, `shared/delivery-quantities.ts`, `tests/unit/delivery-quantities.test.ts`, `tests/integration/delivery-procedures.test.ts`. Modify `dataconnect/browser/{stock,delivery}.gql`, `dataconnect/server/delivery.gql`, `shared/contracts/stock.ts`, `web/src/app/features/replenishment/data-access/{request.mapper,replenishment-api}.ts`, `web/src/app/features/request-detail/feature/{request-detail.facade,request-detail.presentation}.ts`, `web/src/app/features/replenishment/ui/status-chip.ts`, `functions/src/delivery/commands.ts`, `functions/src/index.ts`.

**Interfaces:** `shared/delivery-quantities.ts` eksportuje `deliveryQuantities({dispatchedQuantity,receivedQuantity,receiptItem:null|DeliveryQuantities})` → `{inTransit,goodQuantity,damagedQuantity,missingQuantity}`; receipt null oznacza jeszcze niesprawdzoną dostawę. `setDeliveryProcedure` callable zmienia per-business binding z expectedRevision. `resolveDeliveryProcedures(dc,uid,requestId,kinds)` → bieżące uprawnione odnośniki albo jawny missing/unavailable dla każdego kind; nie wymaga RAG.

- [ ] **Step1 — Write checks:** Dispatch10/no receipt → transit10; receipt8/2/0 → transit0/good8/damaged2; receipt0/0/10 → transit0/missing10. Stare otrzymane10/backfill LEGACY → good10/transit0. Timeline dodaje nowe receipt events do starych ActionReceipt bez podwajania historycznego RECEIVE. `revoked_procedure_during_draft_is_unavailable` i foreign binding są denied; superseded opublikowana wersja pozostaje zgodna z obecnymi zasadami źródeł.

  ```ts
  expect(deliveryQuantities({ dispatchedQuantity: 10, receivedQuantity: 8,
    receiptItem: { productId: 'p', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 }
  })).toEqual({ inTransit: 0, goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 });
  ```
- [ ] **Step2 — RED:** `npm run test:unit -- tests/unit/delivery-quantities.test.ts`; `BARBERHQ_TEST_MODE=emulator npm run test:integration -- tests/integration/delivery-procedures.test.ts`. Expected: wymienione kontrakty FAIL przed kodem.
- [ ] **Step3 — Implement:** Obliczenia tranzytu w RequestDetail/DTO używają obecności końcowego receipt zamiast naiwnego dispatched−good. Istniejący InventoryRow i kontekst AI nie mają pola transit; nie rozszerzaj ich zbędnie — poprawne salda dostają z Inventory, a aktywne konflikty z aktualnych ActiveRequest. RECEIVED filter obejmuje oba końcowe stany; ACTIVE zachowuje proces przed odbiorem, a otwarte sprawy mają własny filtr/listę. Nie ukrywaj0 dobrych ani nie sumuj danych różnych produktów. DTO zawiera oryginalny i replacement good stock osobno, rodzica sprawy i paginowaną historię.
  HQ może przypisać DAMAGED/MISSING do dokumentu w małym dialogu „Delivery procedures” w obszarze problemów HQ, przez API/komendę z kluczem/revision; brak bindingu ma revision0. Wybór spośród aktualnie opublikowanych dokumentów firmy, bez nazw produktów/kodów DAM/DIS w kodzie. Demowe przypisania są danymi seed/operatora, bez publikowania corpus. Historyczna referencja przechowuje wersję/sekcję wskazaną przy receipt, nie „przeczytano”; wycofana wersja pozostaje denied z aktualnym dokumentem jako osobnym linkiem.
- [ ] **Step4 — GREEN:** Te same checks, testy mappera/status/history i `npm run typecheck`. Expected: brak pomylenia missing z damaged/transit i brak źródła z innej firmy; istniejące odczyty pełnego odbioru zachowane.
- [ ] **Step5 — Record:** Graph update; bez commit/stage. Nie zmieniaj modelu/embeddings ani publikacji dokumentów.

### Task 6: Formularz salonu z zachowaniem danych przy PDF i retry

**Files:** Create `web/src/app/features/delivery/feature/{delivery-receipt.facade,delivery-draft.store,delivery-journal}.ts` i odpowiednie `.spec.ts`; `web/src/app/features/delivery/ui/delivery-receipt.component.{ts,html,scss}`; `tests/e2e/delivery-receipt.spec.ts`. Modify `web/src/app/app.routes.ts`, `web/src/app/features/request-detail/feature/{request-detail.component.ts,request-detail.component.html,action-input.ts}`, `web/src/app/features/procedures/pdf-viewer/pdf-viewer.facade.ts`.

**Interfaces:** `DeliveryReceiptFacade` udostępnia context/loading/error, draft/items/report/procedures, validation/summary, busy/unknown i `submit():Promise<void>`. `DeliveryDraftStore` przechowuje niezapisany formularz w pamięci bieżącego user/business/salon/request. `DeliveryJournal` zachowuje tylko zamrożony wysłany payload/key i scope do uzgodnienia po unknown/reload; odrębny namespace od starych stock journals.

- [ ] **Step1 — Write BDD checks:** Given dispatched request10, When staff record8 good/2bad, Then widzą preview+8/issue2 i po zapisie odpowiednie trwałe dane. Given draft8/2, When PDF/open+Back, Then wszystkie pola i scope wracają bez model call. Given unknown result, When reload+reconcile, Then jeden receipt/movement/issue oraz ten sam key/payload. Osobno all-good, good0, sum invalid i keyboard/mobile. Etykiety kontrolek: „Good units · {productName}”, „Damaged units · {productName}”, „Missing units · {productName}”.

  ```ts
  await expect(page.getByRole('spinbutton', { name: 'Good units · Product A' })).toHaveValue('8');
  await expect(page.getByRole('spinbutton', { name: 'Damaged units · Product A' })).toHaveValue('2');
  expect(after.receipts).toHaveLength(1);
  expect(after.movements.filter(row => row.type === 'RECEIPT')).toHaveLength(1);
  ```
- [ ] **Step2 — RED:** `BARBERHQ_TEST_MODE=emulator BARBERHQ_BASE_URL=http://127.0.0.1:4210 npm run test:e2e -- tests/e2e/delivery-receipt.spec.ts --workers=1`. Expected: nazwane zachowanie UI FAIL przed implementacją; rzeczywiste lokalne Auth/SQL/stock/delivery callables, kontrolowane PDF bytes tylko dla geometrii.
- [ ] **Step3 — Implement:** Trasa `salons/:salonId/requests/:requestId/receipt` otwiera mały komponent z istniejącymi guardami i faktycznym request scope. HQ odbiera przez tę samą trasę tylko po jawnym wyborze uprawnionego kontekstu salonu, jak obecnie; globalny widok HQ nie otrzymuje nowej akcji odbioru. „Check delivery” zastępuje stary formularz RECEIVE; pozostałe approve/reject/dispatch dialogi bez zmian. Wszystkie pozycje mają nonnegative integer inputs good/damaged/missing; jawny przycisk potwierdzenia i podsumowanie, opis tylko przy problemie. Otwieranie procedury używa `returnTo=delivery-receipt` z uprawnionym request/workspace, nie dowolnego URL. Zamroź wysłany payload i blokuj edycję podczas busy/unknown; po definitive error odśwież authoritative context i pozwól jawnie poprawić z nowym key.
- [ ] **Step4 — GREEN:** Te same BDD checks, nowe Angular facade/store/journal specs przez `npm run test:web`. Dodatkowo zmiana konta/firmy/salonu podczas otwartego PDF, wycofana referencja, brak procedury i provider unavailable nie mogą fabrykować instrukcji/stocku. Po odczycie source-unavailable formularz zachowuje dane; source reference usuwana tylko jawnie przed nowym submit. Back ma istniejące style;320/360/1280px + Axe i klawiatura PASS.
- [ ] **Step5 — Record:** Zapisz screenshoty formularza/podsumowania/PDFreturn, graph update, bez commit/stage. Zweryfikowane niezgodne scope czyści niezapisany draft w pamięci; zamrożony unknown journal nie jest przepisywany do innego scope ani kasowany przez migrację i można go uzgodnić wyłącznie jako pierwotny uprawniony użytkownik w pierwotnym salonie. Jawne sign-out respektuje dotychczasową politykę odzyskiwania. Przejściowy auth/read error jedynie blokuje zapis.

### Task 7: Kolejka problemów HQ i widok sprawy po obu stronach

**Files:** Create `web/src/app/features/delivery/feature/{delivery-issues.facade,delivery-issue.facade}.ts` i specs; `web/src/app/features/delivery/ui/delivery-issue.component.{ts,html,scss}` oraz `delivery-issues-list.ts`; `tests/e2e/delivery-issue.spec.ts`. Modify `web/src/app/features/hq-queue/feature/{hq-queue.component,hq-queue.facade}.ts`, `web/src/app/features/request-detail/feature/request-detail.component.{ts,html}`, `web/src/app/app.routes.ts`, `web/src/app/core/request-navigation.ts`.

**Interfaces:** Trasy `hq/delivery-issues/:issueId` oraz `salons/:salonId/delivery-issues/:issueId`; `DeliveryIssueFacade` używa API Tasks4/5, udostępnia actions z bieżących uprawnień/statusu i zamraża klucz/payload przy unknown. `DeliveryIssuesFacade` zachowuje status/offset i niezależny count uprawnionych otwartych spraw.

- [ ] **Step1 — Write BDD checks:** HQ tworzy child2 z issue2, widzi PENDING_APPROVAL → RESERVED → DISPATCHED i linki; salon widzi tę samą sprawę, nie akcje HQ. Odbiór child1good/1bad pokazuje remaining1 i next child1; original receipt pozostaje8. `normal_active_order_conflict_keeps_issue_open` daje ALREADY_ACTIVE i brak dziecka/ukrytego movement. Zero-good label nie mówi „all received”.

  ```ts
  expect(issue.items[0].outstandingQuantity).toBe(1);
  expect(nextReplacement.items[0].quantity).toBe(1);
  expect(snapshot.issues).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Resolve issue', exact: true })).toHaveCount(0);
  ```
- [ ] **Step2 — RED:** `BARBERHQ_TEST_MODE=emulator BARBERHQ_BASE_URL=http://127.0.0.1:4210 npm run test:e2e -- tests/e2e/delivery-issue.spec.ts --workers=1`. Expected: nazwane zachowania FAIL przed UI.
- [ ] **Step3 — Implement:** Filtr „Delivery issues” i count w istniejącej kolejce HQ, własne loading/error/empty/pagination. Issue detail pokazuje oryginalne ilości, problem, odpowiedzi, postęp dobrych sztuk, listę dzieci z ich rzeczywistymi statusami, procedury i Back do uprawnionego kontekstu. HQ ma Start review, Add note, Create replacement; nie ma dowolnego Close/Resolve. Dialog configure procedures korzysta z Task5. Wszystkie busy/stale/unknown komendy uzgadniają ten sam payload/key; notatka nie przypomina czatu i nie rusza stocku. PDF otwarty ze sprawy wraca przez ograniczony marker `returnTo=delivery-issue` i sprawdzony issueId/workspace do tej samej sprawy; niezapisana notatka HQ pozostaje w pamięci tego scope. Zachowaj obecne powroty do assistant/Documents. Link „Replacement for…” w każdym dziecku wraca bezpośrednio do root issue; resolved historia nie usuwa pierwotnego problemu.
- [ ] **Step4 — GREEN:** Te same tests + Angular specs, keyboard/Axe/320/360/1280. Oddzielnie braki uprawnień, review deep link, zmiana salonu, odrzucony child, brak stocku oraz podwójny klik; expected zgodne DTO i jeden rezultat, żadnego bypassu scope.
- [ ] **Step5 — Record:** Screenshoty i graph update; bez commit/stage.

### Task 8: Migracja historii, reset lokalny i konkretna paczka release

**Files:** Create `scripts/migrations/delivery-receipts.ts`, `tests/unit/delivery-migration.test.ts`, `tests/integration/delivery-migration.test.ts`, `tests/e2e/delivery-legacy-client.spec.ts`, `scripts/config/prepare-delivery-functions.ts`, `tests/unit/delivery-functions-package.test.ts`, `docs/implementation/{delivery-upgrade,delivery-receipts-review}.md`, `docs/implementation/handoffs/delivery-receipts.md`. Modify `scripts/seed/reset.ts`, `dataconnect/server/seed.gql`, `tests/integration/reset.test.ts`, `tests/e2e/{demo-scenarios,replenishment,replenishment-ai}.spec.ts`, `README.md`, `docs/implementation/{acceptance-coverage,deployment-runbook}.md`.

**Interfaces:** `planDeliveryBackfill(snapshot):DeliveryBackfill` jest czysty; `applyDeliveryBackfill(dc,plan)` działa tylko z jawnie potwierdzonym celem i quiescent snapshotHash, insert-missing/verify, bez stock command. CLI domyślnie dry-run. Deterministyczne receipt IDs Task2; origin LEGACY z rzeczywistymi actor/time z ActionReceipt RECEIVE. Niespójna/brakująca historia odrzuca migrację do raportu operatora zamiast wymyślać autorów/czasów.

- [ ] **Step1 — Write checks:** Historyczne RECEIVED10 daje LEGACY receipt10 bez nowych movements/ActionKeys i z dokładnie tym samym actor/time; stare DISPATCHED bez fikcyjnego receipt/issue. Drugi backfill jest no-op, konflikt targetu i zmieniony snapshot fail closed. Reset usuwa wyłącznie nowe dane operacyjne i stare scoped dane według FK; zachowuje konfigurację DeliveryProcedureBinding jak salon settings oraz całą wiedzę/PDF. `legacy_unknown_receive_reconciles_without_new_movement` i `legacy_uncommitted_receive_requires_update_without_losing_journal` testują skoordynowane przejście.

  ```ts
  expect(after.stockMovements).toEqual(before.stockMovements);
  expect(after.actionKeys).toEqual(before.actionKeys);
  expect(after.inventories).toEqual(before.inventories);
  expect(after.knowledge).toEqual(before.knowledge);
  expect(backfilledReceipt).toMatchObject({ origin: 'LEGACY', recordedAt: legacyReceive.createdAt });
  ```
- [ ] **Step2 — RED:** Unit/integration: `npm run test:unit -- tests/unit/delivery-migration.test.ts tests/unit/delivery-functions-package.test.ts` oraz `BARBERHQ_TEST_MODE=emulator npm run test:integration -- tests/integration/delivery-migration.test.ts tests/integration/reset.test.ts`. Legacy browser: jak w Tasks6/7 z `tests/e2e/delivery-legacy-client.spec.ts`. Expected: named failures przed migracją/pakowaniem; wyłącznie fixture emulators.
- [ ] **Step3 — Implement:** Migracja paginuje wszystkie wybrane tabele stabilnie, kontroluje istniejący target i nie nadpisuje konfliktu; dowód restartu po częściowym wykonaniu. Snapshot całej starej operacyjnej historii/sald oraz wiedzy/oryginałów fixture porównany przed/po. `receiveTransfer` od Task3 uzgadnia tylko stare istniejące klucze; nierozpoznany unknown zachowuje dane i pokazuje kontrolowany upgrade/reconcile, nie czyści journalu i nie księguje ponownie. Nowy UI rozpoznaje stary format i udostępnia jego uzgodnienie. Stare snapshoty pełnego odbioru w testach aktualizuj do rozróżnienia3 stock action receipts + nowy delivery receipt/command; nie osłabiaj dowodu liczby faktycznych ruchów/replay.
  Pakowanie pozwala wyłącznie named compiled delivery/stock/common SDK i istniejące wersje zależności/konto, blokuje dodatkowe pliki/sekrety. Manifest + code/runtime/config hashes; exact function filters obejmują nowe callable i zmienione stock callables, nigdy przypadkowy deploy wszystkich funkcji. Przygotuj frontend z jawnego zatwierdzonego public snapshotu, zachowaj pełne runtime values i pierwotny lokalny generated baseline/build-record stan po testach. Raport musi zaznaczać, że cloud target SQL europe-west3 różni się od lokalnego europe-west1.
- [ ] **Step4 — GREEN i gate:** Uruchom `npm run test:unit`, `npm run test:web`, `npm run typecheck`, `npm run build:functions`, cały istniejący browser suite na emulatorach z BARBERHQ_TEST_MODE=emulator i włączonymi lokalnymi flagami RAG/PDF oraz skupione nowe/istniejące stock/access/races/reset integration. Każdy wynik przeczytaj, nie przypisuj historycznych PASS nowej paczce. Graph update. Zbuduj produkcyjny frontend i odpal lokalny `check:release --artifact-only` z jego faktycznym hashem i zatwierdzoną konfiguracją; porównaj source manifest. W lokalnej próbie10→8+2→child2→10 sprawdź wszystkie salda, root outstanding, dispatch12 i preservation źródeł, oraz child1good/1bad→next1. Rzeczywisty chmurowy smoke pozostaje osobnym zatwierdzeniem.
- [ ] **Step5 — Handoff:** Jedna niezależna końcowa recenzja całego nowego zakresu zgodnie z wybraną metodą wykonania. Napraw istotne uwagi z RED→GREEN, zapisz ograniczenia, listę plików, dokładne build/backend/schema IDs i plan backup/restore. Przygotowany runbook zawiera okno bez komend, kolejność additive schema→new backend→backfill/verify→preview→reload/smoke→live, oraz brak bezpiecznego rollbacku do starego receipt backendu po pierwszym częściowym zapisie. Nie wykonuj migracji, resetu ani publikacji bez osobnego konkretnego zatwierdzenia. Bez commit/stage/usuwania workspace.

## Samokontrola i handoff planu

- AC1–4 projektu → Tasks1–3; AC5–7 → Task4 i Task7; AC8–9 → Tasks2–4/6/8; AC10 → Tasks5–6; AC11 → Tasks6–7; AC12 → Task8.
- Pięć Review Focus ma jawne testy w przypisanych etapach. Procedury są zarządzane przez HQ, model opcjonalny; brak uploader/push nie jest ukrytym częściowym wdrożeniem.
- Zależności:1→2→3→4;5 korzysta z2–4;6 korzysta z3/5;7 z4–6;8 integruje całość. Taski są etapami lokalnymi, nie osobnymi publikacjami niezgodnych wersji.
- Utrzymujemy wcześniejszą preferencję wykonania inline/native w bieżącej rozmowie. Po przeglądzie planu przez właściciela wykonanie używa Superpowers executing-plans. Bieżące zatwierdzenie dotyczyło projektu i przygotowania planu; kod funkcji jeszcze nie powstał.
