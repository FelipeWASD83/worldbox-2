import { type Grid } from '../core/grid.js';

/**
 * Descobre até onde a água encheria cada buraco do terreno.
 *
 * Terreno feito com ruído é cheio de covinhas: um tile mais fundo que todos os
 * oito vizinhos, sem saída. Numa conta de escoamento simples, **toda** a água
 * que desce a encosta cai na primeira covinha e para ali. Foi exatamente o que
 * aconteceu na primeira versão dos rios: o mapa saiu com centenas de poças e
 * nenhum rio, porque nenhuma gota chegava a percorrer mais que uma dúzia de
 * tiles antes de encontrar um buraco.
 *
 * A saída é a clássica: antes de escoar, **encher os buracos**. O algoritmo é o
 * "priority-flood" — parte do mar e caminha para dentro do continente sempre
 * pelo ponto mais baixo ainda não visitado, elevando quem estiver abaixo do
 * nível por onde a água teve de passar para chegar até ali. O que sai é a
 * altura da superfície da água: igual ao terreno onde não há buraco, e acima
 * dele onde há.
 *
 * Isso resolve duas coisas de uma vez. A água passa a ter caminho até o mar em
 * qualquer ponto do mapa, o que faz os rios existirem; e a diferença entre a
 * superfície e o terreno **é o lago** — funda onde a bacia é funda, rasa onde é
 * rasa, com o contorno que a bacia realmente tem. Lago deixa de ser um círculo
 * desenhado à mão e vira consequência do relevo.
 *
 * O terreno em si não é tocado: quem decide o que fazer com a informação é
 * `rios.ts`.
 */
/**
 * O caimento mínimo que um buraco cheio recebe.
 *
 * Pequeno o bastante para não mexer no relevo que se vê (a maior travessia de
 * um mundo continental soma menos de meio ponto de altitude) e grande o
 * bastante para o `Float32Array` distinguir um passo do seguinte.
 */
const EPSILON = 1e-4;

export interface Drenagem {
  /** Altura da superfície da água em cada tile. */
  readonly nivel: Float32Array;
  /**
   * Os tiles na ordem em que a frente de água os alcançou — que é a ordem
   * **crescente exata** de `nivel`, do mar para o alto das serras.
   *
   * Sai de graça do algoritmo e vale ouro: percorrida ao contrário, ela é a
   * ordem em que se pode somar a vazão com a garantia de que tudo o que
   * deságua num tile já foi contado antes de ele repassar adiante. A
   * primeira versão ordenava por conta própria, com contagem em 256 baldes
   * de altitude, e dentro de um mesmo balde a ordem era arbitrária: quando
   * dois tiles vizinhos caíam no mesmo balde, às vezes o de baixo era
   * somado antes do de cima e perdia a água dele. O sintoma era discreto e
   * difícil de rastrear — um punhado de tiles de rio soltos no meio do
   * campo, sem nascente nem foz.
   */
  readonly ordem: Int32Array;
}

export function preencherDepressoes(g: Grid): Drenagem {
  const total = g.total;
  const nivel = new Float32Array(total);
  const visitado = new Uint8Array(total);
  const ordem = new Int32Array(total);
  let saidas = 0;

  // Heap binário em arrays paralelos. Um heap de objetos alocaria um por tile —
  // são milhões deles num mapa continental, e o coletor de lixo apareceria no
  // meio da geração do mundo.
  const chave = new Float32Array(total + 1);
  const item = new Int32Array(total + 1);
  let tamanho = 0;

  function inserir(i: number, valor: number): void {
    let pos = ++tamanho;
    chave[pos] = valor;
    item[pos] = i;
    while (pos > 1) {
      const pai = pos >> 1;
      if (chave[pai] <= chave[pos]) break;
      const ck = chave[pai];
      const ci = item[pai];
      chave[pai] = chave[pos];
      item[pai] = item[pos];
      chave[pos] = ck;
      item[pos] = ci;
      pos = pai;
    }
  }

  function retirarMenor(): number {
    const topo = item[1];
    chave[1] = chave[tamanho];
    item[1] = item[tamanho];
    tamanho--;
    let pos = 1;
    for (;;) {
      const esq = pos << 1;
      if (esq > tamanho) break;
      const dir = esq + 1;
      let menor = dir <= tamanho && chave[dir] < chave[esq] ? dir : esq;
      if (chave[pos] <= chave[menor]) break;
      const ck = chave[menor];
      const ci = item[menor];
      chave[menor] = chave[pos];
      item[menor] = item[pos];
      chave[pos] = ck;
      item[pos] = ci;
      pos = menor;
    }
    return topo;
  }

  // A semente é o mar: é para lá que toda a água do mundo acaba indo, e é de lá
  // que a frente caminha continente adentro.
  for (let i = 0; i < total; i++) {
    if (!g.ehAgua(i)) continue;
    nivel[i] = g.alt[i];
    visitado[i] = 1;
    inserir(i, nivel[i]);
  }
  // Um mundo sem mar nenhum não tem para onde drenar: devolve o terreno como
  // está, e a conta de fluxo simplesmente não acha rio.
  if (tamanho === 0) {
    for (let i = 0; i < total; i++) {
      nivel[i] = g.alt[i];
      ordem[i] = i;
    }
    return { nivel, ordem };
  }

  const viz = new Int32Array(8);
  while (tamanho > 0) {
    const i = retirarMenor();
    ordem[saidas++] = i;
    const x = i % g.largura;
    const y = (i / g.largura) | 0;
    const n = g.vizinhos8(x, y, viz);
    for (let k = 0; k < n; k++) {
      const j = viz[k];
      if (visitado[j] === 1) continue;
      visitado[j] = 1;
      // O vizinho não pode ficar abaixo do nível por onde a água passou para
      // chegar até ele: se o terreno lá é mais fundo, aquilo é um buraco e a
      // água o encheu até esta altura.
      //
      // O `EPSILON` é o que salva o resultado. Sem ele, o buraco cheio vira um
      // platô perfeitamente plano, e um platô não tem para onde escoar: nenhum
      // vizinho é mais baixo, a água para ali e o mapa sai de novo sem rio
      // nenhum. Somando um fio de altura a cada passo para dentro do
      // continente, o platô ganha um caimento imperceptível **na direção de
      // volta ao mar**, que é justo o caminho que a água tomaria.
      nivel[j] = Math.max(g.alt[j], nivel[i] + EPSILON);
      inserir(j, nivel[j]);
    }
  }
  return { nivel, ordem: ordem.subarray(0, saidas) };
}
