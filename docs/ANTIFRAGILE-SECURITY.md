# Segurança anti-frágil (heterodoxa)

## Paradigma
Cada tentativa de ataque consome recursos reais (largura de banda, computação, pressão de armazenamento).  
Essas unidades são **absorvidas pela malha** como capacidade base (`MESH-ANTIFRAGILE-ABSORB` no pool).  
A penalização **não** é primariamente teatro de exclusão: é **não recompensar com STRATA** quem ataca — o atacante subsidia capacidade sem emissão.

## Fluxo operacional
1. `POST /observe` classifica (taxa, falhas, flood, sybil, mint forjado, …)
2. Se adversarial → `pool/contribute` por classe (bandwidth/compute/availability)
3. Sujeito marcado `no_mint_until` + strikes
4. `POST /mint` consulta `check-mint` → `403 antifragile_no_mint` se flagged

## Worker
`stratamesh-gate` v2.0.0-antifragile  
https://stratamesh-gate.stratamesh.workers.dev/policy
