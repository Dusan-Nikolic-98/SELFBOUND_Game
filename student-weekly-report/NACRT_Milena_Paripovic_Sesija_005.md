# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje                          | Odgovor                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ime i prezime                  | Milena Paripović                                                                                                                                                                                                                                                                                                                               |
| Adresa e-pošte                 | paripovicmilena@gmail.com                                                                                                                                                                                                                                                                                                                      |
| Discord korisničko ime         | Milena Paripovic                                                                                                                                                                                                                                                                                                                               |
| Nedelja                        | Sesija 005 (W05 — Bounded Agentic Feature)                                                                                                                                                                                                                                                                                                     |
| Par / tim                      | Dušan Nikolić / tim9                                                                                                                                                                                                                                                                                                                           |
| Moj konkretan doprinos / uloga | Usmeravala sam rad prema zahtevu, proveravala ispunjenost W05 kriterijuma i pregledala implementaciju i predajne artefakte. Pregledala sam i ispravljala dokumentaciju/evidence i pomagala u finalnoj proveri kao reviewer u paru.                                                                                                             |
| Datum predaje                  | 06.10.2026.                                                                                                                                                                                                                                                                                                                                    |
| Reference na rad i dokaze      | `specs/002-agentic-training-planner/`, `docs/AGENT_FLOW.md`, `docs/TOOL_CONTRACTS.md`, `docs/AGENT_EVALS.md`, `docs/EVIDENCE_W05.md`, `docs/EVALS.md`, `docs/AI_USAGE_LOG.md`, `frontend/src/training-plan-session.ts`, `backend/src/training-plan-orchestrator.ts`; javni repozitorijum: <https://github.com/Dusan-Nikolic-98/SELFBOUND_Game> |

## 2. Moj status

**Status:** Završeno

W05 rešenje i prateći dokazi završno su provereni u paru. Implementacija, testiranje i evidence paket odgovaraju bounded-agent cilju; slede završna predaja i priprema kratke demonstracije.

## 3. Rad ove nedelje

U W05 je tim napravio AI Training Planner, zasebnu funkcionalnost od W04 AI Coach-a. Igrač eksplicitno pokreće jedan Training Plan nakon završenog run-a; cilj je unapred definisan, a nema slobodnog prompta. Model predlaže narednu aplikacionu akciju ili strukturisani plan, dok backend proverava predlog, raspoložive alate i završni rezultat i zadržava pravo izvršavanja. Browser ostaje vlasnik kanonskog gameplay stanja. Istorija završenih run-ova i prethodni plan čuvaju se samo u memoriji stranice, dok je backend stateless; ista nepromenjena istorija ne može neograničeno da proizvede nove uspešne planove.

Core rešenje ima tačno dva deterministička, lokalna i read-only alata: `get_recent_run_evidence` za ograničene podatke validiranih završenih run-ova i `evaluate_previous_training_plan` za proveru prethodnog fokusa. Nijedan alat ne menja gameplay, ne pristupa proizvoljnim fajlovima ili mreži i ne prihvata modelom zadatu istoriju. Prvi plan tipično koristi dva model koraka i jedan alat; kasniji plan može prvo da proceni prethodni fokus, zatim prikupi evidence i završi do tri koraka i dva poziva alata.

Pregledala sam da li je deterministička evaluacija dokumentovana i ograničena na postojeću telemetriju: threat management, bounce strategy, aim timing, positioning i range management. Zaključci su samo `improved`, `not_improved` ili `insufficient_evidence`, uz minimalne pragove uzorka. Evaluator ne tvrdi da zna igračevu nameru, veštinu ili uzrok promene. Takođe sam proveravala da su validacija model predloga, alata i finalnog plana, ponovljene akcije, provider pokušaji, retry, vremenska ograničenja i bezbedne greške objašnjeni u skladu sa implementacijom. W04 AI Coach ostaje odvojena funkcionalnost.

**Moj konkretan doprinos** bio je da usmeravam rad prema zadatku i da pregledam da li W05 zahtevi postoje u kodu, testovima i dokumentima. Proveravala sam kompletnost i doslednost `AGENT_FLOW.md`, `TOOL_CONTRACTS.md`, `AGENT_EVALS.md`, `EVIDENCE_W05.md` i završnog dokaznog paketa, ispravljala dokumentaciju i pomagala oko finalne evidence provere. Nisam preuzimala autorstvo nad backend orchestrator-om, provider-om ili alatima; Dušan je vodio hands-on implementacioni deo, a ja sam bila reviewer i podrška za usklađenost sa zadatkom i predaju.

Završna provera 06.10.2026. dala je `npm run typecheck` PASS, `npm test` **99/99** bez neuspeha, `npm run build` PASS, reachability PASS za sva četiri Core cilja i `git diff --check` exit code 0. Tokom reachability provere prikazano je postojeće Node upozorenje o module type-u za `frontend/dist/game.js`, ali sama provera je završena uspešno. Dodata je i offline provera `step_limit`: tri agent koraka, dva tool dispatch-a, tri provider pokušaja i bez četvrtog provider poziva. Test koristi izdvojen testni tool limit da dokaže step-limit klasifikaciju; runtime default od dva alata nije promenjen.

U završnoj proveri para izveden je jedan realni W05 Gemini Agent Run kroz backend `/api/training-plan`, odvojen od fake-provider testova i offline SDK-double testova. Smoke je uspeo: `goal_completed`, dva model koraka, jedan `get_recent_run_evidence` alat, dva provider pokušaja, nula retry-ja, 13.444 ms u orchestrator-u i 13.624 ms za HTTP round trip. Validacija je prošla, a fokus plana bio je `range_management`. Nije zabeležena token statistika jer je W05 adapter nije vratio. Jedan uspešan poziv potvrđuje taj application flow, ali ne garantuje buduću Gemini dostupnost ili kvalitet preporuke.

U radu para ChatGPT je korišćen za brainstorming, specifikaciju, review i pripremu Codex promptova, a Codex za AI-assisted kod, testove i dokumentaciju. Kao reviewer proveravala sam rezultat kroz usklađenost sa zadatkom, implementaciju i stvarne output-e provera, umesto da AI predlog smatram automatski tačnim. U mom pregledu posebno je bilo važno da modelov predlog ostane nepoverljiv, a aplikacija kontroliše izvršavanje; deterministički alati, ograničeno stanje, odvojeni brojači i jasni stop uslovi čine ponašanje proverljivim. Ograničenja projekta su najviše tri sačuvana run-a, heuristički metrički proxy signali, session stanje koje custom klijent može da menja i spoljašnja Gemini latencija. Pomoć tutora mi trenutno nije potrebna.

## 4. Sledeći korak

Pripremiću završnu predaju W05 dokaza i kratku demo prezentaciju.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
