// Tipos da Árvore de Sintaxe (AST) do programa do jogador.
// O jogo NUNCA executa texto: tudo o que o jogador monta vira estes objetos,
// que o interpretador percorre.

export type Via = 'Norte' | 'Leste';
export const VIAS: readonly Via[] = ['Norte', 'Leste'];

export type Valor = number | boolean;

/** Variáveis que o cruzamento fornece (o jogador só lê). */
export const SENSORES = ['carrosNorte', 'carrosLeste', 'ambulanciaNorte', 'ambulanciaLeste'] as const;
export type Sensor = (typeof SENSORES)[number];

export type OperadorMatematico = '+' | '-' | '*';
export type Comparador = '>' | '<' | '==';
export type OperadorLogico = 'AND' | 'OR';

export type Expressao =
  | { tipo: 'NUM'; valor: number }
  | { tipo: 'BOOL'; valor: boolean }
  | { tipo: 'VAR'; nome: string }
  | { tipo: 'BIN'; op: OperadorMatematico; esq: Expressao; dir: Expressao };

export interface Comparacao {
  tipo: 'CMP';
  esq: Expressao;
  op: Comparador;
  dir: Expressao;
}

export interface CondicaoLogica {
  tipo: 'LOGICO';
  op: OperadorLogico;
  esq: Condicao;
  dir: Condicao;
}

export type Condicao = Comparacao | CondicaoLogica;

/** Número da linha (começando em 1) na Mesa de Programação. */
interface ComLinha {
  linha: number;
}

export interface AcaoSinal extends ComLinha {
  kind: 'ACTION';
  acao: 'ABRIR' | 'FECHAR';
  via: Via;
}

export interface AcaoEsperar extends ComLinha {
  kind: 'ACTION';
  acao: 'ESPERAR';
  /** Segundos de simulação: número fixo ou variável (ex.: tempoVerde). */
  duracao: Expressao;
}

export type InstrucaoAcao = AcaoSinal | AcaoEsperar;

export interface InstrucaoSe extends ComLinha {
  kind: 'IF';
  condicao: Condicao;
  entao: Instrucao[];
  senao?: Instrucao[];
}

export interface InstrucaoAtribuir extends ComLinha {
  kind: 'ASSIGN';
  variavel: string;
  valor: Expressao;
}

export type Instrucao = InstrucaoAcao | InstrucaoSe | InstrucaoAtribuir;

// Atalhos para montar expressões e condições (usados nas fases e nos testes).
export const num = (valor: number): Expressao => ({ tipo: 'NUM', valor });
export const bool = (valor: boolean): Expressao => ({ tipo: 'BOOL', valor });
export const variavel = (nome: string): Expressao => ({ tipo: 'VAR', nome });
export const bin = (op: OperadorMatematico, esq: Expressao, dir: Expressao): Expressao => ({
  tipo: 'BIN',
  op,
  esq,
  dir,
});
export const cmp = (esq: Expressao, op: Comparador, dir: Expressao): Comparacao => ({
  tipo: 'CMP',
  esq,
  op,
  dir,
});
export const logico = (op: OperadorLogico, esq: Condicao, dir: Condicao): CondicaoLogica => ({
  tipo: 'LOGICO',
  op,
  esq,
  dir,
});

export function ehSensor(nome: string): nome is Sensor {
  return (SENSORES as readonly string[]).includes(nome);
}
