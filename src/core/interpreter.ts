import { GameState, Instruction } from './models';

export class Interpreter {
  state: GameState;
  maxPassos: number = 100;

  constructor(initialState: GameState) {
    this.state = JSON.parse(JSON.stringify(initialState)); // deep copy
  }

  step(instruction: Instruction, index: number) {
    if (this.state.status !== 'playing') return;

    let { x, y, dir } = this.state.pos;

    if (instruction === 'virar-esquerda') {
      dir = (dir + 3) % 4 as 0 | 1 | 2 | 3;
    } else if (instruction === 'virar-direita') {
      dir = (dir + 1) % 4 as 0 | 1 | 2 | 3;
    } else if (instruction === 'andar') {
      if (dir === 0) x++;
      if (dir === 1) y++;
      if (dir === 2) x--;
      if (dir === 3) y--;
    } else if (instruction === 'pegar') {
      if (this.state.mapa[y] && this.state.mapa[y][x] === 2) {
        this.state.chipsColetados++;
        this.state.mapa[y][x] = 1; // chip coletado
      } else {
        this.state.status = 'lose';
        this.state.erroIndex = index;
        return;
      }
    }

    // Limites da grade e colisões
    if (y < 0 || y >= this.state.mapa.length || x < 0 || x >= this.state.mapa[y].length || this.state.mapa[y][x] === 0) {
      this.state.status = 'lose';
      this.state.erroIndex = index;
    }

    this.state.pos = { x, y, dir };
  }

  run(program: Instruction[], totalChips: number): GameState {
    if (program.length > this.maxPassos) {
      this.state.status = 'lose';
      return this.state;
    }
    for (let i = 0; i < program.length; i++) {
      this.step(program[i], i);
      if (this.state.status !== 'playing') break;
    }

    if (this.state.status === 'playing') {
      if (this.state.chipsColetados === totalChips) {
        this.state.status = 'win';
      } else {
        this.state.status = 'lose';
      }
    }

    return this.state;
  }
}

export function calcEstrelas(blocosUsados: number, ideal: number): number {
  if (blocosUsados <= ideal) return 3;
  if (blocosUsados <= ideal + 2) return 2;
  return 1;
}
