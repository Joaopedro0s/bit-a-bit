// Parte comum do painel de uma fase: título, objetivos, mensagens e barra de ação.
// A Mesa de blocos (fases 1-4) e o editor de código (fase 5) herdam daqui.

import { alternarSom, somLigado } from '../audio';
import type { Fase } from '../core/fases';
import { descreverObjetivo, type ResultadoObjetivo } from '../core/objetivos';
import type { Linha } from '../core/programa';
import { botao, el } from './dom';

export interface AcoesPainel {
  iniciar(): void;
  passo(): void;
  reiniciar(): void;
  verJs(): void;
  velocidade(): void;
  voltar(): void;
  /** Chamado sempre que o programa muda. */
  editou(): void;
}

export type EstadoPainel = 'editando' | 'rodando' | 'passo' | 'esperando' | 'acabou';

type NomeBotao = 'iniciar' | 'passo' | 'reiniciar' | 'apagar' | 'verJs' | 'velocidade' | 'som';

export abstract class PainelFase {
  /** O programa atual, como linhas da Mesa. */
  abstract readonly linhas: Linha[];
  readonly raiz: HTMLElement;
  protected estado: EstadoPainel = 'editando';
  protected readonly botoes: Record<NomeBotao, HTMLButtonElement>;
  private readonly objetivos: HTMLUListElement;
  private readonly mensagem: HTMLElement;
  protected readonly anuncio: HTMLElement;
  private destaque: { linha: number | null; tipo: 'ativa' | 'erro' } = { linha: null, tipo: 'ativa' };

  constructor(
    protected readonly fase: Fase,
    protected readonly acoes: AcoesPainel,
    velocidadeInicial: number,
  ) {
    this.objetivos = el(
      'ul',
      { classe: 'objetivos', rotulo: 'Objetivos da fase', testid: 'objetivos' },
      ...fase.objetivos.map((o) => el('li', {}, descreverObjetivo(o))),
    );
    this.mensagem = el('div', { 'aria-live': 'polite' });
    this.anuncio = el('div', { classe: 'so-leitor', 'aria-live': 'polite' });
    this.botoes = {
      iniciar: botao('▶ INICIAR TRÁFEGO', () => acoes.iniciar(), { classe: 'btn-iniciar', testid: 'btn-iniciar' }),
      passo: botao('🔍 PASSO A PASSO', () => acoes.passo(), { classe: 'btn-passo', testid: 'btn-passo' }),
      reiniciar: botao('↺ REINICIAR', () => acoes.reiniciar(), { classe: 'btn-reiniciar', testid: 'btn-reiniciar' }),
      apagar: botao('⌫', () => this.apagar(), {
        classe: 'btn-apagar',
        testid: 'btn-apagar',
        rotulo: 'Apagar a última linha',
        title: 'Apagar a última linha',
      }),
      verJs: botao('{ } Ver em JavaScript', () => acoes.verJs(), { testid: 'btn-ver-js' }),
      velocidade: botao('', () => acoes.velocidade(), { testid: 'btn-velocidade' }),
      som: botao('', () => this.mostrarSom(alternarSom()), { testid: 'btn-som' }),
    };
    this.mostrarVelocidade(velocidadeInicial);
    this.mostrarSom(somLigado());
    this.raiz = el('div', { classe: 'painel-fase' });
    this.raiz.style.display = 'contents';
  }

  /** As subclasses chamam no fim do construtor, com o conteúdo do meio. */
  protected montar(...conteudo: Node[]): void {
    this.raiz.replaceChildren(
      el(
        'div',
        { classe: 'mesa-topo' },
        botao('←', () => this.acoes.voltar(), { classe: 'botao-voltar', testid: 'btn-voltar', rotulo: 'Voltar para as fases' }),
        el('h2', { testid: 'titulo-fase' }, `Fase ${this.fase.id}: ${this.fase.titulo}`),
      ),
      this.objetivos,
      ...conteudo,
      this.mensagem,
      el('div', { classe: 'barra-acao' }, this.botoes.iniciar, this.botoes.passo, this.botoes.reiniciar, this.botoes.apagar),
      el('div', { classe: 'barra-extra' }, this.botoes.verJs, this.botoes.velocidade, this.botoes.som),
      this.anuncio,
    );
    this.atualizarBotoes();
  }

  /** ⌫: na Mesa apaga a última linha; no editor de código não existe. */
  protected abstract apagar(): void;
  /** Elemento que contém as linhas com data-testid="linha-N". */
  protected abstract areaDasLinhas(): HTMLElement;

  protected travada(): boolean {
    return this.estado === 'rodando' || this.estado === 'passo' || this.estado === 'esperando';
  }

  definirEstado(estado: EstadoPainel): void {
    this.estado = estado;
    this.atualizarBotoes();
  }

  mostrarVelocidade(v: number): void {
    this.botoes.velocidade.textContent = `⏩ ${v}x`;
    this.botoes.velocidade.setAttribute('aria-label', `Velocidade ${v} vezes. Toque para mudar.`);
  }

  private mostrarSom(ligado: boolean): void {
    this.botoes.som.textContent = ligado ? '🔊 Som' : '🔇 Mudo';
    this.botoes.som.setAttribute('aria-pressed', String(ligado));
  }

  destacarLinha(linha: number | null, tipo: 'ativa' | 'erro' = 'ativa'): void {
    if (this.destaque.linha === linha && this.destaque.tipo === tipo) return;
    this.destaque = { linha, tipo };
    this.reaplicarDestaque();
  }

  /** Depois de redesenhar as linhas, o destaque precisa voltar. */
  protected reaplicarDestaque(): void {
    const area = this.areaDasLinhas();
    area.querySelectorAll('.ativa, .erro').forEach((item) => item.classList.remove('ativa', 'erro'));
    const { linha, tipo } = this.destaque;
    if (linha === null) return;
    const item = area.querySelector<HTMLElement>(`[data-testid="linha-${linha}"]`);
    if (!item) return;
    item.classList.add(tipo);
    item.scrollIntoView({ block: 'nearest' });
  }

  protected esquecerDestaque(): void {
    this.destaque = { linha: null, tipo: 'ativa' };
  }

  marcarObjetivos(resultados: ResultadoObjetivo[] | null): void {
    [...this.objetivos.children].forEach((li, i) => {
      li.classList.remove('ok', 'falhou');
      const r = resultados?.[i];
      if (r) li.classList.add(r.cumprido ? 'ok' : 'falhou');
    });
  }

  mostrarMensagem(
    tipo: 'erro' | 'vitoria' | 'info',
    texto: string,
    acao?: { texto: string; aoClicar: () => void; testid: string },
  ): void {
    const testid = tipo === 'erro' ? 'msg-erro' : tipo === 'vitoria' ? 'msg-vitoria' : 'msg-info';
    const caixa = el(
      'div',
      { classe: `mensagem ${tipo}`, testid, role: tipo === 'erro' ? 'alert' : 'status' },
      el('p', {}, texto),
      acao && botao(acao.texto, acao.aoClicar, { testid: acao.testid }),
    );
    this.mensagem.replaceChildren(caixa);
    caixa.scrollIntoView({ block: 'nearest' });
  }

  limparMensagem(): void {
    this.mensagem.replaceChildren();
  }

  /** Programa pronto para rodar? (Mesa: sem "se" pela metade.) */
  protected podeRodar(): boolean {
    return this.linhas.length > 0;
  }

  protected atualizarBotoes(): void {
    const b = this.botoes;
    const pode = this.podeRodar();
    b.iniciar.disabled = !pode || this.estado === 'rodando';
    b.passo.disabled = !pode || this.estado === 'esperando';
    b.reiniciar.disabled = false;
  }
}
