# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje                          | Odgovor                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ime i prezime                  | Milena Paripović                                                                                                                                                                                           |
| Adresa e-pošte                 | paripovicmilena@gmail.com                                                                                                                                                                                  |
| Discord korisničko ime         | Milena Paripovic                                                                                                                                                                                           |
| Nedelja                        | Sesija 008 — W08 Secure Arcade                                                                                                                                                                             |
| Par / tim                      | Dušan Nikolić / tim 9                                                                                                                                                                                      |
| Moj konkretan doprinos / uloga | Pripremila sam W08 specifikaciju, plan rada i listu zadataka, a zatim sam pripremila evidence dokumentaciju i ažurirala prateće projektne zapise.                                                          |
| Datum predaje                  | 2026-10-27                                                                                                                                                                                                 |
| Reference na rad i dokaze      | `specs/003-secure-arcade/spec.md`, `specs/003-secure-arcade/plan.md`, `specs/003-secure-arcade/tasks.md`, `docs/EVIDENCE_W08.md`, `docs/AI_USAGE_LOG.md`, `docs/EVALS.md`, commitovi `7758e64` i `58aa157` |

## 2. Moj status

**Status:** Završeno

W08 specifikacija i evidence paket su pripremljeni. Dokumentovani su bezbednosni zahtevi, izvedene provere i preostala ograničenja dokaza.

## 3. Rad ove nedelje

Ove nedelje radila sam na W08 zadatku Secure Arcade. Cilj je bio da se postojeći W04 AI Coach i W05 Training Planner dodatno zaštite bez proširivanja funkcionalnosti igre. Pripremila sam specifikaciju, implementacioni plan i detaljne taskove za HTTP ograničenja, zaštitu tela zahteva, rate limiting, CSP i bezbednosne headere, plain-text prikaz rezultata, zatvoreni registry alata, sanitizovane logove i proveru tajni u artefaktima.

Nakon implementacije pripremila sam `docs/EVIDENCE_W08.md`. U njemu sam povezala zahtevane kriterijume sa konkretnim testovima i rezultatima. Dokumentovano je da su `npm run typecheck`, `npm test`, build i reachability provere uspešno završeni. Test suite je imao 110 uspešnih testova bez neuspeha. Browser security provera potvrdila je plain-text prikaz, CSP ponašanje i odsustvo testnog sentinel-a iz frontend artefakata. Dependency audit je za trenutni lockfile prijavio nula ranjivosti.

Posebno sam zabeležila ograničenja dokaza. Live provider nije testiran, nema dokaza za javni deployment ili distribuirani rate limit, a browser/API round trip pod istim CSP okruženjem ostaje odvojen sledeći test. Evidence dokument zato predstavlja rezultat konkretno izvedenih provera, a ne opštu bezbednosnu garanciju.

U radu su AI alati korišćeni za pomoć pri specifikaciji, pregledu i dokumentovanju. Rezultati su proveravani kroz izvorni kod, testove i stvarne izlaze komandi, umesto da se AI predlog prihvati bez provere.

## 4. Sledeći korak

Nema trenutnih sledećih koraka.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
