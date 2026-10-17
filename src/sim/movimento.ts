import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { ESP_DOMINIO, ESP_VELOCIDADE } from '../dados/especies.js';
import { Campo } from '../dados/tracos.js';
import { fator } from './genetica.js';
import { EQ_PESO } from '../dados/equipamentos.js';
import { BIOMA_AGUA } from '../dados/biomas.js';
import { BAL } from './balanco.js';
import { PONTOS_POR_ROTA, calcularRota } from './caminho.js';

/**
 * Move cada criatura na direção do que ela decidiu.
 *
 * A criatura anda em linha reta, que num mundo de tiles abertos é quase
 * sempre o caminho, e é o que permite mover dezenas de milhares por tick.
 * Quando a linha reta **bate** (água para quem anda, terra para quem nada), ela
 * pede uma rota à busca de caminho (`caminho.ts`) e passa a seguir os pontos
 * de passagem dela. Enquanto a rota não sai — o mundo calcula poucas por tick
 * —, desliza pelo eixo que ainda dá, como sempre fez.
 *
 * Quem foge não pede rota: quem corre de um lobo não escolhe caminho. E quem
 * voa não precisa.
 */
export const sistemaMovimento: Sistema = {
  id: 'movimento',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const g = mundo.grid;
    const rotas = mundo.rotas;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (c.abrigo[i] >= 0) continue; // dentro de casa ninguém anda

      const estado = c.estado[i];
      if (estado === Estado.Ocioso || estado === Estado.Dormindo) continue;

      const esp = c.especie[i];
      let vel = ESP_VELOCIDADE[esp] * fator(c.tracos[i], Campo.velocidade);
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

      // Tem rota para este destino? Então o alvo imediato é o próximo ponto
      // de passagem, não o destino. Destino que mudou derruba a rota.
      const dominioRota = ESP_DOMINIO[esp];
      if (rotas.n[i] > 0 && estado !== Estado.Fugindo) {
        const destTile = (destY | 0) * g.largura + (destX | 0);
        if (rotas.para[i] !== destTile && !(alvo >= 0 && rotaAindaServe(rotas, i, g.largura, destX, destY))) {
          rotas.esquecer(i);
        } else {
          const base = i * PONTOS_POR_ROTA + rotas.k[i];
          const px = rotas.x[base] + 0.5;
          const py = rotas.y[base] + 0.5;
          const ddx = px - c.x[i];
          const ddy = py - c.y[i];
          if (ddx * ddx + ddy * ddy < 0.5) {
            rotas.k[i]++;
            if (rotas.k[i] >= rotas.n[i]) rotas.esquecer(i);
          } else {
            destX = px;
            destY = py;
          }
        }
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
      } else if (
        dominioRota !== 2 && QUER_ROTA[estado] === 1 && rotas.n[i] === 0 &&
        pedirRota(mundo, i, dominioRota, alvo >= 0 ? destX : c.destinoX[i] + 0.5,
          alvo >= 0 ? destY : c.destinoY[i] + 0.5)
      ) {
        // A linha reta bateu e a rota saiu: o próximo tick já segue por ela.
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

/**
 * Quem tem motivo para pedir rota.
 *
 * Quem só passeia (`Vagando`) não pede: se o passeio bateu na água, ele
 * desiste e sorteia outro, que é o que um bicho à toa faz, e era esse passeio
 * que respondia pela maior parte das buscas — medido, dezessete por tick, com
 * o movimento custando três vezes o resto da simulação junto. Quem foge também
 * não pede: corre para longe, por onde der.
 */
const QUER_ROTA = (() => {
  const t = new Uint8Array(16);
  t[Estado.BuscandoComida] = 1;
  t[Estado.Cacando] = 1;
  t[Estado.Acasalando] = 1;
  t[Estado.Atacando] = 1;
  t[Estado.Voltando] = 1;
  t[Estado.Trabalhando] = 1;
  return t;
})();

/**
 * Pede uma rota, respeitando o teto de buscas do tick e a espera de quem
 * acabou de falhar. Devolve se a rota saiu.
 */
function pedirRota(mundo: Mundo, i: number, dominio: number, destX: number, destY: number): boolean {
  const rotas = mundo.rotas;
  if (mundo.tick < rotas.espera[i]) return false;
  if (rotas.tickDasBuscas !== mundo.tick) {
    rotas.tickDasBuscas = mundo.tick;
    rotas.buscasNoTick = 0;
  }
  if (rotas.buscasNoTick >= BAL.buscasPorTick) return false;
  rotas.buscasNoTick++;
  const g = mundo.grid;
  const tx = Math.max(0, Math.min(g.largura - 1, destX | 0));
  const ty = Math.max(0, Math.min(g.altura - 1, destY | 0));
  if (calcularRota(mundo, i, dominio, tx, ty)) return true;
  // falhou na janela normal: tenta a grande daqui a pouco; falhou na grande,
  // espera bastante antes de insistir
  rotas.espera[i] = mundo.tick + (rotas.grande[i] === 1 ? 20 : BAL.esperaDepoisDeFalhar);
  return false;
}

/**
 * Rota atrás de uma criatura que anda: o alvo se mexe, e refazer a rota a cada
 * passo dele seria pedir uma busca por tick. Ela continua valendo enquanto o
 * alvo estiver a poucos tiles de onde a rota termina.
 */
function rotaAindaServe(
  rotas: Mundo['rotas'], i: number, largura: number, destX: number, destY: number,
): boolean {
  const fim = rotas.para[i];
  if (fim < 0) return false;
  const fx = fim % largura;
  const fy = (fim / largura) | 0;
  return Math.abs(fx - destX) + Math.abs(fy - destY) < 6;
}

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
