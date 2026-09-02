import type { Aldeia, Mundo, Reino } from '../core/mundo.js';
import { MATERIAIS } from '../dados/materiais.js';
import { colonizarAPartirDe } from './civilizacao.js';

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
    para.estoque[m] = Math.min(para.capacidadeEstoque, para.estoque[m] + metade);
    algo = true;
  }
  return algo ? 'A carga foi enviada.' : 'Não há o que enviar.';
}

/** Reinos com quem este pode ter relação diplomática agora. */
export function vizinhosDiplomaticos(mundo: Mundo, reino: Reino): Reino[] {
  return mundo.reinos.filter((r) => r.ativo && r.id !== reino.id);
}

export function ordenarGuerra(mundo: Mundo, a: number, b: number): string {
  if (mundo.emGuerra(a, b)) return 'Já estão em guerra.';
  mundo.declararGuerra(a, b);
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
