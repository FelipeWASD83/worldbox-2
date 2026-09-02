import type { Mundo } from '../core/mundo.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { MARCA_DOENTE, MARCA_DOMESTICADO, MARCA_SOLDADO, Estado } from '../core/criaturas.js';
import { B } from '../dados/biomas.js';
import {
  ESP_CIVILIZADO, ESP_DOMINIO, ESP_INTELIGENTE, ESP_VIDA, especies,
} from '../dados/especies.js';
import { REC_QUANTIDADE } from '../dados/recursos.js';
import { MATERIAIS } from '../dados/materiais.js';
import { nomeDeAldeia, nomeDeCla, nomeDeReino } from '../dados/nomes.js';
import { atear } from './ecologia.js';
import { ancoraDaConstrucao, derrubar } from './urbanismo.js';
import { tentarRebelar } from './cultura.js';
import { aprender } from './conhecimento.js';
import { comTracoSorteado, vidaMaxima } from './genetica.js';
import { MASCARA_RARA } from '../dados/tracos.js';
import { empossarChefes } from './politica.js';
import type { Nuvem } from './clima.js';
import { TEC_CUSTO, TEC_ERA, TEC_REQUER } from '../dados/tecnologias.js';
import {
  poderes, porCriatura, porTile, pintar, proximaDescoberta, refazerBioma,
  reinosNaArea,
} from './poderesBase.js';
import { registrarDerivados } from './poderesDerivados.js';

export { poderes } from './poderesBase.js';
export type { Poder, Categoria } from './poderesBase.js';
export { CATEGORIAS, NOME_CATEGORIA } from './poderesBase.js';

// --------------------------------------------------------------------- terreno

poderes.registrarTodos([
  {
    id: 'elevar', nome: 'Elevar', icone: '▲', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Levanta o terreno. Levantado o bastante, o mar vira ilha e a ilha vira montanha.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        mundo.grid.alt[i] = Math.min(255, mundo.grid.alt[i] + 5 * forca + 1);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'rebaixar', nome: 'Rebaixar', icone: '▼', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Afunda o terreno. Vai fundo demais e o mar entra.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        mundo.grid.alt[i] = Math.max(0, mundo.grid.alt[i] - 5 * forca - 1);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'agua', nome: 'Água', icone: '≈', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Alaga a região.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.alt[i] = NIVEL_MAR - 14;
        mundo.grid.fogo[i] = 0;
        mundo.chamas.delete(i);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'planicie', nome: 'Campo', icone: '❞', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Cobre o chão de grama.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.planicie, NIVEL_MAR + 6, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 170;
      });
    },
  },
  {
    id: 'floresta', nome: 'Floresta', icone: '♣', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Planta mata fechada. Boa para elfos — e ótima para o fogo.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.floresta, NIVEL_MAR + 6, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 250;
      });
    },
  },
  {
    id: 'deserto', nome: 'Areia', icone: '░', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Seca a terra.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.deserto, NIVEL_MAR + 4, NIVEL_MONTANHA - 10);
        mundo.grid.vegetacao[i] = 10;
        mundo.grid.umidade[i] = 30;
      });
    },
  },
  {
    id: 'montanha', nome: 'Montanha', icone: '⛰', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Ergue rocha. Nada anda por cima.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        // a borda também precisa passar do limite do que se anda, senão a
        // muralha de montanha fica com a beirada furada
        mundo.grid.alt[i] = Math.max(
          mundo.grid.alt[i],
          NIVEL_MONTANHA + 42 + forca * 30,
        );
        mundo.grid.limparRecurso(i);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'lava', nome: 'Lava', icone: '🜂', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Rocha derretida. Mata o que pisar.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        pintar(mundo, i, B.lava, NIVEL_MAR + 2, 255);
        mundo.grid.vegetacao[i] = 0;
      });
    },
  },

  {
    id: 'neve', nome: 'Nevar', icone: '❄', categoria: 'terreno', raio: 5, continuo: true,
    descricao: 'Congela a regiao. O que era campo vira gelo, e quem vive de pasto some.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.temp[i] = Math.max(0, g.temp[i] - 60);
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        if (g.ehTerra(i)) pintar(mundo, i, B.neve, NIVEL_MAR + 2, 255);
        else pintar(mundo, i, B.gelo, 0, NIVEL_MAR - 1);
        g.vegetacao[i] = 0;
      });
    },
  },
  {
    id: 'pantano', nome: 'Pantano', icone: '≈', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Encharca a terra e enche de mato.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.umidade[i] = 240;
        pintar(mundo, i, B.pantano, NIVEL_MAR + 1, NIVEL_MAR + 12);
        mundo.grid.vegetacao[i] = 150;
      });
    },
  },
  // Os plantios individuais (árvore, arbusto, ferro, ouro) saíam daqui e agora
  // vêm prontos do registro de recursos, na aba de natureza — quinze deles, um
  // por recurso, em vez dos quatro escritos à mão. Ver `poderesDerivados.ts`.
  {
    id: 'limpar', nome: 'Limpar', icone: '⌫', categoria: 'terreno', raio: 5, continuo: true,
    descricao: 'Tira arvores, pedras e construcoes do caminho, sem mexer no chao.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.limparRecurso(i);
        g.estrada[i] = 0;
        const alvo = ancoraDaConstrucao(mundo, i);
        if (alvo >= 0) derrubar(mundo, alvo, false);
      });
    },
  },
  // ------------------------------------------------------------------- vida
  {
    id: 'criar', nome: 'Criar ser', icone: '✿', categoria: 'vida', raio: 2, continuo: false,
    descricao: 'Põe no mundo a criatura escolhida na lista ao lado.',
    aplicar(mundo, x, y, raio, parametro = 0) {
      const quantos = Math.max(1, Math.round(raio * 0.8));
      for (let k = 0; k < quantos; k++) {
        const px = x + mundo.rng.entre(-raio, raio);
        const py = y + mundo.rng.entre(-raio, raio);
        if (px < 0 || py < 0 || px >= mundo.grid.largura || py >= mundo.grid.altura) continue;
        const def = especies.porIndice(parametro);
        mundo.nascer(parametro, px, py, def.longevidade[0] * 0.25);
      }
    },
  },
  {
    id: 'curar', nome: 'Curar', icone: '✚', categoria: 'vida', raio: 6, continuo: true,
    descricao: 'Restaura a vida, mata a fome e limpa doença de quem estiver perto.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.vida[id] = ESP_VIDA[c.especie[id]];
        c.fome[id] = 0;
        c.marcas[id] &= ~MARCA_DOENTE;
      });
      porTile(mundo, x, y, raio, (i) => {
        mundo.grid.fogo[i] = 0;
        mundo.chamas.delete(i);
        mundo.grid.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'aldeia', nome: 'Fundar reino', icone: '⚑', categoria: 'vida', raio: 2, continuo: false,
    descricao: 'Funda um reino novo do povo escolhido, com aldeia e primeiros moradores.',
    aplicar(mundo, x, y, _raio, parametro = 0) {
      const g = mundo.grid;
      const tx = Math.round(x);
      const ty = Math.round(y);
      if (!g.dentro(tx, ty)) return;
      const i = g.idx(tx, ty);
      if (!g.ehTerra(i) || g.ehMontanha(i)) return;
      const def = especies.porIndice(parametro);
      if (def.categoria !== 'civilizado') return;
      const reino = mundo.criarReino(parametro, nomeDeReino(mundo.rng, def.id), def.povo?.corReino ?? 0x999999);
      const aldeia = mundo.criarAldeia(reino.id, parametro, tx, ty, nomeDeAldeia(mundo.rng, def.id));
      reino.capital = aldeia.id;
      // Reino fundado pela mão do jogador nasce igual aos do começo do mundo:
      // com casa real, casa rival e clã. Sem isso ele viria sem linhagem para
      // a coroa seguir e sem clã para a lealdade medir — politicamente oco.
      const casaReal = mundo.novaFamilia();
      const casaRival = mundo.novaFamilia();
      const cla = mundo.criarCla(parametro).id;
      reino.casaReal = casaReal;
      for (let k = 0; k < 9; k++) {
        const idade = mundo.rng.entre(def.longevidade[0] * 0.16, def.longevidade[0] * 0.34);
        const c = mundo.nascer(parametro, tx + mundo.rng.entre(-2, 2), ty + mundo.rng.entre(-2, 2), idade);
        if (c < 0) break;
        mundo.criaturas.aldeia[c] = aldeia.id;
        mundo.criaturas.reino[c] = reino.id;
        mundo.criaturas.familia[c] = k < 3 ? casaReal : casaRival;
        mundo.criaturas.cla[c] = cla;
        mundo.criaturas.riqueza[c] = k < 3 ? mundo.rng.entre(18, 30) : mundo.rng.entre(2, 10);
        aldeia.populacao++;
      }
      empossarChefes(mundo, aldeia);
    },
  },

  {
    id: 'fertilizar', nome: 'Fertilizar', icone: '✽', categoria: 'vida', raio: 6, continuo: true,
    descricao: 'A terra floresce: mato no ponto maximo, arvores e arbustos cheios de novo.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.ehAgua(i)) return;
        g.vegetacao[i] = 255;
        g.umidade[i] = Math.min(255, g.umidade[i] + 40);
        if (g.recurso[i] !== 0) g.recursoQtd[i] = REC_QUANTIDADE[g.recurso[i] - 1];
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'mutar', nome: 'Mutacao', icone: '🜛', categoria: 'vida', raio: 5, continuo: false,
    descricao: 'Da um traco novo, sorteado, a cada ser inteligente daqui. Pode sair forte, sabio, ganancioso — ou imortal.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_INTELIGENTE[c.especie[id]] === 0) return;
        const antes = c.tracos[id];
        c.tracos[id] = comTracoSorteado(mundo, antes);
        if (c.tracos[id] === antes) return;
        // vida e longevidade saem do traço, então mudam junto
        c.vida[id] = Math.min(c.vida[id], vidaMaxima(c, id));
        const raro = c.tracos[id] & MASCARA_RARA;
        if (raro !== 0) {
          mundo.eventos.emitir('criatura:prodigio', {
            id,
            especie: c.especie[id],
            traco: 31 - Math.clz32(raro),
          });
        }
      });
    },
  },
  {
    id: 'domesticar', nome: 'Domesticar', icone: '☘', categoria: 'vida', raio: 5, continuo: false,
    descricao: 'Os bichos daqui passam a pertencer ao reino mais proximo, que deixa de caca-los.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const aldeia = mundo.aldeiaMaisProxima(x, y, 60);
      if (aldeia < 0) return;
      const dona = mundo.aldeias[aldeia];
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_INTELIGENTE[c.especie[id]] === 1) return;
        c.marcas[id] |= MARCA_DOMESTICADO;
        c.reino[id] = dona.reino;
      });
    },
  },
  {
    id: 'converter', nome: 'Converter', icone: '☉', categoria: 'vida', raio: 5, continuo: false,
    descricao: 'Quem estiver aqui troca de bandeira e passa a servir ao reino mais proximo.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const aldeia = mundo.aldeiaMaisProxima(x, y, 80);
      if (aldeia < 0) return;
      const destino = mundo.aldeias[aldeia];
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_INTELIGENTE[c.especie[id]] === 0) return;
        if (c.aldeia[id] === destino.id) return;
        const antiga = c.aldeia[id] >= 0 ? mundo.aldeias[c.aldeia[id]] : undefined;
        if (antiga?.ativa) antiga.populacao = Math.max(0, antiga.populacao - 1);
        c.aldeia[id] = destino.id;
        c.reino[id] = destino.reino;
        destino.populacao++;
      });
    },
  },
  // -------------------------------------------------------------- destruição
  {
    id: 'raio', nome: 'Relâmpago', icone: '⚡', categoria: 'destruicao', raio: 2, continuo: false,
    descricao: 'Um golpe seco: mata no ponto e acende o que for inflamável.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id, forca) => {
        mundo.criaturas.vida[id] -= 120 * forca;
        if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'jogador');
      });
      porTile(mundo, x, y, raio, (i) => atear(mundo, i));
    },
  },
  {
    id: 'fogo', nome: 'Fogo', icone: '🔥', categoria: 'destruicao', raio: 2, continuo: true,
    descricao: 'Acende. O resto se espalha sozinho — e não pergunta de quem é a floresta.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => atear(mundo, i));
    },
  },
  {
    id: 'meteoro', nome: 'Meteoro', icone: '☄', categoria: 'destruicao', raio: 9, continuo: false,
    descricao: 'Abre uma cratera, mata tudo em volta e ateia fogo na borda.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, g.alt[i] - 45 * forca);
        g.vegetacao[i] = 0;
        if (forca > 0.3) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        refazerBioma(mundo, i);
        if (forca < 0.55 && forca > 0.15) atear(mundo, i);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        mundo.criaturas.vida[id] -= 400 * forca;
        if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'desastre');
      });
    },
  },
  {
    id: 'bomba', nome: 'Extinguir', icone: '☠', categoria: 'destruicao', raio: 8, continuo: true,
    descricao: 'Apaga toda a vida da área, sem tocar no terreno.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id) => mundo.matar(id, 'jogador'));
    },
  },
  {
    id: 'praga', nome: 'Praga', icone: '☣', categoria: 'destruicao', raio: 4, continuo: false,
    descricao: 'Infecta quem estiver perto. A doença passa de um para outro e quem morre dela pode levantar como zumbi.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id) => {
        mundo.criaturas.marcas[id] |= MARCA_DOENTE;
      });
    },
  },
  {
    id: 'terremoto', nome: 'Terremoto', icone: '≋', categoria: 'destruicao', raio: 14, continuo: false,
    descricao: 'Sacode o chão: derruba construções e racha o terreno.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        if (mundo.rng.chance(forca * 0.5)) {
          g.alt[i] = Math.max(0, Math.min(255, g.alt[i] + mundo.rng.intEntre(-22, 12)));
          refazerBioma(mundo, i);
        }
        if (mundo.rng.chance(forca * 0.7)) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        if (mundo.rng.chance(forca * 0.35)) {
          mundo.criaturas.vida[id] -= 60;
          if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'desastre');
        }
      });
    },
  },
  {
    id: 'tsunami', nome: 'Maremoto', icone: '〰', categoria: 'destruicao', raio: 16, continuo: false,
    descricao: 'A agua avanca e engole a costa. O que era terra some do mapa.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, g.alt[i] - 60 * forca);
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        if (g.alt[i] < NIVEL_MAR) {
          g.limparRecurso(i);
          g.estrada[i] = 0;
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        refazerBioma(mundo, i);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        if (ESP_DOMINIO[mundo.criaturas.especie[id]] === 1) return;
        if (mundo.rng.chance(forca)) mundo.matar(id, 'afogado');
      });
    },
  },
  {
    id: 'tornado', nome: 'Tornado', icone: '↻', categoria: 'destruicao', raio: 7, continuo: false,
    descricao: 'Arranca o que encontra: arvores, telhados e quem estiver por perto.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      const c = mundo.criaturas;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        if (mundo.rng.chance(forca * 0.8)) g.limparRecurso(i);
        if (mundo.rng.chance(forca * 0.6)) {
          const alvo = ancoraDaConstrucao(mundo, i);
          if (alvo >= 0) derrubar(mundo, alvo, false);
        }
        if (g.vegetacao[i] > 0) g.vegetacao[i] = Math.max(0, g.vegetacao[i] - 120 * forca);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        const dx = c.x[id] - x;
        const dy = c.y[id] - y;
        const d = Math.hypot(dx, dy) || 1;
        c.x[id] = Math.max(0, Math.min(g.largura - 0.01, c.x[id] + (dx / d) * 9 * forca));
        c.y[id] = Math.max(0, Math.min(g.altura - 0.01, c.y[id] + (dy / d) * 9 * forca));
        c.vida[id] -= 45 * forca;
        if (c.vida[id] <= 0) mundo.matar(id, 'desastre');
      });
    },
  },
  {
    id: 'iluminar', nome: 'Iluminar', icone: '☀', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'Os reinos daqui descobrem na hora a proxima coisa que estavam para descobrir, e ganham um empurrao de conhecimento por cima.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (!r?.ativo) continue;
        const alvo = proximaDescoberta(r);
        if (alvo >= 0) aprender(mundo, r, alvo);
        // e o empurrão, para a próxima também vir sem esperar meia era
        r.conhecimento += 60;
      }
    },
  },
  {
    id: 'revoltar', nome: 'Incitar revolta', icone: '⚔', categoria: 'reino', raio: 10, continuo: false,
    descricao: 'Derruba a lealdade de quem estiver aqui. As vilas que ja estavam mal se separam do reino na hora, levando o territorio, e ja nascem em guerra com ele.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      // Primeiro a lealdade das pessoas: mesmo onde a revolta não estourar
      // agora, o descontentamento fica, e uma vila que ficou perto do limiar
      // cai sozinha na primeira crise. A mão do jogador acelera o que já
      // existia em vez de criar reino do nada.
      porCriatura(mundo, x, y, raio, (id, forca) => {
        c.fidelidade[id] = Math.max(0, c.fidelidade[id] - 70 * forca);
      });

      // As vilas com a praça dentro do círculo tentam se separar agora, sem
      // esperar a idade mínima — é isso que o poder compra.
      const alvos = mundo.aldeias.filter(
        (a) => a.ativa && Math.hypot(a.x - x, a.y - y) <= raio,
      );
      for (const a of alvos) tentarRebelar(mundo, a, true);
    },
  },
  {
    id: 'revelar', nome: 'Revelacao', icone: '👁', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'Todo reino que tenha gente ou terra aqui passa a ser conhecido pelo mundo inteiro. Tira a névoa de cima deles.',
    aplicar(mundo, x, y, raio) {
      const aqui = reinosNaArea(mundo, x, y, raio);
      if (aqui.size === 0) return;
      for (const id of aqui) {
        for (const outro of mundo.reinos) {
          if (outro.ativo) mundo.apresentarReinos(id, outro.id);
        }
      }
    },
  },
  {
    id: 'odio', nome: 'Semear odio', icone: '☹', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'Envenena a relacao dos reinos daqui com todos os que eles conhecem. Nao declara guerra: da o motivo para ela.',
    aplicar(mundo, x, y, raio) {
      const aqui = reinosNaArea(mundo, x, y, raio);
      for (const id of aqui) {
        const r = mundo.reinos[id];
        if (!r?.ativo) continue;
        for (const outro of [...r.conhecidos]) {
          if (!mundo.reinos[outro]?.ativo) continue;
          mundo.mudarRelacao(id, outro, -55);
          // Rancor e não só relação: relação volta a subir sozinha com o tempo,
          // mágoa não. É ela que faz o ódio plantado ainda estar lá daqui a
          // muitas rodadas, pesando no casus belli.
          mundo.acumularRancor(id, outro, 35);
        }
      }
    },
  },
  {
    id: 'tregua', nome: 'Tregua', icone: '☮', categoria: 'reino', raio: 14, continuo: false,
    descricao: 'Encerra toda guerra entre os reinos daqui e limpa a magoa entre eles.',
    aplicar(mundo, x, y, raio) {
      const aqui = [...reinosNaArea(mundo, x, y, raio)];
      for (let i = 0; i < aqui.length; i++) {
        for (let j = i + 1; j < aqui.length; j++) {
          mundo.fazerPaz(aqui[i], aqui[j]);
          mundo.reinos[aqui[i]]?.rancor.delete(aqui[j]);
          mundo.reinos[aqui[j]]?.rancor.delete(aqui[i]);
          mundo.mudarRelacao(aqui[i], aqui[j], 45);
        }
      }
    },
  },
  {
    id: 'presente', nome: 'Fartura', icone: '✦', categoria: 'reino', raio: 6, continuo: false,
    descricao: 'Enche os celeiros da aldeia mais proxima: comida, madeira, pedra, ferro e ouro.',
    aplicar(mundo, x, y) {
      const id = mundo.aldeiaMaisProxima(x, y, 40);
      if (id < 0) return;
      const a = mundo.aldeias[id];
      for (const m of MATERIAIS) {
        a.estoque[m] = Math.min(a.capacidadeEstoque, a.estoque[m] + a.capacidadeEstoque * 0.5);
      }
      a.moral = Math.min(100, a.moral + 15);
    },
  },
  {
    id: 'inspirar', nome: 'Inspirar', icone: '♪', categoria: 'reino', raio: 8, continuo: false,
    descricao: 'Levanta o animo das aldeias por perto e cura quem estiver ferido.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      for (const a of mundo.aldeias) {
        if (!a.ativa) continue;
        if (Math.hypot(a.x - x, a.y - y) > raio + 6) continue;
        a.moral = Math.min(100, a.moral + 30);
      }
      porCriatura(mundo, x, y, raio, (id) => {
        c.vida[id] = ESP_VIDA[c.especie[id]];
        c.fome[id] = Math.max(0, c.fome[id] - 40);
      });
    },
  },
  // ------------------------------------------------------- terreno, o resto
  {
    id: 'nivelar', nome: 'Nivelar', icone: '▬', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Aplaina o terreno na altura media da area. Bom para abrir chao onde uma vila caiba.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      let soma = 0;
      let n = 0;
      porTile(mundo, x, y, raio, (i) => { soma += g.alt[i]; n++; });
      if (n === 0) return;
      const media = soma / n;
      porTile(mundo, x, y, raio, (i) => {
        g.alt[i] = Math.round(g.alt[i] + (media - g.alt[i]) * 0.5);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'erodir', nome: 'Erodir', icone: '⌁', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Desgasta o relevo: pico vira morro, penhasco vira encosta. Nao muda a altura media.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      const viz = mundo.bufVizinhos;
      porTile(mundo, x, y, raio, (i, tx, ty) => {
        const n = g.vizinhos8(tx, ty, viz);
        if (n === 0) return;
        let soma = 0;
        for (let k = 0; k < n; k++) soma += g.alt[viz[k]];
        g.alt[i] = Math.round(g.alt[i] * 0.45 + (soma / n) * 0.55);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'ilha', nome: 'Ilha', icone: '◠', categoria: 'terreno', raio: 8, continuo: false,
    descricao: 'Levanta uma ilha em cupula, mais alta no meio e com praia na borda.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        // `forca` vai de 1 no centro a 0 na borda: é o perfil da cúpula pronto
        const alvo = NIVEL_MAR + 2 + forca * forca * 46;
        if (g.alt[i] < alvo) g.alt[i] = Math.round(alvo);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'depressao', nome: 'Depressao', icone: '◡', categoria: 'terreno', raio: 8, continuo: false,
    descricao: 'Afunda uma bacia. Se passar do nivel do mar, vira lago ou enseada.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, Math.round(g.alt[i] - forca * forca * 55));
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'umedecer', nome: 'Umedecer', icone: '☂', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Encharca o solo. Com o tempo o bioma acompanha: campo vira floresta, deserto vira savana.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.umidade[i] = Math.min(255, g.umidade[i] + 30);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'ressecar', nome: 'Ressecar', icone: '⌇', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Tira a agua do solo. Floresta vira campo, campo vira deserto.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.umidade[i] = Math.max(0, g.umidade[i] - 30);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'aquecer', nome: 'Aquecer', icone: '☼', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Esquenta a regiao. Tundra vira campo, campo vira savana, savana vira deserto.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.temp[i] = Math.min(255, g.temp[i] + 28);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'resfriar', nome: 'Resfriar', icone: '☃', categoria: 'terreno', raio: 6, continuo: true,
    descricao: 'Esfria a regiao sem congelar tudo de uma vez, como a nevasca faz.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.temp[i] = Math.max(0, g.temp[i] - 28);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'pavimentar', nome: 'Estrada', icone: '═', categoria: 'terreno', raio: 3, continuo: true,
    descricao: 'Abre estrada. Quem anda por cima chega mais rapido.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.ehAgua(i) || g.construcao[i] !== 0) return;
        g.estrada[i] = 1;
        g.limparRecurso(i);
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'despavimentar', nome: 'Tirar estrada', icone: '╌', categoria: 'terreno', raio: 4, continuo: true,
    descricao: 'Devolve a estrada ao mato.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.estrada[i] === 0) return;
        g.estrada[i] = 0;
        g.vegetacao[i] = 60;
        g.marcarSujoIdx(i);
      });
    },
  },

  // ---------------------------------------------------------------- natureza
  {
    id: 'chuva', nome: 'Chuva', icone: '☔', categoria: 'natureza', raio: 10, continuo: false,
    descricao: 'Traz uma nuvem carregada para ca. Ela vai embora com o vento, molhando o caminho.',
    aplicar(mundo, x, y, raio) {
      mundo.nuvens.push(nuvemNova(mundo, x, y, raio, 1));
    },
  },
  {
    id: 'nevasca', nome: 'Nevasca', icone: '❅', categoria: 'natureza', raio: 10, continuo: false,
    descricao: 'Uma nuvem de neve. Onde ela passa, o chao esfria e embranquece.',
    aplicar(mundo, x, y, raio) {
      mundo.nuvens.push(nuvemNova(mundo, x, y, raio, 2));
    },
  },
  {
    id: 'nublar', nome: 'Nuvem', icone: '☁', categoria: 'natureza', raio: 10, continuo: false,
    descricao: 'So a sombra passando. Nao chove, nao neva, so escurece o chao por um tempo.',
    aplicar(mundo, x, y, raio) {
      mundo.nuvens.push(nuvemNova(mundo, x, y, raio, 0));
    },
  },
  {
    id: 'dissipar', nome: 'Abrir o ceu', icone: '☀', categoria: 'natureza', raio: 24, continuo: false,
    descricao: 'Desfaz toda nuvem daqui. O sol volta na hora.',
    aplicar(mundo, x, y, raio) {
      mundo.nuvens = mundo.nuvens.filter((n) => Math.hypot(n.x - x, n.y - y) > raio);
    },
  },
  {
    id: 'virar_vento', nome: 'Virar o vento', icone: '⟳', categoria: 'natureza', raio: 0, continuo: false,
    descricao: 'Gira o vento dominante um quarto de volta. Todas as nuvens do mundo mudam de rumo.',
    aplicar(mundo) {
      const vx = mundo.ventoX;
      mundo.ventoX = -mundo.ventoY;
      mundo.ventoY = vx;
      for (const n of mundo.nuvens) {
        n.vx = mundo.ventoX;
        n.vy = mundo.ventoY;
      }
    },
  },
  {
    id: 'apagar_fogo', nome: 'Apagar', icone: '⌫', categoria: 'natureza', raio: 12, continuo: true,
    descricao: 'Apaga o incendio daqui sem tocar em mais nada.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.fogo[i] === 0) return;
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'desmatar', nome: 'Desmatar', icone: '✂', categoria: 'natureza', raio: 6, continuo: true,
    descricao: 'Arranca arvore, arbusto e veio de minerio. O chao fica limpo.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => mundo.grid.limparRecurso(i));
    },
  },
  {
    id: 'capim', nome: 'Capim', icone: '⁂', categoria: 'natureza', raio: 6, continuo: true,
    descricao: 'Enche o chao de mato. E o que os herbivoros comem.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.ehAgua(i)) return;
        g.vegetacao[i] = 255;
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'estiagem', nome: 'Estiagem', icone: '⌁', categoria: 'natureza', raio: 10, continuo: true,
    descricao: 'Seca o mato e o solo. Os rebanhos que viviam disso somem atras de comida.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        g.vegetacao[i] = 0;
        g.umidade[i] = Math.max(0, g.umidade[i] - 40);
        g.marcarSujoIdx(i);
      });
    },
  },
  {
    id: 'cardume', nome: 'Cardume', icone: '⚲', categoria: 'natureza', raio: 6, continuo: false,
    descricao: 'Solta peixe na agua daqui. Alimenta pesqueiro e predador do mar.',
    aplicar(mundo, x, y, raio) {
      soltarBicho(mundo, x, y, raio, 'peixe', 10);
    },
  },
  {
    id: 'revoada', nome: 'Revoada', icone: '⩗', categoria: 'natureza', raio: 6, continuo: false,
    descricao: 'Solta um bando de passaros.',
    aplicar(mundo, x, y, raio) {
      soltarBicho(mundo, x, y, raio, 'passaro', 8);
    },
  },
  {
    id: 'matilha', nome: 'Matilha', icone: '⩙', categoria: 'natureza', raio: 5, continuo: false,
    descricao: 'Solta lobos. Eles vao cacar o que houver por perto.',
    aplicar(mundo, x, y, raio) {
      soltarBicho(mundo, x, y, raio, 'lobo', 5);
    },
  },
  {
    id: 'rebanho', nome: 'Rebanho', icone: '⏣', categoria: 'natureza', raio: 6, continuo: false,
    descricao: 'Solta ovelhas e veados. Comida em pe para quem cacar.',
    aplicar(mundo, x, y, raio) {
      soltarBicho(mundo, x, y, raio, 'ovelha', 6);
      soltarBicho(mundo, x, y, raio, 'veado', 4);
    },
  },

  // -------------------------------------------------------------- vida, o resto
  {
    id: 'envelhecer', nome: 'Envelhecer', icone: '⏳', categoria: 'vida', raio: 6, continuo: false,
    descricao: 'Passam-se anos na pele de quem esta aqui. Quem estava velho morre.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.idade[id] += c.longevidade[id] * 0.35;
      });
    },
  },
  {
    id: 'rejuvenescer', nome: 'Rejuvenescer', icone: '⏲', categoria: 'vida', raio: 6, continuo: false,
    descricao: 'Devolve a juventude. Um velho volta a ter filhos e a trabalhar.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.idade[id] = Math.max(0, c.idade[id] - c.longevidade[id] * 0.45);
      });
    },
  },
  {
    id: 'saciar', nome: 'Saciar', icone: '✻', categoria: 'vida', raio: 8, continuo: true,
    descricao: 'Mata a fome de quem esta aqui, sem curar ferimento.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => { c.fome[id] = 0; });
    },
  },
  {
    id: 'esfomear', nome: 'Esfomear', icone: '☓', categoria: 'vida', raio: 8, continuo: true,
    descricao: 'Deixa todo mundo daqui a beira da fome. O que eles fizerem a seguir e com voce.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => { c.fome[id] = 99; });
    },
  },
  {
    id: 'enfurecer', nome: 'Enfurecer', icone: '⚔', categoria: 'vida', raio: 7, continuo: false,
    descricao: 'Quem estiver aqui parte para cima do vizinho mais proximo, seja ele quem for.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const perto: number[] = [];
      porCriatura(mundo, x, y, raio, (id) => perto.push(id));
      for (const id of perto) {
        let alvo = -1;
        let melhor = Infinity;
        for (const outro of perto) {
          if (outro === id) continue;
          const d = (c.x[outro] - c.x[id]) ** 2 + (c.y[outro] - c.y[id]) ** 2;
          if (d < melhor) { melhor = d; alvo = outro; }
        }
        if (alvo < 0) continue;
        c.alvo[id] = alvo;
        c.estado[id] = Estado.Atacando;
      }
    },
  },
  {
    id: 'acalmar', nome: 'Acalmar', icone: '☮', categoria: 'vida', raio: 10, continuo: false,
    descricao: 'Todo mundo daqui larga o que estava perseguindo e volta a vagar.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.alvo[id] = -1;
        c.destinoX[id] = -1;
        c.estado[id] = Estado.Vagando;
        c.marcas[id] &= ~MARCA_SOLDADO;
      });
    },
  },
  {
    id: 'fecundar', nome: 'Fecundar', icone: '♁', categoria: 'vida', raio: 7, continuo: false,
    descricao: 'Zera a espera de filho de todo mundo daqui. A proxima geracao vem de uma vez.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => { c.esperaFilho[id] = 0; });
    },
  },
  {
    id: 'estancar', nome: 'Estancar', icone: '⊘', categoria: 'vida', raio: 7, continuo: false,
    descricao: 'Ninguem daqui tem filho tao cedo. E o freio de uma populacao que fugiu do controle.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => { c.esperaFilho[id] = 1e6; });
    },
  },
  {
    id: 'espantar', nome: 'Espantar', icone: '⤢', categoria: 'vida', raio: 10, continuo: false,
    descricao: 'Todo mundo daqui sai correndo para longe do ponto onde voce clicou.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      const g = mundo.grid;
      porCriatura(mundo, x, y, raio, (id) => {
        const dx = c.x[id] - x;
        const dy = c.y[id] - y;
        const d = Math.hypot(dx, dy) || 1;
        c.destinoX[id] = g.prenderX(Math.round(c.x[id] + (dx / d) * 26));
        c.destinoY[id] = g.prenderY(Math.round(c.y[id] + (dy / d) * 26));
        c.estado[id] = Estado.Fugindo;
        c.alvo[id] = -1;
      });
    },
  },

  // ------------------------------------------------------------ obras, o resto
  {
    id: 'demolir', nome: 'Demolir', icone: '⌧', categoria: 'construcao', raio: 5, continuo: true,
    descricao: 'Derruba construcao sem tocar em arvore, pedra nem no chao.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        const alvo = ancoraDaConstrucao(mundo, i);
        if (alvo >= 0) derrubar(mundo, alvo, false);
      });
    },
  },
  {
    id: 'arruinar', nome: 'Arruinar', icone: '⚱', categoria: 'construcao', raio: 5, continuo: true,
    descricao: 'Transforma o que esta de pe em escombro. A ruina desmorona sozinha com o tempo.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => {
        const alvo = ancoraDaConstrucao(mundo, i);
        if (alvo >= 0) derrubar(mundo, alvo, true);
      });
    },
  },

  // ------------------------------------------------------- destruicao, o resto
  {
    id: 'chuva_de_meteoros', nome: 'Chuva de meteoros', icone: '⁂', categoria: 'destruicao', raio: 22, continuo: false,
    descricao: 'Sete meteoros de uma vez, espalhados pela area. Nao sobra muito.',
    aplicar(mundo, x, y, raio) {
      for (let k = 0; k < 7; k++) {
        const ang = mundo.rng.f() * Math.PI * 2;
        const d = mundo.rng.f() * raio;
        meteoroEm(mundo, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 7);
      }
    },
  },
  {
    id: 'abismo', nome: 'Abismo', icone: '⧗', categoria: 'destruicao', raio: 7, continuo: false,
    descricao: 'Rasga o chao ate o fundo. O mar entra, e o que estava em cima nao volta.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porCriatura(mundo, x, y, raio, (id) => mundo.matar(id, 'desastre'));
      porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
        g.alt[i] = Math.max(0, Math.round(g.alt[i] - 120 * forca));
        g.limparRecurso(i);
        g.estrada[i] = 0;
        const alvo = ancoraDaConstrucao(mundo, i);
        if (alvo >= 0) derrubar(mundo, alvo, false);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'era_do_gelo', nome: 'Era do gelo', icone: '❆', categoria: 'destruicao', raio: 20, continuo: false,
    descricao: 'Congela tudo: o chao, a agua e quem estiver do lado de fora.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      const c = mundo.criaturas;
      porTile(mundo, x, y, raio, (i) => {
        g.temp[i] = Math.max(0, g.temp[i] - 110);
        g.vegetacao[i] = 0;
        g.fogo[i] = 0;
        mundo.chamas.delete(i);
        g.limparRecurso(i);
        refazerBioma(mundo, i);
      });
      porCriatura(mundo, x, y, raio, (id, forca) => {
        if (c.abrigo[id] >= 0) return; // quem estava dentro de casa escapa
        c.vida[id] -= 70 * forca;
        if (c.vida[id] <= 0) mundo.matar(id, 'desastre');
      });
    },
  },
  {
    id: 'desertificar', nome: 'Desertificar', icone: '⌛', categoria: 'destruicao', raio: 16, continuo: false,
    descricao: 'A terra racha e vira areia. Nada nasce ali por muito tempo.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i) => {
        if (g.ehAgua(i)) return;
        g.umidade[i] = 12;
        g.temp[i] = Math.min(255, g.temp[i] + 40);
        g.vegetacao[i] = 0;
        g.limparRecurso(i);
        refazerBioma(mundo, i);
      });
    },
  },
  {
    id: 'queimada', nome: 'Queimada', icone: '♨', categoria: 'destruicao', raio: 14, continuo: false,
    descricao: 'Acende a area inteira de uma vez, em vez de um foco que se espalha.',
    aplicar(mundo, x, y, raio) {
      porTile(mundo, x, y, raio, (i) => atear(mundo, i));
    },
  },
  {
    id: 'pestilencia', nome: 'Pestilencia', icone: '☣', categoria: 'destruicao', raio: 14, continuo: false,
    descricao: 'Doenca e fome juntas. Uma vila raramente sai inteira disso.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      porCriatura(mundo, x, y, raio, (id) => {
        c.marcas[id] |= MARCA_DOENTE;
        c.fome[id] = Math.max(c.fome[id], 85);
      });
    },
  },
  {
    id: 'dizimar', nome: 'Dizimar', icone: '☠', categoria: 'destruicao', raio: 12, continuo: false,
    descricao: 'Metade dos que estao aqui cai, sorteada. A outra metade vive para contar.',
    aplicar(mundo, x, y, raio) {
      porCriatura(mundo, x, y, raio, (id) => {
        if (mundo.rng.chance(0.5)) mundo.matar(id, 'jogador');
      });
    },
  },
  {
    id: 'fome_geral', nome: 'Esvaziar celeiros', icone: '⊖', categoria: 'destruicao', raio: 20, continuo: false,
    descricao: 'Some com a comida guardada das vilas daqui. Elas tem alguns dias antes do pior.',
    aplicar(mundo, x, y, raio) {
      for (const a of mundo.aldeias) {
        if (!a.ativa || Math.hypot(a.x - x, a.y - y) > raio) continue;
        a.estoque.comida = 0;
        a.moral = Math.max(0, a.moral - 25);
      }
    },
  },
  {
    id: 'arrasar', nome: 'Arrasar vila', icone: '⌦', categoria: 'destruicao', raio: 8, continuo: false,
    descricao: 'A vila daqui deixa de existir. O que sobrar dela vira ruina no mapa.',
    aplicar(mundo, x, y, raio) {
      const alvos = mundo.aldeias.filter(
        (a) => a.ativa && Math.hypot(a.x - x, a.y - y) <= raio,
      );
      for (const a of alvos) mundo.destruirAldeia(a.id, true);
    },
  },
  {
    id: 'apagar_reino', nome: 'Apagar reino', icone: '⚑', categoria: 'destruicao', raio: 10, continuo: false,
    descricao: 'Todo reino com gente ou terra aqui e riscado do mapa, com todas as vilas dele.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (!r?.ativo) continue;
        for (const vila of [...r.aldeias]) mundo.destruirAldeia(vila, true);
      }
    },
  },
  {
    id: 'maldicao', nome: 'Maldicao', icone: '☾', categoria: 'destruicao', raio: 14, continuo: false,
    descricao: 'Derruba pela metade o animo das vilas e a lealdade de quem mora nelas.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      for (const a of mundo.aldeias) {
        if (!a.ativa || Math.hypot(a.x - x, a.y - y) > raio) continue;
        a.moral = Math.max(0, a.moral * 0.5);
      }
      porCriatura(mundo, x, y, raio, (id) => {
        c.fidelidade[id] = Math.max(0, c.fidelidade[id] * 0.5);
      });
    },
  },

  // ----------------------------------------------------------- reino, o resto
  {
    id: 'enriquecer', nome: 'Encher o cofre', icone: '⛁', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'Enche o tesouro dos reinos daqui. Rei rico compra exercito e paga obra.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (r?.ativo) r.tesouro += 2000;
      }
    },
  },
  {
    id: 'confiscar', nome: 'Confiscar', icone: '⛃', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'Zera o tesouro dos reinos daqui e o ouro no bolso de quem mora aqui.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (r?.ativo) r.tesouro = 0;
      }
      porCriatura(mundo, x, y, raio, (id) => { c.riqueza[id] = 0; });
    },
  },
  {
    id: 'coroar', nome: 'Coroar', icone: '♛', categoria: 'reino', raio: 5, continuo: false,
    descricao: 'O mais rico daqui vira rei do proprio reino, e a familia dele vira a casa real.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      let escolhido = -1;
      let riqueza = -1;
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_CIVILIZADO[c.especie[id]] === 0 || c.reino[id] < 0) return;
        if (c.riqueza[id] > riqueza) { riqueza = c.riqueza[id]; escolhido = id; }
      });
      if (escolhido < 0) return;
      const r = mundo.reinos[c.reino[escolhido]];
      if (!r?.ativo) return;
      if (c.familia[escolhido] < 0) c.familia[escolhido] = mundo.novaFamilia();
      r.rei = escolhido;
      r.reiGer = c.geracao[escolhido];
      r.casaReal = c.familia[escolhido];
      mundo.eventos.emitir('reino:coroou', {
        reino: r.id, quem: escolhido, casa: r.casaReal, antes: -1,
      });
    },
  },
  {
    id: 'desanimar', nome: 'Desanimar', icone: '☹', categoria: 'reino', raio: 12, continuo: false,
    descricao: 'O animo das vilas daqui vai ao chao. Vila desanimada produz menos e cresce menos.',
    aplicar(mundo, x, y, raio) {
      for (const a of mundo.aldeias) {
        if (!a.ativa || Math.hypot(a.x - x, a.y - y) > raio) continue;
        a.moral = Math.max(0, a.moral - 45);
      }
    },
  },
  {
    id: 'expandir', nome: 'Expandir fronteira', icone: '⇱', categoria: 'reino', raio: 14, continuo: false,
    descricao: 'A vila daqui toma de uma vez todo o chao livre em volta, ate o limite do nivel dela.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      const id = mundo.aldeiaMaisProxima(x, y, raio + 10);
      if (id < 0) return;
      const a = mundo.aldeias[id];
      porTile(mundo, x, y, raio, (i, tx, ty) => {
        if (g.ehAgua(i) || g.aldeiaDona[i] === a.id) return;
        if (g.aldeiaDona[i] >= 0) return; // chao de outra vila nao se toma assim
        if (a.tilesTerritorio >= a.limiteTerritorio) return;
        g.aldeiaDona[i] = a.id;
        g.territorio[i] = a.reino;
        a.tilesTerritorio++;
        g.marcarSujo(tx, ty);
      });
      a.franja.length = 0;
    },
  },
  {
    id: 'retrair', nome: 'Retrair fronteira', icone: '⇲', categoria: 'reino', raio: 14, continuo: false,
    descricao: 'Devolve o chao daqui a ninguem. As construcoes ficam de pe, sem territorio em volta.',
    aplicar(mundo, x, y, raio) {
      const g = mundo.grid;
      porTile(mundo, x, y, raio, (i, tx, ty) => {
        const dono = g.aldeiaDona[i];
        if (dono < 0 || g.construcao[i] !== 0) return;
        const a = mundo.aldeias[dono];
        if (a?.ativa) a.tilesTerritorio = Math.max(0, a.tilesTerritorio - 1);
        g.aldeiaDona[i] = -1;
        g.territorio[i] = -1;
        g.marcarSujo(tx, ty);
      });
    },
  },
  {
    id: 'novo_cla', nome: 'Fundar cla', icone: '⚭', categoria: 'reino', raio: 6, continuo: false,
    descricao: 'Quem esta aqui passa a ser de um cla novo, com valores proprios. E a semente de uma revolta.',
    aplicar(mundo, x, y, raio) {
      const c = mundo.criaturas;
      let cla = -1;
      porCriatura(mundo, x, y, raio, (id) => {
        if (ESP_CIVILIZADO[c.especie[id]] === 0) return;
        if (cla < 0) cla = mundo.criarCla(c.especie[id]).id;
        c.cla[id] = cla;
      });
      void nomeDeCla;
    },
  },
  {
    id: 'unir', nome: 'Unir', icone: '⚯', categoria: 'reino', raio: 16, continuo: false,
    descricao: 'Os reinos daqui fazem as pazes e se aliam, dois a dois.',
    aplicar(mundo, x, y, raio) {
      const aqui = [...reinosNaArea(mundo, x, y, raio)];
      for (let i = 0; i < aqui.length; i++) {
        for (let j = i + 1; j < aqui.length; j++) {
          mundo.fazerPaz(aqui[i], aqui[j]);
          mundo.mudarRelacao(aqui[i], aqui[j], 100);
          mundo.firmarAlianca(aqui[i], aqui[j]);
        }
      }
    },
  },
  {
    id: 'separar', nome: 'Romper aliancas', icone: '⚡', categoria: 'reino', raio: 16, continuo: false,
    descricao: 'Desfaz toda alianca dos reinos daqui, com quem quer que seja.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (!r?.ativo) continue;
        for (const amigo of [...r.aliancas]) mundo.romperAlianca(id, amigo);
      }
    },
  },
  {
    id: 'guerra_geral', nome: 'Guerra de todos', icone: '⚒', categoria: 'reino', raio: 16, continuo: false,
    descricao: 'Todo reino daqui declara guerra a todo outro reino daqui.',
    aplicar(mundo, x, y, raio) {
      const aqui = [...reinosNaArea(mundo, x, y, raio)];
      for (let i = 0; i < aqui.length; i++) {
        for (let j = i + 1; j < aqui.length; j++) {
          mundo.declararGuerra(aqui[i], aqui[j], 'vontade de um deus');
        }
      }
    },
  },
  {
    id: 'povoar_vila', nome: 'Povoar', icone: '⚏', categoria: 'reino', raio: 8, continuo: false,
    descricao: 'Chega gente de fora para a vila daqui, ate onde ela tiver lugar.',
    aplicar(mundo, x, y, raio) {
      const id = mundo.aldeiaMaisProxima(x, y, raio + 8);
      if (id < 0) return;
      const a = mundo.aldeias[id];
      const def = especies.porIndice(a.especie);
      for (let k = 0; k < 12 && a.populacao < a.capacidade; k++) {
        const c = mundo.nascer(
          a.especie,
          a.x + mundo.rng.entre(-3, 3),
          a.y + mundo.rng.entre(-3, 3),
          def.longevidade[0] * 0.2,
          'imigracao',
        );
        if (c < 0) break;
        mundo.criaturas.aldeia[c] = a.id;
        mundo.criaturas.reino[c] = a.reino;
        mundo.criaturas.familia[c] = mundo.novaFamilia();
        a.populacao++;
      }
      empossarChefes(mundo, a);
    },
  },

  // ----------------------------------------------------------- saber, o resto
  {
    id: 'esquecer', nome: 'Esquecer', icone: '⊗', categoria: 'saber', raio: 12, continuo: false,
    descricao: 'Os reinos daqui perdem a descoberta mais recente que fizeram, e o que dependia dela.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (!r?.ativo) continue;
        // a mais cara que ele sabe é a última que ele conseguiu pagar
        let alvo = -1;
        let maior = -1;
        for (const t of r.tecnologias) {
          if (TEC_CUSTO[t] > maior) { maior = TEC_CUSTO[t]; alvo = t; }
        }
        if (alvo < 0 || maior <= 0) continue;
        r.tecnologias.delete(alvo);
        // e o que exigia aquilo cai junto, senão sobra buraco na árvore
        for (const t of [...r.tecnologias]) {
          if (TEC_REQUER[t].includes(alvo)) r.tecnologias.delete(t);
        }
        let era = 0;
        for (const t of r.tecnologias) era = Math.max(era, TEC_ERA[t]);
        r.era = era;
      }
    },
  },
  {
    id: 'sabedoria', nome: 'Sabedoria', icone: '❃', categoria: 'saber', raio: 12, continuo: false,
    descricao: 'Um empurrao de conhecimento aos reinos daqui, sem entregar nada de graca.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (r?.ativo) r.conhecimento += 120;
      }
    },
  },
  {
    id: 'ignorancia', nome: 'Ignorancia', icone: '⊙', categoria: 'saber', raio: 12, continuo: false,
    descricao: 'Zera o conhecimento acumulado dos reinos daqui. O que ja foi descoberto fica.',
    aplicar(mundo, x, y, raio) {
      for (const id of reinosNaArea(mundo, x, y, raio)) {
        const r = mundo.reinos[id];
        if (r?.ativo) r.conhecimento = 0;
      }
    },
  },

]);

/**
 * Uma nuvem posta pela mão do jogador, no ponto em que ele clicou.
 *
 * Nasce com `forca` cheia, e não em zero como as que entram pela borda do mapa:
 * quando o jogador pede chuva, ele quer chuva agora, e não uma nuvem que
 * aparece daqui a um minuto. O resto — rumo, vida, tamanho — é igual ao das
 * outras, para ela se comportar como parte do clima e não como um efeito à
 * parte.
 */
function nuvemNova(mundo: Mundo, x: number, y: number, raio: number, tipo: number): Nuvem {
  const velocidade = Math.max(0.001, Math.hypot(mundo.ventoX, mundo.ventoY));
  const travessia = Math.hypot(mundo.grid.largura, mundo.grid.altura) + 40;
  return {
    x,
    y,
    raio: Math.max(4, raio),
    vx: mundo.ventoX,
    vy: mundo.ventoY,
    tipo,
    forca: 1,
    idade: 0,
    vida: (travessia / velocidade) * mundo.rng.entre(1.05, 1.5),
  };
}

/** Solta um punhado de bichos de uma espécie na área, onde o chão servir. */
function soltarBicho(
  mundo: Mundo,
  x: number,
  y: number,
  raio: number,
  id: string,
  quantos: number,
): void {
  const def = especies.talvez(id);
  if (!def) return;
  const idx = especies.indice(id);
  const g = mundo.grid;
  const naAgua = def.dominio === 'agua';
  for (let k = 0; k < quantos; k++) {
    const px = x + mundo.rng.entre(-raio, raio);
    const py = y + mundo.rng.entre(-raio, raio);
    const tx = px | 0;
    const ty = py | 0;
    if (!g.dentro(tx, ty)) continue;
    // peixe no mar, bicho de terra em terra; o resto o mundo resolve
    if (g.ehAgua(g.idx(tx, ty)) !== naAgua && def.dominio !== 'ar') continue;
    mundo.nascer(idx, px, py, def.longevidade[0] * 0.25);
  }
}

/** O estrago de um meteoro num ponto. Usado pelo meteoro e pela chuva deles. */
function meteoroEm(mundo: Mundo, x: number, y: number, raio: number): void {
  const g = mundo.grid;
  porTile(mundo, x, y, raio, (i, _tx, _ty, forca) => {
    g.alt[i] = Math.max(0, g.alt[i] - 45 * forca);
    g.vegetacao[i] = 0;
    if (forca > 0.3) {
      const alvo = ancoraDaConstrucao(mundo, i);
      if (alvo >= 0) derrubar(mundo, alvo, false);
    }
    refazerBioma(mundo, i);
    if (forca < 0.55 && forca > 0.15) atear(mundo, i);
  });
  porCriatura(mundo, x, y, raio, (id, forca) => {
    mundo.criaturas.vida[id] -= 400 * forca;
    if (mundo.criaturas.vida[id] <= 0) mundo.matar(id, 'desastre');
  });
}

// As famílias que saem prontas dos registros — pincel de bioma, plantio, obra,
// dom e revelação. Vêm depois das ferramentas escritas à mão porque a ordem de
// registro é a ordem dos botões na aba.
registrarDerivados();
