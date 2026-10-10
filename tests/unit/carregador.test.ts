import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const htmlPath = path.resolve(__dirname, '../../pages/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
  throw new Error('Script não encontrado em pages/index.html');
}
const scriptCode = scriptMatch[1];

describe('Lógica de escolha de versão em pages/index.html', () => {
  let mockMsgElement: { innerText: string };
  let mockLocation: { href: string };
  let mockLocalStorageData: Record<string, string>;
  let mockLocalStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, val: string) => void;
  };
  let originalFetch: typeof globalThis.fetch;
  let originalMathRandom: typeof Math.random;

  beforeEach(() => {
    mockMsgElement = { innerText: '' };
    mockLocation = { href: '' };
    mockLocalStorageData = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => mockLocalStorageData[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockLocalStorageData[key] = val;
      }),
    };
    originalFetch = globalThis.fetch;
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Math.random = originalMathRandom;
    vi.restoreAllMocks();
  });

  async function executarCarregador() {
    const mockDocument = {
      getElementById: vi.fn((id: string) => {
        if (id === 'msg') return mockMsgElement;
        return null;
      }),
    };

    // Substitui a chamada final init() por return init() para podermos dar await na Promise retornada
    const codeToRun = scriptCode.replace(/init\(\);?\s*$/, 'return init();');

    const fn = new Function(
      'window',
      'document',
      'fetch',
      'localStorage',
      'Math',
      'console',
      codeToRun,
    );

    await fn(
      { location: mockLocation },
      mockDocument,
      globalThis.fetch,
      mockLocalStorage,
      Math,
      { error: () => {} },
    );
  }

  test('sem canário -> escolhe versão estável', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: 'v1.0.0', canario: null, percentual: 0 }),
    } as unknown as Response);

    await executarCarregador();

    expect(mockLocation.href).toBe('releases/v1.0.0/');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jogo_versao', 'v1.0.0');
  });

  test('canário sorteado -> escolhe versão canário', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: 'v1.0.0', canario: 'v1.1.0-canary', percentual: 50 }),
    } as unknown as Response);

    Math.random = vi.fn(() => 0.2); // 20 < 50

    await executarCarregador();

    expect(mockLocation.href).toBe('releases/v1.1.0-canary/');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jogo_versao', 'v1.1.0-canary');
  });

  test('canário não sorteado -> mantêm versão estável', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: 'v1.0.0', canario: 'v1.1.0-canary', percentual: 50 }),
    } as unknown as Response);

    Math.random = vi.fn(() => 0.8); // 80 >= 50

    await executarCarregador();

    expect(mockLocation.href).toBe('releases/v1.0.0/');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jogo_versao', 'v1.0.0');
  });

  test('versão salva válida mantida mesmo com percentual desfavorável', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: 'v1.0.0', canario: 'v1.1.0-canary', percentual: 0 }),
    } as unknown as Response);

    mockLocalStorageData['jogo_versao'] = 'v1.1.0-canary';
    Math.random = vi.fn(() => 0.9);

    await executarCarregador();

    expect(mockLocation.href).toBe('releases/v1.1.0-canary/');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jogo_versao', 'v1.1.0-canary');
  });

  test('localStorage que lança erro -> ignora exceção e continua para versão estável', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: 'v1.0.0', canario: 'v1.1.0-canary', percentual: 0 }),
    } as unknown as Response);

    mockLocalStorage.getItem = vi.fn(() => {
      throw new Error('Storage bloqueado');
    });
    mockLocalStorage.setItem = vi.fn(() => {
      throw new Error('Storage bloqueado');
    });

    await executarCarregador();

    expect(mockLocation.href).toBe('releases/v1.0.0/');
  });

  test('rollout.json fora do ar (HTTP 404 / erro) -> exibe mensagem amigável', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await executarCarregador();

    expect(mockMsgElement.innerText).toBe('Erro ao carregar versão. Tente novamente mais tarde.');
    expect(mockLocation.href).toBe('');
  });

  test('rollout.json falha de rede -> exibe mensagem amigável', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await executarCarregador();

    expect(mockMsgElement.innerText).toBe('Erro ao carregar versão. Tente novamente mais tarde.');
    expect(mockLocation.href).toBe('');
  });

  test('sem nenhuma versão válida no rollout.json -> exibe mensagem "Nenhuma versão disponível ainda."', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estavel: null, canario: null, percentual: 0 }),
    } as unknown as Response);

    await executarCarregador();

    expect(mockMsgElement.innerText).toBe('Nenhuma versão disponível ainda.');
    expect(mockLocation.href).toBe('');
  });
});
