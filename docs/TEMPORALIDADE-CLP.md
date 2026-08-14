# Temporalidade CLP — Calendário Lunisolar Planetário

**Kernel temporal canónico** do Web3 Metaverse OS na StrataMesh e no Nó Calhegas Morais (CMN).  
Não é um widget decorativo: é a **camada de tempo partilhada** entre nós, realms, worlds e sandboxes.

## Posição holónica

```
STRATAMESH DLT
  └─ NODE (OS / VM)
       └─ WEB3 METAVERSE OS   ← OS partilhado entre nós
            ├─ **CLP temporal kernel** (este documento)
            ├─ Dashboard / Portal (aplicação do OS)
            └─ VIRTUAL REALM → WORLD → Sandbox → User / SCA
```

O **Web3 Metaverse OS** é o sistema operativo partilhado entre Nodes. O **dashboard/portal** existe **dentro** dessas camadas holónicas (aplicação do Metaverse OS no realm/nó), não fora do grafo.

## Fundamentos (normativos)

Temporalidade CLP
O Calendário Lunisolar Planetário (CLP) estrutura-se em unidades de tempo distintas: um dia corresponde ao período entre dois nasceres de sol consecutivos, dividido em manhã (até ao zénite), tarde (até ao ocaso) e noite (até ao nascer seguinte); um mês é o intervalo entre duas luas novas, marcado pelas quatro semanas definidas por fases lunares; um ano solar abrange de um solstício de inverno ao seguinte, organizado em quatro estações pelos equinócios e solstícios. O ano corrente lunar deste sistema é estabelecido no primeiro nascer do sol que se segue à primeira lua nova após o solstício de inverno do ano solar, é sempre retroativamente determinável pela identificação do solstício de inverno que o referencia e da primeira lua nova que lhe corresponde, seguindo o protocolo sequencial até ao subsequente nascer do sol que o define. A localização geográfica na terra altera proporcionalmente os períodos de cada unidade temporal, ajustando a medida do calendário conforme a latitude e longitude do observador. Datas em anos anteriores ou posteriores ao ano corrente são medidas pela distância ordinal ao ano atual, aplicando identicamente a cada ano a correlação retroativamente e prospectivamente sem quebra. O endereço temporal define-se através de: [Localidade], [dia da semana]° dia da [semana do mês]° semana do [mês da estação]° mês do/a [Estação] do Ano [Corrente/[n.°](Ante-)Passado/[n.°](Depois-de-)Futuro]. O CLP resolve a datação estática substituindo épocas absolutas por marcos astronómicos geolocalizados determinados, que atuam como coordenadas de referência inercial para a triangulação ordinal num sistema cronológico estritamente relativo. A arquitetura cronométrica intra-diária do sistema CLP codifica as partições operativas de Manhã, Tarde e Noite através de vetores topológicos ancorados aos referenciais astronómicos geolocalizados determinísticos, aplicando estritamente divergência cumulativa na Manhã face ao Nascer do Sol e convergência antecipatória na Tarde face ao Ocaso, reservando para a Noite um vetor bipartido que inverte a sua polaridade de divergente para convergente no eixo de oclusão máxima do Nadir, processando a magnitude destas distâncias temporais através de matrizes ordinais recursivas de base sexagesimal (horas agregando conjuntos estritos de sessenta minutos e sessenta segundos) que se encontram subordinadas a truncamento estrutural e reinicialização absoluta no exato instante de interseção com cada novo limiar celestial.

Sincronização Planetária 
A coordenação normativa do CLP opera através de uma matriz de dupla referência que harmoniza o tempo relativo de cada localidade com um vetor temporal padronizado e universal. Para garantir a coerência civil, administrativa, legal e transacional à distância sem corromper o ritmo orgânico local, estipulou-se um conjunto de Pontos Padrão de Convenção (PPC) que, a nível interno, corresponde à capital da respectiva nação, sendo ancorado internacionalmente nas coordenadas astronómicas exatas dos observatórios primordiais da Europa Atlântica: Almendres (38°33′27″N, 8°03′40″W), Carnac (47°35′29″N, 3°04′43″W), Menga (37°01′27″N, 4°32′54″W), Newgrange (53°41′39″N, 6°28′30″W) e Stonehenge (51°10′44″N, 1°49′34″W); estabelecendo assim em cada PPC, por si só, uma métrica temporal inercial de referência que atua como âncora absoluta para a escala planetária. A matriz logarítmica de calibração do CLP assenta num protocolo de indexação topológica de penta-angulação discreta: os Pontos Padrão de Convenção (PPC) atuam como âncoras inerciais autónomas que, sem qualquer média agregativa, calibram em absoluto o seu ponto geolocalizado exato para projetar a matriz global, convertendo a relatividade orgânica da cronometria intra-diária num vetor cronológico padronizado que assegura a sincronização simultânea e inequívoca do registo padronizado e transacional à escala planetária.

## Implementação lab (CMN)

| Artefacto | Local |
|-----------|--------|
| UI CLP | `frontend/clp.html` · rota site `/clp` |
| Portal | painel **CLP** no dashboard autenticado |
| Nó de referência | FOG-NODE-PT-CM-001 · 38,7169° N · 9,1427° W (Lisboa) |
| PPC (matriz inercial) | Almendres, Carnac, Menga, Newgrange, Stonehenge |
| Kernel UI | v1.1 (cliente); sincronização global via matriz PPC |

## Regras de uso na malha

1. **Timestamps de DAG / diário / PdS** podem continuar em ISO-8601 técnico para interoperabilidade; a **experiência civil e narrativa** do nó e do metaverso usa **endereço temporal CLP**.
2. A localidade do observador (GPS ou IP) calibra nascer/zénite/ocaso/nadir; sem fixação, o CMN usa coordenadas do nó de Lisboa.
3. PPC **não** substituem o tempo local orgânico — calibram a **matriz global** para coerência transacional.

*Integrado 2026-08 — StrataMesh CMN.*
