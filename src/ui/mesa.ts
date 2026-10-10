// Mesa de Programação (fases 1 a 4): gaveta de blocos e linhas do algoritmo.
// A Mesa só cuida da edição e da aparência; quem roda a simulação é a cena.

import { clique } from '../audio';
import { logico, type Condicao, type Expressao, type OperadorLogico } from '../core/ast';
import type { Fase } from '../core/fases';
import { condicaoParaTexto, linhaParaTexto } from '../core/gerarJs';
import { recuoDasLinhas, type Linha } from '../core/programa';
import { botao, el } from './dom';
import { PainelFase, type AcoesPainel } from './painelFase';

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

export class Mesa extends PainelFase {
  readonly linhas: Linha[] = [];
  private rascunho: Rascunho | null = null;
  private readonly gaveta: HTMLElement;
  private readonly lista: HTMLOListElement;

  constructor(fase: Fase, acoes: AcoesPainel, velocidadeInicial: number) {
    super(fase, acoes, velocidadeInicial);
    this.gaveta = el('div', { classe: 'gaveta', role: 'toolbar', rotulo: 'Blocos disponíveis', testid: 'gaveta' });
    this.lista = el('ol', { classe: 'algoritmo', rotulo: 'Seu algoritmo', testid: 'algoritmo' });
    this.montar(
      el('div', { classe: 'rotulo' }, 'Blocos (toque para colocar)'),
      this.gaveta,
      el('div', { classe: 'rotulo' }, 'Seu algoritmo (repete sem parar)'),
      this.lista,
    );
    this.raiz.addEventListener('keydown', (e) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && !this.travada()) {
        e.preventDefault();
        this.apagar();
      }
    });

    this.lista.ondragover = (e) => {
      if (this.travada()) return;
      e.preventDefault();
    };
    this.lista.ondrop = (e) => {
      if (this.travada()) return;
      const alvo = e.target as HTMLElement;
      // Se dropou na lista e não num `li` específico (ex: final da lista ou lista vazia)
      if (alvo === this.lista || alvo.classList.contains('vazio')) {
        e.preventDefault();
        const deStr = e.dataTransfer?.getData('text/plain');
        if (!deStr) return;
        if (deStr.startsWith('gaveta:')) {
          const idxGaveta = parseInt(deStr.split(':')[1], 10);
          this.adicionar(structuredClone(fase.gaveta!.linhas[idxGaveta]));
        } else {
          const de = parseInt(deStr, 10);
          if (!isNaN(de)) {
            const [removida] = this.linhas.splice(de, 1);
            this.linhas.push(removida);
            clique();
            this.alterou();
          }
        }
      }
    };

    this.desenhar();
  }

  protected areaDasLinhas(): HTMLElement {
    return this.lista;
  }

  protected podeRodar(): boolean {
    return this.linhas.length > 0 && this.rascunho === null;
  }

  // ------------------------------------------------------------ edição

  private alterou(): void {
    this.esquecerDestaque();
    this.desenhar();
    this.acoes.editou();
  }

  private adicionar(linha: Linha): void {
    if (this.travada()) return;
    this.linhas.push(linha);
    clique();
    this.anuncio.textContent = `Linha ${this.linhas.length}: ${linhaParaTexto(linha)}`;
    this.alterou();
  }

  protected apagar(): void {
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

  private apagarLinha(indice: number): void {
    if (this.travada()) return;
    this.linhas.splice(indice, 1);
    this.anuncio.textContent = `Linha ${indice + 1} apagada`;
    this.alterou();
  }

  private comecarSe(): void {
    if (this.travada()) return;
    const { condicoes, operadores } = this.fase.gaveta!;
    if (condicoes.length === 1 && operadores.length === 0) {
      this.adicionar({ tipo: 'SE', condicao: condicoes[0] });
      return;
    }
    clique();
    this.rascunho = { condicao: null, operador: null };
    this.anuncio.textContent = 'Escolha a condição do se';
    this.desenhar();
    this.gaveta.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
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
    clique();
    this.desenhar();
  }

  private escolherOperador(op: OperadorLogico): void {
    const r = this.rascunho;
    if (!r?.condicao || r.operador) return;
    r.operador = op;
    clique();
    this.desenhar();
  }

  private terminarSe(): void {
    const r = this.rascunho;
    if (!r?.condicao || r.operador) return;
    this.rascunho = null;
    this.adicionar({ tipo: 'SE', condicao: r.condicao });
  }

  // ------------------------------------------------------------ desenho

  protected atualizarBotoes(): void {
    super.atualizarBotoes();
    this.botoes.apagar.disabled = this.travada() || (this.linhas.length === 0 && !this.rascunho);
    if (this.gaveta) this.desenharGaveta();
  }

  /** Redesenha as linhas e (via atualizarBotoes) a gaveta. */
  private desenhar(): void {
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
        botao('✕ cancelar', () => this.apagar(), { classe: 'bloco controle', testid: 'bloco-cancelar' }),
      );
    } else {
      if (g.condicoes.length > 0) {
        blocos.push(botao('se ( … ) {', () => this.comecarSe(), { classe: 'bloco se', testid: 'bloco-se' }));
      }
      for (let i = 0; i < g.linhas.length; i++) {
        const l = g.linhas[i];
        const btn = botao(linhaParaTexto(l), () => this.adicionar(structuredClone(l)), {
          classe: `bloco ${categoria(l)}`,
          testid: testidDoBloco(l),
        });
        if (!this.travada()) {
          btn.draggable = true;
          btn.ondragstart = (e) => {
            e.dataTransfer!.effectAllowed = 'copy';
            e.dataTransfer!.setData('text/plain', `gaveta:${i}`);
          };
        }
        blocos.push(btn);
      }
    }
    if (this.travada()) for (const b of blocos) b.disabled = true;
    // Mantém o foco do teclado no mesmo bloco depois de redesenhar.
    const focado = (document.activeElement as HTMLElement | null)?.dataset?.testid;
    this.gaveta.replaceChildren(...blocos);
    if (focado) this.gaveta.querySelector<HTMLButtonElement>(`[data-testid="${focado}"]`)?.focus();
  }

  private desenharLinhas(): void {
    const recuos = recuoDasLinhas(this.linhas);
    const itens = this.linhas.map((l, i) => {
      const li = el(
        'li',
        { classe: categoria(l), testid: `linha-${i + 1}` },
        el('span', { style: `padding-left:${recuos[i] * 1.4}em` }, linhaParaTexto(l)),
      );
      if (!this.travada()) {
        li.draggable = true;
        li.ondragstart = (e) => {
          e.dataTransfer!.effectAllowed = 'move';
          e.dataTransfer!.setData('text/plain', i.toString());
          li.classList.add('arrastando');
        };
        li.ondragend = () => li.classList.remove('arrastando');
        li.ondragover = (e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = 'move';
          li.classList.add('alvo-drop');
        };
        li.ondragleave = () => li.classList.remove('alvo-drop');
        li.ondrop = (e) => {
          e.preventDefault();
          e.stopPropagation(); // Evita que caia na lista também
          li.classList.remove('alvo-drop');
          const deStr = e.dataTransfer?.getData('text/plain');
          if (!deStr) return;
          if (deStr.startsWith('gaveta:')) {
            const idxGaveta = parseInt(deStr.split(':')[1], 10);
            this.linhas.splice(i, 0, structuredClone(this.fase.gaveta!.linhas[idxGaveta]));
            clique();
            this.alterou();
          } else {
            const de = parseInt(deStr, 10);
            if (de !== i && !isNaN(de)) {
              const [removida] = this.linhas.splice(de, 1);
              this.linhas.splice(i, 0, removida);
              clique();
              this.alterou();
            }
          }
        };

        const btnApagar = botao('✕', () => this.apagarLinha(i), {
          classe: 'btn-apagar-linha',
          rotulo: `Apagar linha ${i + 1}`,
        });
        li.appendChild(btnApagar);
      }
      return li;
    });
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
    this.reaplicarDestaque();
  }
}
