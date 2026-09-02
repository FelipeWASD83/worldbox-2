import { Mundo, TAMANHOS, type TamanhoMapa } from './mundo.js';
import { montarPipeline } from '../sim/index.js';
import { gerarTerreno, povoar, type OpcoesGeracao } from '../sim/geracao.js';
import { empacotar, desempacotar } from './save.js';
import { Renderizador } from '../render/renderizador.js';
import { poderes } from '../sim/poderes.js';

export const VELOCIDADES = [0, 1, 2, 4, 8] as const;

export interface OpcoesNovoMundo extends OpcoesGeracao {
  tamanho?: string;
  semente?: string;
}

/**
 * Junta simulação e desenho num loop só.
 *
 * A simulação anda em passo fixo (20 ticks por segundo em velocidade 1×) e o
 * desenho acontece uma vez por quadro. Separar os dois é o que faz o jogo rodar
 * igual em qualquer taxa de atualização de tela e permite acelerar o tempo sem
 * acelerar a animação.
 */
export class Jogo {
  mundo: Mundo;
  renderizador: Renderizador;
  velocidade = 1;

  private acumulador = 0;
  private ultimoQuadro = 0;
  private rodando = false;

  /** Medidas mostradas no painel de desempenho. */
  fps = 0;
  tps = 0;
  private contaQuadros = 0;
  private contaTicks = 0;
  private ultimaMedida = 0;

  /** Chamado depois de cada quadro, para a interface se atualizar. */
  aoQuadro: (() => void) | null = null;
  /** Chamado quando o mundo é trocado (novo ou carregado). */
  aoTrocarMundo: ((mundo: Mundo) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    opcoes: OpcoesNovoMundo = {},
  ) {
    this.mundo = this.construirMundo(opcoes);
    this.renderizador = new Renderizador(this.mundo, canvas, ctx);
    this.renderizador.camera.redimensionar(canvas.width, canvas.height);
    this.renderizador.camera.enquadrarMundo();
  }

  private construirMundo(opcoes: OpcoesNovoMundo): Mundo {
    const tamanho: TamanhoMapa =
      TAMANHOS.find((t) => t.id === opcoes.tamanho) ?? TAMANHOS[1];
    const semente = opcoes.semente?.trim() || sementeAleatoria();
    const mundo = new Mundo(tamanho, semente);
    mundo.migracao = opcoes.migracao ?? true;
    montarPipeline(mundo);
    gerarTerreno(mundo, opcoes);
    povoar(mundo, opcoes);
    mundo.recalcularEstatisticas();
    return mundo;
  }

  /** Gera um mundo novo, mantendo a mesma tela e o mesmo loop. */
  novoMundo(opcoes: OpcoesNovoMundo = {}): void {
    this.mundo = this.construirMundo(opcoes);
    this.renderizador.trocarMundo(this.mundo);
    this.renderizador.camera.enquadrarMundo();
    this.aoTrocarMundo?.(this.mundo);
    this.anunciar();
  }

  /**
   * Anuncia o mundo atual no barramento.
   *
   * Fica separado da criação de propósito: o evento precisa sair depois que a
   * interface se religou ao mundo novo, senão a primeira linha da crônica é
   * emitida para uma plateia que ainda não existe.
   */
  anunciar(): void {
    this.mundo.eventos.emitir('mundo:gerado', { semente: this.mundo.semente });
  }

  salvar(): string {
    return empacotar(this.mundo);
  }

  carregar(texto: string): void {
    const mundo = desempacotar(texto);
    montarPipeline(mundo);
    this.mundo = mundo;
    this.renderizador.trocarMundo(mundo);
    this.aoTrocarMundo?.(mundo);
    mundo.eventos.emitir('mundo:carregado', { semente: mundo.semente, tick: mundo.tick });
  }

  /** Aplica um poder num ponto do mundo. */
  usarPoder(idPoder: string, x: number, y: number, raio: number, parametro?: number): void {
    const poder = poderes.talvez(idPoder);
    if (!poder) return;
    poder.aplicar(this.mundo, x, y, raio, parametro);
    this.mundo.eventos.emitir('poder:usado', { poder: idPoder, x, y });
  }

  redimensionar(largura: number, altura: number): void {
    this.canvas.width = largura;
    this.canvas.height = altura;
    this.renderizador.camera.redimensionar(largura, altura);
    this.renderizador.camera.prender();
  }

  iniciar(): void {
    if (this.rodando) return;
    this.rodando = true;
    this.ultimoQuadro = performance.now();
    this.ultimaMedida = this.ultimoQuadro;
    requestAnimationFrame(this.quadro);
  }

  parar(): void {
    this.rodando = false;
  }

  private quadro = (agora: number): void => {
    if (!this.rodando) return;

    const dt = Math.min(250, agora - this.ultimoQuadro);
    this.ultimoQuadro = agora;

    if (this.velocidade > 0) {
      const intervalo = 1000 / (this.mundo.ticksPorSegundo * this.velocidade);
      this.acumulador += dt;
      // teto de ticks por quadro: se a máquina não acompanha, o jogo fica
      // lento em vez de travar numa espiral de recuperação
      const maximo = 4 + this.velocidade * 2;
      let n = 0;
      while (this.acumulador >= intervalo && n < maximo) {
        this.mundo.avancar();
        this.acumulador -= intervalo;
        n++;
        this.contaTicks++;
      }
      if (n >= maximo) this.acumulador = 0;
    }

    this.renderizador.desenhar();
    this.contaQuadros++;

    if (agora - this.ultimaMedida >= 500) {
      const s = (agora - this.ultimaMedida) / 1000;
      this.fps = this.contaQuadros / s;
      this.tps = this.contaTicks / s;
      this.contaQuadros = 0;
      this.contaTicks = 0;
      this.ultimaMedida = agora;
    }

    this.aoQuadro?.();
    requestAnimationFrame(this.quadro);
  };

  /** Ano do mundo, derivado do tick. */
  get ano(): number {
    return Math.floor(this.mundo.tick / 400);
  }
}

export function sementeAleatoria(): string {
  const silabas = ['ka', 'mor', 'ith', 'la', 'ven', 'dro', 'sun', 'gar', 'nel', 'tor', 'ys', 'bra'];
  let s = '';
  const n = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) s += silabas[Math.floor(Math.random() * silabas.length)];
  return s;
}
