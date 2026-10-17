import type { Grid } from '../core/grid.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import {
  ED, ED_MONTANHA, ED_NA_AGUA, ED_NATURAL, ED_OCUPA, empacotarAcabamento,
} from '../dados/edificios.js';
import { B, BIOMA_HABITAVEL } from '../dados/biomas.js';
import { REC_MATERIAL } from '../dados/recursos.js';

/**
 * Como uma aldeia se organiza no terreno.
 *
 * Antes cada construção caía num ponto sorteado dentro do território, e o
 * resultado era um punhado de telhados espalhados sem pé nem cabeça. Aqui as
 * obras vão para **lotes de uma malha** ancorada na praça central, e cada lote
 * novo é ligado ao centro por uma **estrada**. O desenho que aparece no mapa
 * passa a ser o de um povoado: quarteirões, ruas e uma praça.
 *
 * A malha é a mesma para todas as aldeias do mundo, mas ancorada no centro de
 * cada uma — então duas aldeias vizinhas não nascem com as ruas alinhadas entre
 * si, e cada uma tem a sua trama.
 */

/**
 * Até onde vai o que pertence à aldeia, em tiles.
 *
 * Este número é a **única** medida do tamanho de uma aldeia. Já houve três
 * raios diferentes no projeto — um para escolher lote, outro para contar o que
 * foi construído e um terceiro para limpar quando a aldeia morria — e o
 * resultado eram casas erguidas fora da conta (que não abrigavam ninguém),
 * lavouras que não rendiam e prédios fantasmas que nunca saíam do mapa.
 */
export function alcanceDaAldeia(a: { raio: number; tilesTerritorio?: number }): number {
  return aneisDaAldeia(a) * PASSO + LOTE + 2;
}

/**
 * Quantos anéis de lotes a vila tem em volta da praça.
 *
 * Os anéis param **dentro** do território. Com `ceil(raio/PASSO)+1` os dois
 * anéis de fora caíam em chão que a vila não possuía, e como lote fora do
 * território é recusado, a busca gastava o dobro do trabalho para achar os
 * mesmos lotes. O sintoma era outro e bem pior: medindo as obras, 99% delas
 * eram abandonadas por falta de lote — a vila acumulava mil e setecentos de
 * madeira sem conseguir levantar uma prefeitura.
 */
export function aneisDaAldeia(a: { raio: number; tilesTerritorio?: number }): number {
  // Os anéis acompanham o **território**, não o raio do nível.
  //
  // Desde que a fronteira cresce em forma livre, os dois deixaram de ser a
  // mesma coisa: uma vila pode dominar três mil tiles com raio nominal de 26.
  // Enquanto os lotes seguiram o raio, espaçá-los em doze tiles derrubou o
  // número de casas a ponto de quase ninguém nascer dentro de uma — o
  // território era enorme e a vila continuava cabendo em nove lotes.
  const porTerritorio = Math.ceil(Math.sqrt(a.tilesTerritorio ?? 0) / PASSO);
  return Math.max(2, Math.ceil(a.raio / PASSO), porTerritorio);
}

/** Lado do lote, em tiles. O que sobra entre lotes vira rua e quintal. */
const LOTE = 4;
/**
 * Distância de um lote ao seguinte.
 *
 * Oito tiles de folga entre lotes de quatro. Parece exagero escrito assim, e
 * não é: comparando com a referência, entre duas casas do WorldBox cabem quatro
 * a seis tiles de campo aberto, e as nossas saíam praticamente encostadas,
 * formando um bloco contínuo de telhado que se lia como uma coisa só em vez de
 * como um povoado.
 *
 * Isto só ficou possível quando o território cresceu: numa vila de duzentos
 * tiles, espaçar assim deixaria lugar para três casas. Se um dia faltar lote de
 * novo, o caminho é olhar o território antes de reapertar isto aqui.
 */
const PASSO = LOTE + 6;

/**
 * Acha o lote livre mais próximo da praça onde a construção caiba.
 * Devolve o índice do tile do canto superior esquerdo, ou -1.
 */
export function acharLote(mundo: Mundo, a: Aldeia, tipo: number): number {
  const largura = ED_OCUPA[tipo * 2];
  const profundidade = ED_OCUPA[tipo * 2 + 1];

  // A muralha é a exceção: ela não vai para lote nenhum, vai para a borda do
  // território, que é onde muralha serve para alguma coisa.
  if (tipo === ED.muralha || tipo === ED.torre) {
    return acharNaBorda(mundo, a, largura, profundidade, tipo);
  }

  // Lavoura nasce junto do moinho, e não em qualquer canto que sobrou. É o que
  // dá o desenho de campo cultivado — o moinho no meio e o quadriculado da
  // plantação em volta. Antes a fazenda avulsa disputava lote com casa e
  // oficina, e como fazenda é a obra mais barata e mais frequente, ela acabava
  // salpicada pela vila inteira enquanto o moinho ficava sozinho no meio do
  // mato. Sem moinho por perto, a lavoura volta a procurar onde couber.
  // Assim que a vila tem moinho, a lavoura passa a ser **só** o campo dele:
  // sem vaga em volta de nenhum moinho, a fazenda não sai, e a vila gasta a
  // vez com outra obra (ou com mais um moinho, que abre campo novo). Deixar
  // a fazenda cair no lote genérico quando o campo enche desfazia o desenho
  // aos poucos — em trinta mil ticks, metade da lavoura estava salpicada
  // pela vila em vez de junta.
  if (tipo === ED.fazenda && a.moinhosIdx.length > 0) {
    return acharPertoDoMoinho(mundo, a, largura, profundidade);
  }

  // O moinho vai para o meio das roças que já existem, e não para o primeiro
  // lote livre. É o que resolve o legado: até poder erguer moinho, a vila
  // plantou um punhado de roças soltas, e sem esta preferência elas ficavam
  // órfãs para sempre num canto enquanto o campo novo crescia do outro lado.
  if (tipo === ED.moinho) {
    const noMeio = acharNoMeioDaLavoura(mundo, a, largura, profundidade);
    if (noMeio >= 0) return noMeio;
  }

  // A mina procura primeiro um lote que entre na rocha, e só sem nenhum aceita
  // chão plano. Antes ela só tinha **permissão** de ir para a serra e ia para
  // o primeiro lote livre do anel: num mundo, de duas minas, nenhuma estava
  // na montanha, e a obra que existe para entrar na rocha virava um galpão no
  // meio do campo.
  if (tipo === ED.mina) {
    const naRocha = varrerAneis(mundo, a, largura, profundidade, tipo, true);
    if (naRocha >= 0) return naRocha;
  }
  return varrerAneis(mundo, a, largura, profundidade, tipo, false);
}

/** O lote tem pelo menos um tile de rocha? */
function loteTemRocha(g: Mundo['grid'], x: number, y: number, largura: number, profundidade: number): boolean {
  for (let dy = 0; dy < profundidade; dy++) {
    for (let dx = 0; dx < largura; dx++) if (g.ehMontanha(g.idx(x + dx, y + dy))) return true;
  }
  return false;
}

/** Percorre os anéis da malha em volta da praça atrás do primeiro lote que sirva. */
function varrerAneis(
  mundo: Mundo, a: Aldeia, largura: number, profundidade: number, tipo: number,
  soNaRocha: boolean,
): number {
  const g = mundo.grid;
  const alcance = aneisDaAldeia(a);

  for (let anel = 0; anel <= alcance; anel++) {
    const candidatos = celulasDoAnel(anel);
    // sorteia a ordem dentro do anel para as aldeias não crescerem sempre para
    // o mesmo lado
    mundo.rng.embaralhar(candidatos);
    for (const [cx, cy] of candidatos) {
      for (let d = 0; d < MEIOS.length; d += 2) {
        const x = a.x + cx * PASSO + MEIOS[d] - (largura >> 1);
        const y = a.y + cy * PASSO + MEIOS[d + 1] - (profundidade >> 1);
        if (loteServe(mundo, a, x, y, largura, profundidade, tipo)) {
          if (!soNaRocha || loteTemRocha(g, x, y, largura, profundidade)) return g.idx(x, y);
          continue;
        }
        // A célula da malha vale **uma** obra. Se a posição principal foi
        // recusada porque já tem prédio ali, a célula está usada e acabou; as
        // posições de meio passo só entram quando o que barrou foi o terreno.
        //
        // Sem esta linha as quatro posições eram sempre tentadas, cada célula
        // de dez tiles recebia quatro casas e o espaçamento real caía de dez
        // para cinco — exatamente o bloco contínuo de telhado que o `PASSO`
        // largo existe para evitar. A malha dizia uma coisa e o mundo saía
        // com o dobro da densidade em cada eixo.
        if (_recusouPorObra) break;
      }
    }
  }
  return -1;
}

/**
 * Os deslocamentos que uma obra tenta dentro da mesma célula da malha.
 *
 * A trama principal é a primeira, e é ela que dá as ruas retas. As três de meio
 * passo são a saída para quando a posição certa não serve por motivo do
 * terreno, e não por já estar ocupada — água, montanha ou chão de outro povo,
 * que juntos respondiam pela maioria das recusas numa vila costeira. Sem elas,
 * uma vila que domina mil tiles tinha 81 posições na vida inteira, 34 de cada
 * 36 vilas ficavam sem lugar para construir, e o celeiro transbordava de
 * madeira que não virava nada.
 *
 * A ordem importa: se a posição da trama principal serve, é ela que leva, e o
 * quarteirão continua alinhado.
 */
const MEIOS = [0, 0, 3, 3, 3, 0, 0, 3];

/**
 * Por que `loteServe` recusou a última posição: obra vizinha, ou terreno?
 *
 * É uma variável de módulo, e não um retorno, para não alocar objeto dentro do
 * laço de escolha de lote — mesmo motivo dos `_eu`/`_espEu` da IA. Só tem
 * sentido no instante seguinte à chamada.
 */
let _recusouPorObra = false;

/**
 * Um lote de lavoura encostado num moinho da aldeia.
 *
 * Varre os moinhos que já estão de pé e procura vaga em volta de cada um, do
 * mais perto para o mais longe. Devolve -1 quando a aldeia não tem moinho ou
 * quando os campos dele já estão todos tomados — aí a fazenda segue o caminho
 * comum e vai para onde couber.
 */
function acharPertoDoMoinho(
  mundo: Mundo,
  a: Aldeia,
  largura: number,
  profundidade: number,
): number {
  const g = mundo.grid;

  for (const i of a.moinhosIdx) {
    if (g.construcao[i] !== ED.moinho + 1) continue;
    const mx = i % g.largura;
    const my = (i / g.largura) | 0;

    for (let anel = 1; anel <= RAIO_DA_LAVOURA; anel++) {
      const celulas = celulasDoAnel(anel);
      mundo.rng.embaralhar(celulas);
      for (const [cx, cy] of celulas) {
        const x = mx + cx * largura;
        const y = my + cy * profundidade;
        if (!loteServe(mundo, a, x, y, largura, profundidade, ED.fazenda)) continue;
        return g.idx(x, y);
      }
    }
  }
  return -1;
}

/**
 * Um lote para o moinho no meio da lavoura que a vila já tem.
 *
 * Calcula o centro das roças existentes e procura vaga a partir dele, saindo em
 * anéis. Devolve -1 se a vila ainda não plantou nada ou se não há vaga por lá —
 * aí o moinho vai para um lote comum, como qualquer obra.
 */
function acharNoMeioDaLavoura(
  mundo: Mundo,
  a: Aldeia,
  largura: number,
  profundidade: number,
): number {
  const g = mundo.grid;
  if (a.predios[ED.fazenda] === 0) return -1;

  const alcance = alcanceDaAldeia(a);
  let somaX = 0;
  let somaY = 0;
  let quantas = 0;
  for (let y = Math.max(0, a.y - alcance); y <= Math.min(g.altura - 1, a.y + alcance); y++) {
    for (let x = Math.max(0, a.x - alcance); x <= Math.min(g.largura - 1, a.x + alcance); x++) {
      const i = g.idx(x, y);
      if (g.construcao[i] !== ED.fazenda + 1 || g.aldeiaDona[i] !== a.id) continue;
      somaX += x;
      somaY += y;
      quantas++;
    }
  }
  if (quantas === 0) return -1;

  const cx = Math.round(somaX / quantas);
  const cy = Math.round(somaY / quantas);
  for (let anel = 0; anel <= RAIO_DA_LAVOURA + 1; anel++) {
    const celulas = celulasDoAnel(anel);
    mundo.rng.embaralhar(celulas);
    for (const [dx, dy] of celulas) {
      const x = cx + dx * 2;
      const y = cy + dy * 2;
      if (!loteServe(mundo, a, x, y, largura, profundidade, ED.moinho)) continue;
      return g.idx(x, y);
    }
  }
  return -1;
}

/**
 * Quantos anéis de lavoura cabem em volta de um moinho.
 *
 * Em tiles isso dá um campo de cerca de doze por doze: grande o bastante para
 * se ler como plantação de longe, pequeno o bastante para não engolir a vila.
 */
const RAIO_DA_LAVOURA = 3;

/** As células de um anel quadrado em volta da origem. */
function celulasDoAnel(anel: number): Array<[number, number]> {
  if (anel === 0) return [[0, 0]];
  const saida: Array<[number, number]> = [];
  for (let d = -anel; d <= anel; d++) {
    saida.push([d, -anel], [d, anel], [-anel, d], [anel, d]);
  }
  return saida;
}

/**
 * O lote serve para aquela obra?
 *
 * Exportada porque a mão do jogador ergue onde ele clica, e não onde a vila
 * escolheria — mas as regras têm de ser as mesmas. Ver as ferramentas de obra
 * em `src/sim/poderesDerivados.ts`.
 */
export function loteServe(
  mundo: Mundo,
  a: Aldeia,
  x: number,
  y: number,
  largura: number,
  profundidade: number,
  tipo: number,
): boolean {
  const g = mundo.grid;
  _recusouPorObra = false;
  if (x < 0 || y < 0 || x + largura > g.largura || y + profundidade > g.altura) return false;

  const naRocha = ED_MONTANHA[tipo] === 1;
  const cais = ED_NA_AGUA[tipo] === 1;

  // Porto quer o pé na água, e não em qualquer água: praia e lago dão margem
  // para atracar, rio não — mesmo largo, é uma fita estreita entre dois
  // barrancos. É a única obra do jogo que exige o vizinho e não só o chão.
  if (cais && !temMargemDeAtracar(g, x, y, largura, profundidade)) return false;

  // O cais **avança sobre a água**, e é isso que o faz caber.
  //
  // Enquanto ele precisou de terra firme nos doze tiles, só duas de vinte vilas
  // costeiras achavam onde erguê-lo: um retângulo de quatro por três inteiro em
  // terra, colado no mar e alinhado à malha de lotes, quase não existe numa
  // costa recortada. Metade na água resolve, e é o que um porto de verdade é.
  let terraNoLote = 0;
  let aguaNoLote = 0;

  for (let dy = 0; dy < profundidade; dy++) {
    for (let dx = 0; dx < largura; dx++) {
      const i = g.idx(x + dx, y + dy);
      if (!g.ehTerra(i)) {
        if (!cais || g.bioma[i] === B.rio) return false;
        aguaNoLote++;
        continue;
      }
      terraNoLote++;
      // Só a mina se ergue em rocha: é o prédio que existe justamente para
      // entrar na montanha. O resto precisa de chão plano.
      if (g.ehMontanha(i) && !naRocha) return false;
      if (g.fogo[i] > 0) return false;
      if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) {
        _recusouPorObra = true;
        return false;
      }
      if (!naRocha && BIOMA_HABITAVEL[g.bioma[i]] <= 0) return false;
      // A obra sai **dentro do próprio território**, e só.
      //
      // Antes bastava não ser de outro povo: terra de ninguém servia. O
      // resultado era vila que se espalhava para fora do que dominava, e
      // território deixava de significar alguma coisa — dava no mesmo ter ou
      // não ter a terra. Agora dominar vem primeiro, construir vem depois, e é
      // isso que faz expandir a fronteira ser o objetivo que você quer que seja.
      if (g.aldeiaDona[i] !== a.id) return false;
      // Nada do que está no chão barra a obra: mata se derruba e pedra se
      // arranca, e as duas coisas vão para o estoque da vila (`erguer`). Quando
      // veio de minério barrava, a conta era outra — desde que minério passou a
      // nascer no mundo inteiro, um em cada cinco lotes ficava vetado, e as
      // vilas acumulavam material sem ter onde construir. O que não se remove
      // continua de fora: água, rocha de montanha e chão de outro povo.
    }
  }

  // o cais precisa de chão para o galpão e de água para o deque
  if (cais && (terraNoLote < 2 || aguaNoLote < 2)) return false;

  // Uma faixa livre em volta. Sem ela os prédios encostam uns nos outros e a
  // vila vira um bloco contínuo de telhado, sem quintal nem passagem — e como
  // o desenho sobe acima da base, um vizinho colado fica escondido atrás.
  for (let dy = -1; dy <= profundidade; dy++) {
    for (let dx = -1; dx <= largura; dx++) {
      const dentro = dx >= 0 && dx < largura && dy >= 0 && dy < profundidade;
      if (dentro) continue;
      const bx = x + dx;
      const by = y + dy;
      if (!g.dentro(bx, by)) continue;
      const i = g.idx(bx, by);
      if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) {
        _recusouPorObra = true;
        return false;
      }
    }
  }
  return true;
}

/**
 * Há mar ou lago encostado neste lote, com espaço para um barco sair?
 *
 * Exige **três** tiles de água na borda, e não um: um respingo de água num
 * canto do terreno não é um cais, e o porto acabava plantado num charco onde
 * barco nenhum passaria.
 */
function temMargemDeAtracar(
  g: Grid,
  x: number,
  y: number,
  largura: number,
  profundidade: number,
): boolean {
  let agua = 0;
  for (let dy = -1; dy <= profundidade; dy++) {
    for (let dx = -1; dx <= largura; dx++) {
      const dentro = dx >= 0 && dx < largura && dy >= 0 && dy < profundidade;
      if (dentro) continue;
      const bx = x + dx;
      const by = y + dy;
      if (!g.dentro(bx, by)) continue;
      const i = g.idx(bx, by);
      if (!g.ehAgua(i)) continue;
      // rio não serve de ancoradouro
      if (g.bioma[i] === B.rio) continue;
      agua++;
      if (agua >= 3) return true;
    }
  }
  return false;
}

/** Muralha e torre querem a borda do território, não o miolo. */
function acharNaBorda(
  mundo: Mundo,
  a: Aldeia,
  largura: number,
  profundidade: number,
  tipo: number,
): number {
  const g = mundo.grid;
  for (let t = 0; t < 40; t++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const d = a.raio * mundo.rng.entre(0.82, 1);
    const x = Math.round(a.x + Math.cos(ang) * d);
    const y = Math.round(a.y + Math.sin(ang) * d);
    if (loteServe(mundo, a, x, y, largura, profundidade, tipo)) return g.idx(x, y);
  }
  return -1;
}

/**
 * Liga um ponto à praça central por uma estrada em L.
 *
 * O caminho anda primeiro num eixo e depois no outro, e como os lotes estão
 * todos na mesma malha, os trechos se encontram e formam ruas de verdade em vez
 * de um feixe de linhas saindo do centro.
 */
export function ligarAoCentro(mundo: Mundo, a: Aldeia, x: number, y: number): void {
  const primeiroEmX = ((x + y) & 1) === 0;

  let cx = x;
  let cy = y;
  const passoX = () => {
    while (cx !== a.x) {
      cx += cx < a.x ? 1 : -1;
      pavimentar(mundo, cx, cy);
    }
  };
  const passoY = () => {
    while (cy !== a.y) {
      cy += cy < a.y ? 1 : -1;
      pavimentar(mundo, cx, cy);
    }
  };

  pavimentar(mundo, cx, cy);
  if (primeiroEmX) {
    passoX();
    passoY();
  } else {
    passoY();
    passoX();
  }
}

/**
 * Assenta estrada num tile, se der. Estrada é chão: não disputa com prédio.
 *
 * O caminho **contorna** as árvores em vez de derrubá-las. Quando derrubava,
 * cada obra nova abria uma clareira até a praça e a aldeia acabava cercada de
 * terra pelada — sem árvore por perto, os lenhadores não traziam madeira e a
 * aldeia inteira parava de crescer. A trilha com falhas entre os troncos é o
 * que se vê num povoado de verdade.
 */
export function pavimentar(mundo: Mundo, x: number, y: number): void {
  const g = mundo.grid;
  if (!g.dentro(x, y)) return;
  const i = g.idx(x, y);
  if (g.ehAgua(i) || g.ehMontanha(i)) return;
  if (g.estrada[i] === 1) return;
  if (g.recurso[i] !== 0) return;
  // rua não passa por dentro de casa: o caminho começa no próprio lote da obra
  // que o pediu, então sem esta guarda ele pavimentava o piso dela
  if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) return;
  g.estrada[i] = 1;
  g.vegetacao[i] = 0;
  g.marcarSujo(x, y);
}

/**
 * Semeia lavoura em volta de um prédio que pede isso — hoje, o moinho.
 * É o que faz o moinho aparecer no mapa cercado de plantação, como manda a
 * figura de qualquer vilarejo.
 */
export function semearEmVolta(mundo: Mundo, a: Aldeia, ancora: number, raio: number): void {
  const g = mundo.grid;
  const ax = ancora % g.largura;
  const ay = (ancora / g.largura) | 0;
  const larguraFazenda = ED_OCUPA[ED.fazenda * 2];
  const profFazenda = ED_OCUPA[ED.fazenda * 2 + 1];

  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (Math.abs(dx) + Math.abs(dy) < 2) continue; // deixa o pé do moinho livre
      const x = ax + dx * larguraFazenda;
      const y = ay + dy * profFazenda;
      if (!loteServe(mundo, a, x, y, larguraFazenda, profFazenda, ED.fazenda)) continue;
      if (!mundo.rng.chance(0.65)) continue;
      erguer(mundo, a, g.idx(x, y), ED.fazenda);
    }
  }
}

/**
 * Coloca uma construção no mapa: marca o tile-âncora, toma a área e passa o
 * território para a aldeia. Não cobra material — quem decide o gasto é
 * `civilizacao.ts`.
 */
export function erguer(
  mundo: Mundo,
  a: Aldeia,
  ancora: number,
  tipo: number,
  material = 0,
): void {
  const g = mundo.grid;
  const largura = ED_OCUPA[tipo * 2];
  const profundidade = ED_OCUPA[tipo * 2 + 1];
  const ax = ancora % g.largura;
  const ay = (ancora / g.largura) | 0;

  g.construcao[ancora] = tipo + 1;
  // De que é feito e quem fez. Fica gravado no tile e não é recalculado nunca:
  // a casa de palha que a tribo levantou continua de palha depois de o reino
  // descobrir a cantaria, e é essa mistura que faz a vila contar a própria
  // história no mapa.
  g.acabamento[ancora] = empacotarAcabamento(material, a.especie);
  g.ocupar(ancora, largura, profundidade);
  for (let dy = 0; dy < profundidade; dy++) {
    for (let dx = 0; dx < largura; dx++) {
      const i = g.idx(ax + dx, ay + dy);
      // A mata do lote vai abaixo, mas a madeira não se perde: vai para o
      // estoque, como aconteceria com quem limpa um terreno para construir.
      const r = g.recurso[i];
      if (r !== 0) {
        // Limpar o terreno rende: a madeira derrubada e a pedra arrancada vão
        // para o estoque, como aconteceria com quem abre um lote de verdade.
        const chave = REC_MATERIAL[r - 1] as keyof typeof a.estoque;
        if (chave in a.estoque) {
          a.estoque[chave] = Math.min(a.capacidadeEstoque, a.estoque[chave] + g.recursoQtd[i] * 0.5);
        }
        g.limparRecurso(i);
      }
      // Erguer também toma chão, e isso conta no território da vila. Sem somar
      // aqui, o contador ficava até um terço abaixo do que a vila realmente
      // dominava — e o limite que deveria forçar a fundação de vilas novas não
      // segurava nada, porque a vila continuava se espalhando pelas obras.
      if (g.aldeiaDona[i] !== a.id) {
        const antigo = g.aldeiaDona[i];
        if (antigo >= 0) {
          const perdedora = mundo.aldeias[antigo];
          if (perdedora?.ativa) perdedora.tilesTerritorio = Math.max(0, perdedora.tilesTerritorio - 1);
        }
        a.tilesTerritorio++;
      }
      g.aldeiaDona[i] = a.id;
      g.territorio[i] = a.reino;
      g.vegetacao[i] = 0;
      g.estrada[i] = 0;
    }
  }
  g.marcarSujo(ax, ay);
}

/** Tira uma construção do mapa e devolve o chão. */
export function derrubar(mundo: Mundo, ancora: number, virarRuina: boolean): void {
  const g = mundo.grid;
  const tipo = g.construcao[ancora] - 1;
  if (tipo < 0) return;
  // acidente do terreno não vem abaixo (ver `Edificio.natural`)
  if (ED_NATURAL[tipo] === 1) return;
  const largura = ED_OCUPA[tipo * 2];
  const profundidade = ED_OCUPA[tipo * 2 + 1];
  g.desocupar(ancora, largura, profundidade);
  g.construcao[ancora] = virarRuina && tipo !== ED.ruina ? ED.ruina + 1 : 0;
  if (g.construcao[ancora] !== 0) {
    g.ocupar(ancora, ED_OCUPA[ED.ruina * 2], ED_OCUPA[ED.ruina * 2 + 1]);
  }
  g.marcarSujoIdx(ancora);
}

/** O tile-âncora da construção que cobre este tile, ou -1. */
export function ancoraDaConstrucao(mundo: Mundo, i: number): number {
  const g = mundo.grid;
  if (g.construcao[i] !== 0) return i;
  const dono = g.ocupacao[i];
  if (dono >= 0 && g.construcao[dono] !== 0) return dono;
  return -1;
}


