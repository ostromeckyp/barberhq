# Autoryzowany podgląd PDF — konfiguracja 3A

Endpoint `getSourcePdf` odczytuje oryginał z prywatnego Storage po sprawdzeniu Firebase Auth, App Check i członkostwa w SQL Connect. Nie wymaga ręcznego dodawania DAM-001 do Storage: wersja v1 jest już opublikowana. Dostęp do historycznej opublikowanej wersji pozostaje możliwy, dopóki nie została wycofana. Nieopublikowane wersje może oglądać tylko HQ.

## Stan projektu i brakujące kroki

Odczyt konfiguracji 13 października 2026 potwierdził istniejący bucket i opublikowaną wiedzę. W toku konfiguracji właściciel zarejestrował aplikację Firebase Web `BarberHQ Demo`; CLI potwierdził jej stan ACTIVE i app ID `1:719803142610:web:c99a305b81f08c1577f80b`. Właściciel włączył również logowanie email/password i sześć API wymienionych poniżej oraz nadał kontu runtime Auth Viewer. Konto runtime ma projektowe role Vertex AI User, SQL Connect API Data Admin i Firebase Authentication Viewer. Stan po wdrożeniu: browser connector działa w `notbad-6be95-service/europe-west3`, bez migracji; `getSourcePdf` działa w `europe-west1` jako Node 22 gen 2 pod adresem [endpointu](https://europe-west1-notbad-6be95.cloudfunctions.net/getSourcePdf), z kontem `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`. Tymczasowy Hosting foundation jest dostępny pod [tym adresem](https://notbad-6be95--foundation-unesffgt.web.app) do `2026-10-21T09:15:18.608405191Z` (11:15 Europe/Warsaw). Uwierzytelnione pobranie prywatnego PDF przez Auth, App Check, SQL i Storage, podświetlenie cytatu oraz odświeżenie tego samego URL z zachowaniem strony i chunku zostały sprawdzone. Zakres READY obejmuje ścieżkę źródła jednego dokumentu. Szeroki przegląd jest czysty; hash pobrania w przeglądarce pozostaje w trakcie weryfikacji.

1. **Gotowe:** aplikacja Web `BarberHQ Demo` jest zarejestrowana w projekcie `notbad-6be95`.
2. **Provider gotowy:** API potwierdziło włączone logowanie email/password i obecność obu domen Hosting na liście Auth. Właściciel przygotował konta demo i ich członkostwa SQL 14 października; odczyt wykazał 4 lokalizacje, 6 produktów, 24 inventory i 4 członkostwa (1 HQ, 3 SALON). Konto Google wdrażające aplikację nie jest kontem pracownika salonu; uprawnienia salonu pochodzą z tabeli `Membership`.
3. **Provider gotowy:** API potwierdziło App Check dla `BarberHQ Demo` z **reCAPTCHA Enterprise** i TTL 1 godzina. Istniejący klucz Web/SCORE, bez trybu testowego, pozwala na dokładne domeny `notbad-6be95--foundation-unesffgt.web.app`, `notbad-6be95.web.app` i `notbad-6be95.firebaseapp.com`; `allowAllDomains` jest `false`. Produkcyjny klucz nie powinien zawierać `localhost`; lokalny profil aplikacji używa emulatorów. W produkcji endpoint wymaga ważnego tokenu App Check. [Oficjalna instrukcja](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
4. **Rola gotowa:** IAM potwierdził projektową rolę **Firebase Authentication Viewer** (`roles/firebaseauth.viewer`) na `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`. Endpoint wywołuje `verifyIdToken(token, true)`, żeby sprawdzić również wycofanie sesji i wyłączenie użytkownika; to wymaga odczytu użytkownika (`firebaseauth.users.get`). [Sprawdzanie sesji](https://firebase.google.com/docs/auth/admin/manage-sessions), [uprawnienia roli](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth).
5. Dostęp do prywatnego Storage potwierdzono przez rzeczywisty uwierzytelniony odczyt PDF. Nie dodawaj roli Storage Admin ani klucza JSON.

**API gotowe i zweryfikowane:** Functions, Run, Build, Artifact Registry, App Check i reCAPTCHA Enterprise. Polecenie do odtworzenia konfiguracji:

```sh
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebaseappcheck.googleapis.com \
  recaptchaenterprise.googleapis.com \
  --project=notbad-6be95
```

W konsoli rolę Auth Viewer dodaje się w **IAM → Grant access**, jako principal wskazując konto runtime. Rola Service Account User nadana wcześniej Twojemu kontu pozwala przypisać konto runtime do Functions; nie daje samemu runtime dostępu do Auth.

Początkowy odczyt IAM po zgłoszeniu zapisu w konsoli nie potwierdził Auth Viewer. Właściciel wykonał poniższe polecenie w Cloud Shell; kolejny odczyt potwierdził rolę. Polecenie do odtworzenia konfiguracji:

```sh
gcloud projects add-iam-policy-binding notbad-6be95 \
  --member='serviceAccount:baberhq-runtime@notbad-6be95.iam.gserviceaccount.com' \
  --role='roles/firebaseauth.viewer' \
  --condition=None
```

Publiczna konfiguracja Web została pobrana przez CLI do ignorowanego `artifacts/cloud-web-sdk.json`. Zwalidowane `artifacts/cloud-public-config.json` łączy ją z rzeczywistym celem SQL i kluczem App Check dla podglądu źródła; flagi biblioteki i AI pozostają wyłączone. Później wygenerowano i zweryfikowano izolowany SDK oraz build produkcyjny: 49 plików, SHA-256 `c3a628517999a4e9c846284014492fe75c1d70a47572964cb5ebbbe2be4be4fa`; bramka Hosting przeszła; plików `*.local.json` nie odczytano ani nie zmieniono.

## Konfiguracja endpointu

Parametry Functions są publicznymi identyfikatorami zasobów, nie sekretami:

| Parametr | Domyślna wartość produkcyjna |
|---|---|
| `SOURCE_PDF_SQL_SERVICE` | `notbad-6be95-service` |
| `SOURCE_PDF_SQL_LOCATION` | `europe-west3` |
| `SOURCE_PDF_BUCKET` | `notbad-6be95.firebasestorage.app` |
| `SOURCE_PDF_ALLOWED_ORIGINS` | `https://notbad-6be95--foundation-unesffgt.web.app,https://notbad-6be95.web.app,https://notbad-6be95.firebaseapp.com` |

Endpoint działa w `europe-west1`, zgodnie z dotychczasową konfiguracją Functions, jako Node 22 gen 2. Jego URL to `https://europe-west1-notbad-6be95.cloudfunctions.net/getSourcePdf`, a konto runtime to `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`. Lokalny emulator używa jawnie `barberhq/europe-west1`; nie zmienia produkcyjnego celu SQL. Publiczna konfiguracja zawiera cztery parametry endpointu, w tym trzy originy powyżej; ich zachowanie potwierdzono żądaniami HTTP. Plików środowiskowych ani danych JWT/hasła nie odczytywano. HTTP preflight dla preview zwrócił 204 z dokładnym ACAO; obcy origin otrzymał 403 `FORBIDDEN`. Anonimowe żądanie endpointu zwróciło 401 `UNAUTHENTICATED` z nagłówkami private/no-store. Nie stosuj wildcardu ani listy domen tylko w Angularze.

Publiczne `pdfReadUrl` może wskazywać wdrożony endpoint; przy jego braku klient składa standardowy adres Functions z projektu i regionu. `knowledgeEnabled` pozostaje flagą przyszłego modułu biblioteki dokumentów; w 3A dostępna jest bezpośrednia, chroniona trasa źródła. Pełnej biblioteki ani endpointu upload nie dodano w tym etapie.

Lokalny czytnik serwera wymaga projektu `demo-barberhq`, bucketa `demo-barberhq.appspot.com` i jawnego lokalnego endpointu Storage (`FIREBASE_STORAGE_EMULATOR_HOST` lub `STORAGE_EMULATOR_HOST`). Standardowy `dev:emulators` uruchamia Auth, SQL Connect i Functions, więc sam nie zapewnia oryginałów PDF. Bez Storage emulatora odczyt kończy się błędem dostępności przed utworzeniem klienta Storage. W produkcji endpoint odrzuca konfigurację emulatora. Testy czytnika dostarczają prywatne bajty PDF z fixture; nie skonfigurowano w tym etapie lokalnego importu oryginałów ani nie zmieniono Twoich poleceń uruchamiania emulatorów.

Dla wdrożonego foundation przygotowano oddzielny SDK przeglądarkowy dla `notbad-6be95-service/europe-west3` i build aplikacji z publiczną konfiguracją chmurową:

```sh
node --import tsx scripts/config/generate-cloud-browser-sdk.ts
node --import tsx scripts/config/build-web.ts --config artifacts/cloud-public-config.json --project notbad-6be95
```

Wdrożony endpoint przygotowano w odizolowanym katalogu Functions, instalując zależności z wyłączonymi skryptami pakietów i przekazując konfigurację wdrożeniową jawnie. Powtórzenie wdrożenia wymaga uruchomienia z katalogu repozytorium:

```sh
npm run build:functions
node --import tsx scripts/config/prepare-source-functions.ts
cd artifacts/source-functions/functions && npm install --ignore-scripts
cd .. && ../../node_modules/.bin/firebase deploy --config firebase.json --only functions:stock:getSourcePdf --project notbad-6be95 --interactive
```

CLI wdrożyło funkcję poprawnie; kod 2 pochodził z anulowanego, opcjonalnego promptu porządkowego po deployu.

Generator zapisuje przygotowaną konfigurację w ignorowanym `artifacts/cloud-browser-sdk` i SDK w ignorowanym `web/src/app/core/generated-cloud`; po świeżym checkoutcie trzeba go uruchomić ponownie. Produkcyjny build Angulara zastępuje moduł SDK chmurowym, a build emulatora nadal używa lokalnego `barberhq/europe-west1`:

```sh
node --import tsx scripts/config/build-web.ts --config config/emulator.example.json --project demo-barberhq --emulator
```

Oba buildy sprawdzają zgodność publicznej konfiguracji z wybranym SDK. Nie uruchamiaj głównego generatora SDK ani nie wdrażaj lokalnej konfiguracji SQL do chmury. [Instrukcja publikacji wiedzy](knowledge-publication.md) opisuje oddzielną konfigurację chmurową server/vector. Konta demo i członkostwa SQL zostały przygotowane przez właściciela 14 października; odczyt potwierdził 4 lokalizacje, 6 produktów, 24 rekordy inventory oraz 4 członkostwa (1 HQ, 3 SALON). Browser connector wdrożono do `notbad-6be95-service/europe-west3` bez migracji, a tymczasowy Hosting foundation działa pod [adresem preview](https://notbad-6be95--foundation-unesffgt.web.app) do `2026-10-21T09:15:18.608405191Z` (11:15 Europe/Warsaw). `getSourcePdf` wdrożono i zaakceptowano dla jednego dokumentu. Właściciel odczytał sześć produktów i stan stock HQ, otworzył PDF DAM-001 v1 przez Auth, App Check, SQL i prywatny Storage, zobaczył podświetlony chunk `not-bad-stuff-demo:DAM-001:v1:1:2` oraz potwierdził, że odświeżenie tego samego URL zachowuje wersję, chunk i stronę 1. Zrzuty: `artifacts/cloud-pdf-source-citation.png` i `artifacts/cloud-pdf-source-refresh.png`. Przyciski zoomu 125% i obrotu zadziałały bez błędu. Główny dowód chmurowy pokazuje stronę przy 100% z dopasowanym podświetleniem, odświeżeniem tego samego URL i udanym pobraniem. Hash PDF pobranego z przeglądarki: 24 423 bajty, SHA-256 `b6f877bd6ed8842e9b5e9fd1c679bf1d05322fae8dcad86a7deb7836b52f1edd`, zgodny z zatwierdzonym oryginałem. Szeroki review jest czysty po poprawce P2 emulatorowego guardu ingestion; sześć ukierunkowanych kontroli i root typecheck przeszły. Opcjonalny prompt o czyszczenie obrazów repozytorium po wdrożeniu został anulowany; CLI zwróciło kod 2 po udanym deployu. Automatyczne czyszczenie obrazów nie jest ustawione i może oznaczać koszt przechowywania; operator może ustawić je osobno. Aktualny link dla właściciela (wymaga logowania): [DAM-001, strona 1](https://notbad-6be95--foundation-unesffgt.web.app/procedures/sources/not-bad-stuff-demo%3ADAM-001%3Av1?page=1); link do zweryfikowanego chunku: [DAM-001 — przyjęcie produktu](https://notbad-6be95--foundation-unesffgt.web.app/procedures/sources/not-bad-stuff-demo%3ADAM-001%3Av1?page=1&chunk=not-bad-stuff-demo%3ADAM-001%3Av1%3A1%3A2). Pełna funkcja ręcznego uzupełniania zapasów nie jest wdrożona: feature flags pozostają wyłączone, a ten build obejmuje wyłącznie podgląd źródła PDF.

## Sprawdzenie po wdrożeniu

Otwórz jako uprawniony pracownik, po zalogowaniu, na tymczasowym preview:

[https://notbad-6be95--foundation-unesffgt.web.app/procedures/sources/not-bad-stuff-demo%3ADAM-001%3Av1?page=1](https://notbad-6be95--foundation-unesffgt.web.app/procedures/sources/not-bad-stuff-demo%3ADAM-001%3Av1?page=1)

Bezpośredni link do zweryfikowanego chunku przyjęcia (wymaga logowania):

[DAM-001 — przyjęcie uszkodzonego produktu](https://notbad-6be95--foundation-unesffgt.web.app/procedures/sources/not-bad-stuff-demo%3ADAM-001%3Av1?page=1&chunk=not-bad-stuff-demo%3ADAM-001%3Av1%3A1%3A2)

Link z cytowaniem dodaje `&chunk=<dokładny identyfikator zapisanego fragmentu>`. Identyfikator fragmentu i wersji muszą pasować; strona fragmentu ma pierwszeństwo przed parametrem `page`. Użyj faktycznie zapisanego ID, nie nazwy nagłówka ani ID innej wersji.

Odmowa anonimowego dostępu i obcego originu, odczyt autoryzowany, podświetlenie oraz zachowanie strony/chunku po odświeżeniu przeszły w chmurze. Zoom 125% i obrót sprawdzono bez błędu; hash pobranego PDF zgadza się z zatwierdzonym oryginałem. Testy lokalne z PDF-em dostarczanym przez fixture nie zastępują tych sprawdzeń w chmurze. Stan walidacji: [handoff 3A](handoffs/increment-3a.md).
