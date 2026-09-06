# Olissippo Phase 7 — Council games (Diplomacy + Nomic + kin)

**Realm:** `lore-olissippo-lusitanian` (not main).  
**Import:** mechanics only from **Diplomacy**, **Nomic**, and **Crusader Kings** family/dynasty — no product branding in UI.

## Lore names

| Mechanic source | Lore name (EN) | PT UI sense |
|-----------------|----------------|-------------|
| Diplomacy orders/support/supply | **Bandua war-band season** | Estação de Bandua |
| Nomic mutable rules | **Grove Lex / Trebaruna hearth-law** | Lei do Bosque |
| CK dynasty/kin/succession | **Hill stirps / gens** | Estirpes do outeiro |

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
