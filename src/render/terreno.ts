import type { Mundo } from '../core/mundo.js';
import { nevado } from '../sim/estacoes.js';
import { LADO_CHUNK, NIVEL_MAR } from '../core/grid.js';
import { BIOMA_AGUA, BIOMA_COR, BIOMA_VARIACAO, B } from '../dados/biomas.js';
import { REC_COR } from '../dados/recursos.js';
import { ED_COR } from '../dados/edificios.js';

/**
 * Desenha o terreno num canvas de 1 pixel por tile.
 *
 * O mapa inteiro cabe numa imagem pequena (384×216 = 83 mil pixels); ampliar
 * isso com suavização desligada custa uma única chamada de `drawImage` por
 * quadro, independente do zoom. Só os chunks marcados como sujos são
 * recalculados, então mexer num canto do mapa não redesenha o mundo.
 */
export class CamadaTerreno {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private pixels: Uint32Array;
  /** Quando ligado, pinta as cores dos reinos por cima do terreno. */
  mostrarTerritorio = true;

  constructor(private mundo: Mundo) {
    const g = mundo.grid;
    this.canvas = document.createElement('canvas');
    this.canvas.width = g.largura;
    this.canvas.height = g.altura;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.img = this.ctx.createImageData(g.largura, g.altura);
    this.pixels = new Uint32Array(this.img.data.buffer);
  }

  /** Força o redesenho completo (troca de modo de visualização, save carregado). */
  invalidar(): void {
    this.mundo.grid.marcarTudoSujo();
  }

  atualizar(): void {
    const g = this.mundo.grid;
    let algum = false;

    for (let cy = 0; cy < g.chunksA; cy++) {
      for (let cx = 0; cx < g.chunksL; cx++) {
        const c = cy * g.chunksL + cx;
        if (!g.chunksSujos[c]) continue;
        g.chunksSujos[c] = 0;
        algum = true;
        const x0 = cx * LADO_CHUNK;
        const y0 = cy * LADO_CHUNK;
        const x1 = Math.min(g.largura, x0 + LADO_CHUNK);
        const y1 = Math.min(g.altura, y0 + LADO_CHUNK);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            this.pixels[y * g.largura + x] = this.corDoTile(y * g.largura + x);
          }
        }
      }
    }

    if (algum) this.ctx.putImageData(this.img, 0, 0);
  }

  /** Cor final de um tile, em ABGR (a ordem do buffer de ImageData). */
  private corDoTile(i: number): number {
    const g = this.mundo.grid;
    const bioma = g.bioma[i];

    let r: number;
    let vd: number;
    let a: number;

    if (g.fogo[i] > 0) {
      // fogo pulsando entre laranja e amarelo
      const f = g.fogo[i] / 60;
      r = 250;
      vd = 120 + Math.round(f * 90);
      a = 40;
    } else {
      const base = bioma * 3;
      r = BIOMA_COR[base];
      vd = BIOMA_COR[base + 1];
      a = BIOMA_COR[base + 2];

      // Variação fixa por tile: dá textura sem imagem nenhuma. **Só em terra** —
      // no mar ela vira um chuvisco de claro e escuro que se lê como fundo
      // irregular, e de longe o oceano fica com aspecto de ruído em vez de
      // superfície de água.
      if (BIOMA_AGUA[bioma] !== 1) {
        const varia = BIOMA_VARIACAO[bioma];
        const desvio = ((g.matiz[i] / 255) * 2 - 1) * varia;
        r += desvio;
        vd += desvio;
        a += desvio;
      }

      if (BIOMA_AGUA[bioma] === 1) {
        // água mais funda, mais escura
        const prof = (NIVEL_MAR - g.alt[i]) / NIVEL_MAR;
        const k = 1 - prof * 0.55;
        r *= k;
        vd *= k;
        a *= k;
      } else {
        // vegetação escurece e esverdeia; altitude clareia
        const veg = g.vegetacao[i] / 255;
        r -= veg * 26;
        vd -= veg * 6;
        a -= veg * 22;
        const luz = (g.alt[i] - NIVEL_MAR) / (255 - NIVEL_MAR);
        r += luz * 18;
        vd += luz * 18;
        a += luz * 18;
      }

      // relevo: compara com o vizinho de cima para dar sombreamento
      if (i >= g.largura) {
        const d = g.alt[i] - g.alt[i - g.largura];
        if (d > 2) {
          r += 14;
          vd += 14;
          a += 14;
        } else if (d < -2) {
          r -= 14;
          vd -= 14;
          a -= 14;
        }
      }

      // recurso pinta por cima do chão, misturado com ele para a mancha de
      // floresta não virar um bloco chapado
      const recurso = g.recurso[i];
      if (recurso !== 0) {
        const base3 = (recurso - 1) * 3;
        const cheio = g.recursoQtd[i] / 255;
        const peso = 0.5 + cheio * 0.42;
        r = r * (1 - peso) + REC_COR[base3] * peso;
        vd = vd * (1 - peso) + REC_COR[base3 + 1] * peso;
        a = a * (1 - peso) + REC_COR[base3 + 2] * peso;
      }

      // neve do inverno: por cima do chão e da mata, por baixo de rua e prédio
      if (nevado(this.mundo, i)) {
        r = r * 0.22 + 234 * 0.78;
        vd = vd * 0.22 + 239 * 0.78;
        a = a * 0.22 + 245 * 0.78;
      }

      // a trama de ruas é o que dá a leitura de "aqui tem gente" no mapa
      // afastado; sem ela, uma vila some no meio do verde
      if (g.estrada[i] === 1) {
        r = r * 0.35 + 156 * 0.65;
        vd = vd * 0.35 + 138 * 0.65;
        a = a * 0.35 + 104 * 0.65;
      }

      const construcao = g.construcao[i];
      if (construcao !== 0) {
        const base2 = (construcao - 1) * 3;
        r = ED_COR[base2];
        vd = ED_COR[base2 + 1];
        a = ED_COR[base2 + 2];
      } else if (this.mostrarTerritorio && g.territorio[i] >= 0) {
        const reino = this.mundo.reinos[g.territorio[i]];
        if (reino?.ativo) {
          const cr = (reino.cor >> 16) & 255;
          const cg = (reino.cor >> 8) & 255;
          const cb = reino.cor & 255;
          r = r * 0.72 + cr * 0.28;
          vd = vd * 0.72 + cg * 0.28;
          a = a * 0.72 + cb * 0.28;
        }
      }

      if (bioma === B.lava) {
        const pulso = (g.matiz[i] / 255) * 40;
        r = 220 + pulso * 0.4;
        vd = 70 + pulso;
        a = 30;
      }
    }

    return (
      (255 << 24) |
      (limitar(a) << 16) |
      (limitar(vd) << 8) |
      limitar(r)
    );
  }
}

function limitar(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
