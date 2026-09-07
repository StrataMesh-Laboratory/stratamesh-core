# Lore village ACB MUD — Olissippo (pre-Roman Lusitanian)

**Status:** Lab design note for a **lore Virtual Domain / Open World** (not main / not TRD mainnet).  
**Setting:** Pre-Roman **Lusitanian village on the Tagus** — **Olissippo** (Olisipo) lore, centuries before Roman municipal Lisbon.  
**Myth:** Local Lusitanian cult and numina are **true lore magic** inside this realm (not metaphor, not “superstition flags”).  
**Source:** external “Minimal ACB MUD” prospectus (continuity MVP), ontology-filtered.  
**Parents:** [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) · [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md) · [`NFT-MACRO-CATEGORIES.md`](./NFT-MACRO-CATEGORIES.md) · [`OSS-PASS-ATELIER-MUD-OZ.md`](./OSS-PASS-ATELIER-MUD-OZ.md) · [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md) · [`UI-LOCALE-CPLP.md`](./UI-LOCALE-CPLP.md)

**Honesty:** Lab lore inspired by the Tagus estuary settlement later called Olisipo — not archaeological reconstruction, not fantasy dwarves/elves, not Roman forum Lisbon. Mythic names below are **realm-true** for play; they are not claims about historical ritual practice.

---

## 0. Verdict in one line

**Keep** the continuity proof (same ACB across days, memory, autonomy while the human is away, server-authoritative world, LLM-advisory).  
**World:** hill-and-quay **Olissippo** where **human and ACB Subjects play as equals**, and Lusitanian myth **works** as world rules — with **provisions** so later free-generative *origines* can expand cult, places, and tales without breaking ontology.

---


## Identity vs world role · lore vs main

- **Identity** = StrataMesh Subject (`subject_id`). **World role** = CMN (`world_role_id` in a realm).
- Olissippo realm is **lore** (`not_main`, `hosts_sandboxes: false`). CMN **main** is where sandboxes are hosted.
- **Same mechanics** as main (Subjects, Objects, roles, decide→validate→execute) — separate world.
- Normative: [`ACB-IDENTITY-WORLD-ROLE.md`](./ACB-IDENTITY-WORLD-ROLE.md)

## 1. Setting — Olissippo lore (MVP map)

**Realm label (eng):** `lore-olissippo-lusitanian` · **PT UI:** Aldeia de Olissippo (pré-romana).

| Location (eng docs) | PT UI sense | Role |
|---------------------|-------------|------|
| Hill enclosure | Cerca do outeiro | Homes, chefe’s hall |
| Smithy / forge | Oficina do ferro | Boutius’s work |
| Charcoal lean-to | Carvoeira | Fuel for the forge |
| Quay / landing | Cais do Tejo | Fish, salt, arrivals |
| Guest house | Casa de hóspedes | Camala’s hearth |
| Open market | Feira | Barter / soft coin |
| Cattle pens | Currais | Herd wealth |
| Watch on the wall | Posto da muralha | Tongius’s beat |
| Sacred grove (edge) | Bosque limiar | **True** cult ground — taboo + magic (§2) |
| Spring / well | Fonte | Water; may carry Nabia’s favour |
| East track to scrub | Caminho do mato | Navia’s supply route |
| Apprentice yard | Pátio da aprendiz | Apana’s practice |
| Shrine niche (hall) | Nichos do culto | Small offerings — Endovelicus / Bandua / Ataegina as realm allows |

**Time:** accelerated day/night; forge heat and quay tide as flavour on a simple day+minute clock.

**Do not begin with:** Roman legion arcs, full Lusitanian wars as campaign, Viriathus as mandatory canon, procedural Iberia, free-form spell invent from the LLM.

---

## 2. True lore magic (Lusitanian myth as world law)

Inside `lore-olissippo-lusitanian`, the old powers are **real**. Healings, omens, grove bans, and favours are **Environment / Institution rules** executed by the server — not chat flavour and not Subject inventory of “god NPCs.”

### 2.1 Numina (realm cast — not player Subjects)

| Name (eng docs) | PT UI | Domain in this lore | MVP expression (server) |
|-----------------|-------|---------------------|-------------------------|
| **Endovelicus** | Endovélico | Healing, underworld threshold, true dreams | Grove/shrine: `rite_heal` / `rite_dream` may alter SubjectRuntime (energy, status) if offering Object valid |
| **Ataegina** | Ataégina | Rebirth, flock/field cycle, underworld return | Seasonal ticks; rare `rite_renew` on herds/fields Objects |
| **Bandua** | Bandua | Community protection, war-band oath | Wall/watch: `oath_bandua` buffs patrol cohesion (SubjectEdge), not free PvP win |
| **Nabia** | Nábia | Waters, springs, river favour | Fonte/cais: water quality / safe crossing flags |
| **Reue / Reve** | Reue | Sky / mountain weather (local) | Weather event bus — rain/heat affecting forge and travel |
| **Trebaruna** | Trebaruna | Home, domestic peace | Guest-house hearth: rest quality while under roof |

Gods / numina are **not** `Subject` rows and **not** Fog nodes. They are **institutional forces** with scripted hooks. Optional later: a cult **Object** (idol, oath-stone) with `ownership_title` or soft deed — still an Object.

### 2.2 Magic is server-authoritative

Same rule as coal and spears:

- LLM may **intend**: `{ "action": "rite_offer", "numen": "endovelicus", "item_id": "…" }`
- Server checks location (grove/shrine), offering Object, taboo state, cooldown
- Server applies or rejects; memory records what **actually** happened

**Finite magic vocabulary (MVP add-ons):** `rite_offer` · `rite_heal` · `rite_dream` · `oath_bandua` · `consult_omen`  
No arbitrary “I cast …” strings. Expand the verb list when proving a new rite — never open free generative *effects* without a schema.

### 2.3 Grove taboo (example world law)

- Entering the bosque limiar with drawn iron without rite → server `taboo_breach` event (fear/status), not LLM invention  
- Valid offering at the niche → may clear breach or grant Endovelicus favour token (status on SubjectRuntime or a small Object)

---

## 3. Provisions for free generative *origines*

**Origines** = generative expansions of origin-tales, epithets, micro-places, and side cults — allowed later **without** rewriting Subject–Object law.

| Provision | Rule |
|-----------|------|
| **Canon core vs generative shell** | Versioned `PersonaLore` + fixed numina table (§2.1) = **canon**. Generative layer may propose *origines* (epithets, local spirit nicknames, trail shrines) into a **staging** store |
| **Admit path** | Generative text never mutates world state directly. Pipeline: propose → server/schema validate → optional human or collegium admit → then WorldEvent / location / soft lore doc |
| **Ontology firewall** | Generators must not mint Subjects, collapse gods into ACBs, mint STRATA, or invent Object kinds outside mud tables |
| **Magic firewall** | New rites require a new **validated action verb** + effect table row — generative prose alone cannot add effects |
| **Culture tag** | `culture_tag='lusitanian_olissippo'`; generative origines inherit the tag or are rejected |
| **Locale** | PT-PT UI for CPLP; eng docs international English; generative PT/EN mirrors must not invent technical jargon in chrome |
| **Not main** | All origines stay inside the lore Virtual Domain until an explicit promote path exists |

MVP ships **without** the generative loop on — only the **hooks** (staging table name, admit flag, culture_tag). Continuity demo must not depend on free generation.

Suggested staging shape (future):

```
OrigineDraft   id, realm, culture_tag, kind(epithet|place|tale|rite_sketch),
               body, source(generative|human), status(staged|admitted|rejected)
```

---

## 4. Ontology corrections (must change)

| Suggestor | StrataMesh · Olissippo |
|-----------|------------------------|
| Humans vs ACBs as NPCs | Equal **Subject players** |
| Fantasy species / dwarves | Lusitanian **persona** only |
| Gods as chat NPCs | **Institution / environment** — true magic via server rites |
| Fog / desk Hermes as villager | Forbidden |
| Free LLM magic | Forbidden — finite rite verbs + provisions for origines (§3) |

Objects: charcoal, iron, spearheads, fish, salt, offerings.  
Balance: lore soft coin / barter / L-STRATA transfer — no faucet.  
Social trust: Subject↔Subject. Ownership fractions: separate.

---

## 5. Stack recast

Fog python + mud tables; Bancada / GNU Atelier as window; Ollama under metabol_pace; no Godot fork unless chartered.

---

## 6. Continuity scenario — Olissippo

**Day 1.** Human Subject meets ACB Subject **Boutius** (smith). Short of **charcoal** for the chefe’s spear order. Player sells charcoal. Optional: small offering at the hall niche (Object) — only if server accepts `rite_offer`. Memory + SubjectEdge stored.

**Day 2.** Same `subject_id`. Autonomous ticks: forge, charcoal, spears; may have kept grove taboo. Speech cites **stored** memory, e.g.:

> “You again. The charcoal you brought saved yesterday’s work. The chefe still waits on spears.”

---

## 7. Schema (MVP + hooks)

```
Subject          subject_id, kind(user|sca|acb), …
PersonaLore      subject_id, display_name, biography, personality, beliefs,
                 home_location, culture_tag, version
SubjectRuntime   subject_id, location, energy, hunger, current_goal,
                 status_flags  -- e.g. bandua_oath, endovelicus_favour, taboo_breach
MemoryEvent      id, subject_id, ts, type, summary, importance
SubjectEdge      a_id, b_id, trust, familiarity
WorldEvent       id, ts, type, data
NumenHook        numen_id, location_ids, rite_verbs, effect_table_ref
OrigineDraft     …  -- provision only; empty in MVP
Object / Lot / Contract / …
```

Actions (mundane): `wait|move|say|buy|sell|work|eat|sleep|inspect|follow`  
Actions (magic MVP): `rite_offer|rite_heal|rite_dream|oath_bandua|consult_omen`

---

## 8. Five opening personas

| Persona | Role | Primary goal | Demonstrates |
|---------|------|--------------|--------------|
| **Boutius** | Smith | Chefe’s spear order | Work, trade, memory |
| **Camala** | Guest-house (Trebaruna’s roof) | Hearth solvent | Economy, social |
| **Apana** | Apprentice | Learn the forge | Mentorship |
| **Tongius** | Wall watch (Bandua) | Enclosure safe | Patrol; optional oath |
| **Navia** | River trader (Nabia’s water-roads) | Supply routes | Travel, trade |

Boutius persona lock: Lusitanian Olissippo smith; not Roman magistrate; not dwarf; grove not for idle iron; server-grounded speech only.

---

## 9. Phases

1 World graph + Objects · 2 Deterministic Boutius · 3 Ollama JSON · 4 Memory · 5 Five personas · 6 Atelier view · 7 Continuity eval · **later:** OrigineDraft admit loop for free generative origines

---

## 10. Success criteria

- [ ] Boutius is Subject (`acb`/`sca`), never Object  
- [ ] Charcoal/spear/rite effects only via validated paths  
- [ ] Numina never appear as Subject/Fog rows  
- [ ] No free-form generative magic effects in MVP  
- [ ] OrigineDraft provision exists (even if unused)  
- [ ] Realm `lore-olissippo-lusitanian` **not main**  
- [ ] No leftover northern-fantasy forge cast (prior draft chrome)  

---

## 11. Out of MVP

Combat campaigns, Roman conquest, custom LLM, vector DB, Godot fork, STRATA faucet, backpack land, generative rites without schema.

---

## 12. Bottom line

Continuity MVP for autonomous **Subjects** in **pre-Roman Lusitanian Olissippo**, where **myth is true lore magic** under Fog authority, and **provisions** leave room for free generative *origines* later — without letting generation rewrite ontology or invent unvalidated miracles.

## Identity / role split (landed)

- StrataMesh identity: `contracts/stratamesh/` (`acb-boutius-001`, …)
- CMN world role: `contracts/cmn/` (`cmn-role-oli-*`) in realm `lore-olissippo-lusitanian`
- CMN main `cmn-main-sandbox-host` hosts sandboxes; Olissippo does **not** — same mechanics, separate lore world
- Module: [`src/olissippo_identity.py`](../src/olissippo_identity.py) · doc: [`ACB-IDENTITY-WORLD-ROLE.md`](./ACB-IDENTITY-WORLD-ROLE.md)

## Phase 6 — Atelier view (landed)

- Stage: [`frontend/olissippo.html`](../frontend/olissippo.html) + [`frontend/olissippo-stage.js`](../frontend/olissippo-stage.js)
- Snapshot: [`frontend/olissippo-world.json`](../frontend/olissippo-world.json) (`not_main: true`, realm `lore-olissippo-lusitanian`)
- Pretty URL: `/olissippo` → lore stage (not Bancada / not open-world main)
- HUD: Pessoas (ACB Subjects) vs Objectos — **no `object_id` jargon in chrome**
- Next: Phase 7 continuity eval

## Phase 5 — five opening personas (landed)

- Index: [`contracts/mud/olissippo-personas.json`](../contracts/mud/olissippo-personas.json)
- Personas: Boutius, Camala, Apana, Tongius, Navia — all `kind=acb`, `acb-oli-*-001`
- Runtime: [`src/olissippo_personas.py`](../src/olissippo_personas.py) — role routines, `tick_all`
- **ACB ≠ NFT** on every persona file + runtime seals
- Next: Phase 7 continuity eval

## Phase 4 — MemoryEvent + SubjectEdge (landed)

- Schema: [`contracts/mud/olissippo-memory-schema.json`](../contracts/mud/olissippo-memory-schema.json)
- Module: [`src/olissippo_memory.py`](../src/olissippo_memory.py)
- `record_memory` / `recall` / `upsert_edge` / `speech_from_memory`
- Day-2 continuity: Boutius cites stored charcoal trade with the player Subject
- **ACB ≠ NFT:** memories bind `subject_id` only; `obj-*` rejected
- Next: Phase 7 continuity eval

## Phase 3 — decide → validate → execute (landed)

- Module: [`src/olissippo_decide.py`](../src/olissippo_decide.py)
- Flow: perception → JSON decision (Ollama or routine policy) → `validate_decision` → `execute_decision`
- **ACB ≠ NFT** enforced: decisions carrying `object_id` / mint self are rejected
- Default prefers Ollama when `:11434` is up; else real `routine_decide` policy. Rite effects from `rite_effects`.
- On reject/exception: fall back to Phase 2 deterministic routine
- Next: Phase 7 continuity eval

## Phase 2 — deterministic Boutius (landed)

- Persona: [`contracts/mud/olissippo-persona-boutius.json`](../contracts/mud/olissippo-persona-boutius.json)
- Runtime: [`src/olissippo_boutius.py`](../src/olissippo_boutius.py) — routine ticks, **no LLM**
- **ACB ≠ NFT:** `subject_id=acb-oli-boutius-001`, `kind=acb`, `is_nft=false` — never `object_id`
- Charcoal/spears remain **Objects**; Boutius **holds** charcoal in Subject runtime, does not become an Object
- Tests: `src/test_olissippo_boutius.py`

## Phase 1 machine graph (landed)

- Graph: [`contracts/mud/olissippo-world.json`](../contracts/mud/olissippo-world.json)
- Loader: [`src/olissippo_world.py`](../src/olissippo_world.py) — `validate_move`, `objects_at`, `numen_at`
- Tests: `src/test_olissippo_world.py` (wired in `protocol-invariants`)
- Next: Phase 7 continuity eval

---

## Phase 7 — Council games (Bandua season · Grove Lex · hill stirps)

Inter-tribe **orders** (Diplomacy mechanics), **mutable hearth-law** (Nomic mechanics), and **stirps kinship/succession** (Crusader Kings family/dynasty mechanics) adapted to Lusitanian lore and historically named neighbours.

Normative: [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md) · contracts `olissippo-iberia-neighbours.json`, `olissippo-council-diplomacy.json`, `olissippo-grove-lex-nomic.json`, `olissippo-kin-dynasty.json`.

### Phase 7b — Castro hearth (settle / expand / raid)

Travian- and Forge-of-Empires-like **settlement production, expand, cattle raid, and works upgrades**, lore-named **Ciclo do castro**. See [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md) · `olissippo-castro-settlement.json`.

### Phase 7c — Expanded council / MMO / kin

Quay barter, siege vs raid, craft lore, guest-right tribute, hill claims, fosterage — see [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md).

### Ontology reminder (Phase 7+)

**All NFTs are STRATA NFTs.** Castro / herd / grain / timber / ore as Objects are STRATA. **Lore ≡ main stakes** — Olissippo is skin on the same StrataMesh economics (quay ≡ Agora-class trade stakes), not a softer parallel goods world. `not_main` is realm/host identity, not weaker money. **ACB ≠ NFT** still holds for Subjects.

### Phase 8 — Council verbs on decide path

`actions_council` wired into decide→validate→execute; castro/lot STRATA `object_id` stamps. See [`OLISSIPPO-COUNCIL-GAMES.md`](./OLISSIPPO-COUNCIL-GAMES.md).

### Phase 8A / 8B — Five composing engines

Architecture: [`OLISSIPPO-ENGINE-ARCHITECTURE.md`](./OLISSIPPO-ENGINE-ARCHITECTURE.md). Event pipeline + verb registry + lots; runtime stamps `law_version` / `events[]`. ACB ≠ NFT; Objects = STRATA.

