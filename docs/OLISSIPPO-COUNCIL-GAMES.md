# Olissippo Phase 7 — Council games (Diplomacy + Nomic + kin)

**Realm:** `lore-olissippo-lusitanian` (not main).  
**Import:** mechanics only from **Diplomacy**, **Nomic**, **Crusader Kings** family/dynasty, plus **Travian** / **Forge of Empires** settlement–expand–raid — no product branding in UI.

## Ontology (StrataMesh)

- **Every Object is a STRATA NFT** (or fungible STRATA lot). No non-NFT village-goods class.
- **Lore ≡ main stakes.** Olissippo is a narrative/skin layer on the same StrataMesh economics — quay barter, castro title, herd lots, tribute are **functionally equivalent** to Agora-class trade / STRATA ownership / fungible STRATA movement (same stakes), not a softer parallel economy. `not_main` means lore realm hosting identity, not weaker money.
- **Subjects** (ACB / humans) hold title — Subjects are **not** NFTs.
- **Numina** ≠ Subjects; shrine works are aspects/hooks on the castro Object.

## Lore names

| Mechanic source | Lore name (EN) | PT UI sense |
|-----------------|----------------|-------------|
| Diplomacy orders/support/supply | **Bandua war-band season** | Estação de Bandua |
| Nomic mutable rules | **Grove Lex / Trebaruna hearth-law** | Lei do Bosque |
| CK dynasty/kin/succession | **Hill stirps / gens** | Estirpes do outeiro |
| Travian/FoE settle/expand/raid/build | **Castro hearth cycle** | Ciclo do castro |

## Neighbours (pre-Roman horizon)

Home **Lusitani** (Olissippo) plus **Vettones**, **Celtici**, **Turduli**, **Conii (Cynetes)**, **Gallaeci**, **Punic coastal posts** (power, not a playable tribe clone), and distant **Celtiberian** edge.  
Honesty: play inspiration from classical geographers and modern tribal overviews — not archaeological reconstruction.

Contracts: `contracts/mud/olissippo-iberia-neighbours.json`.

## Bandua season (Diplomacy-like)

- Sealed simultaneous orders: `hold` · `move` · `support` · `river_escort` (Tagus/coast convoy-analogue).
- Support adds strength; attacked supporters are cut; ties bounce.
- Supply centers = cattle/quay/oppida territories (wealth claims), not Risk world-conquest.

Server: `src/olissippo_council.py`.

## Grove Lex (Nomic-like)

- **Immutable core:** server authority, Subject≠Object/NFT, lore≠main, no free generative magic, numina≠Subjects.
- **Mutable** guest-right / raid season / market tithe — proposal → vote → enact/repeal with quorum.

Server: `src/olissippo_grove_lex.py`.

## Hill stirps (CK-like kin)

- Stirps (gens) with persons linked optionally to `subject_ref` (ACB/human Subjects).
- Marriage between stirps creates `spouse_of` + `oath_kin` alliance (guest-right alliance).
- Succession of territory/chefe claims: eldest living child, else stirps eldest.
- Persons are **not** NFTs; holdings are claims on territories.

Server: `src/olissippo_kin.py`.

## Anti-goals

- No Roman legion campaign as mandatory canon; no Viriathus required.
- No cloning board-game or Paradox product names into chrome.
- No stacking desk Ollama agents while proving this track.

## Castro hearth cycle (Travian / FoE-like)

Hillfort **castros** hold resources (`herd` · `grain` · `timber` · `ore`) and **works** (enclosure, pens, granary, wood camp, smith pit, watch).

| Verb | Effect |
|------|--------|
| `tick_production` | Works produce resources for a season |
| `upgrade_work` | Spend timber/ore/grain to raise a work level (building upgrade) |
| `plant_castro` | Expand onto empty scrub/pasture (settle a daughter castro; costs + population split) |
| `cattle_raid` | Razzia — band vs defense; loot fraction or repelled (does **not** annex) |
| `reinforce` | Spend grain to grow population |

Annexation stays with **Bandua season**; law changes stay with **Grove Lex**. Castros and herd/grain/timber/ore stacks **are** STRATA Objects (settlement NFTs + fungible STRATA lots). **All NFTs are STRATA NFTs.** Lore economics are **functionally equivalent** to main StrataMesh stakes (skin on top). Subjects hold title; ACB Subjects themselves are not NFTs.

Contract: `contracts/mud/olissippo-castro-settlement.json` · server: `src/olissippo_castro.py`.

## Phase 7c — Expanded mechanics (most apt for StrataMesh lore)

Chosen because they map onto **the same STRATA stakes** under lore names — Subjects hold title on STRATA NFT Objects; quay/tribute/claims are not a toy economy beside Agora/C.

| Source | Mechanic | Lore name | StrataMesh fit |
|--------|----------|-----------|----------------|
| Travian market / FoE goods | Resource swap | **Quay barter** | Fungible **STRATA lots** — **≡ Agora-class trade stakes** (lore skin) |
| Travian siege | Enclosure damage | **Siege the cerca** | Distinct from cattle-raid loot and from Bandua annex |
| FoE research | Craft points → tier | **Craft lore** | Smith/wood works; production bonus; still finite |
| CK vassal / Travian tribute | Herd tithe pact | **Guest-right tribute** | `tribute_to` pact between castros; Subject politics |
| CK claims | Territorial pretension | **Hill claims** | SubjectEdge pressing title on a **castro/territory STRATA NFT**; Bandua/Grove may enforce |
| CK fosterage | Child at host stirps | **Foster under guest-right** | SubjectEdge `fostered_by` / `guest_right` |
| FoE great building lite | Sacred defense | **Numen shrine** | Numina hook / defense only — shrine ≠ Subject |

Contracts: `olissippo-castro-settlement.json` (extended) · `olissippo-stirps-claims.json`.  
Servers: `olissippo_castro.py` · `olissippo_claims.py` · `foster` on `olissippo_kin.py`.

## Phase 8 — Decide wire + STRATA object stamps

Council/castro/grove/claims verbs are in `actions_council` and run through `validate_decision` → `execute_decision` via `olissippo_council_runtime`.

- Each castro has `object_id` (`obj-oli-…`), `is_nft: true`, `nft_family: STRATA`.
- Resource stacks carry `lot_object_ids` (fungible STRATA lots).
- ACB Subjects still reject self-`object_id` / mint — they **hold title**, they are not the Object.
- Lore skin, **same stakes** as main (`lore_economics_equivalent_to_main`).


## Phase 8A / 8B — Five engines + event pipeline

Not five mini-games: **Adjudication ← Diplomacy**, **Law ← Nomic / HearthLaw**, **Kinship/claims ← CK**, **Settlement/economy ← Travian/FoE**, **Market/craft ← FoE**.

Hard pipeline: `intent → finite verb → validate → plan → adjudicate → transition → Event → updates`. LLM interprets; server executes. Lore ≡ main STRATA stakes.

Normative: [`OLISSIPPO-ENGINE-ARCHITECTURE.md`](./OLISSIPPO-ENGINE-ARCHITECTURE.md) · `olissippo-event-schema.json` · `olissippo-policy-layer.json` · `olissippo-verb-registry.json` · `olissippo_events.py` / `olissippo_lots.py` / `olissippo_verbs.py`.

Ship: **8A** foundation · **8B** runtime bag (`events[]`, `law_version`, lots) · **8C–8E** deferred (full Bandua UI, claim modifiers, craft DAG depth / chain attest).

