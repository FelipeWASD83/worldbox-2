import type { Mundo } from '../core/mundo.js';
import { NOME_ESTADO, MARCA_DOENTE, MARCA_SOLDADO } from '../core/criaturas.js';
import { ESP_VIDA, TICKS_ANO, especies } from '../dados/especies.js';
import { biomas } from '../dados/biomas.js';
import { ESP_CIVILIZADO } from '../dados/especies.js';
import { nomeProprio } from '../dados/nomes.js';
import { Rng } from '../core/rng.js';
import { equipamentos } from '../dados/equipamentos.js';
import { edificios } from '../dados/edificios.js';
import { recursos } from '../dados/recursos.js';
import { MATERIAIS, NOME_MATERIAL } from '../dados/materiais.js';
import { materialPorIndice } from '../sim/coleta.js';
import { NOME_FOCO, focoDe } from '../sim/comandos.js';
import { ancoraDaConstrucao } from '../sim/urbanismo.js';

/**
 * Painel do que está selecionado: uma criatura, uma aldeia ou um pedaço de
 * terreno. Atualiza algumas vezes por segundo, não a cada quadro — ninguém lê
 * texto a 60 Hz e reescrever o DOM tão rápido custa mais que a simulação.
 */
export class Inspetor {
  criatura = -1;
  aldeia = -1;
  tile = -1;
  private ultimo = 0;

  constructor(private alvo: HTMLElement) {}

  limpar(): void {
    this.criatura = -1;
    this.aldeia = -1;
    this.tile = -1;
    this.alvo.className = 'vazio';
    this.alvo.textContent = 'Nada selecionado.';
  }

  atualizar(mundo: Mundo, agora: number, forcar = false): void {
    if (!forcar && agora - this.ultimo < 180) return;
    this.ultimo = agora;

    if (this.criatura >= 0 && mundo.criaturas.vivo[this.criatura]) {
      this.desenharCriatura(mundo);
    } else if (this.criatura >= 0) {
      this.alvo.className = 'vazio';
      this.alvo.textContent = 'A criatura que você acompanhava morreu.';
      this.criatura = -1;
    } else if (this.aldeia >= 0 && mundo.aldeias[this.aldeia]?.ativa) {
      this.desenharAldeia(mundo);
    } else if (this.aldeia >= 0) {
      const nome = mundo.aldeias[this.aldeia]?.nome ?? 'A aldeia';
      this.alvo.className = 'vazio';
      this.alvo.textContent = `${nome} não existe mais.`;
      this.aldeia = -1;
    } else if (this.tile >= 0) {
      this.desenharTile(mundo);
    }
  }

  private desenharCriatura(mundo: Mundo): void {
    const c = mundo.criaturas;
    const i = this.criatura;
    const def = especies.porIndice(c.especie[i]);
    const vidaMax = ESP_VIDA[c.especie[i]];
    const anos = (c.idade[i] / TICKS_ANO).toFixed(1);
    const anosMax = (c.longevidade[i] / TICKS_ANO).toFixed(0);

    const aldeia = c.aldeia[i] >= 0 ? mundo.aldeias[c.aldeia[i]] : undefined;
    const reino = c.reino[i] >= 0 ? mundo.reinos[c.reino[i]] : undefined;

    const marcas: string[] = [];
    if ((c.marcas[i] & MARCA_SOLDADO) !== 0) marcas.push('soldado');
    if ((c.marcas[i] & MARCA_DOENTE) !== 0) marcas.push('doente');

    // Gente tem nome; bicho é chamado pela espécie. O nome sai de um sorteio
    // preso ao índice e à semente do mundo, então é sempre o mesmo para a mesma
    // criatura sem custar um campo a mais no pool.
    const chamado = ESP_CIVILIZADO[c.especie[i]] === 1
      ? `${nomeProprio(new Rng(`${mundo.semente}:${i}`), def.id)}, ${def.nome}`
      : def.nome;

    this.alvo.className = '';
    this.alvo.replaceChildren();
    this.alvo.append(
      titulo(chamado, `${NOME_ESTADO[c.estado[i]] ?? '—'}${marcas.length ? ` · ${marcas.join(' · ')}` : ''}`),
      barra('vida', c.vida[i] / vidaMax, '#4fbf72'),
      barra('fome', c.fome[i] / 100, '#d0904a'),
      dado('idade', `${anos} / ${anosMax} anos`),
      dado('posição', `${c.x[i].toFixed(0)}, ${c.y[i].toFixed(0)}`),
      dado('dieta', def.dieta),
      dado('espécie', def.inteligente ? 'inteligente' : 'irracional'),
      dado('lutas vencidas', String(Math.round(c.xp[i]))),
    );

    // equipamento é o que decide uma batalha: precisa estar visível
    const vestido: string[] = [];
    if (c.arma[i] !== 0) vestido.push(equipamentos.porIndice(c.arma[i] - 1).nome);
    if (c.escudo[i] !== 0) vestido.push(equipamentos.porIndice(c.escudo[i] - 1).nome);
    if (c.armadura[i] !== 0) vestido.push(equipamentos.porIndice(c.armadura[i] - 1).nome);
    if (vestido.length > 0) this.alvo.append(dado('equipado com', vestido.join(', ')));
    if (aldeia) this.alvo.append(dado('vive em', aldeia.nome));
    if (reino) this.alvo.append(dado('reino', reino.nome));
    if (c.carga[i] > 0) {
      const m = materialPorIndice(c.cargaMaterial[i]);
      this.alvo.append(dado('carregando', `${c.carga[i].toFixed(0)} de ${NOME_MATERIAL[m]}`));
    }
  }

  private desenharAldeia(mundo: Mundo): void {
    const a = mundo.aldeias[this.aldeia];
    const reino = mundo.reinos[a.reino];
    const def = especies.porIndice(a.especie);
    const niveis = ['', 'acampamento', 'aldeia', 'vila', 'cidade', 'metrópole'];

    this.alvo.className = '';
    this.alvo.replaceChildren();
    this.alvo.append(
      titulo(a.nome, `${niveis[a.nivel] ?? '—'} de ${def.plural}`),
      barra('moral', a.moral / 100, a.moral > 50 ? '#4fbf72' : '#d05a4a'),
      dado('população', `${a.populacao} de ${a.capacidade}`),
      dado('foco', NOME_FOCO[focoDe(a)]),
      dado('casas', String(a.casas)),
      dado('fundada no ano', String(Math.floor(a.fundadaEm / TICKS_ANO))),
    );

    // o estoque inteiro, que é do que a aldeia vive
    for (const m of MATERIAIS) {
      this.alvo.append(dado(
        NOME_MATERIAL[m],
        `${a.estoque[m].toFixed(0)} / ${a.capacidadeEstoque}`,
      ));
    }

    // o que ela ergueu, que é o que ela sabe fazer
    const construido: string[] = [];
    for (let e = 0; e < a.predios.length; e++) {
      if (a.predios[e] > 0) construido.push(`${a.predios[e]}× ${edificios.porIndice(e).nome}`);
    }
    if (construido.length > 0) this.alvo.append(dado('construções', construido.join(', ')));
    if (reino?.ativo) {
      this.alvo.append(dado('reino', reino.nome));
      const guerras = [...reino.guerras]
        .map((id) => mundo.reinos[id]?.nome)
        .filter(Boolean);
      this.alvo.append(dado('em guerra com', guerras.length ? guerras.join(', ') : 'ninguém'));
      const aliados = [...reino.aliancas]
        .map((id) => mundo.reinos[id]?.nome)
        .filter(Boolean);
      if (aliados.length > 0) this.alvo.append(dado('aliado de', aliados.join(', ')));
    }
  }

  private desenharTile(mundo: Mundo): void {
    const g = mundo.grid;
    const i = this.tile;
    const bioma = biomas.porIndice(g.bioma[i]);
    const temperatura = Math.round((g.temp[i] / 255) * 80 - 30);

    this.alvo.className = '';
    this.alvo.replaceChildren();
    this.alvo.append(
      titulo(bioma.nome, `tile ${i % g.largura}, ${(i / g.largura) | 0}`),
      dado('altitude', String(g.alt[i])),
      dado('temperatura', `${temperatura} °C`),
      dado('umidade', `${Math.round((g.umidade[i] / 255) * 100)}%`),
      dado('vegetação', `${Math.round((g.vegetacao[i] / 255) * 100)}%`),
    );
    if (g.fogo[i] > 0) this.alvo.append(dado('em chamas', `${g.fogo[i]} ticks`));
    if (g.recurso[i] !== 0) {
      const r = recursos.porIndice(g.recurso[i] - 1);
      this.alvo.append(dado(r.nome, `${g.recursoQtd[i]} de ${r.quantidade}`));
      this.alvo.append(dado('rende', NOME_MATERIAL[r.rende]));
    }
    const predio = ancoraDaConstrucao(mundo, i);
    if (predio >= 0) {
      this.alvo.append(dado('construção', mundo.nomeEdificio(g.construcao[predio])));
      const dona = mundo.aldeias[g.aldeiaDona[predio]];
      if (dona?.ativa) this.alvo.append(dado('de', dona.nome));
    }
    if (g.estrada[i] === 1) this.alvo.append(dado('estrada', 'sim'));
    if (g.territorio[i] >= 0) {
      const r = mundo.reinos[g.territorio[i]];
      if (r?.ativo) this.alvo.append(dado('território de', r.nome));
    }
  }
}

function titulo(texto: string, sub: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const h = document.createElement('div');
  h.className = 'titulo-inspetor';
  h.textContent = texto;
  const s = document.createElement('div');
  s.className = 'sub-inspetor';
  s.textContent = sub;
  frag.append(h, s);
  return frag;
}

function dado(rotulo: string, valor: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'linha-dado';
  const a = document.createElement('span');
  a.textContent = rotulo;
  const b = document.createElement('b');
  b.textContent = valor;
  div.append(a, b);
  return div;
}

function barra(rotulo: string, fracao: number, cor: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(dado(rotulo, `${Math.round(Math.max(0, Math.min(1, fracao)) * 100)}%`));
  const barra = document.createElement('div');
  barra.className = 'barra';
  const i = document.createElement('i');
  i.style.width = `${Math.max(0, Math.min(1, fracao)) * 100}%`;
  i.style.background = cor;
  barra.append(i);
  frag.append(barra);
  return frag;
}
