import type { Mundo } from '../core/mundo.js';
import type { Criaturas } from '../core/criaturas.js';
import {
  ESP_CIVILIZADO, ESP_INTELIGENTE, ESP_VIDA, MESTICO_DE, ODIO_POVOS, TOTAL_ESPECIES,
} from '../dados/especies.js';
import { Campo, CAMPOS, TRACO_FATOR, TRACO_OPOSTOS, TRACO_PESO, TOTAL_TRACOS } from '../dados/tracos.js';
import { BAL } from './balanco.js';

/**
 * Genética: quem pode ter filho com quem, e o que o filho puxa dos pais.
 *
 * Duas coisas moram aqui, e elas são a mesma ideia vista de dois lados. A
 * **espécie** do filho responde de que povo ele é; os **traços** respondem quem
 * ele é dentro daquele povo.
 *
 * Cruzamento entre povos usa o ódio que a diplomacia já media (`ODIO_POVOS`).
 * Não é uma regra nova nem um número novo: se dois povos se detestam, não há
 * casal; se eles se toleram, há. Com a tabela de hoje isso libera humano com
 * elfo e humano com anão, e o resto continua trancado até que a história (ou o
 * jogador) mude o ódio.
 *
 * Herança de traço é a parte que dá continuidade ao mundo: uma linhagem de
 * gente forte continua forte, e uma família de imortais é um problema que se
 * arrasta por séculos. Cada traço de cada pai passa com
 * `BAL.herancaDeTraco` de chance, e por cima disso há mutação — sem ela, o
 * conjunto de traços do mundo só poderia encolher.
 */

/**
 * Dois povos podem ter filho?
 *
 * Mesma espécie sempre pode. Espécies diferentes, só se forem dois **povos**
 * (bicho não cruza com bicho: foi decisão de escopo) e se o ódio entre eles
 * estiver abaixo do limiar.
 */
export function podemCruzar(a: number, b: number): boolean {
  if (a === b) return true;
  if (ESP_CIVILIZADO[a] === 0 || ESP_CIVILIZADO[b] === 0) return false;
  // O teste é só o ódio, e vale para mestiço também. A primeira versão exigia
  // que existisse um mestiço registrado para aquele par, e com isso um
  // meio-elfo não podia ter filho com ninguém a não ser outro meio-elfo — a
  // primeira geração de mestiços virava um beco sem saída genético. Ódio é
  // definido para todos os povos, inclusive os mestiços, porque todos eles têm
  // xenofobia; e o que sai de mestiço com puro `especieDoFilho` resolve.
  return ODIO_POVOS[a * TOTAL_ESPECIES + b] < BAL.odioParaCruzar;
}

/**
 * De que povo nasce o filho daquele casal.
 *
 * Pais do mesmo povo fazem gente daquele povo. Pais de povos diferentes fazem
 * um mestiço — **mas só na primeira geração**. Filho de mestiço com qualquer um
 * sai mestiço ou do povo do outro, sorteado meio a meio, e nunca uma espécie
 * nova: sem esse corte, oito gerações produziriam um registro de centenas de
 * povos que ninguém consegue ler na tela nem desenhar.
 */
export function especieDoFilho(mundo: Mundo, a: number, b: number): number {
  if (a === b) return a;
  const mestico = MESTICO_DE[a * TOTAL_ESPECIES + b];
  if (mestico >= 0) return mestico;
  // um dos dois já é mestiço: o filho puxa um dos lados
  return mundo.rng.chance(0.5) ? a : b;
}

/**
 * Os traços com que alguém nasce, a partir dos dois pais.
 *
 * Só para inteligentes — bicho carrega o zero e não paga nada por isso.
 *
 * `pai` e `mae` podem ser -1: é o caso de quem chega de fora, de quem o jogador
 * cria e dos primeiros moradores do mundo. Aí não há herança, só o sorteio.
 */
export function tracosDoFilho(mundo: Mundo, especie: number, pai: number, mae: number): number {
  if (ESP_INTELIGENTE[especie] === 0) return 0;
  const c = mundo.criaturas;
  let m = 0;

  if (pai >= 0 || mae >= 0) {
    const herdaveis = (pai >= 0 ? c.tracos[pai] : 0) | (mae >= 0 ? c.tracos[mae] : 0);
    for (let t = 0; t < TOTAL_TRACOS; t++) {
      const bit = 1 << t;
      if ((herdaveis & bit) === 0) continue;
      // Traço que os dois têm passa muito mais fácil. É o que faz uma família
      // ter cara: dois pais fortes quase sempre fazem filho forte.
      const dobrado = pai >= 0 && mae >= 0
        && (c.tracos[pai] & bit) !== 0 && (c.tracos[mae] & bit) !== 0;
      const chance = dobrado ? BAL.herancaDeTracoDobrada : BAL.herancaDeTraco;
      if (!mundo.rng.chance(chance)) continue;
      if ((m & TRACO_OPOSTOS[t]) !== 0) continue;
      m |= bit;
    }
  }

  // Mutação: sem ela o mundo só perderia traço com o tempo, porque cada
  // herança é um dado que pode dar errado.
  if (mundo.rng.chance(BAL.chanceDeMutacao)) m = comTracoSorteado(mundo, m);
  // e quem não tem pai nenhum começa com o que o sorteio der
  if (pai < 0 && mae < 0 && mundo.rng.chance(BAL.chanceDeTracoAoChegar)) {
    m = comTracoSorteado(mundo, m);
  }
  return m;
}

/**
 * Acrescenta um traço sorteado à máscara, respeitando os opostos.
 *
 * O sorteio é por peso: forte e ágil são comuns, imortal é uma em algumas
 * centenas. Exportada porque o poder de mutação do jogador usa a mesma conta —
 * o que a mão dele faz é o que a natureza faria, só que na hora.
 */
export function comTracoSorteado(mundo: Mundo, mascara: number): number {
  let sorteio = mundo.rng.f() * PESO_DISPONIVEL(mascara);
  for (let t = 0; t < TOTAL_TRACOS; t++) {
    const bit = 1 << t;
    if ((mascara & bit) !== 0) continue;
    if ((mascara & TRACO_OPOSTOS[t]) !== 0) continue;
    sorteio -= TRACO_PESO[t];
    if (sorteio <= 0) return mascara | bit;
  }
  return mascara;
}

/** Soma dos pesos dos traços que ainda cabem naquela máscara. */
function PESO_DISPONIVEL(mascara: number): number {
  let soma = 0;
  for (let t = 0; t < TOTAL_TRACOS; t++) {
    const bit = 1 << t;
    if ((mascara & bit) !== 0) continue;
    if ((mascara & TRACO_OPOSTOS[t]) !== 0) continue;
    soma += TRACO_PESO[t];
  }
  return soma;
}

/**
 * A vida máxima daquela criatura, já com os traços dentro.
 *
 * `ESP_VIDA` deixou de ser o teto: um forte tem mais vida que um franzino do
 * mesmo povo. Todo lugar que curava, comparava ou media "quanto falta" tem de
 * passar por aqui, senão o forte fica curando até um teto que não é o dele.
 */
export function vidaMaxima(c: Criaturas, i: number): number {
  return ESP_VIDA[c.especie[i]] * fator(c.tracos[i], Campo.vida);
}

/**
 * Quanto os traços daquela criatura multiplicam um campo.
 *
 * O caso esmagadoramente comum é `mascara === 0` — todo bicho do mapa e boa
 * parte da gente —, e ele sai na primeira linha sem tocar em array nenhum. Nos
 * outros, o laço anda sobre bits e para na hora: ninguém carrega mais que uns
 * poucos traços.
 */
export function fator(mascara: number, campo: Campo): number {
  if (mascara === 0) return 1;
  let f = 1;
  let m = mascara;
  let t = 0;
  while (m !== 0) {
    if ((m & 1) !== 0) f *= TRACO_FATOR[t * CAMPOS + campo];
    m >>>= 1;
    t++;
  }
  return f;
}
