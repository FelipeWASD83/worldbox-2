import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { ESP_DOMINIO, ESP_VELOCIDADE } from '../dados/especies.js';
import { EQ_PESO } from '../dados/equipamentos.js';
import { BIOMA_AGUA } from '../dados/biomas.js';

/**
 * Move cada criatura na direção do que ela decidiu.
 *
 * Não há busca de caminho: a criatura anda em linha reta e, quando esbarra em
 * terreno que não serve, desliza pelo eixo que ainda dá. Para um mundo de tiles
 * abertos isso basta, e é o que permite mover dezenas de milhares por tick.
 * Se um dia precisar de A*, o lugar de encaixar é aqui — o resto do jogo não
 * sabe como a criatura chega ao destino.
 */
export const sistemaMovimento: Sistema = {
  id: 'movimento',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const g = mundo.grid;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (c.abrigo[i] >= 0) continue; // dentro de casa ninguém anda

      const estado = c.estado[i];
      if (estado === Estado.Ocioso || estado === Estado.Dormindo) continue;

      const esp = c.especie[i];
      let vel = ESP_VELOCIDADE[esp];
      // ferro pesa: quem veste placas anda menos
      if (c.armadura[i] !== 0) vel *= EQ_PESO[c.armadura[i] - 1];
      if (c.escudo[i] !== 0) vel *= EQ_PESO[c.escudo[i] - 1];
      if (c.arma[i] !== 0) vel *= EQ_PESO[c.arma[i] - 1];

      // para onde
      let destX: number;
      let destY: number;
      const alvo = c.alvo[i];
      if (alvo >= 0 && c.vivo[alvo]) {
        destX = c.x[alvo];
        destY = c.y[alvo];
        if (estado === Estado.Fugindo) {
          // foge na direção oposta
          destX = c.x[i] * 2 - destX;
          destY = c.y[i] * 2 - destY;
          // o empurrão da fuga é pequeno de propósito: com bônus grande, presa
          // um pouco mais lenta virava inalcançável e os predadores morriam
          // todos de fome com o campo cheio de caça.
          vel *= 1.05;
        } else if (estado === Estado.Cacando) {
          vel *= 1.08;
        }
      } else if (c.destinoX[i] >= 0) {
        destX = c.destinoX[i] + 0.5;
        destY = c.destinoY[i] + 0.5;
      } else {
        continue;
      }

      let dx = destX - c.x[i];
      let dy = destY - c.y[i];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.0001) {
        c.destinoX[i] = -1;
        continue;
      }
      // chegou ao destino de tile
      if (alvo < 0 && dist < 0.6) {
        c.destinoX[i] = -1;
        continue;
      }

      dx = (dx / dist) * vel;
      dy = (dy / dist) * vel;
      c.dir[i] = dx < 0 ? 0 : 1;

      const dominio = ESP_DOMINIO[esp];

      // Subir a serra é caro. Não é proibido — quem vai minerar sobe, quem
      // está lá em cima desce, quem foge não escolhe o caminho —, mas custa
      // mais da metade do passo, e o desvio abaixo faz o bicho contornar o
      // morro sempre que der. Sem isso as manadas atravessavam cordilheira em
      // linha reta como se fosse campo aberto.
      const naSerra = dominio === 0 && g.ehMontanha(g.idx(c.x[i] | 0, c.y[i] | 0));
      if (naSerra) vel *= PASSO_NA_SERRA;

      const nx = c.x[i] + dx;
      const ny = c.y[i] + dy;

      // Antes de aceitar um passo que sobe, tenta os dois eixos separados: se
      // um deles segue por chão plano, é por ali que se anda. É o contorno do
      // morro, feito sem busca de caminho nenhuma.
      const subiria = dominio === 0 && !naSerra && ehSerra(g, nx, ny);
      if (subiria) {
        if (podePisar(g, dominio, nx, c.y[i]) && !ehSerra(g, nx, c.y[i])) {
          c.x[i] = nx;
          continue;
        }
        if (podePisar(g, dominio, c.x[i], ny) && !ehSerra(g, c.x[i], ny)) {
          c.y[i] = ny;
          continue;
        }
      }

      if (podePisar(g, dominio, nx, ny)) {
        c.x[i] = nx;
        c.y[i] = ny;
      } else if (podePisar(g, dominio, nx, c.y[i])) {
        c.x[i] = nx;
      } else if (podePisar(g, dominio, c.x[i], ny)) {
        c.y[i] = ny;
      } else {
        // encurralado: desiste do destino e repensa no próximo turno de IA
        c.destinoX[i] = -1;
        c.alvo[i] = -1;
      }

      // nunca sair do mapa
      if (c.x[i] < 0) c.x[i] = 0;
      else if (c.x[i] > g.largura - 0.01) c.x[i] = g.largura - 0.01;
      if (c.y[i] < 0) c.y[i] = 0;
      else if (c.y[i] > g.altura - 0.01) c.y[i] = g.altura - 0.01;
    }
  },
};

/** Quanto do passo sobra para quem está andando em rocha. */
const PASSO_NA_SERRA = 0.45;

function ehSerra(g: { idx(x: number, y: number): number; ehMontanha(i: number): boolean;
  largura: number; altura: number }, x: number, y: number): boolean {
  const tx = x | 0;
  const ty = y | 0;
  if (tx < 0 || ty < 0 || tx >= g.largura || ty >= g.altura) return false;
  return g.ehMontanha(g.idx(tx, ty));
}

function podePisar(
  g: { largura: number; altura: number; idx(x: number, y: number): number; alt: Uint8Array; bioma: Uint8Array },
  dominio: number,
  x: number,
  y: number,
): boolean {
  const tx = x | 0;
  const ty = y | 0;
  if (tx < 0 || ty < 0 || tx >= g.largura || ty >= g.altura) return false;
  if (dominio === 2) return true;
  const i = g.idx(tx, ty);
  if (dominio === 1) return BIOMA_AGUA[g.bioma[i]] === 1;
  return g.alt[i] >= NIVEL_MAR && g.alt[i] < NIVEL_MONTANHA + 40;
}
