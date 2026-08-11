# PoC refined endogenous market

Nothing and no one sets a mint rate.

## Price path
Demand mass \(D\) (consumed resource units) and supply mass \(C\) (contributed units):

\[
\mathrm{amount}(\Delta u)=\begin{cases}
0 & D=0\\
D\cdot\frac{\Delta u}{\Delta u+1} & C=0\\
D\cdot\ln(1+\Delta u/C) & C>0
\end{cases}
\]

This is the integral of marginal scarcity \(D/C\) along the supply path — diminishing returns as contribution fills demand.

## Meter decay
Effective \(C,D\) decay with half-life **72h** so old glut/famine does not dominate forever (forgetting, not a rate schedule).

## Demand sources
- `POST /poc/consume` (explicit)
- Pin market matches → `ipfs_pin` consumption
- DAG lightweight / fog subsidy path → `validate` / `fog_uptime` consumption

## Not PoC
ACB labour pay is a **transfer** of existing STRATA. Agora is acquisition vs external value.
