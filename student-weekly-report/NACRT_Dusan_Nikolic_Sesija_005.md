# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Dušan Nikolić |
| Adresa e-pošte | d-nikolic98@outlook.com |
| Discord korisničko ime | Dušan Nikolić |
| Nedelja | Sesija 005 (W05 — Bounded Agentic Feature) |
| Par / tim | Milena Paripović / tim9 |
| Moj konkretan doprinos / uloga | Vodio sam razradu W05 zahteva i bounded-agent odluka, pripremu i iteraciju SpecKit/Codex materijala, pregled AI-assisted implementacije, proveru ponašanja u igri, fake-provider/session flow-a, debugging i završnu verifikaciju. Nisam ručno pisao svaku liniju koda; koristio sam AI alate uz ličnu proveru rezultata. |
| Datum predaje | 06.10.2026. |
| Reference na rad i dokaze | `specs/002-agentic-training-planner/`, `frontend/src/training-plan-session.ts`, `frontend/src/training-plan-client.ts`, `backend/src/training-plan-orchestrator.ts`, `backend/src/training-plan-tools.ts`, `backend/src/training-plan-evaluator.ts`, `docs/AGENT_FLOW.md`, `docs/TOOL_CONTRACTS.md`, `docs/AGENT_EVALS.md`, `docs/EVIDENCE_W05.md`, `docs/AI_USAGE_LOG.md`; javni repozitorijum: <https://github.com/Dusan-Nikolic-98/SELFBOUND_Game> |

## 2. Moj status

**Status:** Završeno

W05 Training Planner je implementiran kao odvojena, bounded agentic funkcionalnost. Završni offline i live dokazi su zabeleženi; ostaje finalna predaja i kratka demo priprema.

## 3. Rad ove nedelje

Glavni rezultat je AI Training Planner, zaseban od W04 AI Coach-a. Igrač izričito bira **Training Plan** nakon završenog run-a i time pokreće jedan logički Agent Run sa fiksnim ciljem. Igrač ne šalje slobodan prompt. Model predlaže sledeći alat ili strukturisani plan, ali backend proverava predlog i jedini odlučuje da li će ga izvršiti. Browser ostaje vlasnik kanonskog gameplay stanja i istorije run-ova; prethodni plan i baseline postoje samo u memoriji trenutne stranice, a backend ne čuva sesiju. Ista neizmenjena istorija ne može kroz podržani flow da proizvede neograničen broj uspešnih planova.

Core allowlist sadrži tačno dva alata: `get_recent_run_evidence` i `evaluate_previous_training_plan`. Oba su determinističke, lokalne read-only operacije. Ona koriste samo validiran kontekst tekućeg zahteva, ne menjaju gameplay stanje i nemaju pristup proizvoljnom internetu ili fajl sistemu. Prvi plan obično prolazi kroz dva model koraka i jedan poziv alata. Kasniji plan može da koristi evaluator pa recent evidence, do tri model koraka i dva poziva alata.

Prethodni plan ocenjuje se deterministički i samo za njegov jedan primarni fokus. Podržani fokusi su threat management, bounce strategy, aim timing, positioning i range management, mapirani na postojeću telemetriju. Evaluator vraća `improved`, `not_improved` ili `insufficient_evidence`, poredi agregate celobrojno i koristi minimalne uzorke za svaki fokus. Ne izvodi zaključke o nameri, veštini ili uzročnosti; metričke vrednosti su heuristički proxy signali.

Orchestrator ograničava Agent Run na najviše tri model koraka, dva poziva alata, četiri provider pokušaja, najviše jedan dozvoljeni prolazni retry po koraku, 15 sekundi po provider pozivu i 45 sekundi ukupno. Tu su i zaštita od ponovljene akcije, runtime validacija predloga, rezultata alata i završnog plana, sigurne poruke o grešci i zabrana prikaza chain-of-thought-a. Provider boundary je neutralan: razvoj i testovi prvo koriste deterministički fake, a opcioni realni Gemini adapter je odvojen od orchestrator-a. W04 testovi i postojeći Coach flow ostali su u punoj offline test komandi.

Dodao sam fokusirani offline test za `step_limit`. On koristi postojeći scripted provider, potvrđuje terminalni razlog posle tri model koraka, dva dispatch-ovana alata i tri provider pokušaja, i proverava da nema četvrtog provider poziva. Test privremeno podiže samo tool-call limit radi izolovanja ove klasifikacije; podrazumevano produkciono ograničenje od dva alata nije promenjeno i može ranije klasifikovati isti treći predlog kao `tool_call_limit`.

Završna provera 06.10.2026. prošla je: `npm run typecheck`; `npm test` sa **99/99 testova**, bez neuspeha; `npm run build`; `node scripts/check-reachability.mjs` sa sva četiri Core cilja dostupna i rezultatom `PASS`; i `git diff --check` sa exit code 0. Node je pri reachability proveri prijavio postojeće upozorenje o module type-u za `frontend/dist/game.js`, bez neuspeha provere.

Izvršio sam jedan realni W05 Gemini smoke kroz `POST /api/training-plan`, sa jednim malim sintetičkim, validnim završenim run-om. Dana 06.10.2026. u 17:01:31 (+02:00), logički Agent Run završio se sa `goal_completed`: dva model koraka, jedan `get_recent_run_evidence` poziv, dva provider pokušaja, nula retry-ja i 13.444 ms orchestrator vremena (13.624 ms HTTP round trip). Backend runtime validacija je prošla, završni fokus je bio `range_management`, a adapter nije vratio token statistiku. Ovo je jedan live workflow smoke, ne dokaz opšteg kvaliteta ili dostupnosti Gemini-ja.

Moj lični deo bio je razvijanje i sužavanje ideje i zahteva, donošenje odluka oko ograničenog cilja, identiteta/baseline-a, evaluator-a, alata, budžeta i provider granice, kao i priprema Codex promptova i iterativni pregled rezultata. Proveravao sam ponašanje u igri, fake-provider i session/regeneration flow, testove, debug izlaze i ovu završnu live proveru. ChatGPT sam koristio za brainstorming, specifikaciju, review i pripremu promptova; Codex za AI-assisted implementaciju, testove i dokumentaciju. AI output nisam smatrao tačnim bez provere kroz kod, stvarne komande, test rezultate i backend tok.

Najvažnije što sam naučio jeste da agentic sistem nije samo više AI poziva: modelov predlog je nepoverljiv ulaz, a aplikacija mora da zadrži pravo izvršavanja. Deterministički alati, validirano i ograničeno stanje, zasebno brojanje koraka/pokušaja/retry-ja i eksplicitni stop uslovi čine tok proverljivim. Ograničenja su istorija od najviše tri run-a, heuristička telemetrija koja ne dokazuje veštinu ili uzrok, session stanje koje nije zaštićeno od prilagođenog klijenta i spoljašnja Gemini latencija/dostupnost. Pomoć tutora mi trenutno nije potrebna.

## 4. Sledeći korak

Pripremiću kratku W05 demonstraciju i finalni paket za predaju; korak je završen kada su dokazi predati i demo tok može da se prikaže bez dodatne implementacije. Ne planiram novi live poziv posle uspešnog smoke-a u ovoj proveri.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
