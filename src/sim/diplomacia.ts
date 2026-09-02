import type { Sistema } from '../core/sistemas.js';
import type { Mundo, Reino } from '../core/mundo.js';
import { ODIO_POVOS, TOTAL_ESPECIES, especies } from '../dados/especies.js';
import { BAL } from './balanco.js';

/**
 * Relações entre reinos: quem conhece quem, por que brigam e quando param.
 *
 * A mudança grande desta versão é que **guerra passou a precisar de motivo**.
 * Antes bastava a relação numérica cair abaixo de um limiar e um dado dar
 * certo; a relação caía por atrito de fronteira, o dado dava certo de vez em
 * quando, e o resultado era um mundo com zero a três guerras em vinte mil ticks
 * — nenhuma delas explicável por nada que estivesse acontecendo no mapa.
 *
 * Agora cada par de reinos tem uma lista de **motivos**, cada um com um peso
 * medido do estado do mundo naquele instante: a fronteira que se toca, o ódio
 * antigo entre os dois povos, os mortos que um deve ao outro, a terra que falta
 * de um lado e sobra do outro, a fome, a fraqueza do vizinho e o aliado que já
 * está apanhando. Guerra estoura quando a soma passa de `limiarCasusBelli`, e a
 * crônica registra qual motivo pesou mais — dá para ler no histórico *por que*
 * cada guerra começou.
 *
 * A paz **não** é o espelho disso, e essa foi a lição medida: os motivos que
 * sustentam uma guerra crescem enquanto ela dura, então exigir que eles
 * esfriassem produzia guerra eterna. Quem encerra um conflito é o desgaste —
 * ver `acabarAGuerra`.
 *
 * Nada disso vale para quem não se conhece. Pares fora de `Reino.conhecidos`
 * são pulados inteiros — ver `src/sim/contato.ts`.
 *
 * Roda raramente (`intervaloDiplomacia`) porque decisão política não precisa de
 * resolução de tick, e porque medir fronteira custa uma varredura do território.
 */

/** Um motivo para a guerra, com o peso que ele tem hoje. */
interface Motivo {
  readonly id: string;
  readonly texto: string;
  readonly peso: number;
}

export const sistemaDiplomacia: Sistema = {
  id: 'diplomacia',
  intervalo: BAL.intervaloDiplomacia,
  executar(mundo: Mundo): void {
    const ativos = mundo.reinos.filter((r) => r.ativo);
    if (ativos.length < 2) return;

    esfriarRancor(ativos);
    espalharEntreAliados(mundo, ativos);

    const fronteiras = medirFronteiras(mundo);
    const vizinhanca = medirVizinhanca(mundo);

    for (let a = 0; a < ativos.length; a++) {
      for (let b = a + 1; b < ativos.length; b++) {
        const ra = ativos[a];
        const rb = ativos[b];
        // A névoa é a primeira guarda de todas: quem não se conhece não tem
        // relação para piorar, nem fronteira para disputar.
        if (!ra.conhecidos.has(rb.id)) continue;

        const chave = chaveDoPar(ra.id, rb.id);
        const contato = fronteiras.get(chave) ?? 0;
        // territórios podem não se tocar e os povos já se incomodarem: basta
        // haver aldeia de um perto de aldeia do outro
        const vizinhos = vizinhanca.get(chave) ?? 0;
        const roce = contato + vizinhos * 25;

        derivarRelacao(mundo, ra, rb, roce);
        decidir(mundo, ra, rb, roce);
      }
    }
  },
};

/**
 * O rancor esfria, e devagar.
 *
 * Uma geração inteira é o que leva para uma matança virar história antiga. É o
 * que impede o mundo de travar em ódio permanente depois da primeira guerra
 * grande, sem cair no outro extremo de esquecer tudo assim que a paz é
 * assinada.
 */
function esfriarRancor(ativos: Reino[]): void {
  for (const r of ativos) {
    for (const [outro, quanto] of r.rancor) {
      const novo = quanto - BAL.esquecimentoDeRancor;
      if (novo <= 0) r.rancor.delete(outro);
      else r.rancor.set(outro, novo);
    }
  }
}

/**
 * Aliados contam um ao outro o que sabem.
 *
 * Sem isto, uma aliança seria só um pacto militar entre dois cegos: dois reinos
 * podiam ser aliados havia séculos e ainda assim um não saber do vizinho de
 * fronteira do outro. Embaixada existe justamente para isso, e é a única forma
 * de conhecimento que atravessa o mapa sem alguém andar até lá.
 */
function espalharEntreAliados(mundo: Mundo, ativos: Reino[]): void {
  for (const r of ativos) {
    if (r.aliancas.size === 0) continue;
    for (const amigo of r.aliancas) {
      const outro = mundo.reinos[amigo];
      if (!outro?.ativo) continue;
      for (const conhecido of [...r.conhecidos]) {
        if (conhecido === amigo) continue;
        if (!outro.conhecidos.has(conhecido)) mundo.apresentarReinos(amigo, conhecido);
      }
    }
  }
}

/** A relação vai andando sozinha entre uma decisão e outra. */
function derivarRelacao(mundo: Mundo, ra: Reino, rb: Reino, roce: number): void {
  const odio = ODIO_POVOS[ra.especie * TOTAL_ESPECIES + rb.especie];
  const belicosidade = mediaDeBeligerancia(ra, rb);

  if (roce > 0) {
    // Fronteira que se toca gera atrito — mas o quanto depende de **com quem**.
    // O termo já foi cego ao povo do vizinho, e o efeito medido foi que nenhum
    // par de reinos com fronteira comum conseguia chegar à relação que uma
    // aliança exige: dois reinos irmãos, saídos da mesma rebelião, negociando
    // entre si, derivavam para -100 só por serem vizinhos. Aliança virou
    // mecanismo morto no jogo inteiro.
    //
    // Agora o atrito é disputa, e disputa entre parentes é menor que entre
    // estranhos: quem não tem ódio de povo sente menos de um terço do que sente
    // quem tem.
    mundo.mudarRelacao(
      ra.id,
      rb.id,
      BAL.atritoFronteira * Math.min(3, roce / 40) * belicosidade * 2 * (0.3 + odio * 1.4),
    );
    // E a vizinhança em si: entre quem se detesta, azeda; entre parentes, é
    // convivência — feira na divisa, casamento, gente que atravessa e volta.
    mundo.mudarRelacao(
      ra.id,
      rb.id,
      odio > 0 ? -odio * BAL.pesoDoOdioNaRelacao : BAL.parentescoNaFronteira,
    );
  } else {
    // longe um do outro, o tempo aproxima — menos quando o ódio é antigo, e aí
    // ele só não deixa a relação subir
    mundo.mudarRelacao(
      ra.id,
      rb.id,
      BAL.aproximacaoNatural * (1 - belicosidade) * Math.max(0, 1 - odio * 1.6),
    );
  }
}

/** Declarar guerra, assinar paz, firmar ou romper aliança. */
function decidir(mundo: Mundo, ra: Reino, rb: Reino, roce: number): void {
  const rel = mundo.relacao(ra.id, rb.id);

  if (mundo.emGuerra(ra.id, rb.id)) {
    acabarAGuerra(mundo, ra, rb, roce, rel);
    return;
  }

  // Sem alcance não há guerra: dois reinos que não se tocam nem por fronteira
  // nem por vizinhança de aldeia não têm como se atacar, por mais que se odeiem.
  if (roce > 0 && !mundo.saoAliados(ra.id, rb.id)) {
    comecarAGuerra(mundo, ra, rb, roce);
    if (mundo.emGuerra(ra.id, rb.id)) return;
  }

  // ---------------------------------------------------------------- aliança
  if (rel > BAL.limiarAlianca && !mundo.saoAliados(ra.id, rb.id)) {
    // povos que se dão bem por tempo bastante acabam assinando aliança
    if (mundo.rng.chance(0.3)) mundo.firmarAlianca(ra.id, rb.id);
  } else if (rel < BAL.limiarRomper && mundo.saoAliados(ra.id, rb.id)) {
    mundo.romperAlianca(ra.id, rb.id);
  }
}

/**
 * A guerra acaba quando cansa, e não quando o motivo passa.
 *
 * A primeira versão exigia que os motivos esfriassem para a paz sair, e o
 * resultado medido foi um mundo em guerra permanente: os motivos que sustentam
 * uma guerra **crescem** enquanto ela dura. A fronteira continua se tocando, os
 * mortos viram rancor, a relação está travada em -80. Quatro reinos, quatro
 * guerras, nenhuma delas terminando a não ser por extermínio — e a economia
 * inteira parada porque um terço de cada vila estava de armas na mão.
 *
 * O que faz uma guerra terminar de verdade é o desgaste: campanha longa esvazia
 * celeiro e cansa quem luta, e uma hora as duas cortes preferem a trégua ao ódio.
 * Os motivos esfriando ainda ajudam — apressam a paz — mas não são condição.
 */
function acabarAGuerra(mundo: Mundo, ra: Reino, rb: Reino, roce: number, rel: number): void {
  // um dos dois não tem mais com que lutar: a guerra acaba na hora
  if (ra.populacao < 6 || rb.populacao < 6) {
    mundo.fazerPaz(ra.id, rb.id);
    return;
  }

  const desgaste = Math.min(1, mundo.tempoDeSituacao(ra.id, rb.id) / BAL.ticksAteCansarDaGuerra);
  const motivos = Math.max(
    somaDeMotivos(mundo, ra, rb, roce),
    somaDeMotivos(mundo, rb, ra, roce),
  );
  const esfriou = motivos < BAL.limiarCasusBelli * BAL.fracaoParaPaz;

  let chance = desgaste * desgaste * BAL.chanceDePazPorDesgaste;
  if (esfriou) chance += 0.25;
  if (rel > BAL.limiarPaz) chance += 0.15;
  if (mundo.rng.chance(chance)) mundo.fazerPaz(ra.id, rb.id);
}

/**
 * Um dos dois declara guerra, se tiver motivo bastante — e fôlego para mais uma.
 *
 * Duas guardas além do casus belli, e as duas existem porque o mundo sem elas
 * vira uma guerra de todos contra todos:
 *
 * - **A trégua.** Recém-assinada a paz, o motivo continua todo lá. Sem um tempo
 *   mínimo entre uma guerra e a seguinte, a mesma guerra recomeçava na avaliação
 *   seguinte à paz.
 * - **A frente aberta.** Quem já está em guerra precisa de um motivo bem maior
 *   para abrir outra. É o que faz o mapa ter conflitos localizados em vez de
 *   todo reino brigando com todos os vizinhos ao mesmo tempo.
 */
function comecarAGuerra(mundo: Mundo, ra: Reino, rb: Reino, roce: number): void {
  if (mundo.tempoDeSituacao(ra.id, rb.id) < BAL.tregua) return;

  const deA = motivosDeGuerra(mundo, ra, rb, roce);
  const deB = motivosDeGuerra(mundo, rb, ra, roce);
  const somaA = deA.reduce((s, m) => s + m.peso, 0);
  const somaB = deB.reduce((s, m) => s + m.peso, 0);
  const agressor = somaA >= somaB ? ra : rb;
  const alvo = agressor === ra ? rb : ra;
  const lista = agressor === ra ? deA : deB;
  const soma = Math.max(somaA, somaB);

  const exigido = BAL.limiarCasusBelli * (1 + agressor.guerras.size * BAL.pesoDeFrenteAberta);
  if (soma < exigido) return;

  // A beligerância do povo não decide *se* há motivo — decide a pressa de agir
  // com o motivo que já existe. Um povo pacífico junta queixa por muito tempo
  // antes de marchar.
  const pressa = 0.15 + mediaDeBeligerancia(agressor, alvo) * 0.55;
  if (!mundo.rng.chance(pressa)) return;

  const principal = lista.reduce((m, o) => (o.peso > m.peso ? o : m), lista[0]);
  mundo.declararGuerra(agressor.id, alvo.id, principal?.texto ?? 'sem motivo declarado');
}

/** Só a soma, para quando o motivo em si não interessa. */
function somaDeMotivos(mundo: Mundo, de: Reino, contra: Reino, roce: number): number {
  let s = 0;
  for (const m of motivosDeGuerra(mundo, de, contra, roce)) s += m.peso;
  return s;
}

/**
 * Por que `de` atacaria `contra`, e quanto cada razão pesa hoje.
 *
 * Todo peso sai de algo mensurável no mundo naquele instante — não há número
 * escondido que só a diplomacia conhece. É o que permite explicar a guerra
 * depois: o motivo que a crônica escreve é literalmente o que mais pesou na
 * conta.
 */
function motivosDeGuerra(mundo: Mundo, de: Reino, contra: Reino, roce: number): Motivo[] {
  const lista: Motivo[] = [];
  const nome = contra.nome;

  // ------------------------------------------------------------- fronteira
  if (roce > 0) {
    lista.push({
      id: 'fronteira',
      texto: `disputa de fronteira com ${nome}`,
      peso: Math.min(BAL.tetoMotivoFronteira, roce * 0.3),
    });
  }

  // ----------------------------------------------------- ódio entre os povos
  const odio = ODIO_POVOS[de.especie * TOTAL_ESPECIES + contra.especie];
  if (odio > 0.05) {
    const povoDele = especies.porIndice(contra.especie).plural;
    lista.push({
      id: 'odio',
      texto: `ódio antigo aos ${povoDele}`,
      peso: odio * BAL.tetoMotivoOdio,
    });
  }

  // ------------------------------------------------------------- inimizade
  // A relação numérica não some do jogo: ela vira mais um motivo, com peso
  // proporcional a quanto já azedou.
  const rel = mundo.relacao(de.id, contra.id);
  if (rel < 0) {
    lista.push({
      id: 'inimizade',
      texto: `inimizade declarada contra ${nome}`,
      peso: Math.min(BAL.tetoMotivoInimizade, -rel * 0.35),
    });
  }

  // ---------------------------------------------------------------- rancor
  const rancor = mundo.rancorEntre(de.id, contra.id);
  if (rancor > 4) {
    lista.push({
      id: 'rancor',
      texto: `vingança pelo sangue derramado por ${nome}`,
      peso: Math.min(BAL.tetoMotivoRancor, rancor * 0.4),
    });
  }

  // ------------------------------------------------------------------ terra
  // Reino apertado olhando para o vizinho folgado. A conta é por cabeça: o que
  // aperta não é o mapa ser pequeno, é ter mais gente que chão.
  const meuChao = de.territorio / Math.max(1, de.populacao);
  const chaoDele = contra.territorio / Math.max(1, contra.populacao);
  if (chaoDele > meuChao * 1.5 && de.populacao > 10) {
    lista.push({
      id: 'terra',
      texto: `terra: ${nome} tem mais chão do que precisa`,
      peso: Math.min(BAL.tetoMotivoTerra, (chaoDele / Math.max(0.1, meuChao) - 1.5) * 9),
    });
  }

  // ------------------------------------------------------------------- fome
  const minhaComida = comidaPorCabeca(mundo, de);
  const comidaDele = comidaPorCabeca(mundo, contra);
  if (minhaComida < 6 && comidaDele > minhaComida * 2) {
    lista.push({
      id: 'fome',
      texto: `fome: os celeiros de ${nome} estão cheios`,
      peso: Math.min(BAL.tetoMotivoFome, (6 - minhaComida) * 2.6),
    });
  }

  // ------------------------------------------------------------ oportunismo
  // Vizinho fraco é motivo por si só — para quem tem estômago para isso.
  if (contra.populacao > 0 && contra.populacao < de.populacao * 0.6) {
    const belico = especies.porIndice(de.especie).povo?.beligerancia ?? 0.5;
    lista.push({
      id: 'fraqueza',
      texto: `${nome} está fraco demais para se defender`,
      peso: BAL.tetoMotivoFraqueza * belico,
    });
  }

  // ---------------------------------------------------------------- aliança
  for (const amigo of de.aliancas) {
    if (contra.guerras.has(amigo)) {
      const r = mundo.reinos[amigo];
      lista.push({
        id: 'aliado',
        texto: `defesa de ${r?.nome ?? 'um aliado'}`,
        peso: BAL.tetoMotivoAliado,
      });
      break;
    }
  }

  return lista;
}

function mediaDeBeligerancia(ra: Reino, rb: Reino): number {
  const a = especies.porIndice(ra.especie).povo?.beligerancia ?? 0.5;
  const b = especies.porIndice(rb.especie).povo?.beligerancia ?? 0.5;
  return (a + b) / 2;
}

/** Comida guardada por morador em todo o reino. */
function comidaPorCabeca(mundo: Mundo, r: Reino): number {
  let comida = 0;
  let gente = 0;
  for (const id of r.aldeias) {
    const a = mundo.aldeias[id];
    if (!a?.ativa) continue;
    comida += a.estoque.comida;
    gente += a.populacao;
  }
  return comida / Math.max(1, gente);
}

/**
 * Conta quantos tiles de cada par de reinos se tocam.
 * Uma varredura só do mapa, olhando o vizinho da direita e o de baixo.
 */
function medirFronteiras(mundo: Mundo): Map<number, number> {
  const g = mundo.grid;
  const contagem = new Map<number, number>();

  for (let y = 0; y < g.altura; y++) {
    for (let x = 0; x < g.largura; x++) {
      const i = y * g.largura + x;
      const dono = g.territorio[i];
      if (dono < 0) continue;
      if (x + 1 < g.largura) somar(contagem, dono, g.territorio[i + 1]);
      if (y + 1 < g.altura) somar(contagem, dono, g.territorio[i + g.largura]);
    }
  }
  return contagem;
}

/**
 * Conta quantos pares de aldeias de reinos diferentes estão perto o bastante
 * para haver disputa por terra e caça.
 */
function medirVizinhanca(mundo: Mundo): Map<number, number> {
  const contagem = new Map<number, number>();
  const perto = BAL.distanciaDeAtrito * BAL.distanciaDeAtrito;
  const ativas = mundo.aldeias.filter((a) => a.ativa);
  for (let i = 0; i < ativas.length; i++) {
    for (let j = i + 1; j < ativas.length; j++) {
      const a = ativas[i];
      const b = ativas[j];
      if (a.reino === b.reino) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy > perto) continue;
      somar(contagem, a.reino, b.reino);
    }
  }
  return contagem;
}

function somar(m: Map<number, number>, a: number, b: number): void {
  if (b < 0 || a === b) return;
  m.set(chaveDoPar(a, b), (m.get(chaveDoPar(a, b)) ?? 0) + 1);
}

/**
 * Chave única para um par de reinos, na ordem que for.
 *
 * O deslocamento é de 16 bits e não de mil. Já foi `a * 1000 + b`, o que
 * bastava enquanto o mundo tinha meia dúzia de reinos — mas os ids de reino
 * deixaram de ser reaproveitados quando a rebelião entrou, e numa partida longa
 * eles passam de mil sem esforço. A partir dali as chaves começavam a colidir e
 * dois pares diferentes dividiam a mesma contagem de fronteira.
 */
function chaveDoPar(a: number, b: number): number {
  return a < b ? a * 65536 + b : b * 65536 + a;
}
