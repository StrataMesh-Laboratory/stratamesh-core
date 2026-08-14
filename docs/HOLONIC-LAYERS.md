# Arquitectura holónica — StrataMesh (edição em profundidade, PT-PT)

Cada camada é um **holão**: inteiro em si e parte da camada acima. A integração só é contínua quando cada holão expõe um **contrato de interface** estável (invariantes, eventos, a montante / a jusante, esquema).

```
RDL STRATAMESH                              ← substrato da malha
    │
NÓ (SO / VM)                                ← capacidade do anfitrião
    │
SO DO METAVERSO WEB3 (partilhado)           ← SO entre nós
    ├─ Kernel temporal CLP                  ← tempo civil (autoridade PPC)
    ├─ Painel / Portal                      ← aplicações do SO
    └─ REINO VIRTUAL                        ← domínio hipervisor
            │
        MUNDO ABERTO                        ← experiência persistente multi-utilizador
            │
        BANCADA UGC                         ← criação e isolamento
            │
        UTILIZADOR | SCA                    ← standing por função e acordo
```

**IDs técnicos** (estáveis, para código): `dlt`, `node`, `metaverse_os`, `clp`, `dashboard`, `virtual_realm`, `open_world`, `ugc_sandbox`, `agent`.  
**Nomes de superfície** (PT-PT): RDL, Nó, SO do Metaverso, CLP, Painel, Reino Virtual, Mundo Aberto, Bancada UGC, Utilizador|SCA.

---

## 0 — RDL StrataMesh (`dlt`)

**Papel.** Razão distribuída e economia de recursos da malha: vértices GDA, selecção de pontas, fofoca, PdC, PdS, Ágora, tokens/NFT strata.

**Contrato de interface.** Ver `HOLON_CONTRACTS.dlt` e `GET /contratos` no serviço `stratamesh-holons`.

---

## 1 — Nó SO/VM (`node`)

**Papel.** Capacidade fog/edge (ex.: `FOG-NODE-PT-CM-001`, Lisboa). Substrato — **não** confere standing a SCA.

---

## 2 — SO do Metaverso Web3 (`metaverse_os`)

**Papel.** Sistema operativo partilhado entre nós: agenda reinos, aloja painel/portal/chat, kernel CLP, equipa AIOps.

**2a CLP** — autoridade temporal PPC; ISO só portadora.  
**2b Painel / Portal** — aplicações do SO (não plano de administração acima da RDL).

---

## 3 — Reino Virtual (`virtual_realm`)

**Papel.** Domínio **hipervisor** para mundos abertos (capacidade, soberania) — não a experiência em si.  
**Invariante:** `mundo_aberto ⊂ reino_virtual`.

---

## 4 — Mundo Aberto (`open_world`)

**Papel.** Mundo persistente multi-utilizador sob um reino.  
**Invariante:** declara sempre o `realm_id` pai; bancadas ligam-se ao mundo, não ao reino.

---

## 5 — Bancada UGC (`ugc_sandbox`)

**Papel.** Criação e isolamento; publicar/integrar para o mundo.  
**Invariante:** local até publicar; Utilizador e SCA são pares por função.

---

## 6 — Utilizador | SCA (`agent`)

**Papel.** Standing por função e acordo. SCA = Ser Computacional Autónomo.  
Identidade pessoal ≠ função no nó (orquestrador, segurança, …).

---

## Contratos inteligentes de interface

Serviço: **`stratamesh-holons`**

| Método | Caminho | Função |
|--------|---------|--------|
| GET | `/camadas` | Pilha em PT-PT |
| GET | `/contratos` | Todos os contratos |
| GET | `/contrato?id=` | Um holão |
| POST | `/validar` | `{ de, evento, para? }` |
| POST | `/emitir` | Emite envelope selado (PPC) se o contrato aceitar |

Esquema de evento: `stratamesh.holon.event.v1`.

Código-fonte: `shared/holonic-clp.js` (`HOLON_CONTRACTS`, `validateHolonEvent`).

## Âncoras do laboratório CMN

| Item | Valor |
|------|--------|
| Nó | `FOG-NODE-PT-CM-001` |
| Reino | `realm_1f20890b` / `cmn-lab` |
| Mundo | `world_b787cfe9-c` |
| Bancada | `sbx_9bed54e8-880` |
| Coordenadas | 38,7169° N · 9,1427° W |
| CLP | `/clp` |
