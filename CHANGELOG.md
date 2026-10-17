# Changelog: worldbox-2

A versão mais nova fica em cima. Ela mora aqui e no `package.json`, sempre com o mesmo número.

## 2.1.1 (17/10/2026)

**Corrigido**

- **O jogo instalado tem ícone próprio.** O atalho "WorldBox 2" (área de trabalho e menu Iniciar) e a janela mostravam o ícone do Electron; agora mostram um mundo em blocos, desenhado para o jogo. Quem já tem a cópia instalada: atualize pelo botão da aba de ajustes (a janela e a barra de tarefas pegam o ícone novo) e, para o atalho, rode o `instalar.bat` de novo (os mundos salvos não são mexidos).

## 2.1.0 (17/10/2026)

**Novo**

- **Instalar como aplicativo.** Dois cliques no `instalar.bat` da pasta do projeto instalam o jogo em `%LOCALAPPDATA%\WorldBox 2`, com atalho "WorldBox 2" na área de trabalho e no menu Iniciar. Ele baixa o Electron oficial e confere pelo SHA-256 antes de usar. Os mundos salvos são os mesmos de antes.
- **Botão de atualizar**, na aba de ajustes: mostra a sua versão, procura a mais nova no GitHub, mostra o que mudou e atualiza. O pacote é conferido pelo SHA-256 antes de trocar qualquer coisa, só o código do jogo é trocado (os mundos salvos nunca) e, se a versão nova não abrir, o jogo volta sozinho para a anterior e avisa.
- Rodando da pasta do projeto, o botão procura e mostra a versão nova, mas manda atualizar com `git pull`: quem se atualiza pelo botão é a cópia instalada.

**Mudou**

- O repositório no GitHub passou a ser público, com licença MIT.

## 2.0.0 (16/10/2026)

O mundo ganhou ano com estações, gente com ofício, som, bicho que dá passo e criatura que acha o caminho. Fecha tudo o que estava aberto no roteiro.

**Novo**

- **Estações do ano.** Primavera, verão, outono e inverno, mostradas na barra de baixo numa cor por estação. Na primavera o mato cresce rápido e os bichos têm filhote; no verão chove menos, a lavoura seca e a savana pega fogo sozinha de vez em quando; o outono é a colheita; no inverno a neve cobre o campo das terras frias, o mato para e a vila vive do celeiro. A neve vem e vai com o ano, sem trocar o tipo do chão.
- **Ofícios.** Todo adulto de vila é lavrador, lenhador, mineiro, construtor, ferreiro, mercador ou estudioso, e a vila escolhe quantos de cada pelo que falta no celeiro e pelo foco que você mandou. Cada um ganha perícia com o trabalho (o mestre traz metade a mais que o aprendiz), e com fome todo mundo larga o ofício e vai buscar comida. Clique numa pessoa para ver o ofício e a perícia; a ficha da vila mostra quantos de cada.
- **Preço por oferta e procura.** Cada material tem um preço do mundo inteiro, que sobe quando falta e desce quando sobra. A aba mundo mostra a tabela, com seta quando o preço está fora do normal.
- **Poço, banco e quartel com função.** O poço rega a lavoura, segura a seca do verão e apaga incêndio dentro da vila; o banco guarda o ouro num cofre quatro vezes maior, rende juros e barateia a compra; o quartel treina os soldados, que batem mais forte.
- **Som**, todo gerado na hora: vento, mar, chuva e fogo conforme o que está na tela, passarinho na primavera, e um som para raio, meteoro, vulcão, vila fundada, guerra, paz e descoberta. Volume e "sem som" na aba de ajustes.
- **Animação.** De perto, quem está indo a algum lugar dá passos: as pernas alternam, a asa bate, o peixe balança o rabo, a cobra ondula. Com o jogo pausado, todo mundo congela no meio do passo.
- **Busca de caminho.** Quem tem para onde ir e bate num lago, num rio ou numa enseada contorna em vez de ficar preso. O peixe faz o mesmo com a terra.

**Mudou**

- **Equilíbrio entre os povos**, medido em doze sementes antes e depois: os orcs passaram a ter filhos mais devagar e em ninhadas menores, os elfos um pouco mais depressa, e todo povo procura casa para ter filho com mais frequência. Os orcs, que ficavam em média com 41% da gente do mundo, caíram para 30%, e os elfos subiram de 11% para 15%; humanos e anões ficaram com 25% e 30%. Ainda é comum um povo crescer bem mais que os outros numa partida.
- A vila com casas recebe menos gente de fora: a imigração é para a vila que ainda não tem onde nascer ninguém.
- **A mina procura a rocha.** Ela podia entrar na montanha, mas ia para o primeiro lote livre e acabava no meio do campo; agora tenta primeiro um lote na serra.

## 1.0.0 (14/10/2026)

Primeira entrada deste changelog. O `package.json` dizia 0.1.0, o número que veio de quando o projeto foi criado; como o projeto já funciona e é usado, a versão passou a 1.0.0 (decisão sua, em 14/10/2026). O que veio antes está no histórico do git. Os marcos principais:

- 02/09/2026: o god-game em tiles como app de desktop, com o update de política, genética e 188 ferramentas.
