/**
 * Registro genérico de definições (espécies, biomas, edifícios, poderes...).
 *
 * Cada definição tem um id de texto (estável, é o que vai para o save) e um
 * índice numérico (compacto, é o que vai para os arrays tipados do mundo).
 * Conteúdo novo entra registrando uma definição — nenhum `switch` espalhado
 * pelo código precisa ser tocado.
 */
export interface Definicao {
  readonly id: string;
}

export class Registro<T extends Definicao> {
  private porId = new Map<string, T>();
  private lista: T[] = [];
  private indices = new Map<string, number>();

  constructor(readonly nome: string) {}

  registrar(def: T): T {
    if (this.porId.has(def.id)) {
      throw new Error(`Registro "${this.nome}": id duplicado "${def.id}"`);
    }
    this.porId.set(def.id, def);
    this.indices.set(def.id, this.lista.length);
    this.lista.push(def);
    return def;
  }

  registrarTodos(defs: readonly T[]): void {
    for (const d of defs) this.registrar(d);
  }

  /** Definição pelo id de texto. Lança se não existir — id errado é bug, não dado. */
  obter(id: string): T {
    const d = this.porId.get(id);
    if (!d) throw new Error(`Registro "${this.nome}": id desconhecido "${id}"`);
    return d;
  }

  talvez(id: string): T | undefined {
    return this.porId.get(id);
  }

  /** Definição pelo índice numérico (o que fica guardado nos TypedArrays). */
  porIndice(i: number): T {
    const d = this.lista[i];
    if (!d) throw new Error(`Registro "${this.nome}": índice inválido ${i}`);
    return d;
  }

  indice(id: string): number {
    const i = this.indices.get(id);
    if (i === undefined) throw new Error(`Registro "${this.nome}": id desconhecido "${id}"`);
    return i;
  }

  todos(): readonly T[] {
    return this.lista;
  }

  filtrar(fn: (d: T) => boolean): T[] {
    return this.lista.filter(fn);
  }

  get tamanho(): number {
    return this.lista.length;
  }
}
