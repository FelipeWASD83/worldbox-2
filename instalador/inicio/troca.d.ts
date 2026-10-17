// Tipos de `troca.js` para os testes em TypeScript.
export function lerEstado(base: string): { versao?: string; emTeste: boolean; revertida?: { de: string; motivo: string; em: number } };
export function gravarEstado(base: string, estado: object): void;
export function aplicarPendente(base: string): string | null;
export function reverter(base: string, motivo?: string): boolean;
export function confirmar(base: string): void;
