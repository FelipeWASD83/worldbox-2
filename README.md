# WorldBox 2

Um mundo em cima da mesa: você gera um planeta, solta bichos e civilizações nele
e assiste — ou interfere. Inspirado no WorldBox, feito do zero.

É um **aplicativo de desktop**, não um site. Abre em janela própria.

---

## Como rodar

Primeira vez (instala as dependências):

```bash
npm install
```

Depois, para jogar:

```bash
npm run app
```

Enquanto estou mexendo no código, uso este aqui — ele recarrega sozinho a cada
alteração:

```bash
npm run dev
```

Para gerar um instalador `.exe` que você pode levar para outro PC:

```bash
npm run dist
```

O instalador sai na pasta `release/`.

---

## Como se joga

**A tela inteira é o mundo.** Tudo o que é interface fica numa barra embaixo,
sempre visível, dividida em abas:

- **terreno · vida · destruição · reinos** — as 32 ferramentas, agrupadas. A
  primeira (a mira) é o modo de olhar, sem mexer em nada.
- **inspetor** — abre sozinha quando você clica em alguma coisa no mapa, e mostra
  os detalhes dela. Se for uma aldeia (ou um morador), o **painel de ordens**
  aparece ao lado: foco do trabalho, fundar colônia, socorrer, diplomacia.
- **mundo** — a lista do que está vivo e a **crônica**: a história se escrevendo
  sozinha, com reinos fundados, guerras, alianças, aldeias que viraram cidade e
  aldeias que viraram ruína.
- **ajustes** — mostrar territórios e nomes, tamanho do pincel, e os botões de
  novo mundo, salvar e carregar.

À esquerda da barra fica o **minimapa** — clique nele para pular para lá. Embaixo
de tudo, a velocidade (de pausado a 8×) e os números do mundo: ano, população,
reinos e guerras.

**O zoom troca o que a tela conta.** De longe é um mapa político: as fronteiras
saem em blocos na cor de cada reino e cada reino aparece uma vez, com o povo e a
população, no meio do que domina. Ao aproximar, os reinos dão lugar aos nomes das
vilas — é quando a pergunta deixa de ser "de quem é esta parte do mundo" e passa
a ser "que lugar é este".

**Aproxime o mapa.** De longe cada criatura é um ponto colorido; de perto o mundo
ganha escala: as casas têm telhado e beiral, as vilas têm ruas ligando as
construções, o campo tem capim e flor, e dá para ver a arma, o escudo e a
armadura de cada soldado.

A régua da escala é a **casa**: uma pessoa tem perto de um terço da altura dela,
e nenhuma árvore passa do telhado.

### Controles

| O que fazer | Como |
|---|---|
| Mover o mapa | arrastar com o **botão direito**, ou W A S D / setas |
| Aproximar e afastar | **roda do mouse** |
| Usar a ferramenta | **botão esquerdo** (segure para pintar) |
| Pausar | **espaço** |
| Velocidade | teclas **1 2 3 4** |
| Largar a seleção | **Esc** |

---

## O que existe no mundo

### Bichos e gente

O mundo tem duas classes de ser vivo, e elas vivem de formas diferentes:

**Os irracionais** — coelho, ovelha, veado, javali, pinguim, lobo, raposa, urso,
tigre, cobra, peixe, tubarão e pássaro. Têm um objetivo só: continuar vivos e
deixar filhotes. Comem fruta dos arbustos ou caçam, fogem de quem os come e
procuram par da própria espécie. Não constroem nada e não têm bandeira.

**Os inteligentes** — humanos, elfos, anões e orcs. Fazem tudo o que os bichos
fazem e mais: fundam aldeias, derrubam árvore, quebram pedra, cavam ferro e
ouro, constroem, fabricam equipamento, comerciam, guerreiam e fecham aliança.

**O céu tem tempo.** Nuvens atravessam o mundo levadas pelo vento. A maioria só
faz sombra; algumas trazem chuva — que **apaga incêndio** e faz o mato crescer
mais depressa — e, onde faz frio, a mesma nuvem vira neve. Um mundo pegando fogo
tem chance de se salvar sozinho quando a chuva chega.

**O mar tem gente nele.** Uma vila de beira-mar ergue um **porto** (só em praia
ou lago; rio é estreito demais) e a partir dele solta duas frotas:

- **pesqueiros**, que rodam o mar aberto juntando peixe e voltam quando o porão
  enche — é comida que não veio da lavoura;
- **navios de combate**, que patrulham a costa e, principalmente, **levam colonos
  para fundar vila do outro lado do mar**. Num arquipélago é isso que faz um
  povo sair da própria ilha.

**Os vulcões** não são enfeite: uma cratera em atividade cospe bombas de lava
para o alto, e onde elas caem o chão vira lava, a mata pega fogo e quem estava
perto se queima. No mar, a lava vira rocha nova e a ilha cresce.

**Os monstros** — dragão, aranha gigante e zumbi. Não nascem sozinhos: só
aparecem se você criar, ou, no caso do zumbi, se a praga se espalhar.

### O que tem no chão

**Água doce** — o mundo nasce com uma rede de drenagem inteira: nascentes no
alto, córregos de um tile que se juntam em afluentes, rios que engrossam rio
abaixo até desaguar no mar, e lagos onde a água encontra um vale sem saída.
Os rios largos vão dar em barcos mais para a frente. Quem mora na margem tem
terra mais fértil: o verde acompanha o curso mesmo no meio do seco.

**Mata** — árvore, árvore da selva, pinheiro, árvore do pântano e árvore seca,
cada uma no seu bioma e com o seu tamanho.
**Comida** — arbusto de frutas, palmeira e cacto.
**Pedra e metal** — pedregulho e veios de **ferro, carvão, cobre, estanho, ouro
e gemas**.

Só uma coisa por tile: onde tem árvore não tem minério, e vice-versa. A mata e
os arbustos voltam a crescer; minério não volta — quando acaba, acabou.

**Minério nasce no mundo inteiro**, e não só na serra: é mais farto onde a rocha
aflora (montanha, pico, terra rachada, vulcão) e cada metal tem os seus lugares
prediletos — cobre no deserto e na savana, carvão na taiga e no pântano, ouro
perto do rio e do vulcão. A única exceção é a neve: lá o chão está coberto e não
há o que garimpar.

Ferro e carvão só podem ser explorados por uma aldeia de nível 2, e ouro e gemas
só de nível 3. É o que faz uma civilização ter de crescer antes de virar
potência militar.

### A economia

Cada aldeia guarda comida, madeira, pedra, ferro, carvão e ouro, com um teto que
cresce conforme ela ergue celeiros. Os moradores saem para buscar exatamente o
que está faltando em casa.

Dezenove tipos de construção. As que já fazem efeito: casa (abriga e é onde
nascem os filhos), celeiro (guarda mais), fazenda (produz comida), **moinho de
vento** (rende mais comida e nasce cercado de lavoura), **serraria** (rende mais
madeira), **mina** (rende mais minério e é a única obra que entra na montanha),
**ferraria** (sem ela não se faz espada), **mercado** (compra e vende),
**templo** (mantém o ânimo), muralha, torre, castelo e ruína — que desmorona
sozinha com o tempo.

As que existem no mapa e ainda esperam a sua vez: **prefeitura, banco,
biblioteca, taverna, quartel e poço**. Custam material, aparecem na vila e
mudam o desenho dela; o que cada uma vai fazer entra no update de política e
civilizações.

As aldeias não espalham as obras ao acaso: cada construção vai para um lote de
uma malha ancorada na praça central, e uma **estrada** liga o lote ao centro. É
o que faz a vila ter quarteirões e ruas em vez de telhados soltos no mato. Toda
obra precisa de uma faixa livre em volta, e nenhuma sobe na montanha — só a
mina, que existe justamente para isso.

**Casa é para entrar.** Cada uma tem lotação, e um casal só tem filho depois de
entrar numa. Quem está dentro some do mapa e não pode ser caçado nem atacado —
mas os seus poderes alcançam lá dentro do mesmo jeito.

**A vila tem tamanho máximo.** Cada nível domina até um tanto de chão; quando
enche, o reino só cresce de um jeito — mandando colonos fundar outra vila. É por
isso que um império aparece no mapa como um punhado de povoados ligados, e não
como uma mancha só que engorda para sempre.

Quem tem mercado escoa o excedente e compra o que falta, pagando em ouro —
mas só de aldeias do próprio reino ou de reinos aliados.

### Equipamento

Porrete, lança, espada, arco e machado de guerra; escudo de madeira e de ferro;
armadura de couro, cota de malha e armadura de placas.

A aldeia fabrica com o que tem e entrega ao soldado o melhor que a forja dela
alcança. Arma soma no golpe, escudo e armadura descontam do golpe recebido, o
arco atira de sete tiles de distância e ferro pesado atrasa quem o veste. Uma
aldeia farta de comida e pobre de ferro manda gente de porrete contra espadas —
e perde.

---

## Suas ferramentas

**Terreno** — elevar, rebaixar, alagar, plantar campo, plantar floresta,
espalhar areia, erguer montanha, derramar lava, nevar, encharcar em pântano,
plantar árvore, plantar frutas, semear veio de ferro, semear veio de ouro e
limpar tudo de uma área.

**Vida** — criar qualquer criatura da lista, curar, fundar um reino novo,
fertilizar a terra, **domesticar** um rebanho (o reino mais próximo passa a
não caçá-lo) e **converter** moradores para outra bandeira.

**Destruição** — relâmpago, fogo, meteoro, terremoto, praga, maremoto, tornado
e o extintor, que apaga a vida sem tocar no terreno. Fogo se alastra pelo que é
inflamável e se apaga quando não há mais o que queimar — lava e cinza não
reacendem.

**Reinos** — fartura (enche os celeiros da aldeia) e inspirar (levanta o ânimo e
cura os feridos).

### Mandando nas civilizações

Clique numa aldeia e o painel de ordens aparece:

- **Foco do trabalho** — equilíbrio, lavoura, exército ou construção. Muda o que
  os moradores vão buscar, o que a aldeia constrói e quanta gente vira soldado.
- **Fundar colônia** — manda parte dos moradores abrir uma aldeia nova agora.
- **Socorrer** — envia metade do estoque para uma aldeia do reino que está
  passando fome.
- **Diplomacia** — declarar guerra, assinar a paz, firmar ou romper aliança com
  cada reino vizinho. Declarar guerra a alguém arrasta os aliados dele junto.

---

### O que um reino sabe

Nenhum reino começa sabendo que os outros existem. Para dois povos se
descobrirem, alguém de um tem de esbarrar no outro — ou pisar em terra que já
tem dono — e **voltar vivo** para a própria vila para contar. Quem morre no
caminho leva a notícia junto.

Enquanto dois reinos não se conhecem, não há relação, comércio nem guerra entre
eles, por mais que os territórios encostem. Abra o inspetor de uma vila para ver
quantos reinos o dela conhece, e o painel de ordens para ver a lista dos que
ainda estão na névoa.

Quando eles finalmente brigam, é por um motivo, e a crônica escreve qual:
fronteira disputada, ódio antigo entre os povos, vingança pelo sangue derramado,
fome, terra de sobra do lado de lá. Guerra acaba por cansaço, não por o motivo
passar — e depois de uma paz existe um período de trégua em que aquela guerra não
recomeça.

Se você quiser interferir: as ferramentas **Revelação**, **Semear ódio** e
**Trégua**, na aba *reinos*, agem em todos os reinos que tiverem gente ou terra
dentro do círculo. Para escolher a dedo os dois lados, use os botões *Revelar*,
*Ódio*, *Guerra*, *Paz* e *Aliar* no painel de ordens de uma vila.

### Cada um é um

Duas pessoas do mesmo povo não são mais iguais. Cada uma pode nascer com
**traços** — forte, franzino, ágil, lento, gordo, magro, robusto, doentio,
sábio, tolo, ganancioso, generoso, destemido, covarde, belo, feio, fértil,
estéril — e eles não são enfeite de ficha: o forte bate mais e aguenta mais, o
gordo come mais e anda menos, o sábio faz o reino inteiro descobrir mais rápido,
o ganancioso junta ouro e é o primeiro a se revoltar contra um imposto, o belo
acha par antes de todo mundo.

Traço passa de pai para filho, e passa muito mais fácil quando os dois têm o
mesmo — é assim que uma família fica com cara própria. E de vez em quando nasce
alguém com um traço que ninguém na linhagem tinha.

Um deles é raro a ponto de virar notícia na crônica: o **imortal**. A velhice
não o alcança. Ele ainda morre de fome, de fogo ou de espada — mas, se ninguém o
matar, ele vai estar lá daqui a mil anos.

Clique numa pessoa para ver os traços dela; passe o mouse na linha para ver o
que cada um faz. A ferramenta **Mutação**, na aba *vida*, dá um traço sorteado a
quem estiver no círculo.

### Sangue misturado

Povos que não se detestam **têm filhos entre si**. Se um humano e uma elfa
moram na mesma vila, nasce um meio-elfo — com vida, porte e cor no meio dos
dois, e menos preconceito que qualquer um dos lados.

Isso depende inteiramente da política. Dois povos só passam a morar na mesma
vila quando os reinos deles se conhecem, não estão em guerra e se toleram; e o
que decide se eles se toleram é o mesmo ódio entre espécies que decide se vão à
guerra. Na prática: humano com elfo e humano com anão acontece sozinho; elfo com
anão e qualquer coisa com orc, não — a não ser que você passe séculos empurrando
esses povos para a paz, ou use a ferramenta **Revelação** e o comércio para
aproximá-los.

Meio-elfo, meio-anão, meio-orc e os outros três estão todos no jogo. Clique num
deles para ver de que dois povos ele veio.

### Do fogo ao aço

Uma civilização **não começa sabendo nada**. No primeiro minuto de mundo ela
sabe fazer fogo e lascar pedra, e mais nada: dorme em volta de fogueiras, come o
que acha e bate com porrete. Casa, lavoura, celeiro, moinho, forja, navegação,
moeda e aço são coisas que ela **descobre**, uma de cada vez, numa ordem que
depende do que já sabe.

O que faz um povo descobrir mais rápido é o que ele constrói. Biblioteca,
prefeitura, templo e taverna geram conhecimento — e a biblioteca sozinha vale
mais que cem habitantes. Um império que ergue biblioteca alcança o aço enquanto
o vizinho que só levantou muralha continua fervendo cerveja.

**Do que um povo constrói também depende do que ele sabe.** São quatro
materiais, do pior para o melhor: palha e barro, madeira, pedra e pedra lavrada.
Quem só descobriu a carpintaria constrói de madeira, e prédios de madeira
abrigam menos gente e caem mais fácil que os de pedra. Como o material fica
gravado em cada construção na hora em que ela é erguida, uma cidade velha mistura
as duas coisas: a choça da fundação continua de barro ao lado do castelo de
cantaria. Clique num prédio para ver de que ele é feito e por qual povo.

Se quiser empurrar: a ferramenta **Iluminar**, na aba *reinos*, entrega de graça
a próxima descoberta a todos os reinos do círculo. Para escolher um reino a
dedo, use *Revelar segredo* no painel de ordens de uma vila dele.

### Clãs, lealdade e revolta

Todo mundo pertence a um clã, e cada clã tem valores próprios: o quanto gosta de
guerra, o quanto gosta de dinheiro, o quanto aceita ser mandado e o quanto
estranha quem é de fora. Clique numa pessoa para ver os do clã dela.

Isso importa porque o governante de uma vila é sempre o morador mais rico —
e quando o mais rico é de outro clã, o resto da vila não gosta. A lealdade cai.
Imposto pesado derruba mais rápido ainda, e quem é de um clã cobiçoso e pouco
obediente sente cada moeda.

**Vila com a lealdade no chão se separa do reino.** Leva o território que
domina, arrasta as vizinhas que também estavam descontentes, funda um reino do
mesmo povo — com uma variação da cor antiga, para dar para ver no mapa quem
saiu de quem — e já nasce em guerra com quem ela deixou.

Você tem duas formas de provocar isso: a ferramenta **Incitar revolta**, na aba
*reinos*, que derruba a lealdade de todo mundo no círculo e faz as vilas dali
levantarem bandeira na hora; e, mais devagar e mais divertido, subir o imposto
de um reino para **brutal** no painel de ordens e esperar. Um império de onze
vilas se partiu em três desse jeito.

O inspetor de uma vila mostra a lealdade média dela. Abaixo de 26 é questão de
tempo.

### As oito abas de ferramentas

São 188 ferramentas, divididas em abas na barra de baixo. Passe o mouse em
qualquer botão para ver o que ela faz.

- **terreno** — levantar, afundar, nivelar, erodir, criar ilha ou abismo, mexer
  em umidade e temperatura, abrir e fechar estrada.
- **biomas** — um pincel para cada um dos 25 biomas do jogo. Ele não pinta só a
  cor: ajusta o relevo para o bioma poder existir ali.
- **natureza** — um plantio para cada árvore, arbusto e veio de minério, mais
  chuva, nevasca, nuvem, abrir o céu, virar o vento, apagar incêndio, desmatar,
  encher de capim, secar tudo e soltar cardume, revoada, matilha ou rebanho.
- **vida** — criar criatura, curar, saciar, esfomear, envelhecer, rejuvenescer,
  enfurecer, acalmar, fecundar, espantar, domesticar, converter, mutar — e um
  botão para **cada traço**, de forte a imortal.
- **obras** — uma ferramenta para cada construção. A vila mais próxima ergue
  aquilo onde você clicar, de graça, sem esperar a fila dela. Mais demolir e
  arruinar.
- **destruição** — raio, fogo, meteoro, chuva de meteoros, terremoto, maremoto,
  tornado, abismo, era do gelo, desertificação, queimada, praga, pestilência,
  dizimar, esvaziar celeiros, arrasar uma vila e apagar um reino inteiro.
- **reinos** — fartura, inspirar, encher o cofre, confiscar, coroar, desanimar,
  revelar, semear ódio, trégua, incitar revolta, expandir e retrair fronteira,
  fundar clã, unir, romper alianças, guerra de todos e povoar.
- **saber** — iluminar, e uma revelação para **cada tecnologia**: ensinar o aço a
  uma tribo da idade da pedra ensina a metalurgia e a alvenaria pelo caminho.
  Mais esquecer, sabedoria e ignorância.

## Criando um mundo

Em **Novo mundo** você regula semente, tamanho do mapa, quanto do mapa é terra,
montanhas, formato (de um continente só a um mar de ilhotas), clima (de glacial
a escaldante), chuva, riqueza mineral, quantidade de bichos, quantos reinos
começam no mapa, e se espécies raras recebem reforço de fora — desligue para ver
extinções definitivas.

São oito tamanhos, de **pequeno** (256×144) a **planeta** (2800×1600 — quatro
milhões e meio de tiles). Cada um tem o seu **teto de criaturas vivas** — de 9
mil a 130 mil — e é ele que segura o jogo fluido num mapa gigante: quando o
mundo enche, param os nascimentos, não a taxa de quadros.

O controle de **riqueza mineral** regula quanto metal o chão tem, e o de **água**
regula a chuva que alimenta os rios — mais chuva não põe mais riscos azuis no
mapa, engrossa os que já existem e faz nascer afluente onde antes era encosta.

Por mais tempo que o mundo rode, ele **não lota**: cada família do que nasce do
chão (mata, fruta, pedra e metal) tem um teto de quanto pode ocupar, e perto de
dois terços do terreno continuam livres.

---

## Salvar

O botão **Salvar** grava o mundo inteiro. Os arquivos ficam na sua pasta de
usuário, fora do projeto, e o caminho aparece na própria janela de carregar.

---

## Conferindo que está tudo funcionando

```bash
npm test          # testes do motor, sem abrir janela
npm run sim       # roda milhares de anos e relata população, economia, guerras
npm run diag      # de que cada espécie morreu e quem matou quem
npm run testar-app  # abre o aplicativo, exercita os painéis e fecha
npm run typecheck
```

---

## Detalhes técnicos

TypeScript, canvas 2D, Electron. Nenhuma dependência de terceiros em tempo de
execução.

A simulação anda a 20 passos por segundo em velocidade normal e roda a 144 fps
com o mapa aproximado e o chão desenhado tile a tile. Para entender como é
construída e onde mexer, veja `CLAUDE.md`.
