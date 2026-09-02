import type { Mundo } from '../core/mundo.js';
import {
  DICA_FOCO, FOCOS, NOME_FOCO, definirFoco, doarPara, focoDe, mandarColonizar,
  ordenarAlianca, ordenarGuerra, ordenarPaz, ordenarRomper, vizinhosDiplomaticos,
} from '../sim/comandos.js';

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
    this.alvo.append(linhaOrdens);

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
