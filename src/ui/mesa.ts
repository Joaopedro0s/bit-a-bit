// Mesa de Programação (DOM): gaveta de blocos, linhas do algoritmo e barra de ação.
// A Mesa só cuida da edição e da aparência; quem roda a simulação é a cena.

import { logico, type Condicao, type Expressao, type OperadorLogico } from '../core/ast';
import type { Fase } from '../core/fases';
import { condicaoParaTexto, linhaParaTexto } from '../core/gerarJs';
import { descreverObjetivo, type ResultadoObjetivo } from '../core/objetivos';
import { recuoDasLinhas, type Linha } from '../core/programa';
import { botao, el } from './dom';

export interface AcoesMesa {
  iniciar(): void;
  passo(): void;
  reiniciar(): void;
  verJs(): void;
  velocidade(): void;
  voltar(): void;
  /** Chamado sempre que o algoritmo muda. */
  editou(): void;
}

export type EstadoMesa = 'editando' | 'rodando' | 'passo' | 'esperando' | 'acabou';

interface Rascunho {
  condicao: Condicao | null;
  operador: OperadorLogico | null;
}

const NOME_OPERADOR: Record<OperadorLogico, string> = { OR: 'OU', AND: 'E' };

function slugExpressao(e: Expressao): string {
  if (e.tipo === 'VAR') return e.nome;
  return e.tipo === 'BIN' ? 'conta' : String(e.valor);
}

/** data-testid estável para cada bloco da gaveta. */
export function testidDoBloco(l: Linha): string {
  switch (l.tipo) {
    case 'ABRIR':
    case 'FECHAR':
      return `bloco-${l.tipo.toLowerCase()}-${l.via.toLowerCase()}`;
    case 'ESPERAR':
      return `bloco-esperar-${slugExpressao(l.duracao)}`;
    case 'ATRIBUIR':
      return `bloco-atribuir-${l.variavel}`;
    case 'SE':
      return 'bloco-se';
    case 'SENAO':
      return 'bloco-senao';
    case 'FIM':
      return 'bloco-fim';
  }
}

export function categoria(l: Linha): string {
  switch (l.tipo) {
    case 'ABRIR':
    case 'FECHAR':
    case 'ESPERAR':
      return 'acao';
    case 'ATRIBUIR':
      return 'variavel';
    case 'SE':
      return 'se';
    case 'SENAO':
    case 'FIM':
      return 'senao';
  }
}

export class Mesa {
  linhas: Linha[] = [];
  private rascunho: Rascunho | null = null;
  private estado: EstadoMesa = 'editando';
  private destaque: { linha: number | null; tipo: 'ativa' | 'erro' } = { linha: null, tipo: 'ativa' };

  readonly raiz: HTMLElement;
  private readonly gaveta: HTMLElement;
  private readonly lista: HTMLOListElement;
  private readonly objetivos: HTMLUListElement;
  private readonly mensagem: HTMLElement;
  private readonly anuncio: HTMLElement;
  private readonly botoes: Record<'iniciar' | 'passo' | 'reiniciar' | 'apagar' | 'verJs' | 'velocidade', HTMLButtonElement>;

  constructor(
    private readonly fase: Fase,
    private readonly acoes: AcoesMesa,
    velocidadeInicial: number,
  ) {
    this.gaveta = el('div', { classe: 'gaveta', role: 'toolbar', rotulo: 'Blocos disponíveis', testid: 'gaveta' });
    this.lista = el('ol', { classe: 'algoritmo', rotulo: 'Seu algoritmo', testid: 'algoritmo' });
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
      apagar: botao('⌫', () => this.apagarUltima(), {
        classe: 'btn-apagar',
        testid: 'btn-apagar',
        rotulo: 'Apagar a última linha',
        title: 'Apagar a última linha',
      }),
      verJs: botao('{ } Ver em JavaScript', () => acoes.verJs(), { testid: 'btn-ver-js' }),
      velocidade: botao('', () => acoes.velocidade(), { testid: 'btn-velocidade' }),
    };
    this.mostrarVelocidade(velocidadeInicial);

    this.raiz = el(
      'section',
      { classe: 'mesa', rotulo: 'Mesa de Programação' },
      el(
        'div',
        { classe: 'mesa-topo' },
        botao('←', () => acoes.voltar(), { classe: 'botao-voltar', testid: 'btn-voltar', rotulo: 'Voltar para as fases' }),
        el('h2', { testid: 'titulo-fase' }, `Fase ${fase.id}: ${fase.titulo}`),
      ),
      this.objetivos,
      el('div', { classe: 'rotulo' }, 'Blocos (toque para colocar)'),
      this.gaveta,
      el('div', { classe: 'rotulo' }, 'Seu algoritmo (repete sem parar)'),
      this.lista,
      this.mensagem,
      el(
        'div',
        { classe: 'barra-acao' },
        this.botoes.iniciar,
        this.botoes.passo,
        this.botoes.reiniciar,
        this.botoes.apagar,
      ),
      el('div', { classe: 'barra-extra' }, this.botoes.verJs, this.botoes.velocidade),
      this.anuncio,
    );
    this.raiz.style.display = 'contents';
    this.raiz.addEventListener('keydown', (e) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && !this.travada()) {
        e.preventDefault();
        this.apagarUltima();
      }
    });
    this.desenhar();
  }

  // ------------------------------------------------------------ estado

  definirEstado(estado: EstadoMesa): void {
    this.estado = estado;
    this.atualizarBotoes();
  }

  mostrarVelocidade(v: number): void {
    this.botoes.velocidade.textContent = `⏩ Velocidade ${v}x`;
  }

  destacarLinha(linha: number | null, tipo: 'ativa' | 'erro' = 'ativa'): void {
    if (this.destaque.linha === linha && this.destaque.tipo === tipo) return;
    this.destaque = { linha, tipo };
    this.lista.querySelectorAll('li.ativa, li.erro').forEach((li) => li.classList.remove('ativa', 'erro'));
    if (linha === null) return;
    const li = this.lista.querySelector<HTMLLIElement>(`[data-testid="linha-${linha}"]`);
    if (!li) return;
    li.classList.add(tipo);
    li.scrollIntoView({ block: 'nearest' });
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

  // ------------------------------------------------------------ edição

  private travada(): boolean {
    return this.estado === 'rodando' || this.estado === 'passo' || this.estado === 'esperando';
  }

  private alterou(): void {
    this.destaque = { linha: null, tipo: 'ativa' };
    this.desenhar();
    this.acoes.editou();
  }

  private adicionar(linha: Linha): void {
    if (this.travada()) return;
    this.linhas.push(linha);
    this.anuncio.textContent = `Linha ${this.linhas.length}: ${linhaParaTexto(linha)}`;
    this.alterou();
  }

  apagarUltima(): void {
    if (this.travada()) return;
    if (this.rascunho) {
      this.rascunho = null;
    } else if (this.linhas.length > 0) {
      this.linhas.pop();
    } else {
      return;
    }
    this.anuncio.textContent = 'Última linha apagada';
    this.alterou();
  }

  private comecarSe(): void {
    if (this.travada()) return;
    const { condicoes, operadores } = this.fase.gaveta!;
    if (condicoes.length === 1 && operadores.length === 0) {
      this.adicionar({ tipo: 'SE', condicao: condicoes[0] });
      return;
    }
    this.rascunho = { condicao: null, operador: null };
    this.desenhar();
    (this.gaveta.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private escolherCondicao(c: Condicao): void {
    const r = this.rascunho;
    if (!r) return;
    if (r.condicao && r.operador) {
      r.condicao = logico(r.operador, r.condicao, c);
      r.operador = null;
    } else if (!r.condicao) {
      r.condicao = c;
    }
    this.desenhar();
  }

  private escolherOperador(op: OperadorLogico): void {
    const r = this.rascunho;
    if (!r?.condicao || r.operador) return;
    r.operador = op;
    this.desenhar();
  }

  private terminarSe(): void {
    const r = this.rascunho;
    if (!r?.condicao || r.operador) return;
    this.rascunho = null;
    this.adicionar({ tipo: 'SE', condicao: r.condicao });
  }

  // ------------------------------------------------------------ desenho

  private desenhar(): void {
    this.desenharGaveta();
    this.desenharLinhas();
    this.atualizarBotoes();
  }

  private desenharGaveta(): void {
    const g = this.fase.gaveta!;
    const r = this.rascunho;
    const blocos: HTMLButtonElement[] = [];

    if (r) {
      const precisaCondicao = !r.condicao || r.operador !== null;
      g.condicoes.forEach((c, i) => {
        const b = botao(condicaoParaTexto(c, 'bloco'), () => this.escolherCondicao(c), {
          classe: 'bloco logica',
          testid: `bloco-condicao-${i}`,
        });
        b.disabled = !precisaCondicao;
        blocos.push(b);
      });
      for (const op of g.operadores) {
        const b = botao(NOME_OPERADOR[op], () => this.escolherOperador(op), {
          classe: 'bloco logica',
          testid: `bloco-op-${NOME_OPERADOR[op].toLowerCase()}`,
        });
        b.disabled = precisaCondicao;
        blocos.push(b);
      }
      const pronto = botao('✓ pronto', () => this.terminarSe(), { classe: 'bloco controle', testid: 'bloco-pronto' });
      pronto.disabled = precisaCondicao;
      blocos.push(
        pronto,
        botao('✕ cancelar', () => this.apagarUltima(), { classe: 'bloco controle', testid: 'bloco-cancelar' }),
      );
    } else {
      if (g.condicoes.length > 0) {
        blocos.push(botao('se ( … ) {', () => this.comecarSe(), { classe: 'bloco se', testid: 'bloco-se' }));
      }
      for (const l of g.linhas) {
        blocos.push(
          botao(linhaParaTexto(l), () => this.adicionar(structuredClone(l)), {
            classe: `bloco ${categoria(l)}`,
            testid: testidDoBloco(l),
          }),
        );
      }
    }
    for (const b of blocos) if (this.travada()) b.disabled = true;
    this.gaveta.replaceChildren(...blocos);
  }

  private desenharLinhas(): void {
    const recuos = recuoDasLinhas(this.linhas);
    const itens = this.linhas.map((l, i) =>
      el(
        'li',
        { classe: categoria(l), testid: `linha-${i + 1}` },
        el('span', { style: `padding-left:${recuos[i] * 1.4}em` }, linhaParaTexto(l)),
      ),
    );
    if (this.rascunho) {
      const { condicao, operador } = this.rascunho;
      let texto = condicao ? condicaoParaTexto(condicao, 'bloco') : '…';
      if (operador) texto += ` ${NOME_OPERADOR[operador]} …`;
      // Recuo que uma linha nova teria no fim do algoritmo.
      const comNova = recuoDasLinhas([...this.linhas, { tipo: 'ABRIR', via: 'Norte' }]);
      const nivel = comNova[comNova.length - 1];
      itens.push(
        el(
          'li',
          { classe: 'se rascunho', testid: 'linha-rascunho' },
          el('span', { style: `padding-left:${nivel * 1.4}em` }, `se (${texto}) {`),
        ),
      );
    }
    if (itens.length === 0) {
      itens.push(el('li', { classe: 'vazio' }, 'Toque nos blocos acima para montar o seu algoritmo.'));
    }
    this.lista.replaceChildren(...itens);
    if (this.destaque.linha !== null) {
      const atual = this.destaque;
      this.destaque = { linha: null, tipo: 'ativa' };
      this.destacarLinha(atual.linha, atual.tipo);
    }
  }

  private atualizarBotoes(): void {
    const b = this.botoes;
    const vazio = this.linhas.length === 0;
    b.iniciar.disabled = vazio || this.estado === 'rodando' || this.rascunho !== null;
    b.passo.disabled = vazio || this.estado === 'esperando' || this.rascunho !== null;
    b.apagar.disabled = this.travada() || (vazio && !this.rascunho);
    b.reiniciar.disabled = false;
    this.gaveta.querySelectorAll('button').forEach((botaoGaveta) => {
      if (this.travada()) botaoGaveta.disabled = true;
    });
    if (!this.travada() && this.gaveta.querySelector('button:disabled') && !this.rascunho) {
      this.desenharGaveta();
    }
  }
}
