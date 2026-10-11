import Phaser from 'phaser';
import { gerarJs } from '../core/gerarJs';
import { montarPrograma, type Linha } from '../core/programa';
import { contexto, trocarPainel } from '../contexto';
import { publicarEstado } from '../testeHook';
import { telaFimFase } from '../ui/telas';
import { ALTURA, ESTILO_TEXTO, LARGURA } from './vistaCruzamento';

interface DadosFimFase {
  faseId: number;
  estrelas: number;
  linhas: Linha[];
}

/** Pontos de uma estrela de 5 pontas centrada em (0, 0). */
function pontosEstrela(raioFora: number, raioDentro: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? raioFora : raioDentro;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
}

export class FimFaseScene extends Phaser.Scene {
  constructor() {
    super('FimFase');
  }

  create(dados: DadosFimFase): void {
    const { fases } = contexto();
    const fase = fases.find((f) => f.id === dados.faseId) ?? fases[0];
    const ultima = fase.id === fases.length;

    this.cameras.main.setBackgroundColor('#1b3a24');
    this.add
      .text(LARGURA / 2, 54, ultima ? 'Cidade sem engarrafamento!' : `Fase ${fase.id} concluída!`, {
        ...ESTILO_TEXTO,
        fontSize: '24px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    const pontos = pontosEstrela(34, 15);
    for (let i = 0; i < 3; i++) {
      const ganhou = i < dados.estrelas;
      const g = this.add.graphics({ x: LARGURA / 2 + (i - 1) * 92, y: ALTURA / 2 + 8 });
      g.fillStyle(ganhou ? 0xffd54f : 0x2f4a36, 1).fillPoints(pontos, true);
      g.lineStyle(3, ganhou ? 0xfff3c4 : 0x5b7a63, 1).strokePoints(pontos, true);
      g.setScale(0);
      this.tweens.add({ targets: g, scale: 1, delay: 250 * i, duration: 450, ease: 'Back.easeOut' });
    }

    // Partículas leves de comemoração.
    const confete = this.add.particles(LARGURA / 2, ALTURA / 2, 'particula', {
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 },
      gravityY: 260,
      lifespan: 1600,
      scale: { start: 1.2, end: 0.4 },
      tint: [0xffd54f, 0x66bb6a, 0x42a5f5, 0xef5350],
      emitting: false,
    });
    this.time.delayedCall(300, () => confete.explode(50));

    this.cameras.main.fadeIn(300, 0, 0, 0);

    trocarPainel(
      telaFimFase({
        fase,
        estrelas: dados.estrelas,
        ultima,
        todasFases: ultima ? fases : undefined,
        jsFinal: ultima ? gerarJs(montarPrograma(dados.linhas)) : undefined,
        aoProxima: () => {
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Cruzamento', { faseId: fase.id + 1 }));
        },
        aoRepetir: () => {
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Cruzamento', { faseId: fase.id }));
        },
        aoMenu: () => {
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
        },
      }),
    );
    publicarEstado({ tela: 'fim', fase: fase.id, status: 'venceu' });
  }
}
