import Phaser from 'phaser';
import { contexto, trocarPainel } from '../contexto';
import { publicarEstado } from '../testeHook';
import { telaSelecao } from '../ui/telas';
import { Demo } from './demo';

export class SelecaoFasesScene extends Phaser.Scene {
  private demo!: Demo;

  constructor() {
    super('SelecaoFases');
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    const { fases, progresso } = contexto();
    const vencidas = fases.filter((f) => (progresso.estrelas[f.id] ?? 0) > 0).length;
    this.demo = new Demo(this, 'Escolha a fase', `${vencidas} de ${fases.length} fases vencidas`);
    trocarPainel(
      telaSelecao(
        fases,
        progresso,
        (id) => {
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Cruzamento', { faseId: id }));
        },
        () => {
          this.cameras.main.fadeOut(200, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
        },
      ),
    );
    publicarEstado({ tela: 'selecao', fase: null });
  }

  update(_tempo: number, delta: number): void {
    this.demo.atualizar(delta);
  }
}
