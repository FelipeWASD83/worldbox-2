import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { MATERIAIS, VALOR_MATERIAL, type Material } from '../dados/materiais.js';
import { temMercado } from './civilizacao.js';
import { BAL } from './balanco.js';

/**
 * Comércio entre aldeias.
 *
 * Quem tem mercado vende o que sobra e compra o que falta, pagando em ouro. O
 * parceiro pode ser outra aldeia do mesmo reino ou de um reino aliado — nunca
 * de um inimigo.
 *
 * É o que dá função ao ouro e faz a geografia importar: uma aldeia na montanha
 * tem ferro e nenhuma lavoura, e sobrevive vendendo minério para a aldeia da
 * planície. Sem comércio, cada aldeia teria de achar tudo dentro do próprio
 * território ou definhar.
 */
export const sistemaEconomia: Sistema = {
  id: 'economia',
  intervalo: BAL.intervaloComercio,
  executar(mundo: Mundo): void {
    const comerciantes = mundo.aldeias.filter((a) => a.ativa && temMercado(a));
    if (comerciantes.length < 2) return;

    // Antes de negociar entre si, cada praça escoa o excedente para fora do
    // mapa. Sem esta entrada, o ouro só existiria se já existisse: ninguém
    // teria com que fazer a primeira compra e o comércio nunca começava.
    for (const a of comerciantes) venderParaFora(a);

    for (const compradora of comerciantes) {
      const querido = oQueComprar(compradora);
      if (!querido) continue;

      const vendedora = acharVendedora(mundo, compradora, querido, comerciantes);
      if (!vendedora) continue;

      negociar(mundo, compradora, vendedora, querido);
    }
  },
};

/** Escoa o que sobra para caravanas de fora e recebe ouro por isso. */
function venderParaFora(a: Aldeia): void {
  for (const m of MATERIAIS) {
    if (m === 'ouro') continue;
    const sobra = a.estoque[m] - necessidade(a, m) * BAL.folgaParaExportar;
    if (sobra < BAL.loteComercio) continue;
    const lote = Math.min(sobra, BAL.loteComercio * 2);
    a.estoque[m] -= lote;
    a.estoque.ouro = Math.min(
      a.capacidadeEstoque,
      a.estoque.ouro + lote * VALOR_MATERIAL[m] * BAL.precoExportacao,
    );
  }
}

/** O material em falta que a aldeia pagaria para ter. */
function oQueComprar(a: Aldeia): Material | null {
  if (a.estoque.ouro < 6) return null; // sem dinheiro não há compra
  let pior: Material | null = null;
  let menorSobra = Infinity;
  for (const m of MATERIAIS) {
    if (m === 'ouro') continue;
    const precisa = necessidade(a, m);
    const sobra = a.estoque[m] - precisa;
    if (sobra < 0 && sobra < menorSobra) {
      menorSobra = sobra;
      pior = m;
    }
  }
  return pior;
}

/** Quanto daquele material a aldeia considera o mínimo confortável. */
function necessidade(a: Aldeia, m: Material): number {
  const pop = Math.max(1, a.populacao);
  switch (m) {
    case 'comida': return pop * 10 + 40;
    case 'madeira': return pop * 5 + 30;
    case 'pedra': return pop * 3 + 20;
    case 'ferro': return pop * 2 + 14;
    case 'carvao': return pop * 1.5 + 10;
    default: return 0;
  }
}

/** A aldeia amiga mais próxima que tenha excedente do que se procura. */
function acharVendedora(
  mundo: Mundo,
  compradora: Aldeia,
  material: Material,
  candidatas: Aldeia[],
): Aldeia | null {
  let melhor: Aldeia | null = null;
  let melhorDist = BAL.alcanceComercio * BAL.alcanceComercio;

  for (const outra of candidatas) {
    if (outra.id === compradora.id) continue;
    if (!podemComerciar(mundo, compradora, outra)) continue;
    if (outra.estoque[material] - necessidade(outra, material) < BAL.loteComercio) continue;
    const dx = outra.x - compradora.x;
    const dy = outra.y - compradora.y;
    const d = dx * dx + dy * dy;
    if (d < melhorDist) {
      melhorDist = d;
      melhor = outra;
    }
  }
  return melhor;
}

/** Mesmo reino, ou reinos que se declararam aliados. */
function podemComerciar(mundo: Mundo, a: Aldeia, b: Aldeia): boolean {
  if (a.reino === b.reino) return true;
  if (mundo.emGuerra(a.reino, b.reino)) return false;
  return mundo.saoAliados(a.reino, b.reino);
}

function negociar(mundo: Mundo, compradora: Aldeia, vendedora: Aldeia, material: Material): void {
  const lote = BAL.loteComercio;
  const preco = lote * VALOR_MATERIAL[material] * BAL.margemComercio;
  if (compradora.estoque.ouro < preco) return;

  compradora.estoque.ouro -= preco;
  vendedora.estoque.ouro = Math.min(vendedora.capacidadeEstoque, vendedora.estoque.ouro + preco);
  vendedora.estoque[material] -= lote;
  compradora.estoque[material] = Math.min(
    compradora.capacidadeEstoque,
    compradora.estoque[material] + lote,
  );

  // negócio fechado aproxima os povos
  if (compradora.reino !== vendedora.reino) {
    mundo.mudarRelacao(compradora.reino, vendedora.reino, BAL.amizadePorNegocio);
  }
  compradora.moral = Math.min(100, compradora.moral + 0.3);
  vendedora.moral = Math.min(100, vendedora.moral + 0.3);
  mundo.eventos.emitir('comercio:feito', {
    de: vendedora.id,
    para: compradora.id,
    material,
    quanto: lote,
    preco,
  });
}
