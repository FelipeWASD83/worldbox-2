import { Jogo, sementeAleatoria } from './core/jogo.js';
import { TAMANHOS } from './core/mundo.js';
import { poderes } from './sim/poderes.js';
import { especies } from './dados/especies.js';
import { Cronica } from './ui/cronica.js';
import { Inspetor } from './ui/inspetor.js';
import { PainelEstatisticas } from './ui/estatisticas.js';
import { PainelComando } from './ui/comando.js';
import {
  apagarSave, gravarSave, lerSave, listarSaves, ondeFicamOsSaves, rodandoNoApp,
} from './ui/armazenamento.js';

/**
 * Cola entre o jogo e a interface: monta os painéis, escuta mouse e teclado e
 * mantém os números do topo atualizados.
 */

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não existe no HTML.`);
  return el as T;
};

/**
 * Se o jogo quebrar, é melhor dizer o que houve do que congelar a janela.
 * No aplicativo isso abre a caixa de erro do sistema; no navegador, o console.
 */
/**
 * Preenchido logo abaixo, quando o jogo existir. A captura de erro é ligada
 * antes de tudo — inclusive antes de o jogo ser criado — justamente para pegar
 * falha na própria criação do mundo.
 */
let pararSimulacao: (() => void) | null = null;

function ligarCapturaDeErro(): void {
  let jaAvisou = false;
  const avisar = (o: unknown) => {
    if (jaAvisou) return;
    jaAvisou = true;
    const texto = o instanceof Error ? `${o.message}

${o.stack ?? ''}` : String(o);
    console.error('[wb2]', texto);
    // sem isto o mesmo erro se repetiria a cada quadro
    pararSimulacao?.();
    window.wb2?.erroFatal(texto);
    const aviso = document.getElementById('aviso-carregando');
    if (aviso) {
      aviso.hidden = false;
      aviso.textContent = 'o jogo encontrou um erro — veja a mensagem e reabra';
    }
  };
  window.addEventListener('error', (e) => {
    // O navegador emite "ResizeObserver loop..." quando um cálculo de layout
    // dispara outro no mesmo quadro. É aviso de desempenho, não falha do jogo,
    // e derrubar a tela por causa dele esconde o mundo por nada.
    const texto = String(e.message ?? '');
    if (texto.includes('ResizeObserver loop')) return;
    avisar(e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => avisar(e.reason));
}

ligarCapturaDeErro();

const palco = $('palco');
const tela = $<HTMLCanvasElement>('tela');
const ctx = tela.getContext('2d', { alpha: false });
if (!ctx) throw new Error('Este sistema não conseguiu abrir um canvas 2D.');

/**
 * Parâmetros de URL, para abrir o jogo já num estado conhecido:
 * `?semente=abc&tamanho=grande&zoom=8&x=120&y=90`.
 *
 * Existe para poder conferir uma cena específica — inclusive em captura
 * automática — sem ter que reproduzir cliques até chegar nela.
 */
const params = new URLSearchParams(location.search);
const jogo = new Jogo(tela, ctx, {
  semente: params.get('semente') ?? undefined,
  tamanho: params.get('tamanho') ?? undefined,
});
pararSimulacao = () => jogo.parar();
const cronica = new Cronica($<HTMLUListElement>('log'));
const inspetor = new Inspetor($('inspetor'));
const painel = new PainelEstatisticas($('estatisticas'));
const comando = new PainelComando($('comando'), () => jogo.mundo);

const miniCanvas = $<HTMLCanvasElement>('minimapa');
const miniCtx = miniCanvas.getContext('2d')!;

// --------------------------------------------------------------- ferramentas

type Ferramenta = { tipo: 'inspecionar' } | { tipo: 'poder'; id: string };
let ferramenta: Ferramenta = { tipo: 'inspecionar' };
let raio = 4;
let especieEscolhida = especies.indice('humano');


/**
 * Põe cada poder na aba da categoria dele.
 *
 * Antes eram todos numa lista só, empilhados numa coluna lateral. Com trinta e
 * duas ferramentas aquilo virava uma parede de ícones que só cabia rolando, e a
 * coluna comia um sexto da largura do mundo o tempo inteiro. Divididos por aba,
 * cada grupo cabe numa faixa de duas fileiras.
 */
function montarFerramentas(): void {
  for (const categoria of ['terreno', 'vida', 'destruicao', 'reino'] as const) {
    const linha = $(`poderes-${categoria}`);
    linha.replaceChildren();

    // A lupa abre a aba do terreno junto das outras: é o modo de olhar sem
    // mexer, e tem de estar à mão em qualquer momento.
    if (categoria === 'terreno') {
      linha.append(botaoFerramenta('⌖', 'Inspecionar', { tipo: 'inspecionar' },
        'Clique numa criatura, aldeia ou pedaço de terreno para ver os detalhes.'));
    }
    for (const p of poderes.filtrar((x) => x.categoria === categoria)) {
      linha.append(botaoFerramenta(p.icone, p.nome, { tipo: 'poder', id: p.id }, p.descricao));
    }
  }
}

/**
 * As abas da barra de baixo.
 *
 * Uma só fica visível por vez, e clicar em algo no mapa traz a do inspetor para
 * a frente sozinha — é o que substitui o painel lateral que vivia aberto sem
 * nada dentro.
 */
function mostrarAba(nome: string): void {
  for (const secao of document.querySelectorAll<HTMLElement>('.aba')) {
    secao.hidden = secao.dataset.aba !== nome;
  }
  for (const botao of document.querySelectorAll<HTMLElement>('.aba-btn')) {
    botao.classList.toggle('ativa', botao.dataset.alvo === nome);
  }
}

for (const botao of document.querySelectorAll<HTMLElement>('.aba-btn')) {
  botao.addEventListener('click', () => mostrarAba(botao.dataset.alvo ?? 'terreno'));
}

function botaoFerramenta(
  icone: string,
  nome: string,
  qual: Ferramenta,
  descricao: string,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'poder';
  b.textContent = icone;
  b.title = nome;
  b.dataset.ferramenta = qual.tipo === 'poder' ? qual.id : 'inspecionar';
  b.addEventListener('click', () => escolherFerramenta(qual, descricao));
  if (qual.tipo === 'inspecionar') b.classList.add('ativo');
  return b;
}

function escolherFerramenta(qual: Ferramenta, descricao: string): void {
  ferramenta = qual;
  const chave = qual.tipo === 'poder' ? qual.id : 'inspecionar';
  for (const b of document.querySelectorAll<HTMLElement>('.poder')) {
    b.classList.toggle('ativo', b.dataset.ferramenta === chave);
  }
  $('descricao-poder').textContent = descricao;
  // escolher um poder de outra categoria muda a aba junto: a ferramenta ativa
  // e o grupo em que ela mora têm de bater
  if (qual.tipo === 'poder') {
    const cat = poderes.porIndice(poderes.indice(qual.id)).categoria;
    mostrarAba(cat);
  }
  const precisaEspecie = qual.tipo === 'poder' && (qual.id === 'criar' || qual.id === 'aldeia');
  $('bloco-especie').hidden = !precisaEspecie;
  if (precisaEspecie) mostrarAba('vida');
  if (precisaEspecie) montarListaEspecies(qual.id === 'aldeia');
}

function montarListaEspecies(soCivilizados: boolean): void {
  const sel = $<HTMLSelectElement>('sel-especie');
  sel.replaceChildren();
  for (const e of especies.todos()) {
    if (soCivilizados && e.categoria !== 'civilizado') continue;
    const op = document.createElement('option');
    op.value = String(especies.indice(e.id));
    op.textContent = e.nome;
    sel.append(op);
  }
  const atual = String(especieEscolhida);
  if ([...sel.options].some((o) => o.value === atual)) sel.value = atual;
  else if (sel.options.length > 0) {
    sel.selectedIndex = 0;
    especieEscolhida = Number(sel.value);
  }
}

$<HTMLSelectElement>('sel-especie').addEventListener('change', (e) => {
  especieEscolhida = Number((e.target as HTMLSelectElement).value);
});

const rngRaio = $<HTMLInputElement>('rng-raio');
rngRaio.addEventListener('input', () => {
  raio = Number(rngRaio.value);
  $('lbl-raio').textContent = String(raio);
});

// -------------------------------------------------------------------- mouse

let arrastandoCamera = false;
let ultimoMouseX = 0;
let ultimoMouseY = 0;
let aplicando = false;
let ultimaAplicacao = 0;

function dpr(): number {
  return window.devicePixelRatio || 1;
}

function mundoDoEvento(e: MouseEvent): { x: number; y: number } {
  const r = tela.getBoundingClientRect();
  const px = (e.clientX - r.left) * dpr();
  const py = (e.clientY - r.top) * dpr();
  return {
    x: jogo.renderizador.camera.telaParaMundoX(px),
    y: jogo.renderizador.camera.telaParaMundoY(py),
  };
}

tela.addEventListener('contextmenu', (e) => e.preventDefault());

tela.addEventListener('pointerdown', (e) => {
  // Prender o ponteiro é o que faz o arrasto continuar quando o cursor sai do
  // canvas. Falha quando o ponteiro já não existe — acontece com clique
  // sintético e quando o navegador cancela o gesto —, e isso não é motivo para
  // derrubar o jogo.
  try {
    tela.setPointerCapture(e.pointerId);
  } catch {
    // segue sem captura: o arrasto só não acompanha fora da tela
  }
  ultimoMouseX = e.clientX;
  ultimoMouseY = e.clientY;

  if (e.button === 2 || e.button === 1) {
    arrastandoCamera = true;
    tela.classList.add('arrastando');
    return;
  }
  if (e.button !== 0) return;

  const p = mundoDoEvento(e);
  if (ferramenta.tipo === 'inspecionar') {
    selecionarEm(p.x, p.y);
  } else {
    aplicando = true;
    aplicarPoder(p.x, p.y);
  }
});

tela.addEventListener('pointermove', (e) => {
  const p = mundoDoEvento(e);

  if (arrastandoCamera) {
    jogo.renderizador.camera.arrastar(
      (e.clientX - ultimoMouseX) * dpr(),
      (e.clientY - ultimoMouseY) * dpr(),
    );
    ultimoMouseX = e.clientX;
    ultimoMouseY = e.clientY;
    return;
  }

  jogo.renderizador.pincel =
    ferramenta.tipo === 'poder' ? { x: p.x, y: p.y, raio } : null;

  if (aplicando && ferramenta.tipo === 'poder') {
    const poder = poderes.talvez(ferramenta.id);
    if (poder?.continuo && performance.now() - ultimaAplicacao > 35) {
      aplicarPoder(p.x, p.y);
    }
  }
});

const soltar = (e: PointerEvent) => {
  if (tela.hasPointerCapture(e.pointerId)) tela.releasePointerCapture(e.pointerId);
  arrastandoCamera = false;
  aplicando = false;
  tela.classList.remove('arrastando');
};
tela.addEventListener('pointerup', soltar);
tela.addEventListener('pointercancel', soltar);
tela.addEventListener('pointerleave', () => {
  jogo.renderizador.pincel = null;
});

tela.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = tela.getBoundingClientRect();
  jogo.renderizador.camera.zoom(
    e.deltaY < 0 ? 1.18 : 1 / 1.18,
    (e.clientX - r.left) * dpr(),
    (e.clientY - r.top) * dpr(),
  );
}, { passive: false });

function aplicarPoder(x: number, y: number): void {
  if (ferramenta.tipo !== 'poder') return;
  ultimaAplicacao = performance.now();
  jogo.usarPoder(ferramenta.id, x, y, raio, especieEscolhida);
}

function abrirComando(aldeia: number): void {
  const valida = aldeia >= 0 && jogo.mundo.aldeias[aldeia]?.ativa === true;
  comando.selecionar(valida ? aldeia : -1);
  $('bloco-comando').hidden = !valida;
}

function selecionarEm(x: number, y: number): void {
  // Clicar no mapa traz a aba do inspetor para a frente. É o que substitui o
  // painel lateral que ficava aberto o tempo todo dizendo "nada selecionado":
  // ele só aparece quando há o que mostrar, e some quando se escolhe outra aba.
  mostrarAba('inspetor');
  const r = jogo.renderizador;
  const criatura = r.acharCriatura(x, y);
  if (criatura >= 0) {
    r.selecionada = criatura;
    r.aldeiaSelecionada = -1;
    inspetor.criatura = criatura;
    inspetor.aldeia = -1;
    inspetor.tile = -1;
    // clicando num morador, as ordens são as da aldeia dele
    abrirComando(jogo.mundo.criaturas.aldeia[criatura]);
    inspetor.atualizar(jogo.mundo, performance.now(), true);
    return;
  }

  const g = jogo.mundo.grid;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!g.dentro(tx, ty)) return;
  const i = g.idx(tx, ty);

  const aldeia = g.aldeiaDona[i] >= 0
    ? g.aldeiaDona[i]
    : jogo.mundo.aldeiaMaisProxima(x, y, 3);

  r.selecionada = -1;
  inspetor.criatura = -1;
  if (aldeia >= 0 && jogo.mundo.aldeias[aldeia]?.ativa) {
    r.aldeiaSelecionada = aldeia;
    inspetor.aldeia = aldeia;
    inspetor.tile = -1;
    abrirComando(aldeia);
  } else {
    r.aldeiaSelecionada = -1;
    inspetor.aldeia = -1;
    inspetor.tile = i;
    abrirComando(-1);
  }
  inspetor.atualizar(jogo.mundo, performance.now(), true);
}

// ------------------------------------------------------------------ minimapa

miniCanvas.addEventListener('pointerdown', (e) => {
  const r = miniCanvas.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width;
  const fy = (e.clientY - r.top) / r.height;
  jogo.renderizador.camera.x = fx * jogo.mundo.grid.largura;
  jogo.renderizador.camera.y = fy * jogo.mundo.grid.altura;
  jogo.renderizador.camera.prender();
});

// ------------------------------------------------------------------ teclado

const teclasMovimento = new Set<string>();

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      mudarVelocidade(jogo.velocidade === 0 ? 1 : 0);
      return;
    case '1': mudarVelocidade(1); return;
    case '2': mudarVelocidade(2); return;
    case '3': mudarVelocidade(4); return;
    case '4': mudarVelocidade(8); return;
    case 'Escape':
      jogo.renderizador.selecionada = -1;
      jogo.renderizador.aldeiaSelecionada = -1;
      inspetor.limpar();
      abrirComando(-1);
      escolherFerramenta({ tipo: 'inspecionar' }, 'Clique numa criatura, aldeia ou pedaço de terreno para ver os detalhes.');
      return;
    default:
      teclasMovimento.add(e.key.toLowerCase());
  }
});

window.addEventListener('keyup', (e) => teclasMovimento.delete(e.key.toLowerCase()));

function moverCameraPorTeclado(): void {
  const passo = 12;
  let dx = 0;
  let dy = 0;
  if (teclasMovimento.has('a') || teclasMovimento.has('arrowleft')) dx += passo;
  if (teclasMovimento.has('d') || teclasMovimento.has('arrowright')) dx -= passo;
  if (teclasMovimento.has('w') || teclasMovimento.has('arrowup')) dy += passo;
  if (teclasMovimento.has('s') || teclasMovimento.has('arrowdown')) dy -= passo;
  if (dx !== 0 || dy !== 0) jogo.renderizador.camera.arrastar(dx, dy);
}

// -------------------------------------------------------------- velocidade

function mudarVelocidade(v: number): void {
  jogo.velocidade = v;
  for (const b of document.querySelectorAll<HTMLElement>('.btn-vel')) {
    b.classList.toggle('ativo', Number(b.dataset.vel) === v);
  }
}

for (const b of document.querySelectorAll<HTMLElement>('.btn-vel')) {
  b.addEventListener('click', () => mudarVelocidade(Number(b.dataset.vel)));
}

// ------------------------------------------------------------- alternadores

$<HTMLInputElement>('chk-territorio').addEventListener('change', (e) => {
  jogo.renderizador.mostrarTerritorio = (e.target as HTMLInputElement).checked;
});
$<HTMLInputElement>('chk-nomes').addEventListener('change', (e) => {
  jogo.renderizador.mostrarNomes = (e.target as HTMLInputElement).checked;
});

// ------------------------------------------------------------ novo mundo

const dlgNovo = $<HTMLDialogElement>('dlg-novo');
const inTamanho = $<HTMLSelectElement>('in-tamanho');
for (const t of TAMANHOS) {
  const op = document.createElement('option');
  op.value = t.id;
  op.textContent = `${t.nome} — ${t.largura}×${t.altura}`;
  inTamanho.append(op);
}
inTamanho.value = 'medio';

const inTerra = $<HTMLInputElement>('in-terra');
const inAnimais = $<HTMLInputElement>('in-animais');
const inCivs = $<HTMLInputElement>('in-civs');
const inMontanhas = $<HTMLInputElement>('in-montanhas');
const inIlhas = $<HTMLInputElement>('in-ilhas');
const inClima = $<HTMLInputElement>('in-clima');
const inUmidade = $<HTMLInputElement>('in-umidade');
const inRiqueza = $<HTMLInputElement>('in-riqueza');

/** Cada controle mostra uma palavra, não um número solto. */
const faixa = (v: number, rotulos: string[], min = 0, max = 100): string =>
  rotulos[Math.min(rotulos.length - 1, Math.floor(((v - min) / (max - min)) * rotulos.length))];

const ligarControle = (
  campo: HTMLInputElement,
  saida: string,
  texto: (v: number) => string,
): void => {
  const atualizar = () => { $(saida).textContent = texto(Number(campo.value)); };
  campo.addEventListener('input', atualizar);
  atualizar();
};

ligarControle(inTerra, 'out-terra', (v) => `${v}%`);
ligarControle(inAnimais, 'out-animais', (v) =>
  v === 0 ? 'nenhum' : faixa(v, ['pouquíssimos', 'poucos', 'normal', 'muitos', 'lotado'], 1, 30));
ligarControle(inCivs, 'out-civs', (v) => (v === 0 ? 'nenhum' : String(v)));
ligarControle(inMontanhas, 'out-montanhas', (v) =>
  faixa(v, ['terreno manso', 'colinas', 'médias', 'serras', 'cordilheiras']));
ligarControle(inIlhas, 'out-ilhas', (v) =>
  faixa(v, ['um continente', 'continente recortado', 'ilhas grandes', 'arquipélago', 'mar de ilhotas']));
ligarControle(inClima, 'out-clima', (v) =>
  faixa(v, ['glacial', 'frio', 'temperado', 'quente', 'escaldante'], -100, 100));
ligarControle(inUmidade, 'out-umidade', (v) =>
  faixa(v, ['árido', 'seco', 'normal', 'chuvoso', 'encharcado']));
ligarControle(inRiqueza, 'out-riqueza', (v) =>
  faixa(v, ['terra pobre', 'escassa', 'normal', 'farta', 'abundante'], 20, 200));

$('btn-novo').addEventListener('click', () => {
  $<HTMLInputElement>('in-semente').value = '';
  dlgNovo.showModal();
});

dlgNovo.addEventListener('close', () => {
  if (dlgNovo.returnValue !== 'criar') return;
  const aviso = $('aviso-carregando');
  aviso.hidden = false;
  // deixa o navegador pintar o aviso antes de travar no gerador
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      jogo.novoMundo({
        semente: $<HTMLInputElement>('in-semente').value || sementeAleatoria(),
        tamanho: inTamanho.value,
        fracaoTerra: Number(inTerra.value) / 100,
        densidadeAnimais: Number(inAnimais.value) / 10,
        civilizacoes: Number(inCivs.value),
        montanhas: Number(inMontanhas.value) / 100,
        ilhas: Number(inIlhas.value) / 100,
        clima: Number(inClima.value) / 100,
        umidadeGlobal: Number(inUmidade.value) / 100,
        riqueza: Number(inRiqueza.value) / 100,
        migracao: $<HTMLInputElement>('in-migracao').checked,
      });
    } finally {
      aviso.hidden = true;
    }
  }));
});

// ------------------------------------------------------------------- saves

const dlgSaves = $<HTMLDialogElement>('dlg-saves');
let modoSave: 'salvar' | 'carregar' = 'salvar';
let saveEscolhido = '';

$('btn-salvar').addEventListener('click', () => abrirSaves('salvar'));
$('btn-carregar').addEventListener('click', () => abrirSaves('carregar'));

async function abrirSaves(modo: 'salvar' | 'carregar'): Promise<void> {
  modoSave = modo;
  saveEscolhido = '';
  $('titulo-saves').textContent = modo === 'salvar' ? 'Salvar mundo' : 'Carregar mundo';
  $('campo-nome-save').hidden = modo !== 'salvar';
  $<HTMLButtonElement>('btn-confirmar-save').textContent = modo === 'salvar' ? 'Salvar' : 'Carregar';
  $<HTMLButtonElement>('btn-confirmar-save').disabled = modo === 'carregar';

  const lista = $('lista-saves');
  lista.replaceChildren();
  $('onde-ficam').textContent = await ondeFicamOsSaves();
  const saves = await listarSaves();
  if (saves.length === 0) {
    const p = document.createElement('div');
    p.className = 'linha-dado';
    p.textContent = 'Nenhum mundo salvo ainda.';
    lista.append(p);
  }
  for (const s of saves) {
    const item = document.createElement('div');
    item.className = 'save-item';
    const nome = document.createElement('span');
    nome.textContent = s.nome;
    const quando = document.createElement('span');
    quando.className = 'quando';
    quando.textContent = `${(s.bytes / 1024 / 1024).toFixed(1)} MB`;
    const apagar = document.createElement('button');
    // sem isto o botão conta como "enviar" e fecha o diálogo junto
    apagar.type = 'button';
    apagar.className = 'btn';
    apagar.title = 'Apagar este mundo';
    apagar.textContent = '✕';
    apagar.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await apagarSave(s.nome);
      abrirSaves(modoSave);
    });
    item.append(nome, quando, apagar);
    item.addEventListener('click', () => {
      saveEscolhido = s.nome;
      $<HTMLInputElement>('in-nome-save').value = s.nome;
      $<HTMLButtonElement>('btn-confirmar-save').disabled = false;
      for (const outro of lista.querySelectorAll('.save-item')) {
        (outro as HTMLElement).style.borderColor = '';
      }
      item.style.borderColor = 'var(--acao)';
    });
    lista.append(item);
  }
  dlgSaves.showModal();
}

dlgSaves.addEventListener('close', async () => {
  if (dlgSaves.returnValue !== 'ok') return;
  if (modoSave === 'salvar') {
    const nome = $<HTMLInputElement>('in-nome-save').value.trim() || 'mundo';
    await gravarSave(nome, jogo.salvar());
  } else if (saveEscolhido) {
    const texto = await lerSave(saveEscolhido);
    if (!texto) return;
    try {
      jogo.carregar(texto);
    } catch (erro) {
      alert(`Não deu para abrir esse mundo: ${(erro as Error).message}`);
    }
  }
});

// ------------------------------------------------------------ redimensionar

function ajustarTela(): void {
  const r = palco.getBoundingClientRect();
  const escala = dpr();
  // Só o tamanho **do buffer** é ajustado aqui. O tamanho em tela vem do CSS
  // (`#tela { width:100%; height:100% }`), e escrevê-lo daqui dentro fechava um
  // laço: o observador via o palco mudar, este código escrevia o estilo, o
  // estilo mudava o layout, o observador via de novo. O navegador reclamava de
  // "ResizeObserver loop" e o jogo mostrava aquilo como erro fatal.
  jogo.redimensionar(
    Math.max(1, Math.round(r.width * escala)),
    Math.max(1, Math.round(r.height * escala)),
  );
}

new ResizeObserver(ajustarTela).observe(palco);

// --------------------------------------------------------------- ciclo da UI

const elAno = $('ano');
const elPop = $('pop-topo');
const elReinos = $('reinos-topo');
const elGuerras = $('guerras-topo');
const elDesempenho = $('desempenho');
// O medidor de desempenho é coisa de quem está mexendo no jogo, não de quem
// está jogando: nasce escondido e liga na aba de ajustes.
$<HTMLInputElement>('chk-desempenho').addEventListener('change', (e) => {
  elDesempenho.hidden = !(e.target as HTMLInputElement).checked;
});

let ultimoTopo = 0;

jogo.aoQuadro = () => {
  const agora = performance.now();
  moverCameraPorTeclado();
  inspetor.atualizar(jogo.mundo, agora);
  painel.atualizar(jogo.mundo, agora);
  comando.acompanhar(agora);

  if (agora - ultimoTopo > 250) {
    ultimoTopo = agora;
    const s = jogo.mundo.estatisticas;
    elAno.textContent = String(jogo.ano);
    elPop.textContent = String(s.populacao);
    elReinos.textContent = String(s.reinos);
    elGuerras.textContent = String(s.guerras);

    const custos = [...jogo.mundo.pipeline.custo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, ms]) => `${id} ${ms.toFixed(1)}ms`);
    elDesempenho.replaceChildren(
      texto(`fps <b>${jogo.fps.toFixed(0)}</b>`),
      texto(`ticks/s <b>${jogo.tps.toFixed(0)}</b>`),
      texto(`desenho <b>${jogo.renderizador.custoMs.toFixed(1)}ms</b>`),
      texto(`na tela <b>${jogo.renderizador.desenhadas}</b>`),
      ...custos.map((c) => texto(c)),
    );

    jogo.renderizador.desenharMinimapa(miniCtx, miniCanvas.width, miniCanvas.height);
  }
};

function texto(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

jogo.aoTrocarMundo = (mundo) => {
  cronica.ligar(mundo);
  inspetor.limpar();
  comando.trocarMundo();
  $('bloco-comando').hidden = true;
};

// ------------------------------------------------------------------- início

montarFerramentas();
montarListaEspecies(false);
cronica.ligar(jogo.mundo);
jogo.anunciar();
ajustarTela();
jogo.renderizador.camera.enquadrarMundo();

const zoomInicial = Number(params.get('zoom'));
if (Number.isFinite(zoomInicial) && zoomInicial > 0) {
  jogo.renderizador.camera.escala = zoomInicial;
  const px = Number(params.get('x'));
  const py = Number(params.get('y'));
  if (Number.isFinite(px) && Number.isFinite(py)) {
    jogo.renderizador.camera.x = px;
    jogo.renderizador.camera.y = py;
  }
  jogo.renderizador.camera.prender();
}

// `?ticks=6000` adianta o relógio antes de mostrar: serve para conferir um
// mundo já desenvolvido, com aldeias construídas, sem esperar em tempo real.
const adiantar = Number(params.get('ticks'));
if (Number.isFinite(adiantar) && adiantar > 0) {
  for (let i = 0; i < Math.min(60000, adiantar); i++) jogo.mundo.avancar();
  jogo.mundo.recalcularEstatisticas();
  jogo.mundo.grid.marcarTudoSujo();
}

// `?aldeia=1` abre o painel de ordens da primeira aldeia — serve para
// conferir a tela cheia numa captura automática.
if (params.has('aldeia')) {
  const primeira = jogo.mundo.aldeias.find((a) => a.ativa);
  if (primeira) {
    jogo.renderizador.aldeiaSelecionada = primeira.id;
    inspetor.aldeia = primeira.id;
    abrirComando(primeira.id);
    jogo.renderizador.camera.x = primeira.x;
    jogo.renderizador.camera.y = primeira.y;
    jogo.renderizador.camera.prender();
  }
}

jogo.iniciar();

// Ganchos usados só pelo autoteste do aplicativo (`npm run testar-app`), que
// precisa selecionar uma aldeia sem saber onde ela está na tela.
declare global {
  interface Window {
    __wb2jogo?: typeof jogo;
    __wb2selecionarAldeia?: (id: number) => void;
  }
}
window.__wb2jogo = jogo;
window.__wb2selecionarAldeia = (id: number) => {
  const a = jogo.mundo.aldeias[id];
  if (!a?.ativa) return;
  jogo.renderizador.aldeiaSelecionada = id;
  inspetor.criatura = -1;
  inspetor.aldeia = id;
  inspetor.tile = -1;
  abrirComando(id);
};

if (!rodandoNoApp()) {
  console.info('[wb2] rodando no navegador: saves vão para o armazenamento local.');
}
