import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ED_MORADIA, ED_OCUPA } from '../dados/edificios.js';
import { ESP_ESPERA_FILHO, especies } from '../dados/especies.js';
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

/** Dois adultos do mesmo povo dentro da mesma casa: nasce alguém. */
function resolverCasal(mundo: Mundo, casa: number, dentro: number[]): void {
  const c = mundo.criaturas;
  for (let a = 0; a < dentro.length; a++) {
    const i = dentro[a];
    if (c.esperaFilho[i] > 0) continue;
    for (let b = a + 1; b < dentro.length; b++) {
      const j = dentro[b];
      if (c.especie[j] !== c.especie[i]) continue;
      if (c.esperaFilho[j] > 0) continue;

      const aldeiaId = c.aldeia[i];
      const aldeia = aldeiaId >= 0 ? mundo.aldeias[aldeiaId] : undefined;
      if (!aldeia?.ativa) return;
      if (aldeia.populacao >= aldeia.capacidade) return;
      if (mundo.criaturas.quantidade >= mundo.criaturas.capacidade * 0.95) return;

      const esp = c.especie[i];
      const def = especies.porIndice(esp);
      const quantos = mundo.rng.intEntre(def.ninhada[0], def.ninhada[1]);
      for (let k = 0; k < quantos; k++) {
        const x = casa % mundo.grid.largura;
        const y = (casa / mundo.grid.largura) | 0;
        const filho = mundo.nascer(
          esp,
          x + mundo.rng.entre(0, 1.5),
          y + mundo.rng.entre(0, 1.5),
          0,
          'casa',
        );
        if (filho < 0) break;
        c.aldeia[filho] = aldeiaId;
        c.reino[filho] = c.reino[i];
        aldeia.populacao++;
      }

      const espera = ESP_ESPERA_FILHO[esp];
      c.esperaFilho[i] = espera;
      c.esperaFilho[j] = espera;
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
  const cabe = ED_MORADIA[tipo];
  if (cabe === 0) return 0;
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

