import type { Sistema } from '../core/sistemas.js';
import { RANCOR_MAXIMO, type Aldeia, type Mundo, type Reino } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ESP_CIVILIZADO, especies } from '../dados/especies.js';
import { nomeDeReino } from '../dados/nomes.js';
import { BAL } from './balanco.js';
import { Campo } from '../dados/tracos.js';
import { fator } from './genetica.js';

/**
 * Cultura, clã e rebelião: por que um povo se parte em dois.
 *
 * Reino e espécie explicam por que dois povos brigam. Isto aqui explica a briga
 * de dentro. Cada pessoa pertence a um clã (`Criaturas.cla`), cada clã tem
 * valores próprios (`Mundo.clas`), e a distância entre o que o clã quer e o que
 * o reino faz aparece como **lealdade** — `Criaturas.fidelidade`, que existia
 * havia tempo e até agora só descia com imposto e troca de dinastia.
 *
 * A lealdade de cada um caminha para um alvo calculado do que ele está vivendo:
 * a fartura da vila, a fome no próprio estômago, o clã de quem manda ali, a
 * guerra em que o reino meteu todo mundo. O imposto continua descontando por
 * fora, na cobrança — é a pancada aguda, enquanto isto é a maré.
 *
 * Quando a lealdade média de uma vila desaba, ela **se separa**: leva o
 * território que domina, funda um reino do mesmo povo e já nasce em guerra com
 * o antigo. É o único jeito de o mundo produzir dois reinos vizinhos da mesma
 * espécie — e portanto o único jeito de haver aliança, porque entre espécies
 * diferentes o ódio de povo trava a relação antes de ela chegar lá.
 */
export const sistemaCultura: Sistema = {
  id: 'cultura',
  intervalo: BAL.intervaloCultura,
  executar(mundo: Mundo): void {
    const media = atualizarLealdade(mundo);
    for (const a of mundo.aldeias) {
      if (!a.ativa) continue;
      if (media[a.id] < BAL.lealdadeParaRebelar) tentarRebelar(mundo, a);
    }
  },
};

/**
 * Puxa a lealdade de todo mundo para o alvo de cada um, numa passada só.
 *
 * A conta é por pessoa mas depende de coisas que valem para a vila inteira —
 * fartura do celeiro, moral, clã de quem governa, guerra do reino. A forma
 * óbvia seria um laço por vila varrendo o pool atrás dos moradores dela, e foi
 * assim que isto nasceu: **O(vilas × criaturas)**, ou um milhão e meio de
 * iterações num mundo grande. Aqui o que vale para a vila é calculado antes,
 * numa tabela indexada por id de aldeia, e o pool é varrido **uma vez** —
 * O(vilas + criaturas).
 *
 * O caminho até o alvo é lento (`BAL.mareDaLealdade`) de propósito: lealdade que
 * responde na hora vira um medidor piscando, e a rebelião passa a depender de um
 * instante ruim em vez de um período ruim.
 *
 * Devolve a lealdade média de cada vila, por id.
 */
function atualizarLealdade(mundo: Mundo): Float64Array {
  const c = mundo.criaturas;
  const total = mundo.aldeias.length;
  const daVila = new Float64Array(total);
  const claGovernante = new Int32Array(total).fill(-1);
  const claDoRei = new Int32Array(total).fill(-1);
  const emGuerra = new Uint8Array(total);
  const viva = new Uint8Array(total);
  const soma = new Float64Array(total);
  const gente = new Int32Array(total);

  for (const a of mundo.aldeias) {
    if (!a.ativa) continue;
    const r = mundo.reinos[a.reino];
    if (!r?.ativo) continue;
    viva[a.id] = 1;
    const comidaPorCabeca = a.estoque.comida / Math.max(1, a.populacao);
    daVila[a.id] =
      (a.moral - 50) * 0.25 +
      Math.min(BAL.lealdadePorFartura, comidaPorCabeca * 1.2) +
      (a.nivel - 1) * 3;
    if (mundo.mesmaPessoa(a.governante, a.governanteGer)) claGovernante[a.id] = c.cla[a.governante];
    if (mundo.mesmaPessoa(r.rei, r.reiGer)) claDoRei[a.id] = c.cla[r.rei];
    emGuerra[a.id] = r.guerras.size > 0 ? 1 : 0;
  }

  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    const id = c.aldeia[i];
    if (id < 0 || id >= total || viva[id] === 0) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;

    const cla = mundo.cla(c.cla[i]);
    let alvo = BAL.lealdadeBase + daVila[id];

    if (cla) {
      // Quem aceita hierarquia é leal mais barato; quem não aceita cobra caro.
      alvo += (cla.submissao - 0.5) * BAL.lealdadePorSubmissao;
      // Ser mandado por gente de outro clã. É o motor da rebelião: uma vila que
      // enriquece um forasteiro e o vê virar governante é uma vila que se
      // afasta do próprio reino sem que nada de errado tenha acontecido.
      if (claGovernante[id] >= 0 && claGovernante[id] !== cla.id) {
        alvo -= cla.fechamento * BAL.lealdadePorGovernanteDeFora;
      }
      if (claDoRei[id] >= 0 && claDoRei[id] !== cla.id) {
        alvo -= cla.fechamento * BAL.lealdadePorReiDeFora;
      }
      // Guerra pesa em quem não gosta de guerra, e anima quem gosta.
      if (emGuerra[id] === 1) alvo += (cla.marcialidade - 0.5) * BAL.lealdadePorGuerra;
    }

    // Fome é o que derruba mais rápido: ninguém é leal com o estômago vazio.
    if (c.fome[i] > 60) alvo -= (c.fome[i] - 60) * BAL.lealdadePorFome;

    // O temperamento entra por último e multiplica o resto: o generoso aguenta
    // um imposto que faz o ganancioso pegar em armas, na mesma vila e sob o
    // mesmo governante.
    alvo *= fator(c.tracos[i], Campo.lealdade);

    if (alvo > 100) alvo = 100;
    else if (alvo < 0) alvo = 0;

    c.fidelidade[i] += (alvo - c.fidelidade[i]) * BAL.mareDaLealdade;
    soma[id] += c.fidelidade[i];
    gente[id]++;
  }

  // Vila vazia não se rebela: 100 é o jeito de dizer "nada a fazer aqui".
  for (let id = 0; id < total; id++) {
    soma[id] = gente[id] === 0 ? 100 : soma[id] / gente[id];
  }
  return soma;
}

/**
 * A vila se separa do reino, levando o chão e os vizinhos igualmente descontentes.
 *
 * Regras de quem pode: a vila não pode ser a capital (o que aconteceria ali é
 * um golpe, não uma secessão, e é outra mecânica), o reino precisa ter mais de
 * uma vila (senão não sobra nada de que se separar), e a vila precisa ter idade
 * — povoado fundado ontem não tem identidade própria para defender.
 *
 * O que sai daqui é um reino **do mesmo povo**, vizinho e em guerra. É a única
 * fonte disso no jogo, e por isso é o que destrava a aliança militar: dois
 * reinos da mesma espécie não têm ódio de povo entre eles e conseguem chegar à
 * relação que uma aliança exige.
 */
export function tentarRebelar(mundo: Mundo, a: Aldeia, forcada = false): boolean {
  const antigo = mundo.reinos[a.reino];
  if (!antigo?.ativo) return false;
  if (antigo.aldeias.length < 2) return false;
  if (antigo.capital === a.id) return false;
  // Idade e tamanho valem para a revolta espontânea: um povoado de ontem, com
  // seis moradores, não tem identidade nem braço para sustentar um reino. A mão
  // do jogador passa por cima dos dois — se ele quer ver aquela vila levantar
  // bandeira, o que ela levanta é problema dela; o que não dá para contornar é
  // não haver de quem se separar.
  if (!forcada) {
    if (mundo.tick - a.fundadaEm < BAL.idadeParaRebelar) return false;
    if (a.populacao < BAL.populacaoParaRebelar) return false;
  } else if (a.populacao < 2) {
    return false;
  }

  const c = mundo.criaturas;
  const def = especies.porIndice(a.especie);

  // As vizinhas igualmente descontentes vêm junto. Rebelião de uma vila só é
  // uma revolta; de uma província inteira é uma guerra civil — e é a segunda
  // que muda o mapa.
  const juntas: Aldeia[] = [a];
  for (const id of antigo.aldeias) {
    const outra = mundo.aldeias[id];
    if (!outra?.ativa || outra.id === a.id || outra.id === antigo.capital) continue;
    if (Math.hypot(outra.x - a.x, outra.y - a.y) > BAL.alcanceDaRebeliao) continue;
    if (lealdadeMedia(mundo, outra) >= BAL.lealdadeParaSeguirARebeliao) continue;
    juntas.push(outra);
  }
  // não dá para levar tudo: um reino sem nenhuma vila deixa de existir e a
  // rebelião viraria só uma troca de bandeira
  if (juntas.length >= antigo.aldeias.length) juntas.length = antigo.aldeias.length - 1;

  const novo = mundo.criarReino(a.especie, nomeDeReino(mundo.rng, def.id), corDissidente(antigo.cor));

  // A bandeira nova é a de quem tinha mais a ganhar: o clã mais rico da vila que
  // começou tudo. Quem lidera a revolta é o mais rico desse clã, e a família
  // dele vira a casa real do reino novo.
  const lider = liderDaRevolta(mundo, a);
  if (lider >= 0) {
    if (c.familia[lider] < 0) c.familia[lider] = mundo.novaFamilia();
    novo.casaReal = c.familia[lider];
    novo.rei = lider;
    novo.reiGer = c.geracao[lider];
  }

  const g = mundo.grid;
  for (const vila of juntas) {
    antigo.aldeias = antigo.aldeias.filter((x) => x !== vila.id);
    vila.reino = novo.id;
    novo.aldeias.push(vila.id);
    if (novo.capital < 0) novo.capital = vila.id;
    vila.moral = Math.min(100, vila.moral + 15);
  }
  if (antigo.capital === -1 || !antigo.aldeias.includes(antigo.capital)) {
    antigo.capital = antigo.aldeias[0] ?? -1;
  }

  // O território vai junto — é isso que faz a rebelião aparecer no mapa. O
  // varrer é do mapa inteiro pelo mesmo motivo de `destruirAldeia`: território
  // em forma livre não cabe num quadrado e nem sempre é contíguo.
  const donas = new Set(juntas.map((v) => v.id));
  for (let i = 0; i < g.total; i++) {
    if (!donas.has(g.aldeiaDona[i])) continue;
    g.territorio[i] = novo.id;
    g.marcarSujoIdx(i);
  }

  // as pessoas trocam de bandeira e a lealdade delas renasce inteira
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || !donas.has(c.aldeia[i])) continue;
    c.reino[i] = novo.id;
    c.fidelidade[i] = 80;
    // a notícia que o rebelde carregava era para um rei que já não é o dele
    c.noticia[i] = -1;
    if (c.estado[i] === Estado.Trabalhando) c.estado[i] = Estado.Vagando;
  }

  // Nasce sabendo tudo o que o reino-mãe sabia: os rebeldes são o mesmo povo,
  // com as mesmas embaixadas e os mesmos mapas.
  for (const conhecido of [...antigo.conhecidos]) {
    mundo.apresentarReinos(novo.id, conhecido);
  }
  mundo.apresentarReinos(novo.id, antigo.id);
  novo.tesouro = antigo.tesouro * 0.3;
  antigo.tesouro *= 0.7;

  // E nasce sabendo tudo o que o reino-mãe sabia. São as mesmas pessoas: o
  // pedreiro que assentava pedra na segunda-feira continua sabendo assentar
  // pedra na terça, com outra bandeira em cima. Sem isto, uma província rica se
  // separava e caía na idade da pedra no mesmo instante — e o mapa ficava cheio
  // de reinos tribais que nunca tinham sido tribais.
  for (const t of antigo.tecnologias) novo.tecnologias.add(t);
  novo.era = antigo.era;
  novo.conhecimento = antigo.conhecimento * 0.3;
  antigo.conhecimento *= 0.7;

  // e nasce em guerra, com a conta inteira em aberto dos dois lados
  mundo.acumularRancor(antigo.id, novo.id, RANCOR_MAXIMO * 0.6);
  mundo.acumularRancor(novo.id, antigo.id, RANCOR_MAXIMO * 0.4);
  mundo.declararGuerra(novo.id, antigo.id, `rebelião de ${a.nome}`);

  mundo.eventos.emitir('reino:rebeliao', {
    novo: novo.id,
    antigo: antigo.id,
    aldeia: a.id,
    vilas: juntas.length,
  });
  return true;
}

/** Lealdade média dos moradores de uma vila, sem mexer em nada. */
export function lealdadeMedia(mundo: Mundo, a: Aldeia): number {
  const c = mundo.criaturas;
  let soma = 0;
  let gente = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    soma += c.fidelidade[i];
    gente++;
  }
  return gente === 0 ? 100 : soma / gente;
}

/** O mais rico do clã mais forte da vila: quem tem cacife para liderar a revolta. */
function liderDaRevolta(mundo: Mundo, a: Aldeia): number {
  const c = mundo.criaturas;
  const fortunaPorCla = new Map<number, number>();
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id || c.cla[i] < 0) continue;
    fortunaPorCla.set(c.cla[i], (fortunaPorCla.get(c.cla[i]) ?? 0) + c.riqueza[i]);
  }
  let claLider = -1;
  let maior = -1;
  for (const [cla, soma] of fortunaPorCla) {
    if (soma > maior) {
      maior = soma;
      claLider = cla;
    }
  }

  let lider = -1;
  let riqueza = -1;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
    if (claLider >= 0 && c.cla[i] !== claLider) continue;
    if (c.riqueza[i] > riqueza) {
      riqueza = c.riqueza[i];
      lider = i;
    }
  }
  return lider;
}

/**
 * A cor do reino rebelde: a do antigo, girada.
 *
 * Cor herdada e não sorteada porque a leitura do mapa depende disso — ver duas
 * manchas parentes brigando conta a história de uma guerra civil; ver uma
 * mancha roxa aparecer do nada no meio do azul não conta nada.
 */
function corDissidente(cor: number): number {
  const r = (cor >> 16) & 255;
  const g = (cor >> 8) & 255;
  const b = cor & 255;
  const mistura = (v: number, alvo: number) => Math.round(v * 0.55 + alvo * 0.45);
  return (mistura(r, 220) << 16) | (mistura(g, 200) << 8) | mistura(b, 90);
}

/** Reino ao qual esta vila pertence, para quem só tem a vila em mãos. */
export function reinoDaAldeia(mundo: Mundo, a: Aldeia): Reino | undefined {
  const r = mundo.reinos[a.reino];
  return r?.ativo ? r : undefined;
}
