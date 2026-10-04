import { expect, test, describe, beforeEach } from 'vitest';
import { Interpreter, calcEstrelas } from '../../src/core/interpreter';
import { GameState } from '../../src/core/models';

describe('Interpreter', () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = {
      pos: { x: 1, y: 1, dir: 0 },
      chipsColetados: 0,
      mapa: [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 2, 0],
        [0, 0, 0, 0]
      ],
      status: 'playing'
    };
  });

  test('andar para a direita', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.step('andar', 0);
    expect(interpreter.state.pos).toEqual({ x: 2, y: 1, dir: 0 });
    expect(interpreter.state.status).toBe('playing');
  });

  test('virar para a direita (0 -> 1)', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.step('virar-direita', 0);
    expect(interpreter.state.pos.dir).toBe(1);
  });

  test('virar para a esquerda (0 -> 3)', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.step('virar-esquerda', 0);
    expect(interpreter.state.pos.dir).toBe(3);
  });

  test('colisão com parede', () => {
    initialState.pos.dir = 3; // Cima
    const interpreter = new Interpreter(initialState);
    interpreter.step('andar', 0);
    expect(interpreter.state.status).toBe('lose');
    expect(interpreter.state.erroIndex).toBe(0);
  });

  test('sair da grade', () => {
    initialState.pos = { x: 3, y: 3, dir: 1 };
    const interpreter = new Interpreter(initialState);
    interpreter.step('andar', 0);
    expect(interpreter.state.status).toBe('lose');
  });

  test('pegar sem chip', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.step('pegar', 0);
    expect(interpreter.state.status).toBe('lose');
  });

  test('pegar com chip', () => {
    initialState.pos = { x: 2, y: 2, dir: 0 };
    const interpreter = new Interpreter(initialState);
    interpreter.step('pegar', 0);
    expect(interpreter.state.chipsColetados).toBe(1);
    expect(interpreter.state.mapa[2][2]).toBe(1);
  });

  test('vitória - completou chips e rodou tudo', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.run(['virar-direita', 'andar', 'virar-esquerda', 'andar', 'pegar'], 1);
    expect(interpreter.state.status).toBe('win');
  });

  test('derrota por chip faltando', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.run(['virar-direita', 'andar', 'virar-esquerda', 'andar'], 1);
    expect(interpreter.state.status).toBe('lose');
  });

  test('limite de passos execede', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.maxPassos = 2;
    interpreter.run(['andar', 'andar', 'andar'], 0);
    expect(interpreter.state.status).toBe('lose');
  });

  test('virar 4 vezes direita volta ao 0', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.run(['virar-direita', 'virar-direita', 'virar-direita', 'virar-direita'], 0);
    expect(interpreter.state.pos.dir).toBe(0);
  });

  test('virar 4 vezes esquerda volta ao 0', () => {
    const interpreter = new Interpreter(initialState);
    interpreter.run(['virar-esquerda', 'virar-esquerda', 'virar-esquerda', 'virar-esquerda'], 0);
    expect(interpreter.state.pos.dir).toBe(0);
  });
  
  test('andar para esquerda', () => {
    initialState.pos = { x: 2, y: 1, dir: 2 };
    const interpreter = new Interpreter(initialState);
    interpreter.step('andar', 0);
    expect(interpreter.state.pos).toEqual({ x: 1, y: 1, dir: 2 });
  });

  test('step no estado diferente de playing', () => {
    initialState.status = 'win';
    const interpreter = new Interpreter(initialState);
    interpreter.step('andar', 0);
    expect(interpreter.state.pos.x).toBe(1); // Não andou
  });

});

describe('calcEstrelas', () => {
  test('ideal', () => {
    expect(calcEstrelas(5, 5)).toBe(3);
  });
  test('ideal-1', () => {
    expect(calcEstrelas(4, 5)).toBe(3);
  });
  test('ideal+1', () => {
    expect(calcEstrelas(6, 5)).toBe(2);
  });
  test('ideal+2', () => {
    expect(calcEstrelas(7, 5)).toBe(2);
  });
  test('ideal+3', () => {
    expect(calcEstrelas(8, 5)).toBe(1);
  });
});
