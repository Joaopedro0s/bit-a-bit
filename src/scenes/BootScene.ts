import Phaser from 'phaser';
import { contexto } from '../contexto';

/** Prepara texturas geradas em código e lê a versão publicada. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // Textura da partícula da vitória: um quadradinho branco, desenhado em código.
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 6, 6);
    g.generateTexture('particula', 6, 6);
    g.destroy();

    void lerVersao().then((texto) => {
      contexto().versao = texto;
      this.scene.start('Menu');
    });
  }
}

/** version.json é gerado no build: { versao, sha, build }. Caminho relativo (roda em /hml/ e /releases/<sha>/). */
async function lerVersao(): Promise<string> {
  try {
    const resposta = await fetch('./version.json', { cache: 'no-store' });
    if (!resposta.ok) throw new Error(String(resposta.status));
    const dados = (await resposta.json()) as { versao?: string; sha?: string };
    return `v${dados.versao ?? '?'} · ${dados.sha ?? 'local'}`;
  } catch {
    return 'versão local';
  }
}
