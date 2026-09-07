# Olissippo Phase 7 — Council games (Diplomacy + Nomic + kin)

**Realm:** `lore-olissippo-lusitanian` (not main).  
**Import:** mechanics only from **Diplomacy**, **Nomic**, **Crusader Kings** family/dynasty, plus **Travian** / **Forge of Empires** settlement–expand–raid — no product branding in UI.

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

Annexation stays with **Bandua season**; law changes stay with **Grove Lex**. Castros are runtime claims — **not** STRATA NFTs.

Contract: `contracts/mud/olissippo-castro-settlement.json` · server: `src/olissippo_castro.py`.

## Phase 7c — Expanded mechanics (most apt for StrataMesh lore)

Chosen because they map cleanly onto **Subjects / claims / finite verbs / quay trade**, without turning castros into NFTs or inventing free magic.

| Source | Mechanic | Lore name | StrataMesh fit |
|--------|----------|-----------|----------------|
| Travian market / FoE goods | Resource swap | **Quay barter** | Fungible village goods ≠ Agora ownership fractions ≠ collateral C |
| Travian siege | Enclosure damage | **Siege the cerca** | Distinct from cattle-raid loot and from Bandua annex |
| FoE research | Craft points → tier | **Craft lore** | Smith/wood works; production bonus; still finite |
| CK vassal / Travian tribute | Herd tithe pact | **Guest-right tribute** | `tribute_to` pact between castros; Subject politics |
| CK claims | Territorial pretension | **Hill claims** | Legal edge; not NFT title; Bandua/Grove may enforce |
| CK fosterage | Child at host stirps | **Foster under guest-right** | SubjectEdge `fostered_by` / `guest_right` |
| FoE great building lite | Sacred defense | **Numen shrine** | Numina hook / defense only — shrine ≠ Subject |

Contracts: `olissippo-castro-settlement.json` (extended) · `olissippo-stirps-claims.json`.  
Servers: `olissippo_castro.py` · `olissippo_claims.py` · `foster` on `olissippo_kin.py`.

