import type { Rng } from '../core/rng.js';

/**
 * Nomes procedurais por povo. Cada cultura tem seu conjunto de sílabas, então
 * um reino anão não sai com cara de reino élfico.
 */
interface Silabario {
  readonly inicio: readonly string[];
  readonly meio: readonly string[];
  readonly fim: readonly string[];
  readonly titulosReino: readonly string[];
}

const SILABARIOS: Record<string, Silabario> = {
  humano: {
    inicio: ['Bel', 'Cor', 'Val', 'Mar', 'Ald', 'Ser', 'Ost', 'Ven', 'Bran', 'Tor', 'Ram', 'Gal'],
    meio: ['a', 'e', 'i', 'o', 'an', 'en', 'or', 'ar', 'ir'],
    fim: ['dor', 'gard', 'ne', 'via', 'stad', 'mar', 'lia', 'ton', 'ria', 'burgo'],
    titulosReino: ['Reino de', 'Coroa de', 'Ducado de', 'Domínio de'],
  },
  elfo: {
    inicio: ['Ael', 'Lai', 'Sil', 'Thae', 'Yl', 'Nae', 'Vae', 'Eli', 'Fae', 'Cae'],
    meio: ['la', 'ri', 'the', 'na', 'lu', 'sha', 'wen', 'ea'],
    fim: ['riel', 'thil', 'wen', 'dor', 'las', 'mir', 'anor', 'liel'],
    titulosReino: ['Bosque de', 'Reino de', 'Canto de', 'Refúgio de'],
  },
  anao: {
    inicio: ['Kaz', 'Dur', 'Grim', 'Bar', 'Thor', 'Nor', 'Brod', 'Ur', 'Kald', 'Gron'],
    meio: ['a', 'u', 'ok', 'ar', 'un', 'ad'],
    fim: ['dum', 'grim', 'heim', 'stad', 'rok', 'bard', 'delve', 'forja'],
    titulosReino: ['Clã', 'Fortaleza de', 'Salões de', 'Forja de'],
  },
  orc: {
    inicio: ['Gor', 'Uzg', 'Mor', 'Kra', 'Zug', 'Nak', 'Brak', 'Dro', 'Sha', 'Wur'],
    meio: ['ag', 'uk', 'or', 'zh', 'ar', 'ug'],
    fim: ['nak', 'grod', 'thar', 'zul', 'gash', 'mor', 'krul', 'dun'],
    titulosReino: ['Horda', 'Bando de', 'Tribo', 'Império de'],
  },
};

const PADRAO = SILABARIOS.humano;

function silabario(especieId: string): Silabario {
  return SILABARIOS[especieId] ?? PADRAO;
}

/** Nome de aldeia/cidade. */
export function nomeDeAldeia(rng: Rng, especieId: string): string {
  const s = silabario(especieId);
  const partes = rng.chance(0.45)
    ? [rng.escolher(s.inicio), rng.escolher(s.fim)]
    : [rng.escolher(s.inicio), rng.escolher(s.meio), rng.escolher(s.fim)];
  return partes.join('');
}

/** Nome de reino, já com o título do povo. */
export function nomeDeReino(rng: Rng, especieId: string): string {
  const s = silabario(especieId);
  return `${rng.escolher(s.titulosReino)} ${nomeDeAldeia(rng, especieId)}`;
}

/** Nome próprio de uma criatura civilizada. */
export function nomeProprio(rng: Rng, especieId: string): string {
  const s = silabario(especieId);
  return rng.escolher(s.inicio) + rng.escolher(s.meio) + rng.escolher(s.fim).slice(0, 3);
}
