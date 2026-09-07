# Product UI locale (IP / geolocation)

| Audience | UI locale | Role |
|----------|-----------|------|
| **CPLP** (Community of Portuguese Language Countries) | **PT-PT** | Canonical product UI |
| **non-CPLP** | **EN-GB** | Mirrored translation |

Selection: **IP + geolocation** (not browser `Accept-Language` as primary).

Coding / APIs / engineering docs: **international English** (access), independent of UI locale.

Aspects / contracts are ordinary words in both locales (PT: aspectos / contratos).

Ordinary create-wizard words (not ontology jargon in chrome):

| PT-PT (CPLP) | EN-GB (non-CPLP) | Maps under the hood |
|--------------|------------------|---------------------|
| escritura · virtual / financeira / física | ownership deed · virtual / financial / physical | `ownership_title` + `asset_class` + custodianship |
| contrato de execução | execution agreement | `spa_aps` |
| custódia / cofre (cold storage) | custody / cold storage | may bind token validity — never shown as `object_id` |

See [`NFT-MACRO-CATEGORIES.md`](./NFT-MACRO-CATEGORIES.md).

## Open World player pools

Same geo rule selects the Open World **language player pool** (and thus the mirrored **microhypervisor**): CPLP → `cplp` / `pt-PT` / `*-cplp-pt-pt`; non-CPLP → `international` / `en-GB` / `*-intl-en-gb`. Same macrohypervisor / land-bundle. Implementation: `src/olissippo_player_pools.py`. Doctrine: [`OPEN-WORLD-HYPERVISORS.md`](./OPEN-WORLD-HYPERVISORS.md).

