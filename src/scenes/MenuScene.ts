import Phaser from 'phaser';
import { contexto, trocarPainel } from '../contexto';
import { publicarEstado } from '../testeHook';
import { telaMenu } from '../ui/telas';
import { Demo } from './demo';

export class MenuScene extends Phaser.Scene {
  private demo!: Demo;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.demo = new Demo(this, 'SINAL ABERTO', 'O Controlador de Trânsito');
    trocarPainel(telaMenu(contexto().versao, () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SelecaoFases'));
    }));
    publicarEstado({ tela: 'menu', fase: null, status: 'pronta', colisoes: 0 });
  }

  update(_tempo: number, delta: number): void {
    this.demo.atualizar(delta);
  }
}
