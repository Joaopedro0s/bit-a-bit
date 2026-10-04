import { expect, test, describe } from 'vitest';
import Ajv from 'ajv';
import fases from '../../src/content/fases.json';
import schema from '../../src/content/schema.json';
import { Interpreter } from '../../src/core/interpreter';
import { Fase, GameState } from '../../src/core/models';

describe('Fases Integration', () => {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  test('fases.json é válido de acordo com o schema', () => {
    const valid = validate(fases);
    if (!valid) console.log(validate.errors);
    expect(valid).toBe(true);
  });

  test('JSON inválido falha na validação do schema', () => {
    const invalidFases = [{
      id: "wrong-id",
      conceito: "Teste"
    }];
    const valid = validate(invalidFases);
    expect(valid).toBe(false);
  });

  test('toda fase tem uma solução de referência no JSON que vence no interpretador', () => {
    fases.forEach((faseObj: unknown) => {
      const fase: Fase = faseObj as Fase;
      const initialState: GameState = {
        pos: { ...fase.startPos },
        chipsColetados: 0,
        mapa: JSON.parse(JSON.stringify(fase.mapa)),
        status: 'playing'
      };
      
      const interpreter = new Interpreter(initialState);
      interpreter.run(fase.solucao, fase.chips);
      
      expect(interpreter.state.status).toBe('win');
    });
  });
});
