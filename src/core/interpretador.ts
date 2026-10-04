// Interpretador da AST, sem eval(): percorre os objetos e devolve "efeitos"
// (abrir/fechar sinal, esperar...) para a simulação aplicar.
// Executa UMA instrução por chamada de `passo`, o que permite o Passo a Passo.
// Quando o programa acaba, volta para a linha 1 (ciclo contínuo).

import type { Comparacao, Condicao, Expressao, Instrucao, Valor, Via } from './ast';
import { ehSensor } from './ast';
import { ErroPrograma } from './programa';

export type LerVariavel = (nome: string) => Valor | undefined;

export type Efeito =
  | { tipo: 'ABRIR' | 'FECHAR'; via: Via; linha: number }
  | { tipo: 'ESPERAR'; segundos: number; linha: number }
  | { tipo: 'SE'; resultado: boolean; linha: number }
  | { tipo: 'ATRIBUIR'; variavel: string; valor: Valor; linha: number };

const nomeDoValor = (v: Valor): string =>
  typeof v === 'boolean' ? (v ? 'verdadeiro' : 'falso') : String(v);

function lerOuFalhar(nome: string, ler: LerVariavel, linha: number | null): Valor {
  const valor = ler(nome);
  if (valor === undefined) {
    throw new ErroPrograma(
      `A variável "${nome}" ainda não tem valor. Dê um valor a ela antes de usar.`,
      linha,
    );
  }
  return valor;
}

function exigirNumero(v: Valor, linha: number | null): number {
  if (typeof v !== 'number') {
    throw new ErroPrograma(
      `Aqui precisa de um número, mas apareceu "${nomeDoValor(v)}".`,
      linha,
    );
  }
  return v;
}

export function avaliarExpressao(e: Expressao, ler: LerVariavel, linha: number | null = null): Valor {
  switch (e.tipo) {
    case 'NUM':
    case 'BOOL':
      return e.valor;
    case 'VAR':
      return lerOuFalhar(e.nome, ler, linha);
    case 'BIN': {
      const a = exigirNumero(avaliarExpressao(e.esq, ler, linha), linha);
      const b = exigirNumero(avaliarExpressao(e.dir, ler, linha), linha);
      if (e.op === '+') return a + b;
      if (e.op === '-') return a - b;
      return a * b;
    }
  }
}

function avaliarComparacao(c: Comparacao, ler: LerVariavel, linha: number | null): boolean {
  const a = avaliarExpressao(c.esq, ler, linha);
  const b = avaliarExpressao(c.dir, ler, linha);
  if (c.op === '==') return a === b;
  const x = exigirNumero(a, linha);
  const y = exigirNumero(b, linha);
  return c.op === '>' ? x > y : x < y;
}

export function avaliarCondicao(c: Condicao, ler: LerVariavel, linha: number | null = null): boolean {
  if (c.tipo === 'CMP') return avaliarComparacao(c, ler, linha);
  const esq = avaliarCondicao(c.esq, ler, linha);
  // Avalia os dois lados (sem "atalho") para erros aparecerem sempre do mesmo jeito.
  const dir = avaliarCondicao(c.dir, ler, linha);
  return c.op === 'AND' ? esq && dir : esq || dir;
}

interface Quadro {
  bloco: readonly Instrucao[];
  indice: number;
}

export class Interpretador {
  /** Variáveis criadas pelo jogador (ex.: tempoVerde). */
  readonly variaveis = new Map<string, Valor>();
  private pilha: Quadro[] = [];

  constructor(private readonly programa: readonly Instrucao[]) {
    this.reiniciar();
  }

  get vazio(): boolean {
    return this.programa.length === 0;
  }

  reiniciar(): void {
    this.variaveis.clear();
    this.pilha = [{ bloco: this.programa, indice: 0 }];
  }

  /** Lê primeiro as variáveis do jogador e depois os sensores do cruzamento. */
  lerCom(sensores: (nome: string) => Valor | undefined): LerVariavel {
    return (nome) => {
      if (this.variaveis.has(nome)) return this.variaveis.get(nome);
      return ehSensor(nome) ? sensores(nome) : undefined;
    };
  }

  /** Próxima instrução a executar (descendo/voltando ao início se preciso). */
  private proxima(): Instrucao | null {
    if (this.vazio) return null;
    for (;;) {
      const topo = this.pilha[this.pilha.length - 1];
      if (topo.indice < topo.bloco.length) return topo.bloco[topo.indice];
      if (this.pilha.length > 1) {
        this.pilha.pop();
      } else {
        topo.indice = 0; // fim do programa: volta para a linha 1
      }
    }
  }

  /** Linha que será executada no próximo passo (para destacar na Mesa). */
  proximaLinha(): number | null {
    return this.proxima()?.linha ?? null;
  }

  /** Executa uma instrução. Devolve `null` se o programa estiver vazio. */
  passo(sensores: (nome: string) => Valor | undefined): Efeito | null {
    const no = this.proxima();
    if (!no) return null;
    const topo = this.pilha[this.pilha.length - 1];
    topo.indice++;
    const ler = this.lerCom(sensores);

    switch (no.kind) {
      case 'ACTION':
        if (no.acao === 'ESPERAR') {
          const segundos = exigirNumero(avaliarExpressao(no.duracao, ler, no.linha), no.linha);
          if (segundos < 0) {
            throw new ErroPrograma('O tempo de espera não pode ser negativo.', no.linha);
          }
          return { tipo: 'ESPERAR', segundos, linha: no.linha };
        }
        return { tipo: no.acao, via: no.via, linha: no.linha };
      case 'ASSIGN': {
        const valor = avaliarExpressao(no.valor, ler, no.linha);
        this.variaveis.set(no.variavel, valor);
        return { tipo: 'ATRIBUIR', variavel: no.variavel, valor, linha: no.linha };
      }
      case 'IF': {
        const resultado = avaliarCondicao(no.condicao, ler, no.linha);
        const ramo = resultado ? no.entao : no.senao;
        if (ramo && ramo.length > 0) this.pilha.push({ bloco: ramo, indice: 0 });
        return { tipo: 'SE', resultado, linha: no.linha };
      }
    }
  }
}
