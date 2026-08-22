# Contrato de ontologia — STRATA NFT (1.0.0-object-economy)

Live: `GET https://stratamesh-token.stratamesh.workers.dev/ontology/nft`  
Worker: `stratamesh-token` **3.5.0-object-economy**  
D1: `site_content` keys `ontology-strata-nft`, `ontology-strata-nft-pt`, `ontology-strata-nft-en`

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
