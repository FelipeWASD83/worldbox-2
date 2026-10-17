import type { Sistema } from '../core/sistemas.js';
import type { Mundo, Reino } from '../core/mundo.js';
import { ED } from '../dados/edificios.js';
import { TEC_CUSTO, TEC_ERA, TEC_REQUER, tecnologias } from '../dados/tecnologias.js';
import { BAL } from './balanco.js';
import { ESP_CIVILIZADO } from '../dados/especies.js';
import { Campo } from '../dados/tracos.js';
import { fator } from './genetica.js';
import { Oficio, oficioDe } from './profissoes.js';

/**
 * O que o reino aprende, com o que ele aprende, e o que isso destranca.
 *
 * Um reino acumula **conhecimento** em pontos e gasta esses pontos em
 * descobertas. A ordem não é livre: cada tecnologia tem pré-requisito, e a
 * corte sempre persegue a mais barata que já pode alcançar — povo nenhum pula
 * da pedra lascada para o aço.
 *
 * De onde vêm os pontos é a parte que mais muda o jogo. População dá um fio
 * constante, mas o grosso vem dos **marcos da cidade**: biblioteca, prefeitura,
 * templo e taverna. Esses quatro estavam de pé no mapa desde sempre, custando
 * madeira e pedra e **sem fazer absolutamente nada** — era a pendência número
 * três do roteiro. Agora um império que constrói biblioteca descobre o aço
 * enquanto o vizinho que só levantou muralha ainda está fervendo cerveja.
 *
 * E a escrita se paga duas vezes: além de liberar prefeitura e biblioteca, ela
 * multiplica tudo o que entra. É a diferença entre um povo que transmite o que
 * sabe e um que perde metade a cada geração que morre.
 */
export const sistemaConhecimento: Sistema = {
  id: 'conhecimento',
  intervalo: BAL.intervaloConhecimento,
  executar(mundo: Mundo): void {
    // Uma passada só pelo pool para saber quanto cada reino tem de gente que
    // pensa. Fazer isso dentro de `renda`, por reino, seria varrer o pool uma
    // vez por reino — o mesmo erro que a lealdade já cometeu uma vez.
    const porCabeca = contarSabedoria(mundo);
    for (const r of mundo.reinos) {
      if (!r.ativo) continue;
      r.conhecimento += renda(mundo, r) + (porCabeca[r.id] ?? 0);
      descobrir(mundo, r);
    }
  },
};

/**
 * Quanto de conhecimento a **gente** de cada reino produz por conta do que ela
 * é, e não do que ela construiu.
 *
 * Um sábio vale quase uma biblioteca pequena; um tolo desconta. Como a maioria
 * não tem traço nenhum, o laço quase sempre soma zero e sai barato — o desconto
 * e o bônus só existem onde há alguém fora do comum.
 */
function contarSabedoria(mundo: Mundo): Float64Array {
  const c = mundo.criaturas;
  const saida = new Float64Array(mundo.reinos.length);
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    const r = c.reino[i];
    if (r < 0 || r >= saida.length) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    if (c.tracos[i] !== 0) {
      saida[r] += (fator(c.tracos[i], Campo.conhecimento) - 1) * BAL.conhecimentoPorSabio;
    }
    // O estudioso é o ofício do saber: rende sempre, e o dobro com a perícia
    // cheia. Na mesma varredura dos sábios para não pagar duas.
    if (oficioDe(c, i) === Oficio.Estudioso) {
      saida[r] += BAL.conhecimentoPorEstudioso * (1 + c.pericia[i]);
    }
  }
  return saida;
}

/** Pontos de conhecimento que o reino produz por avaliação. */
function renda(mundo: Mundo, r: Reino): number {
  let bruto = BAL.conhecimentoBase + r.populacao * BAL.conhecimentoPorCabeca;

  for (const id of r.aldeias) {
    const a = mundo.aldeias[id];
    if (!a?.ativa) continue;
    bruto += a.predios[ED.biblioteca] * BAL.conhecimentoPorBiblioteca;
    bruto += a.predios[ED.prefeitura] * BAL.conhecimentoPorPrefeitura;
    bruto += a.predios[ED.templo] * BAL.conhecimentoPorTemplo;
    bruto += a.predios[ED.taverna] * BAL.conhecimentoPorTaverna;
  }

  // quem escreve não perde o que aprendeu quando o velho morre
  if (r.tecnologias.has(tecnologias.indice('escrita'))) bruto *= BAL.conhecimentoDaEscrita;
  return bruto;
}

/**
 * Paga a descoberta mais barata que já está ao alcance.
 *
 * Uma por avaliação, mesmo que sobre ponto para duas. Descoberta é
 * acontecimento — vai para a crônica, muda o que a vila pode construir — e duas
 * no mesmo instante viram ruído.
 */
function descobrir(mundo: Mundo, r: Reino): void {
  let alvo = -1;
  let maisBarata = Infinity;

  for (let t = 0; t < TEC_CUSTO.length; t++) {
    if (r.tecnologias.has(t)) continue;
    if (TEC_CUSTO[t] >= maisBarata) continue;
    let podeAgora = true;
    for (const req of TEC_REQUER[t]) {
      if (!r.tecnologias.has(req)) {
        podeAgora = false;
        break;
      }
    }
    if (!podeAgora) continue;
    maisBarata = TEC_CUSTO[t];
    alvo = t;
  }

  if (alvo < 0 || r.conhecimento < maisBarata) return;
  r.conhecimento -= maisBarata;
  aprender(mundo, r, alvo);
}

/**
 * Registra a descoberta e acerta a era do reino.
 *
 * Exportada porque a mão do jogador também ensina — ver o poder *Iluminar*, em
 * `src/sim/poderes.ts`. Ensinar de graça não pula pré-requisito: quem recebe o
 * aço sem conhecer metalurgia recebe a metalurgia junto, senão o reino ficaria
 * com um buraco no meio da própria árvore.
 */
export function aprender(mundo: Mundo, r: Reino, tec: number): void {
  if (r.tecnologias.has(tec)) return;
  for (const req of TEC_REQUER[tec]) aprender(mundo, r, req);
  r.tecnologias.add(tec);
  mundo.eventos.emitir('reino:descobriu', { reino: r.id, tecnologia: tec });

  const eraNova = TEC_ERA[tec];
  if (eraNova > r.era) {
    r.era = eraNova;
    mundo.eventos.emitir('reino:eraNova', { reino: r.id, era: r.era });
  }
}

/**
 * O melhor material de obra que o reino sabe trabalhar.
 *
 * É a resposta à pergunta "de que este povo constrói?". Um reino que descobriu
 * carpintaria e mais nada constrói de madeira, e por isso tem prédios piores
 * que o vizinho que já assenta pedra — que é literalmente o pedido.
 */
export function materialDoReino(r: Reino | undefined): number {
  if (!r) return 0;
  let melhor = 0;
  for (const t of r.tecnologias) {
    const m = tecnologias.porIndice(t).materialDeObra;
    if (m !== undefined && m > melhor) melhor = m;
  }
  return melhor;
}
