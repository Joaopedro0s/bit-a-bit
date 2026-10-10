// Detecta suporte a WebGL e monitora FPS para decidir entre renderização 3D e 2D.
// Nenhuma dependência de Phaser ou Three.js: pode ser importado antes de ambos.

export function suportaWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/**
 * Monitor de FPS: chama `onAbaixoDo30` se a média nos primeiros `janelaMs` ms
 * ficar abaixo de 30 FPS. Use para acionar o fallback 2D automaticamente.
 */
export class MonitorFPS {
  private frames = 0;
  private inicio = performance.now();
  private encerrado = false;
  private raf = 0;

  constructor(
    private readonly janelaMs: number,
    private readonly onAbaixoDo30: () => void,
  ) {
    this.medir();
  }

  private medir(): void {
    if (this.encerrado) return;
    const agora = performance.now();
    this.frames++;
    const decorrido = agora - this.inicio;
    if (decorrido >= this.janelaMs) {
      this.encerrar();
      const fps = (this.frames / decorrido) * 1000;
      if (fps < 30) this.onAbaixoDo30();
      return;
    }
    this.raf = requestAnimationFrame(() => this.medir());
  }

  encerrar(): void {
    this.encerrado = true;
    cancelAnimationFrame(this.raf);
  }
}
