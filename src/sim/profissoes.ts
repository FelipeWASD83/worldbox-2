import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import type { Criaturas } from '../core/criaturas.js';
import { Estado, MARCA_SOLDADO, OFICIO_DESLOCAMENTO, OFICIO_MASCARA } from '../core/criaturas.js';
import { ESP_INTELIGENTE } from '../dados/especies.js';
import { ED, ED_MAXIMO } from '../dados/edificios.js';
import type { Material } from '../dados/materiais.js';
import { materialPorIndice, oQueFalta } from './coleta.js';
import { focoDe } from './comandos.js';
import { BAL } from './balanco.js';

/**
 * Profissões: cada adulto de uma vila tem um ofício.
 *
 * Antes daqui, todo morador era o mesmo trabalhador genérico: saía atrás do
 * que mais faltava no celeiro (`oQueFalta`) e voltava. Funcionava, mas a vila
 * inteira largava a mata para correr atrás de comida na mesma hora, e não havia
 * diferença entre quem cortou árvore a vida toda e quem pegou o machado ontem.
 *
 * Agora há dois tipos de ofício:
 *
 * - **os de fora** (lavrador, lenhador, mineiro) buscam o material do ofício
 *   e entregam mais quanto mais perícia têm. Quando o material deles sobra no
 *   celeiro, ajudam no que falta — ninguém fica parado com a vila precisando;
 * - **os de casa** (construtor, ferreiro, mercador, estudioso) trabalham na
 *   vila, e o efeito é sobre ela inteira: obra mais rápida, equipamento mais
 *   barato, mais negócios fechados, mais conhecimento para o reino.
 *
 * A fome passa por cima de tudo: com o celeiro abaixo do mínimo, todo mundo vai
 * buscar comida, de que ofício for.
 *
 * Quem decide quantos de cada é a vila, de `BAL.intervaloProfissoes` em
 * `BAL.intervaloProfissoes` ticks, pelo que ela precisa agora e pelo foco que o
 * jogador mandou. A troca é aos poucos — só muda de ofício quem está sobrando
 * no dele —, e quem troca perde dois terços da perícia.
 *
 * O soldado não é ofício: é a mobilização de quem tem ofício, enquanto durar a
 * guerra (`MARCA_SOLDADO`). Terminada a guerra, ele volta à lida que tinha.
 */

export const enum Oficio {
  Nenhum = 0,
  Lavrador = 1,
  Lenhador = 2,
  Mineiro = 3,
  Construtor = 4,
  Ferreiro = 5,
  Mercador = 6,
  Estudioso = 7,
}

export const TOTAL_OFICIOS = 8;

export const NOME_OFICIO = [
  'sem ofício', 'lavrador', 'lenhador', 'mineiro',
  'construtor', 'ferreiro', 'mercador', 'estudioso',
] as const;

export function oficioDe(c: Criaturas, i: number): number {
  return (c.marcas[i] & OFICIO_MASCARA) >> OFICIO_DESLOCAMENTO;
}

export function darOficio(c: Criaturas, i: number, oficio: number): void {
  c.marcas[i] = (c.marcas[i] & ~OFICIO_MASCARA) | ((oficio & 7) << OFICIO_DESLOCAMENTO);
}

/** O ofício trabalha fora, buscando material? */
export function ehOficioDeFora(oficio: number): boolean {
  return oficio >= Oficio.Lavrador && oficio <= Oficio.Mineiro;
}

/** O material que cada ofício de fora traz, para o bônus de perícia na entrega. */
export function materialDoOficio(oficio: number, m: Material): boolean {
  switch (oficio) {
    case Oficio.Lavrador: return m === 'comida';
    case Oficio.Lenhador: return m === 'madeira';
    case Oficio.Mineiro: return m !== 'comida' && m !== 'madeira';
    default: return false;
  }
}

/**
 * O que um trabalhador daquele ofício sai para buscar agora.
 *
 * É a pergunta que `oQueFalta` responde para a vila, feita para uma pessoa.
 * As duas leituras têm de concordar sobre o que é urgente — por isso a fome
 * vem primeiro aqui também —, e quem enche a carga no caminho (a coleta de
 * fruta em `ecologia.ts`) pergunta **esta** função, não a da vila: senão o
 * lenhador colheria capim no caminho da mata por a vila querer comida.
 */
export function oQueBuscar(a: Aldeia, oficio: number): Material | null {
  const pop = Math.max(1, a.populacao);
  const teto = a.capacidadeEstoque;
  // fome: todo mundo vai buscar comida
  if (a.estoque.comida < pop * 6 + 25) return 'comida';

  // O ofício de fora busca o material dele até o dobro do mínimo da vila, e
  // não só até o mínimo: com o mínimo, o lenhador largava a mata assim que
  // havia madeira para a semana, ia ajudar na roça e nunca ganhava perícia.
  // Também não vai até encher o celeiro: assim ele passava a vida inteira na
  // lida, nunca sobrava tempo para entrar em casa, e os filhos nascidos em
  // casa caíram abaixo dos imigrantes (medido em doze sementes).
  switch (oficio) {
    case Oficio.Lavrador:
      if (a.estoque.comida < Math.min(teto * 0.9, pop * 24 + 120)) return 'comida';
      break;
    case Oficio.Lenhador:
      if (a.estoque.madeira < Math.min(teto * 0.85, pop * 12 + 80)) return 'madeira';
      break;
    case Oficio.Mineiro: {
      if (a.nivel < 2) break;
      if (a.estoque.pedra < Math.min(teto * 0.8, pop * 8 + 60)) return 'pedra';
      if (a.estoque.ferro < Math.min(teto * 0.6, pop * 4 + 30)) return 'ferro';
      if (a.estoque.carvao < Math.min(teto * 0.6, pop * 3 + 20)) return 'carvao';
      if (a.nivel >= 3 && a.estoque.ouro < Math.min(a.tetoOuro, pop * 2)) return 'ouro';
      break;
    }
    case Oficio.Nenhum:
      return oQueFalta(a);
    default:
      // ofício de casa: só sai quando a vila está com fome (acima)
      return null;
  }
  // o material do ofício está em dia: ajuda no que falta
  return oQueFalta(a);
}

/**
 * Quantos de cada ofício a vila quer, dados os adultos que tem.
 *
 * Os de casa saem primeiro, cada um condicionado ao prédio que lhe dá onde
 * trabalhar (sem ferraria não há ferreiro, sem mercado não há mercador). O
 * resto é repartido entre os três de fora pelo que falta no celeiro e pelo
 * foco do jogador.
 */
export function cotasDaVila(a: Aldeia, adultos: number, saida: Float64Array): void {
  saida.fill(0);
  if (adultos <= 0) return;
  const pop = Math.max(1, a.populacao);
  let resto = adultos;
  const reservar = (oficio: number, quantos: number): void => {
    const n = Math.max(0, Math.min(resto, Math.floor(quantos)));
    saida[oficio] = n;
    resto -= n;
  };

  if (adultos >= 5) reservar(Oficio.Construtor, Math.max(1, adultos * BAL.fatiaConstrutores));
  const ferrarias = Math.min(a.predios[ED.ferraria], ED_MAXIMO[ED.ferraria]);
  if (ferrarias > 0) {
    reservar(Oficio.Ferreiro, Math.min(
      ferrarias * BAL.maxFerreirosPorFerraria,
      Math.max(1, adultos * BAL.fatiaFerreiros),
    ));
  }
  if (a.predios[ED.mercado] > 0) {
    reservar(Oficio.Mercador, Math.min(BAL.maxMercadores, Math.max(1, adultos * BAL.fatiaMercadores)));
  }
  const casasDeSaber = a.predios[ED.biblioteca] * BAL.estudiososPorBiblioteca
    + a.predios[ED.prefeitura] + a.predios[ED.templo];
  if (casasDeSaber > 0) {
    reservar(Oficio.Estudioso, Math.min(casasDeSaber, Math.max(1, adultos * BAL.fatiaEstudiosos)));
  }

  // Os de fora, pelo que falta. Cada peso tem uma base (a vila sempre precisa
  // um pouco de tudo) e cresce com o buraco no celeiro.
  const falta = (tem: number, quer: number): number => Math.max(0, 1 - tem / Math.max(1, quer));
  const foco = focoDe(a);
  let pC = 1 + 3 * falta(a.estoque.comida, pop * 12 + 60) + (foco === 'comida' ? 2 : 0);
  let pM = 0.7 + 2 * falta(a.estoque.madeira, pop * 6 + 40) + (foco === 'obras' ? 1.2 : 0);
  let pP = 0;
  if (a.nivel >= 2) {
    // O ferro pesa pouco: ele falta quase sempre (só serve para equipamento),
    // e com peso cheio a vila mandava metade da gente para uma mina que não
    // achava veio.
    pP = 0.4 + 1.2 * falta(a.estoque.pedra, pop * 4 + 25)
      + 0.4 * falta(a.estoque.ferro, pop * 3 + 20)
      + (foco === 'exercito' ? 1.2 : 0) + (foco === 'obras' ? 0.6 : 0);
  }
  const soma = pC + pM + pP;
  pC /= soma;
  pM /= soma;
  pP /= soma;
  const nM = Math.round(resto * pM);
  const nP = Math.round(resto * pP);
  saida[Oficio.Lenhador] = nM;
  saida[Oficio.Mineiro] = nP;
  saida[Oficio.Lavrador] = Math.max(0, resto - nM - nP);
}

/** Buffers reaproveitados entre passadas. */
let _contagem = new Int32Array(0);
let _adultos = new Int32Array(0);
const _cota = new Float64Array(TOTAL_OFICIOS);

export const sistemaProfissoes: Sistema = {
  id: 'profissoes',
  intervalo: BAL.intervaloProfissoes,
  executar(mundo: Mundo): void {
    redistribuir(mundo);
  },
};

/**
 * Conta, decide e troca, em duas varreduras do pool.
 *
 * Nada de laço por vila varrendo o pool atrás dos moradores dela (a lição de
 * `cultura.ts`): a contagem vai numa tabela indexada por id de aldeia, e cada
 * criatura é olhada duas vezes no total, não uma vez por vila.
 */
export function redistribuir(mundo: Mundo): void {
  const c = mundo.criaturas;
  const nAldeias = mundo.aldeias.length;
  if (_contagem.length < nAldeias * TOTAL_OFICIOS) {
    _contagem = new Int32Array(nAldeias * TOTAL_OFICIOS * 2);
    _adultos = new Int32Array(nAldeias * 2);
  }
  _contagem.fill(0, 0, nAldeias * TOTAL_OFICIOS);
  _adultos.fill(0, 0, nAldeias);

  // 1. quem é adulto, e no que trabalha hoje
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || ESP_INTELIGENTE[c.especie[i]] === 0) continue;
    const id = c.aldeia[i];
    if (id < 0 || !mundo.aldeias[id]?.ativa) {
      if (oficioDe(c, i) !== Oficio.Nenhum) darOficio(c, i, Oficio.Nenhum);
      continue;
    }
    if (c.idade[i] < c.longevidade[i] * BAL.fracaoAdulto) {
      if (oficioDe(c, i) !== Oficio.Nenhum) darOficio(c, i, Oficio.Nenhum);
      continue;
    }
    _adultos[id]++;
    _contagem[id * TOTAL_OFICIOS + oficioDe(c, i)]++;
    // O quartel é onde o soldado treina: a experiência que só a luta dava
    // passa a vir também do pátio, até o mesmo teto da veterania.
    if ((c.marcas[i] & MARCA_SOLDADO) !== 0 && mundo.aldeias[id].predios[ED.quartel] > 0) {
      c.xp[i] = Math.min(25, c.xp[i] + BAL.treinoNoQuartel);
    }
  }

  // 2. as cotas de cada vila, guardadas numa tabela do mesmo jeito
  const cotas = new Float64Array(nAldeias * TOTAL_OFICIOS);
  for (const a of mundo.aldeias) {
    if (!a.ativa) continue;
    cotasDaVila(a, _adultos[a.id], _cota);
    cotas.set(_cota, a.id * TOTAL_OFICIOS);
  }

  // 3. quem sobra no ofício (ou não tem nenhum) vai para o que mais falta
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || ESP_INTELIGENTE[c.especie[i]] === 0) continue;
    const id = c.aldeia[i];
    if (id < 0 || _adultos[id] === 0) continue;
    if (c.idade[i] < c.longevidade[i] * BAL.fracaoAdulto) continue;
    const base = id * TOTAL_OFICIOS;
    const atual = oficioDe(c, i);

    // Folga antes de tirar alguém do ofício: a cota anda com o celeiro, e sem
    // ela a vila trocava o lenhador de lugar a cada oscilação da madeira —
    // ninguém ficava tempo bastante num ofício para aprender nada.
    const cota = cotas[base + atual];
    if (atual !== Oficio.Nenhum && _contagem[base + atual] <= cota + Math.max(1, cota * 0.25)) {
      // No lugar certo, aprende fazendo: o ofício de casa ganha perícia só por
      // estar nele, e o de fora, por estar na lida do próprio material. A
      // entrega no celeiro dá mais (`sistemaMoradores`), mas uma viagem até a
      // mata leva centenas de ticks e só a entrega não bastava para ninguém
      // passar de aprendiz.
      if ((c.marcas[i] & MARCA_SOLDADO) === 0) {
        const naLida = !ehOficioDeFora(atual) || (
          c.estado[i] === Estado.Trabalhando &&
          materialDoOficio(atual, materialPorIndice(c.cargaMaterial[i]))
        );
        if (naLida) c.pericia[i] = Math.min(1, c.pericia[i] + BAL.periciaPorPassada);
      }
      continue;
    }

    let melhor = -1;
    let maiorFalta = atual === Oficio.Nenhum ? 0 : 0.999;
    for (let o = 1; o < TOTAL_OFICIOS; o++) {
      const f = cotas[base + o] - _contagem[base + o];
      if (f > maiorFalta) {
        maiorFalta = f;
        melhor = o;
      }
    }
    if (melhor < 0) continue;
    if (atual !== Oficio.Nenhum && !mundo.rng.chance(1 - c.pericia[i] * BAL.apegoAoOficio)) continue;
    if (atual !== Oficio.Nenhum) {
      _contagem[base + atual]--;
      c.pericia[i] *= BAL.periciaAoTrocar;
    }
    _contagem[base + melhor]++;
    darOficio(c, i, melhor);
  }

  // 4. a vila fica sabendo quantos tem de cada, para os outros sistemas
  for (const a of mundo.aldeias) {
    if (!a.ativa) continue;
    const base = a.id * TOTAL_OFICIOS;
    for (let o = 0; o < TOTAL_OFICIOS; o++) a.oficios[o] = _contagem[base + o];
  }
}

/**
 * Força dos ofícios de casa numa vila: a soma da perícia de quem o exerce.
 *
 * Contada por varredura do pool porque só quem precisa pergunta, e raramente:
 * o conhecimento a cada 200 ticks, o comércio a cada 120. As obras perguntam
 * `a.oficios`, que é a contagem pura e já está pronta.
 */
export function forcaDoOficio(mundo: Mundo, oficio: number, porAldeia: Float64Array): void {
  porAldeia.fill(0);
  const c = mundo.criaturas;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] < 0) continue;
    if (oficioDe(c, i) !== oficio) continue;
    if (c.aldeia[i] < porAldeia.length) porAldeia[c.aldeia[i]] += 0.5 + c.pericia[i] * 0.5;
  }
}
