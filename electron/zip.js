import zlib from 'node:zlib';

/**
 * Ler e gravar `.zip`, sem dependência nenhuma.
 *
 * Existe para o atualizador e para o script que publica a versão. Os dois lados
 * usam este mesmo código, então o pacote que sai da publicação é exatamente o
 * formato que o atualizador sabe ler.
 *
 * Por que não o `Expand-Archive` do PowerShell: ele grava antes de deixar
 * conferir os caminhos, e o `Compress-Archive` do Windows PowerShell 5.1 grava
 * os nomes com barra invertida, que outro leitor de zip pode não entender. Aqui
 * cada caminho é conferido antes de qualquer arquivo ir para o disco: nome com
 * `..`, absoluto ou com letra de unidade derruba o pacote inteiro.
 */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** O caminho de dentro do zip é seguro para extrair? */
export function caminhoSeguro(nome) {
  if (!nome || nome.length > 400) return false;
  if (nome.includes('\\') || nome.includes('\0')) return false;
  if (nome.startsWith('/') || /^[a-zA-Z]:/.test(nome)) return false;
  return nome.split('/').every((parte) => parte !== '..' && parte !== '.');
}

/**
 * Monta um zip a partir de uma lista de arquivos `{ nome, dados }`, com os
 * nomes já em barra normal. Devolve o Buffer.
 */
export function criarZip(arquivos) {
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const { nome, dados } of arquivos) {
    if (!caminhoSeguro(nome)) throw new Error(`caminho inválido no pacote: ${nome}`);
    const nomeBuf = Buffer.from(nome, 'utf8');
    const comprimido = zlib.deflateRawSync(dados, { level: 9 });
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // hora e data zeradas: o mesmo conteúdo dá o mesmo zip
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nomeBuf, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nomeBuf);
    deslocamento += local.length + nomeBuf.length + comprimido.length;
  }
  const tamanhoCentral = centrais.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, ...centrais, fim]);
}

/**
 * Lê um zip inteiro na memória e devolve `[{ nome, dados }]` só dos arquivos
 * (pastas são implícitas). Confere o CRC de cada um e recusa caminho inseguro
 * antes de devolver qualquer coisa.
 */
export function lerZip(buf) {
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('não é um arquivo zip');
  const total = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const saida = [];
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip corrompido');
    const metodo = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const tamComp = buf.readUInt32LE(p + 20);
    const tamNome = buf.readUInt16LE(p + 28);
    const tamExtra = buf.readUInt16LE(p + 30);
    const tamComent = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + tamNome);
    p += 46 + tamNome + tamExtra + tamComent;
    if (nome.endsWith('/')) continue;
    if (!caminhoSeguro(nome)) throw new Error(`caminho inválido no pacote: ${nome}`);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('zip corrompido');
    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const bruto = buf.subarray(inicio, inicio + tamComp);
    let dados;
    if (metodo === 0) dados = Buffer.from(bruto);
    else if (metodo === 8) dados = zlib.inflateRawSync(bruto);
    else throw new Error(`compressão ${metodo} não suportada`);
    if (crc32(dados) !== crc) throw new Error(`arquivo corrompido no pacote: ${nome}`);
    saida.push({ nome, dados });
  }
  return saida;
}
