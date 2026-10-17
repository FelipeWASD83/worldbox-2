/**
 * O grupo "Atualização" da aba de ajustes.
 *
 * Mostra a versão do jogo, procura a mais nova no GitHub, mostra o que mudou e,
 * na cópia instalada pelo atalho, baixa, confere e reabre o jogo na versão
 * nova. Quem faz o trabalho é o processo do Electron (`electron/atualizador.js`);
 * aqui só se conversa com ele pela ponte do `preload.cjs`.
 *
 * Fora do aplicativo (o `npm run web`, de depuração) não há ponte, e o grupo
 * diz isso em vez de oferecer botão que não funciona.
 */

interface EstadoAtualizacao {
  versao: string;
  instalado: boolean;
  repositorio: string;
  revertida: { de: string; motivo: string } | null;
  acabouDeAtualizar: string | null;
}

interface RespostaChecagem {
  ok: boolean;
  erro?: string;
  atual?: string;
  ultima?: string;
  nova?: boolean;
  notas?: string;
  temPacote?: boolean;
}

export interface PonteAtualizacao {
  estado(): Promise<EstadoAtualizacao>;
  checar(): Promise<RespostaChecagem>;
  baixar(): Promise<{ ok: boolean; erro?: string; versao?: string }>;
  reabrir(): Promise<void>;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export function montarAtualizacao(ponte: PonteAtualizacao | undefined): void {
  const versao = $('att-versao');
  const status = $('att-status');
  const notas = $('att-notas');
  const btnProcurar = $<HTMLButtonElement>('btn-att-procurar');
  const btnAtualizar = $<HTMLButtonElement>('btn-att-atualizar');

  if (!ponte) {
    versao.textContent = 'só no aplicativo';
    btnProcurar.hidden = true;
    btnAtualizar.hidden = true;
    return;
  }

  let instalado = false;
  void ponte.estado().then((e) => {
    instalado = e.instalado;
    versao.textContent = `versão ${e.versao}`;
    if (e.revertida) {
      status.textContent = `A versão ${e.revertida.de} não abriu e o jogo voltou para a ${e.versao}.`;
      status.dataset.tom = 'ruim';
    } else if (e.acabouDeAtualizar) {
      status.textContent = `Atualizado para a ${e.acabouDeAtualizar}.`;
      status.dataset.tom = 'bom';
    } else if (!e.instalado) {
      status.textContent = 'Pasta do projeto: atualize com git pull.';
    }
  });

  btnProcurar.addEventListener('click', async () => {
    btnProcurar.disabled = true;
    btnAtualizar.hidden = true;
    notas.hidden = true;
    status.textContent = 'Procurando…';
    delete status.dataset.tom;
    const r = await ponte.checar();
    btnProcurar.disabled = false;
    if (!r.ok) {
      status.textContent = r.erro ?? 'Não deu para procurar.';
      status.dataset.tom = 'ruim';
      return;
    }
    if (!r.nova) {
      status.textContent = `Você está na mais nova (${r.atual}).`;
      status.dataset.tom = 'bom';
      return;
    }
    status.textContent = `Tem a ${r.ultima} (você está na ${r.atual}).`;
    status.dataset.tom = 'novo';
    if (r.notas) {
      notas.textContent = r.notas.trim();
      notas.hidden = false;
    }
    if (!instalado) {
      status.textContent += ' Na pasta do projeto, atualize com git pull.';
    } else if (r.temPacote) {
      btnAtualizar.hidden = false;
      btnAtualizar.textContent = `Atualizar para a ${r.ultima}`;
    } else {
      status.textContent += ' A release ainda não tem o pacote do jogo.';
    }
  });

  // Depois de baixar, o mesmo botão vira "Reabrir agora": o mundo aberto não é
  // salvo sozinho, então quem decide a hora de reabrir é o jogador.
  let pronta = false;
  btnAtualizar.addEventListener('click', async () => {
    if (pronta) {
      void ponte.reabrir();
      return;
    }
    btnAtualizar.disabled = true;
    btnProcurar.disabled = true;
    status.textContent = 'Baixando e conferindo…';
    delete status.dataset.tom;
    const r = await ponte.baixar();
    btnAtualizar.disabled = false;
    if (!r.ok) {
      status.textContent = r.erro ?? 'Não deu para atualizar.';
      status.dataset.tom = 'ruim';
      btnProcurar.disabled = false;
      return;
    }
    pronta = true;
    status.textContent = `A ${r.versao} está pronta. Salve o mundo, se quiser, e reabra.`;
    status.dataset.tom = 'bom';
    btnAtualizar.textContent = 'Reabrir agora';
  });
}
