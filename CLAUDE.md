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
- `Reino.era` (0 a 3) sobe com a população e ainda não faz nada além de aparecer
  na crônica — é o gancho óbvio para eras tecnológicas.
- `Reino.relacoes` é um mapa de -100 a +100 por par de reinos; alianças e
  comércio cabem aí sem mudar estrutura.
- `Criaturas.marcas` tem bits livres para profissão, e `xp` já acumula.
- Edifício novo é um objeto em `src/dados/edificios.ts` mais uma linha na escolha
  de `construirAlgo()`.

### Economia e comércio (`src/sim/economia.ts`, `coleta.ts`)
`oQueFalta()` é o cérebro econômico da aldeia: define o que os trabalhadores vão
buscar, e é o primeiro lugar a mexer quando o assunto for profissão, imposto ou
demanda. O comércio já usa `VALOR_MATERIAL` como preço base — preço que varia
com oferta e procura entra ali.

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
- **Anúncio saindo antes de a plateia chegar.** Tanto `mundo:gerado` quanto
  `mundo:carregado` eram emitidos antes de a crônica se religar ao mundo novo.
  Quem anuncia é o `Jogo`, depois de trocar o mundo.

---

## 6. Estado atual

Medido em 01/09/2026, mapa médio (384×216):

- 144 fps no aplicativo, inclusive com o mapa aproximado e o chão desenhado
  tile a tile.
- A fauna nasce com ~870 criaturas e se estabiliza em ~1.500: o teto por espécie
  (`Mundo.tetoPorEspecie`) é o que define isso, e é o que o controle de "bichos"
  na criação do mundo regula. O limite de vizinhança sozinho não segura
  população — ele só espalha.
- 32 ferramentas, 20 tipos de construção, 15 recursos, 10 equipamentos,
  25 biomas, 20 espécies, 8 tamanhos de mapa (até 2800×1600, teto de 130 mil
  criaturas vivas — o planeta inteiro gera em 1,6 s).
- Rede de água doce por acumulação de fluxo: ~2% do chão em rio, largura de 1
  a 7 tiles, lagos, e toda a rede desaguando no mar.
- O chão para de encher: mata, fruta e pedra têm teto próprio e sobram uns
  dois terços de terreno livre por quanto tempo o mundo rodar.
- Em vinte mil ticks num mapa médio: ~39 aldeias, e **os dezenove tipos de
  construção aparecem no mundo** — 748 fazendas, 252 casas, 50 minas, 16
  mercados, 12 templos, 9 prefeituras, 8 bibliotecas, 6 bancos, 5 castelos —
  com comércio acontecendo.
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
- Vulcões cospem bombas de lava com altura própria (`src/sim/vulcoes.ts`); onde
  caem, o chão vira lava e a mata em volta pega fogo.
- Comércio, alianças, equipamento e ordens do jogador conferidos rodando
  (`npm run sim` relata negócios fechados, alianças e quem está armado com quê).

**Aberto / próximo:**
- Não há busca de caminho: a criatura anda em linha reta e desliza no obstáculo.
  Aguenta bem o mapa aberto; se um dia precisar de A\*, o lugar é
  `src/sim/movimento.ts` — o resto do jogo não sabe como ela chega lá.
- Não há som, nem animação de sprite (cada criatura tem duas poses, esquerda e
  direita).
- O equilíbrio entre os quatro povos ainda varia bastante de semente para
  semente: é comum um povo dominar e outro sumir (a refundação traz de volta).
- Estações do ano, clima e catástrofes naturais automáticas não existem — só os
  desastres que o jogador provoca.
- A armadura não aparece no desenho (só arma e escudo): num boneco de 16 pixels
  ela ficaria confusa. É lida no inspetor e sentida no combate.
- Não há conhecimento nem tecnologia: `Reino.era` sobe com a população e ainda
  só aparece na crônica. É o gancho pronto para eras tecnológicas.
- O comércio usa preço fixo (`VALOR_MATERIAL`); oferta e procura ainda não mexem
  no preço.
