# ROTEIRO — worldbox-2

O que o Felipe pediu e ainda não está pronto, e o que já foi feito em cada
rodada. Serve para nenhum pedido se perder entre uma conversa e outra.

Quem mexe aqui: risque para **Feito** só quando estiver rodando e verificado
(`npm test`, `npm run sim`, `npm run testar-app`), não quando o código compilar.

---

## Fila — o que vem por aí

### 0. Interface: rework do layout (pedido em 01/09/2026)
O maior pedido em aberto, e o que mais muda a cara do jogo. São três peças:

- **Inspetor vira balão.** Hoje é um painel fixo no lado direito. Deve virar um
  balão que abre ao lado do que foi clicado e some quando se clica fora. Ganha-se
  a largura inteira da tela para o mundo.
- **Ferramentas descem para junto do minimapa.** A barra lateral esquerda sai; as
  ferramentas viram uma faixa na área de baixo, ao lado do minimapa.
- **O cabeçalho vira uma aba de configurações** dentro desse menu de baixo:
  velocidade, ano, população, territórios, nomes, novo mundo, salvar e carregar.

Lembrar: o painel de ordens da aldeia (`ui/comando.ts`) também vai ter de achar
um lugar no layout novo.

### 1. Barcos (pedido em 01/09/2026)
Ainda não começado. O pedido veio junto com o de rios: **os rios existem
também para os barcos navegarem depois**. Quando for a hora, o que já está no
lugar para receber isso:

- `Especie.dominio` já distingue `'terra' | 'agua' | 'ar'`, e o movimento já
  respeita quem pode entrar na água.
- `grid.ehAgua()` e o bioma `rio` já separam água doce de mar.
- Um barco provavelmente **não** é criatura: é mais perto de uma construção que
  se move, ou de uma criatura com um passageiro. Decidir isso antes de escrever
  a primeira linha — é a escolha que define se ele mora em `criaturas.ts`
  (índice em arrays paralelos) ou num sistema próprio.
- Rio de um tile de largura não dá para navegar de forma legível. A geração de
  rios já foi feita pensando nisso: há rios largos, e é neles que o barco cabe.

### 2. Território das civilizações: rework
Vai ser um dos focos do jogo. Hoje o território é só um tinto de cor sobre o
chão, ligado por uma caixa de seleção. Falta o que faz uma fronteira importar:
marcação legível no mapa (borda, e não só mancha), disputa visível, e a ligação
com o limite de tamanho da vila que já existe.

### 3. Equipamento: existe e não se vê
Medido em vinte mil ticks: **88% dos civilizados andam armados**, 25% com
escudo, 25% com armadura, 414 soldados, nove tipos de peça em uso. O sistema
funciona; falta aparecer.

- A **armadura nunca é desenhada** — desde o começo, por caber mal num boneco
  pequeno. Precisa de outra ideia: tingir o corpo, marcar um ombro, algo assim.
- Arma e escudo só aparecem a partir do zoom 8.
- 903 das 1071 peças são **porrete**: a mais pobre e a menos distinguível. A
  forja rica precisa ser mais fácil de alcançar.

### 4. Guerras quase não acontecem
Notado pelo Felipe e adiado por ele mesmo: tem tudo a ver com o update de
política. Em vinte mil ticks o mundo fica em zero a duas guerras.

### 5. Política e civilizações
Prefeitura, banco, biblioteca, taverna, quartel e poço estão de pé no mapa e
**não fazem nada** — foi combinado assim. É neste update que eles ganham
função, junto de conhecimento, economia mais funda e profissões.

---

## Feito

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
