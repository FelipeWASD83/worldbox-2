import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { ESP_INTELIGENTE } from '../dados/especies.js';
import { biomas } from '../dados/biomas.js';
import { recursos, REC_QUANTIDADE } from '../dados/recursos.js';
import { ED_MATERIAL_MINIMO, ED_NATURAL, ED_OCUPA, edificios } from '../dados/edificios.js';
import { TRACO_OPOSTOS, tracos } from '../dados/tracos.js';
import { tecnologias } from '../dados/tecnologias.js';
import { erguer, loteServe } from './urbanismo.js';
import { aprender, materialDoReino } from './conhecimento.js';
import { vidaMaxima } from './genetica.js';
import { poderes, porCriatura, porTile, reinosNaArea, type Poder } from './poderesBase.js';

/**
 * As cinco famílias de poder que saem prontas dos registros do jogo.
 *
 * Um pincel por bioma, um plantio por recurso, uma obra por construção, um dom
 * por traço e uma revelação por tecnologia. São quase cem ferramentas, e
 * nenhuma delas é escrita à mão aqui: elas nascem de `biomas`, `recursos`,
 * `edificios`, `tracos` e `tecnologias`, com nome e descrição tirados da
 * própria definição.
 *
 * É a mesma ideia que o resto do projeto usa em toda parte, aplicada à
 * interface: **conteúdo novo não deveria exigir código novo**. Registrar um
 * bioma passa a registrar, de graça, o pincel daquele bioma; registrar um traço
 * passa a dar ao jogador o poder de concedê-lo. Se um dia houver trinta biomas,
 * haverá trinta pincéis sem ninguém tocar neste arquivo.
 *
 * Chamada do fim de `poderes.ts`, depois dos poderes escritos à mão — a ordem
 * de registro é a ordem em que os botões aparecem na aba.
 */
export function registrarDerivados(): void {
  poderes.registrarTodos([
    ...pinceisDeBioma(),
    ...plantiosDeRecurso(),
    ...obras(),
    ...dons(),
    ...revelacoes(),
  ]);
}

// ------------------------------------------------------------------- biomas

/**
 * Um ícone por bioma. É a única coisa que não dá para deduzir da definição:
 * "cor RGB" não vira glifo.
 */
const ICONE_BIOMA: Record<string, string> = {
  oceano_profundo: '≣', oceano: '≋', raso: '≈', rio: '⌇', lago: '◍',
  praia: '⌓', deserto: '░', savana: '⁙', planicie: '❞', floresta: '♣',
  selva: '❦', pantano: '⋓', taiga: '⇞', tundra: '⌾', neve: '❄',
  montanha: '⛰', pico: '△', lava: '🜂', cinzas: '▒', campo_fertil: '❁',
  mangue: '⋔', oasis: '◉', terra_rachada: '⌗', gelo: '❆', vulcao: '⌂',
};

/**
 * Em que faixa de altitude cada bioma faz sentido.
 *
 * O pincel não pinta só a cor: ele **ajusta o relevo** para o bioma poder
 * existir ali. Pintar oceano no alto de uma serra sem afundar o chão daria um
 * tile azul de montanha que a primeira reavaliação de terreno desfaria.
 */
function faixaDeAltitude(id: string, agua: boolean): [number, number] {
  if (agua) return [NIVEL_MAR - 30, NIVEL_MAR - 4];
  if (id === 'pico') return [242, 255];
  if (id === 'montanha' || id === 'vulcao') return [NIVEL_MONTANHA + 6, 236];
  if (id === 'gelo') return [NIVEL_MAR - 8, NIVEL_MAR - 1];
  if (id === 'praia' || id === 'mangue') return [NIVEL_MAR + 1, NIVEL_MAR + 6];
  if (id === 'pantano' || id === 'oasis') return [NIVEL_MAR + 2, NIVEL_MAR + 12];
  if (id === 'lava') return [NIVEL_MAR + 2, 255];
  return [NIVEL_MAR + 6, NIVEL_MONTANHA - 10];
}

function pinceisDeBioma(): Poder[] {
  return biomas.todos().map((def) => {
    const b = biomas.indice(def.id);
    const [altMin, altMax] = faixaDeAltitude(def.id, def.agua);
    // A vegetação inicial sai da fertilidade do próprio bioma: campo fértil
    // nasce verde, deserto nasce pelado, e ninguém precisa declarar isso.
    const mato = Math.round(def.fertilidade * 220);
    return {
      id: `bioma_${def.id}`,
      nome: def.nome,
      icone: ICONE_BIOMA[def.id] ?? '▩',
      categoria: 'bioma' as const,
      raio: 5,
      continuo: true,
      descricao: `Pinta ${def.nome} e ajusta o relevo para o bioma caber ali.`,
      aplicar(mundo, x, y, raio) {
        const g = mundo.grid;
        porTile(mundo, x, y, raio, (i) => {
          if (g.alt[i] < altMin) g.alt[i] = altMin;
          if (g.alt[i] > altMax) g.alt[i] = altMax;
          g.bioma[i] = b;
          g.vegetacao[i] = mato;
          if (def.agua || def.fertilidade === 0) {
            g.limparRecurso(i);
            g.estrada[i] = 0;
          }
          if (def.agua) {
            g.fogo[i] = 0;
            mundo.chamas.delete(i);
          }
          g.marcarSujoIdx(i);
        });
      },
    };
  });
}

// ---------------------------------------------------------------- vegetação

function plantiosDeRecurso(): Poder[] {
  return recursos.todos().map((def) => {
    const indice = recursos.indice(def.id);
    const minerio = def.rende !== 'madeira' && def.rende !== 'comida';
    return {
      id: `plantar_${def.id}`,
      nome: def.nome,
      icone: minerio ? '◈' : def.rende === 'comida' ? '❋' : '♠',
      categoria: 'natureza' as const,
      raio: 4,
      continuo: true,
      descricao: minerio
        ? `Enterra ${def.nome} no chão daqui. Rende ${def.rende}.`
        : `Semeia ${def.nome} onde o chão aceitar. Rende ${def.rende}.`,
      aplicar(mundo, x, y, raio) {
        const g = mundo.grid;
        porTile(mundo, x, y, raio, (i) => {
          if (g.ehAgua(i)) return;
          if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) return;
          // A mão do jogador ignora o bioma de propósito: plantar palmeira na
          // neve é uma decisão dele, não um erro do jogo. O que ela respeita é
          // o que não tem conserto — água e chão já ocupado.
          if (!mundo.rng.chance(0.55)) return;
          g.recurso[i] = indice + 1;
          g.recursoQtd[i] = REC_QUANTIDADE[indice];
          g.marcarSujoIdx(i);
        });
      },
    };
  });
}

// ------------------------------------------------------------------- obras

/**
 * Uma ferramenta por construção: a vila mais próxima ergue aquilo ali, de graça.
 *
 * Sai pela mesma porta que a vila usa (`acharLote` e `erguer`), então tudo o que
 * vale para uma obra normal continua valendo: o lote precisa caber, o porto
 * precisa de água encostada, a mina precisa de rocha. O que o jogador pula é a
 * fila de vontades, o material e a tecnologia — o resto é obra igual às outras,
 * e cai, queima e vira ruína como qualquer uma.
 *
 * Sem vila por perto não há obra: prédio sem dono não entra na conta de
 * ninguém, não é mantido e não abriga.
 */
function obras(): Poder[] {
  return edificios
    .todos()
    .filter((def) => ED_NATURAL[edificios.indice(def.id)] !== 1 && def.id !== 'ruina')
    .map((def) => {
      const tipo = edificios.indice(def.id);
      return {
        id: `erguer_${def.id}`,
        nome: def.nome,
        icone: '⌂',
        categoria: 'construcao' as const,
        raio: 3,
        continuo: false,
        descricao: `A vila mais próxima ergue ${def.nome} aqui, sem pagar nada por isso.`,
        aplicar(mundo, x, y) {
          const id = mundo.aldeiaMaisProxima(x, y, 60);
          if (id < 0) return;
          const a = mundo.aldeias[id];
          // Onde ele clicou, e não onde a vila escolheria: `loteServe` é a mesma
          // conferência que a fila de obras usa, só que aplicada ao ponto dele.
          const tx = Math.round(x);
          const ty = Math.round(y);
          if (!mundo.grid.dentro(tx, ty)) return;
          const largura = ED_OCUPA[tipo * 2];
          const profundidade = ED_OCUPA[tipo * 2 + 1];
          if (!loteServe(mundo, a, tx, ty, largura, profundidade, tipo)) return;
          const tile = mundo.grid.idx(tx, ty);
          const material = Math.max(
            materialDoReino(mundo.reinos[a.reino]),
            ED_MATERIAL_MINIMO[tipo],
          );
          erguer(mundo, a, tile, tipo, material);
          mundo.recalcularCapacidade(a);
        },
      };
    });
}

// -------------------------------------------------------------------- dons

/**
 * Uma ferramenta por traço: quem estiver aqui passa a ter aquilo.
 *
 * O traço oposto sai junto — não dá para ser forte e franzino ao mesmo tempo, e
 * quando o jogador escolhe um lado ele está escolhendo contra o outro.
 */
function dons(): Poder[] {
  return tracos.todos().map((def) => {
    const t = tracos.indice(def.id);
    return {
      id: `dom_${def.id}`,
      nome: def.nome,
      icone: '✧',
      categoria: 'vida' as const,
      raio: 4,
      continuo: false,
      descricao: `Quem estiver aqui vira ${def.nome}. ${def.descricao}`,
      aplicar(mundo, x, y, raio) {
        const c = mundo.criaturas;
        porCriatura(mundo, x, y, raio, (id) => {
          if (ESP_INTELIGENTE[c.especie[id]] === 0) return;
          c.tracos[id] = (c.tracos[id] & ~TRACO_OPOSTOS[t]) | (1 << t);
          c.vida[id] = Math.min(c.vida[id], vidaMaxima(c, id));
        });
      },
    };
  });
}

// -------------------------------------------------------------- revelações

/**
 * Uma ferramenta por tecnologia: os reinos daqui passam a saber aquilo.
 *
 * `aprender` puxa os pré-requisitos junto, então ensinar o aço a uma tribo da
 * idade da pedra ensina a metalurgia, a alvenaria e a carpintaria pelo caminho
 * — um reino com um buraco no meio da própria árvore não faria sentido nenhum.
 */
function revelacoes(): Poder[] {
  return tecnologias
    .todos()
    .filter((def) => def.custo > 0)
    .map((def) => {
      const t = tecnologias.indice(def.id);
      return {
        id: `ensinar_${def.id}`,
        nome: def.nome,
        icone: '❧',
        categoria: 'saber' as const,
        raio: 12,
        continuo: false,
        descricao: `Os reinos daqui descobrem ${def.nome}, e o que ela exige antes. ${def.descricao}`,
        aplicar(mundo, x, y, raio) {
          for (const id of reinosNaArea(mundo, x, y, raio)) {
            const r = mundo.reinos[id];
            if (r?.ativo) aprender(mundo, r, t);
          }
        },
      };
    });
}
