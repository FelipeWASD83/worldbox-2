import { Registro, type Definicao } from '../core/registro.js';
import type { Mundo } from '../core/mundo.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { MARCA_DOENTE, MARCA_DOMESTICADO } from '../core/criaturas.js';
import { B } from '../dados/biomas.js';
import { ESP_DOMINIO, ESP_INTELIGENTE, ESP_VIDA, especies } from '../dados/especies.js';
import { R, REC_QUANTIDADE } from '../dados/recursos.js';
import { MATERIAIS } from '../dados/materiais.js';
import { nomeDeAldeia, nomeDeReino } from '../dados/nomes.js';
import { biomaDe } from './geracao.js';
import { atear } from './ecologia.js';
import { ancoraDaConstrucao, derrubar } from './urbanismo.js';

/**
 * As ferramentas na mão do jogador.
 *
 * Cada poder é uma definição com uma função `aplicar`. Poder novo = mais um
 * item neste registro; a barra de ferramentas se monta sozinha a partir daqui.
 */
export interface Poder extends Definicao {
  readonly nome: string;
  readonly icone: string;
  readonly categoria: 'terreno' | 'vida' | 'destruicao' | 'reino';
  readonly descricao: string;
  /** Raio inicial em tiles. */
  readonly raio: number;
  /** Se true, continua aplicando enquanto o botão estiver pressionado. */
  readonly continuo: boolean;
  /**
   * `parametro` carrega a escolha secundária da ferramenta — hoje só o índice
   * da espécie a invocar.
   */
  aplicar(mundo: Mundo, x: number, y: number, raio: number, parametro?: number): void;
}

export const poderes = new Registro<Poder>('poderes');

// ------------------------------------------------------------------ utilidades

/** Chama `fn` para cada tile dentro do círculo. */
function porTile(
  mundo: Mundo,
  cx: number,
  cy: number,
  raio: number,
  fn: (i: number, x: number, y: number, forca: number) => void,
): void {
  const g = mundo.grid;
  const r = Math.max(0, raio);
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(g.largura - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(g.altura - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      fn(g.idx(x, y), x, y, r === 0 ? 1 : 1 - Math.sqrt(d2) / r);
    }
  }
}

/** Chama `fn` para cada criatura viva dentro do círculo. */
/**
 * Chama `fn` para cada criatura viva dentro do círculo.
 *
 * Varre o pool inteiro em vez de usar o índice espacial de propósito: quem está
 * dentro de casa sai do índice — para não ser caçado nem atacado —, e a mão do
 * jogador tem de alcançar mesmo assim. Um raio não respeita telhado. Poder é
 * clique, não laço de tick: pagar a varredura aqui não custa nada.
 */
function porCriatura(
  mundo: Mundo,
  cx: number,
  cy: number,
  raio: number,
  fn: (id: number, forca: number) => void,
): void {
  const c = mundo.criaturas;
  const r2 = raio * raio;
  const limite = c.limite;
  for (let id = 0; id < limite; id++) {
    if (!c.vivo[id]) continue;
    const dx = c.x[id] - cx;
    const dy = c.y[id] - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    fn(id, raio === 0 ? 1 : 1 - Math.sqrt(d2) / raio);
  }
}

/** Refaz o bioma de um tile depois de mexer na altitude. */
function refazerBioma(mundo: Mundo, i: number): void {
  const g = mundo.grid;
  g.bioma[i] = biomaDe(g.alt[i], g.temp[i], g.umidade[i]);
  g.marcarSujoIdx(i);
}

/**
 * Poe um recurso num tile, se o chao servir.
 *
 * A mão do jogador segue a mesma regra da natureza: minério nasce em qualquer
 * chão seco, menos na neve, onde o solo está coberto e não há o que garimpar.
 * O poder era mais restrito que a geração do mundo — só aceitava montanha — e
 * a diferença não tinha razão de ser depois que o minério passou a nascer no
 * mundo inteiro.
 */
function plantar(
  mundo: Mundo,
  i: number,
  idRecurso: string,
  chance: number,
  minerio = false,
): void {
  const g = mundo.grid;
  if (g.ehAgua(i)) return;
  if (minerio && g.bioma[i] === B.neve) return;
  if (!mundo.rng.chance(chance)) return;
  const indice = R[idRecurso];
  if (indice === undefined) return;
  g.recurso[i] = indice + 1;
  g.recursoQtd[i] = REC_QUANTIDADE[indice];
  g.marcarSujoIdx(i);
}

/** Pinta um bioma direto, ajustando a altitude para ele fazer sentido. */
function pintar(mundo: Mundo, i: number, bioma: number, altMin: number, altMax: number): void {
  const g = mundo.grid;
  if (g.alt[i] < altMin) g.alt[i] = altMin;
  if (g.alt[i] > altMax) g.alt[i] = altMax;
  g.bioma[i] = bioma;
  g.marcarSujoIdx(i);
}

// --------------------------------------------------------------------- terreno

poderes.registrarTodos([
  {
    id: 'elevar', nome: 'Elevar', icone: '▲', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Levanta o terreno. Levantado o bastante, o mar vira ilha e a ilha vira montanha.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        mundo.grid.alt[i] = Math.min(255, mundo.grid.alt[i] + 5 * forca + 1);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'rebaixar', nome: 'Rebaixar', icone: '▼', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Afunda o terreno. Vai fundo demais e o mar entra.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        mundo.grid.alt[i] = Math.max(0, mundo.grid.alt[i] - 5 * forca - 1);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'agua', nome: 'Água', icone: '≈', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Alaga a região.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.alt[i] = NIVEL_MAR - 14;
        mundo.grid.fogo[i] = 0;
        mundo.chamas.delete(i);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'planicie', nome: 'Campo', icone: '❞', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Cobre o chão de grama.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.planicie, NIVEL_MAR + 6, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 170;
      });
    },
  },
  {
    id: 'floresta', nome: 'Floresta', icone: '♣', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Planta mata fechada. Boa para elfos — e ótima para o fogo.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.floresta, NIVEL_MAR + 6, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 250;
      });
    },
  },
  {
    id: 'deserto', nome: 'Areia', icone: '░', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Seca a terra.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.deserto, NIVEL_MAR + 4, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 10;
        mundo.grid.umidade[i] = 30;
      });
    },
  },
  {
    id: 'montanha', nome: 'Montanha', icone: '⛰', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Ergue rocha. Nada anda por cima.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        // a borda também precisa passar do limite do que se anda, senão a
        // muralha de montanha fica com a beirada furada
        mundo.grid.alt[i] = Math.max(
          mundo.grid.alt[i],
          NIVEL_MONTANHA + 42 + forca * 30,
        );
        mundo.grid.limparRecurso(i);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'lava', nome: 'Lava', icone: '🜂', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Rocha derretida. Mata o que pisar.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.lava, NIVEL_MAR + 2, 255);
        mundo.grid.vegetacao[i] = 0;
      });
    },
  },

  {
    id: 'neve', nome: 'Nevar', icone: '❄', categoria: 'terreno', raio: 5, continuo: true,
    descricao: 'Congela a regiao. O que era campo vira gelo, e quem vive de pasto some.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.temp[i] = Math.max(0, g.temp[i] - 60);
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        if (g.ehTerra(i)) pintar(mundo, i, B.neve, NIVEL_MAR + 2, 255);
        else pintar(mundo, i, B.gelo, 0, NIVEL_MAR - 1);
        g.vegetacao[i] = 0;
      });
    },
  },
  {
    id: 'pantano', nome: 'Pantano', icone: '≈', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Encharca a terra e enche de mato.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.umidade[i] = 240;
        pintar(mundo, i, B.pantano, NIVEL_MAR + 1, NIVEL_MAR + 12);
        mundo.grid.vegetacao[i] = 150;
      });
    },
  },
  {
    id: 'plantar_arvore', nome: 'Plantar arvore', icone: '♣', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Semeia mata. Madeira para as civilizacoes e lenha para o proximo incendio.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => plantar(mundo, i, 'arvore', 0.6));
    },
  },
  {
    id: 'plantar_arbusto', nome: 'Plantar frutas', icone: '●', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Enche a area de arbustos carregados. E o que os bichos comem.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => plantar(mundo, i, 'arbusto', 0.55));
    },
  },
  {
    id: 'semear_ferro', nome: 'Veio de ferro', icone: '⛏', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Enterra ferro na rocha. Sem ferro nao ha espada.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => plantar(mundo, i, 'ferro', 0.5, true));
    },
  },
  {
    id: 'semear_ouro', nome: 'Veio de ouro', icone: '◆', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Enterra ouro. Riqueza, e um bom motivo para uma guerra.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => plantar(mundo, i, 'ouro', 0.4, true));
    },
  },
  {
    id: 'limpar', nome: 'Limpar', icone: '⌫', categoria: 'terreno', raio: 5, continuo: true,
    descricao: 'Tira arvores, pedras e construcoes do caminho, sem mexer no chao.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.limparRecurso(i);
        g.estrada[i] = 0;
        const alvo = ancoraDaConstrucao(mundo, i);
        if (alvo >= 0) derrubar(mundo, alvo, false);
      });
    },
  },
  // ------------------------------------------------------------------- vida
  {
    id: 'criar', nome: 'Criar ser', icone: '✿', categoria: 'vida', raio: 2, continuo: false,
    descricao: 'Põe no mundo a criatura escolhida na lista ao lado.',
    aplicar(mundo, x, y, raio, parametro = 0) {
      const quantos = Math.max(1, Math.round(raio * 0.8));
      for (let k = 0; k < quantos; k++) {
        const px = x + mundo.rng.entre(-raio, raio);
        const py = y + mundo.rng.entre(-raio, raio);
        if (px < 0 || py < 0 || px >= mundo.grid.largura || py >= mundo.grid.altura) continue;
        const def = especies.porIndice(parametro);
        mundo.nascer(parametro, px, py, def.longevidade[0] * 0.25);
      }
    },
  },
  {
    id: 'curar', nome: 'Curar', icone: '✚', categoria: 'vida', raio: 6, continuo: true,
    descricao: 'Restaura a vida, mata a fome e limpa doença de quem estiver perto.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.vida[id] = ESP_VIDA[c.especie[id]];
        c.fome[id] = 0;
        c.marcas[id] &= ~MARCA_DOENTE;
      });
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.fogo[i] = 0;
        mundo.chamas.delete(i);
        mundo.grid.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'aldeia', nome: 'Fundar reino', icone: '⚑', categoria: 'vida', raio: 2, continuo: false,
    descricao: 'Funda um reino novo do povo escolhido, com aldeia e primeiros moradores.',
    aplicar(mundo, x, y, _raio, parametro = 0) {
      const g = mundo.grid;
      const tx = Math.round(x);
      const ty = Math.round(y);
      if (!g.dentro(tx, ty)) return;
      const i = g.idx(tx, ty);
      if (!g.ehTerra(i) || g.ehMontanha(i)) return;
      const def = especies.porIndice(parametro);
      if (def.categoria !== 'civilizado') return;
      const reino = mundo.criarReino(parametro, nomeDeReino(mundo.rng, def.id), def.povo?.corReino ?? 0x999999);
      const aldeia = mundo.criarAldeia(reino.id, parametro, tx, ty, nomeDeAldeia(mundo.rng, def.id));
      reino.capital = aldeia.id;
      for (let k = 0; k < 9; k++) {
        const idade = mundo.rng.entre(def.longevidade[0] * 0.16, def.longevidade[0] * 0.34);
        const c = mundo.nascer(parametro, tx + mundo.rng.entre(-2, 2), ty + mundo.rng.entre(-2, 2), idade);
        if (c < 0) break;
        mundo.criaturas.aldeia[c] = aldeia.id;
        mundo.criaturas.reino[c] = reino.id;
        aldeia.populacao++;
      }
    },
  },

  {
    id: 'fertilizar', nome: 'Fertilizar', icone: '✽', categoria: 'vida', raio: 6, continuo: true,
    descricao: 'A terra floresce: mato no ponto maximo, arvores e arbustos cheios de novo.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.ehAgua(i)) return;
        g.vegetacao[i] = 255;
        g.umidade[i] = Math.min(255, g.umidade[i] + 40);
        if (g.recurso[i] !== 0) g.recursoQtd[i] = REC_QUANTIDADE[g.recurso[i] - 1];
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'domesticar', nome: 'Domesticar', icone: '☘', categoria: 'vida', raio: 5, continuo: false,
    descricao: 'Os bichos daqui passam a pertencer ao reino mais proximo, que deixa de caca-los.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const aldeia = mundo.aldeiaMaisProxima(x, y, 60);
      if (aldeia < 0) return;
      const dona = mundo.aldeias[aldeia];
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_INTELIGENTE[c.especie[id]] === 1) return;
        c.marcas[id] |= MARCA_DOMESTICADO;
        c.reino[id] = dona.reino;
      });
    },
  },
  {
    id: 'converter', nome: 'Converter', icone: '☉', categoria: 'vida', raio: 5, continuo: false,
    descricao: 'Quem estiver aqui troca de bandeira e passa a servir ao reino mais proximo.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const aldeia = mundo.aldeiaMaisProxima(x, y, 80);
      if (aldeia < 0) return;
      const destino = mundo.aldeias[aldeia];
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_INTELIGENTE[c.especie[id]] === 0) return;
        if (c.aldeia[id] === destino.id) return;
        const antiga = c.aldeia[id] >= 0 ? mundo.aldeias[c.aldeia[id]] : undefined;
        if (antiga?.ativa) antiga.populacao = Math.max(0, antiga.populacao - 1);
        c.aldeia[id] = destino.id;
        c.reino[id] = destino.reino;
        destino.populacao++;
      });
    },
  },
  // -------------------------------------------------------------- destruição
  {
    id: 'raio', nome: 'Relâmpago', icone: '⚡', categoria: 'destruicao', raio: 2, continuo: false,
    descricao: 'Um golpe seco: mata no ponto e acende o que for inflamável.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id, forca) => {
        mundo.criaturas.vida[id] -= 120 * forca;
        if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'jogador');
      });
      porTile(mundo, x, y, raio, (i) => atear(mundo, i));
    },
  },
  {
    id: 'fogo', nome: 'Fogo', icone: '🔥', categoria: 'destruicao', raio: 2, continuo: true,
    descricao: 'Acende. O resto se espalha sozinho — e não pergunta de quem é a floresta.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => atear(mundo, i));
    },
  },
  {
    id: 'meteoro', nome: 'Meteoro', icone: '☄', categoria: 'destruicao', raio: 9, continuo: false,
    descricao: 'Abre uma cratera, mata tudo em volta e ateia fogo na borda.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, g.alt[i] - 45 * forca);
        g.vegetacao[i] = 0;
        if (forca > 0.3) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        refazerBioma(mundo, i);
        if (forca < 0.55 && forca > 0.15) atear(mundo, i);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        mundo.criaturas.vida[id] -= 400 * forca;
        if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'desastre');
      });
    },
  },
  {
    id: 'bomba', nome: 'Extinguir', icone: '☠', categoria: 'destruicao', raio: 8, continuo: true,
    descricao: 'Apaga toda a vida da área, sem tocar no terreno.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id) => mundo.matar(id, 'jogador'));
    },
  },
  {
    id: 'praga', nome: 'Praga', icone: '☣', categoria: 'destruicao', raio: 4, continuo: false,
    descricao: 'Infecta quem estiver perto. A doença passa de um para outro e quem morre dela pode levantar como zumbi.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id) => {
        mundo.criaturas.marcas[id] |= MARCA_DOENTE;
      });
    },
  },
  {
    id: 'terremoto', nome: 'Terremoto', icone: '≋', categoria: 'destruicao', raio: 14, continuo: false,
    descricao: 'Sacode o chão: derruba construções e racha o terreno.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        if (mundo.rng.chance(forca * 0.5)) {
          g.alt[i] = Math.max(0, Math.min(255, g.alt[i] + mundo.rng.intEntre(-22, 12)));
          refazerBioma(mundo, i);
        }
        if (mundo.rng.chance(forca * 0.7)) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        if (mundo.rng.chance(forca * 0.35)) {
          mundo.criaturas.vida[id] -= 60;
          if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'desastre');
        }
      });
    },
  },
  {
    id: 'tsunami', nome: 'Maremoto', icone: '〰', categoria: 'destruicao', raio: 16, continuo: false,
    descricao: 'A agua avanca e engole a costa. O que era terra some do mapa.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, g.alt[i] - 60 * forca);
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        if (g.alt[i] < NIVEL_MAR) {
          g.limparRecurso(i);
          g.estrada[i] = 0;
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        refazerBioma(mundo, i);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        if (ESP_DOMINIO[mundo.criaturas.especie[id]] === 1) return;
        if (mundo.rng.chance(forca)) mundo.matar(id, 'afogado');
      });
    },
  },
  {
    id: 'tornado', nome: 'Tornado', icone: '↻', categoria: 'destruicao', raio: 7, continuo: false,
    descricao: 'Arranca o que encontra: arvores, telhados e quem estiver por perto.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      const c = mundo.criaturas;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        if (mundo.rng.chance(forca * 0.8)) g.limparRecurso(i);
        if (mundo.rng.chance(forca * 0.6)) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        if (g.vegetacao[i] > 0) g.vegetacao[i] = Math.max(0, g.vegetacao[i] - 120 * forca);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        const dx = c.x[id] - x;
        const dy = c.y[id] - y;
        const d = Math.hypot(dx, dy) || 1;
        c.x[id] = Math.max(0, Math.min(g.largura - 0.01, c.x[id] + (dx / d) * 9 * forca));
        c.y[id] = Math.max(0, Math.min(g.altura - 0.01, c.y[id] + (dy / d) * 9 * forca));
        c.vida[id] -= 45 * forca;
        if (c.vida[id] <= 0) mundo.matar(id, 'desastre');
      });
    },
  },
  {
    id: 'presente', nome: 'Fartura', icone: '✦', categoria: 'reino', raio: 6, continuo: false,
    descricao: 'Enche os celeiros da aldeia mais proxima: comida, madeira, pedra, ferro e ouro.',
    aplicar(mundo, x, y) {
      const id = mundo.aldeiaMaisProxima(x, y, 40);
      if (id < 0) return;
      const a = mundo.aldeias[id];
      for (const m of MATERIAIS) {
        a.estoque[m] = Math.min(a.capacidadeEstoque, a.estoque[m] + a.capacidadeEstoque * 0.5);
      }
      a.moral = Math.min(100, a.moral + 15);
    },
  },
  {
    id: 'inspirar', nome: 'Inspirar', icone: '♪', categoria: 'reino', raio: 8, continuo: false,
    descricao: 'Levanta o animo das aldeias por perto e cura quem estiver ferido.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      for (const a of mundo.aldeias) {
        if (!a.ativa) continue;
        if (Math.hypot(a.x - x, a.y - y) > raio + 6) continue;
        a.moral = Math.min(100, a.moral + 30);
      }
      porCriatura(mundo, x, y, raio, (id) => {
        c.vida[id] = ESP_VIDA[c.especie[id]];
        c.fome[id] = Math.max(0, c.fome[id] - 40);
      });
    },
  },
]);
