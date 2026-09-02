/**
 * Números de balanceamento, todos num lugar só.
 *
 * Ficam separados da lógica de propósito: ajustar o jogo não deveria exigir
 * caçar constante no meio de um sistema.
 */
export const BAL = {
  /** Em quantas fatias a IA é dividida. Cada criatura decide a cada N ticks. */
  fatiasIA: 4,
  /** Teto de fatias quando o mundo enche. Mais fatias = decisão mais rara e mais barata. */
  fatiasMaxIA: 12,

  // ------------------------------------------------------------------ vida
  /** Fome ganha por tick. Em 100 a criatura começa a passar mal. */
  fomePorTick: 0.055,
  /** A partir daqui a criatura procura comida. */
  fomeIncomoda: 45,
  /**
   * Fome a partir da qual um civilizado sai para caçar. É mais alta que a dos
   * bichos de propósito: com o limiar baixo, aldeias grandes varriam a fauna
   * inteira do mapa e a cadeia alimentar desabava.
   */
  fomeParaCacar: 68,
  /** A partir daqui perde vida. */
  fomeCritica: 100,
  /** Vida perdida por tick com fome máxima. */
  danoFome: 0.09,
  /** Vida recuperada por tick quando saciada. */
  curaPorTick: 0.035,
  /** Quanto a fome cai ao comer vegetação de um tile. */
  saciaVegetacao: 34,
  /** Vegetação consumida do tile ao pastar. */
  vegetacaoComida: 52,
  /** Unidades de fruta tiradas do arbusto por refeição. */
  frutaPorRefeicao: 6,
  /** Quanto a fome cai ao comer fruta. Bem mais que capim — vale a caminhada. */
  saciaFruta: 62,
  /** Quanto a fome cai ao comer uma presa. */
  saciaCarne: 88,

  // -------------------------------------------------------------- reprodução
  /** Idade mínima, em fração da longevidade, para reproduzir. */
  fracaoAdulto: 0.12,
  /** Idade máxima, em fração da longevidade, para reproduzir. */
  fracaoIdoso: 0.9,
  /** Fome máxima para pensar em filhote. */
  fomeMaxRepro: 55,
  /**
   * Quanto cada posição da fila de obras vale a menos que a anterior.
   *
   * Perto de 1 a aldeia escolhe quase ao acaso entre o que pode pagar; perto de
   * 0 ela vira escrava da primeira urgência e nunca levanta prefeitura.
   */
  decaimentoDaFila: 0.72,
  /** Chance de a aldeia próspera atrair alguém de fora, por avaliação. */
  imigracaoParaAldeia: 0.16,
  /** Chance de um morador largar a lida para procurar casa e ter filho. */
  vontadeDeFamilia: 0.45,
  /** Quanto tempo um casal fica dentro de casa tentando ter filho. */
  tempoDentroDeCasa: 110,
  /** Distância máxima entre o par. */
  distanciaPar: 1.4,
  /** Superlotação padrão, para espécie que não declara a sua. */
  lotacaoLocal: 16,
  /** Raio em que a superlotação é medida. */
  raioLotacao: 6,

  // ----------------------------------------------------------------- combate
  /** Distância para acertar um golpe. */
  alcanceGolpe: 0.9,
  /** Ticks entre golpes. */
  esperaGolpe: 14,
  /** Multiplicador de dano de criatura de aldeia em guerra. */
  bonusGuerra: 1.25,
  /** Fração da vida abaixo da qual animal covarde foge. */
  limiarFuga: 0.35,

  // --------------------------------------------------------------- migração
  /** Abaixo de tantos indivíduos, a espécie pode receber reforço de fora. */
  pisoDaEspecie: 25,
  /** Chance de a migração acontecer, por avaliação, por espécie carente. */
  chanceMigracao: 0.5,
  /** Chance de um povo varrido do mapa voltar a se estabelecer. */
  chanceRefundacao: 0.09,

  /**
   * Quanto do chão firme cada família de recurso pode ocupar, no máximo.
   *
   * O mundo tem de ter chão à vista. Sem teto, a rebrota vai fechando toda
   * clareira e depois de algumas horas o mapa é um tapete de objetos onde não
   * se enxerga o terreno nem se anda em linha reta. A soma dos três é o quanto
   * do mundo pode estar tomado; o resto é espaço livre por garantia, não por
   * sorte.
   *
   * A conta é sobre os tiles de terra que **aceitam** aquela família — mata não
   * disputa com o deserto nem com o pico —, e é conferida a cada
   * `intervaloCensoDoChao` ticks por uma varredura do mapa. Contador
   * incremental seria mais barato e bem mais frágil: um `limparRecurso`
   * esquecido em qualquer sistema desregularia o teto para sempre.
   */
  tetoDoChao: { madeira: 0.18, comida: 0.045, pedra: 0.03 },
  /**
   * De quantos em quantos ticks o chão é recontado.
   *
   * Encurtado quando a chuva entrou no jogo: ela acelera a vegetação, a
   * vegetação acelera a rebrota, e entre dois censos folgados a fruta passava
   * do teto. O teto só vale o que a frequência da conta permite.
   */
  intervaloCensoDoChao: 240,

  // ----------------------------------------------------------------- barcos
  /** A cada quantos ticks os portos revisam a frota. */
  intervaloEstaleiro: 180,
  /** Quantos barcos um porto mantém no mar. */
  barcosPorPorto: 3,
  /** Madeira que um casco custa. */
  madeiraPorBarco: 16,
  /** Quanto o pesqueiro e o navio andam por tick. */
  velocidadePesqueiro: 0.05,
  velocidadeNavio: 0.075,
  /** Até onde o pesqueiro se afasta procurando cardume. */
  alcanceDePesca: 34,
  /** Até onde o navio de guerra ronda. */
  alcanceDePatrulha: 46,
  /** Quantas pernas de ronda antes de o navio voltar ao porto. */
  pernasDePatrulha: 4,
  /** Comida que uma parada de pesca rende, e o bônus por peixe fisgado. */
  pescaPorParada: 7,
  pescaPorPeixe: 9,
  /** Porão cheio: a partir daqui o pesqueiro volta. */
  porcaoDoBarco: 55,
  /** Ticks parado puxando a rede, e ticks atracado descarregando. */
  esperaPescando: 60,
  esperaNoPorto: 120,
  /** População e comida mínimas para a vila mandar colonos por mar. */
  populacaoParaEmbarcar: 12,
  comidaParaEmbarcar: 70,
  /** Chance de o navio zarpar com colonos, por avaliação. */
  chanceDeZarpar: 0.35,
  /** Quanta gente cabe num navio. */
  lotacaoDoNavio: 8,
  /** Distância de uma travessia de colonização. */
  travessiaMinima: 20,
  travessiaMaxima: 130,

  // ------------------------------------------------------------------ clima
  /** Quantas nuvens por 90 mil tiles de mapa. */
  nuvensPorMilTiles: 9,
  /** Chance de entrar uma nuvem nova, por avaliação. */
  chanceNuvemNova: 0.06,
  /** Que fração das nuvens vem carregada. */
  chanceNuvemDeChuva: 0.42,
  /** Raio de uma nuvem, em tiles. */
  raioNuvem: [7, 18],
  /** Quanto o vento anda por tick. */
  velocidadeDoVento: 0.018,
  /** A cada quantos ticks o vento muda de direção. */
  intervaloDoVento: 240,
  /** A cada quantos ticks a chuva molha o chão. */
  intervaloPrecipitacao: 6,
  /** Vegetação ganha por passada de chuva. */
  vegetacaoPorChuva: 7,
  /** Abaixo desta temperatura a nuvem neva em vez de chover. */
  temperaturaDaNeve: 70,

  // ---------------------------------------------------------------- vulcões
  /** A cada quantos ticks uma erupção é sorteada. */
  intervaloErupcao: 110,
  /** Chance de haver erupção naquele sorteio. */
  chanceErupcao: 0.35,
  /** Quantas bombas por erupção. */
  bombasPorErupcao: [3, 9],
  /** Teto de bombas no ar ao mesmo tempo. */
  maxBombas: 300,
  /** Quanto a bomba perde de impulso por tick. */
  gravidadeBomba: 0.012,
  /** De quantos em quantos ticks a lava é varrida para esfriar. */
  intervaloEsfriarLava: 40,
  /** Chance de um tile de lava virar rocha naquela varredura. */
  chanceLavaEsfriar: 0.05,
  /** Dano de uma bomba a quem estiver por perto. */
  danoBomba: 90,

  // ---------------------------------------------------------------- ecologia
  /** Chance de um tile vazio ao lado de mata brotar uma árvore nova. */
  chanceRebrotar: 0.006,
  /** Vegetação recuperada por tick em tile fértil. */
  crescimentoVegetacao: 0.9,
  /**
   * Chance por tick de o fogo passar para um vizinho, multiplicada pelo
   * combustível dele. São oito vizinhos e o fogo dura dezenas de ticks: o
   * número parece pequeno e ainda assim queima uma floresta inteira.
   */
  espalhaFogo: 0.022,
  /** Ticks que o fogo dura num tile. */
  duracaoFogo: 40,
  /** A cada quantos ticks os escombros são revistos. */
  intervaloRuinas: 60,
  /** Chance de uma ruína desmoronar de vez, por revisão. */
  chanceRuinaDesmoronar: 0.22,
  /** Dano por tick a quem estiver em cima do fogo. */
  danoFogo: 2.2,
  /** Dano por tick a quem estiver na lava. */
  danoLava: 14,
  /** Dano por tick a criatura terrestre presa na água funda. */
  danoAfogamento: 1.6,

  // --------------------------------------------------------------- civilização
  /** Comida que um morador consome por tick. */
  consumoAldeia: 0.032,
  /** Comida que um trabalhador traz por viagem. */
  cargaTrabalho: 22,
  /** Comida acumulada necessária para nascer um novo morador. */
  comidaPorNascimento: 130,
  /** Quanto além do território a aldeia manda gente buscar recurso. */
  alcanceDeTrabalho: 24,
  /** Comida que cada fazenda rende por tick. */
  rendaPorFazenda: 0.02,
  /**
   * Quantas roças soltas a vila planta antes de precisar de um moinho.
   *
   * Não é zero porque uma vila de nível 1 ainda não pode erguer moinho, e sem
   * nenhuma roça ela passaria fome esperando subir de nível.
   */
  rocasSemMoinho: 8,
  /** Ticks entre obras de uma mesma aldeia. */
  esperaObra: 90,
  /**
   * Comida guardada e população mínima para subir de nível.
   *
   * As duas tabelas têm de ter uma entrada por nível, igual a `tetoPorNivel` e
   * `raioPorNivel`. Faltando a última, o nível 5 (metrópole) fica inalcançável
   * e os dois últimos valores das outras tabelas viram dado morto.
   */
  comidaParaSubirNivel: [0, 60, 140, 260, 440, 700],
  /** População mínima para subir de nível. */
  populacaoParaSubirNivel: [0, 6, 13, 24, 40, 66],
  /**
   * Teto de moradores por nível da aldeia. Sem isto, uma aldeia vencedora
   * construía casas para sempre e o mapa virava um povo só, com dezenas de
   * milhares de indivíduos — caro de simular e chato de assistir.
   */
  // Cada teto tem de ser maior que a população exigida para o nível seguinte,
  // senão a aldeia trava: não cresce o bastante para promover, e não promove
  // para poder crescer.
  tetoPorNivel: [0, 24, 44, 74, 115, 165],
  /**
   * Raio de território por nível.
   *
   * Encurtado de propósito: vila grande demais tira o motivo de fundar vila
   * nova, e o mapa acaba com quatro manchas enormes em vez de um punhado de
   * povoados espalhados.
   */
  raioPorNivel: [0, 7, 10, 14, 18, 23],
  /** População da aldeia a partir da qual ela tenta fundar uma colônia. */
  populacaoParaColonizar: 14,
  /** Chance de colonizar, por avaliação, com a vila ainda tendo espaço. */
  chanceColonizar: 0.03,
  /** Chance de colonizar quando o território da vila já encheu. */
  chanceColonizarLotada: 0.3,
  /** Distância mínima entre aldeias. */
  distanciaEntreAldeias: 30,
  /** Fração dos moradores que vira soldado quando o reino está em guerra. */
  fracaoSoldados: 0.35,
  /** Fração quando o jogador manda a aldeia focar no exército. */
  fracaoSoldadosEmGuerraTotal: 0.7,

  // --------------------------------------------------------------- diplomacia
  /** A cada quantos ticks a diplomacia é reavaliada. */
  intervaloDiplomacia: 300,
  /** Relação acima da qual dois reinos firmam aliança. */
  limiarAlianca: 45,
  /** Relação abaixo da qual uma aliança se desfaz. */
  limiarRomper: 12,

  // ---------------------------------------------------------------- comércio
  /** A cada quantos ticks as praças de mercado negociam. */
  intervaloComercio: 120,
  /** Quantas unidades saem em cada negócio. */
  loteComercio: 25,
  /** Distância máxima entre aldeias que negociam. */
  alcanceComercio: 90,
  /** Quanto o vendedor cobra acima do valor base. */
  margemComercio: 1.25,
  /** Quanto um negócio aproxima dois reinos. */
  amizadePorNegocio: 1.2,
  /** Fração acima da necessidade a partir da qual a aldeia exporta. */
  folgaParaExportar: 1.6,
  /** Quanto a caravana de fora paga, em relação ao valor base. */
  precoExportacao: 0.7,

  /** Relação abaixo da qual pode estourar guerra. */
  limiarGuerra: -45,
  /** Relação acima da qual a guerra pode acabar. */
  limiarPaz: -15,
  /** Distância entre aldeias de reinos diferentes que já gera disputa. */
  distanciaDeAtrito: 34,
  /** Deriva por avaliação quando os territórios se tocam. */
  atritoFronteira: -4,
  /** Deriva por avaliação em tempos de paz. */
  aproximacaoNatural: 1.7,
} as const;
