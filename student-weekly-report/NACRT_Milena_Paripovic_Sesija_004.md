# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje                          | Odgovor                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ime i prezime                  | Milena Paripović                                                                                                                                                                                                                                                |
| Adresa e-pošte                 | [paripovicmilena@gmail.com](mailto:paripovicmilena@gmail.com)                                                                                                                                                                                                   |
| Discord korisničko ime         | Milena Paripovic                                                                                                                                                                                                                                                |
| Nedelja                        | Sesija 004 (W04 — Reliable AI Integration)                                                                                                                                                                                                                      |
| Par / tim                      | Dušan Nikolić / tim9                                                                                                                                                                                                                                            |
| Moj konkretan doprinos / uloga | Dokumentacija i W04 artefakti, security checklist, pokretanje testova, pregled diff-a, izveštaji; **NEDOSTAJE:** potvrda da je kompletan browser play-test izvršen lično.                                                                                       |
| Datum predaje                  | **NEDOSTAJE: datum predaje**                                                                                                                                                                                                                                    |
| Reference na rad i dokaze      | `docs/w4/README.md`, `docs/w4/AI_FEATURE_PROMPT.md`, `docs/w4/AI_PROVIDER_CONTRACT.md`, `docs/w4/AI_EVALS.md`, `docs/EVIDENCE_W04.md`, `docs/AI_USAGE_LOG.md`, `specs/001-ai-coach/`; javni repozitorijum: <https://github.com/Dusan-Nikolic-98/SELFBOUND_Game> |

## 2. Moj status

**Status:** Završeno

Izradila sam dokumentacioni deo W04 rada i prošla kroz security checklist. U aktuelnoj proveri `npm run typecheck`, `npm test` i `npm run build` završili su uspešno. Testovi su imali 66 prolaza i 0 neuspeha. Preostaje da se, ako je potrebno za predaju, posebno potvrdi kompletan vizuelni i focus play-test AI Coach interfejsa, jer to nije dokazano samo automatizovanim testovima.

## 3. Rad ove nedelje

Radila sam na W04 zadatku za pouzdanu AI integraciju u projektu SELFBOUND, 2D side-scrolleru u TypeScript-u i HTML Canvas-u. U paru smo razdvojili frontend i backend. Backend je TypeScript aplikacija bez frameworka, zasnovana na `node:http`, sluša na portu 3001 i ima CORS allowlist za frontend na portu 4173.

Dodali smo AI Coach koji igrač pokreće tek posle završene partije, odnosno posle Level Complete ili Game Over stanja. Telemetrija se prikuplja u browseru, u memoriji se čuvaju najviše tri završene partije, a aktivna nezavršena partija se ne šalje. Frontend šalje `POST /api/ai/coach` sa oblikom `{ runs: CompletedRunSummary[] }`. Backend zahtev proverava pre poziva providera i odbija nepoznata polja i vrednosti van dozvoljenih opsega.

Moj deo rada bio je da pripremim i proverim W04 dokumentaciju i dokaze: indeks `docs/w4/README.md`, prompt dokument, provider contract, eval tabelu, `docs/EVIDENCE_W04.md` i dopunu `docs/AI_USAGE_LOG.md`. U dokumentima sam zabeležila granicu između frontenda, backend-a i providera, bez tool calling-a. Provider se bira preko `AI_COACH_PROVIDER=fake|gemini`; u aktuelnom kodu Gemini adapter koristi `gemini-3.1-flash-lite`, strukturisan JSON izlaz i backend-only ključ iz `.env`. U ranijem opisu pominjan je model `gemini-3.5-flash-lite`, ali sam u izveštaju zadržala vrednost koju pokazuju trenutno provereni kod i evidence dokumenti.

Provera je obuhvatila `npm run typecheck`, `npm test` i `npm run build`. Rezultat je bio: typecheck uspešan, 66 testova uspešno, 0 neuspešnih, i build uspešan. Security provera je zabeležila da se ključ ne nalazi u frontend bundle-u, izvorima ili istoriji, da je `.env` ignorisan, da `.env.example` nema vrednost ključa, i da backend ne vraća ključ niti raw greške frontendu. Live Gemini provera nije pokrenuta u ovoj proveri, a manualni UI/focus play-test ostaje otvoren dokazni item.

Za implementaciju i dokumentaciju korišćeni su Codex i Claude (Cowork). AI predloge sam koristila kao pomoć za implementaciju, specifikaciju i artefakte, a rezultate sam proveravala kroz kod, testove, build, security checklist i diff. Najteže mi je bilo da ispunim sve uslove zadatka. Naučila sam kako se AI funkcionalnost može integrisati u igricu uz validaciju ulaza i izlaza, ograničenu pouzdanost i bez izlaganja ključa. Pomoć tutora mi trenutno nije potrebna.

## 4. Sledeći korak

Dodavanje još jedne jasno ograničene AI funkcionalnosti, nakon što se završi otvoreni manualni UI/focus play-test.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
