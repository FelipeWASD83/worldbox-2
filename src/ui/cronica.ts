import type { Mundo } from '../core/mundo.js';
import { especies } from '../dados/especies.js';
import { nomeDeCriatura } from '../dados/nomes.js';
import { NOME_ERA, tecnologias } from '../dados/tecnologias.js';
import { tracos } from '../dados/tracos.js';

/**
 * A crônica do mundo: só os acontecimentos que valem uma linha.
 *
 * Nascimento e morte de bicho não entram — seriam milhares por minuto e
 * enterrariam o que importa. Entra o que muda o mapa político.
 */
const MAX_LINHAS = 220;

export class Cronica {
  private desligar: Array<() => void> = [];
  /** Povos mestiços que já ganharam a linha de estreia deles. */
  private mesticosVistos = new Set<number>();

  constructor(private lista: HTMLUListElement) {}

  ligar(mundo: Mundo): void {
    for (const fn of this.desligar) fn();
    this.desligar = [];
    this.mesticosVistos.clear();
    this.lista.replaceChildren();

    const ev = mundo.eventos;
    const ano = () => Math.floor(mundo.tick / 400);

    this.desligar.push(
      ev.on('reino:fundado', (d) => this.escrever(ano(), `${d.nome} foi fundado.`)),
      ev.on('reino:extinto', (d) => this.escrever(ano(), `${d.nome} deixou de existir.`, 'guerra')),
      ev.on('reino:guerra', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        // O motivo é o casus belli que mais pesou na decisão. Ler a crônica
        // passa a explicar o mapa: "guerra por ódio antigo aos orcs" diz uma
        // coisa, "disputa de fronteira" diz outra bem diferente.
        this.escrever(ano(), `${a} declarou guerra a ${b} — ${d.motivo}.`, 'guerra');
      }),
      ev.on('reino:conheceu', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `${a} e ${b} souberam um do outro pela primeira vez.`);
      }),
      ev.on('reino:paz', (d) => {
        const a = mundo.reinos[d.a]?.nome ?? '?';
        const b = mundo.reinos[d.b]?.nome ?? '?';
        this.escrever(ano(), `${a} e ${b} fizeram as pazes.`, 'paz');
      }),
      ev.on('criatura:mesticou', (d) => {
        // Só a primeira vez que cada povo mestiço aparece. Depois disso são
        // centenas de nascimentos, e a crônica é para o que muda o mapa.
        if (this.mesticosVistos.has(d.especie)) return;
        this.mesticosVistos.add(d.especie);
        const povo = especies.porIndice(d.especie);
        const a = especies.porIndice(d.pai).plural;
        const b = especies.porIndice(d.mae).plural;
        this.escrever(ano(), `Nasceu o primeiro ${povo.nome}, de ${a} e ${b}.`, 'paz');
      }),
      ev.on('criatura:prodigio', (d) => {
        const nome = nomeDeCriatura(mundo.semente, d.id, especies.porIndice(d.especie).id);
        this.escrever(ano(), `${nome} nasceu ${tracos.porIndice(d.traco).nome}.`, 'paz');
      }),
      ev.on('reino:descobriu', (d) => {
        const r = mundo.reinos[d.reino];
        if (r) this.escrever(ano(), `${r.nome} descobriu ${tecnologias.porIndice(d.tecnologia).nome}.`);
      }),
      ev.on('reino:eraNova', (d) => {
        const r = mundo.reinos[d.reino];
        if (r) this.escrever(ano(), `${r.nome} entrou na era ${NOME_ERA[d.era] ?? d.era}.`, 'paz');
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
      ev.on('reino:coroou', (d) => {
        const r = mundo.reinos[d.reino];
        if (!r) return;
        const esp = especies.porIndice(mundo.criaturas.especie[d.quem]).id;
        const nome = nomeDeCriatura(mundo.semente, d.quem, esp);
        // A troca de dinastia é a notícia grande: quem lê a crônica precisa
        // distinguir "morreu o rei, entrou o filho" de "a casa acabou e outra
        // família tomou o trono".
        const trocouDeCasa = d.antes >= 0 && d.casa !== mundo.criaturas.familia[d.antes];
        this.escrever(
          ano(),
          trocouDeCasa
            ? `A casa real de ${r.nome} se extinguiu. ${nome} tomou o trono.`
            : `${nome} foi coroado em ${r.nome}.`,
          trocouDeCasa ? 'guerra' : undefined,
        );
      }),
      ev.on('reino:rebeliao', (d) => {
        const novo = mundo.reinos[d.novo]?.nome ?? '?';
        const antigo = mundo.reinos[d.antigo]?.nome ?? '?';
        const onde = mundo.aldeias[d.aldeia]?.nome ?? '?';
        this.escrever(
          ano(),
          d.vilas > 1
            ? `${onde} e mais ${d.vilas - 1} vila(s) se separaram de ${antigo} e fundaram ${novo}.`
            : `${onde} se separou de ${antigo} e fundou ${novo}.`,
          'guerra',
        );
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
