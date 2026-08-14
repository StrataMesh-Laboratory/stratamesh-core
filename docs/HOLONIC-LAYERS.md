# Arquitectura holónica — StrataMesh (PT-PT)

## Como ler (importante)

A pilha é **aninhada de cima para baixo**. Cada camada **contém** a seguinte.  
**Não** são sinónimos, **não** estão ao mesmo nível, **não** são “sítios” intercambiáveis.

```
RDL StrataMesh                         ← livro-razão; CLP/PPC embutido (não é experiência)
  └ Nó (SO / VM)                       ← substrato do anfitrião
      └ SO do Metaverso Web3           ← SO partilhado entre nós
          └ Domínio Virtual              ← INFRAESTRUTURA (hipervisor / domínio computacional)
              └ Mundo Aberto           ← mundo persistente (aqui o utilizador “entra”)
                  └ Bancada UGC        ← SANDBOX de criação (+ Painel / Portal)
                      └ Utilizador | SCA
```

### O que *não* é camada

| Termo | Papel real |
|--------|------------|
| **CLP / PPC** | Kernel temporal **embutido na RDL** — atravessa o fluxo; não é degrau da pilha |
| **Painel / Portal** | Aplicação **dentro da Bancada UGC** — não fica “acima” do SO nem ao lado do Metaverso |

### Terminologia que costuma confundir

| PT-PT | Significado correcto | Evitar |
|--------|----------------------|--------|
| **Domínio Virtual** | Camada de **infraestrutura** (hipervisor / domínio computacional) que organiza capacidade para mundos. | «Reino», «Kingdom», ou tratar como lugar visitável |
| **Mundo Aberto** | Mundo persistente multi-utilizador **dentro** de um reino | Confundir com o próprio reino |
| **Bancada UGC** | **Sandbox** isolado de criação de conteúdo | “Workbench” / oficina como metáfora principal |
| **SO do Metaverso Web3** | Sistema operativo **partilhado entre nós** | Um “mundo” ou um “reino” |

### Funções por camada

| Camada | Tipo | Função |
|--------|------|--------|
| **RDL** | Dados / protocolo | GDA, PdC, PdS, Ágora; selo temporal CLP/PPC |
| **Nó** | Substrato | Capacidade do anfitrião; substrato ≠ standing |
| **SO Metaverso** | Sistema operativo | Syscalls, barramento, orquestrador, AIOps |
| **Domínio Virtual** | **Infraestrutura** | Hipervisor: capacidade e soberania de mundos |
| **Mundo Aberto** | Experiência | Regras, habitantes, anexar bancadas |
| **Bancada UGC** | Criação (sandbox) | Rascunhos, publish/integrate, **Painel, Portal, chat** |
| **Utilizador \| SCA** | Agentes | Identidade, trabalho, PdS |

### IDs técnicos

`dlt` · `node` · `metaverse_os` · `virtual_realm` · `open_world` · `ugc_sandbox` · `agent`

### Serviço de núcleo

`stratamesh-holons` — `/so` · `/syscalls` · `/boot` · `/emitir` · `/eventos` · `/camadas`
