import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { B } from '../dados/biomas.js';
import { ED } from '../dados/edificios.js';
import { especies, ESP_INTELIGENTE } from '../dados/especies.js';
import { nomeDeAldeia } from '../dados/nomes.js';
import { BAL } from './balanco.js';
import { pavimentar } from './urbanismo.js';

/**
 * Barcos: quem sai do porto e o que vai fazer no mar.
 *
 * Há dois ofícios, e eles existem por razões diferentes:
 *
 * - **Pesqueiro** — sai do porto, roda pelo mar aberto juntando peixe e volta
 *   quando o porão enche. É o que faz uma vila de beira-mar viver do mar em vez
 *   de depender só da lavoura, e é o que dá movimento ao oceano, que até agora
 *   era uma superfície vazia entre continentes.
 * - **De combate** — leva gente. Serve para a guerra e, principalmente, para a
 *   **exploração**: é ele que carrega colonos até uma costa distante e funda
 *   vila do outro lado do mar. Sem barco, um arquipélago condenava cada povo à
 *   sua ilha, e o mapa nunca se misturava.
 *
 * Barco **não é criatura**. Poderia ser — o pool de criaturas já dá posição,
 * movimento e save de graça —, mas viraria uma espécie que não come, não
 * envelhece e não se reproduz, com meia dúzia de campos que só ela usa. São
 * poucas dezenas no mundo inteiro, então uma lista simples em `Mundo.barcos`
 * paga melhor, do mesmo jeito que as bombas de lava e as nuvens.
 *
 * Não há busca de caminho, aqui como no resto do jogo: o barco vai em linha
 * reta e desliza no que não é água. O que evita que ele fique preso numa baía é
 * escolher destino só quando **a linha até lá é toda água** (`caminhoLivre`).
 */

/** O que um barco está fazendo. */
export const enum Rumo {
  /** Parado no porto, esperando serviço. */
  Atracado,
  /** Pescando em mar aberto. */
  Pescando,
  /** Voltando ao porto para descarregar. */
  Voltando,
  /** Levando colonos para uma costa distante. */
  Colonizando,
  /** Patrulhando a costa do reino. */
  Patrulhando,
}

export interface Barco {
  /** 0 = pesqueiro · 1 = de combate. */
  tipo: number;
  x: number;
  y: number;
  destinoX: number;
  destinoY: number;
  /** Aldeia dona, e o tile-âncora do porto de onde saiu. */
  aldeia: number;
  porto: number;
  rumo: Rumo;
  /** Peixe no porão. */
  carga: number;
  /** Quanta gente vai a bordo. */
  tripulantes: number;
  /** Para que lado o casco aponta no desenho. */
  dir: number;
  /** Ticks parado esperando alguma coisa acontecer. */
  espera: number;
  /**
   * Quantas pernas de patrulha o navio ainda dá antes de voltar ao porto.
   *
   * Existe porque sem ela o navio de combate saía para rondar e **nunca mais
   * voltava**: cada perna terminada escolhia a seguinte, e como só se embarca
   * colono no porto, a frota de guerra ficava eternamente circulando e nenhuma
   * colônia de além-mar era fundada. Medido: sete navios patrulhando, zero
   * zarpadas em quarenta mil ticks.
   */
  pernas: number;
}

export const sistemaBarcos: Sistema = {
  id: 'barcos',
  intervalo: 2,
  executar(mundo: Mundo): void {
    lancarBarcos(mundo);
    for (let k = mundo.barcos.length - 1; k >= 0; k--) {
      const b = mundo.barcos[k];
      if (!portoDePe(mundo, b)) {
        // porto destruído: o barco se perde
        mundo.barcos.splice(k, 1);
        continue;
      }
      conduzir(mundo, b);
    }
  },
};

/** O porto de origem ainda existe? */
function portoDePe(mundo: Mundo, b: Barco): boolean {
  const g = mundo.grid;
  if (b.porto < 0 || b.porto >= g.total) return false;
  return g.construcao[b.porto] === ED.porto + 1;
}

/** Cada porto mantém uma frota; quando falta barco, ele constrói mais um. */
function lancarBarcos(mundo: Mundo): void {
  if (mundo.tick % BAL.intervaloEstaleiro !== 0) return;
  const g = mundo.grid;

  for (const a of mundo.aldeias) {
    if (!a?.ativa || a.predios[ED.porto] === 0) continue;
    const frota = mundo.barcos.filter((b) => b.aldeia === a.id);
    if (frota.length >= BAL.barcosPorPorto) continue;
    if (a.estoque.madeira < BAL.madeiraPorBarco) continue;

    const porto = acharPorto(mundo, a);
    if (porto < 0) continue;
    const agua = aguaJuntoDoPorto(mundo, porto);
    if (agua < 0) continue;

    // Um pesqueiro primeiro: comida antes de guerra. Depois vai alternando, e
    // uma vila em guerra passa a preferir casco de combate.
    const pesqueiros = frota.filter((b) => b.tipo === 0).length;
    const emGuerra = (mundo.reinos[a.reino]?.guerras.size ?? 0) > 0;
    const tipo = pesqueiros === 0 ? 0 : emGuerra || pesqueiros > frota.length / 2 ? 1 : 0;

    a.estoque.madeira -= BAL.madeiraPorBarco;
    mundo.barcos.push({
      tipo,
      x: (agua % g.largura) + 0.5,
      y: ((agua / g.largura) | 0) + 0.5,
      destinoX: -1,
      destinoY: -1,
      aldeia: a.id,
      porto,
      rumo: Rumo.Atracado,
      carga: 0,
      tripulantes: 0,
      dir: 1,
      espera: 0,
      pernas: 0,
    });
    mundo.eventos.emitir('barco:lancado', { aldeia: a.id, tipo });
  }
}

/** O tile-âncora do porto daquela aldeia, ou -1. */
function acharPorto(mundo: Mundo, a: Aldeia): number {
  const g = mundo.grid;
  const r = a.raio + 6;
  for (let y = Math.max(0, a.y - r); y <= Math.min(g.altura - 1, a.y + r); y++) {
    for (let x = Math.max(0, a.x - r); x <= Math.min(g.largura - 1, a.x + r); x++) {
      const i = g.idx(x, y);
      if (g.construcao[i] === ED.porto + 1 && g.aldeiaDona[i] === a.id) return i;
    }
  }
  return -1;
}

/** Um tile de água navegável colado no porto, ou -1. */
function aguaJuntoDoPorto(mundo: Mundo, porto: number): number {
  const g = mundo.grid;
  const px = porto % g.largura;
  const py = (porto / g.largura) | 0;
  for (let dy = -2; dy <= 5; dy++) {
    for (let dx = -2; dx <= 6; dx++) {
      const x = px + dx;
      const y = py + dy;
      if (!g.dentro(x, y)) continue;
      const i = g.idx(x, y);
      if (navegavel(g, i)) return i;
    }
  }
  return -1;
}

/** Barco anda no mar e no lago; rio é estreito demais. */
function navegavel(
  g: { bioma: Uint8Array; ehAgua(i: number): boolean },
  i: number,
): boolean {
  return g.ehAgua(i) && g.bioma[i] !== B.rio;
}

/** Decide e executa o que o barco faz neste tick. */
function conduzir(mundo: Mundo, b: Barco): void {
  const a = mundo.aldeias[b.aldeia];
  if (!a?.ativa) {
    b.rumo = Rumo.Atracado;
    return;
  }

  if (b.espera > 0) {
    b.espera -= 2;
    return;
  }

  switch (b.rumo) {
    case Rumo.Atracado:
      if (b.tipo === 0) {
        if (escolherPesqueiro(mundo, b)) b.rumo = Rumo.Pescando;
      } else if (embarcarColonos(mundo, b, a)) {
        b.rumo = Rumo.Colonizando;
      } else if (escolherPatrulha(mundo, b)) {
        b.rumo = Rumo.Patrulhando;
        b.pernas = BAL.pernasDePatrulha;
      }
      return;

    case Rumo.Pescando:
      if (!navegar(mundo, b)) {
        // chegou ao pesqueiro: fica ali puxando rede
        pescar(mundo, b);
        if (b.carga >= BAL.porcaoDoBarco) {
          rumarAoPorto(mundo, b);
        } else if (!escolherPesqueiro(mundo, b)) {
          rumarAoPorto(mundo, b);
        }
      }
      return;

    case Rumo.Voltando:
      if (!navegar(mundo, b)) {
        descarregar(mundo, b, a);
        b.rumo = Rumo.Atracado;
        // O navio de guerra descansa menos: é ele que espera a vila juntar
        // gente para a próxima travessia, e ficar meio dia atracado só atrasa.
        b.espera = b.tipo === 0 ? BAL.esperaNoPorto : BAL.esperaNoPorto * 0.4;
      }
      return;

    case Rumo.Colonizando:
      if (!navegar(mundo, b)) {
        desembarcarColonos(mundo, b);
        rumarAoPorto(mundo, b);
      }
      return;

    case Rumo.Patrulhando:
      if (!navegar(mundo, b)) {
        b.pernas--;
        if (b.pernas <= 0 || !escolherPatrulha(mundo, b)) rumarAoPorto(mundo, b);
      }
      return;

    default:
      return;
  }
}

/**
 * Move o barco em direção ao destino. Devolve `false` quando chegou.
 *
 * Encalhou e não sai do lugar? Desiste do destino e volta a decidir. Sem essa
 * saída, um casco preso num canto de baía ficava empurrando a costa para
 * sempre.
 */
function navegar(mundo: Mundo, b: Barco): boolean {
  const g = mundo.grid;
  if (b.destinoX < 0) return false;

  const dx = b.destinoX + 0.5 - b.x;
  const dy = b.destinoY + 0.5 - b.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1.2) {
    b.destinoX = -1;
    return false;
  }

  const vel = (b.tipo === 0 ? BAL.velocidadePesqueiro : BAL.velocidadeNavio) * 2;
  const nx = b.x + (dx / dist) * vel;
  const ny = b.y + (dy / dist) * vel;
  b.dir = dx < 0 ? 0 : 1;

  const podeIr = (x: number, y: number): boolean =>
    g.dentro(x | 0, y | 0) && navegavel(g, g.idx(x | 0, y | 0));

  if (podeIr(nx, ny)) {
    b.x = nx;
    b.y = ny;
  } else if (podeIr(nx, b.y)) {
    b.x = nx;
  } else if (podeIr(b.x, ny)) {
    b.y = ny;
  } else {
    b.destinoX = -1;
    return false;
  }
  return true;
}

/** A linha reta entre dois pontos é toda navegável? */
function caminhoLivre(mundo: Mundo, x0: number, y0: number, x1: number, y1: number): boolean {
  const g = mundo.grid;
  const passos = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let k = 1; k <= passos; k++) {
    const t = k / passos;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    if (!g.dentro(x, y)) return false;
    if (!navegavel(g, g.idx(x, y))) return k === passos; // pode encostar na costa
  }
  return true;
}

/** Procura um bom pesqueiro: mar aberto, de preferência com peixe por perto. */
function escolherPesqueiro(mundo: Mundo, b: Barco): boolean {
  const g = mundo.grid;
  let melhor = -1;
  let melhorNota = -1;
  for (let t = 0; t < 24; t++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const d = mundo.rng.entre(6, BAL.alcanceDePesca);
    const x = Math.round(b.x + Math.cos(ang) * d);
    const y = Math.round(b.y + Math.sin(ang) * d);
    if (!g.dentro(x, y)) continue;
    const i = g.idx(x, y);
    if (!navegavel(g, i)) continue;
    if (!caminhoLivre(mundo, b.x, b.y, x, y)) continue;

    // onde há peixe rende mais, e é isso que faz a frota se juntar no cardume
    let nota = mundo.rng.f();
    mundo.espacial.aoRedor(x + 0.5, y + 0.5, 5, (id) => {
      if (!ESP_INTELIGENTE[mundo.criaturas.especie[id]]) nota += 0.5;
    });
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = i;
    }
  }
  if (melhor < 0) return false;
  b.destinoX = melhor % g.largura;
  b.destinoY = (melhor / g.largura) | 0;
  return true;
}

/** Puxa a rede: come peixe de verdade do mundo, e o resto vem do mar. */
function pescar(mundo: Mundo, b: Barco): void {
  const c = mundo.criaturas;
  let pegou = 0;
  mundo.espacial.aoRedor(b.x, b.y, 2.6, (id) => {
    if (pegou >= 2) return;
    if (!c.vivo[id] || ESP_INTELIGENTE[c.especie[id]]) return;
    if (especies.porIndice(c.especie[id]).dominio !== 'agua') return;
    mundo.matar(id, 'pescado');
    pegou++;
  });
  b.carga += BAL.pescaPorParada + pegou * BAL.pescaPorPeixe;
  b.espera = BAL.esperaPescando;
}

/** Manda o barco de volta para casa. */
function rumarAoPorto(mundo: Mundo, b: Barco): void {
  const g = mundo.grid;
  void g;
  const agua = aguaJuntoDoPorto(mundo, b.porto);
  if (agua < 0) {
    b.rumo = Rumo.Atracado;
    return;
  }
  b.destinoX = agua % g.largura;
  b.destinoY = (agua / g.largura) | 0;
  b.rumo = Rumo.Voltando;
}

/** Descarrega o porão no estoque da aldeia. */
function descarregar(mundo: Mundo, b: Barco, a: Aldeia): void {
  if (b.carga <= 0) return;
  a.estoque.comida = Math.min(a.capacidadeEstoque, a.estoque.comida + b.carga);
  mundo.eventos.emitir('barco:atracou', { aldeia: a.id, carga: Math.round(b.carga) });
  b.carga = 0;
}

/**
 * Enche o barco de combate com colonos e escolhe uma costa distante.
 *
 * Só zarpa se achar destino: gente embarcada num barco sem rumo é gente que
 * some da vila sem nada em troca.
 */
function embarcarColonos(mundo: Mundo, b: Barco, a: Aldeia): boolean {
  if (a.populacao < BAL.populacaoParaEmbarcar) return false;
  if (a.estoque.comida < BAL.comidaParaEmbarcar) return false;
  if (!mundo.rng.chance(BAL.chanceDeZarpar)) return false;

  const alvo = acharCostaDistante(mundo, b);
  if (alvo < 0) return false;

  const g = mundo.grid;
  b.destinoX = alvo % g.largura;
  b.destinoY = (alvo / g.largura) | 0;

  // A gente sai do mapa e volta a existir no desembarque. É o mesmo que a casa
  // faz com quem entra nela, e evita ter de mover cada colono atrás do casco.
  const c = mundo.criaturas;
  const quota = Math.min(BAL.lotacaoDoNavio, Math.floor(a.populacao * 0.3));
  let embarcados = 0;
  for (let i = 0; i < c.limite && embarcados < quota; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
    if (c.abrigo[i] >= 0) continue;
    mundo.matar(i, 'embarcou');
    a.populacao--;
    embarcados++;
  }
  if (embarcados === 0) return false;

  b.tripulantes = embarcados;
  a.estoque.comida -= BAL.comidaParaEmbarcar;
  mundo.eventos.emitir('barco:zarpou', { aldeia: a.id, gente: embarcados });
  return true;
}

/** Desembarca a tripulação e funda a colônia de além-mar. */
function desembarcarColonos(mundo: Mundo, b: Barco): void {
  if (b.tripulantes <= 0) return;
  const g = mundo.grid;
  const mae = mundo.aldeias[b.aldeia];
  if (!mae?.ativa) {
    b.tripulantes = 0;
    return;
  }

  // procura chão firme encostado no ponto de desembarque
  let terra = -1;
  for (let raio = 1; raio <= 5 && terra < 0; raio++) {
    for (let dy = -raio; dy <= raio && terra < 0; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        const x = (b.x | 0) + dx;
        const y = (b.y | 0) + dy;
        if (!g.dentro(x, y)) continue;
        const i = g.idx(x, y);
        if (!g.ehTerra(i) || g.ehMontanha(i)) continue;
        if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) continue;
        terra = i;
        break;
      }
    }
  }
  if (terra < 0) return;

  const x = terra % g.largura;
  const y = (terra / g.largura) | 0;
  const def = especies.porIndice(mae.especie);
  const nova = mundo.criarAldeia(mae.reino, mae.especie, x, y, nomeDeAldeia(mundo.rng, def.id));
  pavimentar(mundo, x, y);
  nova.estoque.comida = 40;
  nova.estoque.madeira = 30;

  const c = mundo.criaturas;
  for (let k = 0; k < b.tripulantes; k++) {
    const filho = mundo.nascer(
      mae.especie,
      x + mundo.rng.entre(-1.5, 1.5),
      y + mundo.rng.entre(-1.5, 1.5),
      0,
      'imigracao',
    );
    if (filho < 0) break;
    c.aldeia[filho] = nova.id;
    c.reino[filho] = nova.reino;
    c.estado[filho] = Estado.Vagando;
    nova.populacao++;
  }
  mundo.eventos.emitir('barco:colonizou', {
    aldeia: nova.id,
    reino: nova.reino,
    x,
    y,
  });
  b.tripulantes = 0;
}

/** Uma costa longe daqui, do outro lado de uma travessia navegável. */
function acharCostaDistante(mundo: Mundo, b: Barco): number {
  const g = mundo.grid;
  for (let t = 0; t < 220; t++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const d = mundo.rng.entre(BAL.travessiaMinima, BAL.travessiaMaxima);
    const x = Math.round(b.x + Math.cos(ang) * d);
    const y = Math.round(b.y + Math.sin(ang) * d);
    if (x < 3 || y < 3 || x >= g.largura - 3 || y >= g.altura - 3) continue;
    const i = g.idx(x, y);
    if (!navegavel(g, i)) continue;
    // tem de haver terra livre encostada — é onde os colonos vão saltar
    let temTerra = false;
    for (let dy = -2; dy <= 2 && !temTerra; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const jx = x + dx;
        const jy = y + dy;
        if (!g.dentro(jx, jy)) continue;
        const j = g.idx(jx, jy);
        if (g.ehTerra(j) && !g.ehMontanha(j) && mundo.aldeiaMaisProxima(jx, jy, 12) < 0) {
          temTerra = true;
          break;
        }
      }
    }
    if (!temTerra) continue;
    if (!caminhoLivre(mundo, b.x, b.y, x, y)) continue;
    return i;
  }
  return -1;
}

/** Uma volta pela costa do reino, para o navio de guerra não ficar parado. */
function escolherPatrulha(mundo: Mundo, b: Barco): boolean {
  const g = mundo.grid;
  for (let t = 0; t < 18; t++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const d = mundo.rng.entre(8, BAL.alcanceDePatrulha);
    const x = Math.round(b.x + Math.cos(ang) * d);
    const y = Math.round(b.y + Math.sin(ang) * d);
    if (!g.dentro(x, y)) continue;
    const i = g.idx(x, y);
    if (!navegavel(g, i)) continue;
    if (!caminhoLivre(mundo, b.x, b.y, x, y)) continue;
    b.destinoX = x;
    b.destinoY = y;
    return true;
  }
  return false;
}
