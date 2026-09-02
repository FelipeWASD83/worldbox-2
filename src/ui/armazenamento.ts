/**
 * Onde os mundos salvos ficam.
 *
 * No aplicativo (Electron) vão para arquivos `.wb2` na pasta de dados do
 * usuário, via a ponte declarada em `electron/preload.cjs`. Fora dele — quando
 * o jogo é aberto pelo `npm run web`, útil para depurar — caem no
 * armazenamento do navegador. A interface não precisa saber qual dos dois é.
 */

export interface InfoSave {
  nome: string;
  bytes: number;
  modificado: number;
}

interface PonteNativa {
  nativo: boolean;
  saves: {
    listar(): Promise<InfoSave[]>;
    gravar(nome: string, texto: string): Promise<string>;
    ler(nome: string): Promise<string | null>;
    apagar(nome: string): Promise<boolean>;
    pasta(): Promise<string>;
  };
  erroFatal(mensagem: string): Promise<void>;
}

declare global {
  interface Window {
    wb2?: PonteNativa;
  }
}

const PREFIXO = 'wb2:mundo:';

export const rodandoNoApp = (): boolean => Boolean(window.wb2?.nativo);

/** Frase curta dizendo onde os mundos estão guardados. */
export async function ondeFicamOsSaves(): Promise<string> {
  if (window.wb2) return await window.wb2.saves.pasta();
  return 'guardados neste navegador (no aplicativo, viram arquivos .wb2)';
}

export async function listarSaves(): Promise<InfoSave[]> {
  if (window.wb2) return window.wb2.saves.listar();

  const saves: InfoSave[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (!chave?.startsWith(PREFIXO)) continue;
    // cada save grava também a data numa chave irmã; ela não é um mundo
    if (chave.endsWith(':quando')) continue;
    const texto = localStorage.getItem(chave) ?? '';
    saves.push({
      nome: chave.slice(PREFIXO.length),
      bytes: texto.length,
      modificado: Number(localStorage.getItem(`${chave}:quando`) ?? 0),
    });
  }
  saves.sort((a, b) => b.modificado - a.modificado);
  return saves;
}

export async function gravarSave(nome: string, texto: string): Promise<void> {
  if (window.wb2) {
    await window.wb2.saves.gravar(nome, texto);
    return;
  }
  localStorage.setItem(PREFIXO + nome, texto);
  localStorage.setItem(`${PREFIXO}${nome}:quando`, String(Date.now()));
}

export async function lerSave(nome: string): Promise<string | null> {
  if (window.wb2) return window.wb2.saves.ler(nome);
  return localStorage.getItem(PREFIXO + nome);
}

export async function apagarSave(nome: string): Promise<void> {
  if (window.wb2) {
    await window.wb2.saves.apagar(nome);
    return;
  }
  localStorage.removeItem(PREFIXO + nome);
  localStorage.removeItem(`${PREFIXO}${nome}:quando`);
}
