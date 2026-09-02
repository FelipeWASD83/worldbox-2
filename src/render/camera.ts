/**
 * Câmera: converte entre coordenadas do mundo (em tiles) e da tela (em pixels).
 */
export class Camera {
  /** Centro da câmera, em tiles. */
  x = 0;
  y = 0;
  /** Pixels de tela por tile do mundo. */
  escala = 4;
  larguraTela = 0;
  alturaTela = 0;

  readonly escalaMin = 1;
  /**
   * Teto do zoom. Doze pixels por tile já é "de perto"; acima de vinte e quatro
   * o mapa fica bonito e inútil, com três casas na tela e nada do que está
   * acontecendo em volta.
   */
  readonly escalaMax = 24;

  /** Mudam quando o jogador gera um mundo de outro tamanho. */
  larguraMundo: number;
  alturaMundo: number;

  constructor(larguraMundo: number, alturaMundo: number) {
    this.larguraMundo = larguraMundo;
    this.alturaMundo = alturaMundo;
    this.x = larguraMundo / 2;
    this.y = alturaMundo / 2;
  }

  redimensionar(largura: number, altura: number): void {
    this.larguraTela = largura;
    this.alturaTela = altura;
      // enquanto o jogador não escolheu o próprio enquadramento, a janela manda
    if (this.enquadrado) this.enquadrarMundo();
  }

  /** Ajusta o zoom para o mundo inteiro caber na tela. */
  /**
   * A câmera ainda mostra o mundo inteiro, sem o jogador ter mexido nela?
   *
   * Enquanto for verdade, todo redimensionamento da janela reenquadra. Sem
   * isso, o enquadramento feito na abertura ficava valendo para sempre: abrir o
   * jogo numa janela pequena e depois maximizar deixava o mundo desenhado no
   * tamanho antigo, com um quarto da tela em preto em volta. Ao primeiro zoom
   * ou arrasto isto vira falso e não volta sozinho — quem escolheu o
   * enquadramento passa a ser o jogador.
   */
  private enquadrado = true;

  enquadrarMundo(): void {
    const ex = this.larguraTela / this.larguraMundo;
    const ey = this.alturaTela / this.alturaMundo;
    this.escala = Math.max(this.escalaMin, Math.min(ex, ey));
    this.x = this.larguraMundo / 2;
    this.y = this.alturaMundo / 2;
    this.enquadrado = true;
  }

  telaParaMundoX(px: number): number {
    return this.x + (px - this.larguraTela / 2) / this.escala;
  }

  telaParaMundoY(py: number): number {
    return this.y + (py - this.alturaTela / 2) / this.escala;
  }

  mundoParaTelaX(mx: number): number {
    return (mx - this.x) * this.escala + this.larguraTela / 2;
  }

  mundoParaTelaY(my: number): number {
    return (my - this.y) * this.escala + this.alturaTela / 2;
  }

  /** Zoom mantendo fixo o ponto do mundo que está sob o cursor. */
  zoom(fator: number, focoTelaX: number, focoTelaY: number): void {
    const antesX = this.telaParaMundoX(focoTelaX);
    const antesY = this.telaParaMundoY(focoTelaY);
    this.enquadrado = false;
    this.escala = Math.max(this.escalaMin, Math.min(this.escalaMax, this.escala * fator));
    const depoisX = this.telaParaMundoX(focoTelaX);
    const depoisY = this.telaParaMundoY(focoTelaY);
    this.x += antesX - depoisX;
    this.y += antesY - depoisY;
    this.prender();
  }

  /** Move em pixels de tela. */
  arrastar(dxTela: number, dyTela: number): void {
    this.enquadrado = false;
    this.x -= dxTela / this.escala;
    this.y -= dyTela / this.escala;
    this.prender();
  }

  /** Não deixa a câmera sair muito do mundo. */
  prender(): void {
    const margemX = this.larguraTela / this.escala / 2;
    const margemY = this.alturaTela / this.escala / 2;
    const minX = Math.min(this.larguraMundo / 2, margemX * 0.5);
    const maxX = Math.max(this.larguraMundo / 2, this.larguraMundo - margemX * 0.5);
    const minY = Math.min(this.alturaMundo / 2, margemY * 0.5);
    const maxY = Math.max(this.alturaMundo / 2, this.alturaMundo - margemY * 0.5);
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
  }

  /** Retângulo do mundo visível agora, em tiles. */
  area(): { x0: number; y0: number; x1: number; y1: number } {
    const meiaL = this.larguraTela / this.escala / 2;
    const meiaA = this.alturaTela / this.escala / 2;
    return {
      x0: this.x - meiaL,
      y0: this.y - meiaA,
      x1: this.x + meiaL,
      y1: this.y + meiaA,
    };
  }
}
