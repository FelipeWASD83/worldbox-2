import { recursos, REC_SPRITE } from '../dados/recursos.js';
import { edificios, ED_SPRITE } from '../dados/edificios.js';
import { especies } from '../dados/especies.js';

/**
 * Os desenhos das coisas do mapa: árvores, pedras, veios e construções.
 *
 * Cada tipo é desenhado **uma vez** no boot, num canvas do tamanho que ele
 * ocupa no mundo (3×6 tiles viram 48×96 pixels), e depois é só copiado. Assim
 * uma floresta de mil árvores custa mil cópias de imagem, e não mil desenhos
 * refeitos a cada quadro.
 *
 * Cada tipo tem algumas variantes, sorteadas por tile: sem isso uma mata de
 * árvores idênticas fica com cara de papel de parede.
 */

/** Pixels por tile dentro dos sprites de mapa. */
export const PX_TILE = 16;
/** Quantas variantes de cada tipo. */
const VARIANTES = 3;

export type BancoDeMapa = HTMLCanvasElement[][];

export function gerarSpritesDeRecurso(): BancoDeMapa {
  return recursos.todos().map((def, i) => {
    const l = REC_SPRITE[i * 2] * PX_TILE;
    const a = REC_SPRITE[i * 2 + 1] * PX_TILE;
    return criarVariantes(l, a, (ctx, v) => desenharRecurso(ctx, def.id, l, a, v));
  });
}

/**
 * As três variantes de um prédio, num material e por um povo.
 *
 * Feito sob demanda, e não tudo de uma vez no boot: são vinte e um tipos vezes
 * quatro materiais vezes quatro povos vezes três variantes — mil e nove
 * imagens, quase todas de combinações que aquele mundo nunca vai usar. Um
 * mundo real usa umas trinta. Quem chama é `CamadaTiles`, que guarda o
 * resultado num mapa.
 *
 * O material manda na aparência e o povo tempera: uma casa de palha élfica e
 * uma casa de palha órquica são a mesma choça em tons diferentes, e a mesma
 * casa em pedra lavrada é outra construção. É a versão desenhada do que
 * `MATERIAIS_DE_OBRA` faz nos números.
 */
export function spritesDeEdificio(
  tipo: number,
  material: number,
  especie: number,
): HTMLCanvasElement[] {
  const def = edificios.porIndice(tipo);
  const l = ED_SPRITE[tipo * 2] * PX_TILE;
  const a = ED_SPRITE[tipo * 2 + 1] * PX_TILE;
  const pal = paletaDeObra(material, especie);
  return criarVariantes(l, a, (ctx, v) => desenharEdificio(ctx, def.id, l, a, v, pal));
}

/**
 * A paleta de uma obra: o que o material impõe e o que o povo tempera.
 *
 * As cores de cada prédio continuam existindo (o celeiro é amarelado, a
 * ferraria é avermelhada) — elas são **misturadas** com esta, e não
 * substituídas. É o que mantém os prédios distinguíveis entre si depois de
 * todos passarem a ser de pedra.
 */
export interface PaletaDeObra {
  readonly parede: string;
  readonly telhado: string;
  readonly forca: number;
}

// As quatro paletas de obra. Ficam bem separadas de propósito: se palha e
// pedra saírem parecidas na tela, o sistema inteiro de material vira número
// escondido na ficha, e a ideia é que dê para ver de longe qual reino ainda
// vive em choça e qual já assenta cantaria.
const PAREDE_POR_MATERIAL = ['#a89058', '#c69a68', '#a5a199', '#dedad0'];
const TELHADO_POR_MATERIAL = ['#8a7434', '#8e4f38', '#6a5045', '#4c5578'];

function paletaDeObra(material: number, especie: number): PaletaDeObra {
  const m = Math.min(material, PAREDE_POR_MATERIAL.length - 1);
  const povo = especies.porIndice(especie)?.povo;
  const cor = povo?.corReino;
  const telhado = cor === undefined
    ? TELHADO_POR_MATERIAL[m]
    : misturarCor(TELHADO_POR_MATERIAL[m], `#${cor.toString(16).padStart(6, '0')}`, 0.28);
  return { parede: PAREDE_POR_MATERIAL[m], telhado, forca: 0.78 };
}

/**
 * Margem, em pixels, reservada em volta de cada sprite.
 *
 * O contorno cresce para fora do desenho. Sem essa folga ele seria cortado
 * justamente na silhueta — que é a parte que o contorno existe para marcar.
 */
const MARGEM = 2;
/** A mesma folga, medida em tiles. Quem desenha o sprite precisa somá-la. */
export const MARGEM_TILES = MARGEM / PX_TILE;

function criarVariantes(
  largura: number,
  altura: number,
  pintar: (ctx: CanvasRenderingContext2D, variante: number) => void,
): HTMLCanvasElement[] {
  const saida: HTMLCanvasElement[] = [];
  for (let v = 0; v < VARIANTES; v++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, largura) + MARGEM * 2;
    c.height = Math.max(1, altura) + MARGEM * 2;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(MARGEM, MARGEM);
    pintar(ctx, v);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // A ordem importa: contornar primeiro (a sombra não leva contorno, senão
    // vira uma mancha com borda no chão), sombra depois, por baixo de tudo.
    contornar(c);
    sombraNoChao(ctx, MARGEM + largura / 2, MARGEM + altura - 1, largura);
    saida.push(c);
  }
  return saida;
}

/**
 * Cerca o desenho com uma linha escura de um pixel.
 *
 * É o que mais rende num sprite pequeno. Sem contorno, uma copa verde encostada
 * num campo verde some, e uma parede clara se dissolve na areia; com ele, cada
 * coisa tem silhueta própria e o mapa passa a se ler de relance. Roda uma vez
 * por variante no boot, sobre um canvas de poucos milhares de pixels.
 *
 * A cor não é preta: é um marrom-escuro levemente transparente, que escurece o
 * que está atrás sem recortar o objeto do mundo como um adesivo.
 */
function contornar(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const l = canvas.width;
  const a = canvas.height;
  if (l < 3 || a < 3) return;

  const img = ctx.getImageData(0, 0, l, a);
  const d = img.data;
  // Cópia do estado original: sem ela, o contorno recém-escrito conta como
  // desenho e a borda engorda a cada passo pela imagem.
  const antes = new Uint8ClampedArray(d);
  const cheio = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < l && y < a && antes[(y * l + x) * 4 + 3] > 40;

  for (let y = 0; y < a; y++) {
    for (let x = 0; x < l; x++) {
      const k = (y * l + x) * 4;
      if (antes[k + 3] > 40) continue;
      if (!cheio(x - 1, y) && !cheio(x + 1, y) && !cheio(x, y - 1) && !cheio(x, y + 1)) continue;
      d[k] = 32;
      d[k + 1] = 26;
      d[k + 2] = 22;
      d[k + 3] = 190;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * A sombra que prende o objeto ao chão.
 *
 * Uma elipse achatada sob a base, desenhada **por baixo** do que já existe. É
 * barato e é o que separa um desenho colado na tela de um objeto de pé no
 * terreno: sem ela, árvore e casa parecem adesivos flutuando sobre o mapa.
 *
 * Feita em faixas retangulares, e não com `ellipse`: a curva suavizada do canvas
 * borra a borda, e uma sombra borrada num mundo de pixels grita mais que a
 * falta dela.
 */
function sombraNoChao(
  ctx: CanvasRenderingContext2D,
  cx: number,
  base: number,
  largura: number,
): void {
  const raio = Math.max(2, largura * 0.34);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'rgba(20,16,14,0.26)';
  const faixas = 3;
  for (let k = 0; k < faixas; k++) {
    const t = k / faixas;
    const meia = raio * Math.sqrt(1 - t * t);
    ctx.fillRect(Math.round(cx - meia), Math.round(base - k), Math.round(meia * 2), 1);
    if (k > 0) ctx.fillRect(Math.round(cx - meia), Math.round(base + k), Math.round(meia * 2), 1);
  }
  ctx.restore();
}

// --------------------------------------------------------------- utilidades

function bloco(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  l: number,
  a: number,
  cor: string,
): void {
  ctx.fillStyle = cor;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(l), Math.round(a));
}

/**
 * Uma elipse cheia, desenhada em faixas de um pixel.
 *
 * Não usa `ctx.ellipse`: a curva do canvas sai suavizada, e uma borda borrada
 * no meio de um mundo de pixels salta aos olhos. Em faixas a silhueta fica
 * dentada como o resto do jogo, e é isso que se quer.
 */
function elipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  raioX: number,
  raioY: number,
  cor: string,
): void {
  ctx.fillStyle = cor;
  const topo = Math.ceil(cy - raioY);
  const base = Math.floor(cy + raioY);
  for (let y = topo; y <= base; y++) {
    const t = (y + 0.5 - cy) / raioY;
    if (t * t >= 1) continue;
    const meia = raioX * Math.sqrt(1 - t * t);
    ctx.fillRect(Math.round(cx - meia), y, Math.max(1, Math.round(meia * 2)), 1);
  }
}

/**
 * Uma copa de folhagem com volume.
 *
 * Três elipses, e não três retângulos empilhados: a versão de blocos deixava
 * toda árvore com silhueta de caixa, e num mapa florestado o que se via era uma
 * parede verde retangular. A luz vem sempre de cima e da esquerda — a mesma
 * direção em todo o jogo, senão cada objeto parece iluminado por um sol
 * diferente e a cena não fecha.
 *
 * Os tufos soltos na borda quebram o contorno perfeito e são o que faz a copa
 * parecer folha em vez de bola pintada.
 */
function copa(
  ctx: CanvasRenderingContext2D,
  cx: number,
  base: number,
  largura: number,
  altura: number,
  escura: string,
  media: string,
  clara: string,
  variante = 0,
): void {
  const raioX = largura / 2;
  const raioY = altura / 2;
  const cy = base - raioY;

  // o corpo, e por baixo dele uma barriga mais escura que dá a sombra própria
  elipse(ctx, cx, cy, raioX, raioY, media);
  elipse(ctx, cx, cy + raioY * 0.42, raioX * 0.86, raioY * 0.5, escura);
  // e o brilho no alto, à esquerda
  elipse(ctx, cx - raioX * 0.26, cy - raioY * 0.3, raioX * 0.52, raioY * 0.42, clara);

  // tufos na borda: uma silhueta perfeitamente lisa não parece folhagem
  const passos = 5;
  ctx.fillStyle = media;
  for (let k = 0; k < passos; k++) {
    const ang = (k / passos) * Math.PI * 2 + variante * 0.7;
    const tx = cx + Math.cos(ang) * raioX * 0.92;
    const ty = cy + Math.sin(ang) * raioY * 0.92;
    ctx.fillStyle = Math.sin(ang) < 0 ? clara : escura;
    ctx.fillRect(Math.round(tx - 1), Math.round(ty - 1), 3, 2);
  }
}

// ------------------------------------------------------------------ recursos

function desenharRecurso(
  ctx: CanvasRenderingContext2D,
  id: string,
  l: number,
  a: number,
  v: number,
): void {
  const cx = l / 2;
  const desvio = (v - 1) * 2;

  switch (id) {
    case 'arvore':
    case 'arvore_selva':
    case 'arvore_pantano': {
      const escura = id === 'arvore_selva' ? '#1f4a24' : '#26492a';
      const media = id === 'arvore_selva' ? '#2c6330' : '#357a3a';
      const clara = id === 'arvore_selva' ? '#3d7f3c' : '#4d9a48';
      const tronco = a * 0.4;
      const larguraTronco = Math.max(3, Math.round(l * 0.14));
      // o tronco alarga na base, como um pé de árvore de verdade
      bloco(ctx, cx - larguraTronco / 2 + desvio, a - tronco, larguraTronco, tronco, '#4a3524');
      bloco(ctx, cx - larguraTronco / 2 + desvio, a - tronco, 2, tronco, '#6b4e33');
      bloco(ctx, cx - larguraTronco / 2 - 1 + desvio, a - 3, larguraTronco + 2, 3, '#3f2c1e');
      copa(ctx, cx + desvio, a - tronco + 5, l * 0.94, a * 0.66, escura, media, clara, v);
      break;
    }
    case 'pinheiro': {
      const tronco = a * 0.2;
      bloco(ctx, cx - 2 + desvio, a - tronco, 4, tronco, '#4a3722');
      // Um pinheiro é uma pilha de triângulos. Cada andar é desenhado em faixas
      // que estreitam para cima, e não como um retângulo: com blocos, a
      // silhueta virava uma escada de degraus iguais e nada lembrava conífera.
      const andares = 4;
      const corpo = a - tronco;
      for (let k = 0; k < andares; k++) {
        const f = k / andares;
        const baseAndar = a - tronco - corpo * f * 0.82;
        const alturaAndar = corpo * 0.42;
        const largAndar = l * (0.98 - f * 0.62);
        const escuro = k % 2 === 0 ? '#20463a' : '#254e40';
        const claro = k % 2 === 0 ? '#2f6b52' : '#357a5c';
        for (let y = 0; y < alturaAndar; y++) {
          const t = y / alturaAndar;
          const meia = (largAndar / 2) * t;
          const yy = Math.round(baseAndar - alturaAndar + y);
          ctx.fillStyle = escuro;
          ctx.fillRect(Math.round(cx - meia + desvio), yy, Math.max(1, Math.round(meia * 2)), 1);
          ctx.fillStyle = claro;
          ctx.fillRect(Math.round(cx - meia + desvio), yy, Math.max(1, Math.round(meia * 0.7)), 1);
        }
      }
      break;
    }
    case 'arvore_seca': {
      const tronco = a * 0.8;
      bloco(ctx, cx - 2 + desvio, a - tronco, 4, tronco, '#7a6746');
      bloco(ctx, cx - 2 + desvio, a - tronco, 1, tronco, '#94815c');
      // galhos subindo em diagonal, em degraus de um pixel
      for (const lado of [-1, 1]) {
        const alturaGalho = tronco * (lado < 0 ? 0.62 : 0.78);
        for (let k = 0; k < 5; k++) {
          bloco(ctx, cx + lado * (2 + k) + desvio, a - alturaGalho - k, 2, 2, '#63523a');
        }
      }
      break;
    }
    case 'palmeira': {
      const tronco = a * 0.6;
      bloco(ctx, cx - 2 + desvio, a - tronco, 4, tronco, '#6b5233');
      for (let k = 0; k < 5; k++) {
        const ang = -0.2 - k * 0.55;
        const comp = l * 0.44;
        const x = cx + Math.cos(ang) * comp * (k % 2 === 0 ? 1 : -1);
        const y = a - tronco - 4 + Math.abs(Math.sin(ang)) * 5;
        bloco(ctx, Math.min(cx, x), y, Math.abs(x - cx) + 4, 4, '#3f8a3c');
      }
      bloco(ctx, cx - 5, a - tronco - 8, 10, 6, '#4d9a48');
      if (v > 0) bloco(ctx, cx - 2, a - tronco - 2, 4, 4, '#c9a13a');
      break;
    }
    case 'arbusto': {
      bloco(ctx, 2 + desvio, a - 9, l - 4, 8, '#2f5230');
      bloco(ctx, 3 + desvio, a - 11, l - 7, 7, '#3d6b3c');
      // as frutas
      bloco(ctx, 4 + desvio, a - 8, 2, 2, '#c0454f');
      bloco(ctx, l - 6 + desvio, a - 6, 2, 2, '#c0454f');
      if (v === 2) bloco(ctx, cx, a - 10, 2, 2, '#d4565f');
      break;
    }
    case 'cacto': {
      const alto = a * 0.85;
      bloco(ctx, cx - 3, a - alto, 6, alto, '#3f7a42');
      bloco(ctx, cx - 3, a - alto, 2, alto, '#589a52');
      bloco(ctx, cx - 8, a - alto * 0.6, 5, 4, '#3f7a42');
      bloco(ctx, cx - 8, a - alto * 0.75, 4, 6, '#3f7a42');
      break;
    }
    case 'pedra': {
      bloco(ctx, 2 + desvio, a - 9, l - 5, 8, '#6f6d6b');
      bloco(ctx, 3 + desvio, a - 11, l - 8, 7, '#8a8886');
      bloco(ctx, 4 + desvio, a - 10, 3, 3, '#a5a3a0');
      break;
    }
    case 'ferro':
    case 'carvao':
    case 'cobre':
    case 'estanho':
    case 'ouro':
    case 'gema': {
      // afloramento baixo e largo: o minério cabe em 2×1 tiles
      const veios: Record<string, [string, string]> = {
        ferro: ['#9c6f58', '#c08a6c'],
        carvao: ['#2b2a2e', '#4a4850'],
        cobre: ['#b0744a', '#d9995e'],
        estanho: ['#949ca6', '#c2cad4'],
        ouro: ['#d8b036', '#f2d97a'],
        gema: ['#7e5cba', '#b79aea'],
      };
      const [escuro, claro] = veios[id] ?? ['#9c6f58', '#c08a6c'];
      bloco(ctx, 1, a - a * 0.62, l - 2, a * 0.62, '#6b6764');
      bloco(ctx, 2, a - a * 0.72, l - 6, a * 0.3, '#807c78');
      bloco(ctx, 4 + desvio, a - a * 0.5, 4, 4, escuro);
      bloco(ctx, l - 8 + desvio, a - a * 0.42, 3, 3, escuro);
      bloco(ctx, 5 + desvio, a - a * 0.46, 2, 2, claro);
      break;
    }
    default:
      break;
  }
}

// --------------------------------------------------------------- construções

function desenharEdificio(
  ctx: CanvasRenderingContext2D,
  id: string,
  l: number,
  a: number,
  v: number,
  pal: PaletaDeObra,
): void {
  const cx = l / 2;

  /**
   * Corpo com telhado de duas águas: a forma de casa que se lê de longe.
   *
   * Três coisas que a primeira versão não tinha e que fazem toda a diferença
   * num desenho de cinquenta pixels: o **beiral**, que passa da parede e separa
   * telhado de corpo; a **faixa de sombra** logo abaixo dele, que dá a
   * profundidade do beiral; e o **rodapé escuro**, que apoia a casa no chão em
   * vez de deixá-la boiando. A luz vem de cima e da esquerda, como em todo o
   * resto do jogo.
   */
  const casaBase = (corParede: string, corTelhado: string, corSombra: string): void => {
    // O material puxa as três cores para o lado dele, sem apagar a identidade
    // do prédio: um celeiro de pedra continua sendo mais amarelado que uma
    // ferraria de pedra.
    const parede = misturarCor(corParede, pal.parede, pal.forca);
    const telhado = misturarCor(corTelhado, pal.telhado, pal.forca);
    const sombra = misturarCor(corSombra, sombraDe(pal.parede, 0.5), pal.forca);
    const alturaParede = a * 0.46;
    const alturaTelhado = a - alturaParede;
    const topoParede = a - alturaParede;

    bloco(ctx, 2, topoParede, l - 4, alturaParede, parede);
    // canto iluminado à esquerda, canto sombreado à direita
    bloco(ctx, 2, topoParede, 2, alturaParede, clarearCor(parede, 0.18));
    bloco(ctx, l - 5, topoParede, 3, alturaParede, sombra);
    // rodapé: a casa toca o chão
    bloco(ctx, 2, a - 2, l - 4, 2, sombraDe(parede, 0.9));

    // telhado em degraus, que é como um triângulo aparece em pixel
    const degraus = Math.max(4, Math.round(alturaTelhado / 3));
    for (let k = 0; k < degraus; k++) {
      const f = k / degraus;
      // o beiral avança sobre a parede na primeira fileira
      const larg = k === 0 ? l : l * (1 - f * 0.8);
      const y = a - alturaParede - alturaTelhado * (f + 1 / degraus);
      bloco(ctx, cx - larg / 2, y, larg, alturaTelhado / degraus + 1,
        k === 0 ? clarearCor(telhado, 0.1) : sombraDe(telhado, f * 0.7));
      // uma fileira de telha mais clara, para o telhado não ser uma chapa lisa
      if (k > 0 && k % 2 === 0) {
        bloco(ctx, cx - larg / 2, y, larg, 1, clarearCor(telhado, 0.16));
      }
    }
    // a sombra que o beiral joga na parede
    bloco(ctx, 2, topoParede, l - 4, 2, sombraDe(parede, 0.75));
  };

  /** Uma abertura com moldura: sem o contorno claro ela vira um borrão. */
  const abertura = (x: number, y: number, larg: number, alt: number, dentro: string): void => {
    bloco(ctx, x - 1, y - 1, larg + 2, alt + 2, '#4a3524');
    bloco(ctx, x, y, larg, alt, dentro);
  };

  switch (id) {
    case 'fogueira': {
      // Três achas cruzadas e uma chama. Não tem parede nem telhado: é
      // justamente o ponto — a era tribal não constrói, ela acende.
      const base = a * 0.55;
      bloco(ctx, cx - l * 0.34, a - 3, l * 0.68, 3, '#4a3a2c');
      bloco(ctx, cx - l * 0.3, a - base * 0.5, l * 0.24, 3, '#6b4a2e');
      bloco(ctx, cx + l * 0.06, a - base * 0.5, l * 0.24, 3, '#7d5836');
      bloco(ctx, cx - 2, a - base * 0.9, 4, base * 0.45, '#8a5f38');
      // a chama, mais alta na variante do meio
      const alt = base * (0.55 + v * 0.12);
      bloco(ctx, cx - 3, a - base * 0.45 - alt, 6, alt, '#e08a2a');
      bloco(ctx, cx - 2, a - base * 0.45 - alt * 0.75, 4, alt * 0.7, '#f2c24a');
      bloco(ctx, cx - 1, a - base * 0.45 - alt * 0.45, 2, alt * 0.4, '#fdf0b0');
      break;
    }
    case 'casa':
      casaBase('#cda474', '#9a4f3a', '#a8815a');
      abertura(cx - 3, a - a * 0.3, 6, a * 0.3 - 2, '#4a3220'); // porta
      abertura(5, a - a * 0.4, 4, 4, '#8cc2d4'); // janela
      bloco(ctx, 5, a - a * 0.4, 4, 2, '#b8dce8'); // reflexo no vidro
      if (v > 0) bloco(ctx, l - 9, a - a * 0.4, 4, 4, '#8cc2d4');
      break;
    case 'celeiro':
      casaBase('#b08a4a', '#6d4a2c', '#96733c');
      bloco(ctx, cx - 6, a - a * 0.42, 12, a * 0.3, '#e0c98a');
      break;
    case 'fazenda': {
      // lavoura rasteira: sulcos de terra com pé de planta
      bloco(ctx, 0, 0, l, a, '#7a5a34');
      for (let k = 0; k < 4; k++) {
        bloco(ctx, 1 + k * (l / 4), 1, Math.max(2, l / 8), a - 2, v === 0 ? '#b8a44a' : '#a89a44');
      }
      break;
    }
    case 'muralha':
      bloco(ctx, 0, a * 0.35, l, a * 0.65, '#807c76');
      bloco(ctx, 0, a * 0.35, l, 3, '#9b968f');
      bloco(ctx, 1, a * 0.12, 5, a * 0.25, '#9b968f');
      bloco(ctx, l - 6, a * 0.12, 5, a * 0.25, '#9b968f');
      break;
    case 'torre':
      bloco(ctx, 2, a * 0.22, l - 4, a * 0.78, '#6a6662');
      bloco(ctx, 2, a * 0.22, 3, a * 0.78, '#565350');
      bloco(ctx, 0, a * 0.1, l, a * 0.14, '#8a8680');
      bloco(ctx, cx - 2, a * 0.45, 4, 5, '#23211f');
      break;
    case 'castelo': {
      const corpo = a * 0.55;
      bloco(ctx, l * 0.14, a - corpo, l * 0.72, corpo, '#5c6070');
      bloco(ctx, l * 0.14, a - corpo, l * 0.08, corpo, '#4a4e5c');
      // três torres, a do meio mais alta
      const torres = [
        [0, a * 0.28],
        [l * 0.38, a * 0.12],
        [l * 0.78, a * 0.28],
      ] as const;
      for (const [tx, ty] of torres) {
        bloco(ctx, tx, ty, l * 0.22, a - ty, '#787d8e');
        bloco(ctx, tx, ty, l * 0.22, 4, '#8d92a3');
      }
      bloco(ctx, cx - 4, a - a * 0.28, 8, a * 0.28, '#2c2f38'); // portão
      break;
    }
    case 'serraria':
      casaBase('#8a6238', '#5c4024', '#74522f');
      bloco(ctx, l - 14, a - a * 0.4, 11, 11, '#d8d2c4'); // a serra
      bloco(ctx, 3, a - 6, 10, 4, '#6b5233'); // toras
      break;
    case 'mina':
      bloco(ctx, 1, a * 0.35, l - 2, a * 0.65, '#5a5652');
      bloco(ctx, cx - l * 0.22, a * 0.5, l * 0.44, a * 0.5, '#231f1e'); // a boca
      bloco(ctx, cx - l * 0.3, a * 0.36, l * 0.6, 5, '#7a6244'); // escora
      bloco(ctx, cx - l * 0.3, a * 0.36, 5, a * 0.2, '#7a6244');
      bloco(ctx, cx + l * 0.22, a * 0.36, 5, a * 0.2, '#7a6244');
      break;
    case 'ferraria':
      casaBase('#6e5646', '#3f3230', '#5c4739');
      bloco(ctx, cx - 5, a - a * 0.3, 10, a * 0.22, '#e07a30'); // a forja acesa
      bloco(ctx, l - 8, 2, 5, a * 0.34, '#4a4440'); // chaminé
      break;
    case 'mercado':
      bloco(ctx, 2, a * 0.55, l - 4, a * 0.45, '#8a6a3a');
      // toldo listrado
      for (let k = 0; k < 4; k++) {
        bloco(ctx, 1 + k * (l / 4), a * 0.28, l / 8, a * 0.28, '#c9a03c');
        bloco(ctx, 1 + k * (l / 4) + l / 8, a * 0.28, l / 8, a * 0.28, '#b8862c');
      }
      bloco(ctx, 0, a * 0.24, l, 4, '#8a6a3a');
      break;
    case 'templo': {
      const corpo = a * 0.55;
      bloco(ctx, 3, a - corpo, l - 6, corpo, '#cfc9b8');
      // colunas
      for (let k = 0; k < 3; k++) {
        bloco(ctx, 4 + k * ((l - 8) / 3), a - corpo, 4, corpo, '#b8b0a0');
      }
      bloco(ctx, 0, a - corpo - 6, l, 6, '#e8e2d2'); // arquitrave
      const degraus = 4;
      for (let k = 0; k < degraus; k++) {
        const larg = l * (1 - k / degraus * 0.8);
        bloco(ctx, cx - larg / 2, a - corpo - 6 - (a * 0.3) * ((k + 1) / degraus),
          larg, (a * 0.3) / degraus + 1, '#ddd7c6');
      }
      break;
    }
    case 'moinho': {
      // torre que estreita para cima
      const alturaTorre = a * 0.62;
      const degraus = 6;
      for (let k = 0; k < degraus; k++) {
        const f = k / degraus;
        const larg = l * (0.62 - f * 0.2);
        bloco(ctx, cx - larg / 2, a - alturaTorre * (1 - f), larg, alturaTorre / degraus + 1,
          k % 2 === 0 ? '#d8cbaa' : '#c9bb98');
      }
      bloco(ctx, cx - 4, a - a * 0.2, 8, a * 0.2, '#6b5233'); // porta
      // capuz
      bloco(ctx, cx - l * 0.22, a - alturaTorre - a * 0.1, l * 0.44, a * 0.1, '#7a4a32');
      // as pás, em X
      const eixoY = a - alturaTorre - a * 0.02;
      for (const [ex, ey] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        for (let k = 2; k < 9; k++) {
          bloco(ctx, cx + ex * k * 2.6, eixoY + ey * k * 2.6, 3, 3, '#efe6cf');
        }
      }
      bloco(ctx, cx - 2, eixoY - 2, 5, 5, '#5c4028');
      break;
    }
    case 'prefeitura': {
      const corpo = a * 0.5;
      bloco(ctx, 2, a - corpo, l - 4, corpo, '#d8cfb4');
      bloco(ctx, 2, a - corpo, 3, corpo, '#b8ae94');
      // torre do relógio no meio
      bloco(ctx, cx - 4, a - corpo - a * 0.34, 8, a * 0.34, '#e2d9bd');
      bloco(ctx, cx - 3, a - corpo - a * 0.26, 6, 6, '#4a4438');
      bloco(ctx, cx - 6, a - corpo - a * 0.4, 12, 4, '#8a5a3a');
      bloco(ctx, cx - 3, a - a * 0.24, 6, a * 0.24, '#5c4028');
      break;
    }
    case 'banco': {
      const corpo = a * 0.6;
      bloco(ctx, 2, a - corpo, l - 4, corpo, '#cbbd8e');
      // colunas e frontão: cara de tesouro
      for (let k = 0; k < 4; k++) bloco(ctx, 4 + k * ((l - 8) / 4), a - corpo, 3, corpo, '#e0d3a4');
      bloco(ctx, 0, a - corpo - 6, l, 6, '#e8dcb0');
      bloco(ctx, cx - 5, a - corpo - 12, 10, 6, '#c9a83c');
      break;
    }
    case 'biblioteca': {
      const corpo = a * 0.62;
      bloco(ctx, 2, a - corpo, l - 4, corpo, '#a8909e');
      bloco(ctx, 2, a - corpo, l - 4, 5, '#6e5a70');
      // janelas altas
      for (let k = 0; k < 3; k++) bloco(ctx, 5 + k * ((l - 10) / 3), a - corpo * 0.75, 4, 8, '#3d3348');
      bloco(ctx, cx - 3, a - a * 0.2, 6, a * 0.2, '#4a3b2e');
      break;
    }
    case 'taverna': {
      casaBase('#b07a48', '#6b3f28', '#96663c');
      // tabuleta pendurada
      bloco(ctx, l - 6, a - a * 0.44, 4, 6, '#d8c48a');
      bloco(ctx, l - 5, a - a * 0.42, 2, 3, '#6b3f28');
      bloco(ctx, cx - 3, a - a * 0.3, 6, a * 0.3, '#4a3020');
      break;
    }
    case 'quartel': {
      const corpo = a * 0.6;
      bloco(ctx, 1, a - corpo, l - 2, corpo, '#7c7668');
      bloco(ctx, 1, a - corpo, l - 2, 4, '#5e5950');
      // ameias
      for (let k = 0; k < 4; k++) bloco(ctx, 1 + k * ((l - 2) / 4), a - corpo - 4, 3, 4, '#8e8878');
      bloco(ctx, cx - 3, a - a * 0.26, 6, a * 0.26, '#2e2a26');
      bloco(ctx, 3, a - corpo * 0.7, 3, 3, '#b03c30');
      break;
    }
    case 'poco': {
      bloco(ctx, 2, a - 8, l - 4, 7, '#8a8682');
      bloco(ctx, 3, a - 9, l - 6, 3, '#a5a19c');
      bloco(ctx, cx - 3, a - 6, 6, 4, '#243040');
      // telhadinho
      bloco(ctx, 1, a - 15, 2, 8, '#6b5233');
      bloco(ctx, l - 3, a - 15, 2, 8, '#6b5233');
      bloco(ctx, 0, a - 17, l, 3, '#8a4f36');
      break;
    }
    case 'porto': {
      // Um cais de tábuas avançando sobre a água, com um galpão no lado de
      // terra. A silhueta que tem de se ler de longe é a do trapiche saindo do
      // continente — é o que diz "daqui saem barcos".
      const galpao = a * 0.62;
      bloco(ctx, 1, a - galpao, l * 0.44, galpao, '#7c5a36');
      bloco(ctx, 1, a - galpao, l * 0.44, 3, '#966f42');
      // telhado do galpão
      for (let k = 0; k < 4; k++) {
        const larg = l * 0.5 * (1 - k * 0.18);
        bloco(ctx, 1 + (l * 0.5 - larg) / 2, a - galpao - 3 - k * 3, larg, 4,
          k === 0 ? '#8a4a34' : sombraDe('#8a4a34', k * 0.2));
      }
      // o deque, avançando para o lado da água
      bloco(ctx, l * 0.42, a - 9, l * 0.58, 6, '#a8814e');
      for (let k = 0; k < 5; k++) {
        bloco(ctx, l * 0.46 + k * (l * 0.11), a - 9, 2, 6, '#8a6a3e');
      }
      // estacas mergulhando
      for (let k = 0; k < 4; k++) {
        bloco(ctx, l * 0.5 + k * (l * 0.12), a - 4, 2, 5, '#6b5233');
      }
      // pilha de caixas e um barril
      bloco(ctx, l * 0.2, a - galpao - 2, 5, 5, '#9a7a4a');
      bloco(ctx, l * 0.32, a - galpao + 1, 4, 4, '#8a6a3e');
      break;
    }
    case 'vulcao': {
      // cone escuro com a boca acesa e um fio de fumaça
      const base = l * 0.94;
      const topo = l * 0.3;
      for (let f = 0; f < a - 2; f++) {
        const t = f / (a - 2);
        const w = base + (topo - base) * t;
        bloco(ctx, cx - w / 2, a - 1 - f, w, 1, t > 0.82 ? '#5a4038' : sombraDe('#4a3a36', t * 0.5));
      }
      // encosta iluminada de um lado só, para o cone não ficar chapado
      for (let f = 0; f < a - 4; f++) {
        const t = f / (a - 4);
        const w = (base + (topo - base) * t) * 0.34;
        bloco(ctx, cx + w * 0.5, a - 1 - f, w * 0.6, 1, sombraDe('#63504a', t * 0.6));
      }
      // a boca e o que escorre dela
      bloco(ctx, cx - topo / 2, 1, topo, 3, '#e8641e');
      bloco(ctx, cx - topo / 4, 0, topo / 2, 2, '#ffc24a');
      bloco(ctx, cx - 1, 3, 2, a * 0.34, '#d4521c');
      bloco(ctx, cx + topo * 0.3, 4, 1.5, a * 0.2, '#c2481a');
      break;
    }
    case 'ruina':
      bloco(ctx, 1, a - 7, 5, 6, '#4a453f');
      bloco(ctx, l - 6, a - 5, 4, 4, '#5c564e');
      bloco(ctx, cx - 2, a - 4, 4, 3, '#4a453f');
      break;
    default:
      break;
  }
}

/** A mesma cor, mais clara. É o brilho do lado de onde vem a luz. */
/** Mistura duas cores, com `f` indo de 0 (só a primeira) a 1 (só a segunda). */
function misturarCor(a: string, b: string, f: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const c = (deslocamento: number): number => {
    const ca = (na >> deslocamento) & 255;
    const cb = (nb >> deslocamento) & 255;
    return Math.round(ca + (cb - ca) * f);
  };
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

function clarearCor(cor: string, f: number): string {
  const n = parseInt(cor.slice(1), 16);
  const mistura = (c: number): number => Math.round(c + (255 - c) * f);
  const r = mistura((n >> 16) & 255);
  const g = mistura((n >> 8) & 255);
  const b = mistura(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function sombraDe(cor: string, f: number): string {
  const n = parseInt(cor.slice(1), 16);
  const k = 1 - f * 0.35;
  const r = (((n >> 16) & 255) * k) | 0;
  const g = (((n >> 8) & 255) * k) | 0;
  const b = ((n & 255) * k) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

