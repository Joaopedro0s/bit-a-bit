import { el, botao } from './dom';

const SVG_CONE = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 4L12 56H52L32 4Z" fill="#ff7043"/>
  <path d="M17 40H47L44.5 32H19.5L17 40Z" fill="#fff"/>
  <path d="M22 24H42L39.5 16H24.5L22 24Z" fill="#fff"/>
  <circle cx="27" cy="46" r="3" fill="#111"/>
  <circle cx="37" cy="46" r="3" fill="#111"/>
  <path d="M28 50Q32 54 36 50" stroke="#111" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

export type EtapaTutorial = {
  gatilho?: () => boolean; // Quando avança automaticamente (se omitido, espera clique)
  alvo?: string; // data-testid do elemento a destacar
  texto: string;
};

export class Tutorial {
  private elFundo: HTMLElement;
  private elJanela: HTMLElement;
  private elTexto: HTMLElement;
  private elPersonagem: HTMLElement;
  private btnPular: HTMLButtonElement;
  private animacaoFrame: number | null = null;
  private indice = 0;
  private readonly etapas: EtapaTutorial[];

  constructor(etapas: EtapaTutorial[], private aoConcluir: () => void) {
    this.etapas = etapas;

    this.elTexto = el('p', { classe: 'tutorial-texto' });
    this.elPersonagem = el('div', { classe: 'tutorial-mascote' });
    this.elPersonagem.innerHTML = SVG_CONE;
    
    this.btnPular = botao('Pular', () => this.concluir(), { classe: 'btn-pular' });

    this.elJanela = el(
      'div',
      { classe: 'tutorial-balao', rotulo: 'Tutorial', 'aria-live': 'polite' },
      this.elPersonagem,
      el('div', { classe: 'tutorial-conteudo' }, this.elTexto, this.btnPular)
    );

    this.elFundo = el('div', { classe: 'tutorial-fundo pointer-events-none' }, this.elJanela);

    this.elJanela.addEventListener('click', () => {
      const etapa = this.etapas[this.indice];
      if (!etapa?.gatilho) {
        this.avancar();
      }
    });

    document.body.appendChild(this.elFundo);
    window.addEventListener('resize', this.posicionar);
    this.iniciarLoop();
    this.mostrarEtapa(0);
  }

  private mostrarEtapa(indice: number): void {
    if (indice >= this.etapas.length) {
      this.concluir();
      return;
    }
    
    const etapa = this.etapas[indice];
    this.elTexto.textContent = etapa.texto;
    
    this.elJanela.classList.remove('pulo');
    void this.elJanela.offsetWidth;
    this.elJanela.classList.add('pulo');

    document.querySelectorAll('.tutorial-destaque').forEach(e => e.classList.remove('tutorial-destaque'));
    
    if (etapa.alvo) {
      const alvo = document.querySelector(`[data-testid="${etapa.alvo}"]`);
      if (alvo) {
        alvo.classList.add('tutorial-destaque');
      }
    }
    this.posicionar();
  }

  /**
   * O balão fica sempre em cima da área do cruzamento (#palco): ela nunca é alvo do
   * tutorial, então o balão não cobre os blocos nem o botão INICIAR em nenhum layout.
   */
  private readonly posicionar = (): void => {
    const palco = document.getElementById('palco');
    const r = palco?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) {
      this.elFundo.removeAttribute('style');
      return;
    }
    Object.assign(this.elFundo.style, {
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      right: 'auto',
      bottom: 'auto',
    });
  };

  private avancar(): void {
    this.indice++;
    this.mostrarEtapa(this.indice);
  }

  private iniciarLoop(): void {
    const loop = () => {
      const etapa = this.etapas[this.indice];
      if (etapa?.gatilho && etapa.gatilho()) {
        this.avancar();
      }
      if (this.indice < this.etapas.length) {
        this.animacaoFrame = requestAnimationFrame(loop);
      }
    };
    this.animacaoFrame = requestAnimationFrame(loop);
  }

  public concluir(): void {
    if (this.animacaoFrame !== null) {
      cancelAnimationFrame(this.animacaoFrame);
      this.animacaoFrame = null;
    }
    document.querySelectorAll('.tutorial-destaque').forEach(e => e.classList.remove('tutorial-destaque'));
    window.removeEventListener('resize', this.posicionar);
    this.elFundo.remove();
    this.aoConcluir();
  }
}
