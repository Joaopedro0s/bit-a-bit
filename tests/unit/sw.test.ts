import { describe, expect, test } from 'vitest';
import { cachesParaApagar, chaveDoCache, deveTratar, nomeDoCache } from '../../src/sw/regras';

const RELEASE = 'https://exemplo.github.io/bit-a-bit/releases/abc1234/';
const HML = 'https://exemplo.github.io/bit-a-bit/hml/';

describe('Service Worker: o que ele trata', () => {
  test('trata só GET dentro da pasta da própria release', () => {
    expect(deveTratar('GET', `${RELEASE}`, RELEASE)).toBe(true);
    expect(deveTratar('GET', `${RELEASE}index.html?teste=1`, RELEASE)).toBe(true);
    expect(deveTratar('GET', `${RELEASE}version.json`, RELEASE)).toBe(true);
    expect(deveTratar('POST', `${RELEASE}index.html`, RELEASE)).toBe(false);
  });

  test('nunca trata o carregador da raiz nem o rollout.json (canário e rollback continuam funcionando)', () => {
    expect(deveTratar('GET', 'https://exemplo.github.io/bit-a-bit/', RELEASE)).toBe(false);
    expect(deveTratar('GET', 'https://exemplo.github.io/bit-a-bit/index.html', RELEASE)).toBe(false);
    expect(deveTratar('GET', 'https://exemplo.github.io/bit-a-bit/rollout.json', RELEASE)).toBe(false);
    expect(deveTratar('GET', `${RELEASE}rollout.json`, RELEASE)).toBe(false);
    expect(deveTratar('GET', `${RELEASE}sw.js`, RELEASE)).toBe(false);
  });

  test('não trata outras releases, outros sites nem URLs inválidas', () => {
    expect(deveTratar('GET', 'https://exemplo.github.io/bit-a-bit/releases/def5678/', RELEASE)).toBe(false);
    expect(deveTratar('GET', `${HML}index.html`, RELEASE)).toBe(false);
    expect(deveTratar('GET', 'https://outro.site/bit-a-bit/releases/abc1234/', RELEASE)).toBe(false);
    expect(deveTratar('GET', 'não é url', RELEASE)).toBe(false);
  });
});

describe('Service Worker: caches', () => {
  test('o nome do cache leva a pasta e a versão', () => {
    expect(nomeDoCache(HML, 'abc1234-0.2.0')).toBe(`sinal-aberto|${HML}|abc1234-0.2.0`);
  });

  test('ao atualizar, apaga só os caches antigos da mesma pasta', () => {
    const nomes = [
      nomeDoCache(HML, 'velho'),
      nomeDoCache(HML, 'novo'),
      nomeDoCache(RELEASE, 'abc1234'),
      'outro-cache-qualquer',
    ];
    expect(cachesParaApagar(nomes, HML, 'novo')).toEqual([nomeDoCache(HML, 'velho')]);
  });

  test('navegação (com ou sem ?teste=1) usa a página guardada da pasta', () => {
    expect(chaveDoCache(`${HML}?teste=1`, true, HML)).toBe(HML);
    expect(chaveDoCache(`${HML}version.json`, false, HML)).toBe(`${HML}version.json`);
  });
});
