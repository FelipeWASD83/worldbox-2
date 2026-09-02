/**
 * Os materiais que circulam na economia.
 *
 * São poucos e fixos de propósito: viram campos no estoque de cada aldeia
 * (`Aldeia.estoque`), e um punhado de nomes conhecidos é mais barato e mais
 * legível do que um mapa genérico consultado a cada tick.
 */
export const MATERIAIS = [
  'comida',
  'madeira',
  'pedra',
  'ferro',
  'carvao',
  'cobre',
  'estanho',
  'ouro',
  'gema',
] as const;

export type Material = (typeof MATERIAIS)[number];

export const NOME_MATERIAL: Record<Material, string> = {
  comida: 'comida',
  madeira: 'madeira',
  pedra: 'pedra',
  ferro: 'ferro',
  carvao: 'carvão',
  cobre: 'cobre',
  estanho: 'estanho',
  ouro: 'ouro',
  gema: 'gemas',
};

/** Quanto vale uma unidade em ouro. Base do comércio entre aldeias. */
export const VALOR_MATERIAL: Record<Material, number> = {
  comida: 0.35,
  madeira: 0.5,
  pedra: 0.6,
  ferro: 2.2,
  carvao: 1.1,
  cobre: 1.6,
  estanho: 1.9,
  ouro: 1,
  gema: 6,
};

/** Estoque de uma aldeia. Material novo entra aqui e em `MATERIAIS`. */
export type Estoque = Record<Material, number>;

export function estoqueVazio(): Estoque {
  return {
    comida: 0, madeira: 0, pedra: 0, ferro: 0, carvao: 0,
    cobre: 0, estanho: 0, ouro: 0, gema: 0,
  };
}
