import { NIVEL_MAR, type Grid } from '../core/grid.js';
import type { Rng } from '../core/rng.js';
import { B } from '../dados/biomas.js';
import { preencherDepressoes } from './depressoes.js';

/**
 * A rede de água doce do mundo: nascentes, córregos, rios largos e lagos.
 *
 * O jeito antigo era sortear alguns pontos altos e descer cada um pelo vizinho
 * mais baixo, escavando um tile de largura. Saíam riscos azuis de espessura
 * única, que nunca se encontravam e paravam no meio do nada — um rio de mil
 * quilômetros com a mesma largura da nascente.
 *
 * Aqui a conta é a de verdade, a mesma que a geografia usa: **acumulação de
 * fluxo**. Cada tile de terra recebe uma parcela de chuva, e essa água escorre
 * para o vizinho mais baixo. Processando o mapa **do ponto mais alto para o
 * mais baixo**, cada tile já sabe tudo o que chegou nele antes de repassar
 * adiante — uma passada só resolve o mapa inteiro.
 *
 * O que isso dá de graça, sem nenhuma regra extra:
 *
 * - **Nascentes**: o começo da linha carrega pouca água e é um fio.
 * - **Afluentes**: dois cursos que caem no mesmo tile somam a água ali, e o
 *   curso engrossa **a partir daquele ponto** — que é exatamente o que uma
 *   confluência é.
 * - **Rios grandes e pequenos**: a largura sai da raiz da vazão, então uma
 *   bacia enorme termina num rio largo e uma encosta curta termina num córrego.
 * - **Bacias**: onde a água chega e não tem para onde descer, ela se acumula —
 *   e é ali que nasce um lago, com o tamanho vindo do tanto que chegou.
 *
 * A ordem de processamento vem pronta de `depressoes.ts`, que já visita o mapa
 * do mar para o alto das serras — percorrida ao contrário, é exatamente a
 * ordem que a soma de vazão precisa, sem custar nenhuma ordenação a mais.
 */

/** Quanto de água cada tile de terra recebe por conta própria. */
const CHUVA_BASE = 1;
/**
 * Peso da umidade local na chuva do tile.
 *
 * Faz a selva encharcada render rio largo e o deserto render leito seco, o que
 * põe os grandes rios onde eles fazem sentido no mapa em vez de espalhá-los por
 * igual.
 */
const CHUVA_POR_UMIDADE = 2.2;

/**
 * Vazão a partir da qual o curso vira rio no mapa.
 *
 * Abaixo disso a água escorre sem cavar leito: é a diferença entre uma encosta
 * molhada e um córrego. O valor é por milhar de tiles de terra, para que um
 * mapa pequeno e um continental tenham a mesma densidade de rios em vez de o
 * grande virar um pântano de linhas azuis.
 */
const VAZAO_MINIMA_POR_MIL = 3.2;

/** Vazão que dobra a largura do rio. Quanto menor, mais rio largo. */
const VAZAO_PARA_ALARGAR = 900;

/** Largura máxima de um rio, em tiles de raio. */
const RAIO_MAXIMO = 3.4;

/**
 * Quanto a água precisa ter subido acima do terreno para aquilo ser lago.
 *
 * Abaixo disso é só uma irregularidade do relevo que a conta de preenchimento
 * nivelou, e marcar aquilo como lago encheria o mapa de poças de um tile.
 */
const FUNDURA_MINIMA_DE_LAGO = 1.5;

/**
 * Que fração da vazão de um rio basta para encher um lago.
 *
 * Menor que a de rio: a bacia junta a água em vez de escoá-la, então um fio
 * d'água que chega a um vale fechado forma espelho, enquanto o mesmo fio numa
 * encosta não cava leito nenhum.
 */
const FRACAO_PARA_LAGO = 0.35;

/**
 * Escava a rede de água doce no grid.
 *
 * Roda depois de a altitude e a umidade estarem prontas e antes de os biomas
 * finais serem decididos: o rio muda a altitude do leito e molha a margem, e as
 * duas coisas mudam o bioma de quem está por perto.
 *
 * `forca` multiplica a chuva: é o controle de "quanta água" na criação do mundo.
 */
export function escavarRios(g: Grid, rng: Rng, forca = 1): void {
  const total = g.total;

  // ------------------------------- 1. até onde a água encheria cada buraco
  // Sem isto não existe rio nenhum: o terreno de ruído é cheio de covinhas, e
  // toda gota para na primeira. Ver `src/sim/depressoes.ts`.
  const { nivel, ordem } = preencherDepressoes(g);

  // ------------------------------------------------- 2. para onde cada um escoa
  // O escoamento segue a **superfície da água**, e não o terreno: é o que faz a
  // água atravessar um buraco cheio em vez de morrer dentro dele.
  const escoa = new Int32Array(total).fill(-1);
  const vazao = new Float32Array(total);
  const viz = new Int32Array(8);

  let tilesDeTerra = 0;
  for (let i = 0; i < total; i++) {
    if (g.ehAgua(i)) continue;
    tilesDeTerra++;
    // A chuva varia com a umidade do lugar, e um respingo de acaso evita que
    // duas encostas idênticas produzam exatamente o mesmo rio.
    vazao[i] =
      (CHUVA_BASE + (g.umidade[i] / 255) * CHUVA_POR_UMIDADE) * forca * rng.entre(0.85, 1.15);

    const x = i % g.largura;
    const y = (i / g.largura) | 0;
    const n = g.vizinhos8(x, y, viz);
    let destino = -1;
    let menor = nivel[i];
    for (let k = 0; k < n; k++) {
      const j = viz[k];
      if (nivel[j] < menor) {
        menor = nivel[j];
        destino = j;
      }
    }
    escoa[i] = destino;
  }
  if (tilesDeTerra === 0) return;

  // ----------------------------------------------------- 3. somar a água descendo
  // `ordem` vem do preenchimento na ordem crescente exata de nível; percorrida
  // ao contrário, ela garante que tudo o que deságua num tile já foi somado
  // antes de ele repassar adiante. Uma passada resolve o mapa inteiro.
  for (let k = ordem.length - 1; k >= 0; k--) {
    const i = ordem[k];
    const destino = escoa[i];
    if (destino < 0) continue;
    if (g.ehAgua(destino)) continue; // chegou no mar
    vazao[destino] += vazao[i];
  }

  // ------------------------------------------------------------- 4. os lagos
  // Onde a água precisou subir acima do terreno para achar saída, há bacia — e
  // bacia com água chegando é lago. O contorno sai do relevo, então o lago tem
  // a forma do vale em vez de ser um círculo carimbado no mapa.
  const limiar = (VAZAO_MINIMA_POR_MIL * tilesDeTerra) / 1000;
  for (let i = 0; i < total; i++) {
    if (g.ehAgua(i)) continue;
    const fundura = nivel[i] - g.alt[i];
    if (fundura < FUNDURA_MINIMA_DE_LAGO) continue;
    if (vazao[i] < limiar * FRACAO_PARA_LAGO) continue;
    g.bioma[i] = B.lago;
    // Afundar o terreno junto não é enfeite: no motor, água **é** altitude
    // abaixo do nível do mar (`Grid.ehAgua`), e um tile com cara de lago mas
    // altura de encosta continuava sendo chão firme para todo o resto do jogo —
    // bicho andava por cima, aldeia construía dentro, e o rio que descia até ali
    // ficava sem vizinho de água nenhum, virando uma poça solta no mapa.
    //
    // O efeito colateral é que um lago de montanha perde a altitude de montanha.
    // Visto de cima não muda nada, e vale muito mais que o alternativo: mexer em
    // `ehAgua` para consultar o bioma, num laço que roda milhões de vezes por
    // tick e que o pincel de terreno do jogador também usa.
    g.alt[i] = NIVEL_MAR - 1 - Math.min(4, Math.round(fundura));
    g.umidade[i] = 255;
  }

  // --------------------------------------------------------- 5. cavar os leitos
  // Depois dos lagos, de propósito: o tile que virou lago já é água, e o rio
  // passa por baixo dele sem redesenhar nada — o curso entra de um lado do
  // lago e sai do outro, como acontece de verdade.
  for (let k = 0; k < ordem.length; k++) {
    const i = ordem[k];
    if (g.ehAgua(i)) continue;
    if (vazao[i] < limiar) continue;
    // A largura vem da raiz da vazão porque é assim que um rio se comporta:
    // dobrar a largura exige muito mais que o dobro de água. Com proporção
    // direta, o trecho final de qualquer bacia grande virava um mar interior.
    const raio = Math.min(RAIO_MAXIMO, Math.sqrt(vazao[i] / VAZAO_PARA_ALARGAR));
    cavar(g, i, raio, viz);
  }
}

/**
 * Abre água num disco em volta do tile e molha a margem.
 *
 * Raio abaixo de meio tile ainda cava o tile do meio: é o córrego, que tem de
 * aparecer no mapa mesmo sendo fino, senão a rede de drenagem fica cheia de
 * buracos onde os afluentes deveriam começar.
 */
function cavar(g: Grid, centro: number, raio: number, viz: Int32Array, lago = false): void {
  const cx = centro % g.largura;
  const cy = (centro / g.largura) | 0;
  const alcance = Math.max(0, Math.ceil(raio));
  const fundo = lago ? NIVEL_MAR - 5 : NIVEL_MAR - 2;

  for (let y = cy - alcance; y <= cy + alcance; y++) {
    if (y < 0 || y >= g.altura) continue;
    for (let x = cx - alcance; x <= cx + alcance; x++) {
      if (x < 0 || x >= g.largura) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > raio && !(x === cx && y === cy)) continue;
      const i = g.idx(x, y);
      if (g.alt[i] < NIVEL_MAR) continue; // já é mar: não mexe
      g.alt[i] = fundo;
      g.bioma[i] = lago ? B.lago : B.rio;
      g.umidade[i] = Math.min(255, g.umidade[i] + 70);
    }
  }

  // a margem fica úmida: é o que faz o rio atravessar o deserto com uma faixa
  // verde dos dois lados, como um rio de verdade faz
  const margem = alcance + 1;
  for (let y = cy - margem; y <= cy + margem; y++) {
    if (y < 0 || y >= g.altura) continue;
    for (let x = cx - margem; x <= cx + margem; x++) {
      if (x < 0 || x >= g.largura) continue;
      const i = g.idx(x, y);
      if (g.ehAgua(i)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > margem) continue;
      g.umidade[i] = Math.min(255, g.umidade[i] + Math.round(55 / (1 + d)));
    }
  }
  void viz;
}
