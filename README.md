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

A tela é o mundo. Em volta dele:

- **Em cima:** o ano, a população, quantos reinos existem e quantas guerras
  estão acontecendo. E os botões de velocidade — de pausado até 8×.
- **À esquerda:** as 32 ferramentas, em quatro grupos. A primeira (a mira) é o
  modo de olhar: clique numa criatura, numa aldeia ou num pedaço de chão para
  ver os detalhes.
- **À direita:** o inspetor do que você selecionou, o **painel de ordens**
  quando é uma aldeia, a lista do que está vivo, e a **crônica** — a história do
  mundo se escrevendo: reinos fundados, guerras, alianças, aldeias que viraram
  cidade e aldeias que viraram ruína.
- **Embaixo:** o mapa inteiro em miniatura. Clique nele para pular para lá.

**Aproxime o mapa.** De longe cada criatura é um ponto colorido; de perto o mundo
ganha escala: as árvores são altas, as casas têm telhado, as vilas têm ruas
ligando as construções, e dá para ver a espada e o escudo de cada soldado.

Cada coisa tem o tamanho que faz sentido — uma árvore da selva chega a seis
tiles de altura, uma casa a quatro, um orc a três, um coelho cabe em um.

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
