import type { Barco } from '../sim/barcos.js';
import { Mundo, TAMANHOS, type Aldeia, type Cla, type Reino } from './mundo.js';
import { biomas } from '../dados/biomas.js';
import { edificios, ED_OCUPA } from '../dados/edificios.js';
import { especies } from '../dados/especies.js';
import { tecnologias } from '../dados/tecnologias.js';
import { recursos } from '../dados/recursos.js';
import { equipamentos } from '../dados/equipamentos.js';
import { estoqueVazio } from '../dados/materiais.js';
import { semearRecursosEmMundoAntigo } from '../sim/geracao.js';

/**
 * Gravar e carregar mundos.
 *
 * O save guarda, junto com os dados, a lista de ids de texto de cada registro
 * (espécies, biomas, edifícios). Ao carregar, os índices são traduzidos pelos
 * ids — então acrescentar, remover ou reordenar conteúdo numa versão futura não
 * transforma todos os lobos em tubarões.
 */
export const VERSAO_SAVE = 2;

interface Empacotado {
  versao: number;
  semente: string;
  tick: number;
  migracao: boolean;
  densidadeFauna: number;
  tamanho: string;
  largura: number;
  altura: number;
  capacidade: number;
  rng: number[];
  vulcoes: number[];
  vento: [number, number];
  /** Fator de preço de cada material, na ordem de `MATERIAIS`. Save antigo não tem. */
  precos?: number[];
  barcos: Barco[];
  registros: {
    especies: string[];
    biomas: string[];
    edificios: string[];
    recursos: string[];
    equipamentos: string[];
  };
  grid: Record<string, string>;
  criaturas: {
    limite: number;
    campos: Record<string, string>;
  };
  aldeias: Aldeia[];
  clas: Cla[];
  reinos: Array<
    Omit<
      Reino,
      'relacoes' | 'guerras' | 'aliancas' | 'conhecidos' | 'rancor' | 'marcoDaGuerra'
      | 'tecnologias'
    > & {
      relacoes: Array<[number, number]>;
      guerras: number[];
      aliancas: number[];
      conhecidos: number[];
      rancor: Array<[number, number]>;
      marcoDaGuerra: Array<[number, number]>;
      tecnologias: number[];
    }
  >;
}

// ------------------------------------------------------------------ base64

function bytesDe(a: ArrayBufferView): Uint8Array {
  return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
}

function paraB64(a: ArrayBufferView): string {
  const b = bytesDe(a);
  if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
  let s = '';
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) {
    s += String.fromCharCode(...b.subarray(i, i + passo));
  }
  return btoa(s);
}

function deB64(texto: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(texto, 'base64'));
  const bin = atob(texto);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

/** Copia os bytes decodificados para dentro de um array tipado já existente. */
function preencher(destino: ArrayBufferView, texto: string | undefined): void {
  if (!texto) return; // campo que não existia no save antigo fica zerado
  const bytes = deB64(texto);
  const alvo = bytesDe(destino);
  alvo.set(bytes.subarray(0, Math.min(bytes.length, alvo.length)));
}

// ------------------------------------------------------------------ gravar

export function empacotar(mundo: Mundo): string {
  const g = mundo.grid;
  const c = mundo.criaturas;

  const dados: Empacotado = {
    versao: VERSAO_SAVE,
    semente: mundo.semente,
    tick: mundo.tick,
    migracao: mundo.migracao,
    densidadeFauna: mundo.densidadeFauna,
    tamanho: mundo.tamanho.id,
    largura: g.largura,
    altura: g.altura,
    capacidade: c.capacidade,
    rng: mundo.rng.estado(),
    vulcoes: mundo.vulcoes,
    vento: [mundo.ventoX, mundo.ventoY],
    precos: Array.from(mundo.precos),
    barcos: mundo.barcos,
    registros: {
      especies: especies.todos().map((e) => e.id),
      biomas: biomas.todos().map((b) => b.id),
      edificios: edificios.todos().map((e) => e.id),
      recursos: recursos.todos().map((r) => r.id),
      equipamentos: equipamentos.todos().map((e) => e.id),
    },
    grid: {
      alt: paraB64(g.alt),
      bioma: paraB64(g.bioma),
      umidade: paraB64(g.umidade),
      temp: paraB64(g.temp),
      vegetacao: paraB64(g.vegetacao),
      fogo: paraB64(g.fogo),
      territorio: paraB64(g.territorio),
      construcao: paraB64(g.construcao),
      aldeiaDona: paraB64(g.aldeiaDona),
      estrada: paraB64(g.estrada),
      recurso: paraB64(g.recurso),
      recursoQtd: paraB64(g.recursoQtd),
      acabamento: paraB64(g.acabamento),
      matiz: paraB64(g.matiz),
    },
    criaturas: {
      limite: c.limite,
      campos: {
        vivo: paraB64(c.vivo),
        especie: paraB64(c.especie),
        x: paraB64(c.x),
        y: paraB64(c.y),
        vida: paraB64(c.vida),
        fome: paraB64(c.fome),
        energia: paraB64(c.energia),
        idade: paraB64(c.idade),
        longevidade: paraB64(c.longevidade),
        estado: paraB64(c.estado),
        alvo: paraB64(c.alvo),
        destinoX: paraB64(c.destinoX),
        destinoY: paraB64(c.destinoY),
        aldeia: paraB64(c.aldeia),
        reino: paraB64(c.reino),
        esperaFilho: paraB64(c.esperaFilho),
        dir: paraB64(c.dir),
        carga: paraB64(c.carga),
        cargaMaterial: paraB64(c.cargaMaterial),
        marcas: paraB64(c.marcas),
        xp: paraB64(c.xp),
        pericia: paraB64(c.pericia),
        cdAtaque: paraB64(c.cdAtaque),
        abrigo: paraB64(c.abrigo),
        tempoAbrigo: paraB64(c.tempoAbrigo),
        arma: paraB64(c.arma),
        escudo: paraB64(c.escudo),
        armadura: paraB64(c.armadura),
        riqueza: paraB64(c.riqueza),
        familia: paraB64(c.familia),
        cla: paraB64(c.cla),
        fidelidade: paraB64(c.fidelidade),
        noticia: paraB64(c.noticia),
        tracos: paraB64(c.tracos),
        geracao: paraB64(c.geracao),
      },
    },
    aldeias: mundo.aldeias,
    clas: mundo.clas,
    reinos: mundo.reinos.map((r) => ({
      ...r,
      relacoes: [...r.relacoes.entries()],
      guerras: [...r.guerras],
      aliancas: [...r.aliancas],
      conhecidos: [...r.conhecidos],
      rancor: [...r.rancor.entries()],
      marcoDaGuerra: [...r.marcoDaGuerra.entries()],
      tecnologias: [...r.tecnologias],
    })),
  };

  return JSON.stringify(dados);
}

// ---------------------------------------------------------------- carregar

export function desempacotar(texto: string): Mundo {
  const d = JSON.parse(texto) as Empacotado;
  if (typeof d.versao !== 'number') throw new Error('Arquivo de mundo irreconhecível.');
  if (d.versao > VERSAO_SAVE) {
    throw new Error(`Este mundo foi salvo numa versão mais nova do jogo (v${d.versao}).`);
  }

  const tamanho =
    TAMANHOS.find((t) => t.id === d.tamanho) ??
    { id: 'personalizado', nome: 'personalizado', largura: d.largura, altura: d.altura, capacidade: d.capacidade };

  const mundo = new Mundo(
    { ...tamanho, largura: d.largura, altura: d.altura, capacidade: d.capacidade },
    d.semente,
  );
  mundo.tick = d.tick;
  // save antigo não tem o campo; o padrão do jogo é com migração ligada
  mundo.migracao = d.migracao ?? true;
  mundo.densidadeFauna = d.densidadeFauna ?? 1;
  mundo.vulcoes = d.vulcoes ?? [];
  mundo.bombas = [];
  // As nuvens não vão para o save: são estado passageiro, e um céu recomeçado
  // limpo não muda nada do mundo. O vento vai, porque define de que lado o
  // tempo chega e isso se nota.
  mundo.nuvens = [];
  // Os barcos vão para o save: uma frota some é uma vila que perdeu o
  // investimento em madeira, e isso o jogador nota.
  mundo.barcos = d.barcos ?? [];
  [mundo.ventoX, mundo.ventoY] = d.vento ?? [0.014, 0.006];
  // O mercado volta com o preço em que estava; save antigo começa no preço base.
  if (Array.isArray(d.precos)) {
    for (let k = 0; k < mundo.precos.length && k < d.precos.length; k++) {
      mundo.precos[k] = Number(d.precos[k]) || 1;
    }
  }
  mundo.definirTetosDeFauna(mundo.densidadeFauna);
  if (Array.isArray(d.rng)) mundo.rng.restaurar(d.rng);

  const g = mundo.grid;
  preencher(g.alt, d.grid.alt);
  preencher(g.bioma, d.grid.bioma);
  preencher(g.umidade, d.grid.umidade);
  preencher(g.temp, d.grid.temp);
  preencher(g.vegetacao, d.grid.vegetacao);
  preencher(g.fogo, d.grid.fogo);
  preencher(g.territorio, d.grid.territorio);
  preencher(g.construcao, d.grid.construcao);
  preencher(g.aldeiaDona, d.grid.aldeiaDona);
  preencher(g.estrada, d.grid.estrada);
  preencher(g.recurso, d.grid.recurso);
  preencher(g.recursoQtd, d.grid.recursoQtd);
  preencher(g.acabamento, d.grid.acabamento);
  preencher(g.matiz, d.grid.matiz);

  const c = mundo.criaturas;
  const campos = d.criaturas.campos;
  preencher(c.vivo, campos.vivo);
  preencher(c.especie, campos.especie);
  preencher(c.x, campos.x);
  preencher(c.y, campos.y);
  preencher(c.vida, campos.vida);
  preencher(c.fome, campos.fome);
  preencher(c.energia, campos.energia);
  preencher(c.idade, campos.idade);
  preencher(c.longevidade, campos.longevidade);
  preencher(c.estado, campos.estado);
  preencher(c.alvo, campos.alvo);
  preencher(c.destinoX, campos.destinoX);
  preencher(c.destinoY, campos.destinoY);
  preencher(c.aldeia, campos.aldeia);
  preencher(c.reino, campos.reino);
  preencher(c.esperaFilho, campos.esperaFilho);
  preencher(c.dir, campos.dir);
  preencher(c.carga, campos.carga);
  preencher(c.cargaMaterial, campos.cargaMaterial);
  preencher(c.marcas, campos.marcas);
  preencher(c.xp, campos.xp);
  preencher(c.pericia, campos.pericia);
  preencher(c.cdAtaque, campos.cdAtaque);
  preencher(c.abrigo, campos.abrigo);
  preencher(c.tempoAbrigo, campos.tempoAbrigo);
  preencher(c.arma, campos.arma);
  preencher(c.escudo, campos.escudo);
  preencher(c.armadura, campos.armadura);
  preencher(c.riqueza, campos.riqueza);
  preencher(c.familia, campos.familia);
  preencher(c.cla, campos.cla);
  preencher(c.fidelidade, campos.fidelidade);
  preencher(c.noticia, campos.noticia);
  preencher(c.tracos, campos.tracos);
  preencher(c.geracao, campos.geracao);
  c.reconstruirDeArrays(d.criaturas.limite);

  // ---------------------------------------- tradução de índices por id de texto
  traduzirEspecies(c, d.registros?.especies);
  traduzirBiomas(g.bioma, d.registros?.biomas);
  traduzirConstrucao(g.construcao, d.registros?.edificios);
  traduzirRecursos(g, d.registros?.recursos);
  traduzirEquipamento(c, d.registros?.equipamentos);

  // Mundo salvo antes de existirem recursos: o mapa viria sem uma árvore
  // sequer, e as civilizações não teriam do que viver. Semeia com a mesma
  // regra da geração.
  if (d.versao < 2) semearRecursosEmMundoAntigo(mundo);

  // `predios` é array tipado e volta do JSON como objeto comum, que não tem
  // `fill`. Em vez de tentar remontar o que foi gravado, a contagem é refeita a
  // partir do mapa — que é a fonte de verdade dela de todo jeito.
  mundo.aldeias = (d.aldeias ?? []).map((a) => ({
    ...a,
    predios: new Int32Array(edificios.tamanho),
    estoque: { ...estoqueVazio(), ...a.estoque },
    // save anterior à fronteira em forma livre não tem fila nenhuma; vazia é o
    // valor certo, porque `refazerFranja` a reconstrói do mapa na primeira
    // passada de expansão
    franja: a.franja ?? [],
    // save anterior às profissões: a contagem é refeita na primeira passada
    oficios: Array.isArray(a.oficios) ? a.oficios : [0, 0, 0, 0, 0, 0, 0, 0],
  }));
  // Save anterior aos clãs: as criaturas carregam números de clã que não
  // apontam para nada. `Mundo.cla()` devolve `undefined` para eles e todo mundo
  // que lê trata isso como "sem clã", que é exatamente o que aquela partida era.
  mundo.clas = d.clas ?? [];
  mundo.proximoCla = mundo.clas.length;
  mundo.reinos = (d.reinos ?? []).map((r) => ({
    ...r,
    relacoes: new Map(r.relacoes ?? []),
    guerras: new Set(r.guerras ?? []),
    aliancas: new Set(r.aliancas ?? []),
    // Mundo salvo antes da névoa: todo mundo já se conhecia, então o mais fiel
    // ao que aquela partida era é dar por conhecido quem já tinha relação,
    // guerra ou aliança registrada.
    conhecidos: new Set(
      r.conhecidos ??
        [...(r.relacoes ?? []).map(([outro]) => outro), ...(r.guerras ?? []), ...(r.aliancas ?? [])],
    ),
    rancor: new Map(r.rancor ?? []),
    marcoDaGuerra: new Map(r.marcoDaGuerra ?? []),
    // Mundo salvo antes da tecnologia: aquele reino sabia fazer tudo, porque o
    // jogo inteiro pressupunha isso. Dar a ele a árvore completa preserva a
    // partida como ela era, em vez de rebaixá-la à idade da pedra no meio do
    // caminho.
    conhecimento: r.conhecimento ?? 0,
    tecnologias: new Set(r.tecnologias ?? tecnologias.todos().map((_t, k) => k)),
  }));

  // fogo: o conjunto é reconstruído a partir do grid
  mundo.chamas.clear();
  for (let i = 0; i < g.total; i++) if (g.fogo[i] > 0) mundo.chamas.add(i);

  // A ocupação do chão é derivada das construções: em vez de gravá-la, é
  // refeita ao carregar. Um campo a menos no arquivo e nada para dessincronizar.
  g.ocupacao.fill(-1);
  for (let i = 0; i < g.total; i++) {
    const c = g.construcao[i];
    if (c === 0) continue;
    g.ocupar(i, ED_OCUPA[(c - 1) * 2], ED_OCUPA[(c - 1) * 2 + 1]);
  }

  for (const a of mundo.aldeias) {
    if (a.ativa) mundo.recalcularCapacidade(a);
  }

  g.marcarTudoSujo();
  mundo.espacial.reconstruir(c);
  mundo.recalcularEstatisticas();
  // quem anuncia o mundo carregado é o `Jogo`, depois de a interface se religar
  // a ele — anunciar aqui seria falar para uma plateia que ainda não existe
  return mundo;
}

/** Traduz espécies pelo id de texto; criatura de espécie sumida é removida. */
function traduzirEspecies(c: Mundo['criaturas'], idsSalvos: string[] | undefined): void {
  if (!idsSalvos) return;
  const mapa = idsSalvos.map((id) => (especies.talvez(id) ? especies.indice(id) : -1));
  let iguais = mapa.length === especies.tamanho;
  for (let i = 0; iguais && i < mapa.length; i++) if (mapa[i] !== i) iguais = false;
  if (iguais) return;

  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    const novo = mapa[c.especie[i]];
    if (novo === undefined || novo < 0) {
      c.remover(i);
      continue;
    }
    c.especie[i] = novo;
  }
}

/** Traduz os biomas do grid pelo id de texto; bioma sumido vira o primeiro. */
function traduzirBiomas(campo: Uint8Array, idsSalvos: string[] | undefined): void {
  if (!idsSalvos) return;
  const mapa = idsSalvos.map((id) => (biomas.talvez(id) ? biomas.indice(id) : 0));
  let iguais = mapa.length === biomas.tamanho;
  for (let i = 0; iguais && i < mapa.length; i++) if (mapa[i] !== i) iguais = false;
  if (iguais) return;
  for (let i = 0; i < campo.length; i++) {
    const novo = mapa[campo[i]];
    campo[i] = novo === undefined || novo < 0 ? 0 : novo;
  }
}

/** Traduz os recursos do grid pelo id de texto. */
function traduzirRecursos(g: Mundo['grid'], idsSalvos: string[] | undefined): void {
  if (!idsSalvos) return;
  const mapa = idsSalvos.map((id) => (recursos.talvez(id) ? recursos.indice(id) : -1));
  let iguais = mapa.length === recursos.tamanho;
  for (let i = 0; iguais && i < mapa.length; i++) if (mapa[i] !== i) iguais = false;
  if (iguais) return;
  for (let i = 0; i < g.recurso.length; i++) {
    if (g.recurso[i] === 0) continue;
    const novo = mapa[g.recurso[i] - 1];
    if (novo === undefined || novo < 0) {
      g.recurso[i] = 0;
      g.recursoQtd[i] = 0;
    } else {
      g.recurso[i] = novo + 1;
    }
  }
}

/**
 * Traduz os três encaixes de equipamento pelo id de texto. Sem isto, inserir
 * uma arma no meio do registro trocaria a espada de todo mundo por outra coisa
 * ao abrir um mundo antigo.
 */
function traduzirEquipamento(c: Mundo['criaturas'], idsSalvos: string[] | undefined): void {
  if (!idsSalvos) return;
  const mapa = idsSalvos.map((id) => (equipamentos.talvez(id) ? equipamentos.indice(id) : -1));
  let iguais = mapa.length === equipamentos.tamanho;
  for (let i = 0; iguais && i < mapa.length; i++) if (mapa[i] !== i) iguais = false;
  if (iguais) return;

  for (const campo of [c.arma, c.escudo, c.armadura]) {
    for (let i = 0; i < c.limite; i++) {
      if (campo[i] === 0) continue;
      const novo = mapa[campo[i] - 1];
      campo[i] = novo === undefined || novo < 0 ? 0 : novo + 1;
    }
  }
}

function traduzirConstrucao(campo: Uint8Array, idsSalvos: string[] | undefined): void {
  if (!idsSalvos) return;
  const mapa = idsSalvos.map((id) => (edificios.talvez(id) ? edificios.indice(id) : -1));
  let iguais = mapa.length === edificios.tamanho;
  for (let i = 0; iguais && i < mapa.length; i++) if (mapa[i] !== i) iguais = false;
  if (iguais) return;
  for (let i = 0; i < campo.length; i++) {
    if (campo[i] === 0) continue;
    const novo = mapa[campo[i] - 1];
    campo[i] = novo === undefined || novo < 0 ? 0 : novo + 1;
  }
}
