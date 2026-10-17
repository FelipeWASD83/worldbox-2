import type { Mundo } from '../core/mundo.js';
import type { Sistema } from '../core/sistemas.js';
import { sistemaVida } from './vida.js';
import { sistemaIA } from './ia.js';
import { sistemaMovimento } from './movimento.js';
import { sistemaCombate } from './combate.js';
import { sistemaReproducao } from './reproducao.js';
import { sistemaEcologia } from './ecologia.js';
import { sistemaMoradores, sistemaAldeias, sistemaCerco } from './civilizacao.js';
import { sistemaDiplomacia } from './diplomacia.js';
import { sistemaPraga } from './praga.js';
import { sistemaMigracao } from './migracao.js';
import { sistemaColeta } from './coleta.js';
import { sistemaEquipar } from './equipar.js';
import { sistemaEconomia } from './economia.js';
import { sistemaMoradia } from './moradia.js';
import { sistemaVulcoes } from './vulcoes.js';
import { sistemaClima } from './clima.js';
import { sistemaBarcos } from './barcos.js';
import { sistemaPolitica } from './politica.js';
import { sistemaContato } from './contato.js';
import { sistemaCultura } from './cultura.js';
import { sistemaConhecimento } from './conhecimento.js';
import { sistemaEstacoes } from './estacoes.js';
import { sistemaProfissoes } from './profissoes.js';

/**
 * Reconstrói o índice espacial. Precisa ser o primeiro sistema do tick: todos
 * os outros perguntam "quem está perto" e a resposta tem que valer para as
 * posições de agora.
 */
const sistemaEspacial: Sistema = {
  id: 'espacial',
  executar(mundo: Mundo): void {
    mundo.espacial.reconstruir(mundo.criaturas);
  },
};

/** Recalcula os números do painel. Não afeta a simulação. */
const sistemaEstatisticas: Sistema = {
  id: 'estatisticas',
  intervalo: 30,
  executar(mundo: Mundo): void {
    mundo.recalcularEstatisticas();
  },
};

/**
 * A ordem em que os sistemas rodam a cada tick.
 *
 * Mecânica nova entra como mais uma linha aqui. A regra de ouro é: quem lê
 * posição vem depois do índice espacial; quem mata vem depois de quem decide.
 */
export function montarPipeline(mundo: Mundo): void {
  mundo.pipeline.adicionar(
    sistemaEspacial,
    sistemaVida,
    sistemaPraga,
    sistemaIA,
    sistemaMovimento,
    sistemaCombate,
    sistemaReproducao,
    sistemaMoradia,
    sistemaEstacoes,
    sistemaEcologia,
    sistemaVulcoes,
    sistemaClima,
    sistemaBarcos,
    sistemaColeta,
    sistemaMoradores,
    sistemaAldeias,
    sistemaProfissoes,
    sistemaPolitica,
    sistemaCultura,
    sistemaConhecimento,
    sistemaEquipar,
    sistemaCerco,
    sistemaEconomia,
    sistemaContato,
    sistemaDiplomacia,
    sistemaEstatisticas,
    sistemaMigracao,
  );
}
