import type { Mundo } from '../core/mundo.js';
import type { Camera } from '../render/camera.js';
import { Estacao, estacaoDe } from '../sim/estacoes.js';

/**
 * O som do mundo, todo sintetizado na hora pelo Web Audio. Nenhum arquivo.
 *
 * Duas camadas:
 *
 * - **Ambiente**: quatro ruídos contínuos filtrados — vento, chuva, mar e
 *   fogo —, cada um com o volume tirado do que **está na tela**. A câmera em
 *   cima do oceano ouve onda; aproximada de uma floresta em chamas, ouve o
 *   crepitar; afastada sobre o continente, o vento. Na primavera e no verão,
 *   de perto, passarinho de vez em quando.
 * - **Acontecimentos**: o que o barramento anuncia vira um som curto — trovão
 *   do raio, estrondo do meteoro e do vulcão, trompa da guerra, sino da vila
 *   fundada, acorde da paz. O que acontece num lugar só toca se esse lugar
 *   está na tela, com o pan estéreo de onde ele está; o que é do mundo inteiro
 *   (guerra, paz, descoberta) toca sempre, baixinho.
 *
 * O navegador só deixa tocar som depois de um gesto do jogador, então o áudio
 * nasce no primeiro clique ou tecla (`acordar`). Volume e mudo ficam guardados
 * no próprio computador, como as outras preferências da janela.
 */

/** Quanto tempo, em ms, entre dois sons do mesmo tipo. É o que impede o incêndio de virar chiado. */
const INTERVALO_MINIMO: Record<string, number> = {
  crepitar: 350,
  golpe: 140,
  clique: 90,
  terra: 160,
  agua: 220,
  sininho: 900,
  sino: 600,
  passaro: 400,
};

export class Som {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private ambiente: Record<'vento' | 'chuva' | 'mar' | 'fogo', GainNode> | null = null;
  private desligar: Array<() => void> = [];
  private ultimo = new Map<string, number>();
  private ultimaVarredura = 0;
  private mundo: Mundo | null = null;

  volume = 0.6;
  mudo = false;

  constructor(private camera: () => Camera) {
    try {
      const salvo = localStorage.getItem('som');
      if (salvo) {
        const d = JSON.parse(salvo) as { volume?: number; mudo?: boolean };
        if (typeof d.volume === 'number') this.volume = Math.max(0, Math.min(1, d.volume));
        if (typeof d.mudo === 'boolean') this.mudo = d.mudo;
      }
    } catch {
      // preferência ilegível: fica o padrão
    }
  }

  /** Cria o áudio. Tem de ser chamado de dentro de um gesto do jogador. */
  acordar(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.mestre = ctx.createGain();
    this.mestre.gain.value = this.mudo ? 0 : this.volume;
    // um compressor no fim segura o estrondo do meteoro sem estourar a caixa
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.mestre.connect(comp).connect(ctx.destination);

    const n = ctx.sampleRate * 2;
    this.ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this.ambiente = {
      vento: this.laco('bandpass', 420, 0.6),
      chuva: this.laco('highpass', 2600, 0.4),
      mar: this.laco('lowpass', 520, 0.7),
      fogo: this.laco('bandpass', 1800, 1.4),
    };
  }

  /** Muda o volume (0 a 1) e o mudo, e guarda a preferência. */
  ajustar(volume: number, mudo: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.mudo = mudo;
    if (this.mestre && this.ctx) {
      this.mestre.gain.setTargetAtTime(mudo ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    try {
      localStorage.setItem('som', JSON.stringify({ volume: this.volume, mudo }));
    } catch {
      // sem onde guardar: vale só nesta sessão
    }
  }

  /** Passa a escutar outro mundo (novo ou carregado). */
  ligar(mundo: Mundo): void {
    for (const fn of this.desligar) fn();
    this.desligar = [];
    this.mundo = mundo;
    const ev = mundo.eventos;
    this.desligar.push(
      ev.on('poder:usado', (d) => this.poder(d.poder, d.x, d.y)),
      ev.on('vulcao:erupcao', (d) => this.noLugar(d.x, d.y, (pan, perto) => this.estrondo(pan, 0.7 * perto, 70))),
      ev.on('clima:raioSeco', (d) => this.noLugar(d.x, d.y, (pan, perto) => this.trovao(pan, 0.5 * perto))),
      ev.on('terreno:incendio', (d) => this.noLugar(d.x, d.y, (pan, perto) => {
        if (this.pode('crepitar')) this.crepitar(pan, 0.25 * perto);
      })),
      ev.on('criatura:morreu', (d) => {
        if (d.causa !== 'combate' && d.causa !== 'predado') return;
        if (this.camera().escala < 5) return;
        this.noLugar(d.x, d.y, (pan, perto) => {
          if (this.pode('golpe')) this.golpe(pan, 0.3 * perto);
        });
      }),
      ev.on('aldeia:fundada', (d) => this.noLugar(d.x, d.y, (pan, perto) => {
        if (this.pode('sino')) this.sino(pan, 0.35 * perto);
      }, true)),
      ev.on('aldeia:destruida', (d) => this.noLugar(d.x, d.y, (pan, perto) => this.desmoronar(pan, 0.45 * perto))),
      ev.on('aldeia:cresceu', (d) => {
        const a = mundo.aldeias[d.aldeia];
        if (a) this.noLugar(a.x, a.y, (pan, perto) => this.fanfarra(pan, 0.25 * perto));
      }),
      ev.on('barco:lancado', (d) => {
        const a = mundo.aldeias[d.aldeia];
        if (a) this.noLugar(a.x, a.y, (pan, perto) => { if (this.pode('agua')) this.splash(pan, 0.3 * perto); });
      }),
      ev.on('reino:guerra', () => this.trompa(0.32)),
      ev.on('reino:paz', () => this.acorde([392, 494, 587], 0.2)),
      ev.on('reino:alianca', () => this.acorde([440, 554, 659, 880], 0.2)),
      ev.on('reino:rebeliao', () => this.tambor(0.35)),
      ev.on('reino:descobriu', () => { if (this.pode('sininho')) this.acorde([1047, 1319], 0.08); }),
    );
  }

  /**
   * Ajusta o ambiente ao que está na tela. Chamado a cada quadro, mas só
   * varre o mundo quatro vezes por segundo.
   */
  atualizar(agora: number, velocidade: number): void {
    if (!this.ctx || !this.ambiente || !this.mundo) return;
    if (agora - this.ultimaVarredura < 250) return;
    this.ultimaVarredura = agora;
    const m = this.mundo;
    const g = m.grid;
    const cam = this.camera();
    const area = cam.area();
    const x0 = Math.max(0, Math.floor(area.x0));
    const y0 = Math.max(0, Math.floor(area.y0));
    const x1 = Math.min(g.largura - 1, Math.ceil(area.x1));
    const y1 = Math.min(g.altura - 1, Math.ceil(area.y1));

    // Amostra uma grade de 12×8 pontos da tela: o que é água, o que é terra.
    let agua = 0;
    let total = 0;
    for (let j = 0; j < 8; j++) {
      const y = Math.round(y0 + ((y1 - y0) * (j + 0.5)) / 8);
      for (let k = 0; k < 12; k++) {
        const x = Math.round(x0 + ((x1 - x0) * (k + 0.5)) / 12);
        if (x < 0 || y < 0 || x >= g.largura || y >= g.altura) continue;
        total++;
        if (g.ehAgua(g.idx(x, y))) agua++;
      }
    }
    const fracAgua = total > 0 ? agua / total : 0;

    // Chuva: nuvens carregadas por cima da tela.
    let chuva = 0;
    for (const n of m.nuvens) {
      if (n.tipo !== 1 || n.forca < 0.3) continue;
      if (n.x + n.raio < x0 || n.x - n.raio > x1 || n.y + n.raio < y0 || n.y - n.raio > y1) continue;
      chuva += n.forca * 0.35;
    }
    // Fogo: focos na tela, contados até um teto (o conjunto pode ser enorme).
    let fogo = 0;
    let vistos = 0;
    for (const i of m.chamas) {
      if (++vistos > 400) break;
      const x = i % g.largura;
      const y = (i / g.largura) | 0;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) fogo++;
    }

    // De perto se ouve mais o chão e menos o vento; afastado, o contrário.
    const perto = Math.min(1, Math.max(0, (cam.escala - 2) / 8));
    const inverno = estacaoDe(m.tick) === Estacao.Inverno;
    const pausado = velocidade === 0 ? 0.35 : 1;
    const t = this.ctx.currentTime;
    const alvo = (no: GainNode, v: number): void => {
      no.gain.setTargetAtTime(v * pausado, t, 0.6);
    };
    alvo(this.ambiente.vento, (0.05 + (1 - perto) * 0.09) * (inverno ? 1.8 : 1));
    alvo(this.ambiente.mar, fracAgua * (0.08 + perto * 0.1));
    alvo(this.ambiente.chuva, Math.min(0.22, chuva * (0.6 + perto * 0.6)));
    alvo(this.ambiente.fogo, Math.min(0.25, fogo * 0.012 * (0.3 + perto)));

    // Passarinho: primavera e verão, de perto, sobre terra, com o jogo andando.
    const est = estacaoDe(m.tick);
    if (
      velocidade > 0 && perto > 0.35 && fracAgua < 0.6 &&
      (est === Estacao.Primavera || est === Estacao.Verao) &&
      Math.random() < 0.18 && this.pode('passaro')
    ) {
      this.passaro((Math.random() * 2 - 1) * 0.7, 0.06 * perto);
    }
  }

  // ------------------------------------------------------------- utilidades

  /** Um tipo de som pode tocar de novo agora? */
  private pode(tipo: string): boolean {
    const agora = performance.now();
    const antes = this.ultimo.get(tipo) ?? 0;
    if (agora - antes < (INTERVALO_MINIMO[tipo] ?? 0)) return false;
    this.ultimo.set(tipo, agora);
    return true;
  }

  /**
   * Chama `tocar` com o pan e a proximidade de um ponto do mundo, se ele estiver
   * na tela (ou perto da borda). `semprePerto` toca de leve mesmo fora da tela.
   */
  private noLugar(
    x: number, y: number, tocar: (pan: number, perto: number) => void, semprePerto = false,
  ): void {
    if (!this.ctx) return;
    const cam = this.camera();
    const a = cam.area();
    const largura = Math.max(1, a.x1 - a.x0);
    const altura = Math.max(1, a.y1 - a.y0);
    const folga = Math.max(largura, altura) * 0.15;
    const dentro = x >= a.x0 - folga && x <= a.x1 + folga && y >= a.y0 - folga && y <= a.y1 + folga;
    if (!dentro) {
      if (semprePerto) tocar(0, 0.25);
      return;
    }
    const pan = Math.max(-1, Math.min(1, ((x - a.x0) / largura) * 2 - 1));
    // mais perto (zoom maior) soa mais alto
    const perto = 0.45 + Math.min(1, cam.escala / 10) * 0.55;
    tocar(pan * 0.8, perto);
  }

  private poder(id: string, x: number, y: number): void {
    this.noLugar(x, y, (pan, perto) => {
      if (id === 'raio') this.trovao(pan, 0.7 * perto);
      else if (id === 'meteoro' || id === 'bomba' || id === 'chuva_de_meteoros') this.estrondo(pan, 0.8 * perto, 55);
      else if (id === 'terremoto' || id === 'abismo') this.ronco(pan, 0.6 * perto);
      else if (id === 'fogo' || id === 'queimada') { if (this.pode('crepitar')) this.crepitar(pan, 0.4 * perto); }
      else if (id === 'tsunami' || id === 'agua' || id === 'chuva') { if (this.pode('agua')) this.splash(pan, 0.35 * perto); }
      else if (id === 'tornado' || id === 'virar_vento') this.rajada(pan, 0.4 * perto);
      else if (['elevar', 'rebaixar', 'nivelar', 'montanha', 'erodir', 'ilha', 'depressao'].includes(id)) {
        if (this.pode('terra')) this.terra(pan, 0.15 * perto);
      } else if (this.pode('clique')) this.clique(pan, 0.12);
    }, true);
  }

  /** Um ruído contínuo, filtrado, com volume zero até o ambiente pedir. */
  private laco(tipo: BiquadFilterType, freq: number, q: number): GainNode {
    const ctx = this.ctx!;
    const fonte = ctx.createBufferSource();
    fonte.buffer = this.ruido;
    fonte.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = freq;
    filtro.Q.value = q;
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    // o mar e o vento respiram: um oscilador lento mexe no filtro
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08 + Math.random() * 0.1;
    const lfoGanho = ctx.createGain();
    lfoGanho.gain.value = freq * 0.35;
    lfo.connect(lfoGanho).connect(filtro.frequency);
    lfo.start();
    fonte.connect(filtro).connect(ganho).connect(this.mestre!);
    fonte.start(0, Math.random() * 1.9);
    return ganho;
  }

  private saida(pan: number): { no: GainNode; t: number } | null {
    const ctx = this.ctx;
    if (!ctx || !this.mestre || this.mudo || this.volume <= 0) return null;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.mestre);
    return { no: g, t: ctx.currentTime };
  }

  /** Rajada de ruído filtrado, com ataque e queda. */
  private ruidoCurto(
    pan: number, ganho: number, dur: number, tipo: BiquadFilterType, freq: number, freqFim: number, q = 1,
  ): void {
    const s = this.saida(pan);
    if (!s) return;
    const ctx = this.ctx!;
    const fonte = ctx.createBufferSource();
    fonte.buffer = this.ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.Q.value = q;
    filtro.frequency.setValueAtTime(freq, s.t);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(20, freqFim), s.t + dur);
    s.no.gain.setValueAtTime(0, s.t);
    s.no.gain.linearRampToValueAtTime(ganho, s.t + Math.min(0.02, dur * 0.1));
    s.no.gain.exponentialRampToValueAtTime(0.0001, s.t + dur);
    fonte.connect(filtro).connect(s.no);
    fonte.start(s.t, Math.random() * 1.5);
    fonte.stop(s.t + dur + 0.05);
  }

  /** Um tom, com envelope de sino ou de sopro. */
  private tom(
    pan: number, ganho: number, freq: number, dur: number, forma: OscillatorType, ataque = 0.005, atraso = 0,
  ): void {
    const s = this.saida(pan);
    if (!s) return;
    const ctx = this.ctx!;
    const t = s.t + atraso;
    const o = ctx.createOscillator();
    o.type = forma;
    o.frequency.value = freq;
    s.no.gain.setValueAtTime(0, t);
    s.no.gain.linearRampToValueAtTime(ganho, t + ataque);
    s.no.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(s.no);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------- os sons

  private trovao(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 0.12, 'highpass', 3000, 1500);
    this.ruidoCurto(pan, g * 0.9, 2.2, 'lowpass', 900, 60, 0.7);
  }

  private estrondo(pan: number, g: number, grave: number): void {
    this.ruidoCurto(pan, g, 1.6, 'lowpass', 600, grave, 0.8);
    this.tom(pan, g * 0.5, grave, 1.2, 'sine', 0.01);
  }

  private ronco(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 1.8, 'lowpass', 140, 40, 1.2);
  }

  private crepitar(pan: number, g: number): void {
    for (let k = 0; k < 4; k++) {
      const p = pan + (Math.random() - 0.5) * 0.2;
      setTimeout(() => this.ruidoCurto(p, g * (0.5 + Math.random() * 0.5), 0.05, 'highpass', 2500, 1800), k * 45 + Math.random() * 30);
    }
  }

  private golpe(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 0.09, 'bandpass', 900, 300, 2);
    this.tom(pan, g * 0.3, 1400 + Math.random() * 600, 0.12, 'triangle');
  }

  private sino(pan: number, g: number): void {
    // parciais de sino: 1, 2,76 e 5,4 vezes a fundamental, cada uma morrendo no seu tempo
    const f = 523;
    this.tom(pan, g, f, 2.2, 'sine');
    this.tom(pan, g * 0.45, f * 2.76, 1.2, 'sine');
    this.tom(pan, g * 0.2, f * 5.4, 0.6, 'sine');
  }

  private desmoronar(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 1.4, 'lowpass', 1200, 80, 0.8);
    for (let k = 0; k < 5; k++) {
      setTimeout(() => this.ruidoCurto(pan, g * 0.4, 0.15, 'bandpass', 700, 200, 3), 120 + k * 140);
    }
  }

  private fanfarra(pan: number, g: number): void {
    [523, 659, 784].forEach((f, k) => this.tom(pan, g, f, 0.35, 'triangle', 0.01, k * 0.11));
  }

  private splash(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 0.6, 'bandpass', 1400, 300, 0.9);
  }

  private rajada(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 1.4, 'bandpass', 300, 900, 1.5);
  }

  private terra(pan: number, g: number): void {
    this.ruidoCurto(pan, g, 0.25, 'lowpass', 400, 120, 1);
  }

  private clique(pan: number, g: number): void {
    this.tom(pan, g, 880, 0.06, 'triangle');
  }

  private trompa(g: number): void {
    // duas notas graves de sopro: a quinta de baixo, depois a fundamental
    this.tom(0, g, 110, 0.9, 'sawtooth', 0.12);
    this.tom(0, g * 0.6, 165, 0.9, 'sawtooth', 0.12);
    this.tom(0, g, 110, 1.3, 'sawtooth', 0.12, 0.7);
    this.tom(0, g * 0.6, 220, 1.3, 'sawtooth', 0.12, 0.7);
  }

  private tambor(g: number): void {
    for (let k = 0; k < 3; k++) {
      setTimeout(() => {
        this.tom(0, g, 70, 0.4, 'sine', 0.003);
        this.ruidoCurto(0, g * 0.4, 0.15, 'lowpass', 400, 100);
      }, k * 220);
    }
  }

  private acorde(freqs: number[], g: number): void {
    freqs.forEach((f, k) => this.tom(0, g, f, 1.6, 'sine', 0.02, k * 0.06));
  }

  private passaro(pan: number, g: number): void {
    const s = this.saida(pan);
    if (!s) return;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const base = 2600 + Math.random() * 1400;
    const notas = 2 + ((Math.random() * 3) | 0);
    let t = s.t;
    s.no.gain.setValueAtTime(0, t);
    for (let k = 0; k < notas; k++) {
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t + 0.07);
      s.no.gain.linearRampToValueAtTime(g, t + 0.01);
      s.no.gain.linearRampToValueAtTime(0, t + 0.08);
      t += 0.11 + Math.random() * 0.05;
    }
    o.connect(s.no);
    o.start(s.t);
    o.stop(t + 0.05);
  }
}
