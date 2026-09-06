# Contrato de ontologia — STRATA NFT (1.0.0-object-economy)

Live (lab): Fog ledger `GET /object/:id` and `GET /object/list` on the python hop (`:8790`) and custom domains (`fog.calhegasmorais.pt`, `mw.calhegasmorais.pt`).  
Not on workers.dev subdomains — custom domain and Fog hop only. STRATA economic mint stays reserved until `oracle_live`.

## Equação

```
STRATA NFT =
  NonFungibleObject
  + FractionalEconomicOwnership
  + Collateral
  + (Optional) StateMachine
  + Actions
  + (Optional) Bundle
```

```
Agent = User | SCA
Agent → owns/operates → NFT
```

## Primitivas live

| Primitiva | Endpoint | Regra |
|---|---|---|
| Ontologia | `GET /ontology/nft` | Contrato arquitectural |
| Bundle attach | `POST /nft/bundle/attach` | parent + child; sem ciclos |
| Bundle detach | `POST /nft/bundle/detach` | remove aresta |
| Bundle tree | `GET /nft/bundle/tree?id=` | árvore recursiva |
| Liquidação propor | `POST /nft/liquidate/propose` | titular com fracção |
| Liquidação votar | `POST /nft/liquidate/vote` | peso = strata_units; aye > 50% executa |
| Resgate individual | `POST /nft/redeem` | quando P_market < C |

## Separação holónica

- **TRD** — pólos `#mint` / `#0`
- **Fog** — `NODE_WALLET` tesouraria (não é conta de entidade)
- **Contas** — utilizador / SCA (Painel + Bancada)
- **STRATA** — fungível (lab_only vs transitável via PdC)
- **STRATA NFT** — objecto não fungível lastreado

Publicado 2026-08-22.

## SPA/APS (3.5.1-spa-aps)

SPA/APS = **STRATA NFT especializado** — template automatizado de acordo de serviço.

| Fase | Modo | Regra |
|---|---|---|
| Template | `static` | Mint com colateral ≥ 0.1 STRATA; dormante |
| Execução | `dynamic` | `POST /spa/execute` — burn acima do piso 0.1 |
| Término | `terminated` | `POST /spa/complete` **ou** colateral ≤ 0.1 → residual aos titulares |

- Compete funcionalmente com smart contracts ETH **sem importar ontologia EVM/ETH**
- Endpoints: `POST /spa/mint` · `/spa/execute` · `/spa/complete` · `GET /spa/list`

Optional lab metabolism ([`METABOLISM-ON-GRAPH.md`](./METABOLISM-ON-GRAPH.md)) may pace collateral burns until the SPA/CLP renewal; floor 0.1 STRATA stays reserved. Opt-in, not exclusive: `POST /spa/execute`, liquidate, and redeem remain valid without it.

## Ownership · collateral · Agora price (normative refinement 2026-09-06)

Three quantities — **never collapse**:

| Symbol | What | Where |
|--------|------|--------|
| **C** | Collateral fungible STRATA **inside** the NFT | Object / contrato tank |
| **ownership fraction** | Subject’s claim on that collateralised NFT | FractionalEconomicOwnership |
| **P_market** | Agora market price of that ownership portion, quoted in **fungible STRATA** | Agora listing — **not** equal to C × fraction |

### Rules

1. **Ownership of the NFT** means subjects own the **collateralised STRATA of that NFT** (fractions / `strata_units` weight) — Agent owns/operates NFT; NFT never owns Agent.
2. **Static** state (template / dormancy): collateral is **reserved** (floor e.g. 0.1 STRATA stays reserved; no execution burn).
3. **Dynamic** state (execution): the NFT **burns its own mechanisms** — collateral burns above the floor to pay execution (`POST /spa/execute` and kin). Metabolism may *pace* burns; it does not redefine C vs P_market.
4. **Terminated**: residual collateral to titulares; or complete path.
5. **Agora sale of ownership**: a subject may sell their ownership portion linked to that NFT on the Agora for **P_market in fungible STRATA**.  
   **P_market ≠ collateral value** that the ownership portion represents (that claim is on C; the trade clears at market).
6. **Redeem** (`POST /nft/redeem`) remains the path when **P_market < C** (individual exit vs collateral), distinct from an ordinary Agora ownership trade at P_market.
7. Fungible STRATA used to *pay* P_market comes from the buyer’s **dashboard Balance** — not by minting, not by emptying another NFT’s C unless a defined liquidate/redeem path says so.

### Diagram

```
Subject ──fraction──► STRATA NFT
                         │
                         ├─ C  collateral (static: reserve · dynamic: burn above floor)
                         ├─ optional StateMachine (static|dynamic|terminated)
                         └─ Actions / Bundle / Aspectos
Subject ──sells fraction on Agora──► P_market (fungible STRATA)
         P_market  confuses-not-with  (fraction · C)
```

