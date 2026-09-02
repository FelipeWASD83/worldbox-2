import { especies, type Especie } from '../dados/especies.js';
import { equipamentos, EQ_COR } from '../dados/equipamentos.js';
import { LADO_SPRITE, MOLDES, MOLDES_EQUIPAMENTO, type Molde } from './moldes.js';

/**
 * Sprites desenhados por código, sem nenhum arquivo de imagem.
 *
 * As cores saem da espécie e os tons claro e escuro são calculados a partir
 * delas, então bicho novo já nasce desenhado e mudar a paleta de uma espécie é
 * mudar três números no arquivo de dados.
 *
 * Equipamento é desenhado por cima do corpo, num passe separado, para não
 * multiplicar moldes: um bípede com espada e escudo é o mesmo bípede com dois
 * carimbos em cima.
 */

/** Deduz a forma quando a espécie não declara uma. */
export function formaDe(e: Especie): string {
  if (e.forma) return e.forma;
  if (e.id === 'dragao') return 'dragao';
  if (e.id === 'aranha_gigante') return 'aranha';
  if (e.id === 'cobra') return 'serpente';
  if (e.id === 'pinguim') return 'pinguim';
  if (e.categoria === 'civilizado' || e.id === 'zumbi') return 'bipede';
  if (e.dominio === 'agua') return 'peixe';
  if (e.dominio === 'ar') return 'ave';
  if (e.tamanho >= 4) return 'grande';
  return 'quadrupede';
}

/** Sprites por espécie: [olhando à esquerda, olhando à direita]. */
export type BancoDeSprites = HTMLCanvasElement[][];

/** Sprites de equipamento, por índice do registro e direção. */
export type BancoDeEquipamento = Array<HTMLCanvasElement[] | null>;

export function gerarSprites(): BancoDeSprites {
  const banco: BancoDeSprites = [];
  for (const e of especies.todos()) {
    const molde = MOLDES[formaDe(e)] ?? MOLDES.quadrupede;
    // Os moldes são desenhados olhando para a direita, então quem vai na
    // posição 0 (andando para a esquerda) é o espelhado. Já esteve trocado, e
    // o mundo inteiro andava de costas.
    banco.push([desenhar(molde, paletaDe(e), true), desenhar(molde, paletaDe(e), false)]);
  }
  return banco;
}

/**
 * Um sprite por equipamento, já na cor dele. Só armas e escudos aparecem: a
 * armadura muda a silhueta inteira e ficaria confusa num boneco de 16 pixels,
 * então ela é sentida no combate e lida no inspetor, não desenhada.
 */
export function gerarEquipamento(): BancoDeEquipamento {
  const banco: BancoDeEquipamento = [];
  for (const def of equipamentos.todos()) {
    const molde = MOLDES_EQUIPAMENTO[nomeDoMolde(def.id)];
    if (!molde) {
      banco.push(null);
      continue;
    }
    const cor = EQ_COR[equipamentos.indice(def.id)];
    const paleta = [0, cor, cor, cor, cor, cor];
    banco.push([
      desenhar(molde, paleta, true, 'a'),
      desenhar(molde, paleta, false, 'a'),
    ]);
  }
  return banco;
}

function nomeDoMolde(id: string): string {
  if (id.startsWith('escudo')) return 'escudo';
  if (id === 'espada') return 'espada';
  if (id === 'lanca') return 'lanca';
  if (id === 'machado') return 'machado';
  if (id === 'arco') return 'arco';
  if (id === 'porrete') return 'porrete';
  return '';
}

/** Corpo, detalhe, sombra, claro e escuro — os dois últimos derivados do corpo. */
function paletaDe(e: Especie): number[] {
  const corpo = e.cores[0];
  return [0, corpo, e.cores[1], e.cores[2], clarear(corpo, 0.22), escurecer(corpo, 0.3)];
}

function clarear(cor: number, k: number): number {
  const r = Math.min(255, ((cor >> 16) & 255) + 255 * k);
  const g = Math.min(255, ((cor >> 8) & 255) + 255 * k);
  const b = Math.min(255, (cor & 255) + 255 * k);
  return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
}

function escurecer(cor: number, k: number): number {
  const r = ((cor >> 16) & 255) * (1 - k);
  const g = ((cor >> 8) & 255) * (1 - k);
  const b = (cor & 255) * (1 - k);
  return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
}

/**
 * Pinta um molde num canvas.
 * `chaveUnica` serve aos moldes de equipamento, que usam uma letra só.
 */
function desenhar(
  molde: Molde,
  paleta: number[],
  espelhar: boolean,
  chaveUnica?: string,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = LADO_SPRITE;
  c.height = LADO_SPRITE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(LADO_SPRITE, LADO_SPRITE);
  const d = img.data;

  for (let y = 0; y < LADO_SPRITE; y++) {
    const linha = molde[y] ?? '';
    for (let x = 0; x < LADO_SPRITE; x++) {
      const sx = espelhar ? LADO_SPRITE - 1 - x : x;
      const ch = linha[sx] ?? '.';
      if (ch === '.') continue;
      const cor = chaveUnica ? paleta[1] : paleta[Number(ch)] ?? paleta[1];
      const p = (y * LADO_SPRITE + x) * 4;
      d[p] = (cor >> 16) & 255;
      d[p + 1] = (cor >> 8) & 255;
      d[p + 2] = cor & 255;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Cor média de uma espécie — usada quando a criatura vira um pixel só. */
export function coresDePixel(): Uint32Array {
  const t = especies.todos();
  const cores = new Uint32Array(t.length);
  for (let i = 0; i < t.length; i++) {
    const c = t[i].cores[0];
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    // ABGR, que é a ordem que o Uint32Array de um ImageData usa em little-endian
    cores[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  return cores;
}
