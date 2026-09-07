# Lusitania Open World — Nomenclature & Etymology Standard

**Status:** Normative (2026-09-07)  
**Audience:** Players, UI, contracts, API-facing keys  
**Related:** [`LUSITANIA-PLAYER-REPORT.md`](./LUSITANIA-PLAYER-REPORT.md) · [`LUSITANIA-DYNASTY-PLAYABLE-UNIT.md`](./LUSITANIA-DYNASTY-PLAYABLE-UNIT.md) · [`OPEN-WORLD-HYPERVISORS.md`](./OPEN-WORLD-HYPERVISORS.md) · [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md)

## Principles

1. **Substrate mix, not costume Latin.** Custom terms for Lusitania draw on a historically plausible mix for western Iberian peoples of the late Iron Age / early Roman contact era:
   - **Lusitanian** remnants (primary substrate — sparse, often onomastic/theonymic)
   - **Latin** (contact / administration / later mediation of names)
   - **Phoenician / Punic** (west-Mediterranean coastal contact)
   - **Gallaeci** (NW Iberian Celtic-related neighbours)
   - **Celtiberian** (interior Celtic-related neighbours)
   - **Turdetani + Tartessos** (SW Iberian / Guadalquivir tradition)
   - **Light Greek** only where Mediterranean contact makes sense (emporia, ethnonyms)
2. **Not** pure Classical Latin UI copy. **Not** free fantasy coinage without that substrate (no invented “Elvish” with Iberian wallpaper).
3. Prefer **attested** forms when known; mark **loan** and **reconstructed** honestly.
4. Social hierarchy is fixed: **gens → populus → Lusitani** (confederation).
5. New **code/API-facing** keys prefer glossary forms (`gens_id`, `populus_id`, `confederation`). Legacy `stirps` / `dynasty_*` remain internal aliases only.

## Honesty labels

| Label | Meaning |
|-------|---------|
| **attested** | Form known from inscriptions, classical authors, or secure archaeology-linked names |
| **loan** | Borrowed into our lore UI from a contact language (usually Latin mediation) |
| **reconstructed** | Plausible formation from the substrate mix; not a claim of a recovered dictionary entry |

## Hierarchy (normative)

| Term | Gloss | Etymology note | Label |
|------|-------|----------------|-------|
| **gens** (pl. *gentes*) | Playable house / lineage unit | Latin *gens* “clan, stock”; used because Lusitanian kinship vocabulary is barely attested and Latin is the durable contact lens. Primary **product** term. | loan (Latin) |
| **populus** (pl. *populi*) | All gentes of one tribe | Latin *populus*; maps to tribal-scale grouping (cf. classical ethnonyms for Iberian peoples). | loan (Latin) |
| **Lusitani** | Tribal confederation of Lusitanian-culture populi | Classical ethnonym *Lusitani* (Latin/Greek mediation of a local name). Confederation = all populi under that culture horizon. | attested (ethnonym) |

Aliases (internal only): *stirps*, *dynasty* / `player_dynasty_*`. Player copy says **gens**.

## Approved glossary (core loops)

| Lore / UI term | Meaning | Etymology note | Label |
|----------------|---------|----------------|-------|
| **Olissippo** | First living village (hill + quay) | Classical *Olissipo* / *Olisippo* (Lisbon); local pre-Latin root often linked to SW Iberian / Tartessian contact hypotheses — we keep the classical spelling family. | attested (toponym) |
| **castro** | Fortified hill settlement / production node | From Latin *castrum* via Iberian Romance; archaeology term for NW/W Iberian hillforts (also Galician-Portuguese *castro*). | loan (Latin → Iberian Romance) |
| **Bandua** | War / season adjudication numen; sealed-orders season | Lusitanian / Gallaecian theonym *Bandua* (attested in NW Hispania dedications). | attested (theonym) |
| **Estação de Bandua** | Bandua season (politics as weather) | PT product phrase + Bandua. | mixed |
| **Grove** / **Lei do Bosque** | Mutable hearth-law (Nomic) venue | English *Grove* for lab UI; PT *bosque* for player-facing. Sacred-grove pattern fits western Iberian outdoor cult attested under Roman lens — not a claim of a Lusitanian lexeme *grove*. | reconstructed (ritual pattern) + loan (UI) |
| **numen** | Divine/power presence in rites | Latin *numen*; lab umbrella for Bandua, Endovelicus, etc. | loan (Latin) |
| **Endovelicus** | Healing / favour numen | Attested theonym in Lusitania. | attested (theonym) |
| **chefe** | Local head / claim-holder role | Portuguese *chefe* (from Latin *caput*); player-facing PT. Not Classical *princeps* as default UI. | loan (PT/Latin) |
| **mordomo** / **steward** | Absentee delegate; may tick gens eligibility; **not** automatic heir | PT *mordomo* (household steward; Latin *maior domus* path); EN *steward*. | loan |
| **quay** / **cais** | Trade venue (lore ≡ main stakes) | EN quay / PT cais — coastal emporium pattern (Punic + Atlantic). | mixed (contact) |
| **ACB** / **SCA** | Autonomous computational being (EN / PT) | Product ontology, not ancient. ACB ≠ NFT. | modern (product) |
| **STRATA** | Owned digital objects / lots | Product ontology. | modern (product) |
| **oath_kin** | Gens-level alliance edge (marriage guest-right) | Internal edge id; player gloss: oath / guest-right between gentes. | reconstructed (pattern) |
| **enemy_of** | First-class enmity edge (inherits on succession) | Internal edge id. | modern (mechanic) |
| **owes_obligation_to** / **owed_by** | First-class obligation edges (inherit) | Internal edge ids. | modern (mechanic) |

## Phonology / orthography (light)

- Prefer forms already in classical or epigraphic tradition when naming numina and places (**Bandua**, **Endovelicus**, **Olissippo**).
- Portuguese (pt-PT) is primary player language for CPLP; English block for vision.
- Avoid pseudo-Latin plurals on modern keys (`gens_id`, not `gentisId`).
- Avoid pure Celtic fantasy stems that erase Lusitanian / SW Iberian substrate.

## What this is not

- Not a claim that Lusitanians spoke Latin as a mother tongue.
- Not a reconstructed “complete Lusitanian dictionary.”
- Not permission to mint random High Fantasy names for UI chrome.

## Pointers in lab

- Player briefing: `/lusitania` · doctrine: playable unit = **gens**
- Clock / succession: `src/olissippo_dynasty_clock.py` (`gens_id` aliases beside `dynasty_*`)
- Kin contract: `contracts/mud/olissippo-kin-dynasty.json` (`gens_id`, `populus_id`, `confederation`)
- Language pools → microhv: `src/olissippo_player_pools.py` (`resolve_player_pool` / `select_microhypervisor_pool`; CPLP PT-PT vs Intl EN-GB)

## Open World host bridge

Social scale lives **inside** the Lusitania Open World host plane:

| Social | Host |
|--------|------|
| **gens** | Holdings on parcels of the land-bundle |
| **populus** | Tribal presence across zones/micros of the same world |
| **Lusitani** | Confederation = this Open World on its **macrohypervisor** (micros may mirror the same bundle) |

Microhypervisor mirrors split by language pool: **CPLP → PT-PT**, **International (non-CPLP) → EN-GB** (same land-bundle).

Normative host doc: [`OPEN-WORLD-HYPERVISORS.md`](./OPEN-WORLD-HYPERVISORS.md) · code `src/olissippo_player_pools.py`. Not Fog `:8787`/MW.

