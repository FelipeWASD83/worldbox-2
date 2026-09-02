# ROTEIRO — worldbox-2

O que o Felipe pediu e ainda não está pronto, e o que já foi feito em cada
rodada. Serve para nenhum pedido se perder entre uma conversa e outra.

Quem mexe aqui: risque para **Feito** só quando estiver rodando e verificado
(`npm test`, `npm run sim`, `npm run testar-app`), não quando o código compilar.

---

## Fila — o que vem por aí

### O update de política, em fases

Aprovado em 02/09/2026, com todas as sugestões aceitas. **Requisito que vale
para as quatro fases: o jogador controla tudo.** Cada mecanismo que a simulação
ganhar precisa vir com a alavanca correspondente na mão dele — poder de causar
rebelião onde clica, de pôr dois reinos em guerra ou em paz, de plantar ódio, e
de inspecionar um reino para mexer nos valores dele.

- **Fase 0 — correções.** Feita.
- **Fase 1 — pessoas com bolso, família e cargo.** Feita.
- **Fase 2 — quem conhece quem, e por que brigam.** Feita.
- **Fase 3 — cultura, clãs e rebelião.** Feita.
- **Fase 4 — tecnologia e eras.** Feita. Com ela o update de política está
  fechado.

### 1. Alianças ainda são raras
A rebelião resolveu a causa estrutural — agora existem reinos vizinhos da mesma
espécie —, e o atrito de fronteira passou a pesar menos entre parentes. Em
quarenta mil ticks o mundo fecha de zero a duas alianças, contra zero antes. É
pouco, mas o mecanismo está vivo e o número sobe com partida longa. Se for para
mexer, é em `BAL.limiarAlianca` e no `parentescoNaFronteira`, não na mecânica.

### 2. Território: a parte que falta
A marcação visual está feita (blocos de 6×6 na cor do reino, em qualquer
zoom). O que ainda não existe é a **disputa** ser legível: ver uma fronteira
avançar sobre a outra, um reino perder chão, a pressão que o limite de tamanho
da vila cria. Isso encosta no update de política.

### 3. O que ainda não faz nada
Sobraram **banco** e **poço**: os dois estão de pé no mapa, custam material e
não têm efeito mecânico. Prefeitura, biblioteca, templo e taverna deixaram de
estar nessa lista — viraram a fonte de conhecimento do reino na fase 4. Falta
também o sistema de **profissões**, que estava no mesmo balaio e não entrou.

---

## Feito

### v0.13 — o painel de um deus
As ferramentas do jogador saíram de 37 para **188**, em oito abas.

- **Cinco famílias saem prontas dos registros** (`poderesDerivados.ts`), sem
  código escrito por ferramenta: 25 pincéis de bioma, 15 plantios de recurso,
  22 obras (o jogador passou a poder **construir**, o que não existia), 19 dons
  de traço e 20 revelações de tecnologia.
- **Cinquenta e uma escritas à mão**, entre elas: nivelar, erodir, ilha,
  depressão, umedecer, ressecar, aquecer, resfriar e estrada no terreno; chuva,
  nevasca, nuvem, abrir o céu, virar o vento, apagar, desmatar, capim, estiagem,
  cardume, revoada, matilha e rebanho na natureza; envelhecer, rejuvenescer,
  saciar, esfomear, enfurecer, acalmar, fecundar, estancar e espantar na vida;
  demolir e arruinar nas obras; chuva de meteoros, abismo, era do gelo,
  desertificar, queimada, pestilência, dizimar, esvaziar celeiros, arrasar vila,
  apagar reino e maldição na destruição; encher o cofre, confiscar, coroar,
  desanimar, expandir e retrair fronteira, fundar clã, unir, romper alianças,
  guerra de todos e povoar nos reinos; esquecer, sabedoria e ignorância no saber.
- **Oito abas** (terreno, biomas, natureza, vida, obras, destruição, reinos,
  saber), montadas a partir de `CATEGORIAS` — não há mais uma segunda lista de
  abas em `main.ts`.
- **Teste 20**: todas as 188 são aplicadas em três pontos de um mundo vivo, e o
  teste confere que nada estoura, que o mundo continua andando, que ninguém saiu
  do mapa, que não sobrou tile órfão e que o resultado ainda salva.

### v0.12 — cada um é um
Sistema de genética, pedido depois de o update de política fechar.

- **Traços** (`src/dados/tracos.ts`): dezenove, em pares opostos — forte e
  franzino, ágil e lento, gordo e magro, robusto e doentio, sábio e tolo,
  ganancioso e generoso, destemido e covarde, belo e feio, fértil e estéril, mais
  o **imortal**, que é o único raro e o único que anula uma causa de morte em vez
  de mexer num número.
- **Eles fazem coisas.** Forte e ágil entram em combate e movimento; gordo come
  mais e anda menos; sábio rende conhecimento ao reino; ganancioso embolsa mais
  ouro e é o primeiro a se revoltar contra imposto; belo acha par antes; fértil
  volta a ter filho mais cedo; destemido não recua ferido.
- **Herança e mutação:** cada traço de cada pai passa com chance, muito maior
  quando os dois têm o mesmo — é o que faz uma família ter cara —, e há mutação
  por cima, sem a qual o mundo só perderia variedade.
- **Mestiçagem** entre povos cujo ódio mútuo está abaixo de
  `BAL.odioParaCruzar`. Com a tabela de hoje isso libera humano com elfo e
  humano com anão, e tranca elfo com anão e tudo que envolve orc — os quatro
  trancados existem no registro e dependem da mão do jogador ou de séculos de
  paz.
- **Seis povos mestiços gerados no carregamento**, com atributos, porte e cores
  interpolados dos pais, xenofobia reduzida (metade de fora de nascença) e ódio
  só a quem os dois lados odiavam.
- **A imigração passou a trazer gente de outro povo** de vez em quando, com as
  condições da diplomacia — reino conhecido, sem guerra, povo tolerado. Sem isso
  dois povos nunca moravam na mesma vila e mestiço nenhum nasceria.
- **Poder do jogador:** a ferramenta *Mutação*, que dá um traço sorteado a cada
  ser inteligente do círculo.
- **Crônica:** a estreia de cada povo mestiço e o nascimento de cada imortal.
- **Teste 19** com dezesseis conferências, da separação entre bicho e gente até
  a mestiçagem acontecendo sozinha num mundo rodando.

### v0.11 — a civilização começa no chão
Fase 4 do update de política, a última. Fecha o update.

- **Árvore de tecnologia** com dezenove descobertas em quatro eras
  (`src/dados/tecnologias.ts`). Todo povo nasce sabendo fazer fogo e lascar
  pedra, e o resto ele descobre gastando conhecimento acumulado.
- **Começo primitivo de verdade:** sem casa, sem lavoura, sem forja. A moradia
  da era tribal é a **fogueira**, e é em volta dela que nascem os primeiros
  filhos.
- **Os marcos ganharam função.** Biblioteca, prefeitura, templo e taverna são a
  fonte de conhecimento do reino — a biblioteca vale sozinha mais que cem
  habitantes. Era a pendência 3 desta lista.
- **A era deixou de ser enfeite:** era um número tirado de população e
  território que não decidia nada, e passou a ser a era da tecnologia mais
  avançada que o reino domina.
- **Material de obra**, a pedido: palha e barro, madeira, pedra e pedra
  lavrada. O reino constrói com o melhor que **sabe** trabalhar, e o material
  multiplica abrigo, moradia e resistência — quem só conhece madeira tem prédios
  de madeira e prédios piores. Fica gravado por tile em `grid.acabamento`, junto
  com o povo que ergueu, então uma vila mistura choça da fundação com cantaria
  de depois.
- **Variação de desenho por material e por povo.** O sprite de cada prédio é
  gerado sob demanda para a combinação (tipo, material, povo) — a combinação
  completa passaria de mil imagens e um mundo real usa umas trinta. Quando a
  arte de verdade chegar (ver `ARTE.md`), é este ponto que passa a carregar
  arquivo em vez de desenhar.
- **Equipamento travado por tecnologia:** sem metalurgia não há espada, por mais
  ferro que a vila tenha no celeiro.
- **Poder do jogador:** a ferramenta *Iluminar*, que ensina de graça a próxima
  descoberta aos reinos do círculo, e o botão *Revelar segredo* no painel de
  ordens, ao lado da era e da contagem de descobertas.
- **Teste 18** cobrindo o começo tribal, a ordem dos pré-requisitos, a fogueira,
  ninguém construir acima da própria tecnologia, o salto de palha para pedra
  quando a alvenaria é descoberta, a herança de tecnologia numa rebelião e a
  sobrevivência de tudo ao save.

### v0.10 — o reino se parte por dentro
Fase 3 do update de política.

- **Clãs de verdade.** `Mundo.clas` guarda objetos com quatro valores de 0 a 1
  (marcialidade, cobiça, obediência, fechamento) e cada pessoa carrega o número
  de um deles. Colônia e imigrante fundam clã próprio com chance
  `BAL.chanceDeClaNovo` — sem isso haveria um clã por povo e a fase inteira
  seria decorativa.
- **Os valores puxam comportamento**, não são rótulo: clã marcial manda mais
  gente para a guerra, clã ganancioso e pouco obediente sente muito mais o mesmo
  imposto.
- **Lealdade com maré.** `Criaturas.fidelidade` caminha devagar para um alvo
  calculado da vida real de cada um. Ser governado por gente de outro clã é o
  motor principal da queda.
- **Rebelião.** Vila com lealdade média abaixo de `BAL.lealdadeParaRebelar` se
  separa, arrasta as vizinhas igualmente descontentes, leva o território que
  domina, funda um reino do mesmo povo com cor herdada e nasce em guerra com o
  antigo — com rancor cheio dos dois lados.
- **Poder do jogador:** a ferramenta *Incitar revolta* na aba `reinos` e o botão
  *Incitar revolta* no painel de ordens, que mostra a lealdade média da vila ao
  lado.
- **Id de reino deixou de ser reaproveitado**, porque ele fica guardado em
  `grid.territorio` e em `criaturas.noticia`, onde não há como conferir se ainda
  é o mesmo reino. A chave de par de reinos da diplomacia passou de `a*1000+b`
  para deslocamento de 16 bits pelo mesmo motivo.
- **Testes novos** para as duas fases: névoa que começa fechada e bloqueia
  relação, guerra sempre com motivo escrito, clãs em quantidade, e a rebelião
  levando território, fundando reino do mesmo povo, nascendo em guerra e com rei
  vivo — tudo sobrevivendo ao save.
- **Correções que saíram da medição:** `empossarChefes` (vila e reino nascem com
  chefe em vez de esperar até 120 ticks), a coroa passando a ser resolvida antes
  dos governantes, o primeiro mercado subindo na fila de obras (sem ele, três de
  quatro sementes fechavam vinte mil ticks com zero negócios) e a imigração
  caindo de 0,16 para 0,11 — com a densidade de casas cortada pela metade a
  pedido, a imigração tinha virado o caminho principal de crescimento no lugar
  da casa.

### v0.9 — o mundo deixa de saber de si mesmo
Fase 2 do update de política, mais duas correções pedidas junto.

- **Território em blocos de 6×6** em vez de 16×16. `LADO_BLOCO` passou a ser
  separado de `LADO_PEDACO` — um é resolução de fronteira, o outro é tamanho de
  cache de desenho, e enquanto foram o mesmo número a divisa saía em degraus do
  tamanho de uma vila.
- **A vegetação segue a água.** Árvore e arbusto nascem e rebrotam concentrados
  perto de rio e de lago, com um ganho pequeno na beira-mar; minério não, que
  está enterrado desde antes de haver rio. Medido no mapa médio: 15% do chão com
  planta na margem contra 4% no interflúvio seco, com a cobertura **total** do
  mundo praticamente igual à de antes (10,9% contra 10,4%) — a mudança
  redistribui vegetação, não cria.
- **Névoa diplomática.** Reino nenhum começa sabendo dos outros. O conhecimento
  viaja dentro de uma pessoa (`Criaturas.noticia`) e morre com ela se ela não
  chegar em casa para contar.
- **Ódio entre povos com peso real** (`ODIO_POVOS`, montado da xenofobia de cada
  povo e das inimizades declaradas).
- **Casus belli**: guerra só com motivos somando acima do limiar, e o motivo
  mais pesado vai para a crônica.
- **Paz por desgaste**, com trégua obrigatória entre uma guerra e a seguinte e
  custo crescente para abrir um segundo front.
- **Comércio entre reinos que se conhecem** e não estão em guerra, em vez de só
  entre aliados. E quem vende deixou de precisar de mercado — só quem compra
  precisa, que é o que tirou o comércio do papel (de 0 para 24 negócios em vinte
  mil ticks).
- **Aliança militar arrasta os dois lados** para a guerra, e não só os amigos de
  quem declarou.
- **Quatro alavancas novas na mão do jogador**: as ferramentas de mapa
  *Revelação*, *Semear ódio* e *Trégua*, mais os botões *Revelar* e *Ódio* no
  painel de ordens, que agora também lista os reinos que aquele povo ainda não
  sabe que existem.

### v0.8 — a fronteira anda, e a vila deixa de ser um bloco de telhado
Correções pedidas antes da fase 2 do update de política.

- **Território cresce por fronteira, não por círculo.** A vila guarda uma fila
  dos tiles da borda (`Aldeia.franja`) e empurra dali para os vizinhos. A forma
  que sai é a que a geografia permite — uma língua que sobe o vale, uma faixa
  que acompanha a costa — em vez do disco de antes. E cresce bem mais rápido:
  26 tiles por passada de gestão.
- **Mapa político em blocos de 16×16.** Cada bloco pertence a quem tem mais
  tiles dentro dele, e a divisa é o contorno dos blocos, em qualquer zoom. A
  fronteira serrilhada tile a tile dizia mais sobre o algoritmo de expansão do
  que sobre política.
- **Nomes que mudam com a distância.** De longe, um rótulo por reino, com povo e
  população, no centro do que ele domina; de perto, o nome de cada vila. Antes
  eram sempre as vilas, e afastado isso virava um amontoado ilegível de nomes de
  povoado sobrepostos.
- **Muito menos densidade de casa.** A malha de lotes dizia dez tiles de passo e
  o mundo saía com cinco: as três posições de meio passo, que existiam para
  salvar lote recusado pelo **terreno**, eram tentadas também quando a recusa
  era por **já ter prédio ali**, e cada célula recebia quatro obras. Agora a
  célula vale uma obra. As casas ficaram espaçadas como na referência.
- **Mata, minério e fruta demoram bem mais para voltar.** Madeira e pedra a um
  quarto da velocidade anterior.
- Correções que apareceram medindo isto:
  - **Nuvem morria de velhice antes de sair da borda.** A vida era um número
    fixo de 900 a 2600 ticks e a nuvem anda devagar: ela se desfazia depois de
    uns quarenta tiles, sempre perto de onde entrou. Hoje a vida é calculada da
    travessia. E o vento passou a **girar** em vez de levar empurrão em cada
    eixo, que o prendia perto da direção em que já estava — por isso tudo
    entrava sempre pela mesma borda. Medido: 358 de 384 tiles atravessados.
  - **Celeiro que só servia quem estava colado nele.** Com a vila espalhada, o
    trabalhador morria de fome ao lado do próprio celeiro: 767 mortes de fome
    numa rodada. O alcance virou 7 tiles.
  - **Imigrante sem linhagem.** Metade da população não tinha família. Quem
    chega de fora agora entra numa família da vila (ou funda a sua).
  - **Aldeia morta deixando território para trás.** A limpeza varria um quadrado
    em volta da praça; território em forma livre não é quadrado, não é círculo e
    **nem sempre é contíguo**. Como `criarAldeia` reaproveita o id, a vila
    seguinte nascia dona de chão do outro lado do mapa que nunca conquistou. Hoje
    a limpeza varre o mapa inteiro — é evento raro e exatidão vale o custo.

### v0.7 — território que vale alguma coisa, e gente com nome
**Fase 0 — as três correções pedidas:**
- Obra **só dentro do próprio território**. Antes bastava ser terra de ninguém,
  e território não significava nada.
- Território muito maior (raio de 10 a 48 por nível, contra 7 a 23) e colônia
  bem mais tardia. O mapa saía com cinquenta povoados de duzentos tiles cada;
  agora são quinze a vinte com quinhentos a três mil. Território pequeno não
  gera expansão, gera confete.
- Menos densidade: sete tiles entre lotes, contra cinco.
- Efeito colateral que precisou de correção junto: com raio grande, a distância
  entre aldeias (30) deixou de bastar e as colônias nasciam **dentro** do
  território da mãe — vinte e quatro de quarenta e quatro vilas travadas no
  nível 1. Hoje são 36 tiles, e a colônia exige chão de ninguém.

**Fase 1 — as pessoas:**
- Cada criatura tem **riqueza, família, clã e fidelidade**. Trabalho entregue
  vira ouro no bolso de quem entregou.
- **Governante de vila: o mais rico dela**, reavaliado o tempo todo.
- **Rei: a casa real.** Enquanto sobrar alguém da linhagem, o trono é dela; se a
  casa se extingue, a coroa vai para a família mais rica do reino — e a troca de
  dinastia abala a lealdade de todo mundo. Medido: 39 coroações em 30 mil ticks,
  22 dentro da mesma casa e o resto por extinção.
- **Imposto**, com a taxa na mão do jogador (de "nenhum" a "brutal"): enche o
  cofre do reino e corrói a lealdade de quem paga.
- Inspetor mostra cargo, riqueza, família e lealdade; a crônica anuncia coroação
  e distingue sucessão de tomada de trono.

### v0.6 — o mar, o céu e a interface
- **Interface refeita no formato do WorldBox**: o mapa ocupa a tela inteira e
  tudo mora numa barra de baixo sempre visível, com abas (terreno, vida,
  destruição, reinos, inspetor, mundo, ajustes). O cabeçalho sumiu; o que estava
  nele virou a aba de ajustes. Clicar em algo no mapa abre a aba do inspetor
  sozinha, junto do painel de ordens da aldeia.
- **Oceano refeito**: cor sólida por bioma no lugar do chuvisco de tons, com
  ondas desenhadas em tiles espalhados. A variação por tile lia-se como fundo
  irregular e deixava o mar com cara de ruído.
- **Nuvens** atravessando o mundo com o vento, variando entre seca, chuva e neve.
  A chuva **apaga incêndio** e acelera a vegetação; a neve aparece onde faz frio.
  São recortadas ao tamanho do mundo, para não boiarem no vazio em volta dele.
- **Portos e barcos.** O porto é a maior obra do jogo, só nasce em praia ou lago
  (rio não), e o cais **avança sobre a água** — enquanto exigiu terra firme nos
  doze tiles, só duas de vinte vilas costeiras achavam onde erguê-lo. Pesqueiros
  saem, juntam peixe e voltam para descarregar; navios de combate patrulham e
  levam colonos para fundar vila do outro lado do mar.
- **Território marcado por fronteira**, e não só por mancha de cor. A caixa de
  seleção agora vale também no mapa de perto.
- **Armadura finalmente aparece**: como cor no tronco e no ombro, já que sprite
  não cabe num boneco de um tile. Arma e escudo passaram a aparecer a partir do
  zoom 5, não 8.
- Menos montanha: de 26,6% para 12,4% da terra firme.
- A câmera **reenquadra quando a janela muda de tamanho**, enquanto o jogador
  não tiver escolhido o próprio zoom. Antes, abrir numa janela pequena e
  maximizar deixava o mundo desenhado no tamanho velho, com um quarto da tela
  em preto em volta.

### v0.5 — o chão, o mundo gigante e a água
- Minério muito mais raro e **nada nasce em pico nevado nem em gelo marinho**.
- **Teto de ocupação do chão** por família (mata, fruta, pedra e metal): o mundo
  para de lotar com o tempo e mantém perto de dois terços de chão à vista,
  rodando quantas horas for.
- Praia larga em vez de um fio de areia.
- Dois tamanhos de mundo novos: **colossal** (2048×1152) e **planeta**
  (2800×1600), com teto de criaturas próprio para segurar a taxa de quadros.
- As criaturas entraram na **varredura de profundidade**: o bicho passa por trás
  da copa quando está atrás dela, em vez de aparecer por cima de tudo.
- O vulcão virou **um objeto com desenho próprio**, de um tile de chão, no lugar
  da cratera pintada em dezenas de tiles. Cospe bombas de lava, e a lava agora
  **esfria e vira rocha** em vez de se acumular até comer o continente.
- A lavoura se junta em volta do moinho, e o moinho novo nasce no meio das roças
  que a vila já tinha.
- Rios de verdade: nascentes, afluentes, rios que engrossam rio abaixo e lagos.
- **Escala refeita na proporção do WorldBox**: a casa é a régua, gente fica em
  um terço dela, nenhuma árvore passa do telhado, e o zoom de detalhe entra bem
  mais cedo — uma vila inteira cabe na tela em vez de duas casas.
- Os bichos **evitam a serra**: ela era 31% do chão e só 3% deles estavam lá.
- Menos fruta e menos minério no chão, e **menos montanha**: a serra caiu de
  26,6% para 12,4% da terra firme, quase dobrando o terreno aproveitável.
- Sprites refeitos: contorno e sombra em tudo, copa arredondada no lugar de
  blocos empilhados, telhado com beiral, chão com trama, tufos de capim,
  flores, cascalho na estrada e sulco arado na lavoura.
- **Rebentação animada** na beira d'água a partir do zoom 7, e costura dentada
  entre biomas para o chão não ser um quadriculado.

**Sobre construir com recurso:** já funciona desde a v0.2 e continua valendo —
casa custa 10 de madeira, mina 22 de madeira e 14 de pedra, e é o trabalhador
que traz o material da floresta e do veio. O que não existe é **mostrar isso ao
jogador**: nada na tela diz "esta vila está sem madeira". Entra junto do rework
de interface.

### v0.4 — fogo, casas, território e vulcões
- Fogo deixou de se alastrar como praga pelo mapa inteiro.
- Seis minérios, veios de 2×1, minério no mundo todo (mais na rocha).
- Casas entráveis com lotação: é dentro delas que nascem os filhos.
- Cada vila tem teto de território; encher o teto empurra o reino a colonizar.
- Prefeitura, banco, biblioteca, taverna, quartel e poço no mapa.

### v0.3 — proporção e urbanismo
- Objetos multi-tile ancorados pela base: árvore até 3×6, casa 3×4, moinho 3×6.
- Aldeias planejadas em lotes de uma malha, ligadas por estradas.

### v0.2 — do simulador para o jogo
- Recursos no chão, equipamento, construções, poderes, opções de mundo,
  distinção entre seres inteligentes e não inteligentes.

### v0.1 — a base
- Motor, terreno por semente, biomas, fauna, civilizações, save.

---

## Regras que não mudam

- **É aplicativo de desktop**, não site. `npm run web` existe só para depurar.
- Antes de dizer que algo está pronto: `npm run typecheck`, `npm test`,
  `npm run sim` e `npm run testar-app`.
- Todo número de ajuste mora em `src/sim/balanco.ts`.
- Deixar o servidor de desenvolvimento no ar ao terminar.
