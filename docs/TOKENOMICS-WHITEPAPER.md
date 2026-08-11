# Strata tokenomics (whitepaper-aligned)

**Source:** *Stratamesh: Next-Generation Distributed Ledger Technology* — cyclical tokenomy / Proof of Contribution / Strata Agora.

## Non-negotiable rules

| Rule | Whitepaper |
|------|------------|
| **Who mints STRATA?** | **Only** fog/edge nodes that **contribute** compute & storage to the DLT |
| **How is mint sized?** | Proportionate to contribution (Proof of Contribution) |
| **How do non-minters get STRATA?** | **Only** via **Strata Agora** — P2P listing / auction exchange for **external** means of value (other crypto, stablecoins, fiat) |
| **No** | Free mint, faucet, admin airdrop of base STRATA, “buy from protocol treasury” as primary path |

## Demand loop

Users, DAOs, and ACBs **need** STRATA to:

1. Pay for network activity (txs, services)  
2. Tokenise assets (application NFTs / app tokens use STRATA as root)  
3. Fulfil **Proof of Subsistence** (ACBs)  
4. Mint or generate **application-specific** fungible/NFT tokens on platforms built on StrataMesh  

That demand meets **supply from contributors** on the Agora.

## Cycle

```
Node contributes (validate / pin / serve / fog work)
        ↓
   PoC mints STRATA  ──only mint path──
        ↓
Contributor lists STRATA on Strata Agora (auction / order)
        ↓
Buyer pays external value (BTC, stable, EUR, …)  [P2P]
        ↓
Buyer holds STRATA → spends on network / tokenisation / subsistence
```

## Lab implementation map

| Action | Allowed? | Service |
|--------|----------|---------|
| Mint STRATA for contribution proof | ✅ | `stratamesh-poc` `POST /mint` |
| Transfer STRATA between accounts | ✅ | balances / Agora settlement |
| List STRATA for external value | ✅ | `stratamesh-agora` listing / auction |
| Free / admin mint STRATA | ❌ | blocked |
| NFT UGC mint (asset tokenisation) | ✅ | `stratamesh-token` `/mint` — **not** base STRATA emission; may require holding STRATA later |
| App-token mint | 🔜 | consumes or is gated by STRATA per whitepaper |

## Lab status (updated 2026-08-11)

| Item | Status |
|------|--------|
| PoC-only STRATA mint | ✅ `stratamesh-poc` |
| Token worker cannot emit STRATA | ✅ 403 on `/mint-strata` |
| NFT tokenisation requires STRATA | ✅ HTTP 402 if balance < 1 (+ 0.1 fee) |
| Agora list with escrow | ✅ external quote (EUR/USDC/…) |
| Agora trade + payment record | ✅ `agora_payments` lab verification |
| Real EUR/BTC rails | ❌ still lab intent (`tx_hash` / pending) |
| Pre-policy genesis balances | tagged `lab_genesis_pre_policy` (treasury / domain); test dust zeroed |

**UNCLASSIFIED // FOG-NODE-PT-CM-001**

## Resource ≠ function
PoC prices **resource classes** (storage, compute, bandwidth, availability) only. Function/purpose of use does not define rate. Quality premiums/discounts apply within a resource class. See `docs/POC-RESOURCE-VS-FUNCTION.md`.
