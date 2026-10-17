import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { LADO_CHUNK } from '../core/grid.js';
import { TICKS_ANO } from '../dados/especies.js';
import { B, BIOMA_AGUA } from '../dados/biomas.js';
import { BAL } from './balanco.js';

/**
 * As quatro estações do ano.
 *
 * O ano tem `TICKS_ANO` ticks e a estação é só a posição do tick dentro dele:
 * não há estado nenhum guardado, e por isso nada disso vai para o save — um
 * mundo carregado volta exatamente na estação em que foi salvo.
 *
 * O que muda com a estação é **quando** as coisas acontecem, não quanto
 * acontece no ano (ver os multiplicadores `estacao*` em `balanco.ts`, todos com
 * média perto de 1): a mata explode na primavera, o verão seca a lavoura e
 * acende a savana, o outono é a colheita, e o inverno cobre de neve o campo
 * temperado, para o mato e deixa a vila vivendo do celeiro.
 *
 * A neve do inverno é **calculada**, não pintada: um tile está nevado quando a
 * temperatura dele fica abaixo da linha da neve do momento, e essa linha sobe e
 * desce numa curva suave ao longo do ano. Nenhum bioma é trocado — o campo
 * continua sendo campo debaixo da neve, e volta sozinho quando ela derrete.
 */

export const enum Estacao {
  Primavera = 0,
  Verao = 1,
  Outono = 2,
  Inverno = 3,
}

export const NOME_ESTACAO = ['primavera', 'verão', 'outono', 'inverno'] as const;

/** Onde o tick cai dentro do ano, de 0 a 1. */
export function faseDoAno(tick: number): number {
  return (tick % TICKS_ANO) / TICKS_ANO;
}

export function estacaoDe(tick: number): number {
  return Math.min(3, Math.floor(faseDoAno(tick) * 4));
}

/**
 * O quanto o ano está frio, de 0 (meio do verão) a 1 (meio do inverno).
 *
 * Curva e não degrau: com degrau, a neve aparecia inteira no primeiro tick do
 * inverno e sumia inteira no primeiro da primavera, e o mapa piscava de branco
 * para verde quatro vezes por minuto.
 */
export function frioDoAno(tick: number): number {
  const fase = faseDoAno(tick);
  return (1 + Math.cos(2 * Math.PI * (fase - 0.875))) / 2;
}

/**
 * A temperatura abaixo da qual o chão está coberto de neve agora.
 *
 * Arredondada em degraus de `BAL.degrauDaNeve`: cada passo da linha obriga a
 * redesenhar a faixa de chão que mudou, e com a linha contínua isso seria a
 * cada tick.
 */
export function linhaDaNeve(tick: number): number {
  const frio = frioDoAno(tick);
  // Só a metade fria do ano mexe na linha: no verão ela fica no lugar de
  // sempre, que é a neve dos picos e da tundra.
  const subida = Math.max(0, frio - 0.5) * 2;
  // O degrau é sobre a subida, e não sobre a linha inteira: arredondando a
  // linha, o verão ficava dois pontos acima da neve de sempre e pintava de
  // branco uma faixa de tundra no meio de janeiro.
  const degraus = Math.round((BAL.neveDoInverno * subida) / BAL.degrauDaNeve);
  return BAL.temperaturaDaNeve + degraus * BAL.degrauDaNeve;
}

/** Multiplicador da estação atual numa das tabelas do balanço. */
export function daEstacao(mundo: Mundo, tabela: readonly number[]): number {
  return tabela[estacaoDe(mundo.tick)];
}

/**
 * O tile está debaixo da neve sazonal?
 *
 * Água não neva e os biomas que já são neve não contam: é a neve que **vem e
 * vai**. Lê `mundo.linhaNeve`, que o sistema mantém em dia, e não recalcula a
 * curva — esta função é chamada tile a tile por quem varre o mapa.
 */
export function nevado(mundo: Mundo, i: number): boolean {
  const g = mundo.grid;
  if (g.temp[i] >= mundo.linhaNeve) return false;
  if (g.temp[i] < BAL.temperaturaDaNeve) return false;
  const b = g.bioma[i];
  if (BIOMA_AGUA[b] === 1) return false;
  return b !== B.neve && b !== B.gelo && b !== B.pico && b !== B.lava;
}

export const sistemaEstacoes: Sistema = {
  id: 'estacoes',
  intervalo: 5,
  executar(mundo: Mundo): void {
    andarALinhaDaNeve(mundo);
    // O raio seco do verão mora em `ecologia.ts`, junto do resto do fogo.
  },
};

/**
 * Move a linha da neve e avisa o desenho de onde o chão mudou.
 *
 * Só os pedaços do mapa que têm tile na faixa entre a linha velha e a nova são
 * marcados para redesenhar. Marcar o mapa inteiro custaria uma varredura do
 * terreno a cada passo — num planeta, quatro milhões e meio de tiles várias
 * vezes por ano de jogo.
 */
function andarALinhaDaNeve(mundo: Mundo): void {
  const nova = linhaDaNeve(mundo.tick);
  const velha = mundo.linhaNeve;
  if (nova === velha) return;
  mundo.linhaNeve = nova;
  if (velha < 0) {
    mundo.grid.marcarTudoSujo();
    return;
  }
  const g = mundo.grid;
  const lo = Math.max(BAL.temperaturaDaNeve, Math.min(nova, velha));
  const hi = Math.max(nova, velha);
  if (hi <= lo) return;
  const temp = g.temp;
  for (let cy = 0; cy < g.chunksA; cy++) {
    const y0 = cy * LADO_CHUNK;
    const y1 = Math.min(g.altura, y0 + LADO_CHUNK);
    for (let cx = 0; cx < g.chunksL; cx++) {
      const c = cy * g.chunksL + cx;
      if (g.chunksSujos[c]) continue;
      const x0 = cx * LADO_CHUNK;
      const x1 = Math.min(g.largura, x0 + LADO_CHUNK);
      let achou = false;
      for (let y = y0; y < y1 && !achou; y++) {
        let i = y * g.largura + x0;
        for (let x = x0; x < x1; x++, i++) {
          const t = temp[i];
          if (t >= lo && t < hi) {
            achou = true;
            break;
          }
        }
      }
      if (achou) g.chunksSujos[c] = 1;
    }
  }
  mundo.versaoNeve++;
}
