import { Grid } from './grid.js';
import { Criaturas, Estado } from './criaturas.js';
import { IndiceEspacial } from './espacial.js';
import type { OrigemNascimento } from './eventos.js';
import { Barramento, type Causa } from './eventos.js';
import { Rng } from './rng.js';
import { Pipeline } from './sistemas.js';
import {
  ESP_VIDA, ESP_ESPERA_FILHO, ESPECIES_SELVAGENS, TOTAL_ESPECIES, especies,
} from '../dados/especies.js';
import { ED, ED_ABRIGA, ED_MORADIA, ED_NATURAL, ED_OCUPA, edificios } from '../dados/edificios.js';
import { B } from '../dados/biomas.js';
import { alcanceDaAldeia } from '../sim/urbanismo.js';
import { BAL } from '../sim/balanco.js';
import type { BombaDeLava } from '../sim/vulcoes.js';
import type { Nuvem } from '../sim/clima.js';
import type { Barco } from '../sim/barcos.js';
import { estoqueVazio, type Estoque } from '../dados/materiais.js';

export interface TamanhoMapa {
  readonly id: string;
  readonly nome: string;
  readonly largura: number;
  readonly altura: number;
  readonly capacidade: number;
}

/**
 * Tamanhos de mapa.
 *
 * `capacidade` é o teto de criaturas vivas ao mesmo tempo — o freio que impede
 * o mundo grande de engasgar. Foi medido: a simulação custa por criatura, não
 * por tile, então mapa maior sem teto maior só deixa o mundo mais vazio, e teto
 * grande demais derruba o ritmo. Os números abaixo mantêm o tick dentro do
 * orçamento de 60 fps mesmo com o mapa cheio.
 */
export const TAMANHOS: readonly TamanhoMapa[] = [
  { id: 'pequeno', nome: 'pequeno', largura: 256, altura: 144, capacidade: 9000 },
  { id: 'medio', nome: 'médio', largura: 384, altura: 216, capacidade: 16000 },
  { id: 'grande', nome: 'grande', largura: 512, altura: 288, capacidade: 26000 },
  { id: 'enorme', nome: 'enorme', largura: 768, altura: 432, capacidade: 40000 },
  { id: 'imenso', nome: 'imenso', largura: 1024, altura: 576, capacidade: 55000 },
  { id: 'continental', nome: 'continental', largura: 1400, altura: 800, capacidade: 70000 },
  // Os dois de baixo são exagero deliberado. O mapa de 2800×1600 tem quatro
  // milhões e meio de tiles — mais de vinte vezes o mundo médio — e existe
  // para quem quer ver um planeta inteiro se povoar sozinho, não para jogar
  // de perto. O que segura a taxa de quadros num mapa desses não é o terreno
  // (que é uma cópia de imagem por quadro, custe o que custar) e sim o teto de
  // criaturas: por isso ele sobe bem menos que a área.
  { id: 'colossal', nome: 'colossal', largura: 2048, altura: 1152, capacidade: 95000 },
  { id: 'planeta', nome: 'planeta', largura: 2800, altura: 1600, capacidade: 130000 },
];

/** Uma aldeia: o núcleo local de uma civilização. */
export interface Aldeia {
  id: number;
  ativa: boolean;
  reino: number;
  especie: number;
  nome: string;
  x: number;
  y: number;
  populacao: number;
  /** Tudo o que a aldeia guarda: comida, madeira, pedra, ferro, carvão e ouro. */
  estoque: Estoque;
  /** 1 acampamento · 2 aldeia · 3 vila · 4 cidade · 5 metrópole */
  nivel: number;
  casas: number;
  capacidade: number;
  /** Teto de cada material no estoque. Cresce com celeiros e com o nível. */
  capacidadeEstoque: number;
  /**
   * Tiles-âncora de todas as construções com moradia dentro do território.
   *
   * A lista existe porque procurar casa sorteando pontos no mapa não funciona:
   * uma casa ocupa 2×2 mas só o canto dela responde por ela, então três de cada
   * quatro acertos eram descartados. Medindo, dava 58 filhos nascidos em casa
   * contra 2.984 chegados de fora — a mecânica principal respondia por 2% do
   * crescimento. Com a lista, procurar casa é percorrer meia dúzia de índices.
   *
   * É derivada: `recalcularCapacidade` a reconstrói junto com `predios`, e por
   * isso ela não vai para o save.
   */
  casasIdx: number[];
  /**
   * Tiles-âncora dos moinhos. É em volta deles que a lavoura se junta.
   *
   * Pelo mesmo motivo de `casasIdx`: procurar um moinho varrendo o quadrado
   * do território custa milhares de tiles, e isso aconteceria a cada fazenda
   * que a vila decidisse plantar.
   */
  moinhosIdx: number[];
  /**
   * Quantos tiles a aldeia domina agora, e quantos ela pode dominar.
   *
   * Uma vila tem tamanho máximo. Quando enche, o único jeito de o reino crescer
   * é **fundar outra vila** — é isso que faz um império aparecer no mapa como
   * uma constelação de povoados, e não como uma mancha só que engorda para
   * sempre a partir de um ponto.
   */
  tilesTerritorio: number;
  limiteTerritorio: number;
  /**
   * Quantos prédios de cada tipo a aldeia tem, por índice do registro.
   * Recontado quando uma obra sobe ou cai — os sistemas leem daqui em vez de
   * varrer o território toda vez que precisam saber se há uma ferraria.
   */
  predios: Int32Array;
  raio: number;
  fundadaEm: number;
  moral: number;
  /** Ticks desde a última construção — evita que tudo suba no mesmo instante. */
  esperaObra: number;
  /**
   * Para onde a aldeia puxa o esforço, definido pelo jogador.
   * Índice em `FOCOS` (`src/sim/comandos.ts`); 0 é o equilíbrio automático.
   */
  foco: number;
  /**
   * Quanto o entorno rende de madeira e de pedra (0..1), medido uma vez na
   * fundação. É o embrião do sistema de economia: hoje só multiplica a coleta,
   * amanhã pode virar oferta, preço e rota de comércio.
   */
  bonusMadeira: number;
  bonusPedra: number;
}

/** Quantos tiles cabem numa aldeia daquele nível. */
export function limiteDeTerritorio(nivel: number): number {
  const r = BAL.raioPorNivel[Math.min(nivel, BAL.raioPorNivel.length - 1)];
  return Math.round(Math.PI * r * r * 0.92);
}

/** Um reino: o agrupamento político de aldeias do mesmo povo. */
export interface Reino {
  id: number;
  ativo: boolean;
  nome: string;
  cor: number;
  especie: number;
  capital: number;
  aldeias: number[];
  /** -100 (ódio) a +100 (aliança). */
  relacoes: Map<number, number>;
  guerras: Set<number>;
  /** Reinos com quem tem aliança firmada: comerciam e entram na guerra juntos. */
  aliancas: Set<number>;
  /** 0 tribal · 1 aldeões · 2 reino · 3 império */
  era: number;
  fundadoEm: number;
  /** Somatório de população — recalculado no sistema de aldeias. */
  populacao: number;
  /** Somatório de tiles dominados por todas as aldeias do reino. */
  territorio: number;
}

export interface Estatisticas {
  populacao: number;
  porEspecie: Int32Array;
  aldeias: number;
  reinos: number;
  guerras: number;
  tilesAgua: number;
  tilesTerra: number;
  incendios: number;
}

/**
 * O estado inteiro do jogo.
 *
 * Tudo o que a simulação precisa mora aqui: terreno, criaturas, índice
 * espacial, aldeias, reinos, RNG e barramento. Sistemas recebem o mundo e
 * mexem nele; nada de estado global espalhado por módulo.
 */
export class Mundo {
  readonly grid: Grid;
  readonly criaturas: Criaturas;
  readonly espacial: IndiceEspacial;
  readonly eventos = new Barramento();
  readonly pipeline = new Pipeline();

  rng: Rng;
  semente: string;
  tick = 0;
  /** Ticks lógicos por segundo com velocidade 1×. */
  readonly ticksPorSegundo = 20;
  /**
   * Deixa espécies quase extintas receberem reforço de fora do mapa.
   * Desligado, o mundo caminha para poucas espécies dominantes — que é
   * realista, mas empobrece a partida longa.
   */
  migracao = true;
  /** Quanto de bicho o jogador pediu. Guardado para o save reconstruir os tetos. */
  densidadeFauna = 1;

  aldeias: Aldeia[] = [];
  reinos: Reino[] = [];
  /**
   * Tiles pegando fogo agora. Fica em conjunto e não em varredura do grid
   * porque incêndio é raro: percorrer 80 mil tiles por tick atrás de dois
   * focos seria o sistema mais caro do jogo sem motivo.
   */
  readonly chamas = new Set<number>();
  /**
   * Quais famílias de recurso já ocupam o máximo de chão que lhes cabe.
   *
   * Recalculado de tempos em tempos por `recensearOChao` (`src/sim/ecologia.ts`)
   * e consultado por quem planta. É o que garante que o mundo continue tendo
   * chão à vista depois de horas rodando, em vez de virar um tapete de árvore
   * e pedra onde não se enxerga o terreno.
   */
  readonly chaoLotado = { madeira: false, comida: false, pedra: false };
  /** Tiles no centro de cada cratera. É de onde saem as bombas de lava. */
  vulcoes: number[] = [];
  /** Bombas de lava no ar agora. */
  bombas: BombaDeLava[] = [];
  /** As nuvens que atravessam o mundo agora. Ver `src/sim/clima.ts`. */
  nuvens: Nuvem[] = [];
  /** Os barcos no mar. Ver `src/sim/barcos.ts`. */
  barcos: Barco[] = [];
  /** Para onde o vento sopra, em tiles por tick. Todas as nuvens o seguem. */
  ventoX = 0.014;
  ventoY = 0.006;

  /**
   * Quantos indivíduos de cada espécie o mundo comporta.
   *
   * O limite de vizinhança sozinho não segura população: ele é local, e os
   * bichos simplesmente se espalham pelo mapa até encher tudo. Este teto é o
   * que define quantos animais o mundo tem — e é ele que o controle de
   * "bichos" na criação do mundo regula. Civilizados não entram: quem limita
   * o povo é a capacidade das aldeias.
   */
  readonly tetoPorEspecie: Int32Array;

  readonly estatisticas: Estatisticas;
  /** Buffer reaproveitado por quem precisa dos vizinhos de um tile. */
  readonly bufVizinhos = new Int32Array(8);

  constructor(readonly tamanho: TamanhoMapa, semente: string) {
    this.semente = semente;
    this.rng = new Rng(semente);
    this.grid = new Grid(tamanho.largura, tamanho.altura);
    this.criaturas = new Criaturas(tamanho.capacidade);
    this.espacial = new IndiceEspacial(tamanho.largura, tamanho.altura, tamanho.capacidade);
    this.tetoPorEspecie = new Int32Array(TOTAL_ESPECIES).fill(1 << 28);
    this.estatisticas = {
      populacao: 0,
      porEspecie: new Int32Array(TOTAL_ESPECIES),
      aldeias: 0,
      reinos: 0,
      guerras: 0,
      tilesAgua: 0,
      tilesTerra: 0,
      incendios: 0,
    };
  }

  // ------------------------------------------------------------------ criaturas

  /**
   * Põe uma criatura no mundo. Devolve o índice, ou -1 se o mundo estiver cheio.
   * `idade` em ticks permite nascer já adulta (usado ao povoar o mundo).
   */
  nascer(
    especie: number,
    x: number,
    y: number,
    idade = 0,
    origem: OrigemNascimento = 'natural',
  ): number {
    const c = this.criaturas;
    const i = c.criar();
    if (i < 0) return -1;
    const def = especies.porIndice(especie);
    c.especie[i] = especie;
    c.x[i] = x;
    c.y[i] = y;
    c.vida[i] = ESP_VIDA[especie];
    c.fome[i] = this.rng.entre(0, 30);
    c.energia[i] = 100;
    c.idade[i] = idade;
    c.longevidade[i] = this.rng.entre(def.longevidade[0], def.longevidade[1]);
    c.esperaFilho[i] = ESP_ESPERA_FILHO[especie] * this.rng.entre(0.5, 1.2);
    c.estado[i] = Estado.Vagando;
    c.dir[i] = this.rng.int(2);
    this.eventos.emitir('criatura:nasceu', { id: i, especie, x, y, origem });
    return i;
  }

  matar(i: number, causa: Causa, porQuem = -1): void {
    const c = this.criaturas;
    if (!c.vivo[i]) return;
    const especie = c.especie[i];
    const x = c.x[i];
    const y = c.y[i];
    const porEspecie = porQuem >= 0 && c.vivo[porQuem] ? c.especie[porQuem] : -1;
    const aldeia = c.aldeia[i];
    if (aldeia >= 0 && this.aldeias[aldeia]?.ativa) {
      this.aldeias[aldeia].populacao = Math.max(0, this.aldeias[aldeia].populacao - 1);
      this.aldeias[aldeia].moral -= 1.5;
    }
    c.abrigo[i] = -1;
    c.remover(i);
    this.eventos.emitir('criatura:morreu', { id: i, especie, x, y, causa, porEspecie });
  }

  // -------------------------------------------------------------------- aldeias

  criarAldeia(reino: number, especie: number, x: number, y: number, nome: string): Aldeia {
    let id = this.aldeias.findIndex((a) => !a.ativa);
    const nova: Aldeia = {
      id: id >= 0 ? id : this.aldeias.length,
      ativa: true,
      reino,
      especie,
      nome,
      x,
      y,
      populacao: 0,
      estoque: { ...estoqueVazio(), comida: 40, madeira: 30, pedra: 10 },
      nivel: 1,
      casas: 0,
      capacidade: 6,
      capacidadeEstoque: 260,
      casasIdx: [],
      moinhosIdx: [],
      tilesTerritorio: 0,
      limiteTerritorio: 0,
      predios: new Int32Array(edificios.tamanho),
      raio: BAL.raioPorNivel[1],
      fundadaEm: this.tick,
      moral: 60,
      esperaObra: 0,
      foco: 0,
      bonusMadeira: 0.5,
      bonusPedra: 0.3,
    };
    this.medirEntorno(nova);
    if (id >= 0) this.aldeias[id] = nova;
    else this.aldeias.push(nova);
    const r = this.reinos[reino];
    if (r) r.aldeias.push(nova.id);
    this.eventos.emitir('aldeia:fundada', { aldeia: nova.id, reino, x, y });
    return nova;
  }

  destruirAldeia(id: number, virarRuina = true): void {
    const a = this.aldeias[id];
    if (!a || !a.ativa) return;
    a.ativa = false;
    const g = this.grid;
    // apaga construções e território daquela aldeia
    const alcance = alcanceDaAldeia(a);
    const x0 = Math.max(0, a.x - alcance);
    const x1 = Math.min(g.largura - 1, a.x + alcance);
    const y0 = Math.max(0, a.y - alcance);
    const y1 = Math.min(g.altura - 1, a.y + alcance);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = g.idx(x, y);
        if (g.aldeiaDona[i] !== id) continue;
        g.aldeiaDona[i] = -1;
        g.territorio[i] = -1;
        g.estrada[i] = 0;
        // O que é acidente do terreno fica de pé: este laço limpa o mapa
        // direto, sem passar por `derrubar`, e sem a guarda ele apagava o
        // vulcão que por acaso estivesse dentro do território da aldeia.
        if (g.construcao[i] !== 0 && ED_NATURAL[g.construcao[i] - 1] !== 1) {
          const tipo = g.construcao[i] - 1;
          g.desocupar(i, ED_OCUPA[tipo * 2], ED_OCUPA[tipo * 2 + 1]);
          g.construcao[i] = virarRuina ? ED.ruina + 1 : 0;
          if (g.construcao[i] !== 0) g.ocupar(i, 1, 1);
        }
        g.marcarSujo(x, y);
      }
    }
    // moradores viram andarilhos sem casa
    const c = this.criaturas;
    for (let i = 0; i < c.limite; i++) {
      if (c.vivo[i] && c.aldeia[i] === id) {
        c.aldeia[i] = -1;
        c.estado[i] = Estado.Vagando;
      }
    }
    a.tilesTerritorio = 0;
    const r = this.reinos[a.reino];
    if (r) {
      r.aldeias = r.aldeias.filter((x) => x !== id);
      if (r.capital === id) r.capital = r.aldeias[0] ?? -1;
      if (r.aldeias.length === 0) this.extinguirReino(r.id);
    }
    this.eventos.emitir('aldeia:destruida', { aldeia: id, reino: a.reino, x: a.x, y: a.y });
  }

  // --------------------------------------------------------------------- reinos

  criarReino(especie: number, nome: string, cor: number): Reino {
    let id = this.reinos.findIndex((r) => !r.ativo);
    const novo: Reino = {
      id: id >= 0 ? id : this.reinos.length,
      ativo: true,
      nome,
      cor,
      especie,
      capital: -1,
      aldeias: [],
      relacoes: new Map(),
      guerras: new Set(),
      aliancas: new Set(),
      era: 0,
      fundadoEm: this.tick,
      populacao: 0,
      territorio: 0,
    };
    if (id >= 0) this.reinos[id] = novo;
    else this.reinos.push(novo);
    this.eventos.emitir('reino:fundado', { reino: novo.id, nome });
    return novo;
  }

  extinguirReino(id: number): void {
    const r = this.reinos[id];
    if (!r || !r.ativo) return;
    r.ativo = false;
    for (const outro of this.reinos) {
      if (!outro.ativo) continue;
      outro.relacoes.delete(id);
      outro.guerras.delete(id);
      outro.aliancas.delete(id);
    }
    this.eventos.emitir('reino:extinto', { reino: id, nome: r.nome });
  }

  relacao(a: number, b: number): number {
    return this.reinos[a]?.relacoes.get(b) ?? 0;
  }

  mudarRelacao(a: number, b: number, delta: number): void {
    const ra = this.reinos[a];
    const rb = this.reinos[b];
    if (!ra?.ativo || !rb?.ativo) return;
    const novo = Math.max(-100, Math.min(100, (ra.relacoes.get(b) ?? 0) + delta));
    ra.relacoes.set(b, novo);
    rb.relacoes.set(a, novo);
  }

  emGuerra(a: number, b: number): boolean {
    return this.reinos[a]?.guerras.has(b) ?? false;
  }

  saoAliados(a: number, b: number): boolean {
    return this.reinos[a]?.aliancas.has(b) ?? false;
  }

  firmarAlianca(a: number, b: number): void {
    const ra = this.reinos[a];
    const rb = this.reinos[b];
    if (!ra?.ativo || !rb?.ativo || ra.aliancas.has(b)) return;
    if (this.emGuerra(a, b)) return;
    ra.aliancas.add(b);
    rb.aliancas.add(a);
    ra.relacoes.set(b, 80);
    rb.relacoes.set(a, 80);
    this.eventos.emitir('reino:alianca', { a, b });
  }

  romperAlianca(a: number, b: number): void {
    const ra = this.reinos[a];
    const rb = this.reinos[b];
    if (!ra?.aliancas.has(b)) return;
    ra.aliancas.delete(b);
    rb?.aliancas.delete(a);
    this.eventos.emitir('reino:aliancaRompida', { a, b });
  }

  declararGuerra(a: number, b: number): void {
    const ra = this.reinos[a];
    const rb = this.reinos[b];
    if (!ra?.ativo || !rb?.ativo || ra.guerras.has(b)) return;
    // declarar guerra a um aliado desfaz a aliança primeiro
    this.romperAlianca(a, b);
    ra.guerras.add(b);
    rb.guerras.add(a);
    ra.relacoes.set(b, -80);
    rb.relacoes.set(a, -80);
    this.eventos.emitir('reino:guerra', { a, b });

    // aliados são arrastados para o conflito
    for (const amigo of [...ra.aliancas]) {
      const r = this.reinos[amigo];
      if (r?.ativo && !r.guerras.has(b)) {
        r.guerras.add(b);
        rb.guerras.add(amigo);
        this.eventos.emitir('reino:guerra', { a: amigo, b });
      }
    }
  }

  fazerPaz(a: number, b: number): void {
    const ra = this.reinos[a];
    const rb = this.reinos[b];
    if (!ra?.ativo || !rb?.ativo || !ra.guerras.has(b)) return;
    ra.guerras.delete(b);
    rb.guerras.delete(a);
    ra.relacoes.set(b, 10);
    rb.relacoes.set(a, 10);
    this.eventos.emitir('reino:paz', { a, b });
  }

  // ------------------------------------------------------------------ auxiliares

  /**
   * Mede o que o entorno da aldeia oferece de madeira e de pedra.
   * Feito uma vez na fundação: o terreno pode mudar, mas reavaliar isso todo
   * tick para cada aldeia não pagaria o custo.
   */
  private medirEntorno(a: Aldeia): void {
    const g = this.grid;
    let madeira = 0;
    let pedra = 0;
    let amostras = 0;
    const r = 10;
    for (let y = a.y - r; y <= a.y + r; y += 2) {
      if (y < 0 || y >= g.altura) continue;
      for (let x = a.x - r; x <= a.x + r; x += 2) {
        if (x < 0 || x >= g.largura) continue;
        const i = g.idx(x, y);
        amostras++;
        const b = g.bioma[i];
        if (b === B.floresta || b === B.selva || b === B.taiga) madeira += 1;
        else if (b === B.planicie || b === B.savana) madeira += 0.25;
        if (g.ehMontanha(i)) pedra += 1;
        else if (b === B.tundra || b === B.praia) pedra += 0.2;
      }
    }
    if (amostras === 0) return;
    // A faixa é estreita de propósito: o terreno tem de importar, mas uma
    // aldeia em lugar pobre precisa continuar viável. Com penalidade forte,
    // metade das aldeias não juntava madeira nem para erguer casa.
    a.bonusMadeira = 0.7 + Math.min(1, madeira / amostras) * 0.9;
    a.bonusPedra = 0.65 + Math.min(1, pedra / amostras) * 1;
  }

  /** Capacidade de moradores da aldeia, somando o que as construções abrigam. */
  recalcularCapacidade(a: Aldeia): void {
    const g = this.grid;
    let cap = 4;
    const alcance = alcanceDaAldeia(a);
    const x0 = Math.max(0, a.x - alcance);
    const x1 = Math.min(g.largura - 1, a.x + alcance);
    const y0 = Math.max(0, a.y - alcance);
    const y1 = Math.min(g.altura - 1, a.y + alcance);
    let casas = 0;
    let celeiros = 0;
    a.predios.fill(0);
    a.casasIdx.length = 0;
    a.moinhosIdx.length = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = g.idx(x, y);
        if (g.aldeiaDona[i] !== a.id) continue;
        const e = g.construcao[i];
        if (e === 0) continue;
        cap += ED_ABRIGA[e - 1];
        a.predios[e - 1]++;
        if (ED_MORADIA[e - 1] > 0) a.casasIdx.push(i);
        if (e - 1 === ED.moinho) a.moinhosIdx.push(i);
        if (e - 1 === ED.casa) casas++;
        else if (e - 1 === ED.celeiro) celeiros++;
      }
    }
    // o teto por nível é o que impede a aldeia campeã de crescer sem fim
    const teto = BAL.tetoPorNivel[Math.min(a.nivel, BAL.tetoPorNivel.length - 1)];
    a.capacidade = Math.min(cap, teto);
    a.casas = casas;
    a.capacidadeEstoque = 260 + celeiros * 420 + a.nivel * 160;
  }

  /** Aldeia ativa mais próxima de (x, y) dentro do raio, ou -1. */
  aldeiaMaisProxima(x: number, y: number, raioMax: number, filtro?: (a: Aldeia) => boolean): number {
    let melhor = -1;
    let melhorD = raioMax * raioMax;
    for (const a of this.aldeias) {
      if (!a.ativa) continue;
      if (filtro && !filtro(a)) continue;
      const dx = a.x - x;
      const dy = a.y - y;
      const d = dx * dx + dy * dy;
      if (d < melhorD) {
        melhorD = d;
        melhor = a.id;
      }
    }
    return melhor;
  }

  nomeEdificio(indiceMais1: number): string {
    return indiceMais1 === 0 ? '' : edificios.porIndice(indiceMais1 - 1).nome;
  }

  /** Recontagem completa das estatísticas. Roda a cada poucos ticks, não sempre. */
  recalcularEstatisticas(): void {
    const s = this.estatisticas;
    this.criaturas.contarPorEspecie(s.porEspecie);
    s.populacao = this.criaturas.quantidade;
    s.aldeias = this.aldeias.reduce((n, a) => n + (a.ativa ? 1 : 0), 0);
    s.reinos = this.reinos.reduce((n, r) => n + (r.ativo ? 1 : 0), 0);
    let guerras = 0;
    for (const r of this.reinos) if (r.ativo) guerras += r.guerras.size;
    s.guerras = guerras / 2;
    let agua = 0;
    let fogo = 0;
    const g = this.grid;
    for (let i = 0; i < g.total; i++) {
      if (g.ehAgua(i)) agua++;
      if (g.fogo[i] > 0) fogo++;
    }
    s.tilesAgua = agua;
    s.tilesTerra = g.total - agua;
    s.incendios = fogo;
  }

  /**
   * Define os tetos de população animal a partir do tamanho do mapa e do
   * quanto o jogador pediu de bicho. Chamado ao gerar e ao carregar um mundo.
   */
  definirTetosDeFauna(densidade: number): void {
    this.densidadeFauna = densidade;
    const s = ESPECIES_SELVAGENS;
    let peso = 0;
    for (const idx of s) peso += especies.porIndice(idx).frequencia;
    const total = Math.min(
      this.criaturas.capacidade * 0.2,
      (this.grid.total / 950) * densidade * 16,
    );
    for (const idx of s) {
      const fracao = especies.porIndice(idx).frequencia / peso;
      this.tetoPorEspecie[idx] = Math.max(12, Math.round(total * fracao));
    }
  }

  /** Um tick de simulação. */
  avancar(): void {
    this.tick++;
    this.pipeline.executar(this);
  }
}
