import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ED_MORADIA, ED_OCUPA, MAT_FATOR, materialDoAcabamento } from '../dados/edificios.js';
import { ESP_ESPERA_FILHO, ESP_HIBRIDO, especies } from '../dados/especies.js';
import { Campo, MASCARA_RARA } from '../dados/tracos.js';
import { especieDoFilho, fator, podemCruzar, tracosDoFilho, vidaMaxima } from './genetica.js';
import { BAL } from './balanco.js';

/**
 * As casas por dentro.
 *
 * Um ser inteligente não tem filho no meio do campo: ele procura uma casa da
 * própria aldeia com vaga, entra, e é lá — com outro adulto do mesmo povo —
 * que nasce a criança. Enquanto está dentro, some do mapa, não anda e não
 * apanha.
 *
 * É o que dá função ao prédio mais comum do jogo. Antes a casa só aumentava um
 * número de capacidade; agora ela é a condição concreta de a civilização
 * crescer, e uma aldeia sem casas não faz gente nova por mais comida que tenha.
 */

/** Quantos cabem em cada casa, por tile-âncora. Refeito a cada passada. */
const ocupantes = new Map<number, number>();

export const sistemaMoradia: Sistema = {
  id: 'moradia',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;

    ocupantes.clear();
    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i] || c.abrigo[i] < 0) continue;
      ocupantes.set(c.abrigo[i], (ocupantes.get(c.abrigo[i]) ?? 0) + 1);
    }

    // agrupa quem está dentro de cada casa para resolver os casais
    const porCasa = new Map<number, number[]>();

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      const casa = c.abrigo[i];
      if (casa < 0) continue;

      // a casa pode ter caído com a criatura dentro
      if (mundo.grid.construcao[casa] === 0) {
        sair(mundo, i);
        continue;
      }

      c.tempoAbrigo[i] -= 1;
      if (c.tempoAbrigo[i] <= 0) {
        sair(mundo, i);
        continue;
      }

      let lista = porCasa.get(casa);
      if (!lista) porCasa.set(casa, (lista = []));
      lista.push(i);
    }

    for (const [casa, dentro] of porCasa) {
      if (dentro.length < 2) continue;
      resolverCasal(mundo, casa, dentro);
    }
  },
};

/**
 * Dois adultos dentro da mesma casa: nasce alguém.
 *
 * **Não precisam ser do mesmo povo.** Se os dois povos se toleram — o ódio
 * entre eles está abaixo de `BAL.odioParaCruzar` —, o filho é um mestiço; ver
 * `src/sim/genetica.ts`. Com a tabela de hoje isso acontece entre humano e
 * elfo e entre humano e anão, e não acontece entre elfo e anão nem com orc
 * nenhum. Não é uma regra escrita à parte: é a mesma tabela de ódio que decide
 * se dois reinos vão à guerra.
 *
 * A ordem em que a casa é varrida importa desde que a beleza existe: quem é
 * belo é considerado antes, e quem é feio fica para o fim da fila. É o único
 * lugar em que um traço mexe em **quem** faz alguma coisa, e não em quanto.
 */
function resolverCasal(mundo: Mundo, casa: number, dentro: number[]): void {
  const c = mundo.criaturas;
  dentro.sort((x, y) => fator(c.tracos[y], Campo.beleza) - fator(c.tracos[x], Campo.beleza));
  for (let a = 0; a < dentro.length; a++) {
    const i = dentro[a];
    if (c.esperaFilho[i] > 0) continue;
    for (let b = a + 1; b < dentro.length; b++) {
      const j = dentro[b];
      if (!podemCruzar(c.especie[i], c.especie[j])) continue;
      if (c.esperaFilho[j] > 0) continue;

      const aldeiaId = c.aldeia[i];
      const aldeia = aldeiaId >= 0 ? mundo.aldeias[aldeiaId] : undefined;
      if (!aldeia?.ativa) return;
      if (aldeia.populacao >= aldeia.capacidade) return;
      if (mundo.criaturas.quantidade >= mundo.criaturas.capacidade * 0.95) return;

      // De que povo sai o filho. Dos mesmos pais só sai um povo, mas a conta é
      // refeita por filhote porque de mestiço com puro cada filho pode puxar
      // um lado diferente.
      const esp = c.especie[i];
      const def = especies.porIndice(esp);
      const quantos = mundo.rng.intEntre(def.ninhada[0], def.ninhada[1]);
      for (let k = 0; k < quantos; k++) {
        const espFilho = especieDoFilho(mundo, c.especie[i], c.especie[j]);
        const x = casa % mundo.grid.largura;
        const y = (casa / mundo.grid.largura) | 0;
        const filho = mundo.nascer(
          espFilho,
          x + mundo.rng.entre(0, 1.5),
          y + mundo.rng.entre(0, 1.5),
          0,
          'casa',
        );
        if (filho < 0) break;
        c.aldeia[filho] = aldeiaId;
        c.reino[filho] = c.reino[i];
        // A linhagem passa aqui, e é o que faz a sucessão do trono existir:
        // filho de rei nasce da casa real e, no dia em que o pai morrer, é ele
        // que herda. Se um dos pais não tem família registrada, o filho leva a
        // do outro; se nenhum tem, funda uma.
        const casaPai = c.familia[i] >= 0 ? c.familia[i] : c.familia[j];
        c.familia[filho] = casaPai >= 0 ? casaPai : mundo.novaFamilia();
        if (casaPai < 0) {
          c.familia[i] = c.familia[filho];
          c.familia[j] = c.familia[filho];
        }
        // clã e lealdade também vêm de casa
        c.cla[filho] = c.cla[i] >= 0 ? c.cla[i] : c.cla[j];
        c.fidelidade[filho] = (c.fidelidade[i] + c.fidelidade[j]) / 2;
        // E os traços, que é o que faz uma linhagem ter cara. `nascer` já pôs
        // um sorteio sem pais; aqui ele é substituído pela herança de verdade,
        // e vida, longevidade e espera são refeitas por cima dela.
        c.tracos[filho] = tracosDoFilho(mundo, espFilho, i, j);
        // Um traço raro é notícia. Hoje só o imortal passa por aqui, e é ele
        // que a crônica registra — o resto do mundo vai conviver com aquilo por
        // muito tempo.
        const raro = c.tracos[filho] & MASCARA_RARA;
        if (raro !== 0) {
          mundo.eventos.emitir('criatura:prodigio', {
            id: filho,
            especie: espFilho,
            traco: 31 - Math.clz32(raro),
          });
        }
        c.vida[filho] = vidaMaxima(c, filho);
        c.longevidade[filho] *= fator(c.tracos[filho], Campo.longevidade);
        c.esperaFilho[filho] *= fator(c.tracos[filho], Campo.espera);
        // Só quando o filho é **ele mesmo** um povo mestiço. Filho puro de um
        // casal com um mestiço dentro não é mestiçagem: é a linhagem voltando
        // para um dos lados, e anunciar isso encheria a crônica de "nasceu o
        // primeiro anão" no meio de um mundo cheio de anões.
        if (ESP_HIBRIDO[espFilho] === 1) {
          mundo.eventos.emitir('criatura:mesticou', {
            id: filho,
            especie: espFilho,
            pai: c.especie[i],
            mae: c.especie[j],
          });
        }
        aldeia.populacao++;
      }

      // A espera do próximo filho é de cada um: quem é fértil volta antes.
      c.esperaFilho[i] = ESP_ESPERA_FILHO[c.especie[i]] * fator(c.tracos[i], Campo.espera);
      c.esperaFilho[j] = ESP_ESPERA_FILHO[c.especie[j]] * fator(c.tracos[j], Campo.espera);
      sair(mundo, i);
      sair(mundo, j);
      return;
    }
  }
}

/** Põe a criatura de volta na rua, ao pé da casa. */
export function sair(mundo: Mundo, i: number): void {
  const c = mundo.criaturas;
  const casa = c.abrigo[i];
  c.abrigo[i] = -1;
  c.tempoAbrigo[i] = 0;
  // devolve a vaga na hora: a contagem só é refeita na passada seguinte, e até
  // lá a casa recusaria alguém que já cabia
  if (casa >= 0) {
    const quantos = ocupantes.get(casa);
    if (quantos !== undefined) ocupantes.set(casa, Math.max(0, quantos - 1));
  }
  if (casa >= 0) {
    const g = mundo.grid;
    const tipo = g.construcao[casa] - 1;
    const prof = tipo >= 0 ? ED_OCUPA[tipo * 2 + 1] : 1;
    c.x[i] = (casa % g.largura) + 0.5;
    c.y[i] = Math.min(g.altura - 0.01, ((casa / g.largura) | 0) + prof + 0.2);
  }
  c.estado[i] = Estado.Vagando;
  c.destinoX[i] = -1;
}

/** Faz a criatura entrar na casa, se ainda houver vaga. */
export function entrar(mundo: Mundo, i: number, casa: number): boolean {
  const c = mundo.criaturas;
  if (vagasNaCasa(mundo, casa) <= 0) return false;
  c.abrigo[i] = casa;
  c.tempoAbrigo[i] = BAL.tempoDentroDeCasa;
  c.estado[i] = Estado.Dormindo;
  c.destinoX[i] = -1;
  c.alvo[i] = -1;
  ocupantes.set(casa, (ocupantes.get(casa) ?? 0) + 1);
  return true;
}

export function vagasNaCasa(mundo: Mundo, casa: number): number {
  const tipo = mundo.grid.construcao[casa] - 1;
  if (tipo < 0) return 0;
  const bruto = ED_MORADIA[tipo];
  if (bruto === 0) return 0;
  // quantos dormem dentro também depende do material: choça de palha é menor
  const cabe = Math.max(1, Math.round(
    bruto * MAT_FATOR[materialDoAcabamento(mundo.grid.acabamento[casa])],
  ));
  return cabe - (ocupantes.get(casa) ?? 0);
}

/**
 * A casa com vaga mais próxima de quem procura.
 *
 * Lê a lista que a aldeia mantém (`Aldeia.casasIdx`) em vez de sortear pontos
 * no mapa. Sortear não funcionava: uma casa ocupa 2×2 e só o tile-âncora
 * responde por ela, então três de cada quatro acertos caíam num canto que o
 * jogo não reconhece como casa. O resultado media-se no mundo — 200 casas de
 * pé, todas com vaga, e três pessoas dentro.
 */
export function acharCasaComVaga(
  mundo: Mundo,
  a: Aldeia,
  alcance: number,
  x: number,
  y: number,
): number {
  const g = mundo.grid;
  const limite = alcance * alcance;
  let melhor = -1;
  let melhorD = Infinity;
  for (const i of a.casasIdx) {
    if (g.aldeiaDona[i] !== a.id) continue;
    if (vagasNaCasa(mundo, i) <= 0) continue;
    const dx = (i % g.largura) - x;
    const dy = ((i / g.largura) | 0) - y;
    const d = dx * dx + dy * dy;
    if (d > limite || d >= melhorD) continue;
    melhor = i;
    melhorD = d;
  }
  return melhor;
}

/** A criatura já chegou na porta da casa que procurava? */
export function naPorta(mundo: Mundo, i: number, casa: number): boolean {
  const c = mundo.criaturas;
  const g = mundo.grid;
  const tipo = g.construcao[casa] - 1;
  if (tipo < 0) return false;
  const l = ED_OCUPA[tipo * 2];
  const p = ED_OCUPA[tipo * 2 + 1];
  const cx = (casa % g.largura) + l / 2;
  const cy = ((casa / g.largura) | 0) + p / 2;
  const dx = c.x[i] - cx;
  const dy = c.y[i] - cy;
  return dx * dx + dy * dy < (l + p) * 0.8;
}

