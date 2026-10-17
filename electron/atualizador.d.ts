// Tipos de `atualizador.js` para os testes em TypeScript.
export const REPOSITORIO: string;
export function versaoTupla(v: string): number[];
export function maisNova(a: string, b: string): boolean;
export function nomeDoPacote(versao: string): string;
export interface Atualizador {
  estado(): Promise<{ versao: string; instalado: boolean; repositorio: string; revertida: unknown; acabouDeAtualizar: string | null }>;
  checar(): Promise<{ atual: string; ultima: string; nova: boolean; notas: string; pagina: string; publicadaEm: string; temPacote: boolean }>;
  baixar(): Promise<{ versao: string }>;
}
export function criarAtualizador(op: { raiz: string; base: string | null; versaoElectron?: string }): Atualizador;
