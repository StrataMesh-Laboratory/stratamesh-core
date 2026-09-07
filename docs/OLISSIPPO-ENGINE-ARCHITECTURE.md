# Olissippo Engine Architecture — Phase 8A / 8B

**Realm:** `lore-olissippo-lusitanian` · **not_main** (host identity) · **Lore ≡ main STRATA stakes**  
**Hard ontology:** All Objects are STRATA NFTs / lots. ACB Subjects ≠ NFTs. Subjects hold title; they never become `object_id`.

This is **five composing engines** on Subjects / Objects / Edges / Events / finite verbs — **not five mini-games**.

Normative pointers: [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md) · [`LORE-VILLAGE-ACB-MUD.md`](./LORE-VILLAGE-ACB-MUD.md) · [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md).

---

## 1. Five engines (composition, not silos)

| Engine | Inspiration (mechanics only) | Olissippo name | Composes |
|--------|------------------------------|----------------|----------|
| **Adjudication** | Diplomacy | Bandua war-band season | simultaneous orders → pure resolve → apply |
| **Law** | Nomic | Grove Lex / **HearthLaw** | immutable core + versioned policy; propose/vote/enact |
| **Kinship / claims** | Crusader Kings | Hill stirps + claims | SubjectEdges + Claim records (having ≠ pressing) |
| **Settlement / economy** | Travian / FoE | Castro hearth | resource-processing graph; STRATA lots first-class |
| **Market / craft / progression** | FoE | Quay barter + craft lore | `exchange()`, craft DAG, landmarks as anchors |

Cross-system loops are the product: kinship → claims → Bandua → settlement loot → law → kinship.

---

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

Ship order for adjudication: **8A** foundation (schema + verbs + pure season) → later 8C full multi-power UI.

---

## 4. HearthLaw (Law engine)

- **Immutable core** vs **policy layer** (`contracts/mud/olissippo-policy-layer.json`).
- Policy is **versioned**; typed policy changes only via propose → vote → enact.
- Every Event that mutates world stamps `law_version`.
- Grove Lex remains the Nomic surface; HearthLaw is the versioned policy bag the other engines read (`succession_policy.resolve(law_version)`, raid season length, guest tribute rate, vote majority, …).

---

## 5. Kinship + claims

- Kinship = **SubjectEdges** (`spouse_of`, `parent_of`, `fostered_by`, `guest_right`, …) — Subjects only.
- **Claim records** are separate: *having* a kinship edge ≠ *pressing* a territorial claim.
- `press_claim` / `claim_press` creates/updates Claim strength; Bandua/Grove may enforce.
- `succession_policy.resolve(law_version)` (default `eldest_living_child`) drives `succeed_holding`.
- Claim strength model: kind → base strength (contract); modifiers later (8D).

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
| **8C** | Full Bandua multi-power season UI + escort generalization polish *(deferred)* |
| **8D** | Claim strength modifiers, succession_policy table, kin↔law loops *(deferred)* |
| **8E** | Craft DAG depth, landmark powers, chain attest hooks *(deferred)* |

---

## 12. Emergent loop (wall principle)

```
kinship → claim press → Bandua season → castro raid/siege/plant
       → lots / exchange → Grove enact (law_version++)
       → succession / foster → kinship
```

Invalid verbs never enter the loop. LLM never writes Objects. Chain attests mirror sim Events later.

---

## 13. Contracts & modules (8A/8B)

| Artifact | Role |
|----------|------|
| `docs/OLISSIPPO-ENGINE-ARCHITECTURE.md` | this doc |
| `contracts/mud/olissippo-event-schema.json` | universal Event fields |
| `contracts/mud/olissippo-policy-layer.json` | immutable_core + versioned policy defaults |
| `contracts/mud/olissippo-verb-registry.json` | finite verbs + engine tags |
| `src/olissippo_events.py` | `make_event`, `append_event` |
| `src/olissippo_lots.py` | Lot Object; mint / transfer / aggregates |
| `src/olissippo_verbs.py` | registry; validate/execute |
| `src/olissippo_council.py` | pure `resolve_season` + `apply_resolution` + season bag helpers |
| `src/olissippo_council_runtime.py` | bag with events/law_version/lots; dispatch via verbs |

NFT/chain attests: **later**. Sim layer is source of truth for Phase 8.
