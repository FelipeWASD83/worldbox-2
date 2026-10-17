# CLAUDE.md — worldbox-2

Instruções e mapa do projeto para qualquer sessão do Claude Code aberta aqui.
O `CLAUDE.md` da pasta-mãe continua valendo; este manda no que for específico.

---

## 1. O que é

Sandbox de simulação de mundo inspirado no WorldBox: terreno gerado por semente,
biomas, animais com necessidades próprias, civilizações que fundam aldeias,
constroem, guerreiam e fazem as pazes, e poderes de criação e destruição na mão
do jogador.

**Aplicativo de desktop (Electron), não site.** O Felipe não quer jogo rodando em
aba de navegador. `npm run web` existe só para depurar com ferramentas de
navegador — a entrega é sempre a janela do aplicativo.

Como jogar e o que cada ferramenta faz está no `README.md`.

---

## 2. Como rodar e como conferir

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite + Electron, com recarga automática. É o do dia a dia. |
| `npm run app` | Build e abre o aplicativo como o jogador vê. |
| `npm run web` | Só o Vite, em `localhost:5174`, para depurar no navegador. |
| `npm run dist` | Gera o instalador `.exe` em `release/`. |
| `npm run sim` | Roda N ticks sem janela e relata população, aldeias, guerras, custo por sistema e problemas. |
| `npm run diag` | Relata de que cada espécie morreu e **quem matou quem**. |
| `npm run testar-app` | Abre o Electron, pergunta ao jogo como ele está e fecha. |
| `npm run testar-atualizacao` | O botão de atualizar contra um GitHub de mentira num servidor local: acha, baixa, confere, troca, volta atrás, e recusa pacote adulterado, de outro Electron, sem o jogo, com caminho malicioso e na pasta do projeto. Com `-- --electron`, instala de verdade numa pasta temporária e deixa o jogo atualizar e voltar atrás sozinho (uns 3 min; baixa o Electron uma vez, guardado em `%TEMP%\worldbox-2-electron`). |
| `npm run pacote` | Monta `release/worldbox-2-<versão>.zip` e o `.sha256` dele. |
| `instalar.bat` | Instala a cópia de jogar (ver "Instalação e atualização"). |
| `ferramentas\publicar-versao.ps1` | Cria a release no GitHub com o pacote, o `.sha256` e o instalador. **Publicar é decisão do Felipe**, como o push. |
| `npm run prints -- <pasta>` | Abre o aplicativo de verdade, monta cinco cenas (inverno de longe e de perto, a ficha de uma pessoa, a aba mundo, o botão de atualizar depois de procurar no GitHub) e salva cada uma em PNG na pasta. É como uma sessão sem ninguém no PC vê a janela. |
| `npm run equilibrio` | Roda várias sementes (uma por processo) e mede a fatia de cada povo, quantas vezes cada um some, a dominância do maior e nascidos em casa contra chegados de fora. `--bal chave=valor` testa um número do balanço sem mexer no arquivo. |
| `npm test` | Testes de regressão do motor: geração em todos os tamanhos, índice espacial, save, medidor. |
| `npm run typecheck` | `tsc --noEmit` sobre tudo. |

**Antes de dizer que algo está pronto**, rode `npm run typecheck`, `npm test`,
`npm run sim` e `npm run testar-app`. O `testar-app` não confere só se a janela
abre: ele exercita as janelas de salvar e carregar por dentro, que é a parte que
não dá para testar pelo navegador (lá o armazenamento é outro). O `sim` falha (código de saída 1) quando
encontra criatura fora do mapa, aldeia com número impossível, reino apontando
para aldeia que não existe, extinção geral ou save que não sobrevive à ida e
volta.

Para conferir uma cena específica na tela, o jogo aceita parâmetros de URL:
`localhost:5174/?semente=teste&zoom=14&x=150&y=110`.

---

## 3. Como o projeto é organizado

```
electron/    processo principal, saves em disco, política de segurança, autoteste
scripts/     sobe Vite + Electron juntos; roda o autoteste
src/core/    o motor: RNG, ruído, grid, pool de criaturas, índice espacial,
             eventos, pipeline de sistemas, save, laço do jogo
src/dados/   conteúdo declarativo: biomas, espécies, recursos, materiais,
             edifícios, equipamentos, nomes
src/sim/     um arquivo por sistema de simulação + o balanceamento e os
             comandos que o jogador dá às civilizações
src/render/  câmera, terreno em duas camadas, moldes e sprites, desenho
src/ui/      painéis, crônica, inspetor, painel de ordens, armazenamento
tools/       testes, simulador e diagnóstico de linha de comando
```

### As duas classes de ser vivo

`Especie.inteligente` é a divisão que organiza metade do jogo:

- **não-inteligente** (`cerebro: 'animal'`) — quer só sobreviver e procriar.
  Come fruta de arbusto ou caça, foge de quem o come, procura par da mesma
  espécie. Não tem aldeia, território nem trabalho.
- **inteligente** (`cerebro: 'inteligente'`) — faz tudo isso e pertence a uma
  aldeia: busca o que falta no estoque dela, derruba árvore, minera, constrói,
  recebe equipamento, guerreia pela bandeira e comercia.

O campo é próprio, e não uma consequência da categoria, para caber no futuro um
bicho que aprenda ou um monstro que se organize.

### Escala: o que ocupa o chão e o que só é desenhado

Cada coisa do mundo tem **duas medidas**: `ocupa` (tiles tomados no chão, para
colisão e construção) e `sprite` (tamanho do desenho, em tiles, que sobe a
partir da base). Uma árvore ocupa 1 tile e é desenhada com 3×6 — a copa passa
por cima dos vizinhos sem impedir nada. Se a ocupação fosse do tamanho do
desenho, uma floresta teria uma árvore a cada dezoito tiles.

Os limites combinados: árvore até 3×6 (varia por bioma), casa até 3×4, moinho
3×6, ser inteligente até 2×3, animal até 2×2, fruta 1×1. Há teste que falha se
alguém passar disso.

Tudo é ancorado pela **base**, inclusive as criaturas: o desenho sobe a partir
do tile onde a coisa está. Objeto centrado no tile flutua.

**`grid.ocupacao`** guarda, para cada tile tomado, o índice do tile-âncora do
objeto que o tomou. É o que permite derrubar uma casa inteira clicando em
qualquer canto dela, e é por isso que `ancoraDaConstrucao()` aparece em todo
lugar que mexe com prédio.

**Um raio só por aldeia.** `alcanceDaAldeia()` (`src/sim/urbanismo.ts`) é a
única medida do tamanho de uma aldeia — escolher lote, contar o que foi
construído e limpar quando ela morre usam esse mesmo número. Já houve três
raios diferentes aqui, e o resultado era casa que não abrigava ninguém, lavoura
que não rendia e prédio fantasma que nunca saía do mapa.

### A escala tem uma régua só: a casa

A referência é o WorldBox, e nela a **casa de 3×3,6 tiles é o maior objeto
comum do mapa**. Tudo se mede por ela:

- uma pessoa fica em torno de **um terço da altura de uma casa** (0,9 a 1,25);
- **nenhuma árvore passa do telhado** — no começo a mata ia a 3×6 e uma
  floresta engolia a vila inteira quando a câmera se aproximava;
- o desenho da criatura é sempre menor que um tile de largura, salvo bicho
  grande (urso, tigre, tubarão) e monstro.

Por isso `Especie.porte`, `REC_SPRITE` e `ED_SPRITE` aceitam **fração**
(`Float32Array`, não inteiro): em passo inteiro esses tamanhos não existem, e a
diferença entre uma árvore de 3 e uma de 3,4 muda a cara de um mapa florestado
inteiro. Há testes que falham se alguém passar de qualquer um desses limites.

`ZOOM_DETALHE` faz parte da mesma decisão: ele é quem define **quanto mundo
cabe na tela com os desenhos ligados**. Estava em 5,5, e era preciso aproximar
tanto que apareciam duas casas na tela inteira; hoje é 3,5, e uma vila inteira
cabe de uma vez, como na referência.

### A água doce é calculada, não desenhada

`src/sim/rios.ts` não traça rios: ele resolve a **drenagem do mapa inteiro**.
Cada tile recebe chuva conforme a umidade, a água escorre para o vizinho mais
baixo, e uma passada na ordem certa soma tudo. Nascente, afluente, rio largo e
lago saem daí sem nenhuma regra própria — a largura é a raiz da vazão.

Duas coisas seguram isso de pé, e as duas custaram uma rodada de depuração:

- **`src/sim/depressoes.ts` roda antes.** Terreno de ruído é cheio de covinhas,
  e sem encher os buracos toda gota para na primeira: a primeira versão dos
  rios saiu com centenas de poças e **zero rios**. O `EPSILON` do preenchimento
  é igualmente essencial — sem ele o buraco cheio vira um platô perfeitamente
  plano, que também não tem para onde escoar.
- **A ordem de soma vem do preenchimento**, que já visita do mar para o alto.
  A primeira versão ordenava por conta própria com 256 baldes de altitude, e
  dentro de um balde a ordem era arbitrária: vizinhos no mesmo balde às vezes
  eram somados fora de ordem e perdiam água. O sintoma era um punhado de tiles
  de rio soltos no campo, sem nascente nem foz.

Lago **afunda o terreno** junto de pintar o bioma. No motor, água é altitude
abaixo do nível do mar (`Grid.ehAgua`); lago que só troca o bioma continua
chão firme para o resto do jogo.

### A interface mora toda na barra de baixo

O mapa ocupa a tela inteira; não há painel lateral nenhum. Tudo — ferramentas,
inspetor, ordens, estatísticas, crônica e ajustes — vive numa barra sempre
visível embaixo, dividida em abas. É o arranjo do WorldBox, e a razão é que num
jogo em que se fica olhando o mundo cada painel encostado na lateral é um pedaço
de mundo que se deixa de ver.

Três coisas que essa mudança ensinou, e que valem para qualquer mexida no
layout:

- **A barra tem altura fixa, não `auto`.** Com `auto`, uma linha de texto a mais
  na dica da ferramenta encolhia o mapa; encolher o mapa redimensiona o canvas,
  o que dispara outro cálculo de layout, e o navegador acusava laço de
  `ResizeObserver` — que o jogo mostrava como erro fatal.
- **`ajustarTela` só mexe no buffer do canvas.** Escrever `tela.style.width` de
  dentro do `ResizeObserver` fechava o mesmo laço. O tamanho em tela vem do CSS.
- **A câmera reenquadra sozinha enquanto o jogador não mexeu nela**
  (`Camera.enquadrado`). Sem isso, o enquadramento da abertura valia para
  sempre: abrir numa janela pequena e maximizar deixava um quarto da tela em
  preto em volta do mundo.

### Barcos e portos

`src/sim/barcos.ts`. Barco **não é criatura**, e a escolha é deliberada: o pool
de criaturas daria posição, movimento e save de graça, mas viraria uma espécie
que não come, não envelhece e não se reproduz. São poucas dezenas no mundo, então
é uma lista em `Mundo.barcos`, como as bombas de lava e as nuvens.

O porto é a única obra que **avança sobre a água** (`Edificio.naAgua`): enquanto
precisou de terra firme nos doze tiles do lote, só duas de vinte vilas costeiras
achavam onde erguê-lo, e o mundo terminava com um porto só. Um cais é meio terra,
meio água — e é isso que o faz caber numa costa recortada.

Barco não usa a busca de caminho das criaturas (`caminho.ts`): o que evita
casco preso em baía é escolher destino só quando **a linha reta até lá é toda
navegável** (`caminhoLivre`).

### Política: quem manda, e o índice que não se pode guardar

`src/sim/politica.ts`. Cargos são **pessoas concretas** do pool: `Aldeia.governante`
e `Reino.rei` guardam índice de criatura. Governante é o morador mais rico da
vila; rei é a casa real enquanto sobrar alguém dela, e a família mais rica quando
a linhagem acaba.

**A armadilha que isso trouxe, e que vale para qualquer referência futura a uma
criatura:** índice de criatura guardado fora do pool não pode ser confiado
sozinho. Quando alguém morre, o slot volta para a lista de livres e o próximo a
nascer ocupa o mesmo número — quem guardou o índice passa a apontar para outra
pessoa, **viva e do mesmo reino**, sem nenhum sinal de que trocou. Foi assim que
um reino apareceu governado por um recém-nascido sem família.

Por isso existe `Criaturas.geracao`: um contador que sobe a cada reciclagem do
slot. Quem guarda referência guarda o par (índice, geração) — `Reino.reiGer`,
`Aldeia.governanteGer` — e confere com `mundo.mesmaPessoa(i, ger)`. **Toda
mecânica nova que apontar para uma criatura tem de fazer o mesmo.**

O território ficou grande de propósito na mesma rodada: o raio por nível dobrou
e a distância entre aldeias subiu junto. Os dois andam amarrados — raio grande
com distância curta faz a colônia nascer dentro do território da mãe e travar no
nível 1 para sempre.

### O mapa político tem a resolução de um bloco

`CamadaTiles.desenharTerritorio`. O território é pintado em **blocos de 6×6
tiles** (`LADO_BLOCO`), e o bloco pertence ao reino com mais tiles dentro dele.

`LADO_BLOCO` é **separado** de `LADO_PEDACO`, o lado do pedaço de chão em cache.
Já foram o mesmo número, e o resultado eram degraus de dezesseis tiles: uma vila
inteira cabia num quadrado só e a divisa parecia um tabuleiro. Um é tamanho de
cache de desenho e tem motivo de performance para ser 16; o outro é resolução de
fronteira e tem motivo estético para ser pequeno. A divisa é o contorno dos blocos, e só aparece
onde o vizinho é de outro dono.

A perda de precisão é o ponto: fronteira é uma linha grossa num mapa, não o
cadastro de cada metro quadrado. Tingir tile a tile dava um recorte serrilhado
que dizia mais sobre o algoritmo de expansão do que sobre política.

Fica **fora do cache de chão** porque depende dos blocos vizinhos, e um pedaço
do cache não sabe nada sobre o vizinho. O dono de cada bloco é recontado a cada
`INTERVALO_BLOCOS` ticks, não a cada quadro: a fronteira anda devagar.

### O território cresce pela borda, e a borda é uma fila

`Aldeia.franja` guarda os tiles da fronteira esperando serem tomados, e
`expandirTerritorio` come um punhado dela por passada. É o que faz a forma do
território ser a que a geografia permite em vez de um disco em volta da praça.
A retirada é de posição sorteada, não da ponta: tirando sempre do fim, a vila
crescia em faixa reta, porque a fila é preenchida em ordem de vizinhança.

**Consequência que já custou uma correção:** com forma livre, nenhuma conta
pode supor que o território de uma vila cabe num quadrado em volta dela, nem que
é contíguo — uma vizinha mais forte corta a mancha ao meio. É por isso que
`destruirAldeia` varre o mapa inteiro em vez de um quadrado.

### A vegetação segue a água

`fatorDeAgua`, em `src/sim/geracao.ts`. Árvore e arbusto não se distribuem pelo
clima médio do bioma: eles se amontoam onde há água de superfície. O fator
multiplica a densidade de **planta** (madeira e comida — minério não, que está
enterrado desde antes de haver rio) e vale tanto na geração do mundo quanto na
rebrota, para o mapa não mudar de regra depois que a partida começa.

Rio e lago pesam muito mais que o mar: água salgada não rega nada.

**A calibragem é parte do desenho, não um detalhe.** A intenção é redistribuir
vegetação, não criar vegetação — a média do fator sobre a terra firme tem de
ficar por volta de 1. Na primeira tentativa ela saiu em 1,7, a cobertura de
planta do mundo pulou de 10% para 17,5% do chão, encostou no teto de
`BAL.tetoDoChao.madeira` e **desligou a rebrota inteira**: o mundo ficava cheio
de mata e incapaz de repor a que fosse derrubada. Quem mexer nesses números mede
os dois lados — a cobertura total e a taxa média de rebrota — e não só o
contraste na tela.

### Recursos: camada, não entidade

Árvore, arbusto, pedra e veio de minério moram em `grid.recurso` e
`grid.recursoQtd` — dois bytes por tile. Uma floresta de oitenta mil árvores
como objetos custaria mais que a simulação de criaturas inteira. O índice
guardado é o do registro **mais um**; zero é tile limpo.

### Aldeias são planejadas, não sorteadas

`src/sim/urbanismo.ts` põe as obras em **lotes de uma malha** ancorada na praça
central e liga cada lote ao centro por uma **estrada** (`grid.estrada`). Daí saem
quarteirões e ruas em vez de telhados espalhados ao acaso. A estrada contorna as
árvores em vez de derrubá-las — quando derrubava, cada obra abria uma clareira
até a praça, a aldeia ficava sem madeira ao alcance e parava de crescer.

### O terreno é desenhado de dois jeitos

`render/terreno.ts` desenha um pixel por tile e serve o mapa afastado — é uma
chamada de `drawImage` por quadro, custe o que custar o zoom.
`render/tiles.ts` entra acima de `ZOOM_DETALHE` e trabalha em **duas camadas**:
o chão (bioma, textura, estrada, lavoura, cor do reino) vai em pedaços de 16×16
tiles guardados em cache; os objetos altos (árvore, pedra, veio, construção) são
desenhados por cima, na hora, varrendo os tiles visíveis de cima para baixo — a
ordem de profundidade sai pronta da varredura, sem ordenar nada. Objeto alto não
cabe no cache porque uma árvore de 3×6 atravessa a fronteira dos pedaços e seria
cortada ao meio.

Os desenhos de árvore e de prédio são gerados uma vez no boot
(`render/spritesMapa.ts`), em canvas do tamanho que ocupam no mundo, com três
variantes cada. Uma floresta de mil árvores custa mil cópias de imagem, não mil
desenhos refeitos.

O mapa esticado continua sendo desenhado por baixo: é o que evita buraco na tela
enquanto os pedaços ficam prontos.

### Instalação e atualização: duas cópias, um botão

Desde a 2.1.0 o jogo tem botão de atualizar pelas releases do GitHub
(`FelipeWASD83/worldbox-2`, **público desde 17/10/2026, MIT**), como a regra da
raiz pede para todo app. Ele mexe numa **cópia instalada**, e não na pasta do
projeto: esta é um repositório git, e trocar arquivos por baixo do git deixaria
a pasta suja de mudanças que ninguém fez. Na pasta do projeto o botão procura e
mostra a versão nova, e manda usar `git pull`.

A cópia instalada (`instalador/instalar.ps1`, que o `instalar.bat` chama) fica
em `%LOCALAPPDATA%\WorldBox 2`:

```
electron/   o Electron oficial, conferido pelo SHASUMS256 da release dele
inicio/     o inicializador (instalador/inicio), que o atualizador NUNCA troca
app/        a versão em uso; nova/ é a baixada, anterior/ a de antes
estado.json versão, se está em teste, e se a última troca foi desfeita
icone.ico   o ícone dos atalhos (cópia do icone/icone.ico do pacote; fica fora de app/ para a troca de versão não mexer)
```

**Ícone (2.1.1):** o desenho (um mundo em blocos) é gerado por `_organizacao/atalhos/desenhar_icones.py` + `gerar_icones.py` na raiz da pasta e copiado para `icone/` (`icone.ico` e `icone.png`, versionados e levados no pacote). A janela usa `icone/icone.ico` (`BrowserWindow.icon`) e o `app.setAppUserModelId` agrupa a barra de tarefas. Sem esse ícone, atalho e janela caem no ícone do Electron. Mexeu no desenho: rodar os dois scripts da raiz e `instalar.bat` de novo.

O atalho abre o Electron apontando para `inicio/`, que põe no lugar a versão
baixada, carrega o jogo de `app/` e volta para `anterior/` se a nova quebrar
ao carregar, avisar erro fatal ou não dizer que abriu em 45 s (o jogo emite
`wb2:abriu` cinco segundos depois de mostrar a janela). **Quem desfaz a troca
mora fora do que é trocado**, e é só por isso que versão quebrada consegue se
desfazer.

Três decisões que seguram isso:

- **Sem `.exe` próprio**: o Smart App Control barra binário novo, e o
  `electron.exe` oficial passa. Por isso não há `electron-builder` na entrega
  de jogar; o `npm run dist` continua lá, mas o instalador gerado por ele não
  foi testado contra o SAC.
- **Zip próprio** (`electron/zip.js`): o pacote é lido na memória e cada
  caminho é conferido antes de qualquer arquivo ir para o disco. O mesmo código
  monta o pacote na publicação (`tools/empacotar.ts`), então os dois lados
  sempre concordam no formato.
- **O Electron é do instalador, não do pacote.** O `package.json` diz
  `versaoElectron` (tem de bater com o `node_modules`, o `npm run pacote`
  confere), e o atualizador recusa versão que peça outro Electron: aí é rodar
  o instalador de novo.

O `name` do `package.json` do inicializador é `worldbox-2`, igual ao do
projeto, de propósito: é ele que decide a pasta de dados do Electron, e é o
que faz a cópia instalada e a da pasta verem os mesmos mundos salvos. Pôr
`productName` lá mudaria a pasta e esconderia os mundos.

### As quatro decisões que sustentam o resto

**1. Criatura é um índice, não um objeto.** Tudo em `src/core/criaturas.ts` são
arrays paralelos (`x`, `y`, `fome`, `vida`…). Um objeto por criatura derruba a
capacidade do jogo em uma ordem de grandeza. Atributo novo é mais um array ali,
mais uma linha em `criar()` e mais uma linha em `save.ts`.

**2. Sistemas em fila, não amarrados entre si.** Cada arquivo de `src/sim/` é um
`Sistema` com um `executar(mundo)`, registrado em `src/sim/index.ts` numa ordem
declarada. Mecânica nova = arquivo novo + uma linha na lista. Duas regras de
ordem: quem lê posição vem depois do índice espacial; quem mata vem depois de
quem decide.

**3. Conteúdo é dado, não código.** Espécies, biomas, edifícios e poderes são
objetos em registros (`src/core/registro.ts`). O registro dá a cada definição um
id de texto (estável, é o que vai para o save) e um índice numérico (compacto, é
o que vai para os arrays). Espécie nova é um objeto em `src/dados/especies.ts` —
o sprite, a barra de ferramentas e as estatísticas se ajustam sozinhos.

**4. Ninguém chama ninguém: anuncia-se.** `src/core/eventos.ts` é um barramento
tipado. Sistemas anunciam o que aconteceu e a interface, a crônica e as
estatísticas escutam. É por onde mecânicas futuras vão se pendurar sem tocar nas
existentes.

### Névoa diplomática: reino nenhum nasce sabendo dos outros

`Reino.conhecidos` e `src/sim/contato.ts`. **Nada de diplomacia acontece fora
desse conjunto** — nem relação, nem comércio, nem guerra, nem atrito de
fronteira. `mundo.mudarRelacao` desiste em silêncio para um par que não se
conhece, e é essa guarda que impede a névoa de virar enfeite de interface.

O conhecimento anda **dentro de uma pessoa**. Alguém esbarra num estrangeiro ou
pisa em chão com dono, guarda a novidade em `Criaturas.noticia`, e enquanto ela
estiver ali é a única cópia que existe no mundo: se a pessoa morrer no caminho,
o encontro não deixa marca. Chegando viva a menos de `BAL.distanciaDoRelato` da
própria praça, conta a quem manda ali e só então os dois reinos passam a existir
um para o outro. Aliados também trocam o que sabem, uma vez por avaliação de
diplomacia — é a única forma de conhecimento que atravessa o mapa sem alguém
andar até lá.

Efeito colateral que é o ponto: um reino cercado de montanha demora décadas para
descobrir o vizinho. A geografia passa a decidir a política.

### Guerra precisa de motivo, e paz precisa de desgaste

`motivosDeGuerra` em `src/sim/diplomacia.ts`. Cada par de reinos tem uma lista de
motivos com peso medido do estado do mundo naquele instante — fronteira que se
toca, ódio antigo entre os povos (`ODIO_POVOS`), rancor acumulado, terra que
falta de um lado e sobra do outro, fome, fraqueza do vizinho, aliado apanhando.
Guerra estoura quando a soma passa de `BAL.limiarCasusBelli`, e o motivo mais
pesado vai no evento `reino:guerra` e daí para a crônica: dá para ler no
histórico **por que** cada guerra começou.

**A paz não é o espelho disso, e essa foi a lição medida.** A primeira versão
exigia que os motivos esfriassem para a guerra acabar, e o mundo travou em guerra
permanente: os motivos que sustentam uma guerra *crescem* enquanto ela dura — a
fronteira continua se tocando, os mortos viram rancor, a relação fica presa em
-80. Quatro reinos, quatro guerras simultâneas, nenhuma terminando a não ser por
extermínio, e a economia parada porque um terço de cada vila estava de armas na
mão. Quem encerra uma guerra é o **desgaste** (`BAL.ticksAteCansarDaGuerra`),
com os motivos esfriando apenas apressando a trégua.

Duas guardas acompanham isso e existem pelo mesmo motivo: `BAL.tregua`, um tempo
mínimo entre uma guerra e a seguinte com o mesmo reino — sem ele a mesma guerra
recomeçava na avaliação seguinte à paz —, e `BAL.pesoDeFrenteAberta`, que
encarece abrir um segundo front.

`Reino.rancor` é separado de `Reino.relacoes` de propósito: relação oscila, mágoa
não. Ela entra por morte em combate, por chão tomado e por traição de aliança, e
só desce com o tempo (`BAL.esquecimentoDeRancor`).

### Clã, lealdade e rebelião

`src/sim/cultura.ts`. Cada pessoa pertence a um clã (`Criaturas.cla`), cada clã
é um objeto com quatro valores de 0 a 1 (`Mundo.clas`), e esses valores puxam
comportamento de verdade: `marcialidade` inclina quantos moradores viram
soldado, `ganancia` e `submissao` decidem quanto o imposto dói, `fechamento`
decide o quanto incomoda ser governado por gente de outro clã.

A lealdade de cada um (`Criaturas.fidelidade`) caminha devagar para um alvo
calculado do que ele vive — fartura da vila, fome no estômago, clã de quem
manda, guerra em que o reino meteu todo mundo. Quando a média de uma vila
desaba, ela se separa levando o território e nasce em guerra com o reino de
origem.

**É a única fonte de dois reinos vizinhos da mesma espécie no jogo**, e por isso
a única fonte de aliança: entre espécies diferentes o ódio de povo trava a
relação antes de ela chegar aos 45 que uma aliança exige.

Três lições medidas ficam aqui:

- **A varredura por vila é O(vilas × criaturas).** A primeira versão fazia um
  laço por vila varrendo o pool atrás dos moradores dela, o que num mundo grande
  são mais de um milhão de iterações por avaliação. `atualizarLealdade` calcula
  o que vale para a vila numa tabela indexada por id de aldeia e varre o pool
  **uma vez**. Qualquer conta nova por vila que precise olhar moradores tem de
  nascer assim.
- **Clã não pode decidir a economia da vila.** Com a marcialidade mexendo na
  fatia de soldados de metade ao dobro (`BAL.pesoDoClaNoExercito` valendo 1), a
  guerra tirava até metade da vila do trabalho, as aldeias paravam de construir
  casa e o crescimento por nascimento em casa caía abaixo do crescimento por
  imigração. O peso é 0,5: o clã inclina a balança, não a vira.
- **Id de reino não é reaproveitado** (ver `criarReino`). Aldeia recicla id e
  criatura recicla slot; reino não, porque o número dele fica guardado em
  `grid.territorio` e em `criaturas.noticia`, onde não há como conferir se ainda
  é o mesmo reino.

### Quem funda vila ou reino empossa o chefe na hora

`empossarChefes`, em `src/sim/politica.ts`. O sistema de política roda a cada
`BAL.intervaloPolitica` ticks, e enquanto ele não roda uma vila recém-fundada
não tem governante e um reino recém-fundado não tem rei — ninguém recolhe
imposto e qualquer conta que suponha "toda vila viva tem quem mande nela"
encontra exceção. Colônia, desembarque de colonos, refundação de um povo
varrido, rebelião e a mão do jogador chamam `empossarChefes` logo depois de
criar.

Na mesma correção, a ordem dentro de `sistemaPolitica` foi invertida: **a coroa
vem antes dos governantes.** Rei novo leva uma fatia do tesouro ao assumir, o
que costuma fazer dele o mais rico da vila onde mora; com os governantes
escolhidos primeiro, aquele dinheiro só entrava na conta na passada seguinte e
por até cento e vinte ticks a vila do rei tinha um governante mais pobre que ele.

### Tecnologia: o que a civilização sabe, e do que ela constrói

`src/dados/tecnologias.ts` e `src/sim/conhecimento.ts`. Um reino nasce sabendo
duas coisas — fazer fogo e lascar pedra —, acumula **conhecimento** em pontos e
gasta esses pontos em descobertas, sempre na mais barata que já pode alcançar.
Cada descoberta abre construção, equipamento ou **material de obra**.

Três coisas mudaram de natureza com isso:

- **A era virou consequência.** Era calculada de população e território e não
  decidia nada; agora é a era da tecnologia mais avançada que o reino domina.
- **Os marcos passaram a servir para alguma coisa.** Biblioteca, prefeitura,
  templo e taverna estavam de pé no mapa sem função desde que existem — era a
  pendência 3 do roteiro. Agora são a fonte de conhecimento do reino.
- **`grid.acabamento` é uma camada nova**, um byte por tile, com o material de
  obra nos três bits de baixo e a espécie de quem ergueu nos cinco de cima. É
  gravado uma vez, na hora de erguer, e **nunca recalculado**: a casa de palha
  que a tribo levantou continua de palha depois da cantaria, e é essa mistura
  que faz a vila contar a própria história no mapa.

O material multiplica abrigo, moradia e resistência (`MAT_FATOR`) e escala o
custo. **A faixa é moderada de propósito, entre 0,7 e 1,35.** A primeira versão
ia de 0,55 a 1,45 e o efeito medido foi outro: como o mundo passa a maior parte
da partida em palha, uma casa de barro que abrigava metade do normal cortou a
população civilizada pela metade junto — dezoito vilas travadas no nível 1,
nenhuma chegando a moinho ou mercado. A diferença entre um material e o seguinte
tem de ser sentida; não pode decidir sozinha se a civilização existe.

**Quem se rebela leva o que sabia.** São as mesmas pessoas: o pedreiro que
assentava pedra na segunda continua sabendo assentar pedra na terça, com outra
bandeira em cima. Sem isso o mapa enchia de reinos tribais que nunca tinham
sido tribais.

**Nos testes existe `ensinarTudo(m)`.** Um teste sobre porto, moinho ou casa não
está testando a *descoberta* deles — sem o atalho, ele passaria a medir só
quanto tempo a tecnologia demora, que é assunto do teste 18.

### Genética: traços e mestiçagem

`src/dados/tracos.ts` e `src/sim/genetica.ts`. Duas coisas, e são a mesma ideia
por dois lados: a **espécie** diz de que povo alguém é, os **traços** dizem quem
ele é dentro daquele povo.

**Traço é um bit** em `Criaturas.tracos`, no idioma de `Criaturas.marcas` —
trinta e dois cabem num `Uint32Array`, quatro bytes por criatura, nenhuma
alocação. O que um traço faz são **multiplicadores sobre campos que já
existiam**: forte multiplica o dano que o combate já calculava, sábio multiplica
o conhecimento que o reino já acumulava. Nenhum traço abre mecânica nova, e é
isso que garante que traço novo custe uma linha de tabela e não código. Só os
inteligentes têm traço, por decisão do Felipe.

`fator(mascara, campo)` sai na primeira linha quando a máscara é zero — o caso
de todo bicho do mapa —, e por isso o sistema inteiro custa 6% de tick.

**`ESP_VIDA` deixou de ser o teto de vida.** Quem cura, compara ou mede "quanto
falta" tem de passar por `vidaMaxima(c, i)`, senão o forte fica curando até um
teto que não é o dele.

**Mestiço é espécie registrada**, gerada no carregamento a partir dos pares de
povos civilizados — seis entradas. Descartei guardar atributos por criatura: as
tabelas planas `ESP_*` que os laços quentes leem são indexadas por espécie, e
dar atributo próprio a cada indivíduo custaria uma dúzia de arrays a mais em
cento e trinta mil criaturas.

Quem cruza com quem sai de `ODIO_POVOS`, a mesma tabela que decide guerra —
`BAL.odioParaCruzar`. Duas armadilhas que custaram correção:

- **Mestiço tem de poder cruzar com os pais.** A primeira versão exigia um
  mestiço registrado para aquele par, e um meio-elfo não podia ter filho com
  ninguém a não ser outro meio-elfo: a primeira geração virava beco sem saída.
- **Vila é fundada com um povo só**, colônia herda o povo da mãe e a imigração
  de fora trazia mais do mesmo. Sem `povoQueChega` (em `civilizacao.ts`), que
  deixa a imigração trazer gente de um povo tolerado e conhecido, **mestiço
  nenhum jamais nasceria** — é a única porta pela qual dois povos passam a morar
  juntos.

`criatura:mesticou` só é emitido quando o filho é ele mesmo um povo mestiço.
Filho puro de um casal com um mestiço dentro é a linhagem voltando para um lado,
e anunciar isso enchia a crônica de "nasceu o primeiro anão".

### As ferramentas do jogador, em três arquivos

`poderesBase.ts` tem a interface `Poder`, o registro e os ajudantes (`porTile`,
`porCriatura`, `pintar`, `refazerBioma`, `reinosNaArea`). `poderes.ts` registra
as escritas à mão. `poderesDerivados.ts` registra as **famílias que saem prontas
dos registros do jogo** — um pincel por bioma, um plantio por recurso, uma obra
por construção, um dom por traço e uma revelação por tecnologia.

A divisão em três existe para evitar um ciclo: os derivados precisam dos
ajudantes, e `poderes.ts` precisa chamar `registrarDerivados()` no fim. Com os
ajudantes num terceiro módulo, ninguém importa ninguém em círculo.

**Quase metade das ferramentas não é escrita à mão**, e essa é a ideia: registrar
um bioma passa a registrar, de graça, o pincel daquele bioma; registrar um traço
passa a dar ao jogador o poder de concedê-lo. Conteúdo novo não deveria exigir
código de interface novo.

`CATEGORIAS` é a lista de abas e a interface se monta a partir dela — aba nova é
uma entrada naquele array, uma `<section>` no HTML e um `.aba-btn`. **Não há uma
segunda lista de abas em `main.ts`**; havia, e duas listas para manter em dia é
uma esquecida.

O teste 20 aplica **todas** as ferramentas em três pontos de um mundo vivo e
confere que nada estoura, que o mundo continua andando, que ninguém foi parar
fora do mapa, que não sobrou tile preso a construção inexistente e que o
resultado ainda salva. Com quase duzentos caminhos, é a única forma de saber que
nenhum deles quebra num caso que o desenvolvimento não visitou.

### Estações: o ano tem quatro, e o que muda é quando, não quanto

`src/sim/estacoes.ts`. O ano tem `TICKS_ANO` (400) ticks e a estação é só a
posição do tick dentro dele: nada é guardado, e por isso nada vai para o save.
Os multiplicadores (`BAL.estacao*`, na ordem primavera, verão, outono, inverno)
têm **média perto de 1 de propósito**: o mato explode na primavera, o verão
seca a lavoura e acende a savana (`fogoDeVerao`, em `ecologia.ts`), o outono é
a colheita e o inverno para tudo. Com médias abaixo de 1, o inverno seria um
corte disfarçado na comida do mundo inteiro.

A neve do inverno é **calculada, não pintada**: um tile está nevado quando a
temperatura dele fica abaixo de `Mundo.linhaNeve`, que sobe e desce numa curva
ao longo do ano. Nenhum bioma é trocado. Duas coisas seguram o custo disso:

- A linha anda em **degraus** (`BAL.degrauDaNeve`), e cada passo marca para
  redesenhar só os pedaços de chão que têm tile na faixa que mudou. Marcar o
  mapa inteiro custaria uma varredura do terreno a cada passo.
- O degrau é sobre a **subida**, e não sobre a linha inteira. Arredondando a
  linha, o verão ficava dois pontos acima da neve de sempre e pintava de
  branco uma faixa de tundra no meio do verão. O teste 21 pega isso.

### Profissões: cada adulto tem um ofício

`src/sim/profissoes.ts`. O ofício mora em três bits de `Criaturas.marcas`
(4 a 6; ler e escrever só por `oficioDe` e `darOficio`) e a perícia em
`Criaturas.pericia`. Os **de fora** (lavrador, lenhador, mineiro) buscam o
material do ofício e entregam mais com perícia; os **de casa** (construtor,
ferreiro, mercador, estudioso) trabalham na vila e o efeito é sobre ela
(obra mais rápida, equipamento mais barato, conhecimento para o reino). O
soldado continua sendo a marca de guerra por cima do ofício, e o quartel passou
a treinar quem tem essa marca.

Três lições medidas:

- **A pergunta "o que a criatura foi buscar" é dela, não da vila.** Com cada
  ofício pedindo uma coisa, a coleta de fruta (`comerVegetal`) não podia mais
  perguntar `oQueFalta(vila)`. Quem sai para trabalhar deixa anotado em
  `cargaMaterial` o que foi buscar (`irTrabalhar`, em `ia.ts`), e é isso que a
  coleta confere. É a mesma armadilha do "trabalhador voltando com a carga
  errada", um andar acima.
- **O ofício de fora busca até quase encher o celeiro**, e não só até o mínimo
  da vila. Com o mínimo, o lenhador largava a mata assim que havia madeira para
  a semana, ia ajudar na roça e a perícia mediana dos lenhadores era zero.
- **A troca de ofício tem folga e apego.** A cota anda com o celeiro; sem a
  folga de 25% e sem a perícia segurando quem é bom (`BAL.apegoAoOficio`), a
  vila trocava gente de lugar a cada oscilação e a perícia média do mundo não
  passava de 7%.

A contagem é feita como a da lealdade: duas varreduras do pool com tabela por
id de aldeia, nunca um laço por vila (ver "Clã, lealdade e rebelião").

### Busca de caminho: só quando a linha reta bate

`src/sim/caminho.ts`. O movimento continua em linha reta. Quando o passo bate
(água para quem anda, terra para quem nada), a criatura pede uma rota: A\* numa
janela de `BAL.janelaDaBusca` tiles em volta dela, esticada por linha de visão
em até `PONTOS_POR_ROTA` pontos de passagem. As rotas moram em `Mundo.rotas`
(arrays paralelos ao pool) e não vão para o save.

O que custou caro e não pode voltar:

- **Quem só passeia não pede rota** (`QUER_ROTA`, em `movimento.ts`). Com todo
  mundo pedindo, eram dezessete buscas por tick e o movimento custava três
  vezes o resto da simulação junto (2 ms por tick no mapa médio). Bicho à toa
  que bateu na água sorteia outro passeio; quem tem motivo (comer, caçar,
  trabalhar, voltar, procurar par, atacar) pede rota. Quem foge nunca pede.
- **A busca grande é numa vez separada.** Quando a janela normal não acha
  passagem, a **próxima** tentativa da mesma criatura usa a janela máxima
  (`Rotas.grande`). As duas na mesma chamada estouravam o orçamento.
- **Esticar a rota avança até o primeiro nó que some de vista**, e não procura
  o mais distante visível: o segundo jeito custa o quadrado do comprimento.
- O teto `BAL.buscasPorTick` é o que segura o custo num mapa enorme; quem pede
  além dele desliza pelo eixo livre, como antes, e pede de novo depois.

### Preço por oferta e procura, poço e banco

`Mundo.precos` guarda um fator por material sobre `VALOR_MATERIAL`, o mesmo
para o mundo inteiro, e vai para o save. A cada rodada de comércio ele anda uma
fração (`BAL.mareDoPreco`) para a raiz de (procura + 1) / (oferta + 1);
negócio fechado encarece, exportação barateia. O preço anda mesmo num mundo sem
mercado: a procura é de quem precisa. A tabela de preços aparece na aba mundo.

O poço rega a lavoura e, com um, a seca do verão não pega na vila
(`rendaDaLavoura`, em `civilizacao.ts`); dentro do território de vila com poço,
o fogo se apaga várias vezes mais rápido. O banco dá cofre próprio ao ouro
(`Aldeia.tetoOuro`; o ouro deixa de disputar o celeiro com a madeira, e todo
lugar que soma ouro tem de usar `mundo.tetoDe`), rende juros à vila e ao
tesouro do reino e barateia a compra de quem o tem.

### Som e animação

O som (`src/ui/som.ts`) é todo sintetizado pelo Web Audio, sem arquivo:
ambiente de vento, chuva, mar e fogo tirado do que **está na tela**, e um som
curto por acontecimento do barramento. Só toca depois do primeiro clique ou
tecla (regra do navegador). Volume e mudo ficam no `localStorage`, que é
preferência da janela e não do mundo.

A animação (`quadrosDe`, em `render/moldes.ts`) gera dois quadros de passo de
cada molde parado, sem desenho à mão: pernas, asa, rabo ou onda, conforme a
forma. O quadro sai do tick do mundo, então o jogo pausado congela o passo. O
banco de sprites passou a ter `QUADROS_POR_DIRECAO` quadros por direção, e o
índice sai de `indiceDoSprite`.

### Custo: onde ele está e como é segurado

A IA é, de longe, o sistema mais caro — foi medido em 90% do tempo de tick. Três
coisas seguram isso:

- **Fatias.** Só uma parte das criaturas decide por tick, e o número de fatias
  cresce sozinho quando o mundo enche (`src/sim/ia.ts`).
- **Índice espacial reconstruído por contagem.** `src/core/espacial.ts` responde
  "quem está perto" sem varrer o mundo e sem alocar nada.
- **Zero alocação no laço quente.** Os filtros de busca são funções de módulo que
  leem o contexto em variáveis (`_eu`, `_espEu`), não closures. Se você criar uma
  closure por criatura por tick, o coletor de lixo aparece no gráfico.

No desenho, a regra é: mapa afastado, cada criatura é **um pixel** escrito num
buffer; mapa aproximado, viram sprites, e aí são poucas na tela.

---

## 4. Onde mexer para fazer o que vem depois

O Felipe já disse o que quer expandir. Os ganchos estão prontos:

### IA das criaturas (`src/sim/ia.ts`)
Hoje são três máquinas de estado curtas — `animal`, `civilizado`, `monstro` — em
`CEREBROS`, escolhidas pelo campo `cerebro` da espécie. Trocar por árvore de
comportamento, utilidade ou memória individual é reescrever esse mapa; nada fora
do arquivo sabe como a decisão é tomada.

Se a criatura precisar lembrar de coisas, o lugar é um array novo em
`criaturas.ts` (ou bits em `marcas`, que já existe para sinalizadores).

**Cuidado que custou caro uma vez:** a criatura tem que **persistir no objetivo**.
Antes de `objetivoAindaVale()` existir, cada passada da IA sorteava um destino
novo e os herbívoros morriam de fome em cima do pasto. Qualquer cérebro novo
precisa manter essa ideia.

### Civilizações: conhecimento, economia, profissões (`src/sim/civilizacao.ts`)
`gerirAldeia()` já é uma sequência de etapas — consumo, recursos, território,
obras, crescimento, colonização. Etapa nova entra nessa cadeia, ou vira um
sistema próprio lendo os mesmos campos.

O que já está no lugar esperando ser usado:
- `Aldeia.bonusMadeira` e `bonusPedra` medem o que o entorno rende. É o começo de
  oferta e preço.
- `Reino.era` (0 a 3) deixou de ser gancho em 02/09/2026 (fase 4 do update de
  política): não sobe mais com a população, é a era da tecnologia mais avançada
  que o reino domina. Quem a move é `aprender`, em `src/sim/conhecimento.ts`
  (o poder *Esquecer* recalcula para baixo, e o reino rebelde herda a do reino
  de origem), e ela aparece no inspetor, nas ordens e na crônica. Ver
  "Tecnologia" na seção 3.
  Mecânica nova que dependa de progresso pergunta o que o reino sabe
  (`mundo.reinoSabe`), como fazem as obras e o equipamento, e não a era.
- `Reino.relacoes` é um mapa de -100 a +100 por par de reinos; alianças e
  comércio cabem aí sem mudar estrutura.
- `Criaturas.marcas` usa os bits 4 a 6 para o ofício (ver "Profissões" na
  seção 3); sobra o bit 7.
- Edifício novo é um objeto em `src/dados/edificios.ts` mais uma linha na escolha
  de `construirAlgo()`.

### Economia e comércio (`src/sim/economia.ts`, `coleta.ts`)
`oQueFalta()` é o cérebro econômico da aldeia, e `oQueBuscar()`
(`profissoes.ts`) é a mesma pergunta feita para uma pessoa com ofício. O preço
de cada material é `precoDe()` (`economia.ts`): o valor base de
`VALOR_MATERIAL` vezes o fator de mercado em `Mundo.precos`.

### Equipamento (`src/dados/equipamentos.ts`, `sim/equipar.ts`)
Três encaixes por criatura (arma, escudo, armadura), um byte cada. A aldeia
entrega o melhor que a forja dela alcança e que ela consegue pagar. Peça nova é
um objeto no registro; se ela precisar aparecer no desenho, um molde em
`render/moldes.ts` e uma linha em `nomeDoMolde()`.

### Ordens do jogador (`src/sim/comandos.ts`, `ui/comando.ts`)
Comando não força nada na marra: ajusta o que a aldeia **quer** e deixa a
simulação decidir se dá certo. Mandar fundar colônia sem madeira não funda
colônia nenhuma — e é isso que mantém o mundo coerente com o jogador dentro dele.

### Balanceamento (`src/sim/balanco.ts`)
**Todo número de ajuste mora ali.** Não espalhe constante pelo meio da lógica.
Depois de mexer, rode `npm run diag` — ele mostra de que as espécies morreram e
quem as matou, que é a única forma honesta de saber se o ajuste ajudou.

---

## 5. Coisas que já quebraram aqui — não repetir

- **Pool de criaturas entregando o mesmo índice duas vezes.** `remover()` encolhe
  o limite de varredura, e o índice que ficou acima dele continuava na lista de
  livres. Corrigido em `criar()`; se mexer no pool, mantenha essa checagem.
- **Herbívoro morrendo de fome com o mapa cheio de pasto.** Ver `objetivoAindaVale`
  acima.
- **Onívoro vence sempre.** Predador especialista depende de caçada, que falha;
  onívoro sempre tem pasto. O que equilibrou foi o metabolismo por dieta
  (carnívoro sente fome mais devagar) e o teto de densidade por espécie
  (`lotacaoMax`), não mexer em número de reprodução.
- **Javali exterminando elfo.** Animal agressivo tratava qualquer civilizado como
  alvo, inclusive o que ele não come. Agressividade só vale contra presa de fato.
- **Aldeia que nunca sobe de nível.** O teto de moradores de um nível tem que ser
  maior que a população exigida pelo nível seguinte. O `npm run sim` agora falha
  se alguém recriar esse impasse.
- **Colono nascendo velho.** Idade inicial em ticks fixos fazia o orc, que vive
  menos, começar a partida no fim da vida. Idade inicial é sempre fração da
  longevidade da espécie.
- **Array tipado não sobrevive ao arquivo de save.** `Aldeia.predios` é
  `Int32Array`; gravado em JSON, volta como objeto comum sem `fill`, e o jogo
  travava no primeiro tick depois de carregar. Campo assim ou é reconstruído ao
  carregar (é o que se faz) ou é gravado como array normal. O teste
  "mundo carregado continua rodando" existe por causa disso: conferir o
  conteúdo do save campo a campo não pegava o defeito, só rodar pegava.
- **Sprites espelhados ao contrário.** Os moldes olham para a direita; a posição
  0 do banco é a de andar para a esquerda, ou seja, a espelhada. Estava trocado
  e o mundo inteiro andava de costas. Há teste para a direção dos moldes.
- **Cache de chão menor que a tela.** Com um teto fixo de pedaços, o cache
  descartava o que estava à vista e redesenhava para sempre, deixando dois
  terços da tela borrada. O teto é calculado a cada quadro a partir de quantos
  pedaços a tela mostra.
- **Carga de material sem tipo.** `carga` anda junto de `cargaMaterial`: quem
  soma carga tem de conferir o tipo antes, senão a carne do veado entra no
  celeiro como minério de ferro.
- **Trabalhador voltando com a carga errada.** O lenhador colhia capim no
  caminho da floresta e chegava em casa com comida; a aldeia pedia madeira o
  tempo todo e nunca recebia. Quem enche carga tem de conferir o que a aldeia
  pediu (`oQueFalta`) — comparar com o tile de destino não serve, porque o
  movimento apaga o destino no instante em que a criatura chega.
- **Rua pavimentada por cima da casa.** O caminho começa no lote da obra que o
  pediu; sem guarda, ele pavimentava o piso dela.
- **Ruína eterna.** Escombro que nunca some entope o mapa: cada um bloqueia um
  lote e a estrada, e em algumas horas eram centenas. Ruína desmorona sozinha
  (`desfazerRuinas` em `ecologia.ts`).
- **Casa vencendo toda escolha de obra.** A população vive encostada no teto, e
  "precisa de casa" ganhava sempre — a aldeia nunca chegava a ter moinho nem
  mercado. Uma vez a cada três, a vez é do resto da lista.
- **`hidden` no HTML perdendo para `display` no CSS.** Se um elemento tem
  `display` declarado, precisa de `[hidden] { display: none }` explícito.
  Aconteceu duas vezes: no aviso de carregamento e no campo de nome do save.
- **Botão dentro de `<form method="dialog">` fecha o diálogo.** Botão que não é
  de confirmar precisa de `type="button"` explícito — o ✕ de apagar save
  fechava a janela junto.
- **Lista de tiles por bioma estourando a pilha.** Montar a lista de candidatos
  de um bioma num mapa enorme passa de cem mil itens e derruba a geração sem
  aviso nenhum. Em mapa grande, sorteie tiles em vez de listar.
- **Filtro espacial retangular fingindo ser circular.** `aoRedor` não conferia a
  distância e a praga — a única que confiava nele — contagiava a quatro vezes o
  raio declarado. Hoje o corte é circular e a distância vem pronta no callback.
- **Medidor de desempenho que só via metade dos sistemas.** Cronometrar "a cada
  30 ticks do mundo" caía sempre em tick ímpar e pulava todo sistema de
  intervalo par. Agora cada sistema é medido a cada 30 execuções dele mesmo.
- **Fila de obras que era uma cascata.** A escolha da construção era um `for`
  que parava na primeira vontade paga com 76% de chance. A quinta linha da fila
  só era alcançada uma vez em quatrocentas e a vigésima nunca: nenhuma
  prefeitura, nenhum mercado e, sem mercado, nenhum negócio fechado em vinte mil
  ticks. Hoje é sorteio com peso decrescente (`BAL.decaimentoDaFila`), e a
  posição na fila pesa sem matar o fim dela.
- **Vila rica que não conseguia construir nada.** Medindo obra por obra, 99%
  delas eram abandonadas por falta de lote, e a vila acumulava mil e setecentos
  de madeira parada. Foram quatro causas somadas, e nenhuma aparecia sozinha:
  a malha de lotes era rala demais (`PASSO` de seis tiles para lotes de quatro),
  os anéis mal cobriam o território, desde que minério passou a nascer no mundo
  inteiro **veio de minério barrava lote**, e a trama só tinha uma posição por
  célula — numa vila costeira, água e montanha matavam metade delas sem
  alternativa. Hoje a obra arranca o que está no chão e leva para o estoque, e
  cada célula da malha tem uma posição principal (que dá a rua reta) e três de
  meio passo, tentadas só quando a principal não serve. Os prédios de pé por
  vila foram de treze para quarenta e seis.
  Se um dia faltar construção de novo, meça o motivo da recusa antes de mexer em
  número: contar `sem lote` por tipo de prédio e o motivo dentro de `loteServe`
  leva dez minutos e diz a resposta.
- **A casa existia, mas ninguém achava a porta.** `acharCasaComVaga` sorteava
  quarenta pontos no disco da aldeia e só aceitava o acerto que caísse no
  **tile-âncora**. Casa ocupa 2×2, então três de cada quatro acertos eram
  descartados, e o alvo real eram doze tiles num disco de mil e quinhentos. O
  mundo tinha duzentas casas, todas com vaga, e três pessoas dentro. Hoje a
  aldeia guarda `casasIdx` e procurar casa é percorrer meia dúzia de índices:
  os nascimentos em casa foram de 58 para 2.661. **Nada que mexe com prédio
  pode supor que o tile clicado é a âncora** — ou se usa a lista da aldeia, ou
  se passa por `ancoraDaConstrucao()`.
- **Teste que passa com o sistema apagado.** O teste de nascimento em casa
  somava todo nascimento de espécie inteligente, viesse de onde viesse, e
  continuava verde com `moradia.ts` inteiro fora do pipeline. O companheiro dele
  procurava `tempoAbrigo > BAL.tempoDentroDeCasa`, valor que `entrar` nunca
  produz — não podia falhar nunca. Por isso `criatura:nasceu` carrega `origem`:
  teste de mecânica tem de medir **aquela** mecânica, e a única forma honesta é
  o efeito ser distinguível na medida. Ao escrever teste novo, pergunte antes o
  que ele mostraria se o sistema fosse deletado.
- **Vila que não cresce porque não tem casa, e não tem casa porque não cresce.**
  Ao fazer os filhos nascerem dentro de casa, tirar o crescimento próprio da
  aldeia travou tudo. Gente chega por dois caminhos de propósito: a maior parte
  nasce nas casas e um fio de gente de fora se junta à vila próspera
  (`BAL.imigracaoParaAldeia`). Mecânica nova que substitui um caminho de
  crescimento precisa deixar o antigo como rede.
- **Rio que não existia, e depois rio solto no campo.** Ver a seção da água
  doce acima: as duas causas foram o preenchimento de depressões faltando e a
  ordem de soma da vazão sendo aproximada. Qualquer conta que percorra o mapa
  "do mais alto para o mais baixo" precisa de ordem **exata** — arredondar a
  altitude para ordenar mais rápido quebra a topologia em silêncio.
- **Lago que era só uma cor.** Pintar `bioma = lago` sem baixar `alt` deixava
  o tile com cara de água e comportamento de terra: bicho andava por cima e
  aldeia construía dentro. Camada de aparência e camada de física têm de
  concordar.
- **Vulcão apagado pela vizinhança.** `destruirAldeia` limpa `construcao`
  direto, sem passar por `derrubar`, e levava junto o vulcão que estivesse no
  território. Daí `Edificio.natural` e `ED_NATURAL`: a regra de "isto não vem
  abaixo" mora num lugar só.
- **Bicho escalando cordilheira como se fosse campo.** Nada impedia uma manada
  de atravessar uma serra em linha reta. Hoje a montanha some da lista de
  destinos possíveis (`tileServe`), o passo na rocha custa menos da metade, e
  antes de aceitar um passo que sobe o movimento tenta os dois eixos separados
  — é o contorno do morro, sem busca de caminho. Não é proibição, e isso é de
  propósito: quem vai minerar sobe, quem está lá em cima desce, e quem foge não
  escolhe o caminho. Medido: a serra é 31% do chão e só 3% dos bichos estão
  nela.
- **Barco de guerra que nunca voltava para casa.** Cada perna de patrulha
  escolhia a seguinte, e como só se embarca colono no porto, a frota rondava
  para sempre e nenhuma colônia de além-mar era fundada — sete navios
  patrulhando, zero zarpadas em quarenta mil ticks. Toda ronda precisa de fim
  (`Barco.pernas`).
- **Diagnóstico em cima do índice errado.** Contei "portos órfãos" no mapa e
  escrevi uma regra inteira de "prédio sem dono vira ruína" para resolver — os
  tiles que eu contava eram **vulcões**, e o problema não existia. A regra foi
  removida. Antes de criar mecânica para explicar uma medição, confira que a
  medição mede o que você acha que mede: `mundo.nomeEdificio(construcao[i])`
  custa uma linha.
- **Território herdado de uma aldeia morta.** `destruirAldeia` limpava o chão
  varrendo um quadrado em volta da praça. Território em forma livre não cabe num
  quadrado e nem sempre é contíguo, então sobrava chão marcado no nome de uma
  vila que já não existia — e como `criarAldeia` **reaproveita o id**, a vila
  seguinte nascia dona de uma herança de terra do outro lado do mapa, com o
  contador zerado. É a armadilha do slot reciclado um andar acima: sempre que
  algo é reaproveitado por id, o que o dono anterior deixou tem de sumir por
  completo, não "quase".
- **A malha dizia dez e o mundo saía com cinco.** Cada célula da trama de lotes
  tem uma posição principal e três de meio passo, que existem para salvar o lote
  recusado pelo **terreno** (água, rocha, chão de outro povo). Elas eram tentadas
  também quando a recusa era por **já ter prédio ali**, então cada célula de dez
  tiles recebia quatro obras e o espaçamento real caía pela metade em cada eixo —
  exatamente o bloco contínuo de telhado que o passo largo existe para evitar.
  Hoje `loteServe` diz por que recusou (`_recusouPorObra`) e a célula vale uma
  obra.
- **Cargo herdado por um bebê.** Ver a seção de política acima: `Reino.rei`
  guardava só o índice, o slot do rei morto era reaproveitado e o sistema
  continuava achando o cargo válido porque aquele slot estava vivo. A correção
  é estrutural (`Criaturas.geracao` + `mesmaPessoa`), não um remendo — e vale
  para toda referência a criatura guardada fora do pool.
- **Território pequeno não gera expansão, gera confete.** O raio curto vinha do
  medo de "vila grande demais tira o motivo de colonizar". Medindo, o efeito era
  o oposto: a vila enchia o território quase na fundação e o reino saía
  pipocando colônia, terminando com cinquenta povoados de duzentos tiles. E
  raio e distância entre aldeias têm de subir **juntos**.
- **Anúncio saindo antes de a plateia chegar.** Tanto `mundo:gerado` quanto
  `mundo:carregado` eram emitidos antes de a crônica se religar ao mundo novo.
  Quem anuncia é o `Jogo`, depois de trocar o mundo.

---

## 6. Estado atual

Medido em 01/09/2026, mapa médio (384×216). As linhas do update de política,
da genética e das ferramentas (a contagem de ferramentas, tecnologias e traços,
névoa diplomática, casus belli, tecnologia, genética, clãs e rebelião,
território, interface, cargos e portos) entraram em 02/09/2026, no commit
`b014902`, e são daquela rodada; a contagem de construções foi conferida em
09/09/2026 (nota abaixo). A v2.0 (16/10/2026) mediu de novo só o equilíbrio
entre os povos e o custo por tick, no fim desta seção; o resto é da rodada
anterior.

- 144 fps no aplicativo, inclusive com o mapa aproximado e o chão desenhado
  tile a tile.
- A fauna nasce com ~870 criaturas e se estabiliza em ~1.500: o teto por espécie
  (`Mundo.tetoPorEspecie`) é o que define isso, e é o que o controle de "bichos"
  na criação do mundo regula. O limite de vizinhança sozinho não segura
  população — ele só espalha.
- 188 ferramentas em oito abas, 20 construções, 19 tecnologias,
  19 traços, 15 recursos, 10 equipamentos,
  25 biomas, 20 espécies, 8 tamanhos de mapa (até 2800×1600, teto de 130 mil
  criaturas vivas — o planeta inteiro gera em 1,6 s).

  > Contado em `src/dados/` em 09/09/2026: `edificios.ts` tem 22 entradas, mas
  > duas não são obra de ninguém — o `vulcao` é `natural: true` e a `ruina` tem
  > `nivelMinimo: 99`. Sobram **20 construções** que uma civilização levanta.
  > Dizia "21" aqui e "dezenove" três linhas abaixo; nenhum dos dois batia.
- Rede de água doce por acumulação de fluxo: ~2% do chão em rio, largura de 1
  a 7 tiles, lagos, e toda a rede desaguando no mar.
- O chão para de encher: mata, fruta e pedra têm teto próprio e sobram uns
  dois terços de terreno livre por quanto tempo o mundo rodar.
- Em vinte mil ticks num mapa médio: ~39 aldeias, e **todo tipo de construção
  que existia na hora da medição apareceu no mundo** (eram dezenove) — 748
  fazendas, 252 casas, 50 minas, 16 mercados, 12 templos, 9 prefeituras, 8
  bibliotecas, 6 bancos, 5 castelos — com comércio acontecendo. Hoje são vinte:
  medir de novo antes de repetir o número.
- Do crescimento das civilizações, 60% nasce dentro das casas e 40% é gente que
  chega de fora (`BAL.imigracaoParaAldeia`). Os dois caminhos existem de
  propósito: sem o segundo, a vila sem casa nunca sai do lugar.
- Equilíbrio do chão: cerca de três de mata para uma de fruta e duas de pedra
  ou minério. Um recurso por tile.
- Objetos multi-tile: árvores até 3×6 por bioma, casas 3×4, moinho 3×6 com
  lavoura em volta, veios de minério 2×1, criaturas com porte próprio, tudo
  ancorado pela base.
- Casas são entráveis, com lotação, e é dentro delas que nascem os filhos dos
  povos inteligentes (`src/sim/moradia.ts`).
- Cada vila tem teto de território por nível; encher o teto é o que empurra o
  reino a fundar vila nova (`limiteDeTerritorio`, `BAL.chanceColonizarLotada`).
- Névoa diplomática de pé: os reinos começam sem saber uns dos outros e se
  descobrem por mensageiro. Num mapa médio, quatro reinos levam de vinte a
  setenta anos de jogo para fechar dois ou três dos seis pares possíveis — e
  alguns nunca se encontram.
- Guerra com casus belli: em trinta mil ticks, ~8 guerras declaradas e ~7 pazes
  assinadas, com zero a duas ativas ao mesmo tempo, cada uma com o motivo
  registrado na crônica.
- Tecnologia de pé: num mapa médio os reinos entram na era das aldeias por
  volta do tick 4.200, na era de reino por volta de 18.000 e na imperial por
  volta de 25.000, e quarenta mil ticks bastam para todos os tipos de
  construção da época (dezenove) aparecerem no mundo — inclusive biblioteca,
  mercado, templo e quartel, que dependem das descobertas mais caras.
- Genética de pé: num mapa médio, cerca de 70% dos inteligentes carrega pelo
  menos um traço, os dezenove aparecem, e o imortal sai um a cada poucas
  centenas. Mestiço nasce sozinho onde dois povos tolerados convivem — de três a
  quarenta nascimentos em trinta mil ticks, conforme quem sobreviveu e quem
  fez fronteira com quem.
- Clãs e rebelião de pé: um mundo médio termina quarenta mil ticks com 150 a 250
  clãs, 3,7 clãs por vila em média, de três a seis rebeliões e seis a oito
  reinos vivos vindos dos quatro iniciais. Imposto brutal num reino de onze
  vilas o partiu em três em seis mil ticks — a alavanca funciona.
- Território em forma livre, crescendo pela fronteira, desenhado em blocos de
  6×6 na cor do reino em qualquer zoom. De longe a tela nomeia os **reinos**
  (povo e população); de perto, as **vilas**.
- Vulcões cospem bombas de lava com altura própria (`src/sim/vulcoes.ts`); onde
  caem, o chão vira lava e a mata em volta pega fogo.
- Comércio, alianças, equipamento e ordens do jogador conferidos rodando
  (`npm run sim` relata negócios fechados, alianças e quem está armado com quê).
- Interface toda na barra de baixo, em abas; o mapa ocupa a tela inteira.
- Cada civilizado tem riqueza, família, clã e lealdade. Vilas têm governante (o
  mais rico) e reinos têm rei (a casa real, com sucessão por linhagem e por
  fortuna quando a casa acaba). O imposto é regulado pelo jogador.
- Portos e frota: pesqueiros trazem comida do mar e navios de combate fundam
  colônia do outro lado dele (medido em arquipélago: 8 portos, 23 barcos,
  6 colônias por mar em 40 mil ticks).

**Medido na v2.0 (16/10/2026)**, com `npm run equilibrio` (doze sementes,
trinta mil ticks, mapa médio), antes e depois da versão:

- Fatia média de cada povo na população civilizada: antes humano 22%, elfo
  11%, anão 25%, orc 41%; depois humano 25%, elfo 15%, anão 30%, orc 30%. Um
  povo sumido no fim em quatro dos quarenta e oito casos (antes, nenhum; a
  refundação os traz de volta depois). A **dominância** (fatia do maior povo,
  média da partida) ficou entre 44% e 52% em todas as rodadas, antes e
  depois: com doze sementes, isso é ruído, e o mundo segue tendo um povo
  grande por partida. O que mudou é que ele deixou de ser quase sempre o orc.
- O que moveu isso: ninhada e espera de filho dos orcs (`[1, 3]` e 1100 para
  `[1, 2]` e 1300), natalidade e espera dos elfos (0,95 e 1700 para 1,1 e
  1500), em `src/dados/especies.ts`; `BAL.vontadeDeFamilia` de 0,45 para 0,6;
  e `BAL.imigracaoSomePorCasa` (era 1,4 escrito no código) para 3. A busca de
  caminho também pesa: sem ela, os elfos somem em quatro de doze sementes.
- Nascidos em casa contra chegados de fora: antes 1031 contra 677, depois 547
  contra 443 de média. A casa continua sendo o caminho principal; os dois
  números caíram porque a ninhada dos orcs ficou menor e as vilas, menores.
- Custo: 0,6 a 0,8 ms por tick no mapa médio (era 0,6). O movimento passou de
  ~0,1 para ~0,25 ms com a busca de caminho; as estações custam 0,002 ms.

**Aberto / próximo:**
- A dominância de um povo por partida continua alta (44% a 52%), e um povo
  some do mapa por um tempo em uns 8% das partidas. Os números que sobram para mexer
  estão no `balanco.ts` e nos dados dos povos; medir com `npm run equilibrio`
  antes de qualquer um, e com doze sementes ou mais: com menos, o ruído é
  maior que o efeito.
- A release v2.1.0 foi publicada em 17/10/2026 (a pedido do Felipe) e o
  pacote baixado do GitHub confere com o SHA-256 dela. A troca de uma versão
  publicada para outra ainda não aconteceu de verdade: só vai dar para ver
  quando sair a próxima. O teste com a janela usou um GitHub de mentira.
- Árvore no inverno continua verde (a neve cobre o chão, não a copa).
