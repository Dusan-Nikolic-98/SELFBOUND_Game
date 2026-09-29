# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Dušan Nikolić |
| Adresa e-pošte | d-nikolic98@outlook.com |
| Discord korisničko ime | Dušan Nikolić |
| Nedelja | Sesija 004 (W04 — Reliable AI Integration) |
| Par / tim | Milena Paripović / tim9 |
| Moj konkretan doprinos / uloga | Moj deo rada obuhvatao je SpecKit za AI Coach funkcionalnost, telemetriju i istoriju završenih run-ova, deterministički fake provider, Gemini integraciju, backend API i validaciju, kao i reliability/safe-failure deo integracije. U radu sam koristio Codex kao coding asistenta, dok sam ja definisao zahteve, proveravao implementaciju, pokretao funkcionalne i live provere i iterativno rešavao probleme sa Gemini integracijom. |
| Datum predaje | 29.09.2026. |
| Reference na rad i dokaze | `specs/001-ai-coach/`, `frontend/src/coach-telemetry.ts`, `frontend/src/ai-coach-client.ts`, `backend/src/`, `docs/w4/README.md`, `docs/EVIDENCE_W04.md`, `docs/AI_USAGE_LOG.md`; javni repozitorijum: <https://github.com/Dusan-Nikolic-98/SELFBOUND_Game> |

## 2. Moj status

**Status:** W04 funkcionalnost je implementirana i glavni automatizovani testovi prolaze. AI Coach ima telemetry/history flow, fake provider za deterministički lokalni razvoj i Gemini provider za realnu AI integraciju. Frontend i backend su razdvojeni, ulaz i izlaz AI providera se validiraju, API ključ ostaje isključivo na backendu, a greške se korisniku prikazuju kroz bezbedan fallback umesto sirovih provider grešaka.

Gemini integracija je tokom rada dodatno ojačana zbog problema sa timeout-ima i povremenim nevalidnim strukturisanim odgovorima. Aktuelna implementacija koristi `gemini-3.1-flash-lite` preko `models.generateContent`, zajednički deadline od 15 sekundi i ograničen retry/repair/fallback mehanizam.

Pre predaje ostaje završna ručna provera layout-a i keyboard focus ponašanja AI Coach UI-ja i beleženje rezultata te provere. Finalni reliability-hardening pass takođe nije ponovo live-validiran u okviru poslednje evidence provere, pošto je live Gemini test namerno opt-in.

## 3. Rad ove nedelje

U radu para na projektu SELFBOUND dodali smo AI Coach za kratku analizu završenih partija. Igrač ga pokreće nakon Level Complete ili Game Over, a ne tokom game loop-a. Browser čuva najviše tri završene partije u memoriji, bez slanja aktivne nezavršene partije. Frontend šalje `POST /api/ai/coach` sa `{ runs: CompletedRunSummary[] }`, dok backend proverava zahtev pre poziva providera i odbija nepoznata polja i vrednosti van dozvoljenih opsega.

Moj deo rada obuhvatao je SpecKit dokumentaciju za `001-ai-coach`, implementaciju i definisanje telemetrije, istoriju završenih run-ova, fake provider, Gemini provider i prateće backend module. Telemetrija prati podatke relevantne za coaching, između ostalog ponašanje igrača dok je neprijateljski projektil aktivan, izbor mete prilikom pucanja, pokušaje direktnog pogotka mete koja zahteva odbijanje od zida, brzinu i preciznost bounce aim-a, lošu poziciju iz koje pogodak nije moguć i druge ograničene gameplay signale. Istorija je session-only i čuva najviše tri završena run-a; gubitak jednog života ne započinje novi run, dok manualni reset odbacuje trenutno nezavršen run.

Radio sam i na povezivanju frontend i backend dela. AI Coach frontend koristi poseban klijent, dok backend poseduje `/api/ai/coach` rutu, runtime validaciju zahteva i odgovora i provider abstraction kojim se bira fake ili Gemini implementacija. Fake provider je deterministički i omogućava razvoj i testiranje bez API ključa i mrežnog poziva.

Najzahtevniji deo bio je pouzdano povezivanje sa Gemini API-jem. Prve varijante integracije imale su timeout probleme: pojedini Interactions pozivi su prelazili postojeće rokove ili su se zadržavali i do 30 sekundi. Tokom dijagnostike upoređivani su različiti API putevi i modeli. Uspešan puni Coach test sa `models.generateContent` i `gemini-3.1-flash-lite` vratio je HTTP 200 za oko 6,4 sekunde i prošao JSON i `AiCoachResponse` validaciju. Na osnovu toga integracija je prebačena na taj API/model i uveden je zajednički deadline od 15 sekundi, uz ograničen broj provider poziva, bounded retry/backoff i kontrolisan repair/fallback za prolazne greške ili nevalidan strukturisan izlaz.

Tokom kasnijeg testiranja pojavio se i slučaj u kome Gemini odgovori brzo, ali rezultat ne prolazi našu validaciju (`invalid_provider_output`). To je pokazalo da HTTP 200 nije dovoljan kriterijum uspeha i da izlaz modela mora uvek da prođe naš sopstveni runtime contract pre nego što stigne do browsera. Zato trenutni flow u slučaju nevalidnog output-a pokušava samo ograničene, kontrolisane korake oporavka, a zatim vraća bezbedan `coach_unavailable` odgovor umesto neproverenog AI sadržaja.

Aktuelni W04 dokazi navode da `AI_COACH_PROVIDER=fake|gemini` bira providera, da se u Gemini modu kao primarni model koristi `gemini-3.1-flash-lite`, da je izlaz strukturisan i validiran i da se API ključ čita samo na backendu iz environment-a. Za lokalni live Gemini rad kreira se `.env` iz `.env.example` i kombinovani dev server se pokreće sa `node --env-file=.env scripts/dev.mjs`; običan `npm start`/`npm run dev` bez te konfiguracije ostaje na podrazumevanom fake provideru.

Aktuelna automatizovana evidence provera ima uspešan typecheck, **66/66 uspešnih testova** i uspešan build. Security checklist potvrđuje da API ključ nije prisutan u frontend bundle-u, Git istoriji ili logovima i da se ne vraća frontendu. Poslednja evidence provera nije ponovo pokretala `npm run test:ai:live`, jer je live poziv namerno odvojen i opt-in. Manualni UI layout/focus play-test takođe je ostavljen kao otvorena završna provera.

Lično sam tokom razvoja pokretao igru i proveravao AI Coach flow nakon završenog run-a, uključujući slučajeve kada je prikazivana bezbedna poruka `AI Coach is currently unavailable. Try again later.`. Pokretao sam i Gemini live/dijagnostičke provere, pratio koji provider i model backend stvarno koristi i proveravao latency, HTTP rezultat i prolazak runtime validacije. Takođe sam proveravao razliku između običnog `npm start` pokretanja sa fake providerom i pokretanja sa lokalnim `.env` fajlom za realni Gemini provider.

Za rad sam koristio AI alate, prvenstveno **Codex** za implementaciju, izmene koda, testove i dijagnostiku, i **ChatGPT** za razradu zahteva, SpecKit/feature plan, pripremu preciznih Codex promptova i analizu rezultata i problema. AI rezultat nisam tretirao kao automatski ispravan: proveravao sam terminal output, test rezultate, konfiguraciju providera, ponašanje igre u browseru, API contract i bezbednost secret-a, a probleme poput timeout-a i nevalidnog provider output-a vraćao sam u novi ciklus dijagnostike i izmene implementacije.

Najvažnije što sam naučio ove nedelje jeste da pouzdana AI integracija nije samo uspešan API poziv. Potrebni su jasna frontend/backend granica, ograničena količina podataka koja se šalje modelu, stroga input/output validacija, timeout/deadline politika, kontrolisani retry mehanizam, bezbedno rukovanje greškama i odvajanje realnog providera od determinističkog fake providera za razvoj i testove. Takođe sam kroz praktičnu dijagnostiku video da izbor API metode i modela može značajno da utiče na latency i pouzdanost.

Poznato ograničenje je da latency i kvalitet realnog Gemini poziva zavise od spoljnog servisa i ne mogu se garantovati samo lokalnim testovima. Zbog toga gameplay ne zavisi od dostupnosti AI Coach-a, a neuspeh AI providera ne prekida igru. Trenutno nemam blocker za koji mi je potrebna pomoć tutora; preostale stavke su završne verifikacije i dokumentovanje rezultata.

## 4. Sledeći korak

Sledeći konkretan korak je implementacija dodatne ai funkcionalnosti.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.