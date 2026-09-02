import type { Mundo } from '../core/mundo.js';
import {
  DICA_FOCO, FOCOS, NOME_FOCO, TAXAS, definirFoco, definirImposto, doarPara, estranhos, focoDe,
  mandarColonizar,
  ordenarAlianca, ordenarGuerra, ordenarOdio, ordenarPaz, ordenarPesquisa, ordenarRebeliao,
  ordenarRevelar, ordenarRomper, vizinhosDiplomaticos,
} from '../sim/comandos.js';
import { NOME_ERA, tecnologias } from '../dados/tecnologias.js';
import { lealdadeMedia } from '../sim/cultura.js';

/**
 * O painel de ordens.
 *
 * Aparece quando o jogador seleciona uma aldeia: dali ele define o foco do
 * trabalho, manda fundar colônia, socorre uma aldeia irmã e trata guerra, paz e
 * aliança com os vizinhos.
 *
 * É reconstruído a cada seleção e a cada ordem dada, e não a cada quadro —
 * refazer botões sessenta vezes por segundo derrubaria o clique do jogador no
 * meio do caminho.
 */
export class PainelComando {
  aldeia = -1;
  private ultimaMensagem = '';
  private ultimoRedesenho = 0;

  constructor(
    private alvo: HTMLElement,
    private mundo: () => Mundo,
  ) {}

  trocarMundo(): void {
    this.aldeia = -1;
    this.ultimaMensagem = '';
    this.redesenhar();
  }

  selecionar(aldeia: number): void {
    this.aldeia = aldeia;
    this.ultimaMensagem = '';
    this.redesenhar();
  }

  /**
   * Redesenha de tempos em tempos mesmo sem clique: guerra declarada ou aldeia
   * destruída mudam o que os botões deveriam dizer, e o painel ficava mostrando
   * o estado do instante em que foi aberto.
   */
  acompanhar(agora: number): void {
    if (this.aldeia < 0) return;
    if (agora - this.ultimoRedesenho < 700) return;
    this.redesenhar();
  }

  redesenhar(): void {
    this.ultimoRedesenho = performance.now();
    const mundo = this.mundo();
    const a = this.aldeia >= 0 ? mundo.aldeias[this.aldeia] : undefined;
    this.alvo.replaceChildren();

    if (!a?.ativa) {
      this.alvo.hidden = true;
      return;
    }
    this.alvo.hidden = false;

    const reino = mundo.reinos[a.reino];
    this.alvo.append(secao('Foco do trabalho'));

    const linhaFoco = document.createElement('div');
    linhaFoco.className = 'botoes-comando';
    for (const f of FOCOS) {
      const b = document.createElement('button');
      b.className = 'btn-comando';
      b.textContent = NOME_FOCO[f];
      b.title = DICA_FOCO[f];
      if (focoDe(a) === f) b.classList.add('ativo');
      b.addEventListener('click', () => {
        definirFoco(a, f);
        this.dizer(`Agora a aldeia cuida de ${NOME_FOCO[f]}.`);
      });
      linhaFoco.append(b);
    }
    this.alvo.append(linhaFoco);

    // ------------------------------------------------------------ imposto
    // O imposto é a alavanca política que o jogador tem na mão: enche o cofre
    // do reino e esvazia a lealdade de quem paga. Deixar isso só para a
    // simulação decidir seria tirar do jogador justamente a decisão
    // interessante.
    this.alvo.append(secao('Imposto'));
    const linhaImposto = document.createElement('div');
    linhaImposto.className = 'botoes-comando';
    for (const [rotulo, taxa, dica] of TAXAS) {
      const b = document.createElement('button');
      b.className = 'btn-comando';
      b.textContent = rotulo;
      b.title = dica;
      if (Math.abs(a.imposto - taxa) < 0.001) b.classList.add('ativo');
      b.addEventListener('click', () => {
        a.imposto = taxa;
        this.dizer(definirImposto(mundo, a, taxa));
      });
      linhaImposto.append(b);
    }
    this.alvo.append(linhaImposto);

    this.alvo.append(secao('Ordens'));
    const linhaOrdens = document.createElement('div');
    linhaOrdens.className = 'botoes-comando';

    linhaOrdens.append(
      botao('Fundar colônia', 'Manda parte dos moradores abrir uma aldeia nova.', () => {
        this.dizer(mandarColonizar(mundo, a));
      }),
    );

    const irma = mundo.aldeias.find(
      (x) => x.ativa && x.reino === a.reino && x.id !== a.id && x.estoque.comida < 40,
    );
    if (irma) {
      linhaOrdens.append(
        botao(`Socorrer ${irma.nome}`, 'Envia metade do estoque para uma aldeia do reino que está passando fome.', () => {
          this.dizer(doarPara(a, irma));
        }),
      );
    }
    linhaOrdens.append(
      botao('Incitar revolta', 'A vila levanta a própria bandeira, leva o território que domina e já nasce em guerra com o reino de origem.', () => {
        this.dizer(ordenarRebeliao(mundo, a));
      }),
    );
    this.alvo.append(linhaOrdens);

    // A lealdade média é o número que explica se a revolta vai pegar sozinha, e
    // por isso fica ao lado do botão que a força.
    const lealdade = lealdadeMedia(mundo, a);
    const aviso = document.createElement('p');
    aviso.className = 'aviso-comando';
    aviso.textContent = lealdade < 26
      ? `Lealdade média ${lealdade.toFixed(0)} — esta vila se separa a qualquer momento.`
      : `Lealdade média ${lealdade.toFixed(0)}.`;
    this.alvo.append(aviso);

    // ------------------------------------------------------------ conhecimento
    // Onde este povo está na história, e o poder de empurrá-lo adiante.
    if (reino?.ativo) {
      this.alvo.append(secao(`Era ${NOME_ERA[reino.era] ?? reino.era}`));
      const linhaTec = document.createElement('div');
      linhaTec.className = 'botoes-comando';
      const resumo = document.createElement('i');
      resumo.className = 'estado';
      resumo.textContent = `${reino.tecnologias.size}/${tecnologias.tamanho} descobertas · ${reino.conhecimento.toFixed(0)} de conhecimento`;
      resumo.title = [...reino.tecnologias]
        .map((t) => tecnologias.porIndice(t).nome)
        .join(', ');
      linhaTec.append(resumo);
      linhaTec.append(
        botao('Revelar segredo', 'Ensina de graça a próxima descoberta que este reino perseguia.', () => {
          this.dizer(ordenarPesquisa(mundo, reino));
        }),
      );
      this.alvo.append(linhaTec);
    }

    // ------------------------------------------------------------ diplomacia
    if (reino?.ativo) {
      const vizinhos = vizinhosDiplomaticos(mundo, reino);
      if (vizinhos.length > 0) {
        this.alvo.append(secao(`Diplomacia de ${reino.nome}`));
        for (const outro of vizinhos.slice(0, 6)) {
          const linha = document.createElement('div');
          linha.className = 'linha-diplomacia';

          const nome = document.createElement('span');
          nome.textContent = outro.nome;
          nome.style.color = `#${outro.cor.toString(16).padStart(6, '0')}`;

          const estado = document.createElement('i');
          const emGuerra = mundo.emGuerra(reino.id, outro.id);
          const aliado = mundo.saoAliados(reino.id, outro.id);
          estado.textContent = emGuerra ? 'guerra' : aliado ? 'aliados' : `${mundo.relacao(reino.id, outro.id) | 0}`;
          estado.className = emGuerra ? 'estado guerra' : aliado ? 'estado paz' : 'estado';
          // A mágoa acumulada é o que a relação sozinha não conta: dois reinos
          // podem estar em paz com relação neutra e ainda assim ter uma guerra
          // inteira de mortos entre eles, esperando o próximo motivo.
          const magoa = Math.round(mundo.rancorEntre(reino.id, outro.id));
          estado.title = magoa > 0
            ? `Mágoa acumulada contra ${outro.nome}: ${magoa}.`
            : `Nenhuma conta a acertar com ${outro.nome}.`;
          if (magoa > 0) estado.textContent += ` · ✚${magoa}`;

          const acoes = document.createElement('div');
          acoes.className = 'botoes-comando';
          if (emGuerra) {
            acoes.append(botao('Paz', 'Encerra a guerra com este reino.', () => {
              this.dizer(ordenarPaz(mundo, reino.id, outro.id));
            }));
          } else {
            acoes.append(botao('Guerra', 'Declara guerra a este reino. Os aliados dele entram junto.', () => {
              this.dizer(ordenarGuerra(mundo, reino.id, outro.id));
            }));
            if (aliado) {
              acoes.append(botao('Romper', 'Desfaz a aliança.', () => {
                this.dizer(ordenarRomper(mundo, reino.id, outro.id));
              }));
            } else {
              acoes.append(botao('Aliar', 'Firma aliança: passam a comerciar e a guerrear juntos.', () => {
                this.dizer(ordenarAlianca(mundo, reino.id, outro.id));
              }));
            }
          }
          acoes.append(botao('Ódio', 'Envenena a relação e deixa mágoa que não some sozinha. Não declara guerra: dá o motivo para ela.', () => {
            this.dizer(ordenarOdio(mundo, reino.id, outro.id));
          }));

          linha.append(nome, estado, acoes);
          this.alvo.append(linha);
        }
      }

      // -------------------------------------------------- o que eles não sabem
      // A névoa também é informação: ver a lista dos reinos que existem e que
      // este ainda ignora é metade do que torna a revelação uma decisão.
      const naoSabem = estranhos(mundo, reino);
      if (naoSabem.length > 0) {
        this.alvo.append(secao('Ainda não sabem que existem'));
        for (const outro of naoSabem.slice(0, 6)) {
          const linha = document.createElement('div');
          linha.className = 'linha-diplomacia';

          const nome = document.createElement('span');
          nome.textContent = outro.nome;
          nome.style.color = `#${outro.cor.toString(16).padStart(6, '0')}`;

          const estado = document.createElement('i');
          estado.className = 'estado';
          estado.textContent = 'na névoa';

          const acoes = document.createElement('div');
          acoes.className = 'botoes-comando';
          acoes.append(botao('Revelar', `Faz ${reino.nome} e ${outro.nome} saberem um do outro. A partir daí há relação, comércio e guerra possíveis.`, () => {
            this.dizer(ordenarRevelar(mundo, reino.id, outro.id));
          }));

          linha.append(nome, estado, acoes);
          this.alvo.append(linha);
        }
      }
    }

    if (this.ultimaMensagem) {
      const msg = document.createElement('p');
      msg.className = 'aviso-comando';
      msg.textContent = this.ultimaMensagem;
      this.alvo.append(msg);
    }
  }

  private dizer(mensagem: string): void {
    this.ultimaMensagem = mensagem;
    this.redesenhar();
  }
}

function secao(titulo: string): HTMLElement {
  const h = document.createElement('h3');
  h.className = 'titulo-comando';
  h.textContent = titulo;
  return h;
}

function botao(texto: string, dica: string, aoClicar: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'btn-comando';
  b.textContent = texto;
  b.title = dica;
  b.addEventListener('click', aoClicar);
  return b;
}
