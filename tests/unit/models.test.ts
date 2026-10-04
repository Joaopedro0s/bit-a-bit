import { expect, test } from 'vitest';
import { calcEstrelas } from '../../src/core/interpreter';

test('calcEstrelas deve retornar o número correto de estrelas', () => {
  expect(calcEstrelas(2, 2)).toBe(3);
  expect(calcEstrelas(4, 2)).toBe(2);
  expect(calcEstrelas(5, 2)).toBe(1);
});
