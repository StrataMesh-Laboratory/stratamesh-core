# Lore village ACB MUD — ontology-filtered prospectus

**Status:** Lab design note for a **lore Virtual Domain / Open World** (not main / not TRD mainnet).  
**Source:** external “Minimal ACB MUD” prospectus (continuity MVP).  
**Filter:** StrataMesh Subject–Object economy + live stack.  
**Parents:** [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) · [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md) · [`NFT-MACRO-CATEGORIES.md`](./NFT-MACRO-CATEGORIES.md) · [`OSS-PASS-ATELIER-MUD-OZ.md`](./OSS-PASS-ATELIER-MUD-OZ.md) · [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md)

---

## 0. Verdict in one line

**Keep** the continuity proof (same ACB across days, memory, autonomous life while the human is away, server-authoritative world, LLM-advisory).  
**Recast** the cast, economy, client, and schema so humans and ACBs are **equal Subjects / players** in a lore world — not “NPCs with gold stats,” and not a second ontology beside Fog/Bancada.

---

## 1. What the suggestor gets right (adopt)

| Idea | Why it fits |
|------|-------------|
| Continuity test (Day 1 coal → Day 2 recall) | Proves **Subject** persistence, not chat theatre |
| Server-authoritative world; LLM proposes actions | Matches Fog: rules execute; model advises |
| Finite action vocabulary + JSON decisions | Debuggable; safe on 8GB Ollama |
| Event memory validated by server (not free DB writes) | Same honesty as catalog/object mutations |
| Hybrid scheduler (routine deterministic + LLM for social/choice) | Aligns with metabol_pace — don’t burn tokens on “walk north” |
| Phased build: world → deterministic NPC → LLM → memory → many → client → eval | Same RCA/prove discipline as desk |
| LLM ≠ world ≠ entire identity | Persona + DB + scheduler + engine |
| Small world (one village, ~5 ACBs) | Lab honesty; not a thousand-agent sim |
| No combat / continents / quest factory in MVP | Correct scope |

---

## 2. Ontology corrections (must change)

### 2.1 Players are Subjects — both kinds

| Suggestor | StrataMesh |
|-----------|------------|
| “Human players” vs “ACBs” as NPC cast | **Human users and ACBs are the same Subject class** (`Subject.kind` ∈ {`user`, `sca`, `acb`}). In this lore world both are **players**. |
| ACB as dwarven species row | **Lore persona / role** (biography, appearance, craft) ≠ Subject kind. “Dwarf blacksmith” is persona chrome in the Virtual Domain — standing remains Subject. |
| `species` column as ontology | Drop as Subject field. Optional `persona.species` or lore tags only. |
| Fog node / desk Hermes as village ACB | **Forbidden.** Fog = infrastructure. Desk `external_assistant` ≠ SCA/ACB ([`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md)). |

**Rule:** An ACB player can run a forge *character* (Hroth) the way a human player can. The forge’s coal and swords are **Objects**. Hroth-the-player is not inventory.

### 2.2 Objects vs Subjects vs Lots vs Institutions

| Village thing | Layer |
|---------------|-------|
| Coal, tools, food, swords | **Objects** (`object_id`) — may be stage props / catalog items; optional contract block |
| “Gold” as wallet cash | Prefer **fungible Balance** (lab L-STRATA or a **lore-only** soft currency on Subject Balance with `oracle_live=false`) — **not** an NFT, not a Subject |
| Shop lots / trade offers | **Lot** rows if fungible bundles — never `Object.kind=lot` |
| Forge title / deed of the smithy building | Optional **ownership_title** / deed on an Object (building) — Subject holds title |
| SPA “finish mayor’s order” | Optional **execution contract** (`spa_aps`) on an Object — static/dynamic C rules if collateralised; lore MVP may use soft commitments first |
| Custodianship / cold storage | Out of scope for village MVP unless a deed Object is introduced ([`NFT-MACRO-CATEGORIES.md`](./NFT-MACRO-CATEGORIES.md)) |
| Mayor’s office, market rules | **Institutions** / world rules — not Subjects |
| Eastforge map, day clock | **Environment** (Virtual Domain / Open World lore instance) — not main |

### 2.3 Relationships

Suggestor `relationships(trust, familiarity)` = **Subject ↔ Subject** edges (social).  
Do **not** overload with ownership fractions. Ownership of Objects uses `OwnershipFraction` / catalog title — different table.

### 2.4 Memory

Episodic + semantic memory attached to **`subject_id`**, not to an “NPC id” parallel species.  
Chat history ≠ autobiographical memory (agree with suggestor).

### 2.5 Holonic placement

This village is a **lore Open World inside a Virtual Domain** ([`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md)) — sandbox → open_world ⊂ virtual_realm.  
**Not** TRD main, **not** production Agora, **not** replacing Bancada account ontology.

---

## 3. Stack recast (use ours, not a parallel product)

| Suggestor | StrataMesh lab path |
|-----------|---------------------|
| Custom Python MUD + Godot 2D | **Fog python hop + Lattice-shaped tables** already; **GNU Atelier / Bancada Three** (or a simple top-down Atelier camera mode) as graphical window — **do not** fork a second Godot product for MVP unless André explicitly wants a separate lore client |
| Fresh SQLite schema `acbs` | Extend Fog sqlite / subject store: `Subject` + `persona` + `memories` + `subject_edges` + world_events — align names with [`contracts/mud/tables.json`](../contracts/mud/tables.json) |
| Ollama local | Mac Fog Ollama under **metabol_pace** (lean model, scheduled ticks) — five concurrent full prompts may need stagger |
| WebSocket client | Prefer existing bancada/sandbox session + Fog events; lore world as invited sandbox/open-world, not anonymous walk-on |
| Gold economy | Lab: soft lore coin **or** L-STRATA transfer (hire/trade patterns from ACB labour — transfer, zero mint). No faucet. |

---

## 4. Continuity scenario — filtered

**Same demo, corrected cast:**

- **Day 1:** Human Subject (player) meets ACB Subject whose **persona** is Hroth the blacksmith (lore). Hroth’s **goal** (Subject commitment) needs coal. Player sells coal **Object** (or lore item). Server records transaction + episodic memory + Subject↔Subject relationship delta.
- **Day 2:** Same `subject_id` for Hroth. Autonomous ticks ran while human was away (work/sleep/buy coal via validated actions). On return, speech cites **stored** memory — not inventing unexecuted actions.

Success line still holds: *“This is the same individual. It has been living in this world, and what happened before matters now.”* — read as **same Subject**, not same doll.

Optional later: human *or* ACB can play any persona; multiple human Subjects; ACB-ACB trade without a human present.

---

## 5. Minimal schema (ontology-aligned)

Do **not** ship the suggestor’s `acbs.species` as canonical.

```
Subject          subject_id, kind(user|sca|acb), …
PersonaLore      subject_id, display_name, biography, personality, beliefs,
                 home_location, version  -- versioned lore docs
SubjectRuntime   subject_id, location, energy, hunger, current_goal, …
MemoryEvent      id, subject_id, ts, type, summary, importance  -- server-validated
SubjectEdge      a_id, b_id, trust, familiarity                 -- social only
WorldEvent       id, ts, type, data
Object / Lot / Contract / Collateral / OwnershipFraction
                 -- existing mud tables when economy hardens
```

Action vocabulary (adopt): `wait|move|say|buy|sell|work|eat|sleep|inspect|follow` — server validates against location/inventory/Balance.

---

## 6. Five opening personas (Subjects, not species)

Keep the *roles* for social texture; each row is an **ACB Subject** (or mix of user + ACB players) with a lore persona:

| Persona | Role | Primary goal | Demonstrates |
|---------|------|--------------|--------------|
| Hroth | Blacksmith | Complete sword order | Work, trade, memory |
| Elara | Innkeeper | Keep inn solvent | Economy, social |
| Tessa | Apprentice | Learn craft | Mentorship (Subject↔Subject) |
| Bram | Guard | Keep village safe | Patrol, events |
| Nia | Merchant | Supply routes | Travel, trade |

Human Subjects enter as players with equal standing — no “guest NPC” tier ([sandbox invite rules](./SUBJECT-OBJECT-ECONOMY.md)).

---

## 7. Phased plan — mapped to Bancada / Fog

| Phase | Suggestor | Our deliverable |
|-------|-----------|-----------------|
| 1 | World engine | Lore map locations on Fog + Object items; walk as Subject |
| 2 | Deterministic Hroth | ACB Subject + routine scheduler, no LLM |
| 3 | LLM layer | Ollama decide JSON → validate → execute |
| 4 | Memory | MemoryEvent + SubjectEdge persistence across restart |
| 5 | Five personas | Staggered scheduler under metabol_pace |
| 6 | Graphical | Atelier/Bancada view (top-down or stage) — boring client OK |
| 7 | Eval | Continuity checklist §8 |

Skip Godot unless explicitly chartered as a second client.

---

## 8. Success criteria (kept + ontology addenda)

Adopt suggestor checklist, plus:

- [ ] Hroth’s `subject_id` is `kind=acb` (or sca) — never an Object row  
- [ ] Coal/sword mutations only via server-validated Object/inventory paths  
- [ ] No invented “I took the sword” without execute  
- [ ] Desk assistants and Fog NODE_WALLET never appear as village Subjects  
- [ ] Lore world flagged **not main** (Virtual Domain id / lab realm)  
- [ ] UI copy non-technical; eng docs international English  

---

## 9. Explicitly out of MVP (agree + add)

Agree with suggestor’s “what not to build,” and also:

- Do not mint STRATA for village gold  
- Do not treat land parcels as backpack items  
- Do not collapse deed/execution NFT macros into “quest items” without Contract table  
- Do not run five full-context LLM ticks every second on 8GB — hybrid scheduler required  
- Do not publish lore village as production Agora  

---

## 10. Bottom line

The prospectus is **architecturally sound** as a continuity MVP for autonomous Subjects.  
Filtered into StrataMesh, it becomes: **a small lore Open World where user and ACB Subjects play together**, Fog/Bancada remain authoritative reality, Ollama is the advisory lobe, and coal/memory/time prove personhood-as-Subject — not a prettier chatbot tied to a dwarf mesh.
