// Gerador de números aleatórios com semente (mulberry32).
// Mesma semente => mesma sequência, para a simulação e os testes serem reproduzíveis.

export interface Rng {
  /** Número em [0, 1). */
  proximo(): number;
  /** Inteiro em [min, max] (inclusive). */
  inteiro(min: number, max: number): number;
}

export function criarRng(semente: number): Rng {
  let estado = semente >>> 0;

  const proximo = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    proximo,
    inteiro: (min, max) => min + Math.floor(proximo() * (max - min + 1)),
  };
}
