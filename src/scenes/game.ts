import fasesData from '../content/fases.json';
import { Fase, Instruction, GameState, Position } from '../core/models';
import { Interpreter, calcEstrelas } from '../core/interpreter';

export class GameScene {
  faseIndex: number = 0;
  fases: Fase[] = fasesData as Fase[];
  programa: Instruction[] = [];
  
  async init() {
    await this.renderMenu();
  }

  async renderMenu() {
    let version = "local";
    try {
      const res = await fetch('/version.json');
      if (res.ok) {
        const data = await res.json();
        version = data.sha || version;
      }
    } catch {
      // Ignora erro se não tiver version.json localmente
    }

    const app = document.getElementById('app')!;
    app.innerHTML = `
      <h1>Bit a Bit</h1>
      <p style="font-size: 0.8em; color: gray;">Versão: ${version}</p>
      <button data-testid="btn-jogar">Jogar Fase 1</button>
    `;
    app.querySelector('button')?.addEventListener('click', () => {
      this.faseIndex = 0;
      this.renderFase();
    });
  }

  renderFase() {
    this.programa = [];
    const fase = this.fases[this.faseIndex];
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <h2>Fase ${fase.id} - ${fase.conceito}</h2>
      <p>${fase.dica}</p>
      <canvas id="grade" width="400" height="300" style="border: 1px solid black;"></canvas>
      <div id="blocos">
        <button data-testid="bloco-andar" data-cmd="andar">Andar</button>
        <button data-testid="bloco-esq" data-cmd="virar-esquerda">Esquerda</button>
        <button data-testid="bloco-dir" data-cmd="virar-direita">Direita</button>
        <button data-testid="bloco-pegar" data-cmd="pegar">Pegar</button>
      </div>
      <div id="programa"></div>
      <button data-testid="btn-executar">Executar</button>
      <button data-testid="btn-limpar">Limpar</button>
      <div id="mensagem" style="margin-top: 15px; font-weight: bold;"></div>
    `;

    document.querySelectorAll('#blocos button').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const cmd = (ev.target as HTMLButtonElement).dataset.cmd as Instruction;
        this.programa.push(cmd);
        this.updateProgramaUI();
      });
    });

    document.querySelector('[data-testid="btn-executar"]')?.addEventListener('click', () => {
      this.executarPrograma();
    });
    
    document.querySelector('[data-testid="btn-limpar"]')?.addEventListener('click', () => {
      this.programa = [];
      this.updateProgramaUI();
      const msg = document.getElementById('mensagem');
      if (msg) msg.innerHTML = '';
    });

    this.drawGrade(fase.startPos, fase.mapa);
  }

  updateProgramaUI(destaqueIndex: number = -1, errorIndex: number = -1) {
    const div = document.getElementById('programa')!;
    div.innerHTML = this.programa.map((p, i) => {
      let color = '#333';
      if (i === errorIndex) color = 'red';
      else if (i === destaqueIndex) color = 'blue';
      return `<span data-testid="prog-${i}" style="background: ${color}; color: white; display: inline-block; padding: 5px; margin: 2px; border-radius: 4px;">[${p}]</span>`;
    }).join(' ');
  }

  drawGrade(pos: Position, mapa: number[][]) {
    const canvas = document.getElementById('grade') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tileSize = 50;

    for (let y = 0; y < mapa.length; y++) {
      for (let x = 0; x < mapa[y].length; x++) {
        if (mapa[y][x] === 0) ctx.fillStyle = '#ccc';
        else if (mapa[y][x] === 1) ctx.fillStyle = '#fff';
        else if (mapa[y][x] === 2) ctx.fillStyle = '#ff0';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    // Robo
    ctx.fillStyle = '#00f';
    ctx.beginPath();
    ctx.arc(pos.x * tileSize + tileSize / 2, pos.y * tileSize + tileSize / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    // Indicador de direcao (simples)
    ctx.fillStyle = '#f00';
    let px = pos.x * tileSize + tileSize / 2;
    let py = pos.y * tileSize + tileSize / 2;
    if (pos.dir === 0) px += 10;
    if (pos.dir === 1) py += 10;
    if (pos.dir === 2) px -= 10;
    if (pos.dir === 3) py -= 10;
    ctx.fillRect(px - 2, py - 2, 4, 4);
  }

  async executarPrograma() {
    const fase = this.fases[this.faseIndex];
    const initialState: GameState = {
      pos: { ...fase.startPos },
      chipsColetados: 0,
      mapa: JSON.parse(JSON.stringify(fase.mapa)),
      status: 'playing'
    };

    const interpreter = new Interpreter(initialState);
    const msgDiv = document.getElementById('mensagem')!;
    msgDiv.innerHTML = '';
    
    // Animação passo a passo
    for (let i = 0; i < this.programa.length; i++) {
      this.updateProgramaUI(i);
      interpreter.step(this.programa[i], i);
      this.drawGrade(interpreter.state.pos, interpreter.state.mapa);
      
      // Delay for animation
      await new Promise(r => setTimeout(r, 500));
      
      if (interpreter.state.status !== 'playing') break;
    }

    if (interpreter.state.status === 'playing') {
      if (interpreter.state.chipsColetados === fase.chips) {
        interpreter.state.status = 'win';
      } else {
        interpreter.state.status = 'lose';
      }
    }

    this.updateProgramaUI(-1, interpreter.state.status === 'lose' ? interpreter.state.erroIndex : -1);

    if (interpreter.state.status === 'win') {
      const estrelas = calcEstrelas(this.programa.length, fase.ideal);
      msgDiv.innerHTML = `<span style="color: green;" data-testid="msg-vitoria">Você venceu! Estrelas: ${estrelas}</span>`;
      setTimeout(() => {
        document.getElementById('app')!.innerHTML = `
          <h2>Fase Concluída!</h2>
          <p>Estrelas: ${estrelas}</p>
          <button data-testid="btn-proxima">Próxima Fase</button>
        `;
        document.querySelector('[data-testid="btn-proxima"]')?.addEventListener('click', () => {
          this.faseIndex++;
          if (this.faseIndex < this.fases.length) {
            this.renderFase();
          } else {
            document.getElementById('app')!.innerHTML = `<h2 data-testid="tela-fim">Fim de Jogo! Parabéns!</h2>`;
          }
        });
      }, 1000);
    } else {
      msgDiv.innerHTML = `<span style="color: red;" data-testid="msg-derrota">Você perdeu. ${interpreter.state.erroIndex !== undefined ? `Falha no bloco ${interpreter.state.erroIndex}.` : 'Tente novamente.'}</span>`;
      setTimeout(() => {
        this.drawGrade(fase.startPos, fase.mapa); // Reseta a grade
        this.updateProgramaUI();
        msgDiv.innerHTML = '';
      }, 2000);
    }
  }
}
