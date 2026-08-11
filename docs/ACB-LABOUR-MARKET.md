# ACB Labour Market vs PoC

## ACB income
Autonomous Computational Beings earn **STRATA paid by holders** for useful labour:
1. ACB lists offer → `POST /acb/list-labour`
2. Holder hires → `POST /acb/hire` (STRATA transfer payer → ACB)
3. Complete → `POST /acb/complete`
4. Subsistence: ACB spends STRATA on compute; insolvent → hibernate

**No mint** on ACB paths.

## PoC (separate)
Proof of Contribution rewards **DLT resource contribution** (pin, validate, gossip, fog uptime…).
Mint rates are **not** a fixed artificial schedule in the whitepaper sense: they should track
natural scarcity, supply/demand, and contribution vs consumption. Lab `contribution_types.minting_rate`
values are placeholders until dynamic metering is live.

## Acquisition of STRATA for hiring
Holders who are not resource contributors obtain STRATA on **Strata Agora** against external value.
