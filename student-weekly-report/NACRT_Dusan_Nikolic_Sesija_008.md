# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje                          | Odgovor                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ime i prezime                  | Dušan Nikolić                                                                                                                                                                      |
| Adresa e-pošte                 | d-nikolic98@outlook.com                                                                                                                                                            |
| Discord korisničko ime         | Dušan Nikolić                                                                                                                                                                      |
| Nedelja                        | Sesija 008 — W08 Secure Arcade                                                                                                                                                     |
| Par / tim                      | Milena Paripović / tim 9                                                                                                                                                           |
| Moj konkretan doprinos / uloga | Implementirao sam bezbednosne izmene za backend, frontend, statički server i testove.                                                                                              |
| Datum predaje                  | 2026-10-27                                                                                                                                                                         |
| Reference na rad i dokaze      | `backend/src/`, `frontend/src/main.ts`, `frontend/src/plain-text.ts`, `scripts/serve.mjs`, `scripts/test-browser-security.mjs`, `tests/`, `docs/EVIDENCE_W08.md`, commit `3c3b42c` |

## 2. Moj status

**Status:** Završeno

Implementirane su planirane W08 bezbednosne kontrole, a postojeći testovi i dodatne security provere su prošli.

## 3. Rad ove nedelje

Ove nedelje radio sam na implementaciji W08 Secure Arcade zahteva. U backend-u sam dodao ograničenja veličine i trajanja HTTP zahteva, uključujući zaštitu od prevelikih i sporih request body-ja. Uveden je process-local limiter koji ograničava broj aktivnih AI izvršavanja i broj novih pokretanja u vremenskom prozoru. W04 i W05 rute koriste zajedničke resursne kontrole.

Dodati su bezbednosni HTTP headeri, uključujući CSP, `nosniff`, `no-referrer` i `X-Frame-Options`. U frontend-u je uveden plain-text renderer za prikaz rezultata AI funkcionalnosti, čime se provider-kontrolisan tekst ne tretira kao HTML. U Training Plan orchestrator-u i AI Coach provider-u dodati su ograničeni i sanitizovani operativni logovi bez izlaganja sirovih grešaka ili osetljivih podataka.

Dopunio sam backend i W05 testove za request limite, rate limiting, timeout, cancellation, ponovljene akcije, neispravne tool rezultate i bezbedne greške. Dodat je i browser security script koji proverava production build, CSP, plain-text rendering i sentinel scan frontend bundle-a i source mapa.

Prema zabeleženim rezultatima, `npm run typecheck`, `npm test`, build i reachability provera su prošli. Test suite je imao 110 od 110 uspešnih testova. Browser provera je potvrdila CSP i plain-text ponašanje, a dependency audit je za trenutni lockfile prijavio nula ranjivosti. Live Gemini provider nije testiran u ovoj fazi, pa rezultati ne predstavljaju dokaz ponašanja live modela ili javne produkcije.

AI alati su korišćeni kao pomoć pri implementaciji i proveri, ali su izmene proveravane kroz izvorni kod, testove i rezultate komandi.

## 4. Sledeći korak

Nema trenutnih sledećih koraka.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
