// Converte o programa do jogador em texto: o texto dos blocos (em português)
// e JavaScript de verdade (botão "{ } Ver em JavaScript"). Só gera texto; nunca executa.

import type { Condicao, Expressao, Instrucao, OperadorMatematico } from './ast';
import { recuoDasLinhas, type Linha } from './programa';

export type Dialeto = 'bloco' | 'js';

const COMENTARIO_LOOP = '// O cruzamento repete este código enquanto a fase durar.';

const PRECEDENCIA: Record<OperadorMatematico, number> = { '+': 1, '-': 1, '*': 2 };

const textoValor = (v: number | boolean, d: Dialeto): string => {
  if (typeof v === 'number') return String(v);
  if (d === 'js') return v ? 'true' : 'false';
  return v ? 'verdadeiro' : 'falso';
};

export function expressaoParaTexto(e: Expressao, d: Dialeto = 'js'): string {
  switch (e.tipo) {
    case 'NUM':
    case 'BOOL':
      return textoValor(e.valor, d);
    case 'VAR':
      return e.nome;
    case 'BIN': {
      const p = PRECEDENCIA[e.op];
      const lado = (filho: Expressao, direita: boolean): string => {
        const texto = expressaoParaTexto(filho, d);
        if (filho.tipo !== 'BIN') return texto;
        const pf = PRECEDENCIA[filho.op];
        const precisa = pf < p || (direita && pf === p && e.op === '-');
        return precisa ? `(${texto})` : texto;
      };
      return `${lado(e.esq, false)} ${e.op} ${lado(e.dir, true)}`;
    }
  }
}

export function condicaoParaTexto(c: Condicao, d: Dialeto = 'js'): string {
  if (c.tipo === 'CMP') {
    const op = c.op === '==' && d === 'js' ? '===' : c.op;
    return `${expressaoParaTexto(c.esq, d)} ${op} ${expressaoParaTexto(c.dir, d)}`;
  }
  const op = d === 'js' ? (c.op === 'AND' ? '&&' : '||') : c.op === 'AND' ? 'E' : 'OU';
  const lado = (filho: Condicao): string => {
    const texto = condicaoParaTexto(filho, d);
    return filho.tipo === 'LOGICO' && filho.op !== c.op ? `(${texto})` : texto;
  };
  return `${lado(c.esq)} ${op} ${lado(c.dir)}`;
}

/** Texto de uma linha da Mesa de Programação. */
export function linhaParaTexto(l: Linha): string {
  switch (l.tipo) {
    case 'ABRIR':
      return `abrirSinal("${l.via}")`;
    case 'FECHAR':
      return `fecharSinal("${l.via}")`;
    case 'ESPERAR':
      return `esperar(${expressaoParaTexto(l.duracao, 'bloco')})`;
    case 'ATRIBUIR':
      return `${l.variavel} = ${expressaoParaTexto(l.valor, 'bloco')}`;
    case 'SE':
      return `se (${condicaoParaTexto(l.condicao, 'bloco')}) {`;
    case 'SENAO':
      return '} senão {';
    case 'FIM':
      return '}';
  }
}

function variaveisAtribuidas(programa: readonly Instrucao[], nomes = new Set<string>()): Set<string> {
  for (const no of programa) {
    if (no.kind === 'ASSIGN') nomes.add(no.variavel);
    if (no.kind === 'IF') {
      variaveisAtribuidas(no.entao, nomes);
      variaveisAtribuidas(no.senao ?? [], nomes);
    }
  }
  return nomes;
}

function instrucoesJs(programa: readonly Instrucao[], recuo: string): string[] {
  const linhas: string[] = [];
  for (const no of programa) {
    switch (no.kind) {
      case 'ACTION':
        if (no.acao === 'ESPERAR') {
          linhas.push(`${recuo}esperar(${expressaoParaTexto(no.duracao)});`);
        } else {
          const funcao = no.acao === 'ABRIR' ? 'abrirSinal' : 'fecharSinal';
          linhas.push(`${recuo}${funcao}("${no.via}");`);
        }
        break;
      case 'ASSIGN':
        linhas.push(`${recuo}${no.variavel} = ${expressaoParaTexto(no.valor)};`);
        break;
      case 'IF':
        linhas.push(`${recuo}if (${condicaoParaTexto(no.condicao)}) {`);
        linhas.push(...instrucoesJs(no.entao, recuo + '  '));
        if (no.senao) {
          linhas.push(`${recuo}} else {`);
          linhas.push(...instrucoesJs(no.senao, recuo + '  '));
        }
        linhas.push(`${recuo}}`);
        break;
    }
  }
  return linhas;
}

/**
 * JavaScript equivalente ao programa. O controlador repete o programa
 * enquanto a fase dura, por isso ele fica dentro de um `while (true)`.
 */
export function gerarJs(programa: readonly Instrucao[]): string {
  const saida: string[] = [];
  const nomes = [...variaveisAtribuidas(programa)];
  if (nomes.length > 0) {
    saida.push(...nomes.map((n) => `let ${n};`), '');
  }
  saida.push(COMENTARIO_LOOP);
  saida.push('while (true) {');
  saida.push(...instrucoesJs(programa, '  '));
  saida.push('}');
  return saida.join('\n');
}

// ---------------------------------------------------------------------------
// JavaScript "marcado" para a fase 5: o mesmo texto do gerarJs, mas cada pedaço
// editável sabe onde fica nas linhas (caminho), para virar um botão tocável.

export type Caminho = (string | number)[];

export interface Segmento {
  texto: string;
  /** id do token editável, se este pedaço puder ser trocado pelo jogador. */
  token?: string;
}

export interface LinhaDeCodigo {
  /** Número da linha na Mesa (1, 2, ...) ou null para cabeçalho/rodapé. */
  linha: number | null;
  segmentos: Segmento[];
}

class Montador {
  segmentos: Segmento[] = [];
  constructor(private readonly tokens: ReadonlyMap<string, string>) {}

  texto(t: string): this {
    const ultimo = this.segmentos[this.segmentos.length - 1];
    if (ultimo && !ultimo.token) ultimo.texto += t;
    else this.segmentos.push({ texto: t });
    return this;
  }

  valor(caminho: Caminho, t: string): this {
    const token = this.tokens.get(JSON.stringify(caminho));
    if (!token) return this.texto(t);
    this.segmentos.push({ texto: t, token });
    return this;
  }

  expressao(e: Expressao, c: Caminho, precedenciaPai = 0, direita = false, opPai?: OperadorMatematico): this {
    switch (e.tipo) {
      case 'NUM':
      case 'BOOL':
        return this.valor([...c, 'valor'], textoValor(e.valor, 'js'));
      case 'VAR':
        return this.valor([...c, 'nome'], e.nome);
      case 'BIN': {
        const p = PRECEDENCIA[e.op];
        const parenteses = p < precedenciaPai || (direita && p === precedenciaPai && opPai === '-');
        if (parenteses) this.texto('(');
        this.expressao(e.esq, [...c, 'esq'], p, false, e.op);
        this.texto(` ${e.op} `);
        this.expressao(e.dir, [...c, 'dir'], p, true, e.op);
        if (parenteses) this.texto(')');
        return this;
      }
    }
  }

  condicao(cond: Condicao, c: Caminho, opPai?: string): this {
    if (cond.tipo === 'CMP') {
      this.expressao(cond.esq, [...c, 'esq']).texto(' ');
      this.valor([...c, 'op'], cond.op === '==' ? '===' : cond.op);
      return this.texto(' ').expressao(cond.dir, [...c, 'dir']);
    }
    const parenteses = opPai !== undefined && opPai !== cond.op;
    if (parenteses) this.texto('(');
    this.condicao(cond.esq, [...c, 'esq'], cond.op);
    this.texto(cond.op === 'AND' ? ' && ' : ' || ');
    this.condicao(cond.dir, [...c, 'dir'], cond.op);
    if (parenteses) this.texto(')');
    return this;
  }
}

/** Mesmo JavaScript do `gerarJs`, separado em linhas e com os tokens editáveis marcados. */
export function gerarJsMarcado(
  linhas: readonly Linha[],
  tokens: readonly { id: string; caminho: Caminho }[] = [],
): LinhaDeCodigo[] {
  const mapa = new Map(tokens.map((t) => [JSON.stringify(t.caminho), t.id]));
  const recuos = recuoDasLinhas(linhas);
  const fixa = (texto: string): LinhaDeCodigo => ({ linha: null, segmentos: [{ texto }] });
  const saida: LinhaDeCodigo[] = [];

  const nomes = [...new Set(linhas.flatMap((l) => (l.tipo === 'ATRIBUIR' ? [l.variavel] : [])))];
  if (nomes.length > 0) saida.push(...nomes.map((n) => fixa(`let ${n};`)), fixa(''));
  saida.push(fixa(COMENTARIO_LOOP), fixa('while (true) {'));

  linhas.forEach((l, i) => {
    const m = new Montador(mapa).texto('  '.repeat(recuos[i] + 1));
    switch (l.tipo) {
      case 'ABRIR':
      case 'FECHAR':
        m.texto(`${l.tipo === 'ABRIR' ? 'abrirSinal' : 'fecharSinal'}("`).valor([i, 'via'], l.via).texto('");');
        break;
      case 'ESPERAR':
        m.texto('esperar(').expressao(l.duracao, [i, 'duracao']).texto(');');
        break;
      case 'ATRIBUIR':
        m.texto(`${l.variavel} = `).expressao(l.valor, [i, 'valor']).texto(';');
        break;
      case 'SE':
        m.texto('if (').condicao(l.condicao, [i, 'condicao']).texto(') {');
        break;
      case 'SENAO':
        m.texto('} else {');
        break;
      case 'FIM':
        m.texto('}');
        break;
    }
    saida.push({ linha: i + 1, segmentos: m.segmentos });
  });
  saida.push(fixa('}'));
  return saida;
}
