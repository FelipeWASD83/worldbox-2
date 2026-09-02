import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { ESP_CIVILIZADO, ESP_VISAO } from '../dados/especies.js';
import { BAL } from './balanco.js';

/**
 * A névoa diplomática: quem sabe que quem existe, e como a notícia viaja.
 *
 * Até aqui todo reino nascia sabendo de todos os outros. Dois impérios em
 * pontas opostas de um continente já tinham uma relação numérica no primeiro
 * tick, azedando ou melhorando sem que uma única pessoa dos dois lados tivesse
 * se visto. Isso é o mundo visto de cima — a visão do jogador — imposta a quem
 * está dentro dele.
 *
 * Aqui o conhecimento tem de andar, e anda **dentro de uma pessoa**:
 *
 * 1. Alguém sai da aldeia e esbarra num estrangeiro, ou pisa em chão que já tem
 *    dono. Guarda a novidade em `criaturas.noticia`.
 * 2. Enquanto a notícia está com ela, ela é a única cópia que existe no mundo.
 *    **Se morrer no caminho, a notícia morre junto** e o encontro não deixa
 *    marca nenhuma — os dois reinos continuam se ignorando.
 * 3. Se chegar viva à própria vila, conta a quem manda ali, e só então os dois
 *    reinos passam a existir um para o outro.
 *
 * O efeito colateral disso é o que interessa: um reino cercado de montanha
 * demora décadas para descobrir o vizinho, e um reino de comerciantes conhece
 * meio mapa. A geografia passa a decidir a política em vez de ser cenário.
 *
 * Custo: o pool é varrido em fatias, e a consulta espacial — a parte cara — só
 * roda para quem ainda não carrega notícia e não achou nada no chão sob os pés.
 */

/** Em quantas fatias o pool é dividido entre uma execução e a seguinte. */
const FATIAS = 6;

export const sistemaContato: Sistema = {
  id: 'contato',
  intervalo: BAL.intervaloContato,
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const passada = Math.floor(mundo.tick / BAL.intervaloContato) % FATIAS;

    for (let i = passada; i < c.limite; i += FATIAS) {
      if (!c.vivo[i]) continue;
      if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
      const meu = c.reino[i];
      if (meu < 0 || !mundo.reinos[meu]?.ativo) continue;

      // ------------------------------------------------- 1. entregar a notícia
      const trazendo = c.noticia[i];
      if (trazendo >= 0) {
        if (!mundo.reinos[trazendo]?.ativo) {
          c.noticia[i] = -1; // o reino de que ela ia falar acabou no meio do caminho
        } else if (chegouEmCasa(mundo, i)) {
          mundo.apresentarReinos(meu, trazendo, i);
          c.noticia[i] = -1;
        }
        continue;
      }

      // ------------------------------------------------- 2. ver um estrangeiro
      const visto = quemEleViu(mundo, i, meu);
      if (visto >= 0 && !mundo.conhece(meu, visto)) c.noticia[i] = visto;
    }
  },
};

/**
 * A pessoa está perto o bastante da própria vila para contar o que viu?
 *
 * O critério é a praça, e não o território: o pedido era que o contato fosse
 * **reportado a um governante ou a um rei**, e é na praça que eles estão. Uma
 * patrulha que cruza a fronteira do próprio reino e volta a vagar pelo mato não
 * contou nada a ninguém.
 */
function chegouEmCasa(mundo: Mundo, i: number): boolean {
  const c = mundo.criaturas;
  const casa = c.aldeia[i];
  if (casa < 0) return false;
  const a = mundo.aldeias[casa];
  if (!a?.ativa) return false;
  const dx = a.x - c.x[i];
  const dy = a.y - c.y[i];
  return dx * dx + dy * dy <= BAL.distanciaDoRelato * BAL.distanciaDoRelato;
}

/**
 * De que reino estrangeiro esta pessoa acabou de ter notícia, ou -1.
 *
 * Duas formas de descobrir, na ordem do que custa menos:
 *
 * - **O chão sob os pés.** Pisar em terra com dono já é saber que ela tem dono:
 *   há marco, roça, estrada. Custa uma leitura de array.
 * - **Alguém à vista.** Aí sim vale a consulta ao índice espacial, com o
 *   alcance de visão da própria espécie — um elfo enxerga mais longe que um
 *   anão, e isso passa a valer para a diplomacia também.
 */
function quemEleViu(mundo: Mundo, i: number, meu: number): number {
  const c = mundo.criaturas;
  const g = mundo.grid;

  const x = c.x[i] | 0;
  const y = c.y[i] | 0;
  if (g.dentro(x, y)) {
    const dono = g.territorio[g.idx(x, y)];
    if (dono >= 0 && dono !== meu && mundo.reinos[dono]?.ativo) return dono;
  }

  const alcance = ESP_VISAO[c.especie[i]];
  const outro = mundo.espacial.maisProximo(c, i, alcance, (id) => {
    if (id === i || ESP_CIVILIZADO[c.especie[id]] === 0) return false;
    const dele = c.reino[id];
    return dele >= 0 && dele !== meu && !mundo.conhece(meu, dele);
  });
  return outro >= 0 ? c.reino[outro] : -1;
}
