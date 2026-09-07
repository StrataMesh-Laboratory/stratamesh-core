# Olissippo Engine Architecture — Phase 8A / 8B / 8C

**Realm:** `lore-olissippo-lusitanian` · **not_main** (host identity) · **Lore ≡ main STRATA stakes**  
**Hard ontology:** All Objects are STRATA NFTs / lots. ACB Subjects ≠ NFTs. Subjects hold title; they never become `object_id`.

This is **six composing engines** (five strategic + **GNU Graphical-MUD state logic**) on Subjects / Objects / Edges / Events / finite verbs — **not mini-games glued to a renderer**.

Normative pointers: [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md) · [`LORE-VILLAGE-ACB-MUD.md`](./LORE-VILLAGE-ACB-MUD.md) · [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md).

---

## 1. Engines (composition, not silos)

| Engine | Inspiration (mechanics only) | Olissippo name | Composes |
|--------|------------------------------|----------------|----------|
| **Adjudication** | Diplomacy | Bandua war-band season | simultaneous orders → pure resolve → apply |
| **Law** | Nomic | Grove Lex / **HearthLaw** | immutable core + versioned policy; propose/vote/enact |
| **Kinship / claims** | Crusader Kings | Hill stirps + claims | SubjectEdges + Claim records (having ≠ pressing) |
| **Settlement / economy** | Travian / FoE | Castro hearth | resource-processing graph; STRATA lots first-class |
| **Market / craft / progression** | FoE | Quay barter + craft lore | `exchange()`, craft DAG, landmarks as anchors |
| **GNU Graphical-MUD state logic** | Lattice MUD + Evennia patterns | Spatial presence / rooms / stage | location graph, contents, move/inspect; Atelier/Bancada **renders only** |

Cross-system loops are the product: kinship → claims → Bandua → settlement loot → law → kinship.

---


## 1b. GNU Graphical-MUD state logic (architectural — not UI chrome)

First-class peer to the five strategic engines. Patterns: **Lattice MUD shape** + **Evennia-style** rooms/exits/contents — adapted to STRATA ontology. See also [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md).

**Owns (source of truth):**
- location / room graph + adjacency (`olissippo-world.json` / `olissippo_world.py`)
- Subject presence (`location_id` on ACB state — Subject ≠ Object)
- Object contents at locations (STRATA `object_id` seeds / lots / castro anchors)
- server-authoritative `move` · `inspect` · venue enter (quay / market / grove / smithy)
- stage-facing world snapshot the **GNU Atelier / Bancada** WebGL view consumes

**Does not own:**
- NFT mint policy, Agora settlement, or chain attestation (sim first)
- strategic adjudication / law / kinship / production math (those engines emit Events; MUD applies spatial consequences)

**Stack:**

```
Atelier / Bancada stage          ← view only
        ↑ renders
GNU Graphical-MUD state logic    ← spatial presence / rooms / contents
        ↔ Events / finite verbs
Five strategic engines           ← Bandua · Grove · stirps · castro · quay/craft
        ↓
Subjects · STRATA Objects · Edges · Events · finite verbs
```

Module: `src/olissippo_mud_state.py` · stamp: `world.graphical_mud`.

## 2. Event-producing state transition pipeline (hard rule)

Every mutating finite verb follows:

```
intent → finite verb → validate → plan → adjudicate → transition → MemoryEvent → updates
```

- **LLM interprets only** (intent / speech / suggestion). **Server executes.**
- Every successful mutation emits one or more universal **Events** (see `contracts/mud/olissippo-event-schema.json`).
- Mutating events **always** carry `law_version` and `reason` (resolution reason string).
- Provenance: `provenance` + `causes` link prior events / orders / proposals.
- Sim layer first; NFT/chain attests later (same `object_id` space).

Wall principle: invalid verbs bounce at **validate**; no partial world write. Pure functions (`resolve_season`, `production_tick` plan) do not mutate; `apply_*` / `execute_verb` do.

---

## 3. Season object (Adjudication)

```
collect orders (submit_order) → close_season → resolve_season (PURE) → apply_resolution
```

- `resolve_season(orders) → {positions, moved, bounced, …}` — **pure**, no bag mutation.
- `apply_resolution(bag, resolution)` writes unit positions / annex / escort outcomes and appends Events.
- **Escort** is generalized (`escort`); `river_escort` is the Tagus lore instance (chain validation from diplomacy contract).

Ship order: **8A/8B** foundation (+ Graphical-MUD peer stamp) · **8C** pure adjudicators (+ dynasty clock) · later 8D/8E polish.

---

## 4. HearthLaw (Law engine)

- **Immutable core** vs **policy layer** (`contracts/mud/olissippo-policy-layer.json`).
- Policy is **versioned**; typed policy changes only via propose → vote → enact.
- Every Event that mutates world stamps `law_version`.
- Grove Lex remains the Nomic surface; HearthLaw is the versioned policy bag the other engines read (`succession_policy.resolve(law_version)`, raid season length, guest tribute rate, vote majority, …).

---

## 4b. Dynasty clock (CK-style time)

**1 real calendar day = 1 game month** (`clock.real_day_equals_game_months: 1`).

- Village day/night activity can still use the fine clock; **dynasty/succession** ages on the month scale.
- Finite verb / tick: `advance_game_month` / `dynasty_tick` (server-authoritative).
- Persons carry `age_months`; at `max_age_months` they die → `SuccessionResolver` under active HearthLaw succession law (eldest / youngest / designated / elective stub / stirps_priority).
- Module: `src/olissippo_dynasty_clock.py`.
- **ACB (EN) = SCA (PT)** — same Subjects; dynasty month-clock applies to ACB and human users equally.
- **Unique dynasty head:** descendants of two different players (ACB/SCA or user) cannot share the same living person as simultaneous successor/head of both dynasties (`shared_successor_forbidden`).
- **Per-dynasty succession laws:** each `player_dynasty` stores its own `succession_law`, changeable via Grove Lex / Nomic typed policy (not one frozen global rule).
- **Playable unit = stirps:** living person is bearer only; valid succession → continue as heir; no heir → **extinction / game over**. Continuity is the ultimate resource. See [`LUSITANIA-DYNASTY-PLAYABLE-UNIT.md`](./LUSITANIA-DYNASTY-PLAYABLE-UNIT.md).

## 5. Kinship + claims

- Kinship = **SubjectEdges** (`spouse_of`, `parent_of`, `fostered_by`, `guest_right`, …) — Subjects only.
- **Claim records** are separate: *having* a kinship edge ≠ *pressing* a territorial claim.
- `press_claim` / `claim_press` creates/updates Claim strength; Bandua/Grove may enforce.
- `succession_policy.resolve(law_version)` (default `eldest_living_child`) drives `succeed_holding`.
- Claim strength model: kind → base strength (contract) via `ClaimStrength`; richer modifiers later (8D).
- **Dynasty clock (CK2-like):** `1 real day = 1 game month`; `advance_game_month` / `dynasty_tick` ages persons; 12 months → +1 `age_years`; death fires `succession_policy.resolve` then `apply_succession`.

---

## 6. Castro settlement / economy

- Castro = **resource-processing graph** (works → rates → lots).
- `tick_production` / `production_tick` is **pure** in plan form; apply mutates bag and **mints/increments STRATA lots**.
- STRATA lots are first-class Objects (`lot_object_ids`, `olissippo_lots.py`).
- Production creates / increases lots; transfers move lot qty between holders.
- **raid ≠ siege ≠ annex**
  - `cattle_raid` — loot fraction of lots
  - `siege_enclosure` — damage enclosure level
  - Bandua annex / move into supply — title/position, not loot

---

## 7. Market / craft / progression

- `exchange()` under quay policy; lore instance `quay_barter`.
- Capabilities + **craft DAG** (`craft_tick` → points → `unlock_craft` tier).
- Landmarks (numen shrine, quay, hill enclosure) are **strategic anchors**, not Subjects.

---

## 8. Power, edge engine, provenance

- **Power** abstraction: people / stirps / castro holders as actors that issue verbs.
- **Edge engine**: SubjectEdge + Claim + pact edges; Events may cite `causes`.
- **Provenance**: every Event lists actor subjects, object ids, location ids, rule/law versions.

---

## 9. Universal Event schema

Fields (normative JSON: `olissippo-event-schema.json`):

`event_id`, `event_type`, `season`, `timestamp`, `actor_subject_ids`, `object_ids`, `location_ids`, `verb`, `before`, `after`, `rule_version`, `law_version`, `provenance`, `causes`, `reason`.

MemoryEvent (Phase 4) remains the Subject recall facet; engine Events are the world transition log. Runtime may mirror into MemoryEvent for ACB recall.

---

## 10. Verb registry

Finite verbs live in `contracts/mud/olissippo-verb-registry.json` with **engine tags**.  
Server: `olissippo_verbs.validate_verb` / `execute_verb` → `{ok, events, reason, …}`.  
Rejects Subject self-`object_id` / mint. Wraps castro / claims / grove / council / kin modules.

Aliases keep Phase 7/8 decide wires green (`castro_quay_barter` → `exchange`, `grove_propose` → `propose_law`, …).

---

## 11. Ship order 8A → 8E

| Phase | Scope |
|-------|--------|
| **8A** | Architecture, event schema, policy layer, verb registry, events/lots modules, pure season + apply |
| **8B** | Runtime bag (`events[]`, `law_version`, `lots`), decide wire, STRATA stamps, CI |
| **8C** | **Shipped:** pure adjudicators (`Season` / `Law` / `Succession` / `Production` / `Trade` + `ClaimStrength`) — resolve/plan ≠ apply; dynasty clock `1 real day = 1 game month`; `advance_game_month` |
| **8D** | **Shipped:** event provenance depth — `provenance_chain`, `explain_event`; every apply_* emits Events with law_version + reason + provenance |
| **8E** | **Shipped:** cross-system scenario tests (kin→claim→Bandua→holding→production; Nomic succession; trade→craft + Graphical-MUD presence) |

---


## Phase 8C shipped notes

- Module: `src/olissippo_adjudicators.py` — pure `resolve_*` / `production_tick` / `exchange` / `succession_policy.resolve` / `DynastyClock.plan_advance`; `apply_*` mutates + events.
- Verbs (`tick_production`, `exchange`, `succeed_holding`, `enact_law`, `close_season` / `bandua_resolve_season`, `advance_game_month`) wire **plan then apply**.
- Escort remains generalized (`escort`; `river_escort` lore instance).
- Typed Grove policy changes: `propose_policy_change(changes[{rule,from,to}], prose_text)` — prose display only.
- World stamp: `phase["8c"]="pure_adjudicators"`; clock stamps `real_day_equals_game_months=1`.
- GNU Graphical-MUD remains peer (`phase["8f"]`); Atelier renders only.
- **Left for later:** deeper claim modifiers UI, full Bandua multi-power UI, craft DAG depth, landmark powers, chain attest.


## Phase 8D — Event / provenance depth

Mutating `apply_*` paths (adjudicators + verbs) emit universal Events with:
`event_id`, `event_type`, `verb`, `season` / `game_month`, `law_version`, `reason` (resolution reason),
`actor_subject_ids`, `object_ids`, `before` / `after`, `provenance` (incl. `chain[]`), `causes[]`.

- `provenance_chain(object_id, events)` reconstructs **created_by → transferred → used** for a STRATA Object.
- `explain_event(event)` returns a server-truth reason dict for LLM narration (interpret only).
- World stamp: `phase["8d"]="event_provenance_depth"`.

## Phase 8E — Cross-system scenarios

End-to-end (not unit silos): kinship → claim → Bandua → holding → production; Nomic dynasty succession;
trade → craft capability with non-empty provenance; Graphical-MUD `stage_snapshot` presence.
World stamp: `phase["8e"]="cross_system_scenarios"`. CI: `test_olissippo_phase8e_cross_system.py`.

## 12. Emergent loop (wall principle)

```
kinship → claim press → Bandua season → castro raid/siege/plant
       → lots / exchange → Grove enact (law_version++)
       → succession / foster → kinship
```

Invalid verbs never enter the loop. LLM never writes Objects. Chain attests mirror sim Events later.

---

## 13. Contracts & modules (8A–8E)

| Artifact | Role |
|----------|------|
| `docs/OLISSIPPO-ENGINE-ARCHITECTURE.md` | this doc |
| `contracts/mud/olissippo-event-schema.json` | universal Event fields |
| `contracts/mud/olissippo-policy-layer.json` | immutable_core + versioned policy defaults |
| `contracts/mud/olissippo-verb-registry.json` | finite verbs + engine tags |
| `src/olissippo_events.py` | `make_event`, `append_event`, `provenance_chain`, `explain_event` |
| `src/olissippo_lots.py` | Lot Object; mint / transfer / aggregates |
| `src/olissippo_verbs.py` | registry; validate/execute |
| `src/olissippo_council.py` | pure `resolve_season` + `apply_resolution` + season bag helpers |
| `src/olissippo_council_runtime.py` | bag with events/law_version/lots; dispatch via verbs |

NFT/chain attests: **later**. Sim layer is source of truth for Phase 8.
