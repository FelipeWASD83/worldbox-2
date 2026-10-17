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

  // -------------------------------------------------------- busca de caminho
  /**
   * Quantas rotas o mundo calcula por tick, no máximo.
   *
   * A busca só acontece quando a linha reta bate em obstáculo, e mesmo assim é
   * o que custa mais por chamada no jogo. Quem pede além do teto anda como
   * sempre andou (deslizando pelo eixo livre) e pede de novo no tick seguinte.
   */
  buscasPorTick: 12,
  /** Raio da janela em que a busca olha, em tiles (teto 64). */
  janelaDaBusca: 28,
  /** Nós expandidos por busca antes de desistir. */
  nosPorBusca: 1200,
  /** Quanto um passo em serra pesa na rota, contra 1 do chão plano. */
  custoDaSerraNaRota: 2.2,
  /** Ticks que a criatura espera para pedir rota de novo depois de uma busca que falhou. */
  esperaDepoisDeFalhar: 200,

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
  /**
   * Chance de a aldeia próspera atrair alguém de fora, por avaliação.
   *
   * Caiu de 0,16 quando a densidade de casas foi cortada a pedido. Os dois
   * números são a mesma balança: casa é o caminho principal de crescimento do
   * projeto, e imigração é a válvula para a vila que ainda não tem casa
   * nenhuma. Com metade das casas no mundo e a imigração no valor antigo, a
   * válvula virou o caminho principal — medindo seis sementes, em quatro delas
   * chegava mais gente de fora do que nascia dentro das casas.
   */
  imigracaoParaAldeia: 0.11,
  /**
   * Quanto cada casa da vila apaga a chegada de gente de fora.
   *
   * A chance de imigrar é dividida por (1 + casas vezes isto): a imigração é a
   * rede da vila que ainda não tem onde nascer ninguém, e vai sumindo conforme
   * as casas aparecem. Estava escrito como 1,4 no meio da lógica de
   * `civilizacao.ts`; subiu para 3 na v2.0, quando a ninhada menor dos orcs
   * deixou os nascidos em casa atrás dos chegados de fora (626 contra 691 de
   * média em doze sementes). Com 3 a casa voltou a ser o caminho principal
   * (547 contra 443) e a fatia dos povos ficou a mais parelha das rodadas
   * (humano 25%, elfo 15%, anão 30%, orc 30%). Com 1,9 a casa ganhava por
   * pouco (626 contra 569).
   */
  imigracaoSomePorCasa: 3,
  /**
   * Chance de um morador largar a lida para procurar casa e ter filho.
   *
   * Subiu de 0,45 na v2.0. Com os ofícios a gente passa mais tempo na lida, e
   * a ninhada dos orcs caiu para o equilíbrio entre os povos; os dois juntos
   * baixaram os nascidos em casa. Medido em doze sementes (`npm run
   * equilibrio`): com 0,6 os elfos foram de 13% para 17% e nenhum povo sumiu.
   * Baixar a imigração inteira no lugar disto (0,08 e 0,095) foi testado e fez
   * povo sumir do mapa; o que entrou foi `imigracaoSomePorCasa`, que só tira
   * imigrante de vila que já tem casa.
   */
  vontadeDeFamilia: 0.6,
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

  // --------------------------------------------------------------- política
  /** A cada quantos ticks cargos e impostos são revistos. */
  intervaloPolitica: 120,
  /**
   * Vantagem de já estar no cargo, ao comparar fortunas.
   *
   * Sem ela o posto trocaria de mãos toda passada entre dois vizinhos de bolso
   * quase igual, e "governante" viraria um rótulo piscando.
   */
  bonusDeCargo: 0.15,
  /** Fração do imposto que fica com o governante; o resto sobe ao rei. */
  fatiaDoGovernante: 0.35,
  /** Quanto de lealdade cada ponto de imposto custa, por cobrança. */
  desgostoPorImposto: 22,
  /** Lealdade perdida por todo o reino quando a coroa muda de família. */
  abaloDeDinastia: 12,
  /** Fração do tesouro que o rei novo leva para o bolso ao assumir. */
  heranca: 0.25,
  /** Ouro que o trabalhador embolsa por carga entregue na vila. */
  salarioPorCarga: 0.35,

  // ------------------------------------------------------------------ clima
  /** Quantas nuvens por 90 mil tiles de mapa. */
  nuvensPorMilTiles: 9,
  /** Chance de entrar uma nuvem nova, por avaliação. */
  chanceNuvemNova: 0.06,
  /** Que fração das nuvens vem carregada. */
  chanceNuvemDeChuva: 0.42,
  /** Raio de uma nuvem, em tiles. */
  raioNuvem: [7, 18],
  /**
   * Quanto o vento anda por tick.
   *
   * A 0,018 uma nuvem levava vinte mil ticks para cruzar o mapa médio — mais de
   * quinze minutos de relógio, tempo em que o jogador nunca veria uma frente
   * chegar. Aqui a travessia leva uns cinco minutos, que é tempo de perceber o
   * tempo mudando sem ele virar estroboscópio.
   */
  velocidadeDoVento: 0.06,
  /** A cada quantos ticks o vento muda de direção. */
  intervaloDoVento: 240,
  /** Quanto o vento gira por mudança, em radianos. */
  giroDoVento: 0.22,
  /** A cada quantos ticks a chuva molha o chão. */
  intervaloPrecipitacao: 6,
  /** Vegetação ganha por passada de chuva. */
  vegetacaoPorChuva: 7,
  /** Abaixo desta temperatura a nuvem neva em vez de chover. */
  temperaturaDaNeve: 70,

  // --------------------------------------------------------------- estações
  /**
   * Quanto a linha da neve sobe no auge do inverno, em pontos de temperatura.
   *
   * Um terço da terra firme já fica abaixo de `temperaturaDaNeve` o ano todo
   * (tundra, taiga, serra). Com 50, o inverno cobre de branco mais um quarto do
   * chão — o campo temperado — e devolve tudo na primavera. Mais que isso e o
   * inverno vira era do gelo; menos, e ele só se vê no pé da serra.
   */
  neveDoInverno: 50,
  /** De quantos em quantos pontos a linha da neve anda (cada passo redesenha a faixa que mudou). */
  degrauDaNeve: 6,
  /**
   * Multiplicadores por estação, na ordem primavera, verão, outono, inverno.
   *
   * A média de cada linha fica perto de 1 **de propósito**: as estações mudam
   * quando as coisas acontecem, não quanto acontece no ano. Com médias abaixo
   * de 1 o inverno seria só um corte disfarçado na comida do mundo inteiro.
   */
  estacaoLavoura: [1.0, 0.8, 1.6, 0.6],
  /** Crescimento do mato e rebrota. No inverno, o chão coberto de neve não cresce nada. */
  estacaoVegetacao: [1.6, 1.05, 0.85, 0.5],
  /** Vontade de os bichos procurarem par. É a primavera dos filhotes. */
  estacaoCio: [1.0, 0.7, 0.45, 0.2],
  /** Fração das nuvens que vem carregada, relativa a `chanceNuvemDeChuva`. */
  estacaoChuva: [1.15, 0.6, 1.05, 1.2],
  /** Quanto o fogo pula de um tile para o outro. */
  estacaoFogo: [0.85, 1.45, 1.0, 0.5],
  /** Lavoura de vila coberta de neve rende ainda menos que o inverno comum. */
  lavouraNaNeve: 0.4,
  /**
   * Incêndio espontâneo no verão: chance por sorteio, a cada `intervaloFogoDeVerao`.
   *
   * Só pega em tile quente, seco e com o que queimar. Pequeno de propósito: é
   * o raio seco que de vez em quando lambe uma savana, não um mundo em chamas.
   */
  chanceFogoDeVerao: 0.22,
  intervaloFogoDeVerao: 50,
  /** Temperatura mínima e umidade máxima para o verão acender um tile sozinho. */
  temperaturaDoFogoDeVerao: 150,
  umidadeDoFogoDeVerao: 120,

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
  /**
   * Chance de um tile vazio ao lado de mata brotar uma árvore nova.
   *
   * Baixo de propósito. Com o valor antigo (quatro vezes este) a clareira se
   * fechava em minutos e o mapa voltava sozinho ao teto de ocupação — não dava
   * para ver uma vila desmatando o entorno, porque a mata crescia mais rápido
   * que o machado.
   */
  chanceRebrotar: 0.007,
  /**
   * Fator de água a partir do qual a rebrota acontece na taxa cheia.
   *
   * `fatorDeAgua` devolve por volta de 1,6 na margem de um rio e 0,4 no seco.
   * Dividindo por este número, a margem passa quase sempre e o interflúvio seco
   * rebrota num quarto das vezes — que é o que concentra a mata na bacia em vez
   * de espalhá-la por igual pelo bioma.
   *
   * O valor foi calibrado, e não escolhido: com ele a taxa **média** de rebrota
   * sobre o chão fértil do mundo dá 0,0041, praticamente a mesma de antes de a
   * água entrar na conta. O que muda é onde ela acontece, não quanta mata o
   * mundo repõe no total — que é o que impede esta mudança de virar, sem
   * querer, um corte na madeira do jogo inteiro.
   */
  rebrotaJuntoDagua: 1.7,
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
  /** A que distância da praça o morador consegue usar o celeiro. */
  alcanceDoCeleiro: 7,
  /** Comida que um trabalhador traz por viagem. */
  cargaTrabalho: 22,
  /** Comida acumulada necessária para nascer um novo morador. */
  comidaPorNascimento: 130,
  /** Quanto além do território a aldeia manda gente buscar recurso. */
  alcanceDeTrabalho: 24,
  /**
   * Comida que cada fazenda rende por tick.
   *
   * Subiu junto com o corte na rebrota dos recursos. Fruta e mata passaram a
   * demorar quatro vezes mais para voltar, e a comida do mundo veio junto: a
   * população civilizada caiu de mil e duzentos para trezentos. A resposta não
   * foi devolver a rebrota — mato que se refaz em minutos tira o peso de
   * derrubá-lo — e sim fazer a **lavoura** sustentar a vila, que é o caminho de
   * um povo que já não vive de colher o que acha.
   */
  rendaPorFazenda: 0.1,
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
   * Dobrado em 02/09/2026. Os números curtos de antes vinham do medo de "vila
   * grande demais tira o motivo de fundar vila nova" — e o efeito medido foi o
   * oposto do desejado: com raio 18 no nível 4, a vila enchia o território
   * quase na fundação e o reino saía pipocando colônia, terminando com
   * cinquenta povoados de duzentos tiles cada. Território pequeno não gera
   * expansão, gera confete.
   */
  raioPorNivel: [0, 10, 17, 26, 36, 48],
  /** População da aldeia a partir da qual ela tenta fundar uma colônia. */
  /**
   * Quantos tiles a vila toma por passada de gestão.
   *
   * É a velocidade de expansão. Alto o bastante para a fronteira andar de forma
   * visível — antes o território levava a partida inteira para encher o círculo
   * e o jogador nunca via um reino crescer.
   */
  tilesPorExpansao: 26,
  /** Teto da fila de fronteira, para ela não crescer sem fim. */
  franjaMaxima: 3000,
  populacaoParaColonizar: 20,
  /** Chance de colonizar, por avaliação, com a vila ainda tendo espaço. */
  chanceColonizar: 0.008,
  /** Chance de colonizar quando o território da vila já encheu. */
  chanceColonizarLotada: 0.22,
  /**
   * Distância mínima entre aldeias.
   *
   * Tem de ser maior que a soma de dois territórios crescidos, senão a colônia
   * nasce **dentro** do que a mãe já domina e nunca consegue chão para chamar de
   * seu. Foi o que aconteceu quando o raio dobrou e este número ficou para trás:
   * vinte e quatro de quarenta e quatro vilas travadas no nível 1, sufocadas
   * pela vizinha.
   */
  distanciaEntreAldeias: 36,
  /** Fração dos moradores que vira soldado quando o reino está em guerra. */
  fracaoSoldados: 0.35,
  /** Fração quando o jogador manda a aldeia focar no exército. */
  fracaoSoldadosEmGuerraTotal: 0.7,

  // ------------------------------------------------------------ profissões
  /** A cada quantos ticks a vila redistribui os ofícios. */
  intervaloProfissoes: 100,
  /**
   * Fatia dos adultos que cada ofício de casa leva, e o teto em gente.
   *
   * Construtor, ferreiro, mercador e estudioso **não saem para buscar
   * material**: trabalham na vila, e o efeito deles é sobre a vila inteira.
   * Por isso as fatias são pequenas — cada um deles é um braço a menos na
   * lavoura e na mata, e com fatias de um quarto a vila passava fome com o
   * celeiro cheio de livro.
   */
  fatiaConstrutores: 0.1,
  fatiaFerreiros: 0.06,
  maxFerreirosPorFerraria: 2,
  fatiaMercadores: 0.06,
  maxMercadores: 4,
  fatiaEstudiosos: 0.06,
  estudiososPorBiblioteca: 3,
  /** Quanto a perícia cheia multiplica o que um trabalhador do ofício entrega. */
  bonusDePericia: 0.5,
  /** Perícia ganha por carga entregue no próprio ofício, e por passada em ofício de casa. */
  periciaPorCarga: 0.1,
  periciaPorPassada: 0.02,
  /** Fração da perícia que sobra ao trocar de ofício. */
  periciaAoTrocar: 0.35,
  /**
   * Quanto a perícia segura a pessoa no ofício quando a vila quer trocá-la.
   *
   * A chance de trocar é 1 menos isto vezes a perícia: o mestre lenhador quase
   * nunca é mandado para a mina, o aprendiz vai sem discutir. Sem isto a troca
   * caía em quem estivesse primeiro no pool, e a perícia média do mundo não
   * passava de 7%.
   */
  apegoAoOficio: 0.8,
  /** Quanto a mais de pressa cada construtor dá à obra, sobre a espera normal (teto 2×). */
  pressaPorConstrutor: 0.12,
  /** Desconto no equipamento por ferreiro, com perícia cheia (teto 40%). */
  descontoPorFerreiro: 0.15,
  /** Negócios a mais por rodada de comércio a cada dois mercadores, e o ganho na exportação. */
  exportacaoPorMercador: 0.06,
  /** Conhecimento por estudioso, por avaliação (dobra com perícia cheia). */
  conhecimentoPorEstudioso: 0.35,
  /** Dano a mais do soldado de vila com quartel, e a experiência que ele ganha treinando. */
  danoComQuartel: 1.2,
  treinoNoQuartel: 0.4,

  // ------------------------------------------------------------- genética
  /**
   * Ódio máximo entre dois povos para eles ainda terem filho um com o outro.
   *
   * Sai da mesma tabela que a diplomacia usa (`ODIO_POVOS`), e não de um número
   * novo: se dois povos se detestam, não há casal. Com 0,35 o mundo libera
   * humano com elfo (0,25) e humano com anão (0,23), e tranca elfo com anão
   * (0,74) e tudo o que envolve orc (0,78 para cima). Subir este número é
   * abrir o mundo para mestiçagem geral; descer é fechá-lo.
   */
  odioParaCruzar: 0.35,
  /** Chance de um traço de um dos pais passar para o filho. */
  herancaDeTraco: 0.45,
  /** A mesma chance quando **os dois** pais têm aquele traço. */
  herancaDeTracoDobrada: 0.82,
  /** Chance de um traço novo aparecer do nada num nascimento. */
  chanceDeMutacao: 0.18,
  /**
   * Chance de um imigrante ser de outro povo, e não do povo da vila.
   *
   * É a única porta pela qual dois povos passam a morar juntos, e portanto a
   * única origem de mestiço no mundo. Baixa de propósito: uma vila humana
   * continua sendo uma vila humana, com uma família élfica no fim da rua.
   */
  imigracaoDeOutroPovo: 0.14,
  /** Chance de quem chega de fora do mapa já vir com um traço. */
  chanceDeTracoAoChegar: 0.55,

  // --------------------------------------------------- conhecimento e eras
  /** A cada quantos ticks os reinos rendem conhecimento e tentam descobrir. */
  intervaloConhecimento: 200,
  /**
   * Pontos por avaliação que um reino produz só por existir, e por cabeça.
   *
   * Baixos de propósito: sozinhos, levam uma tribo à primeira descoberta em
   * alguns milhares de ticks e não muito além disso. Quem quiser passar da era
   * das aldeias precisa **construir** — é aí que os marcos entram.
   */
  conhecimentoBase: 1.6,
  conhecimentoPorCabeca: 0.08,
  /**
   * O que cada marco rende por avaliação.
   *
   * A biblioteca vale sozinha mais que cem habitantes. É deliberado: era o
   * prédio mais caro do jogo sem nenhuma função, e agora é a diferença entre um
   * império que alcança o aço e um que morre na idade da pedra assentada.
   */
  conhecimentoPorBiblioteca: 4,
  conhecimentoPorPrefeitura: 1.5,
  conhecimentoPorTemplo: 1,
  conhecimentoPorTaverna: 0.6,
  /**
   * Quanto vale, em conhecimento por avaliação, cada ponto de sabedoria acima
   * do comum numa pessoa.
   *
   * Um sábio tem fator 2,4, ou seja, 1,4 acima do comum. Começou em 1,7, o que
   * fazia cada sábio valer quase uma biblioteca — e como uns 5% da população
   * nasce sábia, um reino grande juntava sete deles e cortava a idade imperial
   * pela metade, de vinte e cinco mil ticks para treze mil. Em 0,6 o sábio
   * continua sendo alguém que faz diferença sem ser sozinho o motor da história.
   */
  conhecimentoPorSabio: 0.6,
  /** Multiplicador de tudo o que entra, depois que o reino descobre a escrita. */
  conhecimentoDaEscrita: 1.3,

  // ------------------------------------------------------- cultura e clãs
  /**
   * Quanto o clã puxa a fatia de moradores que vira soldado.
   *
   * Com 0,5, um clã inteiramente marcial manda 25% mais gente para a frente que
   * a média e um clã de lavradores manda 25% menos. Já foi 1 — a faixa inteira,
   * de metade ao dobro — e o custo medido foi alto: com a guerra tirando até
   * metade da vila do trabalho, as aldeias paravam de construir casa, e o
   * crescimento por nascimento em casa caía abaixo do crescimento por
   * imigração, invertendo o que o projeto trata como caminho principal. Clã
   * inclinando a balança é o que se quer; clã decidindo a economia da vila, não.
   */
  pesoDoClaNoExercito: 0.5,
  /**
   * Quanto o clã puxa o desgosto com o imposto.
   *
   * Aqui a faixa cheia não custa nada, porque o efeito é sobre lealdade e não
   * sobre braço de trabalho: é justamente o que faz o mesmo imposto ser
   * tolerável numa vila e revolucionário na outra.
   */
  pesoDoClaNoImposto: 1,
  /** A cada quantos ticks a lealdade é reavaliada. */
  intervaloCultura: 200,
  /**
   * Que fração da distância até o alvo a lealdade anda por avaliação.
   *
   * Baixo de propósito: lealdade que responde na hora vira um medidor piscando,
   * e a rebelião passa a depender de um instante ruim em vez de um período ruim.
   */
  mareDaLealdade: 0.18,
  /** Lealdade de quem não tem nem queixa nem motivo de gratidão. */
  lealdadeBase: 52,
  /** Teto do que o celeiro cheio acrescenta. */
  lealdadePorFartura: 16,
  /** Peso da submissão do clã, de -metade a +metade. */
  lealdadePorSubmissao: 24,
  /** Quanto custa ser governado por gente de outro clã, no clã mais fechado. */
  lealdadePorGovernanteDeFora: 34,
  /** O mesmo para o rei, que está longe e por isso incomoda menos. */
  lealdadePorReiDeFora: 16,
  /** Peso da guerra: anima o clã marcial e desanima o pacífico. */
  lealdadePorGuerra: 22,
  /** Quanto cada ponto de fome acima de 60 tira de lealdade. */
  lealdadePorFome: 0.5,
  /** Lealdade média abaixo da qual a vila se separa do reino. */
  lealdadeParaRebelar: 28,
  /** Lealdade abaixo da qual a vila vizinha adere à rebelião da outra. */
  lealdadeParaSeguirARebeliao: 40,
  /** Idade mínima da vila para ela ter identidade própria a defender. */
  idadeParaRebelar: 3000,
  /** População mínima para uma rebelião ter com que se sustentar. */
  populacaoParaRebelar: 6,
  /** Até onde a rebelião arrasta as vilas vizinhas descontentes. */
  alcanceDaRebeliao: 70,
  /**
   * Chance de um grupo que se muda fundar um clã próprio.
   *
   * Vale para colonos e para quem chega de fora. Sem isto o mundo teria um clã
   * por povo e a fase inteira seria decorativa: rebelião nasce de gente do mesmo
   * reino discordar, e para discordar é preciso ser de clãs diferentes.
   */
  chanceDeClaNovo: 0.35,

  // ------------------------------------------------------ névoa diplomática
  /** A cada quantos ticks uma fatia do povo é conferida por contato. */
  intervaloContato: 30,
  /**
   * A que distância da praça a pessoa consegue reportar o que viu.
   *
   * O contato só vira conhecimento do reino quando chega a quem manda, e quem
   * manda está na praça. Ver `src/sim/contato.ts`.
   */
  distanciaDoRelato: 8,

  // --------------------------------------------------------------- diplomacia
  /** A cada quantos ticks a diplomacia é reavaliada. */
  intervaloDiplomacia: 300,
  /**
   * Quanto de rancor evapora a cada avaliação de diplomacia.
   *
   * Com 1,5 a cada 300 ticks, uma mágoa no teto leva umas vinte mil rodadas
   * para se apagar — uma geração inteira. É o meio-termo entre esquecer a
   * guerra assim que a paz é assinada e travar dois povos em ódio permanente.
   */
  esquecimentoDeRancor: 1.5,
  /** Quanto o ódio entre os povos derruba a relação por avaliação, com contato. */
  pesoDoOdioNaRelacao: 2.2,
  /**
   * Quanto a vizinhança aproxima dois reinos **do mesmo povo**, por avaliação.
   *
   * Contrapeso do atrito de fronteira para quem não tem ódio de povo pelo
   * vizinho. É o que torna a aliança alcançável: sem ele, todo par de reinos com
   * divisa comum derivava para -100 e o mecanismo de aliança nunca disparava em
   * partida nenhuma.
   */
  parentescoNaFronteira: 3.2,
  /**
   * Soma de motivos a partir da qual um reino declara guerra.
   *
   * É o coração do casus belli. Nenhum motivo sozinho costuma bastar: fronteira
   * disputada dá uns vinte, ódio antigo dá até trinta, e é a soma de dois ou
   * três que passa daqui. Baixar este número é a alavanca para um mundo mais
   * belicoso; subir, para um mundo de guerras raras e grandes.
   */
  limiarCasusBelli: 45,
  /**
   * Que fração do limiar os motivos precisam cair para a paz ser possível.
   *
   * Menor que 1 de propósito: se a paz exigisse os motivos zerados, nenhuma
   * guerra por ódio antigo terminaria nunca — o ódio não passa.
   */
  fracaoParaPaz: 0.55,
  /**
   * Ticks de guerra até o desgaste chegar ao máximo.
   *
   * Dez anos de jogo. É o que decide a duração típica de um conflito: a chance
   * de paz cresce com o quadrado do desgaste, então a primeira metade da guerra
   * quase não produz proposta de trégua e a segunda produz muitas.
   */
  ticksAteCansarDaGuerra: 4000,
  /** Chance de paz por avaliação quando o desgaste está no teto. */
  chanceDePazPorDesgaste: 0.45,
  /**
   * Quanto tempo tem de passar entre uma guerra e a seguinte com o mesmo reino.
   *
   * Sem isto a paz durava uma avaliação: o motivo que começou a guerra continua
   * inteiro no minuto seguinte à assinatura.
   */
  tregua: 2600,
  /**
   * Quanto cada guerra já aberta encarece abrir mais uma.
   *
   * Com 0,55, o segundo inimigo exige metade a mais de motivo que o primeiro, e
   * o terceiro exige o dobro. É o que mantém o conflito localizado no mapa em
   * vez de todo reino guerrear com todos os vizinhos ao mesmo tempo.
   */
  pesoDeFrenteAberta: 0.55,
  /** Tetos de cada motivo de guerra. Ver `motivosDeGuerra` em `diplomacia.ts`. */
  tetoMotivoFronteira: 22,
  tetoMotivoOdio: 30,
  tetoMotivoInimizade: 30,
  tetoMotivoRancor: 28,
  tetoMotivoTerra: 18,
  tetoMotivoFome: 16,
  tetoMotivoFraqueza: 16,
  tetoMotivoAliado: 20,
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
  /**
   * O que o banco faz.
   *
   * O cofre multiplica o teto de ouro da vila (sem banco, o ouro disputa o
   * mesmo celeiro que a madeira). Os juros entram por rodada de comércio, sobre
   * o ouro guardado na vila e, com um banco em qualquer vila do reino, sobre o
   * tesouro da coroa. O crédito é o desconto na margem de quem compra: a vila
   * com banco paga o negócio a prazo e o vendedor aceita menos.
   */
  cofreDoBanco: 4,
  jurosDoBanco: 0.012,
  jurosDoTesouro: 0.004,
  margemComBanco: 1.08,
  /**
   * O que o poço faz.
   *
   * Cada poço (até o máximo do prédio) põe esta fração a mais na lavoura da
   * vila, e com pelo menos um a seca do verão não pega nela. Dentro do
   * território de vila com poço, o fogo queima `fogoComPoco` vezes mais rápido
   * até se apagar — é a fila de baldes — e pula menos para o vizinho.
   */
  irrigacaoPorPoco: 0.12,
  fogoComPoco: 3,
  espalhaComPoco: 0.4,
  /** Fração acima da necessidade a partir da qual a aldeia exporta. */
  folgaParaExportar: 1.6,
  /** Quanto a caravana de fora paga, em relação ao valor base. */
  precoExportacao: 0.7,
  /**
   * Preço por oferta e procura.
   *
   * Cada material tem um fator sobre `VALOR_MATERIAL`, o mesmo para o mundo
   * inteiro (é um mercado só: as caravanas levam a notícia do preço junto). A
   * cada rodada de comércio ele anda `mareDoPreco` da distância até o alvo, e o
   * alvo é a raiz de (quem quer comprar + 1) / (quem tem para vender + 1).
   * Raiz porque a razão crua dava saltos de 5× quando três vilas pediam a mesma
   * coisa e ninguém tinha.
   */
  mareDoPreco: 0.12,
  precoMinimo: 0.4,
  precoMaximo: 3,
  /** Quanto cada negócio fechado encarece o material, e cada lote exportado barateia. */
  altaPorNegocio: 1.03,
  baixaPorExportacao: 0.985,
  /**
   * Relação mínima para dois reinos não aliados negociarem entre si.
   *
   * Negativo de propósito: comércio não exige amizade, exige só que ninguém
   * esteja com raiva demais para sentar à mesa. É por ele que a relação sobe
   * até virar aliança.
   */
  relacaoParaComerciar: -20,

  /**
   * Relação abaixo da qual pode estourar guerra.
   *
   * Deixou de ser o gatilho quando o casus belli entrou — hoje quem decide é a
   * soma de motivos. Continua aqui porque a relação vira **um** dos motivos, e
   * porque a interface usa este número para dizer quando dois reinos estão à
   * beira do rompimento.
   */
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
