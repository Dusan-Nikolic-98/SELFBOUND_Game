# NACRT — Nedeljni izveštaj

## 1. Osnovne informacije

| Polje | Odgovor |
| --- | --- |
| Ime i prezime | Dušan Nikolić |
| Adresa e-pošte | (d-nikolic98@outlook.com) |
| Discord korisničko ime | (Dušan Nikolić) |
| Nedelja | Sesija 003 |
| Par / tim | Milena Paripović |
| Moj konkretan doprinos / uloga | Predložio sam ideju igre i uradio početnu postavku projekta (AI_USAGE_LOG, BUILD_PROMPT_V1, CONTEXT_MANIFEST, EVALS, EVIDENCE_003 i GAME_SPEC). Pri tome sam se konsultovao sa ChatGPT-om i Gemini-jem. |
| Datum predaje | 2026-09-23 |
| Reference na rad i dokaze | `EVIDENCE_003.md`, `EVALS.md`, `AI_USAGE_LOG.md`, `README.md`, screenshot baseline-a, tag `baseline-v1`, commit `7d6dc17`, rezultat skripte `check-reachability` i javni repozitorijum: https://github.com/Dusan-Nikolic-98/SELFBOUND_Game |

## 2. Moj status

**Status:** Završeno

Predložio sam ideju igre i uradio početnu postavku projekta. U dostupnim beleškama postoji i rezultat da enemy_2 i enemy_4 imaju 0 pogodaka na baseline-u, zbog čega level ne može da se završi (u baseline-u samo, u trenutnoj verziji može).

## 3. Rad ove nedelje

Radio sam na projektu SELFBOUND, 2D side-scroller igri u TypeScript-u i HTML Canvas-u. Predložio sam ideju igre i uradio početnu postavku projekta. U igri igrač puca delom sebe u neprijatelja i teleportuje se na njegovo mesto.
Radio sam u paru sa Milenom Paripović. Pri početnoj postavci konsultovao sam se sa ChatGPT-om i Gemini-jem.
Milena je, prema dostavljenim beleškama, uz pomoć coding agenta Codex kreirala aplikaciju na osnovu BUILD_PROMPT_V1.md, pokrenula baseline i radila na dokumentaciji. Dostavljeni dokazi uključuju EVIDENCE_003.md, EVALS.md, AI_USAGE_LOG.md, README.md, screenshot baseline-a, tag baseline-v1 i commit 7d6dc17. Rezultat skripte check-reachability pokazuje da enemy_2 i enemy_4 imaju 0 pogodaka, pa level ne može da se završi. Ovaj rezultat sam ručno potvrdio igranjem u browseru

Najteže je bilo napisati kvalitetan spec fajl koji odgovara ideji. Naučio sam osnove pravljenja i korišćenja spec fajlova, kao i korišćenje jednog ai alata za generisanje detaljnog prompta za coding agent-a.

## 4. Sledeći korak

Proširivanje aplikacije sa AI funkcionalnostima.

## 5. Poverljiva napomena za tutora

Nema dodatne napomene.
