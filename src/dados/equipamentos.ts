import { Registro, type Definicao } from '../core/registro.js';
import { tecnologias } from './tecnologias.js';
import type { Estoque } from './materiais.js';

/**
 * O que um guerreiro carrega.
 *
 * São três encaixes por criatura — arma, escudo e armadura — guardados como um
 * byte cada no pool. Zero significa "de mãos vazias", então todo bicho do mundo
 * já vem sem equipamento sem custar nada.
 *
 * Equipamento é o que faz a economia importar na guerra: sem ferro não há
 * espada, e sem espada uma aldeia rica em comida ainda perde a batalha.
 */
export type Encaixe = 'arma' | 'escudo' | 'armadura';

export interface Equipamento extends Definicao {
  readonly nome: string;
  readonly encaixe: Encaixe;
  /** Soma ao dano do golpe. */
  readonly dano: number;
  /** Desconta do dano recebido. */
  readonly defesa: number;
  /** Distância de ataque em tiles. Acima de 1,2 vira ataque à distância. */
  readonly alcance: number;
  /** Multiplica a velocidade de quem carrega (armadura pesada atrasa). */
  readonly peso: number;
  /** Custo para a aldeia fabricar uma unidade. */
  readonly custo: Partial<Estoque>;
  /** Nível mínimo da aldeia para saber fazer. */
  readonly nivelMinimo: number;
  /** Cor no sprite, para o equipamento aparecer no desenho. */
  readonly cor: number;
}

export const equipamentos = new Registro<Equipamento>('equipamentos');

equipamentos.registrarTodos([
  // ------------------------------------------------------------------- armas
  {
    id: 'porrete', nome: 'porrete', encaixe: 'arma', dano: 4, defesa: 0, alcance: 0.9,
    peso: 1, custo: { madeira: 6 }, nivelMinimo: 1, cor: 0x7a5a3a,
  },
  {
    id: 'lanca', nome: 'lança', encaixe: 'arma', dano: 9, defesa: 0, alcance: 1.5,
    peso: 0.98, custo: { madeira: 8, ferro: 3 }, nivelMinimo: 2, cor: 0xb8bcc4,
  },
  {
    id: 'espada', nome: 'espada', encaixe: 'arma', dano: 15, defesa: 2, alcance: 1,
    peso: 0.97, custo: { ferro: 10, carvao: 4 }, nivelMinimo: 2, cor: 0xd8dde4,
  },
  {
    id: 'arco', nome: 'arco', encaixe: 'arma', dano: 11, defesa: 0, alcance: 7,
    peso: 1, custo: { madeira: 12 }, nivelMinimo: 2, cor: 0x9a7040,
  },
  {
    id: 'machado', nome: 'machado de guerra', encaixe: 'arma', dano: 21, defesa: 0, alcance: 1,
    peso: 0.93, custo: { ferro: 14, madeira: 8, carvao: 6 }, nivelMinimo: 3, cor: 0xc0c6cf,
  },

  // ----------------------------------------------------------------- escudos
  {
    id: 'escudo_madeira', nome: 'escudo de madeira', encaixe: 'escudo', dano: 0, defesa: 4,
    alcance: 0, peso: 0.98, custo: { madeira: 10 }, nivelMinimo: 1, cor: 0x8a6238,
  },
  {
    id: 'escudo_ferro', nome: 'escudo de ferro', encaixe: 'escudo', dano: 0, defesa: 9,
    alcance: 0, peso: 0.94, custo: { ferro: 12, madeira: 4 }, nivelMinimo: 3, cor: 0xa8aeb8,
  },

  // --------------------------------------------------------------- armaduras
  {
    id: 'couro', nome: 'armadura de couro', encaixe: 'armadura', dano: 0, defesa: 5,
    alcance: 0, peso: 0.98, custo: { comida: 14, madeira: 4 }, nivelMinimo: 1, cor: 0x8c5a34,
  },
  {
    id: 'cota', nome: 'cota de malha', encaixe: 'armadura', dano: 0, defesa: 12,
    alcance: 0, peso: 0.92, custo: { ferro: 16, carvao: 6 }, nivelMinimo: 3, cor: 0x9aa0aa,
  },
  {
    id: 'placas', nome: 'armadura de placas', encaixe: 'armadura', dano: 0, defesa: 20,
    alcance: 0, peso: 0.85, custo: { ferro: 28, carvao: 12, ouro: 4 }, nivelMinimo: 4, cor: 0xc4cad4,
  },
]);

export const EQ = Object.fromEntries(
  equipamentos.todos().map((e) => [e.id, equipamentos.indice(e.id)]),
) as Record<string, number>;

const N = equipamentos.tamanho;

export const EQ_DANO = new Float32Array(N);
export const EQ_DEFESA = new Float32Array(N);
export const EQ_ALCANCE = new Float32Array(N);
export const EQ_PESO = new Float32Array(N);
export const EQ_COR = new Uint32Array(N);
for (let i = 0; i < N; i++) {
  const e = equipamentos.porIndice(i);
  EQ_DANO[i] = e.dano;
  EQ_DEFESA[i] = e.defesa;
  EQ_ALCANCE[i] = e.alcance;
  EQ_PESO[i] = e.peso;
  EQ_COR[i] = e.cor;
}

/** Equipamentos de cada encaixe, do mais fraco para o mais forte. */
export function porEncaixe(encaixe: Encaixe): Equipamento[] {
  return equipamentos
    .filtrar((e) => e.encaixe === encaixe)
    .sort((a, b) => a.dano + a.defesa - (b.dano + b.defesa));
}

/**
 * Que tecnologia libera cada peça, por índice — ou -1 quando ela não depende de
 * nenhuma. Montada do registro de tecnologias, pelo mesmo motivo de
 * `ED_TECNOLOGIA`: uma lista só para manter em dia.
 */
export const EQ_TECNOLOGIA = (() => {
  const a = new Int16Array(equipamentos.tamanho).fill(-1);
  for (const t of tecnologias.todos()) {
    for (const id of t.liberaEquipamentos ?? []) {
      if (equipamentos.talvez(id)) a[equipamentos.indice(id)] = tecnologias.indice(t.id);
    }
  }
  return a;
})();
