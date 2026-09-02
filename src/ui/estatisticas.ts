import type { Mundo } from '../core/mundo.js';
import { especies } from '../dados/especies.js';

/**
 * Painel "O mundo": quem está vivo e em que quantidade, e o estado político.
 * Redesenhado poucas vezes por segundo.
 */
export class PainelEstatisticas {
  private ultimo = 0;

  constructor(private alvo: HTMLElement) {}

  atualizar(mundo: Mundo, agora: number): void {
    if (agora - this.ultimo < 400) return;
    this.ultimo = agora;

    const s = mundo.estatisticas;
    const linhas: HTMLElement[] = [];

    linhas.push(linhaSimples('aldeias', String(s.aldeias)));
    linhas.push(linhaSimples('reinos', String(s.reinos)));
    linhas.push(linhaSimples('guerras', String(s.guerras)));
    if (s.incendios > 0) linhas.push(linhaSimples('tiles em chamas', String(s.incendios)));
    linhas.push(separador());

    // espécies vivas, da mais numerosa para a menos
    const vivas: Array<[number, number]> = [];
    for (let i = 0; i < s.porEspecie.length; i++) {
      if (s.porEspecie[i] > 0) vivas.push([i, s.porEspecie[i]]);
    }
    vivas.sort((a, b) => b[1] - a[1]);

    for (const [indice, quantos] of vivas) {
      const def = especies.porIndice(indice);
      const div = document.createElement('div');
      div.className = 'especie-linha';
      const cor = document.createElement('i');
      cor.style.background = `#${def.cores[0].toString(16).padStart(6, '0')}`;
      const nome = document.createElement('span');
      nome.textContent = def.plural;
      const n = document.createElement('b');
      n.textContent = String(quantos);
      div.append(cor, nome, n);
      linhas.push(div);
    }

    if (vivas.length === 0) {
      const p = document.createElement('div');
      p.className = 'linha-dado';
      p.textContent = 'O mundo está vazio.';
      linhas.push(p);
    }

    this.alvo.replaceChildren(...linhas);
  }
}

function linhaSimples(rotulo: string, valor: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'linha-dado';
  const a = document.createElement('span');
  a.textContent = rotulo;
  const b = document.createElement('b');
  b.textContent = valor;
  div.append(a, b);
  return div;
}

function separador(): HTMLElement {
  const hr = document.createElement('div');
  hr.style.height = '9px';
  return hr;
}
