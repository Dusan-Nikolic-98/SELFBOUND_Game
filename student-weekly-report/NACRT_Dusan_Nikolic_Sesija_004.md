# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Dušan Nikolić |
| Adresa e-pošte | **NEDOSTAJE: Dušanova adresa e-pošte** |
| Discord korisničko ime | **NEDOSTAJE: Dušanovo Discord korisničko ime** |
| Nedelja | Sesija 004 (W04 — Reliable AI Integration) |
| Par / tim | Milena Paripović / tim9 |
| Moj konkretan doprinos / uloga | Prema dostavljenoj podeli rada: SpecKit za AI Coach, telemetrija, fake provider, Gemini integracija i backend moduli. **NEDOSTAJE:** Dušanova lična potvrda ovog opisa. |
| Datum predaje | **NEDOSTAJE: datum predaje** |
| Reference na rad i dokaze | `specs/001-ai-coach/`, `frontend/src/coach-telemetry.ts`, `backend/src/`, `docs/w4/README.md`, `docs/EVIDENCE_W04.md`, `docs/AI_USAGE_LOG.md`; javni repozitorijum: <https://github.com/Dusan-Nikolic-98/SELFBOUND_Game> |

## 2. Moj status

**Status:** **NEDOSTAJE: Dušanova potvrda statusa**

Prema dostupnim projektnim dokumentima, W04 obuhvata implementiran AI Coach, razdvojeni frontend i backend, bounded telemetry, fake provider, Gemini adapter, validaciju i safe failure ponašanje. Lični status i šta Dušan smatra završenim treba da potvrdi Dušan.

## 3. Rad ove nedelje

U radu para na projektu SELFBOUND dodali smo AI Coach za kratku analizu završenih partija. Igrač ga pokreće nakon Level Complete ili Game Over, a ne tokom game loop-a. Browser čuva najviše tri završene partije u memoriji, bez slanja aktivne nezavršene partije. Frontend šalje `POST /api/ai/coach` sa `{ runs: CompletedRunSummary[] }`, dok backend proverava zahtev pre poziva providera i odbija nepoznata polja i vrednosti van opsega.

Prema dostavljenoj podeli rada, moj deo je obuhvatao SpecKit dokumente za AI Coach, telemetriju, fake provider, Gemini integraciju i backend module. **NEDOSTAJE:** lična potvrda koje sam tačno fajlove menjao, koje sam probleme rešavao i koje sam provere lično izvršio. Zbog toga ovaj nacrt ne pripisuje meni pojedinačne testove, browser proveru ili live Gemini poziv.

Aktuelni W04 dokazi navode da `AI_COACH_PROVIDER=fake|gemini` bira providera, da se u Gemini modu koristi `gemini-3.1-flash-lite`, da je izlaz strukturisan i validiran, i da se API ključ čita samo na backendu iz `.env`. Automatizovane provere su u aktuelnoj proveri dale uspešan typecheck, 66 uspešnih testova i uspešan build. Security checklist je zabeležio da ključ nije u frontend bundle-u, istoriji ili logovima, i da se ne vraća frontendu. Live provera i manualni UI/focus play-test nisu izvršeni u ovoj proveri ili je njihovo lično izvršavanje za mene **NEDOSTAJE**.

**NEDOSTAJE:** Dušanov opis najtežeg dela, naučenog, eventualnog problema ili ograničenja, korišćenja AI alata, načina ljudske provere i potrebe za pomoći tutora. Ove stavke ne mogu pouzdano da zaključim iz Git autorstva ili iz samog koda.

## 4. Sledeći korak

**NEDOSTAJE:** Dušanov jedan konkretan, merljiv sledeći korak sa jasnom tačkom završetka.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
