import type { Mundo } from '../core/mundo.js';
import { Estado, MARCA_DOENTE, MARCA_SOLDADO } from '../core/criaturas.js';
import { Camera } from './camera.js';
import { CamadaTerreno } from './terreno.js';
import {
  coresDePixel, gerarEquipamento, gerarSprites,
  type BancoDeEquipamento, type BancoDeSprites,
} from './sprites.js';
import { CamadaTiles, ZOOM_DETALHE } from './tiles.js';
import { ESP_PORTE } from '../dados/especies.js';
import { EQ_COR } from '../dados/equipamentos.js';

/**
 * Desenha o mundo.
 *
 * A decisão importante está em `desenharCriaturas`: com o mapa afastado, cada
 * criatura é um pixel escrito num buffer (dezenas de milhares custam quase
 * nada); só quando o zoom aproxima é que viram sprites desenhados um a um — e
 * aí são poucas na tela, porque a área visível é pequena.
 */
export class Renderizador {
  readonly camera: Camera;
  private terreno: CamadaTerreno;
  private tiles: CamadaTiles;
  private sprites: BancoDeSprites;
  private equipamentoSprites: BancoDeEquipamento;
  private coresPixel: Uint32Array;

  private canvasCriaturas: HTMLCanvasElement;
  private ctxCriaturas: CanvasRenderingContext2D;
  private imgCriaturas: ImageData;
  private pixelsCriaturas: Uint32Array;

  /**
   * Acima deste zoom as criaturas viram sprites desenhados.
   *
   * É o mesmo limiar do chão detalhado de propósito: com valores diferentes, os
   * bichos apareciam desenhados sobre um chão ainda esticado e borrado, e a
   * cena ficava com duas resoluções ao mesmo tempo.
   */
  readonly zoomSprite = ZOOM_DETALHE;

  /** Criatura destacada pelo inspetor, ou -1. */
  selecionada = -1;
  /** Aldeia destacada, ou -1. */
  aldeiaSelecionada = -1;
  /** Círculo do pincel: posição em tiles e raio, ou null. */
  pincel: { x: number; y: number; raio: number } | null = null;
  mostrarNomes = true;

  /** Milissegundos gastos no último quadro. */
  custoMs = 0;
  /**
   * Relógio do desenho, em segundos.
   *
   * Anda com o tempo real e não com o tick do mundo: a rebentação continua indo
   * e voltando mesmo com o jogo pausado, que é o que se espera do mar.
   */
  private tempo = 0;
  /** Quantas criaturas foram efetivamente desenhadas. */
  desenhadas = 0;
  /** Pedaços de chão detalhado que ainda não ficaram prontos neste quadro. */
  pedacosFaltando = 0;
  /** Lista reaproveitada de criaturas visíveis, para ordenar sem alocar. */
  private visiveis = new Int32Array(4096);
  /** A fatia de `visiveis` deste quadro, já ordenada pela profundidade. */
  private naFila: Int32Array = this.visiveis.subarray(0, 0);
  /** Até onde `desenharCriaturasAte` já chegou dentro de `naFila`. */
  private cursor = 0;

  constructor(
    private mundo: Mundo,
    private canvas: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
  ) {
    this.camera = new Camera(mundo.grid.largura, mundo.grid.altura);
    this.terreno = new CamadaTerreno(mundo);
    this.tiles = new CamadaTiles(mundo);
    this.sprites = gerarSprites();
    this.equipamentoSprites = gerarEquipamento();
    this.coresPixel = coresDePixel();

    this.canvasCriaturas = document.createElement('canvas');
    this.canvasCriaturas.width = mundo.grid.largura;
    this.canvasCriaturas.height = mundo.grid.altura;
    this.ctxCriaturas = this.canvasCriaturas.getContext('2d')!;
    this.imgCriaturas = this.ctxCriaturas.createImageData(mundo.grid.largura, mundo.grid.altura);
    this.pixelsCriaturas = new Uint32Array(this.imgCriaturas.data.buffer);
  }

  /** Troca o mundo desenhado (mundo novo ou save carregado). */
  trocarMundo(mundo: Mundo): void {
    this.mundo = mundo;
    const escalaAntiga = this.camera.escala;
    this.camera.larguraMundo = mundo.grid.largura;
    this.camera.alturaMundo = mundo.grid.altura;
    this.terreno = new CamadaTerreno(mundo);
    this.tiles.trocarMundo(mundo);
    this.canvasCriaturas.width = mundo.grid.largura;
    this.canvasCriaturas.height = mundo.grid.altura;
    this.imgCriaturas = this.ctxCriaturas.createImageData(mundo.grid.largura, mundo.grid.altura);
    this.pixelsCriaturas = new Uint32Array(this.imgCriaturas.data.buffer);
    this.camera.x = mundo.grid.largura / 2;
    this.camera.y = mundo.grid.altura / 2;
    this.camera.escala = escalaAntiga;
    this.selecionada = -1;
    this.aldeiaSelecionada = -1;
  }

  get mostrarTerritorio(): boolean {
    return this.terreno.mostrarTerritorio;
  }

  set mostrarTerritorio(v: boolean) {
    this.terreno.mostrarTerritorio = v;
    this.terreno.invalidar();
    this.tiles.mostrarTerritorio = v;
    this.tiles.limparTudo();
  }

  desenhar(): void {
    const t0 = performance.now();
    this.tempo = t0 / 1000;
    const ctx = this.ctx;
    const cam = this.camera;

    this.terreno.atualizar();

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const destX = cam.mundoParaTelaX(0);
    const destY = cam.mundoParaTelaY(0);
    const destL = this.mundo.grid.largura * cam.escala;
    const destA = this.mundo.grid.altura * cam.escala;

    // O mapa esticado vai sempre por baixo: serve de chão pronto enquanto os
    // pedaços detalhados são desenhados, e evita buraco na tela quando a
    // câmera corre mais rápido do que o cache consegue acompanhar.
    ctx.drawImage(this.terreno.canvas, destX, destY, destL, destA);

    const detalhado = cam.escala >= ZOOM_DETALHE;
    this.pedacosFaltando = detalhado ? this.tiles.desenharChao(ctx, cam) : 0;

    if (detalhado) {
      // A espuma vai entre o chão e os objetos: por cima da água, por baixo de
      // qualquer coisa que esteja de pé na praia.
      this.tiles.desenharOndas(ctx, cam, this.tempo);

      // Uma varredura só, de cima para baixo, com bicho e objeto disputando a
      // mesma ordem de profundidade: quem tem o pé mais ao sul cobre quem está
      // atrás. Antes eram duas passadas — todos os objetos, depois todas as
      // criaturas — e o bicho aparecia por cima da copa mesmo estando atrás da
      // árvore, o que é o tipo de coisa que faz o mapa parecer papel recortado.
      this.prepararCriaturas();
      this.tiles.desenharObjetos(ctx, cam, this.desenharCriaturasAte);
      // e quem ficou ao sul da última linha varrida
      this.desenharCriaturasAte(Infinity);
    } else {
      this.desenharCriaturasEmPixel(destX, destY, destL, destA);
    }

    this.desenharBarcos();
    this.desenharBombas();
    // O céu vai por cima de tudo o que está no chão, e por baixo dos rótulos e
    // da interface: nuvem que esconde o nome da aldeia atrapalha em vez de
    // ambientar.
    this.desenharNuvens();
    if (this.mostrarNomes && cam.escala >= 2.2) this.desenharRotulos();
    this.desenharSelecao();
    this.desenharPincel();

    this.custoMs = performance.now() - t0;
  }

  /**
   * Mapa afastado: cada criatura é um pixel escrito num buffer.
   *
   * É uma cópia de imagem por quadro em vez de milhares de desenhos, e é o que
   * permite acompanhar de longe um mundo de dezenas de milhares de bichos.
   */
  private desenharCriaturasEmPixel(
    destX: number,
    destY: number,
    destL: number,
    destA: number,
  ): void {
    const c = this.mundo.criaturas;
    this.desenhadas = 0;
    this.pixelsCriaturas.fill(0);
    const L = this.mundo.grid.largura;
    const A = this.mundo.grid.altura;
    const limite = c.limite;
    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i] || c.abrigo[i] >= 0) continue;
      const x = c.x[i] | 0;
      const y = c.y[i] | 0;
      if (x < 0 || y < 0 || x >= L || y >= A) continue;
      this.pixelsCriaturas[y * L + x] = this.coresPixel[c.especie[i]];
      this.desenhadas++;
    }
    this.ctxCriaturas.putImageData(this.imgCriaturas, 0, 0);
    this.ctx.drawImage(this.canvasCriaturas, destX, destY, destL, destA);
  }

  /**
   * Junta quem aparece na tela e ordena pela profundidade.
   *
   * A lista é reaproveitada entre quadros para não gerar lixo a 60 vezes por
   * segundo, e o cursor é o que deixa `desenharCriaturasAte` avançar aos
   * poucos, entrelaçada com a varredura dos objetos do mapa.
   */
  private prepararCriaturas(): void {
    const c = this.mundo.criaturas;
    const area = this.camera.area();
    const limite = c.limite;
    const margem = 3;
    this.desenhadas = 0;

    const visiveis = this.visiveis;
    let n = 0;
    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i] || c.abrigo[i] >= 0) continue;
      const mx = c.x[i];
      const my = c.y[i];
      if (mx < area.x0 - margem || mx > area.x1 + margem) continue;
      if (my < area.y0 - margem || my > area.y1 + margem) continue;
      if (n >= visiveis.length) break;
      visiveis[n++] = i;
    }
    this.naFila = visiveis.subarray(0, n);
    this.naFila.sort((a, b) => c.y[a] - c.y[b]);
    this.cursor = 0;
  }

  /**
   * Desenha as criaturas cujo pé a varredura já passou.
   *
   * Vai como retorno de chamada para a varredura dos objetos do mapa, e por
   * isso é um campo com função de seta: guardar o `this` aqui sai mais barato
   * do que amarrar o método a cada quadro.
   */
  private desenharCriaturasAte = (y: number): void => {
    const c = this.mundo.criaturas;
    const cam = this.camera;
    const ctx = this.ctx;
    const fila = this.naFila;

    while (this.cursor < fila.length) {
      const i = fila[this.cursor];
      const my = c.y[i];
      // o objeto da linha `y` tem o pé em `y + 1`: quem está além disso vem
      // depois dele, e é isso que põe o bicho na frente ou atrás da copa
      if (my > y + 1) return;
      this.cursor++;
      const mx = c.x[i];

      const esp = c.especie[i];
      const dir = c.dir[i];
      // Cada espécie tem porte próprio, em tiles: um coelho cabe num tile, um
      // urso ocupa dois por dois, um humano é estreito e alto. O desenho é
      // ancorado pelos pés, como o das árvores e das casas — do contrário o
      // bicho flutua sobre o próprio tile.
      const larg = ESP_PORTE[esp * 2] * cam.escala;
      const alt = ESP_PORTE[esp * 2 + 1] * cam.escala;
      const sx = cam.mundoParaTelaX(mx) - larg / 2;
      const sy = cam.mundoParaTelaY(my + 0.5) - alt;
      ctx.drawImage(this.sprites[esp][dir], sx, sy, larg, alt);
      this.desenhadas++;
      const lado = Math.max(larg, alt);

      // A armadura, que por muito tempo não aparecia de jeito nenhum.
      //
      // Ela não cabe como sprite: num boneco de um tile de altura não há onde
      // desenhar uma cota de malha que se distinga de uma túnica. O que se lê
      // nesse tamanho é a **cor** — uma faixa no tronco e um ombro na cor do
      // metal. Medido antes disto: um quarto dos civilizados usava armadura e
      // nada disso chegava à tela.
      const armadura = c.armadura[i];
      if (armadura !== 0 && cam.escala >= 5) {
        const cor = EQ_COR[armadura - 1];
        ctx.fillStyle = `rgba(${(cor >> 16) & 255},${(cor >> 8) & 255},${cor & 255},0.8)`;
        ctx.fillRect(sx + larg * 0.2, sy + alt * 0.4, larg * 0.6, alt * 0.3);
        // ombreira do lado de onde vem a luz
        ctx.fillRect(sx + larg * 0.08, sy + alt * 0.34, larg * 0.28, alt * 0.16);
      }

      // arma e escudo por cima do corpo, no mesmo quadro de 16 pixels
      if (cam.escala >= 5) {
        const arma = c.arma[i];
        if (arma !== 0) {
          const s = this.equipamentoSprites[arma - 1];
          if (s) ctx.drawImage(s[dir], sx, sy, lado, lado);
        }
        const escudo = c.escudo[i];
        if (escudo !== 0) {
          const s = this.equipamentoSprites[escudo - 1];
          if (s) ctx.drawImage(s[dir], sx, sy, lado, lado);
        }
      }

      if (cam.escala >= 7) {
        // sinais de estado só aparecem quando há espaço para eles
        if ((c.marcas[i] & MARCA_DOENTE) !== 0) {
          ctx.fillStyle = '#9ae66e';
          ctx.fillRect(sx + lado * 0.35, sy - lado * 0.28, lado * 0.3, lado * 0.22);
        } else if ((c.marcas[i] & MARCA_SOLDADO) !== 0) {
          ctx.fillStyle = '#e8d26a';
          ctx.fillRect(sx + lado * 0.35, sy - lado * 0.28, lado * 0.3, lado * 0.22);
        }
        const estado = c.estado[i];
        if (estado === Estado.Fugindo) {
          ctx.fillStyle = '#e07a5f';
          ctx.fillRect(sx - lado * 0.15, sy - lado * 0.28, lado * 0.2, lado * 0.22);
        } else if (estado === Estado.Atacando || estado === Estado.Cacando) {
          ctx.fillStyle = '#d64545';
          ctx.fillRect(sx - lado * 0.15, sy - lado * 0.28, lado * 0.2, lado * 0.22);
        }
      }
    }
  };

  /**
   * Os barcos no mar.
   *
   * Desenhados aqui e não junto dos objetos do mapa porque não têm tile: andam
   * em coordenada contínua sobre a água, como as criaturas, e a água não tem
   * nada em cima para disputar profundidade com eles.
   *
   * O casco é um trapézio com a proa apontando para onde vai. O pesqueiro tem
   * vela pequena e cor de madeira; o de combate é escuro, tem vela alta e um
   * escudo pendurado no bordo — de longe, a diferença tem de ser a silhueta,
   * não o detalhe.
   */
  private desenharBarcos(): void {
    const barcos = this.mundo.barcos;
    if (barcos.length === 0) return;
    const ctx = this.ctx;
    const cam = this.camera;
    const area = cam.area();
    const e = cam.escala;

    for (const b of barcos) {
      if (b.x < area.x0 - 3 || b.x > area.x1 + 3) continue;
      if (b.y < area.y0 - 3 || b.y > area.y1 + 3) continue;

      const sx = cam.mundoParaTelaX(b.x);
      const sy = cam.mundoParaTelaY(b.y);
      const comprido = e * (b.tipo === 0 ? 1.5 : 2.2);
      const alto = e * (b.tipo === 0 ? 0.55 : 0.7);
      const frente = b.dir === 1 ? 1 : -1;

      if (e < 3) {
        // de longe, um ponto já basta
        ctx.fillStyle = b.tipo === 0 ? '#c9a877' : '#8a8f9e';
        ctx.fillRect(sx - 1, sy - 1, 3, 2);
        continue;
      }

      // esteira
      ctx.fillStyle = 'rgba(226,240,248,0.3)';
      ctx.fillRect(sx - frente * comprido * 0.9, sy - 1, comprido * 0.5, 2);

      // casco: mais estreito na proa
      ctx.fillStyle = b.tipo === 0 ? '#8a6134' : '#4a4e5a';
      ctx.beginPath();
      ctx.moveTo(sx + frente * comprido * 0.55, sy);
      ctx.lineTo(sx - frente * comprido * 0.45, sy - alto * 0.5);
      ctx.lineTo(sx - frente * comprido * 0.45, sy + alto * 0.5);
      ctx.closePath();
      ctx.fill();
      // linha d'água clara
      ctx.fillStyle = b.tipo === 0 ? '#b08650' : '#6b7180';
      ctx.fillRect(sx - frente * comprido * 0.45, sy - alto * 0.5, comprido * 0.9, Math.max(1, alto * 0.22));

      // mastro e vela
      const mastro = e * (b.tipo === 0 ? 0.9 : 1.5);
      ctx.fillStyle = '#4a3524';
      ctx.fillRect(sx - 1, sy - mastro, Math.max(1, e * 0.1), mastro);
      ctx.fillStyle = b.tipo === 0 ? '#e0d8c4' : '#c4ccd8';
      ctx.fillRect(sx - frente * e * 0.5, sy - mastro, e * 0.55, mastro * 0.72);

      if (b.tipo === 1 && e >= 6) {
        // escudo no bordo, e a bandeira do reino no topo
        const reino = this.mundo.reinos[this.mundo.aldeias[b.aldeia]?.reino ?? -1];
        ctx.fillStyle = '#9a3f34';
        ctx.fillRect(sx - frente * comprido * 0.2, sy - alto * 0.2, e * 0.25, e * 0.25);
        if (reino?.ativo) {
          ctx.fillStyle = `#${reino.cor.toString(16).padStart(6, '0')}`;
          ctx.fillRect(sx, sy - mastro - e * 0.3, e * 0.4, e * 0.25);
        }
      }
    }
  }

  /**
   * As nuvens, a sombra que jogam no chão e o que cai delas.
   *
   * Cada nuvem é desenhada como um punhado de bolhas em volta do centro, e não
   * como um círculo só: um disco de opacidade uniforme se lê como um borrão
   * cinza, enquanto bolhas sobrepostas dão a silhueta irregular que se
   * reconhece como nuvem. O contorno delas nasce da soma das bolhas.
   *
   * A sombra vai deslocada para baixo e para a direita, na mesma direção de luz
   * dos sprites do mapa — sem isso a nuvem parece grudada no chão em vez de
   * pairar sobre ele.
   */
  private desenharNuvens(): void {
    const nuvens = this.mundo.nuvens;
    if (nuvens.length === 0) return;
    const ctx = this.ctx;
    const cam = this.camera;
    const area = cam.area();
    const e = cam.escala;

    for (const n of nuvens) {
      if (n.forca <= 0.01) continue;
      if (n.x + n.raio < area.x0 - 4 || n.x - n.raio > area.x1 + 4) continue;
      if (n.y + n.raio < area.y0 - 4 || n.y - n.raio > area.y1 + 4) continue;

      const cx = cam.mundoParaTelaX(n.x);
      const cy = cam.mundoParaTelaY(n.y);
      const r = n.raio * e;
      // as bolhas são fixas por nuvem: sorteadas do próprio tamanho dela, para
      // não tremerem de um quadro para o outro
      const semente = Math.abs(Math.round(n.vida * 7 + n.raio * 31));
      // Muitas bolhas pequenas e espalhadas, e não poucas grandes: com bolhas
      // largas a nuvem vira três bolas de algodão sólidas por cima do mapa, e o
      // que se quer é uma mancha irregular que deixa o mundo aparecer por baixo.
      const bolhas = 10;
      const posBolha = (k: number): [number, number] => {
        const ang = ((semente * (k + 3) * 47) % 360) * (Math.PI / 180);
        const dist = r * 0.78 * (((semente * (k + 7) * 13) % 100) / 100);
        return [Math.cos(ang) * dist, Math.sin(ang) * dist];
      };

      // 1. a sombra no chão
      ctx.fillStyle = `rgba(18,22,32,${(0.085 * n.forca).toFixed(3)})`;
      for (let k = 0; k < bolhas; k++) {
        const [bx, by] = posBolha(k);
        ctx.beginPath();
        ctx.arc(cx + bx + r * 0.22, cy + by + r * 0.3, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. o corpo. Bem translúcido: nuvem é véu, não tampa — o jogo acontece
      // embaixo dela e tem de continuar visível.
      const branco = n.tipo === 0 ? 250 : n.tipo === 1 ? 206 : 240;
      const opacidade = n.tipo === 1 ? 0.2 : 0.15;
      ctx.fillStyle =
        `rgba(${branco},${branco + 3},${branco + 10},${(opacidade * n.forca).toFixed(3)})`;
      for (let k = 0; k < bolhas; k++) {
        const [bx, by] = posBolha(k);
        ctx.beginPath();
        ctx.arc(cx + bx, cy + by, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. o que cai — riscos de chuva ou flocos de neve, só de perto
      if (n.tipo === 0 || e < 4) continue;
      const gotas = Math.round(n.raio * 2.2);
      const queda = (this.tempo * (n.tipo === 1 ? 46 : 9)) % 40;
      ctx.fillStyle = n.tipo === 1
        ? `rgba(170,205,235,${(0.5 * n.forca).toFixed(3)})`
        : `rgba(248,252,255,${(0.7 * n.forca).toFixed(3)})`;
      for (let k = 0; k < gotas; k++) {
        const px = cx + (((semente * (k + 11)) % 200) / 100 - 1) * r * 0.9;
        const base = (((semente * (k + 5)) % 100) / 100) * r * 1.6;
        const py = cy - r * 0.5 + ((base + queda + k * 3) % (r * 2.2));
        if (n.tipo === 1) ctx.fillRect(px, py, 1, Math.max(2, e * 0.22));
        else ctx.fillRect(px, py, Math.max(1, e * 0.1), Math.max(1, e * 0.1));
      }
    }
  }

  /**
   * As bombas de lava dos vulcões.
   *
   * A altura é desenhada como deslocamento para cima somado a uma sombra no
   * chão: é o que faz a pedra parecer que está no ar e não deslizando pelo mapa.
   */
  private desenharBombas(): void {
    const bombas = this.mundo.bombas;
    if (bombas.length === 0) return;
    const ctx = this.ctx;
    const cam = this.camera;
    const area = cam.area();

    for (const b of bombas) {
      if (b.x < area.x0 - 2 || b.x > area.x1 + 2) continue;
      if (b.y < area.y0 - 6 || b.y > area.y1 + 2) continue;
      const sx = cam.mundoParaTelaX(b.x);
      const chao = cam.mundoParaTelaY(b.y);
      const alto = chao - b.z * cam.escala;
      const r = Math.max(1.5, cam.escala * 0.22);

      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(sx, chao, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f0a52e';
      ctx.beginPath();
      ctx.arc(sx, alto, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(sx - r * 0.3, alto - r * 0.3, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Nomes das aldeias e dos reinos por cima do mapa. */
  private desenharRotulos(): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const area = cam.area();
    ctx.font = '11px ui-monospace, "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const a of this.mundo.aldeias) {
      if (!a.ativa) continue;
      if (a.x < area.x0 || a.x > area.x1 || a.y < area.y0 || a.y > area.y1) continue;
      const sx = cam.mundoParaTelaX(a.x + 0.5);
      const sy = cam.mundoParaTelaY(a.y) - a.raio * cam.escala * 0.25 - 4;
      const reino = this.mundo.reinos[a.reino];
      const rotulo = `${a.nome} · ${a.populacao}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,7,12,0.85)';
      ctx.strokeText(rotulo, sx, sy);
      ctx.fillStyle = reino?.ativo ? `#${reino.cor.toString(16).padStart(6, '0')}` : '#cfd6e0';
      ctx.fillText(rotulo, sx, sy);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private desenharSelecao(): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const c = this.mundo.criaturas;

    if (this.selecionada >= 0 && c.vivo[this.selecionada]) {
      const esp = c.especie[this.selecionada];
      const alt = ESP_PORTE[esp * 2 + 1];
      const porte = Math.max(ESP_PORTE[esp * 2], alt);
      const sx = cam.mundoParaTelaX(c.x[this.selecionada]);
      // o corpo é desenhado subindo a partir dos pés: o círculo tem de subir
      // junto, senão fica marcando o chão embaixo de um veado ou de um dragão
      const sy = cam.mundoParaTelaY(c.y[this.selecionada] + 0.5) - (alt * cam.escala) / 2;
      const r = Math.max(6, porte * cam.escala * 0.6);
      ctx.strokeStyle = '#f2f4f8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.aldeiaSelecionada >= 0) {
      const a = this.mundo.aldeias[this.aldeiaSelecionada];
      if (a?.ativa) {
        ctx.strokeStyle = 'rgba(242,244,248,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(
          cam.mundoParaTelaX(a.x + 0.5),
          cam.mundoParaTelaY(a.y + 0.5),
          a.raio * cam.escala,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private desenharPincel(): void {
    if (!this.pincel) return;
    const ctx = this.ctx;
    const cam = this.camera;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      cam.mundoParaTelaX(this.pincel.x),
      cam.mundoParaTelaY(this.pincel.y),
      Math.max(3, this.pincel.raio * cam.escala),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  /** Criatura mais próxima do ponto do mundo, dentro de um raio de clique. */
  acharCriatura(mx: number, my: number): number {
    const raio = Math.max(1.5, 12 / this.camera.escala);
    const c = this.mundo.criaturas;
    let melhor = -1;
    let melhorD = raio * raio;
    this.mundo.espacial.aoRedor(mx, my, raio, (id) => {
      if (!c.vivo[id]) return;
      const dx = c.x[id] - mx;
      const dy = c.y[id] - my;
      const d = dx * dx + dy * dy;
      if (d < melhorD) {
        melhorD = d;
        melhor = id;
      }
    });
    return melhor;
  }

  /** Desenha o mundo inteiro reduzido, para o minimapa. */
  desenharMinimapa(ctxMini: CanvasRenderingContext2D, largura: number, altura: number): void {
    ctxMini.imageSmoothingEnabled = false;
    ctxMini.clearRect(0, 0, largura, altura);
    ctxMini.drawImage(this.terreno.canvas, 0, 0, largura, altura);

    // retângulo do que está visível
    const area = this.camera.area();
    const ex = largura / this.mundo.grid.largura;
    const ey = altura / this.mundo.grid.altura;
    ctxMini.strokeStyle = 'rgba(255,255,255,0.8)';
    ctxMini.lineWidth = 1;
    ctxMini.strokeRect(
      area.x0 * ex,
      area.y0 * ey,
      (area.x1 - area.x0) * ex,
      (area.y1 - area.y0) * ey,
    );
  }
}
