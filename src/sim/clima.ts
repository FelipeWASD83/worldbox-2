import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { B } from '../dados/biomas.js';
import { BAL } from './balanco.js';

/**
 * Nuvens andando pelo mundo, e o que elas deixam cair.
 *
 * Uma nuvem é uma mancha que atravessa o mapa levada pelo vento. A maioria só
 * faz sombra; algumas trazem chuva, e onde faz frio a mesma nuvem traz neve.
 *
 * O que a chuva faz é de propósito pequeno e concreto: **apaga incêndio** e
 * **acelera a vegetação** por onde passa. Isso basta para o clima deixar de ser
 * enfeite — um mundo pegando fogo tem chance de se salvar sozinho quando a
 * chuva chega, e é o tipo de coisa que dá vontade de ficar olhando. A neve
 * embranquece o chão que já é frio, e volta a derreter quando a nuvem sai.
 *
 * São poucas dezenas de nuvens no mundo inteiro, guardadas numa lista simples:
 * não vale um sistema de partículas nem uma camada de tiles para isso, e o
 * desenho é uma mancha por nuvem.
 */

/** Uma nuvem. Posição e raio em tiles. */
export interface Nuvem {
  x: number;
  y: number;
  raio: number;
  /** Deslocamento por tick, em tiles. Todas seguem o mesmo vento. */
  vx: number;
  vy: number;
  /** 0 = só sombra · 1 = chuva · 2 = neve */
  tipo: number;
  /** 0 a 1: entra e sai aos poucos, em vez de aparecer do nada. */
  forca: number;
  /** Enquanto cai, cresce; depois de `vida` ticks, desfaz-se. */
  idade: number;
  vida: number;
}

export const sistemaClima: Sistema = {
  id: 'clima',
  intervalo: 2,
  executar(mundo: Mundo): void {
    moverNuvens(mundo);
    semearNuvens(mundo);
    if (mundo.tick % BAL.intervaloPrecipitacao === 0) precipitar(mundo);
  },
};

/** Nasce nuvem nova enquanto o céu não está cheio. */
function semearNuvens(mundo: Mundo): void {
  const g = mundo.grid;
  const teto = Math.max(3, Math.round((g.total / 90000) * BAL.nuvensPorMilTiles));
  if (mundo.nuvens.length >= teto) return;
  if (!mundo.rng.chance(BAL.chanceNuvemNova)) return;

  // Entra pela borda de onde o vento sopra, e atravessa o mapa. Nascer no meio
  // do mapa faria a nuvem brotar do nada na frente do jogador.
  const deLado = Math.abs(mundo.ventoX) > Math.abs(mundo.ventoY);
  let x: number;
  let y: number;
  if (deLado) {
    x = mundo.ventoX > 0 ? -8 : g.largura + 8;
    y = mundo.rng.entre(0, g.altura);
  } else {
    x = mundo.rng.entre(0, g.largura);
    y = mundo.ventoY > 0 ? -8 : g.altura + 8;
  }

  const sorte = mundo.rng.f();
  const tipo = sorte < BAL.chanceNuvemDeChuva ? 1 : 0;

  // A vida é **calculada da travessia**, não sorteada.
  //
  // Era um número fixo entre 900 e 2600 ticks, e a nuvem anda devagar: no mapa
  // médio ela se desfazia depois de uns quarenta tiles, sempre perto da borda
  // por onde tinha entrado. Do lado de fora parecia defeito de spawn — nuvem
  // aparecendo no canto esquerdo e sumindo ali mesmo —, e era só ela morrer de
  // velhice antes de chegar a lugar nenhum. Aqui ela vive o bastante para
  // atravessar o mapa inteiro, com folga para a entrada e a saída.
  const velocidade = Math.max(0.001, Math.hypot(mundo.ventoX, mundo.ventoY));
  const travessia = Math.hypot(g.largura, g.altura) + 40;
  const vida = (travessia / velocidade) * mundo.rng.entre(1.05, 1.5);

  mundo.nuvens.push({
    x,
    y,
    raio: mundo.rng.entre(BAL.raioNuvem[0], BAL.raioNuvem[1]),
    vx: mundo.ventoX,
    vy: mundo.ventoY,
    tipo,
    forca: 0,
    idade: 0,
    vida,
  });
}

/** Leva as nuvens com o vento e aposenta as que já deram o que tinham. */
function moverNuvens(mundo: Mundo): void {
  const g = mundo.grid;
  const nuvens = mundo.nuvens;

  // O vento muda devagar, e todas as nuvens obedecem a ele: nuvens indo cada
  // uma para um lado não parecem clima, parecem manchas soltas.
  if (mundo.tick % BAL.intervaloDoVento === 0) {
    // O vento **gira**, e não sofre um empurrão em cada eixo. Somando ruído a
    // x e y separadamente e depois normalizando, a direção resultante ficava
    // presa perto de onde já estava — o mundo inteiro passava a partida com as
    // nuvens entrando sempre pela mesma borda.
    const angulo = Math.atan2(mundo.ventoY, mundo.ventoX)
      + mundo.rng.entre(-BAL.giroDoVento, BAL.giroDoVento);
    mundo.ventoX = Math.cos(angulo) * BAL.velocidadeDoVento;
    mundo.ventoY = Math.sin(angulo) * BAL.velocidadeDoVento;
  }

  for (let k = nuvens.length - 1; k >= 0; k--) {
    const n = nuvens[k];
    n.x += n.vx * 2;
    n.y += n.vy * 2;
    n.idade += 2;
    // Aparece e some suavemente. A janela é proporcional à vida: com um número
    // fixo, uma nuvem de vida longa passava quase toda a travessia em força
    // cheia e piscava no fim.
    const janela = Math.max(160, n.vida * 0.08);
    const entrada = Math.min(1, n.idade / janela);
    const saida = Math.min(1, Math.max(0, (n.vida - n.idade) / janela));
    n.forca = Math.min(entrada, saida);

    const fora =
      n.x < -20 || n.y < -20 || n.x > g.largura + 20 || n.y > g.altura + 20;
    if (n.idade >= n.vida || fora) nuvens.splice(k, 1);
  }
}

/**
 * O que cai das nuvens de chuva.
 *
 * Amostra alguns pontos sob cada nuvem em vez de varrer o disco inteiro: uma
 * nuvem de raio doze cobre umas quatrocentas casas, e o efeito é o mesmo com
 * um punhado de amostras por passada, repetidas ao longo dos ticks em que ela
 * demora a atravessar.
 */
function precipitar(mundo: Mundo): void {
  const g = mundo.grid;
  for (const n of mundo.nuvens) {
    if (n.tipo === 0 || n.forca < 0.4) continue;
    const amostras = Math.round(n.raio * 1.6);
    for (let k = 0; k < amostras; k++) {
      const ang = mundo.rng.f() * Math.PI * 2;
      const d = n.raio * Math.sqrt(mundo.rng.f());
      const x = Math.round(n.x + Math.cos(ang) * d);
      const y = Math.round(n.y + Math.sin(ang) * d);
      if (x < 0 || y < 0 || x >= g.largura || y >= g.altura) continue;
      const i = g.idx(x, y);
      if (g.ehAgua(i)) continue;

      // Frio faz nevar em vez de chover, e a nuvem inteira muda de cara — é o
      // que faz uma frente atravessar o continente chovendo no campo e nevando
      // quando alcança a serra.
      if (g.temp[i] < BAL.temperaturaDaNeve) {
        n.tipo = 2;
        if (g.bioma[i] !== B.neve && g.bioma[i] !== B.gelo && g.bioma[i] !== B.pico) {
          if (mundo.rng.chance(0.02)) {
            g.vegetacao[i] = Math.max(0, g.vegetacao[i] - 6);
            g.marcarSujoIdx(i);
          }
        }
        continue;
      }
      n.tipo = 1;

      // apaga fogo: é o principal efeito que a chuva tem no mundo
      if (g.fogo[i] > 0) {
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        g.marcarSujoIdx(i);
      }
      // e faz o mato crescer mais depressa
      const antes = g.vegetacao[i];
      g.vegetacao[i] = Math.min(255, antes + BAL.vegetacaoPorChuva);
      if ((g.vegetacao[i] >> 4) !== (antes >> 4)) g.marcarSujoIdx(i);
    }
  }
}
