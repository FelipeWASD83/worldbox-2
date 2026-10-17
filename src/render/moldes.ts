/**
 * Moldes dos sprites, em 16×16.
 *
 * Cada caractere é um pixel: `1` corpo, `2` detalhe, `3` sombra, `4` um tom
 * claro do corpo e `5` um tom escuro, os dois calculados a partir da cor da
 * espécie. Ponto é transparente.
 *
 * Dezesseis pixels é o tamanho em que dá para ler chifre, cauda, asa e
 * equipamento sem que o desenho vire ilustração — que não caberia em dezenas de
 * espécies desenhadas à mão aqui dentro.
 *
 * Todos olham para a direita; a versão espelhada é gerada no boot.
 */

export const LADO_SPRITE = 16;

export type Molde = readonly string[];

export const MOLDES: Record<string, Molde> = {
  // ------------------------------------------------------------- quadrúpede
  // lobo, veado, coelho, ovelha, raposa, javali
  quadrupede: [
    '................',
    '................',
    '...........44...',
    '..........4441..',
    '..........42441.',
    '..4444444444441.',
    '.44444444444444.',
    '5444444444444444',
    '.5555555555555..',
    '.15555555555551.',
    '..3..3....3..3..',
    '..3..3....3..3..',
    '..5..5....5..5..',
    '..5..5....5..5..',
    '................',
    '................',
  ],

  // ------------------------------------------------------------------ grande
  // urso, tigre — mais alto, cabeça maior, patas grossas
  grande: [
    '................',
    '................',
    '..........4444..',
    '.........444441.',
    '.........4224441',
    '.........4444441',
    '.4444444444444..',
    '44444444444444..',
    '4111111111111444',
    '4111111111111444',
    '.55555555555555.',
    '.5555555555555..',
    '.33..33...33..3.',
    '.33..33...33..3.',
    '.55..55...55..5.',
    '................',
  ],

  // ------------------------------------------------------------------ bípede
  // humano, elfo, anão, orc, zumbi. As colunas 4 e 11 ficam livres de
  // propósito: é onde a arma e o escudo são desenhados por cima.
  bipede: [
    '................',
    '................',
    '......4444......',
    '.....444444.....',
    '.....411114.....',
    '.....421124.....',
    '.....444444.....',
    '......2222......',
    '....222222222...',
    '....422222224...',
    '.....222222.....',
    '.....2....2.....',
    '.....1....1.....',
    '.....5....5.....',
    '....33....33....',
    '................',
  ],

  // ------------------------------------------------------------------- peixe
  peixe: [
    '................',
    '................',
    '................',
    '................',
    '..2.....444.....',
    '..22..44444444..',
    '..222444111144..',
    '.2222441111144..',
    '.22224411111444.',
    '..222444111144..',
    '..22..44444444..',
    '..2.....444.....',
    '................',
    '................',
    '................',
    '................',
  ],

  // -------------------------------------------------------------------- ave
  ave: [
    '................',
    '................',
    '................',
    '..........444...',
    '.........42441..',
    '.......4444444..',
    '..2222444444....',
    '.22222244444....',
    '..2222444444....',
    '.......444444...',
    '.........33.....',
    '.........33.....',
    '................',
    '................',
    '................',
    '................',
  ],

  // ---------------------------------------------------------------- pinguim
  pinguim: [
    '................',
    '................',
    '.......444......',
    '......41414.....',
    '......44244.....',
    '......4444......',
    '.....144441.....',
    '....1122221.....',
    '....1122221.....',
    '....1122221.....',
    '....1222221.....',
    '.....122221.....',
    '.....144441.....',
    '......2222......',
    '......22.22.....',
    '................',
  ],

  // ----------------------------------------------------------------- serpente
  serpente: [
    '................',
    '................',
    '................',
    '................',
    '.........444444.',
    '........44....42',
    '.......44.....4.',
    '..4444444.......',
    '.44....444......',
    '.4.......4444...',
    '.44.........44..',
    '..4444......44..',
    '.....4444444....',
    '................',
    '................',
    '................',
  ],

  // ------------------------------------------------------------------ aranha
  aranha: [
    '................',
    '..3..........3..',
    '..33........33..',
    '...33......33...',
    '....3......3....',
    '.....444444.....',
    '....44444444....',
    '...4411441144...',
    '...4411441144...',
    '....44222244....',
    '.....444444.....',
    '....3......3....',
    '...33......33...',
    '..33........33..',
    '..3..........3..',
    '................',
  ],

  // ------------------------------------------------------------------ dragão
  dragao: [
    '................',
    '..22........22..',
    '..222......222..',
    '..2222....2222..',
    '..22222..22222..',
    '...22222222222..',
    '....222222222...',
    '.....4444444....',
    '...444444444444.',
    '..4441111144444.',
    '...44111114444..',
    '....444444444...',
    '.....33....33...',
    '.....33....33...',
    '.....55....55...',
    '................',
  ],
};

/** Desenhos de arma e escudo, sobrepostos ao bípede. Cor vem do equipamento. */
export const MOLDES_EQUIPAMENTO: Record<string, Molde> = {
  espada: [
    '................',
    '................',
    '................',
    '................',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '..........aaa...',
    '...........a....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  lanca: [
    '................',
    '...........a....',
    '..........aaa...',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  machado: [
    '................',
    '................',
    '................',
    '..........aaa...',
    '.........aaaaa..',
    '..........aaa...',
    '...........a....',
    '...........a....',
    '...........a....',
    '...........a....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  arco: [
    '................',
    '................',
    '..........aa....',
    '.........a..a...',
    '.........a...a..',
    '.........a...a..',
    '.........a...a..',
    '.........a...a..',
    '.........a...a..',
    '.........a..a...',
    '..........aa....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  porrete: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........aaa...',
    '..........aaa...',
    '...........a....',
    '...........a....',
    '...........a....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  escudo: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...aaa..........',
    '..aaaaa.........',
    '..aaaaa.........',
    '..aaaaa.........',
    '...aaa..........',
    '....a...........',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ------------------------------------------------------------------ animação

/**
 * Quantos quadros de animação cada criatura tem, por direção: parada e dois
 * passos. Andando, a sequência é parada, passo A, parada, passo B — a passada
 * de quatro tempos com só dois desenhos novos.
 */
export const QUADROS_POR_DIRECAO = 3;

/** Como cada forma se mexe ao andar. */
const MOVIMENTO: Record<string, 'pernas' | 'asa' | 'rabo' | 'onda'> = {
  quadrupede: 'pernas',
  grande: 'pernas',
  bipede: 'pernas',
  pinguim: 'pernas',
  aranha: 'pernas',
  dragao: 'asa',
  ave: 'asa',
  peixe: 'rabo',
  serpente: 'onda',
};

/**
 * Os três quadros de uma forma, gerados do molde parado.
 *
 * Nenhum quadro é desenhado à mão: são todos derivados do molde, e por isso
 * espécie nova com forma nova já nasce animada — basta dizer em `MOVIMENTO`
 * como ela se mexe. As regras, por tipo:
 *
 * - **pernas**: as pernas são as colunas soltas da faixa de baixo do desenho
 *   (onde a linha deixa de ser corpo inteiro). No passo A, as pernas de ordem
 *   par levantam um pixel e as ímpares esticam o pé um pixel para a frente; no
 *   passo B, o contrário;
 * - **asa**: o detalhe (`2`, que nas aves e no dragão é a asa) sobe um pixel num
 *   passo e desce no outro;
 * - **rabo**: o detalhe do peixe (a cauda) balança para cima e para baixo;
 * - **onda**: a serpente ergue blocos de quatro colunas, alternados.
 */
export function quadrosDe(forma: string, molde: Molde): Molde[] {
  const tipo = MOVIMENTO[forma];
  if (tipo === 'pernas') return [molde, mexerPernas(molde, 0), mexerPernas(molde, 1)];
  if (tipo === 'asa' || tipo === 'rabo') {
    // Na ave e no peixe o detalhe da frente é o olho, que não bate: só a metade
    // de trás se mexe. No dragão as asas ocupam a largura toda.
    const ate = forma === 'dragao' ? LADO_SPRITE : LADO_SPRITE / 2;
    return [molde, moverDetalhe(molde, -1, ate), moverDetalhe(molde, 1, ate)];
  }
  if (tipo === 'onda') return [molde, ondular(molde, 0), ondular(molde, 1)];
  return [molde, molde, molde];
}

type Grade = string[][];

function paraGrade(m: Molde): Grade {
  return m.map((linha) => linha.padEnd(LADO_SPRITE, '.').split('').slice(0, LADO_SPRITE));
}

function deGrade(g: Grade): Molde {
  return g.map((l) => l.join(''));
}

/**
 * A faixa de pernas: as linhas de baixo em que o desenho é feito de pedaços
 * soltos e curtos, e não de um corpo inteiro. Devolve a primeira linha dela.
 */
function inicioDasPernas(g: Grade): number {
  let ultima = LADO_SPRITE - 1;
  while (ultima >= 0 && g[ultima].every((ch) => ch === '.')) ultima--;
  let y = ultima;
  for (; y >= 0; y--) {
    const linha = g[y];
    let pedacos = 0;
    let maior = 0;
    let corrida = 0;
    for (let x = 0; x <= LADO_SPRITE; x++) {
      const cheio = x < LADO_SPRITE && linha[x] !== '.';
      if (cheio) {
        corrida++;
      } else if (corrida > 0) {
        pedacos++;
        maior = Math.max(maior, corrida);
        corrida = 0;
      }
    }
    if (pedacos < 2 || maior > 3) break;
  }
  return y + 1;
}

/** As pernas como grupos de colunas vizinhas dentro da faixa. */
function gruposDePernas(g: Grade, y0: number): number[][] {
  const usadas = new Array<boolean>(LADO_SPRITE).fill(false);
  for (let y = y0; y < LADO_SPRITE; y++) {
    for (let x = 0; x < LADO_SPRITE; x++) if (g[y][x] !== '.') usadas[x] = true;
  }
  const grupos: number[][] = [];
  let atual: number[] = [];
  for (let x = 0; x < LADO_SPRITE; x++) {
    if (usadas[x]) {
      atual.push(x);
    } else if (atual.length) {
      grupos.push(atual);
      atual = [];
    }
  }
  if (atual.length) grupos.push(atual);
  return grupos;
}

function mexerPernas(m: Molde, fase: number): Molde {
  const g = paraGrade(m);
  const y0 = inicioDasPernas(g);
  if (y0 >= LADO_SPRITE) return m;
  const grupos = gruposDePernas(g, y0);
  if (grupos.length < 2) return m;
  const saida = paraGrade(m);
  grupos.forEach((cols, k) => {
    if ((k + fase) % 2 === 0) {
      // levanta: a perna sobe um pixel dentro da faixa, e o pé sai do chão
      for (let y = y0; y < LADO_SPRITE; y++) {
        for (const x of cols) saida[y][x] = y + 1 < LADO_SPRITE ? g[y + 1][x] : '.';
      }
      for (const x of cols) if (g[y0][x] !== '.') saida[y0][x] = g[y0][x];
    } else {
      // estica: a última linha da perna (o pé) avança um pixel para a frente
      let pe = LADO_SPRITE - 1;
      while (pe > y0 && cols.every((x) => g[pe][x] === '.')) pe--;
      for (const x of [...cols].reverse()) {
        if (g[pe][x] === '.' || x + 1 >= LADO_SPRITE) continue;
        if (saida[pe][x + 1] === '.') saida[pe][x + 1] = g[pe][x];
        saida[pe][x] = '.';
      }
    }
  });
  return deGrade(saida);
}

function moverDetalhe(m: Molde, dy: number, ate: number): Molde {
  const g = paraGrade(m);
  const saida = paraGrade(m);
  for (let y = 0; y < LADO_SPRITE; y++) {
    for (let x = 0; x < ate; x++) if (g[y][x] === '2') saida[y][x] = '.';
  }
  for (let y = 0; y < LADO_SPRITE; y++) {
    for (let x = 0; x < ate; x++) {
      if (g[y][x] !== '2') continue;
      const ny = y + dy;
      if (ny < 0 || ny >= LADO_SPRITE) continue;
      // o detalhe passa por cima do vazio, não do corpo
      if (saida[ny][x] === '.') saida[ny][x] = '2';
    }
  }
  return deGrade(saida);
}

function ondular(m: Molde, fase: number): Molde {
  const g = paraGrade(m);
  const saida: Grade = g.map((l) => l.map(() => '.'));
  for (let x = 0; x < LADO_SPRITE; x++) {
    // um bloco de quatro colunas sobe, o vizinho fica: com os dois mexendo,
    // em sentidos opostos, o corpo enrolado se partia ao meio
    const dy = ((x >> 2) + fase) % 2 === 0 ? -1 : 0;
    for (let y = 0; y < LADO_SPRITE; y++) {
      if (g[y][x] === '.') continue;
      const ny = Math.max(0, Math.min(LADO_SPRITE - 1, y + dy));
      saida[ny][x] = g[y][x];
    }
  }
  return deGrade(saida);
}
