// Vista3D: renderiza o cruzamento com Three.js lendo o estado da Simulacao.
// Não altera nada em src/core. Tem a mesma interface pública que VistaCruzamento
// para que CruzamentoScene possa trocar entre as duas sem mudar mais nada.

import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

import type { Via } from '../../core/ast';
import { VIAS } from '../../core/ast';
import type { Carro, Simulacao } from '../../core/simulacao';
import {
  CORES_CARRO,
  criarCenario,
  criarMeshAmbulancia,
  criarSemaforo,
  gerarGeometriaCarro,
  gerarGeometriaTeto,
} from './geometrias';

// ──────────────────────────────── constantes de layout (unidades = metros 3D)
const MEIO = 1.3;
/** Distância da linha de retenção ao centro do cruzamento */
const RECUO = 1.5;
/** Distância entre carros consecutivos na fila */
const ESPACO_FILA = 1.2;

/** Número máximo de carros (InstancedMesh). Aumentar se necessário nas etapas seguintes. */
const MAX_CARROS = 30;

interface VisualCarro {
  id: number;
  via: Via;
  ambulancia: boolean;
  /** Posição 3D atual (interpolada). */
  posAtual: Vector3;
  /** Mesh individual para ambulâncias (null = carro normal via InstancedMesh). */
  meshAmb: Object3D | null;
  /** Índice no InstancedMesh (null = ambulância). */
  instancia: number | null;
}

function posAlvo(c: Carro, indiceFila: number): Vector3 {
  // Via Norte: carros vêm do Norte (z negativo) em direção ao Sul (z positivo)
  if (c.via === 'Norte') {
    const zParado = -MEIO - RECUO;
    const z =
      c.estado === 'cruzando'
        ? zParado + c.progresso * (MEIO * 2 + RECUO * 2 + 1)
        : zParado - indiceFila * ESPACO_FILA;
    return new Vector3(0, 0.14, z);
  }
  // Via Leste: carros vêm do Leste (x positivo) em direção ao Oeste (x negativo)
  const xParado = MEIO + RECUO;
  const x =
    c.estado === 'cruzando'
      ? xParado - c.progresso * (MEIO * 2 + RECUO * 2 + 1)
      : xParado + indiceFila * ESPACO_FILA;
  return new Vector3(x, 0.14, 0);
}

// ─────────────────────────────── classe principal
export class Vista3D {
  /** Canvas criado pelo renderer — inserir no DOM pelo chamador. */
  readonly canvas: HTMLCanvasElement;

  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly clock = new Clock();

  private sim: Simulacao | null = null;
  private readonly carros = new Map<number, VisualCarro>();
  private instanciaLivre = 0;
  private readonly matrizTmp = new Matrix4();

  // InstancedMesh para carros comuns
  private readonly instancedCorpos: InstancedMesh;
  private readonly instancedTetos: InstancedMesh;

  // Semáforos
  private readonly semaforos: Record<Via, Object3D> = {} as Record<Via, Object3D>;
  private readonly lampadas: Record<Via, Object3D> = {} as Record<Via, Object3D>;

  // Tempo de piscar da luz da ambulância
  private piscar = 0;

  // Câmera — estado de animação
  private camAlvoPos = new Vector3(0, 10, 9);
  private camAlvoLookAt = new Vector3(0, 0, 0);

  constructor(private readonly elementoPai: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x2b3a2f);
    // Sombras desligadas (performance em celular de entrada)
    this.renderer.shadowMap.enabled = false;

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    this.scene = new Scene();
    this.scene.background = new Color(0x2b3a2f);

    // ── Câmera isométrica / perspectiva inclinada
    this.camera = new PerspectiveCamera(30, 1, 0.1, 200);
    this.camera.position.set(0, 10, 9);
    this.camera.lookAt(0, 0, 0);

    // ── Iluminação
    const amb = new AmbientLight(0xffffff, 0.55);
    this.scene.add(amb);
    const sol = new DirectionalLight(0xfff8e1, 1.1);
    sol.position.set(5, 12, 8);
    this.scene.add(sol);
    // luz de preenchimento suave do lado oposto
    const preench = new DirectionalLight(0xddeeff, 0.35);
    preench.position.set(-4, 6, -5);
    this.scene.add(preench);

    // ── Cenário estático
    this.scene.add(criarCenario());

    // ── Semáforos
    const semN = criarSemaforo();
    semN.position.set(-MEIO - 0.6, 0, -MEIO - 0.35);
    this.scene.add(semN);
    this.semaforos.Norte = semN;
    this.lampadas.Norte = semN.getObjectByName('lampada')!;

    const semL = criarSemaforo();
    semL.position.set(MEIO + 0.35, 0, MEIO + 0.6);
    semL.rotation.y = Math.PI / 2;
    this.scene.add(semL);
    this.semaforos.Leste = semL;
    this.lampadas.Leste = semL.getObjectByName('lampada')!;

    // ── InstancedMesh para carros
    const matCorpo = new MeshLambertMaterial({ color: 0xffffff });
    const matTeto  = new MeshLambertMaterial({ color: 0xffffff });
    this.instancedCorpos = new InstancedMesh(gerarGeometriaCarro(), matCorpo, MAX_CARROS);
    this.instancedTetos  = new InstancedMesh(gerarGeometriaTeto(), matTeto, MAX_CARROS);
    this.instancedCorpos.count = 0;
    this.instancedTetos.count  = 0;
    this.scene.add(this.instancedCorpos, this.instancedTetos);

    // ── Redimensionamento responsivo
    this.ajustarTamanho();
    const ro = new ResizeObserver(() => this.ajustarTamanho());
    ro.observe(elementoPai);

    elementoPai.appendChild(this.canvas);
    this.loop();
  }

  // ─────────────────────────── API pública (mesma do VistaCruzamento)

  definirSimulacao(sim: Simulacao): void {
    this.sim = sim;
    // Limpa carros anteriores
    for (const v of this.carros.values()) v.meshAmb?.removeFromParent();
    this.carros.clear();
    this.instanciaLivre = 0;
    this.instancedCorpos.count = 0;
    this.instancedTetos.count  = 0;
  }

  /** Chamado pelo CruzamentoScene a cada frame (mesmo delta em ms que o Phaser usa). */
  atualizar(deltaMs: number, velocidade: number): void {
    if (!this.sim) return;
    this.piscar += deltaMs;
    const k = 1 - Math.exp((-deltaMs / 1000) * 9 * Math.max(1, velocidade));
    this.sincronizarCarros(k);
    this.atualizarSemaforos();
  }

  /** Efeito de batida: câmera treme levemente. */
  mostrarBatida(): void {
    const orig = this.camera.position.clone();
    const shake = (n: number): void => {
      if (n <= 0) { this.camera.position.copy(orig); return; }
      const amp = 0.18 * (n / 6);
      this.camera.position.set(
        orig.x + (Math.random() - 0.5) * amp,
        orig.y + (Math.random() - 0.5) * amp * 0.4,
        orig.z + (Math.random() - 0.5) * amp,
      );
      setTimeout(() => shake(n - 1), 55);
    };
    shake(6);
  }

  /** Animação de câmera na vitória: zoom ligeiro para cima. */
  mostrarVitoria(): void {
    this.camAlvoPos = new Vector3(0, 13, 11);
  }

  /** Destrói o renderer e remove o canvas do DOM. */
  destruir(): void {
    this.renderer.dispose();
    this.canvas.remove();
  }

  // ─────────────────────────── interno

  private loop(): void {
    requestAnimationFrame(() => this.loop());
    // Suaviza câmera
    this.camera.position.lerp(this.camAlvoPos, 0.04);
    this.camera.lookAt(this.camAlvoLookAt);
    this.renderer.render(this.scene, this.camera);
  }

  private ajustarTamanho(): void {
    const w = this.elementoPai.clientWidth  || 400;
    const h = this.elementoPai.clientHeight || 280;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Ajusta zoom para manter o cruzamento inteiro na tela
    const dist = (h < 300) ? 13 : (h < 400) ? 11 : 9;
    this.camAlvoPos.set(0, dist * 1.1, dist);
  }

  private sincronizarCarros(k: number): void {
    const sim = this.sim!;
    const vistos = new Set<number>();

    for (const via of VIAS) {
      sim.fila(via).forEach((c, i) => this.moverCarro(c, i, k, vistos));
    }
    for (const c of sim.carros()) {
      if (c.estado === 'cruzando') this.moverCarro(c, 0, k, vistos);
    }

    // Remove carros que saíram
    for (const [id, v] of this.carros) {
      if (vistos.has(id)) continue;
      this.carros.delete(id);
      if (v.meshAmb) {
        v.meshAmb.removeFromParent();
      } else if (v.instancia !== null) {
        // Esconde a instância movendo para fora da tela
        this.matrizTmp.makeTranslation(999, 999, 999);
        this.instancedCorpos.setMatrixAt(v.instancia, this.matrizTmp);
        this.instancedTetos.setMatrixAt(v.instancia, this.matrizTmp);
      }
    }
    this.instancedCorpos.instanceMatrix.needsUpdate = true;
    this.instancedTetos.instanceMatrix.needsUpdate  = true;
  }

  private moverCarro(c: Carro, indice: number, k: number, vistos: Set<number>): void {
    vistos.add(c.id);
    const alvo = posAlvo(c, indice);
    let v = this.carros.get(c.id);

    if (!v) {
      v = this.criarVisualCarro(c, alvo.clone());
      this.carros.set(c.id, v);
    }

    // Interpolação suave
    v.posAtual.lerp(alvo, k);

    const rot = c.via === 'Norte' ? 0 : Math.PI / 2;

    if (v.ambulancia && v.meshAmb) {
      v.meshAmb.position.copy(v.posAtual);
      // piscar luz: alterna vermelho / azul a cada 220 ms
      const luzObj = v.meshAmb.getObjectByName('luz') as THREE_Mesh | undefined;
      if (luzObj) {
        const fase = Math.floor(this.piscar / 220) % 2 === 0;
        (luzObj.material as MeshLambertMaterial).color.setHex(fase ? 0xff1744 : 0x2979ff);
      }
    } else if (v.instancia !== null) {
      const mat = new Matrix4();
      mat.makeRotationY(rot);
      mat.setPosition(v.posAtual.x, v.posAtual.y, v.posAtual.z);
      this.instancedCorpos.setMatrixAt(v.instancia, mat);
      this.instancedTetos.setMatrixAt(v.instancia, mat);
    }
  }

  private criarVisualCarro(c: Carro, posInicial: Vector3): VisualCarro {
    if (c.ambulancia) {
      const mesh = criarMeshAmbulancia(c.via === 'Norte');
      mesh.position.copy(posInicial);
      this.scene.add(mesh);
      return { id: c.id, via: c.via, ambulancia: true, posAtual: posInicial, meshAmb: mesh, instancia: null };
    }

    const idx = this.instanciaLivre++;
    if (idx >= MAX_CARROS) {
      // Sobrou mais carros que o limite; reutiliza sem crash
      return { id: c.id, via: c.via, ambulancia: false, posAtual: posInicial, meshAmb: null, instancia: null };
    }
    this.instancedCorpos.count = Math.max(this.instancedCorpos.count, idx + 1);
    this.instancedTetos.count  = Math.max(this.instancedTetos.count,  idx + 1);

    // Cor do carro
    const cor = new Color(CORES_CARRO[c.id % CORES_CARRO.length]);
    this.instancedCorpos.setColorAt(idx, cor);
    this.instancedTetos.setColorAt(idx, new Color(0x444444)); // teto escuro
    if (this.instancedCorpos.instanceColor) this.instancedCorpos.instanceColor.needsUpdate = true;
    if (this.instancedTetos.instanceColor)  this.instancedTetos.instanceColor.needsUpdate  = true;

    return { id: c.id, via: c.via, ambulancia: false, posAtual: posInicial, meshAmb: null, instancia: idx };
  }

  private atualizarSemaforos(): void {
    const sim = this.sim!;
    for (const via of VIAS) {
      const aberto = sim.sinais[via].aberto;
      const lamp = this.lampadas[via] as THREE_Mesh;
      if (lamp) (lamp.material as MeshLambertMaterial).color.setHex(aberto ? 0x2e7d32 : 0xc62828);
    }
  }
}

// Alias local para satisfazer o TypeScript sem importar tipo redundante
type THREE_Mesh = import('three').Mesh;
