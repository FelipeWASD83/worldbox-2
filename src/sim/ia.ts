import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import type { Criaturas } from '../core/criaturas.js';
import { Estado, MARCA_DOMESTICADO, MARCA_SOLDADO } from '../core/criaturas.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import {
  ESP_AGRESSAO, ESP_CACA, ESP_CIVILIZADO, ESP_DOMINIO, ESP_HERBIVORO,
  ESP_DANO, ESP_LOTACAO, ESP_MARCIAL, ESP_MEDO, ESP_MONSTRO, ESP_VISAO,
  TOTAL_ESPECIES, especies,
} from '../dados/especies.js';
import { Campo, MASCARA_DESTEMIDO } from '../dados/tracos.js';
import { fator, vidaMaxima } from './genetica.js';
import { BIOMA_AGUA } from '../dados/biomas.js';
import { REC_COMIDA } from '../dados/recursos.js';
import { oQueFalta, procurarRecurso } from './coleta.js';
import { acharCasaComVaga, entrar, naPorta } from './moradia.js';
import { BAL } from './balanco.js';

/**
 * Decisão das criaturas.
 *
 * Um cérebro é uma função que olha o mundo e escolhe estado, alvo e destino da
 * criatura. O movimento em si é de outro sistema — aqui só se decide.
 *
 * Este é o arquivo feito para crescer: hoje são três máquinas de estado curtas.
 * Trocar por árvore de comportamento, utilidade ou memória individual é
 * reescrever `CEREBROS` sem tocar em mais nada.
 *
 * Nada aqui aloca objeto dentro do laço: os filtros de busca são funções de
 * módulo que leem o contexto em `_mundo`/`_eu`. Closure por criatura por tick
 * seriam milhares de objetos por segundo só para o coletor de lixo recolher.
 */

export type Cerebro = (mundo: Mundo, i: number) => void;

// -------------------------------------------------------------- contexto da busca
let _mundo: Mundo;
let _c: Criaturas;
let _eu = 0;
let _espEu = 0;

function aceitaPresa(id: number): boolean {
  if (!_c.vivo[id]) return false;
  // rebanho domesticado é do reino: ninguém desse reino o caça
  if ((_c.marcas[id] & MARCA_DOMESTICADO) !== 0 && _c.reino[id] === _c.reino[_eu]) {
    return false;
  }
  return ESP_CACA[_espEu * TOTAL_ESPECIES + _c.especie[id]] === 1;
}

function aceitaAmeaca(id: number): boolean {
  if (!_c.vivo[id]) return false;
  return ESP_MEDO[_espEu * TOTAL_ESPECIES + _c.especie[id]] === 1;
}

function aceitaPar(id: number): boolean {
  if (!_c.vivo[id]) return false;
  if (_c.especie[id] !== _espEu) return false;
  if (_c.esperaFilho[id] > 0) return false;
  return ehAdulto(_c, id);
}

/**
 * O que um povo civilizado considera ameaça.
 *
 * Inclui, além de monstros e de reinos em guerra, qualquer bicho que tenha a
 * minha espécie no cardápio. Sem isso um tigre entrava na aldeia e ninguém
 * reagia — os aldeões seguiam trabalhando enquanto eram comidos um a um, e
 * humanos e elfos desapareciam do mapa nos primeiros minutos de toda partida.
 */
function aceitaAmeacaDeCivilizado(id: number): boolean {
  if (!_c.vivo[id]) return false;
  const esp = _c.especie[id];
  if (esp === _espEu) return false;
  if (ESP_MONSTRO[esp] === 1) return true;
  if (ESP_CACA[esp * TOTAL_ESPECIES + _espEu] === 1) return true;
  const meuReino = _c.reino[_eu];
  const outroReino = _c.reino[id];
  if (outroReino < 0 || meuReino < 0) return false;
  if (outroReino === meuReino) return false;
  return _mundo.emGuerra(meuReino, outroReino);
}

/**
 * O que vale a pena atacar.
 *
 * Só o que eu de fato como — mais gente, se eu for um monstro. Antes qualquer
 * bicho agressivo tratava civilizados como alvo, e o resultado era javali
 * matando elfo sem ter o que fazer com o corpo: as aldeias eram dizimadas por
 * animais que nem se alimentam delas.
 */
function aceitaQualquerVitima(id: number): boolean {
  if (!_c.vivo[id]) return false;
  const esp = _c.especie[id];
  if (esp === _espEu) return false;
  if (ESP_CACA[_espEu * TOTAL_ESPECIES + esp] === 1) return true;
  return ESP_MONSTRO[_espEu] === 1 && ESP_CIVILIZADO[esp] === 1;
}

/** Quem tem a minha espécie no cardápio. */
function aceitaQuemMeCaca(id: number): boolean {
  if (!_c.vivo[id]) return false;
  return ESP_CACA[_c.especie[id] * TOTAL_ESPECIES + _espEu] === 1;
}

function ehAdulto(c: Criaturas, i: number): boolean {
  const f = c.idade[i] / c.longevidade[i];
  return f >= BAL.fracaoAdulto && f <= BAL.fracaoIdoso;
}

function podeReproduzir(c: Criaturas, i: number): boolean {
  return c.esperaFilho[i] <= 0 && c.fome[i] < BAL.fomeMaxRepro && ehAdulto(c, i);
}

// ------------------------------------------------------------------- utilidades

/** Marca um destino em tiles. */
function irPara(c: Criaturas, i: number, x: number, y: number): void {
  c.destinoX[i] = x | 0;
  c.destinoY[i] = y | 0;
}

function chegouAoDestino(c: Criaturas, i: number): boolean {
  if (c.destinoX[i] < 0) return true;
  const dx = c.destinoX[i] + 0.5 - c.x[i];
  const dy = c.destinoY[i] + 0.5 - c.y[i];
  return dx * dx + dy * dy < 1.2;
}

/** Um ponto qualquer perto, que o domínio da criatura aceite. */
function vaguear(mundo: Mundo, i: number, raio = 9): void {
  const c = mundo.criaturas;
  const g = mundo.grid;
  const dominio = ESP_DOMINIO[c.especie[i]];
  // Quem já está na rocha aceita andar por ela: senão o bicho que subiu
  // atrás de uma presa, ou que nasceu ali, fica parado para sempre sem achar
  // destino nenhum que o filtro aprove.
  const naSerra = g.ehMontanha(g.idx(c.x[i] | 0, c.y[i] | 0));
  for (let t = 0; t < 6; t++) {
    const x = g.prenderX((c.x[i] + mundo.rng.entre(-raio, raio)) | 0);
    const y = g.prenderY((c.y[i] + mundo.rng.entre(-raio, raio)) | 0);
    // quem voa atravessa o mar, mas não mora nele: sem esta preferência os
    // pássaros se espalhavam pelo oceano, onde não há pasto nem com quem
    // procriar, e a espécie sumia em toda partida
    if (dominio === 2 && g.ehAgua(g.idx(x, y)) && t < 4) continue;
    if (tileServe(mundo, dominio, x, y, naSerra)) {
      irPara(c, i, x, y);
      c.estado[i] = Estado.Vagando;
      return;
    }
  }
  c.estado[i] = Estado.Ocioso;
  c.destinoX[i] = -1;
}

/**
 * O tile serve de **destino** para uma criatura deste domínio?
 *
 * Note a diferença para `podePisar`, em `movimento.ts`: aqui é escolha, lá é
 * possibilidade. Bicho nenhum escolhe passear na serra — não há o que comer,
 * não há com quem procriar e a subida é cara —, mas quem já está lá em cima
 * precisa poder descer, e o mineiro precisa poder chegar ao veio que a aldeia
 * mandou buscar. Por isso a montanha some da lista de destinos possíveis sem
 * virar parede.
 *
 * `aceitaSerra` é a saída para quem tem motivo: quem vai minerar, quem está
 * encurralado na rocha e quem foge de um predador passa por cima da manha.
 */
export function tileServe(
  mundo: Mundo,
  dominio: number,
  x: number,
  y: number,
  aceitaSerra = false,
): boolean {
  const g = mundo.grid;
  if (x < 0 || y < 0 || x >= g.largura || y >= g.altura) return false;
  const i = g.idx(x, y);
  if (dominio === 2) return true; // voa por cima de tudo
  if (dominio === 1) return BIOMA_AGUA[g.bioma[i]] === 1;
  if (g.alt[i] < NIVEL_MAR || g.alt[i] >= NIVEL_MONTANHA + 40) return false;
  return aceitaSerra || !g.ehMontanha(i);
}

/**
 * Procura comida vegetal por perto: um arbusto carregado de fruta ou, na falta
 * dele, um tile de pasto.
 *
 * Sorteia alguns pontos em vez de varrer a área — o bicho não precisa do
 * melhor lugar do mapa, só de algo que valha a caminhada. Fruta pontua bem
 * mais que capim porque alimenta bem mais.
 */
function acharComidaVegetal(mundo: Mundo, i: number, raio: number): boolean {
  const c = mundo.criaturas;
  const g = mundo.grid;
  let melhorX = -1;
  let melhorY = -1;
  let melhorNota = 40; // abaixo disso não vale a viagem
  for (let t = 0; t < 12; t++) {
    const x = g.prenderX((c.x[i] + mundo.rng.entre(-raio, raio)) | 0);
    const y = g.prenderY((c.y[i] + mundo.rng.entre(-raio, raio)) | 0);
    const idx = g.idx(x, y);
    if (BIOMA_AGUA[g.bioma[idx]] === 1) continue;
    if (g.fogo[idx] > 0) continue;

    let nota = g.vegetacao[idx];
    const r = g.recurso[idx];
    if (r !== 0 && REC_COMIDA[r - 1] === 1 && g.recursoQtd[idx] > 3) {
      nota += 120 + g.recursoQtd[idx];
    }
    if (nota > melhorNota) {
      melhorNota = nota;
      melhorX = x;
      melhorY = y;
    }
  }
  if (melhorX < 0) return false;
  irPara(c, i, melhorX, melhorY);
  c.estado[i] = Estado.BuscandoComida;
  c.alvo[i] = -1;
  return true;
}

/**
 * O objetivo que a criatura já tem continua valendo?
 *
 * Sem isto, cada passada da IA sorteava um destino novo e o bicho ficava
 * oscilando entre pastos sem nunca chegar em nenhum — morria de fome em cima
 * de um campo cheio de comida. Persistir no objetivo é o que faz a criatura
 * parecer que sabe o que quer.
 */
function objetivoAindaVale(mundo: Mundo, i: number): boolean {
  const c = mundo.criaturas;
  switch (c.estado[i]) {
    case Estado.BuscandoComida:
    case Estado.Trabalhando: {
      if (c.destinoX[i] < 0 || chegouAoDestino(c, i)) return false;
      const g = mundo.grid;
      const idx = g.idx(g.prenderX(c.destinoX[i]), g.prenderY(c.destinoY[i]));
      if (g.fogo[idx] > 0) return false;
      // outro pode ter derrubado a árvore, esvaziado o veio ou comido a fruta
      const r = g.recurso[idx];
      if (r !== 0 && g.recursoQtd[idx] > 3) return true;
      return g.vegetacao[idx] >= 30;
    }
    case Estado.Cacando:
    case Estado.Atacando: {
      const alvo = c.alvo[i];
      return alvo >= 0 && c.vivo[alvo] === 1;
    }
    case Estado.Acasalando: {
      // pode estar atrás de um par (bicho) ou a caminho de casa (gente)
      const alvo = c.alvo[i];
      if (alvo >= 0) return c.vivo[alvo] === 1;
      return c.destinoX[i] >= 0 && !chegouAoDestino(c, i);
    }
    case Estado.Voltando:
      return c.aldeia[i] >= 0 && !chegouAoDestino(c, i);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------- cérebros

/** Bicho: foge, come, procura par, vagueia. Nesta ordem. */
const cerebroAnimal: Cerebro = (mundo, i) => {
  const c = mundo.criaturas;
  const esp = c.especie[i];
  const visao = ESP_VISAO[esp];

  const ameaca = mundo.espacial.maisProximo(c, i, visao, aceitaAmeaca);
  if (ameaca >= 0) {
    c.estado[i] = Estado.Fugindo;
    c.alvo[i] = ameaca;
    return;
  }

  // Destemido não recua. Vive menos e leva mais gente junto.
  const recua = (c.tracos[i] & MASCARA_DESTEMIDO) === 0;
  if (recua && c.vida[i] < vidaMaxima(c, i) * BAL.limiarFuga && ESP_AGRESSAO[esp] < 0.7) {
    const perigo = mundo.espacial.maisProximo(c, i, visao, aceitaQuemMeCaca);
    if (perigo >= 0) {
      c.estado[i] = Estado.Fugindo;
      c.alvo[i] = perigo;
      return;
    }
  }

  // não há ameaça: se já estava indo a algum lugar por um bom motivo, vai
  if (objetivoAindaVale(mundo, i)) return;

  // carnívoro sai para caçar antes de estar em apuros: a caçada demora, e
  // esperar o mesmo limiar do herbívoro fazia o predador morrer no caminho
  const limiarComida = BAL.fomeIncomoda * (ESP_HERBIVORO[esp] === 1 ? 1 : 0.62);
  if (c.fome[i] > limiarComida) {
    // com fome, o predador rastreia mais longe do que enxerga; sem isso ele
    // ficava vagando ao lado de uma presa que nunca entrava no campo de visão
    const alcanceCaca = ESP_HERBIVORO[esp] === 1 ? visao : visao * 2;
    const presa = mundo.espacial.maisProximo(c, i, alcanceCaca, aceitaPresa);
    if (presa >= 0) {
      c.estado[i] = Estado.Cacando;
      c.alvo[i] = presa;
      return;
    }
    if (ESP_HERBIVORO[esp] === 1 && acharComidaVegetal(mundo, i, Math.max(6, visao))) return;
  }

  if (podeReproduzir(c, i)) {
    // dois freios: o do mundo inteiro (quantos desta espécie cabem no mapa) e o
    // da vizinhança (quantos cabem por perto). O primeiro é o que define a
    // quantidade de bichos; o segundo é o que os espalha em vez de amontoar.
    const teto = ESP_LOTACAO[esp];
    const lotado =
      mundo.estatisticas.porEspecie[esp] >= mundo.tetoPorEspecie[esp] ||
      mundo.espacial.lotacaoDaEspecie(c, c.x[i], c.y[i], BAL.raioLotacao, esp, teto) > teto;
    if (!lotado) {
      const par = mundo.espacial.maisProximo(c, i, visao, aceitaPar);
      if (par >= 0) {
        c.estado[i] = Estado.Acasalando;
        c.alvo[i] = par;
        return;
      }
    }
  }

  if (ESP_AGRESSAO[esp] > 0.4 && mundo.rng.chance(ESP_AGRESSAO[esp] * 0.08)) {
    const vitima = mundo.espacial.maisProximo(c, i, visao * 0.7, aceitaQualquerVitima);
    if (vitima >= 0) {
      c.estado[i] = Estado.Atacando;
      c.alvo[i] = vitima;
      return;
    }
  }

  if (c.estado[i] !== Estado.Vagando || chegouAoDestino(c, i)) {
    c.alvo[i] = -1;
    vaguear(mundo, i);
  }
};

/** Monstro: não tem medo, não pasta, só procura o que matar. */
const cerebroMonstro: Cerebro = (mundo, i) => {
  const c = mundo.criaturas;
  const esp = c.especie[i];
  const visao = ESP_VISAO[esp];

  if (objetivoAindaVale(mundo, i)) return;

  const vitima = mundo.espacial.maisProximo(c, i, visao, aceitaQualquerVitima);
  if (vitima >= 0) {
    c.estado[i] = c.fome[i] > BAL.fomeIncomoda ? Estado.Cacando : Estado.Atacando;
    c.alvo[i] = vitima;
    return;
  }

  if (podeReproduzir(c, i)) {
    const par = mundo.espacial.maisProximo(c, i, visao, aceitaPar);
    if (par >= 0) {
      c.estado[i] = Estado.Acasalando;
      c.alvo[i] = par;
      return;
    }
  }

  if (c.estado[i] !== Estado.Vagando || chegouAoDestino(c, i)) {
    c.alvo[i] = -1;
    vaguear(mundo, i, 16);
  }
};

/**
 * Ser inteligente: guerra, comida da aldeia, trabalho, família, ronda.
 *
 * A diferença para o bicho não está na esperteza da busca, e sim no que ele
 * quer: o bicho só quer sobreviver e procriar; este aqui pertence a um lugar,
 * junta recurso para uma aldeia, luta pela bandeira dela e vive do estoque
 * comum.
 */
const cerebroInteligente: Cerebro = (mundo, i) => {
  const c = mundo.criaturas;
  const esp = c.especie[i];
  const visao = ESP_VISAO[esp];
  const aldeiaId = c.aldeia[i];
  const aldeia = aldeiaId >= 0 ? mundo.aldeias[aldeiaId] : undefined;

  // 1. ameaça imediata — monstro, predador ou inimigo declarado
  const inimigo = mundo.espacial.maisProximo(c, i, visao, aceitaAmeacaDeCivilizado);
  if (inimigo >= 0) {
    const soldado = (c.marcas[i] & MARCA_SOLDADO) !== 0;
    const inteiro = c.vida[i] > vidaMaxima(c, i) * 0.5;
    // gente enfrenta o que é mais forte quando está acompanhada: contra um
    // tigre, um aldeão sozinho morre, mas quatro dão conta
    const meuDano = ESP_DANO[esp] * ESP_MARCIAL[esp] * fator(c.tracos[i], Campo.dano);
    const superado = ESP_DANO[c.especie[inimigo]] > meuDano * 1.6;
    const acompanhado =
      !superado ||
      mundo.espacial.lotacaoDaEspecie(c, c.x[i], c.y[i], 7, esp, 3) >= 3;

    if (soldado || (inteiro && acompanhado)) {
      c.estado[i] = Estado.Atacando;
      c.alvo[i] = inimigo;
    } else {
      c.estado[i] = Estado.Fugindo;
      c.alvo[i] = inimigo;
    }
    return;
  }

  // sem inimigo por perto: mantém o que já estava fazendo
  if (objetivoAindaVale(mundo, i)) return;

  // 2. soldado sem inimigo à vista marcha para a aldeia inimiga mais próxima
  if ((c.marcas[i] & MARCA_SOLDADO) !== 0 && c.reino[i] >= 0) {
    const meuReino = mundo.reinos[c.reino[i]];
    if (meuReino?.ativo && meuReino.guerras.size > 0) {
      const alvo = mundo.aldeiaMaisProxima(
        c.x[i], c.y[i], 1e9,
        (a) => a.reino !== c.reino[i] && mundo.emGuerra(c.reino[i], a.reino),
      );
      if (alvo >= 0) {
        const a = mundo.aldeias[alvo];
        irPara(c, i, a.x + mundo.rng.intEntre(-2, 2), a.y + mundo.rng.intEntre(-2, 2));
        c.estado[i] = Estado.Atacando;
        c.alvo[i] = -1;
        return;
      }
    }
  }

  // 3. fome: primeiro tenta o celeiro da aldeia
  if (c.fome[i] > BAL.fomeIncomoda) {
    if (aldeia?.ativa && aldeia.estoque.comida > 3) {
      irPara(c, i, aldeia.x, aldeia.y);
      c.estado[i] = Estado.Voltando;
      c.alvo[i] = -1;
      return;
    }
    if (ESP_HERBIVORO[esp] === 1 && acharComidaVegetal(mundo, i, visao)) return;
    if (c.fome[i] > BAL.fomeParaCacar) {
      const presa = mundo.espacial.maisProximo(c, i, visao, aceitaPresa);
      if (presa >= 0) {
        c.estado[i] = Estado.Cacando;
        c.alvo[i] = presa;
        return;
      }
    }
  }

  // 4. família — vem antes do trabalho às vezes, senão nunca acontece: a
  // aldeia sempre precisa de alguma coisa, e o morador voltava ao trabalho sem
  // nunca chegar ao passo seguinte. Casa cheia de gente é o que faz a
  // civilização crescer, então tem de disputar espaço com a lida do dia.
  if (
    aldeia?.ativa &&
    podeReproduzir(c, i) &&
    aldeia.populacao < aldeia.capacidade &&
    mundo.rng.chance(BAL.vontadeDeFamilia)
  ) {
    const casa = acharCasaComVaga(mundo, aldeia, aldeia.raio + 4, c.x[i], c.y[i]);
    if (casa >= 0) {
      if (naPorta(mundo, i, casa)) {
        if (entrar(mundo, i, casa)) return;
      } else {
        irPara(c, i, casa % mundo.grid.largura, (casa / mundo.grid.largura) | 0);
        c.estado[i] = Estado.Acasalando;
        c.alvo[i] = -1;
        return;
      }
    }
  }

  // 5. trabalhar para a aldeia
  if (aldeia?.ativa) {
    if (c.carga[i] >= BAL.cargaTrabalho) {
      irPara(c, i, aldeia.x, aldeia.y);
      c.estado[i] = Estado.Voltando;
      c.alvo[i] = -1;
      return;
    }
    if (c.estado[i] !== Estado.Trabalhando) {
      // vai atrás do que está faltando em casa, e não do que estiver por perto
      const material = oQueFalta(aldeia);
      const alcance = aldeia.raio + BAL.alcanceDeTrabalho;

      if (material === null) {
        // celeiros cheios: ninguém trabalha à toa
      } else if (material === 'comida') {
        // lavoura e coleta de fruta primeiro; caçar é o plano B
        if (acharComidaVegetal(mundo, i, alcance)) {
          c.estado[i] = Estado.Trabalhando;
          return;
        }
        if (procurarRecurso(mundo, i, 'comida', alcance, aldeia.nivel)) return;
        const presa = mundo.espacial.maisProximo(c, i, visao, aceitaPresa);
        if (presa >= 0) {
          c.estado[i] = Estado.Cacando;
          c.alvo[i] = presa;
          return;
        }
      } else if (procurarRecurso(mundo, i, material, alcance, aldeia.nivel)) {
        return;
      }
    }
    if (c.estado[i] === Estado.Trabalhando && !chegouAoDestino(c, i)) return;
  }

  // 6. ronda perto de casa
  if (c.estado[i] !== Estado.Vagando || chegouAoDestino(c, i)) {
    c.alvo[i] = -1;
    if (aldeia?.ativa) {
      const raio = aldeia.raio;
      for (let t = 0; t < 6; t++) {
        const x = mundo.grid.prenderX(aldeia.x + mundo.rng.intEntre(-raio, raio));
        const y = mundo.grid.prenderY(aldeia.y + mundo.rng.intEntre(-raio, raio));
        if (tileServe(mundo, 0, x, y)) {
          irPara(c, i, x, y);
          c.estado[i] = Estado.Vagando;
          return;
        }
      }
    }
    vaguear(mundo, i);
  }
};

export const CEREBROS: Record<string, Cerebro> = {
  animal: cerebroAnimal,
  inteligente: cerebroInteligente,
  monstro: cerebroMonstro,
};

/**
 * Cérebro de cada espécie, resolvido uma vez no boot: dentro do laço, buscar a
 * função por índice de array é imediato; procurar por nome não seria.
 */
const cerebroPorEspecie: Cerebro[] = especies
  .todos()
  .map((e) => CEREBROS[e.cerebro] ?? cerebroAnimal);

/**
 * Sistema de IA: por tick, só uma fatia das criaturas decide.
 *
 * É o que segura o custo: com 4 fatias, cada criatura repensa 5 vezes por
 * segundo, o suficiente para parecer viva, e o custo por tick cai a um quarto.
 */
/**
 * Quantas fatias usar agora. Recalculado de vez em quando: mundo cheio pensa
 * menos vezes por segundo, e é assim que o custo por tick não dispara junto
 * com a população.
 */
let fatiasAtuais: number = BAL.fatiasIA;

export const sistemaIA: Sistema = {
  id: 'ia',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;

    if (mundo.tick % 120 === 0) {
      const alvo = Math.ceil(c.quantidade / 2600);
      fatiasAtuais = Math.max(BAL.fatiasIA, Math.min(BAL.fatiasMaxIA, alvo));
    }
    const fatias = fatiasAtuais;
    const fatia = mundo.tick % fatias;

    _mundo = mundo;
    _c = c;

    for (let i = fatia; i < limite; i += fatias) {
      if (!c.vivo[i]) continue;
      if (c.abrigo[i] >= 0) continue; // está dentro de casa
      // alvo que morreu no meio do caminho não vale mais
      const alvo = c.alvo[i];
      if (alvo >= 0 && !c.vivo[alvo]) c.alvo[i] = -1;

      _eu = i;
      _espEu = c.especie[i];
      cerebroPorEspecie[_espEu](mundo, i);
    }
  },
};
