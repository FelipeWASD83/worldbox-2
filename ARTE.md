# ARTE — o que desenhar, em que tamanho, e o que falta no código

Lista de sprites do worldbox-2 para trabalho manual no Aseprite.

---

## Antes de tudo: hoje o jogo não carrega imagem nenhuma

**Todo desenho do jogo é feito por código, no boot, num canvas.** Não existe
`assets/`, não existe carregamento de PNG, não existe atlas. `src/render/sprites.ts`
desenha as criaturas a partir de moldes de texto de 16×16; `src/render/spritesMapa.ts`
desenha árvore, pedra e construção com retângulos e curvas.

Isso significa que **antes de a primeira arte entrar no jogo eu preciso construir
o carregador**: uma pasta de imagens, o pré-carregamento antes do primeiro quadro,
o encaixe por id (`arvore` → `arvore-1.png`), e um caminho de volta para o desenho
por código quando a imagem não existir — senão a primeira árvore desenhada à mão
apaga as outras catorze do mapa. É meio dia de trabalho, e vale a pena fazer
**antes** de você desenhar muita coisa, para você poder ver no jogo o que acabou
de fazer em vez de acumular arquivos no escuro.

Diga quando quiser que eu faça essa parte.

---

## As regras que valem para tudo

- **Um tile do mundo tem 16 pixels** (`PX_TILE`, em `src/render/sprites.ts`).
  Todo tamanho abaixo sai daí.
- **A âncora é a base, centralizada.** O objeto fica de pé no tile dele e o resto
  do desenho sobe e transborda por cima dos vizinhos. Desenhe com o pé do objeto
  encostado na borda de baixo da tela, no meio da largura.
- **Fundo transparente.** O contorno escuro que o jogo desenha hoje some quando a
  arte for sua — desenhe o contorno que você quiser dentro do próprio sprite.
- **Três variantes por tipo.** O jogo sorteia uma por tile (`VARIANTES = 3`). Sem
  isso uma mata inteira fica com cara de papel de parede. Se você fizer duas ou
  quatro eu ajusto o número.
- **Construção agora tem material e povo.** Desde a fase 4, cada prédio no mapa
  guarda de que é feito (palha e barro, madeira, pedra ou pedra lavrada) e qual
  povo o ergueu. Hoje o jogo resolve isso trocando a paleta do desenho
  procedural; quando a arte for sua, o nome do arquivo vai carregar as três
  coisas — algo como `casa-pedra-anao-1.png`. **Não precisa desenhar as
  dezesseis combinações de cada prédio.** O carregador vai cair para o material
  mais próximo que existir e, se não houver nada daquele povo, para a versão
  genérica. Comece por uma versão de cada prédio; material e povo entram depois,
  onde valerem a pena.
- **Só olhando para a direita.** Criatura virada para a esquerda é o espelho, feito
  em tempo de execução. Não desenhe as duas.
- **Sem animação por enquanto.** O jogo não tem quadro de animação em lugar nenhum.
  Se você quiser ciclo de andar, dá para fazer, mas é um trabalho à parte e a
  gente decide depois — comece pelo estático.
- **Os tamanhos abaixo são negociáveis.** Eles vêm do campo `sprite` das tabelas
  de dados (`src/dados/recursos.ts` e `src/dados/edificios.ts`), e eu mudo o número
  se você preferir desenhar num tamanho redondo. Só avise, porque mudar o tamanho
  muda a escala do objeto na tela, e a escala destas coisas foi calibrada contra
  os prints do WorldBox — árvore 25% maior é uma decisão, não um detalhe.

---

## 1. Mata e chão (`src/dados/recursos.ts`) — comece por aqui

É o que cobre o mapa inteiro. Uma árvore boa muda mais a cara do jogo que todo
o resto desta lista somado.

| id | o que é | tamanho hoje | em pixels | redondo |
|---|---|---|---|---|
| `arvore` | folhosa de floresta e planície | 2,4 × 3,4 tiles | **38 × 54** | 48 × 64 |
| `arvore_selva` | copa larga de selva e mangue | 2,6 × 3,4 | **42 × 54** | 48 × 64 |
| `pinheiro` | conífera de taiga, tundra e neve | 1,8 × 3,3 | **29 × 53** | 32 × 64 |
| `arvore_pantano` | tronco torto de pântano | 1,8 × 2,7 | **29 × 43** | 32 × 48 |
| `arvore_seca` | esqueleto de savana e terra queimada | 1,5 × 2,1 | **24 × 34** | 32 × 32 |
| `arbusto` | moita de frutas vermelhas | 0,9 × 0,9 | **14 × 14** | 16 × 16 |
| `palmeira` | coqueiro de praia e oásis | 2,2 × 2,8 | **35 × 45** | 32 × 48 |
| `cacto` | cacto de deserto | 0,9 × 1,4 | **14 × 22** | 16 × 32 |
| `pedra` | pedregulho solto | 1,5 × 0,9 | **24 × 14** | 32 × 16 |

**Os seis veios de minério** — `ferro`, `carvao`, `cobre`, `estanho`, `ouro`,
`gema` — têm todos **24 × 14** (redondo: 32 × 16) e são a mesma coisa: uma rocha
com cristal exposto. Se quiser economizar, desenhe **uma** rocha e seis paletas
de cristal; se quiser caprichar, seis silhuetas diferentes. As cores atuais estão
em `src/dados/recursos.ts`, campo `cor`.

**Total:** 15 tipos × 3 variantes = 45 desenhos. Se os veios virarem paleta,
caem para 30.

---

## 2. Os quatro povos (`src/dados/especies.ts`)

São o que o jogador fica olhando. Depois da mata, é o que mais muda o jogo.

Desenhe cada um numa tela de **16 × 16**, de pé, olhando para a direita, com os
pés na borda de baixo. O jogo estica o desenho para o porte declarado da espécie,
então o corpo não precisa preencher a tela toda:

| povo | porte no mundo | como aparece na tela | cores atuais |
|---|---|---|---|
| `humano` | 0,75 × 1,05 tiles | ~12 × 17 px | pele, azul, marrom |
| `elfo` | 0,75 × 1,15 | ~12 × 18 px, mais alto e magro | claro, verde, dourado |
| `anao` | 0,70 × 0,90 | ~11 × 14 px, baixo e largo | ocre, vermelho, marrom |
| `orc` | 0,90 × 1,25 | ~14 × 20 px, o maior deles | verde, marrom, oliva |

**Os seis povos mestiços** — `humano_elfo` (meio-elfo), `humano_anao`
(meio-anão), `humano_orc` (meio-orc), `elfo_anao`, `elfo_orc` e `anao_orc` —
hoje são desenhados com o mesmo molde bípede e cores interpoladas dos pais. Eles
são os últimos da fila: só dois nascem sozinhos no mundo (meio-elfo e meio-anão)
e, se você não desenhar nenhum, o carregador cai na mistura procedural. Se
quiser fazer, o porte é a média dos pais e a tela é a mesma **16 × 16**.

**O equipamento é desenhado por cima, num passe separado** — não desenhe espada
no corpo. São seis carimbos de 16 × 16, também virados para a direita, com o
mesmo enquadramento do corpo para encaixarem em cima dele:

`espada`, `lanca`, `machado`, `arco`, `porrete`, e um `escudo` que serve para os
dois escudos do jogo (madeira e ferro mudam só a cor).

Armadura hoje **não é desenhada** (`couro`, `cota`, `placas` só mudam número).
Se você quiser desenhá-las, são mais três carimbos e eu ligo no código.

**Total:** 4 povos + 6 equipamentos = 10 desenhos. Com os mestiços, 16.

---

## 3. A vila (`src/dados/edificios.ts`)

Ordem de impacto: casa, fazenda e moinho aparecem às centenas; o resto é marco
que aparece uma ou duas vezes por vila.

| id | o que é | em pixels | redondo |
|---|---|---|---|
| `casa` | a casa comum, o grosso de toda vila | **48 × 58** | 48 × 64 |
| `fazenda` | roça rasteira, quase chão | **32 × 14** | 32 × 16 |
| `moinho` | moinho de vento, com lavoura em volta | **48 × 74** | 48 × 80 |
| `celeiro` | galpão de comida | **48 × 42** | 48 × 48 |
| `muralha` | segmento de muro | **16 × 26** | 16 × 32 |
| `torre` | torre de guarda | **16 × 51** | 16 × 48 |
| `poco` | poço | **16 × 26** | 16 × 32 |
| `serraria` | serraria | **48 × 42** | 48 × 48 |
| `mina` | boca de mina na rocha | **32 × 40** | 32 × 48 |
| `ferraria` | forja com chaminé | **32 × 40** | 32 × 48 |
| `mercado` | banca de feira coberta | **48 × 42** | 48 × 48 |
| `taverna` | taverna | **48 × 51** | 48 × 48 |
| `quartel` | quartel | **48 × 51** | 48 × 48 |
| `biblioteca` | biblioteca | **48 × 51** | 48 × 48 |
| `banco` | banco | **48 × 51** | 48 × 48 |
| `prefeitura` | prefeitura, o marco da vila | **48 × 64** | 48 × 64 |
| `templo` | templo | **48 × 64** | 48 × 64 |
| `castelo` | castelo, a maior construção do jogo | **80 × 80** | 80 × 80 |
| `porto` | porto, metade em cima da água | **80 × 54** | 80 × 64 |
| `fogueira` | fogueira da era tribal, a moradia primitiva | **22 × 21** | 16 × 32 |
| `ruina` | escombro | **16 × 16** | 16 × 16 |
| `vulcao` | cone de vulcão (não é construção, é acidente) | **72 × 51** | 80 × 48 |

**Total:** 22 tipos × 3 variantes = 66 desenhos. Se as variantes valerem só para
casa, fazenda, muralha e árvore — que são as que se repetem muito —, cai para 33.

**Um aviso sobre a casa:** ela é a régua de escala do projeto inteiro. Uma casa
de 48 × 58 é o que faz a árvore parecer árvore e o humano parecer humano. Se ela
crescer, tudo cresce junto. Está documentado em `CLAUDE.md`, seção
"A escala tem uma régua só: a casa".

---

## 4. Bichos (opcional, e é bastante coisa)

Dezesseis espécies, todas em tela de **16 × 16**, olhando para a direita:

`coelho`, `ovelha`, `veado`, `javali`, `pinguim`, `lobo`, `raposa`, `urso`,
`tigre`, `cobra`, `peixe`, `tubarao`, `passaro`, `dragao`, `aranha_gigante`,
`zumbi`.

Hoje eles são desenhados por nove moldes compartilhados (quadrúpede, grande,
bípede, peixe, ave, pinguim, serpente, aranha, dragão) recoloridos por espécie —
por isso lobo e raposa têm exatamente a mesma silhueta. É a parte do jogo que
mais ganharia com desenho de verdade, e também a mais trabalhosa.

---

## 5. O que **não** precisa de sprite

- **O terreno.** Bioma, textura, praia e rebentação são cor calculada por tile,
  e de longe o mapa inteiro vira uma imagem de 1 pixel por tile. Não há tileset e
  não vale a pena criar um.
- **Estrada e território.** São pintura sobre o chão.
- **Barcos.** Desenhados com formas em `renderizador.ts`. Se você quiser dois
  sprites (pesqueiro e navio de guerra), eu troco — mas eles são minúsculos na
  tela e ficam por último.
- **Nuvem, fogo, lava e bomba de vulcão.** São efeitos, não objetos.
- **A interface.** Os ícones das ferramentas são caracteres de texto.

---

## Por onde eu começaria

1. **Três árvores** (`arvore`, variantes 1 a 3). É o teste do estilo inteiro: se a
   mata ficar boa, o resto segue dela.
2. Eu construo o carregador de imagem e ligo as três no jogo.
3. Você olha na tela, ajusta o estilo, e aí sim vale desenhar as outras doze
   plantas.
4. Os quatro povos e os seis equipamentos.
5. Casa, fazenda e moinho.
6. O resto das construções.
7. Os bichos, se a vontade durar.
