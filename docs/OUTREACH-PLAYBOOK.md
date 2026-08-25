# Pre-testnet outreach playbook

**Style:** open-source protocol contributor recruitment — **not** crypto spam.  
**Channels:** personal email from **AMCM ENI** (`@eni.calhegasmorais.pt`) · GitHub **Discussions** (public) · optional Sponsors messages where available.  
**Hard limit:** GitHub has **no** cold direct-message API to arbitrary users. “DM” = email + Discussion invitation + replies on threads the person already joined.

---

## Before any send

1. Org and core repo pass the **30-second test** (see [WHY-YOUR-EXPERTISE-MATTERS.md](./WHY-YOUR-EXPERTISE-MATTERS.md)).  
2. Issues with `track:*` + acceptance metrics exist.  
3. Discussions enabled on `stratamesh-core`.  
4. Target is a **person** (specific PR/commit), not a mailing list.

---

## Four stages

### 1 — Select people (100–300), not “developers”

Sources: recent contributors to libp2p, KubeEdge, Akri, EdgeX, IPFS/Filecoin, Golem, Akash, IOTA, Kubernetes, agent frameworks, Godot/Bevy, robotics/IoT.

Log in `docs/outreach/targets.csv` (private ops copy may live outside public git if emails are personal).

Columns: `name,github,email,community,hook_variant,specific_work,status,sent_at,reply`

### 2 — First contact (150–200 words)

- One specific work reference.  
- Short architecture context (GDA + Fog/Edge + PoC + subjects).  
- **Their** problem as hook (variant table below).  
- Low-friction CTA: look at repos + join community — **not** “become core.”

### 3 — CTA path

```
GitHub → read → Discussion/issue → experiment → PR → contributor
```

### 4 — Second message (only after interest)

Strong pitch: subjects vs objects · not another crypto asset platform · sovereign computational web space.  
See template B in [OUTREACH-TEMPLATES.md](./OUTREACH-TEMPLATES.md).

---

## Hook variants (first paragraph / specificity line)

| Community | Hook line |
|-----------|-----------|
| libp2p | GDA gossip / peer coordination / topology under intermittent peers |
| KubeEdge | Fog/Edge orchestration and heterogeneous resource layer |
| Akri / EdgeX | Devices as discoverable computational resources |
| Golem | Decentralized compute contribution and consumption economics |
| Akash | Provider economics and resource market realism |
| IPFS | Content addressing and decentralized infrastructure adjacency |
| IOTA | DAG + IoT / machine-economy adjacent problems |
| Agents | SCA as first-class subject: identity, resources, subsistence |
| Godot / Bevy | Virtual Domains / Open Worlds coexistence layer |

---

## DeoMail / ENI

**From:** `geral@eni.calhegasmorais.pt` (AMCM ENI professional identity)  
**CC policy:** none on cold outreach; operator may BCC private ops log  
**Rate:** prefer batches of 5–15 personalised/day over 100 identical blasts  
**Compliance:** personal relevance required; stop on unsubscribe/no-interest

Templates: [OUTREACH-TEMPLATES.md](./OUTREACH-TEMPLATES.md)

---

## GitHub surface (public)

| Asset | Role |
|-------|------|
| Org profile | 30s “is this real?” |
| Discussions → Ideas / General | Architecture conversation |
| Issues `track:*` | Concrete problems |
| Impact Fund | Funding without “what’s the token?” first |
| Sponsors | Optional recurring |

---

## Do not

- Generic “dear developer” lists  
- Lead with token / tokenomics  
- Words: revolutionary, disruptive, next Ethereum, Web3 revolution (first contact)  
- Ask immediately for core commit rights
