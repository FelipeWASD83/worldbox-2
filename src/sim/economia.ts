import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { MATERIAIS, VALOR_MATERIAL, type Material } from '../dados/materiais.js';
import { ED } from '../dados/edificios.js';
import { temMercado } from './civilizacao.js';
import { BAL } from './balanco.js';

/** Posição de cada material em `MATERIAIS` (e em `Mundo.precos`). */
const IDX = Object.fromEntries(MATERIAIS.map((m, k) => [m, k])) as Record<Material, number>;

/** O preço de uma unidade agora, em ouro: o valor base vezes o fator do mercado. */
export function precoDe(mundo: Mundo, m: Material): number {
  return VALOR_MATERIAL[m] * mundo.precos[IDX[m]];
}

/** O fator de mercado de um material (1 = preço base). */
export function fatorDePreco(mundo: Mundo, m: Material): number {
  return mundo.precos[IDX[m]];
}

function mexerNoPreco(mundo: Mundo, m: Material, vezes: number): void {
  const k = IDX[m];
  mundo.precos[k] = Math.min(BAL.precoMaximo, Math.max(BAL.precoMinimo, mundo.precos[k] * vezes));
}

function temBanco(a: Aldeia): boolean {
  return a.predios[ED.banco] > 0;
}

/**
 * Comércio entre aldeias.
 *
 * Quem tem mercado vende o que sobra e compra o que falta, pagando em ouro. O
 * parceiro pode ser outra aldeia do mesmo reino, de um aliado, ou de **qualquer
 * reino que já se conheça e com quem não haja guerra nem ódio aberto** — antes
 * era só aliado, e como aliança é rara, o comércio entre povos praticamente não
 * existia. Negociar é o caminho normal de dois vizinhos que se toleram, e é por
 * ele que a relação sobe até dar em aliança, e não o contrário.
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
    // Quem tem mercado é quem **puxa** o comércio: monta a caravana, paga e
    // traz de volta. Quem vende não precisa de mercado nenhum — basta ter
    // sobra e estar ao alcance.
    //
    // Exigir mercado nos dois lados era o que mantinha o comércio no papel:
    // mercado pede vila de nível 3, e num mundo de trinta povoados havia dois.
    // Dois mercados que por acaso fossem de reinos em guerra, ou que nem se
    // conhecessem, davam zero negócios em vinte mil ticks.
    const vendedoras = mundo.aldeias.filter((a) => a.ativa);
    // O mercado se mexe mesmo num mundo sem praça nenhuma: a procura é de quem
    // precisa, não de quem tem mercado, e o preço da comida de uma época de
    // fome sobe com ou sem caravana.
    ajustarPrecos(mundo, vendedoras);
    renderJuros(mundo, vendedoras);

    const feirantes = vendedoras.filter((a) => temMercado(a));
    if (feirantes.length === 0) return;

    // Antes de negociar, cada praça escoa o excedente para fora do mapa. Sem
    // esta entrada, o ouro só existiria se já existisse: ninguém teria com que
    // fazer a primeira compra e o comércio nunca começava.
    for (const a of feirantes) venderParaFora(mundo, a);

    for (const compradora of feirantes) {
      const querido = oQueComprar(compradora);
      if (!querido) continue;

      const vendedora = acharVendedora(mundo, compradora, querido, vendedoras);
      if (!vendedora) continue;

      negociar(mundo, compradora, vendedora, querido);
    }
  },
};

/**
 * Oferta e procura: o preço de cada material anda na direção do que o mundo
 * pede.
 *
 * Procura é quantas vilas estão abaixo do mínimo confortável daquele material;
 * oferta, quantas têm sobra para vender um lote. O alvo é a raiz da razão, e o
 * preço anda só uma fração do caminho por rodada — mercado que salta para o
 * alvo na hora vira um número piscando, e o jogador não lê tendência nenhuma.
 */
function ajustarPrecos(mundo: Mundo, aldeias: Aldeia[]): void {
  for (const m of MATERIAIS) {
    if (m === 'ouro') continue; // é a moeda: o preço dele é sempre 1
    let procura = 0;
    let oferta = 0;
    for (const a of aldeias) {
      const sobra = a.estoque[m] - necessidade(a, m);
      if (sobra < 0 && necessidade(a, m) > 0) procura++;
      else if (sobra >= BAL.loteComercio) oferta++;
    }
    const alvo = Math.min(
      BAL.precoMaximo,
      Math.max(BAL.precoMinimo, Math.sqrt((procura + 1) / (oferta + 1))),
    );
    const k = IDX[m];
    mundo.precos[k] += (alvo - mundo.precos[k]) * BAL.mareDoPreco;
  }
}

/**
 * O banco rende.
 *
 * Juros sobre o ouro guardado na vila que tem banco, e sobre o tesouro do reino
 * que tem banco em alguma vila. É dinheiro que nasce do dinheiro, e por isso é
 * pouco: um ponto e pouco por rodada de comércio.
 */
function renderJuros(mundo: Mundo, aldeias: Aldeia[]): void {
  const reinosComBanco = new Set<number>();
  for (const a of aldeias) {
    if (!temBanco(a)) continue;
    reinosComBanco.add(a.reino);
    a.estoque.ouro = Math.min(a.tetoOuro, a.estoque.ouro * (1 + BAL.jurosDoBanco));
  }
  for (const id of reinosComBanco) {
    const r = mundo.reinos[id];
    if (r?.ativo) r.tesouro *= 1 + BAL.jurosDoTesouro;
  }
}

/** Escoa o que sobra para caravanas de fora e recebe ouro por isso. */
function venderParaFora(mundo: Mundo, a: Aldeia): void {
  for (const m of MATERIAIS) {
    if (m === 'ouro') continue;
    const sobra = a.estoque[m] - necessidade(a, m) * BAL.folgaParaExportar;
    if (sobra < BAL.loteComercio) continue;
    const lote = Math.min(sobra, BAL.loteComercio * 2);
    a.estoque[m] -= lote;
    a.estoque.ouro = Math.min(
      a.tetoOuro,
      a.estoque.ouro + lote * precoDe(mundo, m) * BAL.precoExportacao,
    );
    // Mercadoria saindo aos montes derruba o preço dela.
    mexerNoPreco(mundo, m, BAL.baixaPorExportacao);
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

/**
 * Mesmo reino, ou dois reinos que se conhecem e se toleram.
 *
 * A ordem das guardas é a da névoa: ninguém negocia com quem não sabe que
 * existe. Depois vem a guerra, e por último o desprezo — abaixo de
 * `relacaoParaComerciar` a caravana não sai, mesmo em tempo de paz.
 */
function podemComerciar(mundo: Mundo, a: Aldeia, b: Aldeia): boolean {
  if (a.reino === b.reino) return true;
  if (!mundo.conhece(a.reino, b.reino)) return false;
  if (mundo.emGuerra(a.reino, b.reino)) return false;
  if (mundo.saoAliados(a.reino, b.reino)) return true;
  return mundo.relacao(a.reino, b.reino) >= BAL.relacaoParaComerciar;
}

function negociar(mundo: Mundo, compradora: Aldeia, vendedora: Aldeia, material: Material): void {
  const lote = BAL.loteComercio;
  // Quem tem banco compra a prazo, e o vendedor aceita menos por isso.
  const margem = temBanco(compradora) ? BAL.margemComBanco : BAL.margemComercio;
  const preco = lote * precoDe(mundo, material) * margem;
  if (compradora.estoque.ouro < preco) return;

  compradora.estoque.ouro -= preco;
  vendedora.estoque.ouro = Math.min(vendedora.tetoOuro, vendedora.estoque.ouro + preco);
  // Cada negócio é procura que se realizou: o próximo sai um pouco mais caro.
  mexerNoPreco(mundo, material, BAL.altaPorNegocio);
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
