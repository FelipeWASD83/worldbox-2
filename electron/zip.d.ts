// Tipos de `zip.js` para o TypeScript das ferramentas e dos testes (o processo
// do Electron é JavaScript puro e não precisa disto).
export interface ArquivoZip {
  nome: string;
  dados: Buffer;
}
export function crc32(buf: Uint8Array): number;
export function caminhoSeguro(nome: string): boolean;
export function criarZip(arquivos: ArquivoZip[]): Buffer;
export function lerZip(buf: Buffer): ArquivoZip[];
