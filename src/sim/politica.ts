import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo, Reino } from '../core/mundo.js';
import { ESP_CIVILIZADO } from '../dados/especies.js';
import { BAL } from './balanco.js';

/**
 * Quem manda, como chegou lá e o que perde quando morre.
 *
 * Até aqui uma civilização era uma estatística: população, estoque, nível. Não
 * havia **ninguém** dentro dela. Este sistema dá cargo a indivíduos concretos do
 * pool de criaturas, e com isso a morte de uma pessoa passa a ser um
 * acontecimento político em vez de mais um decremento de população.
 *
 * Duas regras de sucessão, e elas são diferentes de propósito:
 *
 * - **Governante de vila: o mais rico.** Poder local é dinheiro. Quem entregou
 *   mais trabalho, negociou melhor ou herdou mais manda no lugar — e perde o
 *   posto para quem o superar. É um cargo disputado o tempo todo.
 * - **Rei do reino: a família.** A coroa fica na linhagem enquanto restar
 *   alguém dela viva, mesmo que empobreça. Só quando a família real se extingue
 *   é que ela passa para a família mais rica do reino — e essa troca é o tipo
 *   de coisa que derruba a lealdade de quem era leal à casa antiga.
 *
 * O imposto é o que amarra os dois ao resto do jogo: o governante recolhe dos
 * moradores, fica com uma parte e manda o resto ao rei. Imposto alto enche o
 * cofre e esvazia a lealdade — é o motor da rebelião que vem na fase seguinte.
 */

export const sistemaPolitica: Sistema = {
  id: 'politica',
  intervalo: BAL.intervaloPolitica,
  executar(mundo: Mundo): void {
    // A coroa vem **antes** dos governantes, e a ordem importa. Rei novo leva
    // uma fatia do tesouro para o bolso ao assumir, o que costuma fazer dele o
    // mais rico da vila onde mora. Com os governantes escolhidos primeiro, esse
    // dinheiro só entrava na conta na passada seguinte, e por até cento e vinte
    // ticks a vila do rei tinha um governante mais pobre que ele — que é
    // exatamente o que a regra do cargo diz que não pode acontecer.
    for (const r of mundo.reinos) {
      if (!r.ativo) continue;
      cuidarDaCoroa(mundo, r);
    }
    for (const a of mundo.aldeias) {
      if (!a?.ativa) continue;
      escolherGovernante(mundo, a);
      recolherImposto(mundo, a);
    }
  },
};

/**
 * Dá chefe a uma vila e ao reino dela **agora**, sem esperar a próxima passada.
 *
 * Quem funda vila ou reino fora da geração do mundo — colônia, desembarque de
 * colonos, refundação de um povo varrido do mapa, rebelião, a mão do jogador —
 * chama isto na sequência. Sem essa chamada, a vila recém-nascida passa até
 * `BAL.intervaloPolitica` ticks sem governante e o reino sem rei: ninguém
 * recolhe imposto, ninguém responde por ela, e qualquer conta que suponha que
 * toda vila viva tem quem mande nela encontra uma exceção.
 */
export function empossarChefes(mundo: Mundo, a: Aldeia): void {
  if (!a.ativa) return;
  const r = mundo.reinos[a.reino];
  if (r?.ativo) cuidarDaCoroa(mundo, r);
  escolherGovernante(mundo, a);
}

/**
 * O governante da vila é o morador mais rico dela.
 *
 * Reavaliado a cada passada: se alguém enriqueceu mais que o atual, o posto
 * muda de mãos. Não há eleição nem golpe — a fortuna é o cargo. O ocupante
 * ganha uma vantagem por estar lá (`bonusDeCargo`), o que dificulta ser
 * derrubado por uma diferença mínima e evita o cargo ficar trocando toda hora
 * entre dois vizinhos de bolso parecido.
 */
function escolherGovernante(mundo: Mundo, a: Aldeia): void {
  const c = mundo.criaturas;

  // O atual ainda é a mesma pessoa, viva e moradora daqui?
  //
  // `mesmaPessoa` e não só `vivo`: o slot de quem morre é reaproveitado, e sem
  // conferir a geração o cargo passava sozinho para o bebê que nascesse no
  // lugar do falecido.
  const atual = a.governante;
  const valido = mundo.mesmaPessoa(atual, a.governanteGer) && c.aldeia[atual] === a.id;
  if (!valido) a.governante = -1;

  let melhor = a.governante;
  let melhorRiqueza = melhor >= 0 ? c.riqueza[melhor] * (1 + BAL.bonusDeCargo) : -1;

  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    if (c.riqueza[i] > melhorRiqueza) {
      melhorRiqueza = c.riqueza[i];
      melhor = i;
    }
  }

  if (melhor !== a.governante && melhor >= 0) {
    const anterior = a.governante;
    a.governante = melhor;
    a.governanteGer = c.geracao[melhor];
    mundo.eventos.emitir('aldeia:governante', {
      aldeia: a.id,
      quem: melhor,
      antes: anterior,
    });
  }
}

/**
 * O governante recolhe dos moradores; parte fica com ele, parte sobe ao rei.
 *
 * É o que faz o ouro circular de baixo para cima e o que dá ao cargo um motivo
 * de existir. Também é o que vai derrubar a lealdade quando a taxa for alta —
 * por isso a cobrança já desconta fidelidade agora, mesmo antes de haver
 * rebelião para usá-la.
 */
function recolherImposto(mundo: Mundo, a: Aldeia): void {
  const c = mundo.criaturas;
  const taxa = a.imposto;
  if (taxa <= 0) return;

  let arrecadado = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    if (i === a.governante) continue; // quem cobra não paga

    const parte = c.riqueza[i] * taxa;
    if (parte <= 0.01) continue;
    c.riqueza[i] -= parte;
    arrecadado += parte;

    // Pagar imposto sempre incomoda; o quanto depende da taxa e de quem paga.
    // Um clã ganancioso e pouco submisso sente cada moeda; um clã conformado
    // quase não reclama. É a segunda alavanca de clã com efeito real, e a que
    // deixa o mesmo imposto ser tolerável numa vila e revolucionário na outra.
    const cla = mundo.cla(c.cla[i]);
    const bruto = cla ? 0.6 + cla.ganancia * 0.8 + (1 - cla.submissao) * 0.6 : 1;
    const sensibilidade = 1 + (bruto - 1) * BAL.pesoDoClaNoImposto;
    c.fidelidade[i] = Math.max(
      0,
      c.fidelidade[i] - taxa * BAL.desgostoPorImposto * sensibilidade,
    );
  }
  if (arrecadado <= 0) return;

  // o governante fica com a parte dele e o resto vai para o cofre do reino
  const doGovernante = arrecadado * BAL.fatiaDoGovernante;
  if (a.governante >= 0) c.riqueza[a.governante] += doGovernante;
  const r = mundo.reinos[a.reino];
  if (r?.ativo) r.tesouro += arrecadado - doGovernante;
}

/**
 * A coroa: confere se o rei está vivo e, se não estiver, entrega a quem cabe.
 *
 * A ordem é a que o Felipe pediu — primeiro a família real, e só quando não
 * sobra ninguém dela é que o trono vai para a família mais rica do reino.
 */
function cuidarDaCoroa(mundo: Mundo, r: Reino): void {
  const c = mundo.criaturas;

  const rei = r.rei;
  if (mundo.mesmaPessoa(rei, r.reiGer) && c.reino[rei] === r.id) return;

  const morto = rei;
  r.rei = -1;

  // 1. alguém da família real — o mais velho, que é o herdeiro natural
  let herdeiro = -1;
  let maisVelho = -1;
  if (r.casaReal >= 0) {
    for (let i = 0; i < c.limite; i++) {
      if (!c.vivo[i] || c.reino[i] !== r.id) continue;
      if (c.familia[i] !== r.casaReal) continue;
      if (c.idade[i] > maisVelho) {
        maisVelho = c.idade[i];
        herdeiro = i;
      }
    }
  }

  // 2. a casa real acabou: a coroa vai para a família mais rica do reino
  if (herdeiro < 0) {
    const fortuna = new Map<number, number>();
    let maisRico = -1;
    let riquezaDele = -1;
    for (let i = 0; i < c.limite; i++) {
      if (!c.vivo[i] || c.reino[i] !== r.id) continue;
      if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
      if (c.riqueza[i] > riquezaDele) {
        riquezaDele = c.riqueza[i];
        maisRico = i;
      }
      const f = c.familia[i];
      if (f >= 0) fortuna.set(f, (fortuna.get(f) ?? 0) + c.riqueza[i]);
    }

    let casaNova = -1;
    let maior = -1;
    for (const [f, soma] of fortuna) {
      if (soma > maior) {
        maior = soma;
        casaNova = f;
      }
    }

    if (casaNova >= 0) {
      // o mais rico daquela família assume, e ela vira a casa real
      let melhor = -1;
      let melhorRiqueza = -1;
      for (let i = 0; i < c.limite; i++) {
        if (!c.vivo[i] || c.reino[i] !== r.id || c.familia[i] !== casaNova) continue;
        if (c.riqueza[i] > melhorRiqueza) {
          melhorRiqueza = c.riqueza[i];
          melhor = i;
        }
      }
      herdeiro = melhor;
      if (herdeiro >= 0) {
        r.casaReal = casaNova;
        // Trocar de dinastia abala quem era leal à casa antiga. É o custo de
        // uma sucessão que sai da linhagem, e o começo do caminho da rebelião.
        for (let i = 0; i < c.limite; i++) {
          if (c.vivo[i] && c.reino[i] === r.id) {
            c.fidelidade[i] = Math.max(0, c.fidelidade[i] - BAL.abaloDeDinastia);
          }
        }
      }
    } else if (maisRico >= 0) {
      // ninguém tem família registrada: o mais rico funda uma
      herdeiro = maisRico;
      r.casaReal = mundo.novaFamilia();
      c.familia[herdeiro] = r.casaReal;
    }
  }

  if (herdeiro < 0) return; // reino sem ninguém: morre por outros caminhos

  r.rei = herdeiro;
  r.reiGer = c.geracao[herdeiro];
  // rei também é dono do tesouro: parte dele vai para o bolso ao assumir
  c.riqueza[herdeiro] += r.tesouro * BAL.heranca;
  r.tesouro *= 1 - BAL.heranca;
  mundo.eventos.emitir('reino:coroou', {
    reino: r.id,
    quem: herdeiro,
    casa: r.casaReal,
    antes: morto,
  });
}
