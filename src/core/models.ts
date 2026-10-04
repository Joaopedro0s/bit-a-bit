export type Direction = 0 | 1 | 2 | 3; // 0=Dir, 1=Baixo, 2=Esq, 3=Cima

export interface Position {
  x: number;
  y: number;
  dir: Direction;
}

export interface Fase {
  id: number;
  conceito: string;
  dica: string;
  mapa: number[][]; // 0=Parede/Vazio, 1=Caminho, 2=Chip/Saída
  startPos: Position;
  chips: number;
  ideal: number;
  solucao: Instruction[];
}

export type Instruction = 'andar' | 'virar-esquerda' | 'virar-direita' | 'pegar';

export interface GameState {
  pos: Position;
  chipsColetados: number;
  mapa: number[][];
  status: 'playing' | 'win' | 'lose';
  erroIndex?: number;
}
