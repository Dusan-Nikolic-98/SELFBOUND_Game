# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Milena Paripović |
| Adresa e-pošte | (**NEDOSTAJE:** adresa e-pošte) |
| Discord korisničko ime | (**NEDOSTAJE:** Discord korisničko ime) |
| Nedelja | Sesija 003 |
| Par / tim | Dušan Nikolić |
| Moj konkretan doprinos / uloga | Uz pomoć coding agenta Codex kreirala sam aplikaciju na osnovu `BUILD_PROMPT_V1.md`. Pokrenula sam baseline, napravila screenshot i pomogla u dokumentaciji. Uočila sam i dokumentovala problem sa TS2591 greškom u editoru. |
| Datum predaje | (**NEDOSTAJE:** datum u obliku YYYY-MM-DD) |
| Reference na rad i dokaze | `EVIDENCE_003.md`, `EVALS.md`, `AI_USAGE_LOG.md`, `README.md`, screenshot baseline-a, tag `baseline-v1`, commit `7d6dc17`, rezultat skripte `check-reachability` i javni repozitorijum: https://github.com/Dusan-Nikolic-98/SELFBOUND_Game |

## 2. Moj status

**Status:** Delimično završeno

Kreirala sam aplikaciju SELFBOUND, pokrenula baseline i sačuvala screenshot i stvarni output. `npm test` je prolazio 5/5 i pre i posle izmene. Ipak, rezultat skripte `check-reachability` na baseline-u pokazuje da `enemy_2` i `enemy_4` imaju 0 pogodaka, pa level ne može da se završi. (**NEDOSTAJE:** potvrda konačnog statusa nakon svih planiranih provera.)

## 3. Rad ove nedelje

Radila sam na projektu SELFBOUND, 2D side-scroller igri u TypeScript-u i HTML Canvas-u. Osnovna ideja je da igrač puca delom sebe u neprijatelja, a zatim se teleportuje na njegovo mesto. Aplikaciju sam kreirala uz pomoć coding agenta Codex, na osnovu `BUILD_PROMPT_V1.md` i kriterijuma zadatka. Radila sam u paru sa Dušanom Nikolićem.

Pokrenula sam baseline komandom `npm start`, napravila screenshot i upisala stvarni output u `EVIDENCE_003.md`. Baseline je označen tagom `baseline-v1`, odnosno commitom `7d6dc17`. Pomogla sam i u dokumentaciji kroz `EVIDENCE_003.md`, `EVALS.md`, `AI_USAGE_LOG.md` i `README.md`.

Tokom rada uočila sam grešku u editoru: `TS2591: Cannot find name 'node:test'` u fajlu `tests/logic.test.ts`. Rešenje je bio fajl `tests/tsconfig.json`, koji nasleđuje `tsconfig.test.json`. Rezultat je bio da je `npm test` prolazio 5/5 i pre i posle izmene.

Dodatna provera reachability-ja na baseline-u pokazala je da `enemy_2` i `enemy_4` imaju 0 pogodaka, zbog čega level ne može da se završi. (**NEDOSTAJE:** da li sam ovaj rezultat ručno potvrdila igranjem u browseru.)

U radu sam koristila coding agenta Codex za implementaciju igre. Claude u Cowork-u koristila sam za pregled zadatka i repozitorijuma, objašnjenje TS2591 greške, headless skriptu `scripts/check-reachability.mjs`, nacrte za `EVIDENCE_003.md`, `EVALS.md`, `AI_USAGE_LOG.md` i `README.md`, kao i za ovaj izveštaj. (**NEDOSTAJE:** precizan opis svih provera koje sam lično uradila nad AI rezultatima, na primer da li sam sama pokrenula `npm test` i `npm start`, proverila igru u browseru i uporedila implementaciju sa `GAME_SPEC.md`.)

Najviše mi je bilo teško da napišem kvalitetan spec fajl koji odgovara ideji. Naučila sam da nije sve idealno što AI napravi i osnove pravljenja i korišćenja spec fajlova. (**NEDOSTAJE:** da li postoji još nešto što nije završeno ili dokazano, osim problema sa reachability-jem.)

Pomoć mi trenutno nije potrebna. Sledeći korak mi je proširivanje aplikacije sa više nivoa i dodatni rad sa AI funkcionalnostima.

## 4. Sledeći korak

Proširiću aplikaciju sa više nivoa i uradiću dodatni rad sa AI funkcionalnostima. (**NEDOSTAJE:** jedna konkretnija, merljiva tačka završetka za ovaj sledeći korak.)

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
