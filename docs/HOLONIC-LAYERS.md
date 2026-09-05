# Arquitectura holónica — StrataMesh (PT-PT)

**Laboratório (2026-09-02):** corte **v0.6.0-lab** · fase **Adversarial LAB P1** · malha **n=2** (`FOG-NODE-PT-CM-001` + `EDGE-GROK-CMN-001`). Não é n=1 kernel. O JSON público `/health` pode ainda mostrar `n=1` `origin=session` `mac_live=false` — bandeira de software de origem-sessão, não a topologia do lab. Lab only; sem mainnet.


## Como ler

A pilha é **aninhada de cima para baixo**. Cada camada **contém** a seguinte.

```
TRD StrataMesh                         ← livro-razão; CLP/PPC embutido no fluxo
  └ Nó (SO / VM)                       ← substrato do anfitrião
      └ SO do Metaverso Web3           ← SO partilhado entre nós
          └ Domínio Virtual            ← infraestrutura (hipervisor / domínio computacional)
              └ Mundo Aberto           ← ambiente persistente de acesso
                  └ Bancada CGU        ← espaço isolado de criação (+ Painel / Portal)
                      └ Utilizador | SCA
```

### Papel de componentes transversais

| Termo | Papel |
|--------|--------|
| **CLP / PPC** | Kernel temporal **embutido na TRD** — data e acompanha o fluxo em todas as camadas |
| **Painel / Portal** | Superfície de aplicações **na Bancada CGU** |

### Terminologia

| PT-PT | Definição |
|--------|-----------|
| **Domínio Virtual** | Camada de infraestrutura (hipervisor): organiza e isola capacidade para mundos |
| **Mundo Aberto** | Ambiente persistente multi-utilizador, hospedado num Domínio Virtual |
| **Bancada CGU** | Espaço isolado de criação de CGU (utilizadores e SCA); criações = NFT STRATA |
| **SO do Metaverso Web3** | Sistema operativo partilhado entre nós |

### Funções por camada

| Camada | Tipo | Função |
|--------|------|--------|
| **TRD** | Dados / protocolo | GDA, PdC, PdS, Ágora; selo temporal CLP/PPC |
| **Nó** | Substrato | Capacidade do anfitrião |
| **SO Metaverso** | Sistema operativo | Syscalls, barramento, orquestrador, AIOps |
| **Domínio Virtual** | Infraestrutura | Hipervisor: capacidade e soberania de mundos |
| **Mundo Aberto** | Experiência | Regras, habitantes, anexar bancadas |
| **Bancada CGU** | Criação | Rascunhos, publish/integrate, Painel, Portal, chat |
| **Utilizador \| SCA** | Agentes | Identidade, trabalho, PdS |

### IDs técnicos

`dlt` · `node` · `metaverse_os` · `virtual_realm` · `open_world` · `ugc_sandbox` · `agent`

### Serviço de núcleo

`stratamesh-holons` — `/so` · `/syscalls` · `/boot` · `/emitir` · `/eventos` · `/camadas`
