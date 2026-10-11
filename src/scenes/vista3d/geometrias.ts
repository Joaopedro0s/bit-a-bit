// Geometrias low-poly geradas em código para a cena 3D do cruzamento.
// Nenhum arquivo .glb, .obj ou textura externa — tudo é Three.js puro.

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
} from 'three';

// ──────────────────────────────────────── Cores base
const COR_ASFALTO   = new Color(0x3b3f45);
const COR_CALCADA   = new Color(0x5a6470);
const COR_GRAMA     = new Color(0x3d6b45);
const COR_FAIXA     = new Color(0xeeeeee);
const COR_FAIXA_AMB = new Color(0xff6b6b); // faixa vermelha da ambulância

export const CORES_CARRO = [
  0xef5350, 0x42a5f5, 0xffca28, 0x66bb6a,
  0xab47bc, 0xff7043, 0x26c6da, 0x8d6e63,
];

// ──────────────────────────────────────── helpers
function mat(color: Color | number): MeshLambertMaterial {
  return new MeshLambertMaterial({ color });
}

function box(w: number, h: number, d: number, color: Color | number): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), mat(color));
}

// ──────────────────────────────────────── Cenário
const MEIO = 1.3; // metade da largura da pista (em unidades 3D)

/**
 * Retorna o grupo raiz do cenário estático (chão, pistas, faixas, prédios, árvores).
 * Não inclui carros nem semáforos — esses são criados separadamente.
 */
export function criarCenario(): Object3D {
  const raiz = new Object3D();
  raiz.name = 'cenario';

  // ── Chão base (grama)
  const chao = box(24, 0.1, 20, COR_GRAMA);
  chao.position.y = -0.05;
  raiz.add(chao);

  // ── Pistas (Norte-Sul e Leste-Oeste)
  const pistaNS = box(MEIO * 2, 0.12, 20, COR_ASFALTO);
  pistaNS.position.y = 0;
  raiz.add(pistaNS);

  const pistaLO = box(24, 0.12, MEIO * 2, COR_ASFALTO);
  pistaLO.position.y = 0;
  raiz.add(pistaLO);

  // ── Cruzamento (tampa o cruzamento com cor de asfalto)
  const cruzamento = box(MEIO * 2, 0.13, MEIO * 2, COR_ASFALTO);
  cruzamento.position.y = 0.005;
  raiz.add(cruzamento);

  // ── Linha central pontilhada (Norte-Sul)
  for (let z = -8; z < 8; z += 0.8) {
    if (Math.abs(z) < MEIO + 0.2) continue; // pula o cruzamento
    const p = box(0.06, 0.14, 0.4, 0xffffff);
    p.position.set(0, 0.01, z + 0.2);
    raiz.add(p);
  }

  // ── Calçadas
  const calcadaLarg = 1.5;
  for (const [xBase, zBase, w, d] of [
    [-MEIO - calcadaLarg / 2,  0, calcadaLarg, 20],  // Oeste
    [ MEIO + calcadaLarg / 2,  0, calcadaLarg, 20],  // Leste (fora das pistas)
    [0, -MEIO - calcadaLarg / 2, 24, calcadaLarg],   // Sul
    [0,  MEIO + calcadaLarg / 2, 24, calcadaLarg],   // Norte
  ] as [number, number, number, number][]) {
    const c = box(w, 0.15, d, COR_CALCADA);
    c.position.set(xBase, 0.02, zBase);
    raiz.add(c);
  }

  // ── Faixas de pedestre (Norte-Sul e Leste-Oeste)
  const faixaY = 0.08;
  for (let i = -2; i <= 2; i++) {
    // faixa Norte
    const fn = box(0.18, faixaY, 0.7, COR_FAIXA);
    fn.position.set(MEIO * (i / 2) * 0.85, 0.02, -MEIO - 0.45);
    raiz.add(fn);
    // faixa Leste
    const fl = box(0.7, faixaY, 0.18, COR_FAIXA);
    fl.position.set(MEIO + 0.45, 0.02, MEIO * (i / 2) * 0.85);
    raiz.add(fl);
  }

  // ── Linha de retenção (para a fila)
  const lr1 = box(MEIO * 2, faixaY, 0.06, 0xffffff);
  lr1.position.set(0, 0.02, -MEIO - 1.1);
  raiz.add(lr1);
  const lr2 = box(0.06, faixaY, MEIO * 2, 0xffffff);
  lr2.position.set(MEIO + 1.1, 0.02, 0);
  raiz.add(lr2);

  // ── Prédios (quarteirões)
  for (const [x, z, w, h, d, cor] of [
    [ 6,  5,   3, 3.5, 2.5, 0x56606a],
    [10,  5,   4, 5,   3,   0x4a5560],
    [ 6, -5,   3, 2.5, 3,   0x56606a],
    [10, -5,   5, 4,   4,   0x4a5560],
    [-6,  6,   3, 3,   2.5, 0x3d4a52],
    [-6, -6,   3, 4,   3,   0x3d4a52],
  ] as [number, number, number, number, number, number][]) {
    const predio = new Object3D();
    const corpo = box(w, h, d, cor);
    corpo.position.y = h / 2;
    predio.add(corpo);
    // borda de arestas para dar profundidade
    const arestas = new LineSegments(
      new EdgesGeometry(new BoxGeometry(w + 0.02, h + 0.02, d + 0.02)),
      new LineBasicMaterial({ color: 0x7a8a94, linewidth: 1 }),
    );
    arestas.position.y = h / 2;
    predio.add(arestas);
    // janelas (fileiras de caixas pequenas)
    for (let lj = 0; lj < Math.floor(h / 1.2) - 1; lj++) {
      for (let cj = 0; cj < Math.floor(w / 1.1); cj++) {
        const janela = box(0.28, 0.28, 0.05, 0x6fa8c8);
        janela.position.set(-w / 2 + 0.55 + cj * 1.1, 0.9 + lj * 1.2, d / 2 + 0.03);
        predio.add(janela);
      }
    }
    predio.position.set(x, 0, z);
    raiz.add(predio);
  }

  // ── Árvores
  for (const [x, z] of [
    [1.8, 7], [-1.8, 7], [1.8, -7], [-1.8, -7],
    [7, 1.8], [7, -1.8], [-7, 1.8], [-7, -1.8],
  ] as [number, number][]) {
    raiz.add(criarArvore(x, z));
  }

  return raiz;
}

function criarArvore(x: number, z: number): Object3D {
  const arvore = new Object3D();
  // tronco
  const tronco = new Mesh(
    new CylinderGeometry(0.12, 0.18, 0.9, 6),
    mat(0x5d3a1a),
  );
  tronco.position.y = 0.45;
  arvore.add(tronco);
  // copa (cone low-poly)
  const copa = new Mesh(
    new ConeGeometry(0.6, 1.4, 6),
    mat(0x2e5535),
  );
  copa.position.y = 1.6;
  arvore.add(copa);
  arvore.position.set(x, 0, z);
  return arvore;
}

// ──────────────────────────────────────── Semáforo
export function criarSemaforo(): Object3D {
  const grupo = new Object3D();
  // poste
  const poste = new Mesh(
    new CylinderGeometry(0.06, 0.06, 1.4, 6),
    mat(0x888888),
  );
  poste.position.y = 0.7;
  grupo.add(poste);
  // caixa do semáforo
  const caixa = box(0.22, 0.5, 0.18, 0x222222);
  caixa.position.y = 1.55;
  grupo.add(caixa);
  // lâmpada (sphere pequena)
  const lamp = new Mesh(new SphereGeometry(0.08, 8, 6), mat(0xc62828));
  lamp.name = 'lampada';
  lamp.position.y = 1.55;
  lamp.position.z = 0.1;
  grupo.add(lamp);
  return grupo;
}

// ──────────────────────────────────────── Carro (geometria base para InstancedMesh)
/** Geometria de um carro visto de perspectiva inclinada — low-poly box + para-brisa. */
export function gerarGeometriaCarro(): BufferGeometry {
  // carroceria principal
  const geo = new BoxGeometry(0.55, 0.22, 0.95);
  // Levanta ligeiramente para ficar acima do chão
  const pos = geo.attributes.position as Float32BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + 0.11);
  }
  pos.needsUpdate = true;
  return geo;
}

/** Geometria do teto/cabine do carro. */
export function gerarGeometriaTeto(): BufferGeometry {
  const geo = new BoxGeometry(0.42, 0.18, 0.48);
  const pos = geo.attributes.position as Float32BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + 0.33);
  }
  pos.needsUpdate = true;
  return geo;
}

// ──────────────────────────────────────── Ambulância (mesh individual)
export function criarMeshAmbulancia(vertical: boolean): Object3D {
  const grupo = new Object3D();
  // carroceria branca
  const corpo = new Mesh(new BoxGeometry(0.58, 0.28, 1.1), mat(0xffffff));
  corpo.position.y = 0.14;
  grupo.add(corpo);
  // faixa vermelha
  const faixa = new Mesh(new BoxGeometry(0.59, 0.09, 1.11), mat(COR_FAIXA_AMB));
  faixa.position.y = 0.14;
  grupo.add(faixa);
  // teto elevado
  const teto = new Mesh(new BoxGeometry(0.5, 0.22, 0.9), mat(0xf5f5f5));
  teto.position.y = 0.41;
  grupo.add(teto);
  // luz giratória (Mesh vermelho/azul alternado pelo código da cena)
  const luz = new Mesh(new BoxGeometry(0.22, 0.1, 0.22), mat(0xff1744));
  luz.name = 'luz';
  luz.position.y = 0.56;
  grupo.add(luz);
  // cruz vermelha no teto
  const hCruz = new Mesh(new BoxGeometry(0.28, 0.01, 0.08), mat(0xcc0000));
  hCruz.position.set(0, 0.53, 0);
  grupo.add(hCruz);
  const vCruz = new Mesh(new BoxGeometry(0.08, 0.01, 0.28), mat(0xcc0000));
  vCruz.position.set(0, 0.53, 0);
  grupo.add(vCruz);
  // rotação para a via
  if (!vertical) grupo.rotation.y = Math.PI / 2;
  return grupo;
}
