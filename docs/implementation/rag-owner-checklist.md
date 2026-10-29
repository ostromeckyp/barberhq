# Prywatny Storage i Vertex AI — checklista właściciela

Projekt Firebase: `notbad-6be95`. **Stan 12 października 2026:** właściciel utworzył Storage, SQL Connect i konto runtime oraz włączył Vertex AI. Rzeczywisty test `gemini-embedding-001` w `europe-west3` potwierdził embeddingi dokumentu i zapytania o wymiarze 768. Poniższa checklista pozostaje instrukcją konfiguracji od zera — ukończonych kroków nie trzeba powtarzać.

Bucket: `notbad-6be95.firebasestorage.app` (`US-EAST1`). SQL Connect: `notbad-6be95-service` (`europe-west3`). Faktycznie utworzone konto to **`baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`** (pisownia identyfikatora jest istotna). Ma role `roles/aiplatform.user` i `roles/firebasedataconnect.dataAdmin` w projekcie oraz `roles/storage.objectViewer` i `roles/storage.objectCreator` na bucketcie. Właściciel nadał swojemu kontu rolę `roles/iam.serviceAccountUser` na tym koncie runtime. Lokalny import korzysta z ADC operatora; konto runtime zostanie użyte przez Functions po wdrożeniu. Stan publikacji opisuje [handoff 3A](handoffs/increment-3a.md), a polecenia [instrukcja publikacji](knowledge-publication.md).

## 1. Zaloguj właściwe narzędzia

Zainstaluj/uruchom aktualny Firebase CLI i Google Cloud CLI. To dwie oddzielne sesje logowania: `firebase login` obsługuje Firebase CLI, a `gcloud auth application-default login` tworzy poświadczenia ADC używane przez lokalne biblioteki Google, w tym późniejszy operator Genkit. Samo `gcloud auth login` nie zastępuje ADC.

Przed ustawieniem projektu quota potwierdź, że Twoja tożsamość ma w projekcie rolę `roles/serviceusage.serviceUsageConsumer` albo inną rolę zawierającą `serviceusage.services.use`. Bez tego `set-quota-project` zakończy się błędem.

```sh
firebase login
firebase projects:list

gcloud auth login
gcloud config set project notbad-6be95
gcloud auth application-default login
gcloud auth application-default set-quota-project notbad-6be95
```

Sprawdź w konsoli, że wybrany projekt to `notbad-6be95` i ma podpięte rozliczenia Blaze. Nie zapisuj pliku klucza konta usługi, tokenu ani poświadczeń ADC w repozytorium. Nie ustawiaj `GOOGLE_APPLICATION_CREDENTIALS` na pobrany klucz. [Firebase CLI](https://firebase.google.com/docs/cli), [ADC w środowisku lokalnym](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment) i [różnica między loginem gcloud a ADC](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc).

## 2. Utwórz prywatny bucket

W Firebase Console otwórz **Storage → Get started**. Wybierz lokalizację po porównaniu z regionem SQL Connect/Cloud SQL i regionem przetwarzania modelu. Zapisz dokładną lokalizację i nazwę bucketu wyświetloną w konsoli; nie wyprowadzaj nazwy ani sufiksu z ID projektu. Nowy domyślny bucket często ma sufiks `firebasestorage.app`, starszy może mieć `appspot.com`.

Pozostaw dostęp niepubliczny. W konsoli wybierz **Rules**, zastąp reguły poniższą regułą odmawiającą dostępu i kliknij **Publish**:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

Backend użyje IAM do dostępu do oryginalnych, niezmiennych PDF-ów. Nie twórz trwałych linków pobierania ani publicznych tokenów. [Tworzenie bucketu i aktualne formaty nazw](https://firebase.google.com/docs/storage/web/start), [Firebase Admin SDK i Storage](https://firebase.google.com/docs/storage/admin/start), [reguły Storage](https://firebase.google.com/docs/storage/security).

## 3. Włącz API modelu, ale jeszcze nie wybieraj wymiaru

Wybierz lokalizację endpointu Vertex AI dopiero po sprawdzeniu, że wybrany model jest tam dostępny i że lokalizacja spełnia wymagania przetwarzania danych. Zapisz konkretną lokalizację z aktualnej tabeli modeli; lokalizacja Storage jej nie wyznacza. Agent wykona probe w tej lokalizacji. Po potwierdzeniu projektu i uprawnień właściciel może włączyć Vertex AI API. To polecenie jest instrukcją do samodzielnego uruchomienia:

```sh
gcloud services enable aiplatform.googleapis.com --project=notbad-6be95
```

Do włączenia API potrzebne jest `serviceusage.services.enable` (np. przez Service Usage Admin, jeśli Twoje konto nie ma już odpowiedniego dostępu). Przy istniejącym projekcie użyj już nadanych uprawnień właściciela; przewodnik nie wymaga tworzenia dodatkowych kont. [Włączanie usług w projekcie](https://cloud.google.com/service-usage/docs/enable-disable).

Sprawdź bieżącą tabelę modeli embeddingów, języki, dostępność w regionie i wymiary w [dokumentacji modeli embeddingów](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) oraz [regionów i endpointów](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations). Dokument źródłowy jest po angielsku, ale polskie nazwy salonów i przykładowe polskie zapytania muszą być obsłużone. Nie traktuj wcześniejszej propozycji 768 jako zatwierdzonej.

Po nadaniu lokalnemu operatorowi dostępu agent wykona rzeczywiste wywołanie embeddingu dla angielskiego dokumentu i przykładowych polskich zapytań salonowych, sprawdzi poprawne odpowiedzi, skończone wartości i zgodne wymiary. Dopiero po udanym probe właściciel i agent zapisują razem faktyczne `modelId`, wybraną lokalizację, tryby dokument/zapytanie i wymiar, a potem przypinają schemat wektorów. W razie błędu lub niezgodności nie twórz schematu na podstawie przypuszczeń. [Genkit z Gemini Enterprise/Vertex AI](https://genkit.dev/docs/js/integrations/vertex-ai/).

## 4. Nadaj role osobno i na najwęższym zakresie

Przypisuj role do wskazanych kont lub kont runtime, najlepiej na poziomie bucketu, gdy rola dotyczy Storage. Rola przyznana projektowi może objąć wszystkie buckety projektu.

| Tożsamość | Minimalny punkt wyjścia |
|---|---|
| Lokalny operator importu i probe | `roles/storage.objectViewer` + `roles/storage.objectCreator` na konkretnym buckecie; `roles/aiplatform.user` oraz `roles/serviceusage.serviceUsageConsumer` w projekcie (lub istniejąca rola zawierająca `serviceusage.services.use`). Operator korzysta z własnego ADC. |
| Runtime endpointu źródłowego | `roles/storage.objectViewer` na konkretnym buckecie. Autoryzację użytkownika i dostępu do źródła nadal sprawdza backend w Auth/SQL. |
| Runtime ingestii | `roles/storage.objectViewer` + `roles/storage.objectCreator` na konkretnym buckecie oraz `roles/aiplatform.user` w projekcie. Gdy agent poda email utworzonego konta runtime, przypisz role tej tożsamości. |

Operator i backend korzystający z Admin SDK SQL Connect potrzebują także `roles/firebasedataconnect.dataAdmin` albo istniejącej roli zawierającej wymagane uprawnienia odczytu/zapisu API. Tożsamość wdrażająca potrzebuje `roles/iam.serviceAccountUser` na wybranym koncie runtime, aby przypisać je funkcjom. Nie pobieraj klucza JSON: wdrożone Functions dostają poświadczenia przypisanego konta automatycznie.

`Storage Object Creator` nie pozwala odczytywać, usuwać ani nadpisywać obiektów; w połączeniu z `Storage Object Viewer` operator/worker może sprawdzić istniejące oryginały i tworzyć nowe. Jeśli wdrożenie wymaga innych operacji lub Cloud Tasks, agent powinien uzasadnić dodatkowe konkretne uprawnienia przed ich nadaniem. Nie dawaj runtime’owi `Storage Admin`, `Owner` ani `Editor`. [Uprawnienia ról Cloud Storage](https://docs.cloud.google.com/storage/docs/access-control/iam-roles), [role przyznawane na poziomie bucketu](https://docs.cloud.google.com/storage/docs/access-control/iam).

Uprawnienie quota project jest potrzebne do operacji ADC `set-quota-project`; sprawdź rolę przed wykonaniem polecenia. [Referencja gcloud `set-quota-project`](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/set-quota-project), [wymagane uprawnienia quota project](https://docs.cloud.google.com/docs/quotas/set-quota-project).

## 5. Zapisz wartości dla agenta i zatrzymaj się na bramce probe

Przekaż agentowi: ID projektu `notbad-6be95`, dokładną nazwę i lokalizację bucketu, wybraną lokalizację endpointu Vertex AI, tożsamość operatora oraz role, które rzeczywiście nadano. Gdy agent utworzy konta runtime i poda ich adresy, nadaj opisane role tym tożsamościom. Nie wklejaj haseł, kluczy ani tokenów do repozytorium, Angulara ani commitowanego `.env`; backend może używać chronionej konfiguracji środowiska lub Secret Manager.

**Gotowe do dalszej pracy** oznacza prywatny bucket istniejący w zapisanej lokalizacji, opublikowane reguły odmawiające dostępu klienta i potwierdzony dostęp ADC operatora. Konfiguracja modelu pozostaje niezatwierdzona, dopóki rzeczywisty probe Genkit dla dokumentu i polskiego zapytania nie potwierdzi modelu, wybranej lokalizacji, trybów i wymiaru. Zachowaj oryginalne PDF-y jako prywatne i niezmienne; publikacja wymaga osobnego przeglądu treści.
