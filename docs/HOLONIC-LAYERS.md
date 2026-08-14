# Arquitectura holónica — StrataMesh (PT-PT)

Cada **camada** é um holão. O que **não** é camada:

- **CLP / PPC** — kernel temporal **embutido na RDL** e selado em todo o fluxo (`ppcCompact` em cada holão). Não aparece na pilha como degrau.
- **Painel / Portal** — superfície de aplicações **dentro da Bancada UGC**, não acima do SO nem camada paralela ao Metaverso.

```
RDL STRATAMESH                    ← substrato + kernel temporal CLP/PPC (embutido)
    │
NÓ (SO / VM)                      ← capacidade do anfitrião
    │
SO DO METAVERSO WEB3              ← SO partilhado (orquestrador, AIOps, syscalls, barramento)
    │
REINO VIRTUAL                     ← hipervisor
    │
MUNDO ABERTO                      ← experiência persistente
    │
BANCADA UGC                       ← criação + isolamento + **Painel/Portal**
    │
UTILIZADOR | SCA                  ← standing por função e acordo
```

**IDs técnicos:** `dlt` · `node` · `metaverse_os` · `virtual_realm` · `open_world` · `ugc_sandbox` · `agent`

## Funções por camada

| Camada | Função específica |
|--------|-------------------|
| **RDL** | GDA, PdC, PdS, Ágora, fofoca; **selo temporal CLP/PPC** em cargas e eventos |
| **Nó** | Capacidade, APS, pulso; substrato ≠ standing |
| **SO Metaverso** | Syscalls, barramento, orquestrador, AIOps |
| **Reino Virtual** | Capacidade e soberania de mundos (hipervisor) |
| **Mundo Aberto** | Regras, habitantes, anexar bancadas |
| **Bancada UGC** | Rascunhos, publish/integrate, **Painel, Portal, chat** |
| **Utilizador \| SCA** | Identidade, trabalho, PdS, escolha NFT |

## Kernel temporal (não-camada)

Autoridade civil: **PPC**. ISO-8601 só portadora.  
API de selo: `GET /ppc` no orquestrador (exposição do kernel da RDL).  
Todo evento do barramento e todo vértice GDA preferem `temporal` com o holão escritor.

## Painel (não-camada)

Syscall `abrir_painel` → superfície SPA **atribuída ao holão `ugc_sandbox`**.  
Contrato da bancada emite `ui.sessao` / `ui.chat`.

## Serviço

`stratamesh-holons` — `/so` · `/syscalls` · `/syscall` · `/boot` · `/emitir` · `/eventos`
