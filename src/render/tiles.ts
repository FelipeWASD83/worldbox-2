import type { Mundo } from '../core/mundo.js';
import { nevado } from '../sim/estacoes.js';
import { BIOMA_AGUA, BIOMA_COR, biomas } from '../dados/biomas.js';
import { REC_SPRITE } from '../dados/recursos.js';
import {
  ED, ED_OCUPA, ED_SPRITE, especieDoAcabamento, materialDoAcabamento,
} from '../dados/edificios.js';
import type { Camera } from './camera.js';
import {
  gerarSpritesDeRecurso, spritesDeEdificio, MARGEM_TILES, PX_TILE, type BancoDeMapa,
} from './spritesMapa.js';

/**
 * O terreno visto de perto, em duas camadas.
 *
 * **O chão** — bioma, textura, estrada, lavoura e cor do reino — é desenhado em
 * pedaços de 16×16 tiles guardados em cache: quadro nenhum redesenha o mapa.
 *
 * **Os objetos altos** — árvores, pedras, veios e construções — não cabem no
 * cache, porque uma árvore de 3×6 atravessa a fronteira dos pedaços e seria
 * cortada ao meio. Eles são desenhados por cima, na hora, varrendo os tiles
 * visíveis de cima para baixo: quem está mais ao sul é desenhado depois e cobre
 * quem está atrás, que é o que dá profundidade ao mapa.
 *
 * Cada objeto é ancorado pela **base**: uma árvore de seis tiles de altura tem
 * o pé no tile dela, e a copa passa por cima dos vizinhos sem ocupá-los. É o
 * que permite uma mata fechada sem que cada árvore reserve dezoito tiles.
 */

/** Lado do pedaço de chão, em tiles. */
const LADO_PEDACO = 16;
/**
 * Acima deste zoom o chão detalhado entra no lugar do mapa esticado.
 *
 * Baixo de propósito: é ele que decide **quanto mundo cabe na tela com os
 * desenhos ligados**. Em 5,5 era preciso aproximar tanto para ver a textura que
 * cabiam poucas casas na tela; em 3,5, um bairro inteiro aparece de uma vez,
 * que é a escala da referência.
 */
export const ZOOM_DETALHE = 3.5;
/**
 * Zoom a partir do qual a rebentação aparece.
 *
 * Mais alto que o do chão detalhado: de longe a espuma vira um contorno branco
 * em volta de cada ilha e o mapa fica sujo. É um efeito de chegar perto.
 */
const ZOOM_ONDAS = 7;
/** A cada quantos ticks o mapa político é recontado. */
const INTERVALO_BLOCOS = 240;
/**
 * Lado do bloco do mapa político, em tiles.
 *
 * É **separado** do lado do pedaço de chão: aquele é tamanho de cache de
 * desenho e tem motivo de performance para ser 16; este é resolução de
 * fronteira e tem motivo estético para ser pequeno. Enquanto os dois eram o
 * mesmo número, o território saía em degraus de dezesseis tiles — uma vila
 * inteira cabia num quadrado só, e a divisa entre dois reinos parecia um
 * tabuleiro em vez de uma linha.
 */
const LADO_BLOCO = 6;
/**
 * Quantos tiles de um dono um bloco precisa ter para ser pintado como dele.
 *
 * Um oitavo do bloco. Serve para um punhado de tiles perdidos — um caçador que
 * fincou bandeira longe, uma ponta de território que sobrou — não pintarem um
 * quadrado inteiro no mapa político.
 */
const VOTOS_PARA_O_BLOCO = Math.max(2, Math.round((LADO_BLOCO * LADO_BLOCO) / 8));
/**
 * As cores de flor que salpicam o campo fértil.
 *
 * Poucas e pouco saturadas de propósito: o objetivo é sugerir vida no chão, não
 * pintar um jardim. Uma a cada dezesseis tiles de mato alto já basta.
 */
const FLORES = ['#e8d98a', '#d98aa8', '#c9d4e8', '#e8a86a'];
const MIN_CACHE = 96;
const MAX_CACHE = 480;
const ORCAMENTO_POR_QUADRO = 6;
/** A maior profundidade de construção do registro, para a margem da varredura. */
const PROFUNDIDADE_MAXIMA = (() => {
  let m = 1;
  for (let i = 0; i < ED_OCUPA.length; i += 2) m = Math.max(m, ED_OCUPA[i + 1]);
  return m;
})();

interface Pedaco {
  canvas: HTMLCanvasElement;
  versao: number;
  usadoEm: number;
}

export class CamadaTiles {
  private cache = new Map<number, Pedaco>();
  private limite = MIN_CACHE;
  private quadro = 0;
  private paletas: Uint32Array[] = [];
  private spritesRecurso: BancoDeMapa;
  /**
   * Os desenhos de prédio já gerados, por (tipo, material, povo).
   *
   * Preenchido sob demanda: a combinação completa passaria de mil imagens e um
   * mundo real usa umas trinta. Ver `spritesDeEdificio`.
   */
  private spritesEdificio = new Map<number, HTMLCanvasElement[]>();
  /** Quantos objetos foram desenhados no último quadro. */
  objetosDesenhados = 0;
  /**
   * Mostrar a cor e a fronteira dos reinos no chão detalhado.
   *
   * Acompanha a mesma caixa de seleção do mapa afastado. Antes só o mapa
   * afastado obedecia a ela, e desligar "territórios" não mudava nada de perto.
   */
  mostrarTerritorio = true;
  /** De que reino é cada bloco do mapa político, ou -1. Ver `desenharTerritorio`. */
  private donoDoBloco = new Int16Array(0);
  /** Tick da última recontagem dos blocos. */
  private blocosEm = -1;

  constructor(private mundo: Mundo) {
    this.montarPaletas();
    this.spritesRecurso = gerarSpritesDeRecurso();
    // o banco de prédios é preenchido sob demanda — ver `bancoDeEdificio`
    this.spritesEdificio.clear();

  }

  trocarMundo(mundo: Mundo): void {
    this.mundo = mundo;
    this.cache.clear();
  }

  /** Joga fora o chão já desenhado. Usado quando uma opção de exibição muda. */
  limparTudo(): void {
    this.cache.clear();
  }

  /** Cada bioma ganha quatro tons, sorteados por tile: textura sem imagem. */
  private montarPaletas(): void {
    this.paletas = biomas.todos().map((b, indice) => {
      const base = indice * 3;
      const r = BIOMA_COR[base];
      const g = BIOMA_COR[base + 1];
      const azul = BIOMA_COR[base + 2];
      const tons = new Uint32Array(4);
      for (let k = 0; k < 4; k++) {
        const d = (k - 1.5) * b.variacao * 0.9;
        tons[k] = cor(r + d, g + d, azul + d);
      }
      return tons;
    });
  }

  /** Desenha o chão. Devolve quantos pedaços ainda faltam ficar prontos. */
  desenharChao(ctx: CanvasRenderingContext2D, cam: Camera): number {
    this.quadro++;
    const g = this.mundo.grid;
    const area = cam.area();
    const largura = Math.ceil(g.largura / LADO_PEDACO);
    const p0x = Math.max(0, Math.floor(area.x0 / LADO_PEDACO));
    const p1x = Math.min(largura - 1, Math.floor(area.x1 / LADO_PEDACO));
    const p0y = Math.max(0, Math.floor(area.y0 / LADO_PEDACO));
    const p1y = Math.min(Math.ceil(g.altura / LADO_PEDACO) - 1, Math.floor(area.y1 / LADO_PEDACO));

    let orcamento = ORCAMENTO_POR_QUADRO;
    let faltando = 0;
    const visiveis = (p1x - p0x + 1) * (p1y - p0y + 1);
    // o cache tem de caber o que a tela mostra, senão descarta o que está à
    // vista e redesenha para sempre
    this.limite = Math.min(MAX_CACHE, Math.max(MIN_CACHE, Math.ceil(visiveis * 1.5)));

    for (let py = p0y; py <= p1y; py++) {
      for (let px = p0x; px <= p1x; px++) {
        const chave = py * largura + px;
        const versao = this.versaoDoPedaco(px, py);
        let pedaco = this.cache.get(chave);

        if (!pedaco || pedaco.versao !== versao) {
          if (orcamento <= 0) {
            faltando++;
            continue;
          }
          orcamento--;
          pedaco = this.construir(px, py, versao, pedaco);
          this.cache.set(chave, pedaco);
        }

        pedaco.usadoEm = this.quadro;
        const escala = cam.escala / PX_TILE;
        ctx.drawImage(
          pedaco.canvas,
          cam.mundoParaTelaX(px * LADO_PEDACO),
          cam.mundoParaTelaY(py * LADO_PEDACO),
          pedaco.canvas.width * escala,
          pedaco.canvas.height * escala,
        );
      }
    }

    this.limparCache();
    return faltando;
  }

  /** Os três desenhos daquele prédio naquele material e por aquele povo. */
  private bancoDeEdificio(tipo: number, material: number, especie: number): HTMLCanvasElement[] {
    const chave = (tipo * 8 + material) * 32 + especie;
    let banco = this.spritesEdificio.get(chave);
    if (!banco) {
      banco = spritesDeEdificio(tipo, material, especie);
      this.spritesEdificio.set(chave, banco);
    }
    return banco;
  }

  /**
   * O território dos reinos, em blocos do tamanho do pedaço de chão.
   *
   * Antes cada tile era tingido e contornado por conta própria, e a fronteira
   * saía serrilhada tile a tile — um recorte irregular que dizia mais sobre o
   * algoritmo de expansão do que sobre política. Aqui o mapa político tem a
   * resolução de um **bloco de poucos tiles**: o bloco pertence a quem tem mais tiles
   * dentro dele, e a divisa é o contorno dos blocos.
   *
   * A perda de precisão é o ponto. Fronteira é uma linha grossa num mapa, não o
   * cadastro de cada metro quadrado — e de longe é isto que se lê como "até
   * aqui é meu".
   *
   * Fica fora do cache de chão porque depende dos blocos vizinhos, e um pedaço
   * do cache não sabe nada sobre o vizinho dele.
   */
  desenharTerritorio(ctx: CanvasRenderingContext2D, cam: Camera, pintar = true): void {
    if (!this.mostrarTerritorio) return;
    const g = this.mundo.grid;
    const area = cam.area();
    const blocosX = Math.ceil(g.largura / LADO_BLOCO);
    const blocosY = Math.ceil(g.altura / LADO_BLOCO);

    if (this.donoDoBloco.length !== blocosX * blocosY) {
      this.donoDoBloco = new Int16Array(blocosX * blocosY);
      this.blocosEm = -1;
    }
    // recontar o mapa inteiro a cada quadro seria absurdo; a fronteira anda
    // devagar e uma atualização a cada poucos segundos basta
    if (this.mundo.tick - this.blocosEm > INTERVALO_BLOCOS || this.blocosEm < 0) {
      this.recontarBlocos(blocosX, blocosY);
      this.blocosEm = this.mundo.tick;
    }

    const b0x = Math.max(0, Math.floor(area.x0 / LADO_BLOCO));
    const b1x = Math.min(blocosX - 1, Math.floor(area.x1 / LADO_BLOCO));
    const b0y = Math.max(0, Math.floor(area.y0 / LADO_BLOCO));
    const b1y = Math.min(blocosY - 1, Math.floor(area.y1 / LADO_BLOCO));
    const lado = LADO_BLOCO * cam.escala;
    const grossura = Math.max(1.5, cam.escala * 0.34);

    for (let by = b0y; by <= b1y; by++) {
      for (let bx = b0x; bx <= b1x; bx++) {
        const dono = this.donoDoBloco[by * blocosX + bx];
        if (dono < 0) continue;
        const reino = this.mundo.reinos[dono];
        if (!reino?.ativo) continue;

        const vr = (reino.cor >> 16) & 255;
        const vg = (reino.cor >> 8) & 255;
        const vb = reino.cor & 255;
        const px = cam.mundoParaTelaX(bx * LADO_BLOCO);
        const py = cam.mundoParaTelaY(by * LADO_BLOCO);

        if (pintar) {
          ctx.fillStyle = `rgba(${vr},${vg},${vb},0.12)`;
          ctx.fillRect(px, py, lado, lado);
        }

        // a divisa só aparece onde o bloco vizinho é de outro dono
        ctx.fillStyle = `rgba(${vr},${vg},${vb},0.9)`;
        const norte = by > 0 ? this.donoDoBloco[(by - 1) * blocosX + bx] : -1;
        const sul = by < blocosY - 1 ? this.donoDoBloco[(by + 1) * blocosX + bx] : -1;
        const oeste = bx > 0 ? this.donoDoBloco[by * blocosX + bx - 1] : -1;
        const leste = bx < blocosX - 1 ? this.donoDoBloco[by * blocosX + bx + 1] : -1;
        if (norte !== dono) ctx.fillRect(px, py, lado, grossura);
        if (sul !== dono) ctx.fillRect(px, py + lado - grossura, lado, grossura);
        if (oeste !== dono) ctx.fillRect(px, py, grossura, lado);
        if (leste !== dono) ctx.fillRect(px + lado - grossura, py, grossura, lado);
      }
    }
  }

  /** De quem é cada bloco: o reino com mais tiles dentro dele. */
  private recontarBlocos(blocosX: number, blocosY: number): void {
    const g = this.mundo.grid;
    const votos = new Map<number, number>();

    for (let by = 0; by < blocosY; by++) {
      for (let bx = 0; bx < blocosX; bx++) {
        votos.clear();
        const x1 = Math.min(g.largura, (bx + 1) * LADO_BLOCO);
        const y1 = Math.min(g.altura, (by + 1) * LADO_BLOCO);
        for (let y = by * LADO_BLOCO; y < y1; y++) {
          for (let x = bx * LADO_BLOCO; x < x1; x++) {
            const r = g.territorio[y * g.largura + x];
            if (r < 0) continue;
            votos.set(r, (votos.get(r) ?? 0) + 1);
          }
        }
        let dono = -1;
        let maior = 0;
        for (const [r, n] of votos) {
          if (n > maior) {
            maior = n;
            dono = r;
          }
        }
        // um punhado de tiles perdidos não pinta um bloco inteiro
        this.donoDoBloco[by * blocosX + bx] = maior >= VOTOS_PARA_O_BLOCO ? dono : -1;
      }
    }
  }

  /**
   * A rebentação na beira d'água, indo e voltando.
   *
   * Fica **fora** do cache de propósito: o chão é guardado em pedaços prontos e
   * só é redesenhado quando muda, e uma espuma que se mexe a cada quadro
   * invalidaria o mapa inteiro sessenta vezes por segundo. Aqui é uma passada
   * pelos tiles de água visíveis, e só os que encostam em terra desenham
   * alguma coisa — numa tela cheia são algumas centenas.
   *
   * A onda é uma senóide no tempo somada à posição do tile: tiles vizinhos
   * ficam levemente fora de fase, e é isso que faz a espuma correr pela praia
   * em vez de piscar toda junta.
   */
  desenharOndas(ctx: CanvasRenderingContext2D, cam: Camera, tempo: number): void {
    if (cam.escala < ZOOM_ONDAS) return;
    const g = this.mundo.grid;
    const area = cam.area();
    const x0 = Math.max(1, Math.floor(area.x0));
    const x1 = Math.min(g.largura - 2, Math.ceil(area.x1));
    const y0 = Math.max(1, Math.floor(area.y0));
    const y1 = Math.min(g.altura - 2, Math.ceil(area.y1));
    // some junto com o zoom, para a espuma não pipocar ao cruzar o limiar
    const forca = Math.min(1, (cam.escala - ZOOM_ONDAS) / 3);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * g.largura + x;
        if (BIOMA_AGUA[g.bioma[i]] !== 1) continue;
        // só a água que encosta em terra rebenta
        const norte = BIOMA_AGUA[g.bioma[i - g.largura]] !== 1;
        const sul = BIOMA_AGUA[g.bioma[i + g.largura]] !== 1;
        const oeste = BIOMA_AGUA[g.bioma[i - 1]] !== 1;
        const leste = BIOMA_AGUA[g.bioma[i + 1]] !== 1;
        if (!norte && !sul && !oeste && !leste) continue;

        const fase = tempo * 2.1 + (x + y) * 0.55;
        const maré = (Math.sin(fase) + 1) / 2;
        const alfa = (0.2 + maré * 0.45) * forca;
        const px = cam.mundoParaTelaX(x);
        const py = cam.mundoParaTelaY(y);
        const e = cam.escala;
        const grossura = Math.max(1, e * (0.1 + maré * 0.14));
        const avanco = e * maré * 0.16;

        ctx.fillStyle = `rgba(226,240,248,${alfa.toFixed(3)})`;
        if (norte) ctx.fillRect(px, py - avanco, e, grossura);
        if (sul) ctx.fillRect(px, py + e - grossura + avanco, e, grossura);
        if (oeste) ctx.fillRect(px - avanco, py, grossura, e);
        if (leste) ctx.fillRect(px + e - grossura + avanco, py, grossura, e);
      }
    }
  }

  /**
   * Desenha árvores, pedras, veios e construções por cima do chão.
   *
   * A ordem sai pronta da varredura de cima para baixo — quem está mais ao sul
   * é desenhado por último e fica na frente. Não é preciso ordenar nada.
   */
  desenharObjetos(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    antesDaLinha?: (y: number) => void,
  ): void {
    const g = this.mundo.grid;
    const area = cam.area();
    // margem larga: a copa de uma árvore alta entra na tela muito antes do pé
    const x0 = Math.max(0, Math.floor(area.x0) - 3);
    const x1 = Math.min(g.largura - 1, Math.ceil(area.x1) + 3);
    // a margem de cima é a maior profundidade do registro: um castelo ancorado
    // acima do topo ainda tem fileiras dentro da tela e não pode sumir inteiro
    const y0 = Math.max(0, Math.floor(area.y0) - PROFUNDIDADE_MAXIMA);
    const y1 = Math.min(g.altura - 1, Math.ceil(area.y1) + 7);
    let desenhados = 0;

    for (let y = y0; y <= y1; y++) {
      // Quem está mais ao norte é desenhado antes, e é aqui que as criaturas se
      // intercalam: quem tem o pé nesta linha ou acima dela entra agora, antes
      // das árvores e das casas desta linha. Sem isso o bicho vinha sempre por
      // cima de tudo, e uma floresta ficava com coelho flutuando sobre as copas.
      antesDaLinha?.(y);

      for (let x = x0; x <= x1; x++) {
        const i = y * g.largura + x;

        const r = g.recurso[i];
        if (r !== 0) {
          const tipo = r - 1;
          const banco = this.spritesRecurso[tipo];
          const img = banco[g.matiz[i] % banco.length];
          // recurso esgotado encolhe: dá para ver a floresta sumindo
          const cheio = 0.55 + Math.min(1, g.recursoQtd[i] / 40) * 0.45;
          // O sprite tem uma folga em volta para o contorno e a sombra caberem
          // (`MARGEM_TILES`), e ela entra no tamanho de destino — senão o
          // desenho é espremido dentro do espaço do objeto e sai deformado.
          const folga = MARGEM_TILES * 2 * cam.escala * cheio;
          const l = REC_SPRITE[tipo * 2] * cam.escala * cheio;
          const a = REC_SPRITE[tipo * 2 + 1] * cam.escala * cheio;
          ctx.drawImage(
            img,
            cam.mundoParaTelaX(x + 0.5) - l / 2 - folga / 2,
            cam.mundoParaTelaY(y + 1) - a - folga / 2,
            l + folga,
            a + folga,
          );
          desenhados++;
        }

        const c = g.construcao[i];
        if (c !== 0 && c - 1 !== ED.fazenda) {
          const tipo = c - 1;
          const acabamento = g.acabamento[i];
          const banco = this.bancoDeEdificio(
            tipo,
            materialDoAcabamento(acabamento),
            especieDoAcabamento(acabamento),
          );
          const img = banco[g.matiz[i] % banco.length];
          const folga = MARGEM_TILES * 2 * cam.escala;
          const l = ED_SPRITE[tipo * 2] * cam.escala;
          const a = ED_SPRITE[tipo * 2 + 1] * cam.escala;
          const ocupaL = ED_OCUPA[tipo * 2];
          const ocupaP = ED_OCUPA[tipo * 2 + 1];
          ctx.drawImage(
            img,
            cam.mundoParaTelaX(x + ocupaL / 2) - l / 2 - folga / 2,
            cam.mundoParaTelaY(y + ocupaP) - a - folga / 2,
            l + folga,
            a + folga,
          );
          desenhados++;
        }
      }
    }
    this.objetosDesenhados = desenhados;
  }

  /**
   * Marca do conteúdo do pedaço. Só olha o que o **chão** desenha — árvore e
   * construção mudaram de camada e não entram mais aqui.
   */
  private versaoDoPedaco(px: number, py: number): number {
    const g = this.mundo.grid;
    // Uma fileira a mais de cada lado: a costura de borda lê o bioma dos
    // vizinhos, e vizinho de tile na beirada mora no pedaço ao lado. Sem a
    // moldura, o jogador pintava terreno na divisa e a costura do pedaço
    // vizinho ficava mostrando o bioma antigo até algo mais o invalidar.
    const x0 = Math.max(0, px * LADO_PEDACO - 1);
    const y0 = Math.max(0, py * LADO_PEDACO - 1);
    const x1 = Math.min(g.largura, px * LADO_PEDACO + LADO_PEDACO + 1);
    const y1 = Math.min(g.altura, py * LADO_PEDACO + LADO_PEDACO + 1);
    let h = 2166136261;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * g.largura + x;
        const fazenda = ehLavoura(g, i) ? 1 : 0;
        h ^= g.bioma[i] + (g.estrada[i] << 6) + (fazenda << 7) +
          ((g.fogo[i] > 0 ? 1 : 0) << 8) + ((g.vegetacao[i] >> 5) << 9) +
          ((g.territorio[i] + 1) << 12) + ((g.temp[i] < this.mundo.linhaNeve ? 1 : 0) << 24);
        h = Math.imul(h, 16777619);
      }
    }
    return h >>> 0;
  }

  private construir(px: number, py: number, versao: number, antigo?: Pedaco): Pedaco {
    const canvas = antigo?.canvas ?? document.createElement('canvas');
    canvas.width = LADO_PEDACO * PX_TILE;
    canvas.height = LADO_PEDACO * PX_TILE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const g = this.mundo.grid;
    const x0 = px * LADO_PEDACO;
    const y0 = py * LADO_PEDACO;

    for (let ty = 0; ty < LADO_PEDACO; ty++) {
      const my = y0 + ty;
      if (my >= g.altura) break;
      for (let tx = 0; tx < LADO_PEDACO; tx++) {
        const mx = x0 + tx;
        if (mx >= g.largura) break;
        this.pintarChao(ctx, g.idx(mx, my), tx * PX_TILE, ty * PX_TILE);
      }
    }

    return { canvas, versao, usadoEm: this.quadro };
  }

  private pintarChao(
    ctx: CanvasRenderingContext2D,
    i: number,
    dx: number,
    dy: number,
  ): void {
    const g = this.mundo.grid;
    const bioma = g.bioma[i];
    const matiz = g.matiz[i];
    const PX = PX_TILE;

    const naAgua = BIOMA_AGUA[bioma] === 1;
    const tons = this.paletas[bioma];

    // A água é de **uma cor só** por bioma; o chão é que varia tile a tile.
    //
    // Sortear o tom de cada tile do mar parece dar textura e faz o contrário:
    // vira um chuvisco de claro e escuro que se lê como profundidade irregular,
    // e o oceano fica com aspecto de ruído em vez de superfície. Lâmina lisa,
    // com onda desenhada por cima de vez em quando, é o que dá mar.
    ctx.fillStyle = hex(naAgua ? tons[1] : tons[matiz & 3]);
    ctx.fillRect(dx, dy, PX, PX);

    if (naAgua) {
      // Onda solta: um risco curto com a crista clara, num punhado de tiles
      // espalhados. A raridade é o ponto — onda em todo tile vira textura, e
      // textura foi justamente o que se tirou daqui.
      if ((matiz & 15) === 0) {
        const ox = matiz % (PX - 7);
        const oy = (matiz * 3) % (PX - 4);
        ctx.fillStyle = hex(tons[2]);
        ctx.fillRect(dx + ox, dy + oy + 1, 6, 1);
        ctx.fillRect(dx + ox + 2, dy + oy + 2, 4, 1);
        ctx.fillStyle = 'rgba(232,244,252,0.5)';
        ctx.fillRect(dx + ox + 1, dy + oy, 4, 1);
      } else if ((matiz & 31) === 7) {
        // e uma onda menor, sem crista, para o mar não ficar em compasso
        ctx.fillStyle = hex(tons[2]);
        ctx.fillRect(dx + ((matiz * 5) % (PX - 4)), dy + ((matiz * 7) % PX), 3, 1);
      }
    } else {
      // Trama de fundo: um xadrez de um tom, quase imperceptível de perto e
      // decisivo no conjunto. Sem ela, cada tile é um retângulo de cor sólida e
      // o campo aberto vira uma toalha verde lisa.
      ctx.fillStyle = hex(tons[(matiz + 1) & 3]);
      for (let ty = 0; ty < PX; ty += 4) {
        for (let tx = (ty / 4) % 2 === 0 ? 0 : 2; tx < PX; tx += 4) {
          ctx.fillRect(dx + tx, dy + ty, 2, 2);
        }
      }

      const veg = g.vegetacao[i];
      if (veg > 40) {
        // Tufos de mato em pé, e não pontinhos: dois pixels de altura com a
        // base mais escura já leem como capim.
        const tufos = veg > 170 ? 5 : veg > 100 ? 4 : 2;
        for (let k = 0; k < tufos; k++) {
          const rx = (matiz * (k + 3) * 7) % (PX - 2);
          const ry = (matiz * (k + 5) * 11) % (PX - 4);
          ctx.fillStyle = hex(tons[(matiz + 3) & 3]);
          ctx.fillRect(dx + rx, dy + ry, 1, 3);
          ctx.fillStyle = hex(tons[(matiz + 2) & 3]);
          ctx.fillRect(dx + rx + 1, dy + ry + 1, 1, 2);
        }
        // Uma florzinha de vez em quando, só onde o chão é fértil. É o detalhe
        // que mais aproxima o campo da referência — o mapa deixa de ser uma
        // mancha verde e passa a ter o que olhar.
        if (veg > 150 && (matiz & 15) === 3) {
          ctx.fillStyle = FLORES[(matiz >> 4) % FLORES.length];
          ctx.fillRect(dx + ((matiz * 11) % (PX - 2)), dy + ((matiz * 13) % (PX - 2)), 2, 2);
        }
      } else {
        // chão pelado: lascas e reentrâncias, para rocha e neve não ficarem lisas
        ctx.fillStyle = hex(tons[(matiz + 1) & 3]);
        ctx.fillRect(dx + (matiz % 7), dy + ((matiz * 3) % 9), 4, 3);
        ctx.fillStyle = hex(tons[(matiz + 2) & 3]);
        ctx.fillRect(dx + ((matiz * 5) % 10), dy + ((matiz * 7) % 11), 3, 2);
        // pedrinha solta na rocha e na terra rachada
        if ((matiz & 7) === 2) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(dx + ((matiz * 3) % (PX - 3)), dy + ((matiz * 5) % (PX - 3)), 3, 2);
        }
      }
      if (i + g.largura < g.total && g.alt[i] - g.alt[i + g.largura] > 6) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(dx, dy + PX - 3, PX, 3);
      }
    }

    // ------------------------------------------------- costura com o vizinho
    // O chão é um mosaico de cores sólidas, e sem isto a fronteira entre dois
    // biomas é uma linha reta perfeita — o campo encontra a areia num degrau de
    // régua. Aqui a borda de cada tile recebe alguns pixels da cor do vizinho,
    // num padrão irregular mas fixo por tile: de perto a divisa fica dentada e
    // parece transição, de longe some. Vai no cache junto com o resto, então
    // não custa nada por quadro.
    //
    // Só o lado de terra ganha costura, e só contra outro tipo de chão: água
    // com terra já tem a espuma da rebentação, e serrilhar a linha da praia
    // faria o mar parecer roído.
    if (BIOMA_AGUA[bioma] !== 1) {
      const vizinhos = [
        [i - g.largura, 0, -1],
        [i + g.largura, 0, 1],
        [i - 1, -1, 0],
        [i + 1, 1, 0],
      ] as const;
      for (let d = 0; d < 4; d++) {
        const [j, ox, oy] = vizinhos[d];
        if (j < 0 || j >= g.total) continue;
        // não costura de uma ponta do mapa para a outra
        if (ox !== 0 && ((i % g.largura) === 0 ? ox < 0 : (i % g.largura) === g.largura - 1 && ox > 0)) {
          continue;
        }
        const outro = g.bioma[j];
        if (outro === bioma || BIOMA_AGUA[outro] === 1) continue;
        ctx.fillStyle = hex(this.paletas[outro][(matiz + d) & 3]);
        // três dentes de tamanhos diferentes ao longo da aresta
        for (let k = 0; k < 3; k++) {
          const passo = (matiz * (k + 2) * (d + 3)) % (PX - 4);
          const tam = 2 + ((matiz + k) & 1) * 2;
          const fundura = 1 + ((matiz + k * 3) & 1);
          if (oy !== 0) {
            ctx.fillRect(dx + passo, oy < 0 ? dy : dy + PX - fundura, tam, fundura);
          } else {
            ctx.fillRect(ox < 0 ? dx : dx + PX - fundura, dy + passo, fundura, tam);
          }
        }
      }
    }

    // ------------------------------------------------------------- estrada
    if (g.estrada[i] === 1) {
      ctx.fillStyle = '#a8946e';
      ctx.fillRect(dx, dy, PX, PX);
      // terra batida: manchas de dois tons e um cascalho claro por cima
      ctx.fillStyle = '#93815f';
      ctx.fillRect(dx + (matiz % 6), dy + ((matiz * 3) % 7), 4, 3);
      ctx.fillRect(dx + ((matiz * 5) % 9), dy + ((matiz * 7) % 10), 3, 2);
      ctx.fillStyle = '#bcaa84';
      ctx.fillRect(dx + ((matiz * 11) % 12), dy + ((matiz * 13) % 12), 2, 1);
      // as bordas da rua ficam mais escuras, como o pé de um caminho gasto
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(dx, dy, PX, 1);
      ctx.fillRect(dx, dy + PX - 1, PX, 1);
    }

    // -------------------------------------------------------------- lavoura
    // Pelo âncora, não pelo tile: a fazenda reserva 2×2 e só o canto tinha a
    // plantação desenhada — o campo virava uma tirinha no meio do mato.
    if (ehLavoura(g, i)) {
      ctx.fillStyle = '#6b4e2c';
      ctx.fillRect(dx, dy, PX, PX);
      // Sulco arado: uma faixa de terra revirada, o pé plantado em cima e um
      // fio de sombra do lado direito. Com um retângulo só de cor, a roça era
      // uma grade amarela sem relevo nenhum.
      const claro = matiz % 2 === 0 ? '#c4b055' : '#b2a049';
      for (let k = 0; k < 4; k++) {
        const sx = dx + 1 + k * 4;
        ctx.fillStyle = '#8a6a3c';
        ctx.fillRect(sx, dy + 1, 3, PX - 2);
        ctx.fillStyle = claro;
        ctx.fillRect(sx, dy + 1, 2, PX - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(sx + 2, dy + 1, 1, PX - 2);
      }
    }

    // -------------------------------------------------------- neve do inverno
    // Por cima do chão e da roça, por baixo do fogo. A rua fica de fora: é o
    // caminho que o povo limpa, e é ele que mantém a vila legível no inverno.
    if (g.estrada[i] !== 1 && nevado(this.mundo, i)) {
      ctx.fillStyle = 'rgba(236,241,247,0.86)';
      ctx.fillRect(dx, dy, PX, PX);
      ctx.fillStyle = 'rgba(206,216,230,0.9)';
      ctx.fillRect(dx + (matiz % 9), dy + ((matiz * 3) % 11), 4, 2);
      ctx.fillRect(dx + ((matiz * 7) % 11), dy + ((matiz * 5) % 12), 3, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + ((matiz * 11) % 13), dy + ((matiz * 13) % 13), 2, 1);
    }

    // ----------------------------------------------------------------- fogo
    if (g.fogo[i] > 0) {
      const f = Math.min(1, g.fogo[i] / 60);
      ctx.fillStyle = `rgba(240,${90 + f * 110},40,0.72)`;
      ctx.fillRect(dx + 2, dy + 4, PX - 4, PX - 6);
      ctx.fillStyle = 'rgba(255,220,120,0.85)';
      ctx.fillRect(dx + 5, dy + 7, PX - 10, PX - 11);
    }
  }

  /** Descarta os pedaços que não aparecem há mais tempo. */
  private limparCache(): void {
    if (this.cache.size <= this.limite) return;
    const porIdade = [...this.cache.entries()].sort((a, b) => a[1].usadoEm - b[1].usadoEm);
    const sobrando = this.cache.size - this.limite;
    for (let k = 0; k < sobrando; k++) this.cache.delete(porIdade[k][0]);
  }
}

/** O tile faz parte de uma lavoura, seja o canto dela ou não. */
function ehLavoura(g: { construcao: Uint8Array; ocupacao: Int32Array }, i: number): boolean {
  if (g.construcao[i] === ED.fazenda + 1) return true;
  const dono = g.ocupacao[i];
  return dono >= 0 && g.construcao[dono] === ED.fazenda + 1;
}

function cor(r: number, g: number, b: number): number {
  return (limitar(r) << 16) | (limitar(g) << 8) | limitar(b);
}

function limitar(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}
