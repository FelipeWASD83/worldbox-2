import type { Mundo } from '../core/mundo.js';
import { especies } from '../dados/especies.js';

/**
 * A crônica do mundo: só os acontecimentos que valem uma linha.
 *
 * Nascimento e morte de bicho não entram — seriam milhares por minuto e
 * enterrariam o que importa. Entra o que muda o mapa político.
 */
const MAX_LINHAS = 220;

export class Cronica {
  private desligar: Array<() => void> = [];

  constructor(private lista: HTMLUListElement) {}

  ligar(mundo: Mundo): void {
    for (const fn of this.desligar) fn();
    this.desligar = [];
    this.lista.replaceChildren();

    const ev = mundo.eventos;
    const ano = () => Math.floor(mundo.tick / 400);

    this.desligar.push(
      ev.on('reino:fundado', (d) => this.escrever(ano(), `${d.nome} foi fundado.`)),
      ev.on('reino:extinto', (d) => this.escrever(ano(), `${d.nome} deixou de existir.`, 'guerra')),
      ev.on('reino:guerra', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `${a} declarou guerra a ${b}.`, 'guerra');
      }),
      ev.on('reino:paz', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `${a} e ${b} fizeram as pazes.`, 'paz');
      }),
      ev.on('reino:eraNova', (d) => {
        const nomes = ['tribal', 'de aldeias', 'de reino', 'imperial'];
        const r = mundo.reinos[d.reino];
        if (r) this.escrever(ano(), `${r.nome} entrou na era ${nomes[d.era] ?? d.era}.`);
      }),
      ev.on('aldeia:fundada', (d) => {
        const a = mundo.aldeias[d.aldeia];
        if (a) this.escrever(ano(), `${a.nome} foi fundada.`);
      }),
      ev.on('aldeia:destruida', (d) => {
        const a = mundo.aldeias[d.aldeia];
        if (a) this.escrever(ano(), `${a.nome} caiu em ruínas.`, 'guerra');
      }),
      ev.on('aldeia:conquistada', (d) => {
        const a = mundo.aldeias[d.aldeia];
        const novo = mundo.reinos[d.para];
        if (a && novo) this.escrever(ano(), `${a.nome} foi tomada por ${novo.nome}.`, 'guerra');
      }),
      ev.on('aldeia:cresceu', (d) => {
        const a = mundo.aldeias[d.aldeia];
        const nomes = ['', 'acampamento', 'aldeia', 'vila', 'cidade', 'metrópole'];
        if (a) this.escrever(ano(), `${a.nome} virou ${nomes[d.nivel] ?? 'algo maior'}.`);
      }),
      ev.on('reino:alianca', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `${a} e ${b} firmaram aliança.`, 'paz');
      }),
      ev.on('reino:aliancaRompida', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `A aliança entre ${a} e ${b} se desfez.`);
      }),
      ev.on('vulcao:erupcao', (d) => {
        this.escrever(ano(), `Um vulcão entrou em erupção em ${d.x}, ${d.y}.`, 'guerra');
      }),
      ev.on('especie:migrou', (d) => {
        const nome = especies.porIndice(d.especie).plural;
        this.escrever(ano(), `Um grupo de ${nome} chegou de terras distantes.`);
      }),
      ev.on('mundo:gerado', (d) => this.escrever(0, `Um mundo novo começou. Semente: ${d.semente}.`)),
      ev.on('mundo:carregado', (d) => this.escrever(ano(), `Mundo carregado (${d.semente}).`)),
    );
  }

  private escrever(ano: number, texto: string, classe = ''): void {
    const li = document.createElement('li');
    if (classe) li.className = classe;
    const quando = document.createElement('span');
    quando.className = 'quando';
    quando.textContent = `A${String(ano).padStart(3, '0')}`;
    li.append(quando, document.createTextNode(texto));
    this.lista.prepend(li);
    while (this.lista.childElementCount > MAX_LINHAS) {
      this.lista.lastElementChild?.remove();
    }
  }
}
