// Converte o programa do jogador em texto: o texto dos blocos (em português)
// e JavaScript de verdade (botão "{ } Ver em JavaScript"). Só gera texto; nunca executa.

import type { Condicao, Expressao, Instrucao, OperadorMatematico } from './ast';
import type { Linha } from './programa';

export type Dialeto = 'bloco' | 'js';

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
  saida.push('// O cruzamento repete este código enquanto a fase durar.');
  saida.push('while (true) {');
  saida.push(...instrucoesJs(programa, '  '));
  saida.push('}');
  return saida.join('\n');
}
