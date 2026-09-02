import { Ruido } from '../core/ruido.js';
import { Rng } from '../core/rng.js';
import { NIVEL_MAR, NIVEL_MONTANHA, type Grid } from '../core/grid.js';
import type { Mundo } from '../core/mundo.js';
import { B, BIOMA_FERTIL, biomas } from '../dados/biomas.js';
import {
  recursos, REC_DENSIDADE_NO_BIOMA, REC_QUANTIDADE, REC_SPRITE,
} from '../dados/recursos.js';
import {
  ESPECIES_SELVAGENS, ESPECIES_CIVILIZADAS, especies,
} from '../dados/especies.js';
import { nomeDeAldeia, nomeDeReino } from '../dados/nomes.js';
import { ED } from '../dados/edificios.js';
import { escavarRios } from './rios.js';

export interface OpcoesGeracao {
  /** Fração do mapa que deve ser terra firme (0..1). */
  fracaoTerra?: number;
  /**
   * Quanta água doce o mundo tem. 1 = padrão; 0 deixa o mapa quase seco.
   *
   * Não é mais uma contagem de rios: a rede de drenagem é calculada do mapa
   * inteiro de uma vez, e o que este número regula é a chuva que alimenta
   * essa rede. Mais chuva não põe mais riscos azuis no mapa — engrossa os
   * que já existiam e faz nascer afluente onde antes era só encosta.
   */
  rios?: number;
  /** Quantidade relativa de bichos ao povoar (1 = padrão). */
  densidadeAnimais?: number;
  /** Quantos reinos começam no mapa. 0 = mundo virgem. */
  civilizacoes?: number;
  /** Deixa espécies raras receberem reforço de fora do mapa. */
  migracao?: boolean;
  /** 0 = terreno manso, 1 = cheio de cordilheira. */
  montanhas?: number;
  /** 0 = um continente só, 1 = arquipélago. */
  ilhas?: number;
  /** -1 = mundo gelado, 0 = temperado, 1 = escaldante. */
  clima?: number;
  /** 0 = deserto seco, 1 = muito úmido. */
  umidadeGlobal?: number;
  /** Multiplicador da quantidade de minério e floresta. */
  riqueza?: number;
}

/**
 * Decide o bioma de um tile a partir de altitude, temperatura e umidade.
 *
 * Fica separado porque o pincel de terreno do jogador usa a mesma tabela:
 * levantar o chão com a ferramenta produz o mesmo bioma que a geração produziria.
 */
export function biomaDe(alt: number, temp: number, umid: number): number {
  // ------------------------------------------------------------------ água
  if (alt < NIVEL_MAR) {
    // mar que congela nos extremos frios
    if (temp < 34 && alt > NIVEL_MAR - 26) return B.gelo;
    if (alt < NIVEL_MAR - 34) return B.oceano_profundo;
    if (alt < NIVEL_MAR - 12) return B.oceano;
    return B.raso;
  }

  // ----------------------------------------------------------------- altura
  if (alt >= 238) return B.pico;
  if (alt >= NIVEL_MONTANHA) return B.montanha;
  if (alt < NIVEL_MAR + FAIXA_DE_PRAIA) {
    // faixa da costa: manguezal onde é quente e encharcado, praia no resto
    if (temp > 165 && umid > 190) return B.mangue;
    return B.praia;
  }

  // --------------------------------------------------------- casos especiais
  if (umid > 205 && alt < NIVEL_MAR + 14 && temp > 105) return B.pantano;
  // mancha verde no meio do deserto
  if (temp > 185 && umid > 96 && umid < 138) return B.oasis;

  // ------------------------------------------------------------------- frio
  if (temp < 58) return umid > 118 ? B.neve : B.tundra;
  if (temp < 96) return umid > 112 ? B.taiga : B.tundra;

  // ---------------------------------------------------------------- temperado
  if (temp < 152) {
    if (umid > 200) return B.campo_fertil;
    if (umid > 152) return B.floresta;
    if (umid > 92) return B.planicie;
    return B.savana;
  }

  // ------------------------------------------------------------------ quente
  if (temp < 198) {
    if (umid > 192) return B.selva;
    if (umid > 148) return B.floresta;
    if (umid > 106) return B.planicie;
    if (umid > 68) return B.savana;
    return B.deserto;
  }
  if (umid > 198) return B.selva;
  if (umid > 112) return B.savana;
  // seco e escaldante racha o chão
  if (umid < 40) return B.terra_rachada;
  return B.deserto;
}

/** Gera terreno, clima e biomas no grid do mundo. Não põe criaturas. */
export function gerarTerreno(mundo: Mundo, op: OpcoesGeracao = {}): void {
  const g = mundo.grid;
  const L = g.largura;
  const A = g.altura;
  const rng = new Rng(mundo.semente);
  const ruidoAlt = new Ruido(rng.u32());
  const ruidoCont = new Ruido(rng.u32());
  const ruidoCrista = new Ruido(rng.u32());
  const ruidoUmid = new Ruido(rng.u32());
  const ruidoTemp = new Ruido(rng.u32());

  const fracaoTerra = op.fracaoTerra ?? 0.4;
  // Padrão baixo de propósito: com 0,5 a serra tomava mais de um quarto do
  // chão firme, e montanha é terreno morto — nada nasce, ninguém mora e os
  // bichos evitam. O mundo interessante é o que sobra.
  const montanhas = op.montanhas ?? 0.3;
  // padrão puxado para o continental: com muito arquipélago as civilizações
  // ficam ilhadas e nunca se encontram
  const ilhas = op.ilhas ?? 0.15;
  const clima = op.clima ?? 0;
  const umidadeGlobal = op.umidadeGlobal ?? 0.5;
  // arquipélago = ruído de frequência mais alta: muitos pedaços pequenos em vez
  // de uma massa só
  const escala = (3.2 + ilhas * 5.5) / Math.max(L, A);

  // ------------------------------------------------------- 1. altitude bruta
  const bruto = new Float32Array(g.total);
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const nx = x * escala;
      const ny = y * escala;
      const detalhe = ruidoAlt.fbm(nx * 2.2, ny * 2.2, 5, 0.5, 2);
      const continente = ruidoCont.fbm(nx * 0.6 + 50, ny * 0.6 + 50, 3, 0.55, 2);
      // quanto mais "ilhas", menos peso tem a massa continental
      let h = continente * (0.72 - ilhas * 0.34) + detalhe * (0.42 + ilhas * 0.3);

      // afunda as bordas: o mapa é uma ilha grande cercada de oceano, e assim
      // nenhuma criatura fica encurralada na parede do mundo
      const bx = Math.min(x, L - 1 - x) / (L * 0.5);
      const by = Math.min(y, A - 1 - y) / (A * 0.5);
      // a moldura de oceano é mais estreita no topo e na base: são as faixas
      // frias do mapa, e afundá-las tanto quanto as laterais deixava o mundo
      // praticamente sem tundra nem neve
      const borda = Math.min(1, Math.min(bx / 0.22, by / 0.13));
      h -= (1 - borda) * (1 - borda) * 1.35;

      bruto[y * L + x] = h;
    }
  }

  // ------------------------------------- 2. nível do mar pela fração de terra
  const amostras = new Float32Array(4096);
  for (let k = 0; k < amostras.length; k++) amostras[k] = bruto[rng.int(g.total)];
  amostras.sort();
  const limiar = amostras[Math.floor((1 - fracaoTerra) * (amostras.length - 1))];

  // ---------------------------------------- 3. normalizar + erguer cordilheiras
  let maiorAcima = 0.0001;
  let menorAbaixo = -0.0001;
  for (let i = 0; i < g.total; i++) {
    const d = bruto[i] - limiar;
    if (d > maiorAcima) maiorAcima = d;
    if (d < menorAbaixo) menorAbaixo = d;
  }
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const d = bruto[i] - limiar;
      let alt: number;
      if (d >= 0) {
        let t = d / maiorAcima; // 0..1 acima do nível do mar
        // cristas só onde já há terra: montanha no meio do continente, não no mar
        const crista = ruidoCrista.cristas(x * escala * 2.6 + 20, y * escala * 2.6 + 20, 4);
        t = t * (0.86 - montanhas * 0.4) + crista * t * (0.35 + montanhas * 1.5);
        t = Math.min(1, t);
        alt = NIVEL_MAR + t * (255 - NIVEL_MAR);
      } else {
        const t = d / menorAbaixo; // 0..1 abaixo
        alt = NIVEL_MAR - 1 - t * (NIVEL_MAR - 1);
      }
      g.alt[i] = Math.max(0, Math.min(255, Math.round(alt)));
    }
  }

  // --------------------------------------------------- 4. distância até a água
  const distAgua = distanciaAteAgua(g);

  // ------------------------------------------------ 5. temperatura e umidade
  for (let y = 0; y < A; y++) {
    const lat = Math.abs(y / (A - 1) - 0.5) * 2; // 0 no equador, 1 nos polos
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const nx = x * escala;
      const ny = y * escala;

      let t = 1 - lat;
      t = t * 0.86 + (ruidoTemp.fbm(nx * 1.4 + 300, ny * 1.4 + 300, 3) * 0.5 + 0.5) * 0.14;
      const acima = Math.max(0, g.alt[i] - NIVEL_MAR) / (255 - NIVEL_MAR);
      t -= acima * acima * 0.5;
      t += clima * 0.3; // mundo gelado ou escaldante
      g.temp[i] = Math.max(0, Math.min(255, Math.round(t * 255)));

      let u = ruidoUmid.fbm(nx * 1.7 + 700, ny * 1.7 + 700, 4) * 0.5 + 0.5;
      u = u * 0.72 + Math.max(0, 1 - distAgua[i] / 26) * 0.34;
      u -= acima * 0.18;
      u += (umidadeGlobal - 0.5) * 0.42;
      g.umidade[i] = Math.max(0, Math.min(255, Math.round(u * 255)));
    }
  }

  // ---------------------------------------------------------------- 6. biomas
  for (let i = 0; i < g.total; i++) {
    g.bioma[i] = biomaDe(g.alt[i], g.temp[i], g.umidade[i]);
  }

  // ------------------------------------------------------------------ 7. rios
  // A conta da água é uma só e mora em `src/sim/rios.ts`: acumulação de
  // fluxo pelo mapa inteiro, que é de onde saem nascente, afluente, rio
  // largo e lago sem nenhuma regra especial para cada um.
  escavarRios(g, rng, op.rios ?? 1);

  // ------------------------------------------------- 8. vegetação e variação
  for (let i = 0; i < g.total; i++) {
    g.matiz[i] = rng.int(256);
    const fert = BIOMA_FERTIL[g.bioma[i]];
    g.vegetacao[i] = Math.round(Math.min(255, fert * 255 * rng.entre(0.45, 1)));
    g.fogo[i] = 0;
    g.territorio[i] = -1;
    g.construcao[i] = 0;
    g.aldeiaDona[i] = -1;
    g.recurso[i] = 0;
    g.recursoQtd[i] = 0;
  }

  // -------------------------------------------------------------- 9. vulcões
  // Depois da limpeza acima, e não antes: o vulcão agora grava em
  // `g.construcao`, e aquele laço zera o mapa inteiro. Plantado antes, ele era
  // apagado no mesmo instante e o mundo ficava sem vulcão nenhum.
  mundo.vulcoes = [];
  mundo.bombas = [];
  abrirVulcoes(g, rng, Math.round(1 + montanhas * 3), mundo.vulcoes);

  // ------------------------------------------------------------ 10. recursos
  espalharRecursos(g, rng, op.riqueza ?? 1);

  g.marcarTudoSujo();
}

/**
 * Planta vulcões em pontos altos.
 *
 * O vulcão é **um objeto**, como uma árvore: um tile de chão e um desenho alto
 * por cima, que entra na varredura de profundidade junto com o resto. Antes ele
 * era uma cratera pintada num círculo de até seis tiles de raio, e de perto não
 * se lia como montanha de fogo — era uma mancha escura com miolo vermelho
 * espalhada pelo mapa. Só a rocha chamuscada em volta ficou, e bem menor: dá o
 * contexto sem comer o terreno.
 */
/**
 * Até que altura acima do nível do mar a costa ainda é praia.
 *
 * Era 3, o que dava um fio de areia de um ou dois tiles que sumia no zoom. Uma
 * faixa larga muda o mapa inteiro: dá onde desembarcar, onde a palmeira nascer
 * e um contorno claro entre o mar e o verde.
 */
const FAIXA_DE_PRAIA = 8;

function abrirVulcoes(g: Grid, rng: Rng, quantidade: number, centros: number[]): void {
  for (let v = 0; v < quantidade; v++) {
    // encosta de montanha, não pico nevado: vulcão no meio da neve fica só um
    // borrão vermelho e não se lê como vulcão
    let centro = -1;
    for (let t = 0; t < 600; t++) {
      const i = rng.int(g.total);
      if (g.alt[i] > NIVEL_MONTANHA && g.alt[i] < 214) {
        centro = i;
        break;
      }
    }
    if (centro < 0) continue;
    centros.push(centro);
    const cx = centro % g.largura;
    const cy = (centro / g.largura) | 0;

    // um anel curto de rocha chamuscada, só para o pé do vulcão não nascer
    // no meio do capim
    const raio = rng.intEntre(1, 2);
    for (let y = cy - raio; y <= cy + raio; y++) {
      if (y < 0 || y >= g.altura) continue;
      for (let x = cx - raio; x <= cx + raio; x++) {
        if (x < 0 || x >= g.largura) continue;
        if (Math.hypot(x - cx, y - cy) > raio) continue;
        const i = g.idx(x, y);
        g.alt[i] = Math.min(255, Math.max(g.alt[i], NIVEL_MONTANHA + 4));
        g.bioma[i] = B.vulcao;
        g.vegetacao[i] = 0;
        g.recurso[i] = 0;
        g.construcao[i] = 0;
        g.ocupacao[i] = -1;
      }
    }

    // e o cone em cima do tile do meio
    g.construcao[centro] = ED.vulcao + 1;
    g.ocupar(centro, 1, 1);
  }
}

/**
 * Espalha árvores, arbustos, pedra e minério pelos biomas de cada recurso.
 *
 * Uma passada só pelo mapa: para cada tile, os recursos que aceitam aquele
 * bioma disputam a vaga por sorteio. Varrer o mapa uma vez por recurso seria
 * nove varreduras num mundo de até 330 mil tiles.
 */
function espalharRecursos(g: Grid, rng: Rng, riqueza: number): void {
  // para cada bioma, a lista de recursos que nascem nele
  const porBioma: Array<Array<{ indice: number; densidade: number; largo: boolean }>> = [];
  for (let b = 0; b < biomas.tamanho; b++) porBioma.push([]);

  for (const def of recursos.todos()) {
    const indice = recursos.indice(def.id);
    // "largo" é o que exige espaço entre um e outro: árvore de copa aberta
    const largo = def.sprite[0] >= 2 && def.sprite[1] >= 3;

    for (let b = 0; b < biomas.tamanho; b++) {
      if (biomas.porIndice(b).agua) continue;
      // A densidade vem pronta da tabela de `recursos.ts`, que é a mesma que a
      // rebrota consulta. Enquanto esta conta morava aqui, era a única, e a
      // rebrota plantava copiando o vizinho sem olhar o bioma.
      const densidade = REC_DENSIDADE_NO_BIOMA[indice * biomas.tamanho + b];
      if (densidade <= 0) continue;
      porBioma[b].push({ indice, densidade, largo });
    }
  }

  // Sorteia a ordem de disputa por tile a cada mundo, senão o primeiro da lista
  // (a árvore) leva sempre a vaga e minério nenhum aparece fora da rocha.
  for (const lista of porBioma) rng.embaralhar(lista);

  const viz = new Int32Array(8);
  for (let i = 0; i < g.total; i++) {
    // o vulcão já está de pé neste ponto da geração, e árvore não nasce por
    // cima dele
    if (g.construcao[i] !== 0 || g.ocupacao[i] !== -1) continue;
    const lista = porBioma[g.bioma[i]];
    if (lista.length === 0) continue;
    for (const { indice, densidade, largo } of lista) {
      if (!rng.chance(densidade * riqueza)) continue;
      // Copa larga precisa de espaço: sem esta folga, uma mata de árvores de
      // três tiles de largura vira uma mancha verde só, sem árvore nenhuma
      // reconhecível dentro dela.
      if (largo && temVizinhoLargo(g, i, viz)) break;
      g.recurso[i] = indice + 1;
      g.recursoQtd[i] = Math.round(REC_QUANTIDADE[indice] * rng.entre(0.55, 1));
      break; // um recurso por tile
    }
  }
}

/** Já há um objeto de copa larga encostado neste tile? */
function temVizinhoLargo(g: Grid, i: number, viz: Int32Array): boolean {
  const x = i % g.largura;
  const y = (i / g.largura) | 0;
  const n = g.vizinhos8(x, y, viz);
  for (let k = 0; k < n; k++) {
    const r = g.recurso[viz[k]];
    if (r !== 0 && REC_SPRITE[(r - 1) * 2] >= 2) return true;
  }
  return false;
}

/**
 * Semeia recursos num mundo que foi salvo antes de eles existirem.
 * Usa a semente do próprio mundo, então o resultado é estável.
 */
export function semearRecursosEmMundoAntigo(mundo: Mundo): void {
  espalharRecursos(mundo.grid, new Rng(`${mundo.semente}:recursos`), 1);
  mundo.grid.marcarTudoSujo();
}

/** Distância aproximada, em tiles, de cada ponto até a água mais próxima. */
function distanciaAteAgua(g: Grid): Int32Array {
  const dist = new Int32Array(g.total).fill(0x7fffffff);
  const fila = new Int32Array(g.total);
  let cabeca = 0;
  let cauda = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.ehAgua(i)) {
      dist[i] = 0;
      fila[cauda++] = i;
    }
  }
  const viz = new Int32Array(4);
  while (cabeca < cauda) {
    const i = fila[cabeca++];
    const x = i % g.largura;
    const y = (i / g.largura) | 0;
    const n = g.vizinhos4(x, y, viz);
    for (let k = 0; k < n; k++) {
      const j = viz[k];
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        fila[cauda++] = j;
      }
    }
  }
  return dist;
}

/** Espalha animais e, se pedido, funda os primeiros reinos. */
export function povoar(mundo: Mundo, op: OpcoesGeracao = {}): void {
  const g = mundo.grid;
  const rng = mundo.rng;
  const densidade = op.densidadeAnimais ?? 1;
  mundo.definirTetosDeFauna(densidade);

  // ---------------------------------------------------------------- animais
  // Cada espécie recebe uma cota proporcional à frequência dela e procura um
  // tile do bioma que lhe serve.
  //
  // A busca é por sorteio, e não por lista de candidatos: num mapa enorme uma
  // lista de tiles de um bioma passa de cem mil itens, e montá-la estourava a
  // pilha — o mundo simplesmente não era criado, sem nenhum aviso na tela.
  // Um quarto da densidade da primeira versão: com o número antigo o mapa
  // virava um tapete de bichos e não dava para ver o terreno por baixo.
  const alvoTotal = Math.min(
    mundo.criaturas.capacidade * 0.12,
    (g.total / 950) * densidade * 10,
  );
  let pesoTotal = 0;
  for (const idx of ESPECIES_SELVAGENS) pesoTotal += especies.porIndice(idx).frequencia;

  for (const idx of ESPECIES_SELVAGENS) {
    const def = especies.porIndice(idx);
    const cota = Math.round((def.frequencia / pesoTotal) * alvoTotal);
    const aceitos = new Set<number>();
    for (const idBioma of def.biomas) {
      const b = indiceBiomaSeguro(idBioma);
      if (b >= 0) aceitos.add(b);
    }
    if (aceitos.size === 0) continue;

    for (let n = 0; n < cota; n++) {
      let i = -1;
      for (let t = 0; t < 120; t++) {
        const candidato = rng.int(g.total);
        if (aceitos.has(g.bioma[candidato])) {
          i = candidato;
          break;
        }
      }
      if (i < 0) break; // o bioma dessa espécie não existe neste mundo
      const x = (i % g.largura) + rng.f();
      const y = ((i / g.largura) | 0) + rng.f();
      mundo.nascer(idx, x, y, rng.entre(0, def.longevidade[0] * 0.4));
    }
  }

  // ----------------------------------------------------------- civilizações
  const quantosReinos = op.civilizacoes ?? 4;
  if (quantosReinos > 0) fundarCivilizacoesIniciais(mundo, quantosReinos);
}

function indiceBiomaSeguro(id: string): number {
  return (B as Record<string, number>)[id] ?? -1;
}

/** Escolhe bons lugares e funda um reino de cada povo. */
export function fundarCivilizacoesIniciais(mundo: Mundo, quantidade: number): void {
  const g = mundo.grid;
  const rng = mundo.rng;
  const povos = [...ESPECIES_CIVILIZADAS];
  rng.embaralhar(povos);

  const jaUsados: Array<[number, number]> = [];
  const distanciaMinima = Math.min(g.largura, g.altura) * 0.28;

  for (let n = 0; n < quantidade; n++) {
    const especieIdx = povos[n % povos.length];
    const def = especies.porIndice(especieIdx);
    const preferidos = new Set(def.povo?.prefereBiomas ?? def.biomas);

    let melhor = -1;
    let melhorNota = -1;
    for (let tentativa = 0; tentativa < 3000; tentativa++) {
      const i = rng.int(g.total);
      if (!g.ehTerra(i) || g.ehMontanha(i)) continue;
      const x = i % g.largura;
      const y = (i / g.largura) | 0;
      let longe = true;
      for (const [ux, uy] of jaUsados) {
        if (Math.hypot(ux - x, uy - y) < distanciaMinima) {
          longe = false;
          break;
        }
      }
      if (!longe) continue;
      const idBioma = nomeBioma(g.bioma[i]);
      let nota = preferidos.has(idBioma) ? 3 : 0.4;
      nota += BIOMA_FERTIL[g.bioma[i]];
      nota += rng.f() * 0.5;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = i;
      }
    }
    if (melhor < 0) continue;

    const x = melhor % g.largura;
    const y = (melhor / g.largura) | 0;
    jaUsados.push([x, y]);

    const reino = mundo.criarReino(
      especieIdx,
      nomeDeReino(rng, def.id),
      def.povo?.corReino ?? 0x888888,
    );
    const aldeia = mundo.criarAldeia(reino.id, especieIdx, x, y, nomeDeAldeia(rng, def.id));
    reino.capital = aldeia.id;

    // Primeiros moradores. A idade vai por fração da longevidade da espécie:
    // um valor fixo em ticks fazia os orcs, que vivem menos, começarem a
    // partida já velhos — e o povo inteiro morria de velhice sem ter um filho.
    const quantos = rng.intEntre(8, 12);
    for (let k = 0; k < quantos; k++) {
      const cx = x + rng.entre(-2, 2);
      const cy = y + rng.entre(-2, 2);
      const idade = rng.entre(def.longevidade[0] * 0.16, def.longevidade[0] * 0.34);
      const c = mundo.nascer(especieIdx, cx, cy, idade);
      if (c < 0) continue;
      mundo.criaturas.aldeia[c] = aldeia.id;
      mundo.criaturas.reino[c] = reino.id;
      aldeia.populacao++;
    }
  }
}

function nomeBioma(indice: number): string {
  for (const [nome, idx] of Object.entries(B)) {
    if (idx === indice) return nome;
  }
  return '';
}
