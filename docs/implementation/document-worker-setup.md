# Biblioteka dokumentów — kolejka i konto runtime

Stan 19 października 2026: po zatwierdzeniu właściciela backend biblioteki został wdrożony. Cloud Tasks API, uprawnienie runtime do użycia własnej tożsamości, migracja SQL i backfill czterech liczników są wykonane. Worker jest ACTIVE, kolejka RUNNING; potwierdzone limity to 3 próby, 2 równoległe zadania, minimalny backoff 360 s i timeout workera 300 s. Konto runtime ma Enqueuer tylko na kolejce i Invoker tylko na workerze. Właściciel nie musi ponawiać poniższej konfiguracji. UI biblioteki oraz pełny uwierzytelniony test cyklu dokumentu pozostają w toku; patrz [handoff](handoffs/increment-3b.md).

## Tożsamości i zakres dostępu

Angular wysyła token zalogowanego użytkownika Firebase i token App Check. Backend sprawdza aktualną rolę HQ w SQL. Zapisy do Storage, SQL, wywołania Vertex AI i dodawanie zadań wykonuje konto **`baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`** przez ADC. Worker otrzymuje wywołanie Cloud Tasks z OIDC tej samej tożsamości; konto Google właściciela służy do konfiguracji i deploymentu.

| Uprawnienie | Gdzie | Cel |
| --- | --- | --- |
| Dotychczasowe Object Viewer + Object Creator | Tylko bucket `notbad-6be95.firebasestorage.app` | Odczyt i tworzenie niezmiennych PDF-ów |
| Dotychczasowe Vertex AI User, SQL Connect Data Admin, Firebase Authentication Viewer | Projekt `notbad-6be95` | Embeddingi, SQL, sprawdzanie unieważnienia sesji |
| Cloud Tasks Enqueuer | Tylko kolejka `processKnowledgeTask`, `europe-west1` | Dodanie zadania |
| Cloud Run Invoker | Tylko usługa workera | Wywołanie prywatnego workera |
| Service Account User | Konto runtime, dla niego samego | Dołączenie tożsamości OIDC do zadania |

Firebase CLI 15.32.0 próbuje ustawić dwa środkowe powiązania dla tożsamości wskazanej w `onTaskDispatched.invoker`: kod CLI `fabricator.js` wywołuje `run.setInvokerCreate` i `cloudtasks.setEnqueuer`. Przy pierwszym wdrożeniu wystąpił błąd CLI przy pustej tablicy IAM bindings; po utworzeniu workera brakujące powiązanie Enqueuer dodano tylko na tej kolejce i sprawdzono obie rzeczywiste polityki. Nie nadano tych ról na cały projekt. [Opis tożsamości i IAM Cloud Tasks](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks), [kolejki Firebase Functions](https://firebase.google.com/docs/functions/task-functions).

## Przygotowanie przez właściciela

Te dwa polecenia są konkretną zmianą konfiguracji i IAM. Uruchom je po ustaleniu wdrożenia backendu; nie są częścią testów lokalnych:

```sh
gcloud services enable cloudtasks.googleapis.com --project=notbad-6be95

gcloud iam service-accounts add-iam-policy-binding \
  baberhq-runtime@notbad-6be95.iam.gserviceaccount.com \
  --project=notbad-6be95 \
  --member='serviceAccount:baberhq-runtime@notbad-6be95.iam.gserviceaccount.com' \
  --role='roles/iam.serviceAccountUser' --condition=None
```

Drugie polecenie dodaje konto runtime jako użytkownika **tego samego konta**. Wcześniejsza rola Service Account User dla właściciela umożliwia deployment; to odrębny principal. [Uprawnienie do użycia konta usługi](https://docs.cloud.google.com/iam/docs/service-accounts-actas).

## Parametry i sprawdzenie deploymentu

Docelowo: Functions Gen2 / Node22, region `europe-west1`, timeout workera 300 s, maksymalnie 3 próby zadania i 2 równoległe zadania. Minimalny odstęp ponowienia to 360 s, aby blokada ekstrakcji trwająca 360 s mogła wygasnąć po utracie procesu przed wyczerpaniem prób. Kolejkę tworzy pierwszy deployment funkcji. Limity nie oznaczają, że dokument został opublikowany: EXTRACT kończy się przeglądem przez człowieka, a PUBLISH wymaga zatwierdzenia wszystkich stron i niezmienionych rewizji. [Konfiguracja kolejki](https://firebase.google.com/docs/functions/task-functions).

Po deploymentcie sprawdź:

```sh
gcloud tasks queues describe processKnowledgeTask \
  --project=notbad-6be95 --location=europe-west1 \
  --format='yaml(name,state,retryConfig,rateLimits)'

gcloud tasks queues get-iam-policy processKnowledgeTask \
  --project=notbad-6be95 --location=europe-west1

gcloud functions describe processKnowledgeTask --gen2 \
  --project=notbad-6be95 --region=europe-west1 \
  --format='yaml(serviceConfig.service,serviceConfig.serviceAccountEmail,serviceConfig.timeoutSeconds,serviceConfig.uri)'

gcloud iam service-accounts get-iam-policy \
  baberhq-runtime@notbad-6be95.iam.gserviceaccount.com \
  --project=notbad-6be95
```

Politykę Cloud Run odczytaj dla usługi zwróconej w `serviceConfig.service`, w tym samym regionie. Worker nie może mieć Invokera `allUsers` ani `allAuthenticatedUsers`; ma go mieć wskazane konto runtime. Próba wywołania bez tożsamości zadania musi być odrzucona przez IAM. Zwykłe logowanie Firebase w Angularze nie daje prawa bezpośredniego wywołania workera. Nagłówki `X-CloudTasks-*` nie zastępują uwierzytelnienia. Osobno sprawdzamy prawdziwy upload, przetworzenie, zatwierdzenie, duplikat zadania i wycofanie podczas publikacji.

## Granica rozmiaru PDF

Limit aplikacji to **10 MiB i 30 stron**. Functions Framework buforuje `rawBody` przed handlerem, więc sprawdzamy rzeczywistą długość bajtów przed parserem i zapisem do Storage, także gdy `Content-Length` jest błędne. Nie deklarujemy limitu pamięci 10 MiB na wejściu sieciowym: limit platformy Gen2 wynosi 32 MB, a buforowanie następuje wcześniej. Emulator CLI używa parsera z limitem `32mb`. [Kod Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs/blob/main/src/server.ts), [limity platformy](https://docs.cloud.google.com/functions/quotas).

Nie aktywuj biblioteki w Angularze przed migracją/backfillem licznika wersji, wdrożeniem sprawdzonych operacji SQL i przejściem testów chmurowych. Dotychczasowe dokumenty nie wymagają ponownego uploadu ani zmiany dat publikacji.
