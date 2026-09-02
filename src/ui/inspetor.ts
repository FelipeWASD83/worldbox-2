import type { Mundo } from '../core/mundo.js';
import { NOME_ESTADO, MARCA_DOENTE, MARCA_SOLDADO } from '../core/criaturas.js';
import { ESP_VIDA, TICKS_ANO, especies } from '../dados/especies.js';
import { TOTAL_TRACOS, tracos } from '../dados/tracos.js';
import { biomas } from '../dados/biomas.js';
import { ESP_CIVILIZADO } from '../dados/especies.js';
import { nomeDeCriatura } from '../dados/nomes.js';
import { equipamentos } from '../dados/equipamentos.js';
import { edificios, MATERIAIS_DE_OBRA, especieDoAcabamento, materialDoAcabamento } from '../dados/edificios.js';
import { recursos } from '../dados/recursos.js';
import { MATERIAIS, NOME_MATERIAL } from '../dados/materiais.js';
import { materialPorIndice } from '../sim/coleta.js';
import { lealdadeMedia } from '../sim/cultura.js';
import { materialDoReino } from '../sim/conhecimento.js';
import { NOME_ERA, tecnologias } from '../dados/tecnologias.js';
import { NOME_FOCO, focoDe } from '../sim/comandos.js';
import { ancoraDaConstrucao } from '../sim/urbanismo.js';

/**
 * Painel do que está selecionado: uma criatura, uma aldeia ou um pedaço de
 * terreno. Atualiza algumas vezes por segundo, não a cada quadro — ninguém lê
 * texto a 60 Hz e reescrever o DOM tão rápido custa mais que a simulação.
 */
/** Esta criatura é o rei do reino dela? */
function ehRei(mundo: Mundo, i: number): boolean {
  const r = mundo.reinos[mundo.criaturas.reino[i]];
  return r?.ativo === true && r.rei === i && mundo.mesmaPessoa(i, r.reiGer);
}

/** Esta criatura governa a vila em que mora? */
function ehGovernante(mundo: Mundo, i: number): boolean {
  const a = mundo.aldeias[mundo.criaturas.aldeia[i]];
  return a?.ativa === true && a.governante === i && mundo.mesmaPessoa(i, a.governanteGer);
}

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
      ? `${nomeDeCriatura(mundo.semente, i, def.id)}, ${def.nome}`
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
    // ------------------------------------------------------------ política
    // Só para quem tem: bicho selvagem não tem bolso nem sobrenome, e encher o
    // inspetor de "—" para um coelho não ajuda ninguém.
    if (def.inteligente) {
      const cargo = ehRei(mundo, i)
        ? `rei de ${mundo.reinos[c.reino[i]]?.nome ?? '?'}`
        : ehGovernante(mundo, i)
          ? `governa ${mundo.aldeias[c.aldeia[i]]?.nome ?? '?'}`
          : null;
      if (cargo) this.alvo.append(dado('cargo', cargo));
      this.alvo.append(dado('riqueza', `${c.riqueza[i].toFixed(0)} de ouro`));
      // O que esta pessoa é de nascença — o que não muda quando ela perde o
      // cargo ou a fortuna. A dica de cada linha traz o que o traço faz.
      if (c.tracos[i] !== 0) {
        const meus: number[] = [];
        for (let t = 0; t < TOTAL_TRACOS; t++) {
          if (c.tracos[i] & (1 << t)) meus.push(t);
        }
        const linha = dado('traços', meus.map((t) => tracos.porIndice(t).nome).join(', '));
        linha.title = meus
          .map((t) => `${tracos.porIndice(t).nome}: ${tracos.porIndice(t).descricao}`)
          .join('\n');
        this.alvo.append(linha);
      }
      const cla = mundo.cla(c.cla[i]);
      if (cla) {
        // Os valores do clã, e não só o nome: são eles que explicam por que
        // aquela pessoa está leal ou prestes a se revoltar.
        this.alvo.append(dado('clã', cla.nome));
        this.alvo.append(dado(
          'valores do clã',
          `guerra ${(cla.marcialidade * 100) | 0}% · cobiça ${(cla.ganancia * 100) | 0}%`
          + ` · obediência ${(cla.submissao * 100) | 0}% · fechamento ${(cla.fechamento * 100) | 0}%`,
        ));
      }
      if (c.familia[i] >= 0) {
        const daCasaReal = mundo.reinos[c.reino[i]]?.casaReal === c.familia[i];
        this.alvo.append(dado(
          'família',
          `casa ${c.familia[i]}${daCasaReal ? ' — a casa real' : ''}`,
        ));
      }
      this.alvo.append(barra('lealdade', c.fidelidade[i] / 100,
        c.fidelidade[i] > 45 ? '#4a7ec8' : '#d05a4a'));
    }

    // Mestiço: de que dois povos ele veio. Sem isto, "meio-elfo" é só um nome
    // esquisito na ficha.
    if (def.hibrido) {
      const [pa, pb] = def.hibrido;
      this.alvo.append(dado(
        'sangue de',
        `${especies.obter(pa).plural} e ${especies.obter(pb).plural}`,
      ));
    }
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

    // quem manda aqui, e quanto cobra
    const c = mundo.criaturas;
    if (mundo.mesmaPessoa(a.governante, a.governanteGer)) {
      const nome = nomeDeCriatura(mundo.semente, a.governante, def.id);
      this.alvo.append(dado(
        'governante',
        `${nome} · ${c.riqueza[a.governante].toFixed(0)} de ouro`,
      ));
    }
    this.alvo.append(dado('imposto', `${(a.imposto * 100).toFixed(0)}%`));

    // A lealdade média da vila é o número que diz se ela está prestes a virar
    // um reino novo. Vermelho abaixo de 26 é literalmente o limiar da rebelião
    // (`BAL.lealdadeParaRebelar`).
    const lealdade = lealdadeMedia(mundo, a);
    this.alvo.append(barra(
      'lealdade da vila',
      lealdade / 100,
      lealdade > 45 ? '#4a7ec8' : lealdade > 26 ? '#d0a04a' : '#d05a4a',
    ));

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
      if (mundo.mesmaPessoa(reino.rei, reino.reiGer)) {
        this.alvo.append(dado(
          'rei',
          `${nomeDeCriatura(mundo.semente, reino.rei, especies.porIndice(c.especie[reino.rei]).id)}`,
        ));
      }
      this.alvo.append(dado('tesouro do reino', `${reino.tesouro.toFixed(0)} de ouro`));
      this.alvo.append(dado('era', NOME_ERA[reino.era] ?? String(reino.era)));
      this.alvo.append(dado(
        'descobertas',
        `${reino.tecnologias.size} de ${tecnologias.tamanho} · ${reino.conhecimento.toFixed(0)} de conhecimento`,
      ));
      this.alvo.append(dado(
        'constrói de',
        MATERIAIS_DE_OBRA[materialDoReino(reino)]?.nome ?? '—',
      ));
      const guerras = [...reino.guerras]
        .map((id) => mundo.reinos[id]?.nome)
        .filter(Boolean);
      this.alvo.append(dado('em guerra com', guerras.length ? guerras.join(', ') : 'ninguém'));
      const aliados = [...reino.aliancas]
        .map((id) => mundo.reinos[id]?.nome)
        .filter(Boolean);
      if (aliados.length > 0) this.alvo.append(dado('aliado de', aliados.join(', ')));

      // O que este reino sabe do mundo. Num mapa com névoa isto muda tudo: uma
      // potência que só conhece dois vizinhos vive num mundo pequeno, por maior
      // que seja o mapa.
      const vivos = mundo.reinos.filter((r) => r.ativo).length - 1;
      this.alvo.append(dado(
        'conhece',
        vivos <= 0 ? 'é o único reino do mundo' : `${reino.conhecidos.size} de ${vivos} reinos`,
      ));
      const magoas = [...reino.rancor.entries()]
        .filter(([id]) => mundo.reinos[id]?.ativo)
        .sort((x, z) => z[1] - x[1])
        .slice(0, 3)
        .map(([id, quanto]) => `${mundo.reinos[id].nome} (${Math.round(quanto)})`);
      if (magoas.length > 0) this.alvo.append(dado('tem contas com', magoas.join(', ')));
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
      // De que ela é feita, e por quem. É o que explica duas casas vizinhas
      // valerem coisas diferentes: a de palha veio da tribo, a de pedra veio
      // depois da alvenaria.
      const acabamento = g.acabamento[predio];
      const mat = MATERIAIS_DE_OBRA[materialDoAcabamento(acabamento)];
      if (mat) this.alvo.append(dado('feita de', mat.nome));
      const povo = especies.porIndice(especieDoAcabamento(acabamento));
      if (povo?.povo) this.alvo.append(dado('erguida por', povo.plural));
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
