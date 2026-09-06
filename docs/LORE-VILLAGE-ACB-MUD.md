# Lore village ACB MUD — Olissippo (pre-Roman Lusitanian)

**Status:** Lab design note for a **lore Virtual Domain / Open World** (not main / not TRD mainnet).  
**Setting:** Pre-Roman **Lusitanian village on the Tagus** — **Olissippo** (Olisipo) lore, centuries before Roman municipal Lisbon.  
**Source:** external “Minimal ACB MUD” prospectus (continuity MVP), ontology-filtered.  
**Parents:** [`SUBJECT-OBJECT-ECONOMY.md`](./SUBJECT-OBJECT-ECONOMY.md) · [`STRATA_NFT_ONTOLOGY.md`](./STRATA_NFT_ONTOLOGY.md) · [`MUD-WORLD-FOG-TABLES.md`](./MUD-WORLD-FOG-TABLES.md) · [`DIGITAL-OBJECTS.md`](./DIGITAL-OBJECTS.md) · [`NFT-MACRO-CATEGORIES.md`](./NFT-MACRO-CATEGORIES.md) · [`OSS-PASS-ATELIER-MUD-OZ.md`](./OSS-PASS-ATELIER-MUD-OZ.md) · [`HOLONIC-LAYERS.md`](./HOLONIC-LAYERS.md) · [`UI-LOCALE-CPLP.md`](./UI-LOCALE-CPLP.md)

**Honesty:** This is **lab lore** inspired by the Tagus estuary settlement later called Olisipo — not a claim of archaeological reconstruction, not fantasy dwarves/elves, not Roman forum Lisbon.

---

## 0. Verdict in one line

**Keep** the continuity proof (same ACB across days, memory, autonomous life while the human is away, server-authoritative world, LLM-advisory).  
**World chrome:** one hill-and-quay Lusitanian village at **Olissippo**, where **human and ACB Subjects play as equals** — not NPCs, not Fog nodes.

---

## 1. Setting — Olissippo lore (MVP map)

**Realm label (eng):** `lore-olissippo-lusitanian` · **PT UI:** Aldeia de Olissippo (pré-romana).

One village, 8–12 locations (enough to walk and remember):

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
| Sacred grove (edge) | Bosque limiar | Quiet / taboo — no combat MVP |
| East track to scrub | Caminho do mato | Navia’s supply route |
| Spring / well | Fonte | Daily water |
| Apprentice yard | Pátio da aprendiz | Apana’s practice |

**Time:** accelerated day/night; routines tied to light, heat of the forge, tide at the quay (flavour only in MVP — clock is still a simple integer day+minute).

**Do not begin with:** Roman legion arcs, full Lusitanian wars, Viriathus biography as playable canon, procedural Iberia, or temple combat.

---

## 2. What the suggestor gets right (adopt)

| Idea | Why it fits |
|------|-------------|
| Continuity test (Day 1 fuel → Day 2 recall) | Proves **Subject** persistence, not chat theatre |
| Server-authoritative world; LLM proposes actions | Matches Fog: rules execute; model advises |
| Finite action vocabulary + JSON decisions | Debuggable; safe on 8GB Ollama |
| Event memory validated by server | Same honesty as catalog/object mutations |
| Hybrid scheduler | metabol_pace — don’t burn tokens on “walk to the quay” |
| Phased build | Same RCA/prove discipline as desk |
| LLM ≠ world ≠ entire identity | Persona + DB + scheduler + engine |
| Small world (~5 ACB Subjects) | Lab honesty |
| No combat / continents / quest factory in MVP | Correct scope |

---

## 3. Ontology corrections (must change)

### 3.1 Players are Subjects — both kinds

| Suggestor | StrataMesh · Olissippo |
|-----------|------------------------|
| Humans vs ACBs as NPC cast | **Equal Subject players** (`user` \| `sca` \| `acb`) |
| Dwarven / fantasy species row | **Lore persona** only — Lusitanian villager, craft, kin ties. No `Subject.species` |
| Fog / desk Hermes as villager | **Forbidden** — infrastructure / `external_assistant` ≠ SCA/ACB |

**Rule:** An ACB Subject may wear the persona **Boutius the smith**; charcoal and spearheads are **Objects**. Boutius is not inventory.

### 3.2 Objects vs Subjects vs Lots vs Institutions

| Village thing | Layer |
|---------------|-------|
| Charcoal, iron blooms, spearheads, fish, salt, tools | **Objects** |
| Soft pay (silver bits, cattle-count, lore aes) | **Balance** (lore soft currency and/or lab L-STRATA) — not NFT, not Subject. No faucet |
| Market trade lots | **Lot** if fungible bundles |
| Title to forge shed / guest house | Optional **ownership_title** / deed Object |
| Chefe’s spear order | Soft commitment first; optional later `spa_aps` execution Object |
| Chefe’s hall, market custom, grove taboo | **Institutions** / world rules |
| Olissippo map + clock | **Environment** (Virtual Domain) — **not main** |

### 3.3–3.5 Relationships, memory, holonic

- Social trust = **Subject ↔ Subject** (not OwnershipFraction).  
- Memory on **`subject_id`**.  
- Holonic: sandbox → open_world ⊂ virtual_realm — lore only.

---

## 4. Stack recast

| Suggestor | StrataMesh lab path |
|-----------|---------------------|
| Godot 2D MUD | Fog python + mud tables; **Bancada / GNU Atelier** as window |
| `acbs` + species | `Subject` + versioned `PersonaLore` (Olissippo) |
| Ollama | Mac Fog, metabol_pace, staggered ticks |
| Gold | Lore soft coin / barter / L-STRATA transfer — zero mint |

---

## 5. Continuity scenario — Olissippo

**Day 1.** A human Subject walks the hill enclosure and meets an ACB Subject whose persona is **Boutius**, smith of Olissippo. Boutius is short of **charcoal** for the chefe’s spear order. The player sells charcoal (Object). Server stores transaction, episodic memory, SubjectEdge delta.

**Day 2.** Same `subject_id`. While the human was away, Boutius’s ticks: opened the forge, worked metal, bought more charcoal, remembered the visitor. He might say (PT UI later; eng docs for now):

> “You again. The charcoal you brought saved yesterday’s work. The chefe still waits on spears.”

That proves: identity → memory → time → autonomy → world consequences → continuity — as **Subject**, in **Olissippo lore**.

---

## 6. Minimal schema (unchanged shape)

```
Subject          subject_id, kind(user|sca|acb), …
PersonaLore      subject_id, display_name, biography, personality, beliefs,
                 home_location, culture_tag='lusitanian_olissippo', version
SubjectRuntime   subject_id, location, energy, hunger, current_goal, …
MemoryEvent      id, subject_id, ts, type, summary, importance
SubjectEdge      a_id, b_id, trust, familiarity
WorldEvent       id, ts, type, data
Object / Lot / Contract / …   -- mud tables when economy hardens
```

Actions: `wait|move|say|buy|sell|work|eat|sleep|inspect|follow`.

---

## 7. Five opening personas (Olissippo)

Each row = **ACB Subject** (or human Subject) + **Lusitanian lore persona** — not a fantasy race table.

| Persona | Role | Primary goal | Demonstrates |
|---------|------|--------------|--------------|
| **Boutius** | Smith (oficina do ferro) | Finish the chefe’s spear order | Work, trade, memory |
| **Camala** | Guest-house keeper (cais) | Keep the hearth fed and solvent | Economy, social |
| **Apana** | Smith’s apprentice | Learn the forge | Mentorship (Subject↔Subject) |
| **Tongius** | Wall watch | Keep the enclosure safe | Patrol, events |
| **Navia** | River trader | Keep Tagus supply routes | Travel, trade, relationships |

**Persona lock (Boutius example — versioned lore doc, not casual prompt drift):**

- You live in Olissippo, a Lusitanian hill-and-quay village on the Tagus, before Roman rule.  
- You are a smith; you are not a Roman magistrate, not a medieval knight, not a dwarf.  
- Good ironwork is duty; strangers earn trust slowly; the grove at the edge is not for idle talk.  
- Current life: forge, apprentice Apana, spear debt to the chefe, need charcoal.  
- Rules: no invented physical actions; no knowing what the server did not show; speak as Boutius.

Product UI (CPLP): PT-PT names and place labels; eng docs stay international English.

---

## 8. Phased plan

| Phase | Deliverable |
|-------|-------------|
| 1 | Olissippo location graph + Object items; Subject can walk |
| 2 | Deterministic Boutius (routine, no LLM) |
| 3 | Ollama JSON decide → validate → execute |
| 4 | MemoryEvent + SubjectEdge across restart |
| 5 | Five personas, staggered scheduler |
| 6 | Atelier/Bancada view of the village |
| 7 | Continuity eval (§9) |

---

## 9. Success criteria

- [ ] Boutius `subject_id` is `kind=acb` (or sca) — never an Object  
- [ ] Charcoal / spear mutations only via validated Object paths  
- [ ] No “I took the spear” without server execute  
- [ ] Desk assistants / Fog NODE never village Subjects  
- [ ] Realm flagged **not main** (`lore-olissippo-lusitanian`)  
- [ ] Setting stays pre-Roman Lusitanian Olissippo — no accidental Eastforge/dwarf chrome  
- [ ] UI non-technical; eng docs international English  

---

## 10. Out of MVP

Suggestor’s list, plus: no STRATA faucet-as-gold; no backpack land parcels; no Roman conquest campaign; no Godot fork unless André charters it; no five full LLM ticks per second on 8GB.

---

## 11. Bottom line

Architecturally: continuity MVP for autonomous **Subjects**.  
Narratively: **pre-Roman Lusitanian Olissippo** — hill, quay, forge, and memory — where users and ACBs play the same world, Fog supplies reality, Ollama advises, and charcoal brought yesterday still matters tomorrow.
