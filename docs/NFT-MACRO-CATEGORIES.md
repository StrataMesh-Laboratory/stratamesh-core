# NFT macro-categories (UX + ontology)

Product UI (PT-PT / EN-GB mirror): templates are **broad entry points**, then personalisation steps. They do **not** exhaust what a STRATA NFT can be.

| Template (PT UI) | Meaning | Under the hood (eng) |
|------------------|---------|----------------------|
| Objecto / Mobiliário / Sala / Terreno | Stage / world objects | `kind` object/room/parcel |
| Contrato de execução | Runs: rest reserves, running spends reserved | SPA/APS `contract.kind=spa_aps` |
| Escritura · virtual / financeira / física | Deed of ownership into user account | `deed.asset_class` + custodianship |
| Lote de troca | Trade representation — **not** an NFT object | `kind=lot` |
| Outro | Open personalisation | `template=other` |

**Custodianship:** international legal agreement binds token validity to the StrataMesh user account; if the underlying sits in **cold storage**, that custody binds whether the token remains valid.

Code/docs: international English. No technical IDs in the create wizard.
