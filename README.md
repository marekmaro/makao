# PAW & DECK — gry karciane (PWA)

Makao, Kocia Ekipa vs Psy i Remik w jednej aplikacji. Trzy sposoby gry: z botem, we dwoje na jednym
telefonie albo online ze znajomymi (z czatem przy stole).

## Co jest w repozytorium

| Plik | Do czego służy |
| --- | --- |
| `index.html` | Cała gra (wygląd + logika) |
| `manifest.webmanifest` | Opis aplikacji dla telefonu: nazwa, ikona, kolory |
| `sw.js` | Service worker — dzięki niemu gra się instaluje i działa bez internetu |
| `icons/` | Ikony aplikacji |
| `tests/engine-test.js` | Testy zasad Makao (`node tests/engine-test.js`) |

## Instalacja na telefonie

**Samo pobranie pliku `index.html` nie wystarczy.** Przeglądarka instaluje aplikację (PWA) tylko ze strony
otwartej pod adresem `https://…`. Plik otwarty z dysku (`file://…`) zadziała jako zwykła strona, ale nie da się
go zainstalować i nie będzie działał offline.

To repozytorium jest gotowe pod GitHub Pages — wystarczy je włączyć:

1. Na GitHubie wejdź w repozytorium → **Settings → Pages**.
2. W „Build and deployment” wybierz **Deploy from a branch**, gałąź `main`, folder `/ (root)` i zapisz.
3. Po około minucie gra jest pod adresem <https://marekmaro.github.io/makao/>.

Potem na telefonie:

- **Android (Chrome, Edge, Samsung Internet):** otwórz adres, w grze stuknij menu ☰ →
  „Zainstaluj aplikację” i potwierdź. Jeśli przycisk nie otwiera okna instalacji:
  menu przeglądarki ⋮ → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.
- **iPhone / iPad:** otwórz adres w **Safari** → Udostępnij → „Do ekranu początkowego” → Dodaj.

Po instalacji gra otwiera się na pełnym ekranie i działa bez internetu (gra z botem i na jednym telefonie).
Przy pierwszym otwarciu potrzebny jest internet — wtedy pobierają się biblioteki i czcionki.

Inne darmowe hostingi (Netlify Drop, Cloudflare Pages, Firebase Hosting) działają tak samo: wrzucasz
wszystkie pliki z tego repozytorium.

### Aktualizacja gry

Po każdej zmianie plików podbij numer w `sw.js` (`const VERSION = 'paw-deck-v4.0.0'`). Telefony pobiorą
nową wersję przy następnym otwarciu aplikacji z internetem.

## Gra online i czat (Firebase)

Tryb „Ze znajomymi” i czat między telefonami potrzebują serwera, który przekazuje ruchy między graczami.
Gra używa do tego darmowego Firebase. Bez konfiguracji działają tryby „Graj z botem” i „Jeden telefon”,
a przycisk „Ze znajomymi” informuje, że gra online jest niedostępna.

1. Wejdź na <https://console.firebase.google.com> i utwórz projekt (plan darmowy „Spark” wystarcza).
2. **Build → Authentication → Sign-in method:** włącz **Anonymous**.
3. **Build → Firestore Database:** utwórz bazę (tryb produkcyjny) i w zakładce **Rules** wklej:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artifacts/{appId}/public/data/rooms/{room=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

4. **Project settings → Your apps → Web app (`</>`):** zarejestruj aplikację i skopiuj obiekt `firebaseConfig`.
5. W `index.html` znajdź linię `const FIREBASE_CONFIG = null;` i wklej tam skopiowany obiekt.
6. **Authentication → Settings → Authorized domains:** dodaj domenę, pod którą działa gra
   (`marekmaro.github.io`).

Klucz `apiKey` z konfiguracji Firebase nie jest tajny — może być w publicznym repozytorium.
Dostęp do danych ograniczają reguły z punktu 3.

## Zasady Makao (domyślne — klasyczne)

- Dokładasz kartę w tym samym kolorze albo o tej samej figurze. Nie masz ruchu — dobierasz kartę;
  jeśli pasuje, możesz ją od razu zagrać.
- **2 i 3:** następny gracz dobiera 2 lub 3 karty. Karę można przebić własną 2, 3 lub królem bojowym
  (w tym samym kolorze albo tej samej figurze) — kary się sumują.
- **4:** następny gracz czeka kolejkę; może przebić własną czwórką.
- **Walet:** żąda figury 5–10. Żądanie obowiązuje wszystkich przez jedną kolejkę, także żądającego.
- **As:** zmienia kolor.
- **Król kier:** następny gracz dobiera 5 kart. **Król pik:** 5 kart dobiera poprzedni gracz.
- **Dama:** na wszystko i wszystko na damę (poza karą, postojem i żądaniem waleta).
- **MAKAO!:** z jedną kartą trzeba kliknąć „MAKAO!”. Kto zapomni, dobiera 5 kart, gdy rywal go przyłapie.
- Talia: 52 karty, od 4 graczy dwie talie. Na start 5 kart.

Warianty do włączenia w „Zasady i warianty”: tarcza damy pik, jokery, 7 kart na start, limit czasu na ruch
(online), wyłączenie dowolnej z reguł powyżej.

## Znane ograniczenia

- Gra online ufa graczom: cały stan stołu (także karty rywali) jest w jednym dokumencie Firestore.
  Do gry ze znajomymi to wystarcza; do gry z obcymi potrzebny byłby serwer rozstrzygający ruchy.
- Dwa ruchy wysłane w tej samej chwili z dwóch telefonów — wygrywa późniejszy zapis.
- Biblioteki (React, Tailwind, Babel) ładują się z CDN i są kompilowane w przeglądarce, więc pierwszy start
  trwa 1–3 s. Przyspieszyłby to krok budowania (np. Vite), kosztem jednego pliku `index.html`.
