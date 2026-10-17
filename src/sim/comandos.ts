import type { Aldeia, Mundo, Reino } from '../core/mundo.js';
import { MATERIAIS } from '../dados/materiais.js';
import { colonizarAPartirDe } from './civilizacao.js';
import { tentarRebelar } from './cultura.js';
import { aprender } from './conhecimento.js';
import { TEC_CUSTO, TEC_REQUER, tecnologias } from '../dados/tecnologias.js';

/**
 * As ordens que o jogador dá às civilizações.
 *
 * Os poderes mexem no mundo por fora — chovem meteoro, plantam floresta. Isto
 * aqui é o contrário: fala com quem já está no mapa. É o que separa assistir de
 * jogar, porque muda a intenção das aldeias em vez de mudar o terreno debaixo
 * delas.
 *
 * Nada aqui é executado na hora pela força: o comando ajusta o que a aldeia
 * quer, e a simulação continua sendo quem decide se dá certo. Mandar fundar uma
 * colônia sem madeira não funda colônia nenhuma.
 */

/**
 * As taxas que o jogador pode impor a uma vila.
 *
 * Poucas e nomeadas, em vez de um controle deslizante: "meio por cento" não diz
 * nada a quem está jogando, e o que importa é a escolha entre deixar o povo
 * rico e encher o cofre do reino.
 */
export const TAXAS: ReadonlyArray<readonly [string, number, string]> = [
  ['nenhum', 0, 'Ninguém paga nada. O povo enriquece e o cofre do reino seca.'],
  ['leve', 0.03, 'Cobrança branda: quase não se sente.'],
  ['normal', 0.08, 'O padrão. Sustenta o reino sem revolta.'],
  ['pesado', 0.18, 'Enche o tesouro depressa e corrói a lealdade.'],
  ['brutal', 0.32, 'O reino fica rico e o povo, furioso. É assim que se compra uma rebelião.'],
];

/** Muda a taxa da vila e devolve o que dizer ao jogador. */
export function definirImposto(mundo: Mundo, a: Aldeia, taxa: number): string {
  a.imposto = taxa;
  void mundo;
  if (taxa === 0) return `${a.nome} não cobra mais imposto nenhum.`;
  if (taxa >= 0.3) return `${a.nome} passa a cobrar ${Math.round(taxa * 100)}%. Isso vai doer.`;
  return `${a.nome} passa a cobrar ${Math.round(taxa * 100)}% de imposto.`;
}

export const FOCOS = ['equilibrio', 'comida', 'exercito', 'obras'] as const;
export type Foco = (typeof FOCOS)[number];

export const NOME_FOCO: Record<Foco, string> = {
  equilibrio: 'equilíbrio',
  comida: 'lavoura',
  exercito: 'exército',
  obras: 'construção',
};

export const DICA_FOCO: Record<Foco, string> = {
  equilibrio: 'A aldeia cuida do que estiver faltando no momento.',
  comida: 'Todo esforço vai para comida: cresce rápido e passa fome com menos frequência.',
  exercito: 'Ferro, forja e muralha na frente de tudo. Mais gente vira soldado.',
  obras: 'Constrói sem parar, enquanto houver material.',
};

export function definirFoco(a: Aldeia, foco: Foco): void {
  a.foco = FOCOS.indexOf(foco);
}

export function focoDe(a: Aldeia): Foco {
  return FOCOS[a.foco] ?? 'equilibrio';
}

/**
 * Manda a aldeia enviar colonos agora, sem esperar o sorteio do sistema.
 * Devolve o que houve, para a interface poder dizer ao jogador.
 */
export function mandarColonizar(mundo: Mundo, a: Aldeia): string {
  if (a.populacao < 6) return 'Gente de menos para dividir.';
  if (a.estoque.comida < 60 || a.estoque.madeira < 30) {
    return 'Falta comida e madeira para a viagem.';
  }
  const antes = mundo.aldeias.filter((x) => x.ativa).length;
  colonizarAPartirDe(mundo, a);
  const depois = mundo.aldeias.filter((x) => x.ativa).length;
  return depois > antes ? 'Os colonos partiram.' : 'Não acharam lugar bom para se instalar.';
}

/** Transfere metade do estoque de uma aldeia para outra do mesmo reino. */
export function doarPara(de: Aldeia, para: Aldeia): string {
  if (de.reino !== para.reino) return 'Só dá para socorrer aldeia do mesmo reino.';
  let algo = false;
  for (const m of MATERIAIS) {
    const metade = de.estoque[m] / 2;
    if (metade < 5) continue;
    de.estoque[m] -= metade;
    para.estoque[m] = Math.min(m === 'ouro' ? para.tetoOuro : para.capacidadeEstoque, para.estoque[m] + metade);
    algo = true;
  }
  return algo ? 'A carga foi enviada.' : 'Não há o que enviar.';
}

/**
 * Ensina ao reino a próxima coisa que ele estava para descobrir.
 *
 * A mesma escolha que a corte faria sozinha — o jogador antecipa, não desvia.
 * Devolve o que dizer, porque um reino que já sabe tudo precisa ouvir isso.
 */
export function ordenarPesquisa(mundo: Mundo, reino: Reino): string {
  let alvo = -1;
  let maisBarata = Infinity;
  for (let t = 0; t < TEC_CUSTO.length; t++) {
    if (reino.tecnologias.has(t)) continue;
    if (TEC_CUSTO[t] >= maisBarata) continue;
    if (!TEC_REQUER[t].every((req) => reino.tecnologias.has(req))) continue;
    maisBarata = TEC_CUSTO[t];
    alvo = t;
  }
  if (alvo < 0) return `${reino.nome} já sabe tudo o que há para saber.`;
  aprender(mundo, reino, alvo);
  return `${reino.nome} descobriu ${tecnologias.porIndice(alvo).nome}.`;
}

/**
 * Manda a vila se levantar contra o próprio reino, agora.
 *
 * Diferente do poder de mapa: aqui o jogador escolheu uma vila concreta e sabe
 * o que está fazendo, então a mensagem de volta explica por que não deu, quando
 * não dá. As condições são as da rebelião espontânea menos a idade mínima.
 */
export function ordenarRebeliao(mundo: Mundo, a: Aldeia): string {
  const r = mundo.reinos[a.reino];
  if (!r?.ativo) return 'Esta vila não tem reino do qual se separar.';
  if (r.aldeias.length < 2) return `${r.nome} só tem esta vila. Não há do que se separar.`;
  if (r.capital === a.id) return 'A capital não se rebela contra si mesma.';
  if (a.populacao < 2) return 'Não há gente aqui para levantar bandeira nenhuma.';
  return tentarRebelar(mundo, a, true)
    ? `${a.nome} levantou a própria bandeira contra ${r.nome}.`
    : 'A revolta não pegou.';
}

/**
 * Reinos com quem este pode ter relação diplomática agora — os que ele conhece.
 *
 * A névoa vale também para o jogador quando ele está falando **em nome** de um
 * reino: não dá para propor aliança a quem os seus não sabem que existe. O que
 * o jogador tem, e o reino não, é o poder de revelar (ver `ordenarRevelar`).
 */
export function vizinhosDiplomaticos(mundo: Mundo, reino: Reino): Reino[] {
  return mundo.reinos.filter((r) => r.ativo && r.id !== reino.id && mundo.conhece(reino.id, r.id));
}

/** Reinos que existem no mapa e que este ainda não sabe que existem. */
export function estranhos(mundo: Mundo, reino: Reino): Reino[] {
  return mundo.reinos.filter((r) => r.ativo && r.id !== reino.id && !mundo.conhece(reino.id, r.id));
}

/** Apresenta dois reinos um ao outro, por decreto do jogador. */
export function ordenarRevelar(mundo: Mundo, a: number, b: number): string {
  if (mundo.conhece(a, b)) return 'Já se conhecem.';
  mundo.apresentarReinos(a, b);
  const nome = mundo.reinos[b]?.nome ?? 'o outro reino';
  return `Agora sabem que ${nome} existe.`;
}

/** Planta ódio entre dois reinos: derruba a relação e deixa mágoa que não some. */
export function ordenarOdio(mundo: Mundo, a: number, b: number): string {
  if (!mundo.conhece(a, b)) return 'Um não sabe do outro. Revele antes.';
  mundo.mudarRelacao(a, b, -55);
  mundo.acumularRancor(a, b, 35);
  mundo.acumularRancor(b, a, 35);
  return 'O ódio foi semeado. Agora é esperar.';
}

export function ordenarGuerra(mundo: Mundo, a: number, b: number): string {
  if (mundo.emGuerra(a, b)) return 'Já estão em guerra.';
  mundo.declararGuerra(a, b, 'vontade de um deus');
  return 'A guerra foi declarada.';
}

export function ordenarPaz(mundo: Mundo, a: number, b: number): string {
  if (!mundo.emGuerra(a, b)) return 'Não há guerra entre eles.';
  mundo.fazerPaz(a, b);
  return 'A paz foi assinada.';
}

export function ordenarAlianca(mundo: Mundo, a: number, b: number): string {
  if (mundo.saoAliados(a, b)) return 'Já são aliados.';
  if (mundo.emGuerra(a, b)) return 'Faça a paz antes de propor aliança.';
  mundo.firmarAlianca(a, b);
  return 'A aliança foi firmada.';
}

export function ordenarRomper(mundo: Mundo, a: number, b: number): string {
  if (!mundo.saoAliados(a, b)) return 'Não são aliados.';
  mundo.romperAlianca(a, b);
  return 'A aliança foi rompida.';
}
