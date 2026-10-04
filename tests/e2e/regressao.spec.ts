import { expect, test, type Page } from '@playwright/test';

const URL_TESTE = './?teste=1&vel=20';

async function entrarNaFase(page: Page, fase: number): Promise<void> {
  await page.goto(URL_TESTE);
  await page.getByTestId('btn-jogar').click();
  await page.getByTestId(`btn-fase-${fase}`).click();
  await page.getByTestId('btn-comecar').click();
}

async function tocar(page: Page, blocos: string[]): Promise<void> {
  for (const bloco of blocos) await page.getByTestId(bloco).click();
}

const SOLUCAO_FASE_1 = [
  'bloco-abrir-norte',
  'bloco-esperar-4',
  'bloco-fechar-norte',
  'bloco-abrir-leste',
  'bloco-esperar-4',
  'bloco-fechar-leste',
];

test('colisão na fase 1 congela o trânsito e destaca a linha responsável', async ({ page }) => {
  await entrarNaFase(page, 1);
  await tocar(page, ['bloco-abrir-norte', 'bloco-abrir-leste', 'bloco-esperar-4']);
  await page.getByTestId('btn-iniciar').click();

  const erro = page.getByTestId('msg-erro');
  await expect(erro).toBeVisible({ timeout: 15_000 });
  await expect(erro).toContainText('linha 2');
  await expect(erro).toContainText('Feche o Norte antes de abrir o Leste');
  await expect(page.getByTestId('linha-2')).toHaveClass(/erro/);
  expect(await page.evaluate(() => window.__sinalAberto)).toMatchObject({ status: 'colisao', colisoes: 1 });

  // Corrigir: apagar e montar de novo tira o destaque e o erro.
  await tocar(page, ['btn-apagar', 'btn-apagar', 'btn-apagar']);
  await expect(page.getByTestId('msg-erro')).toHaveCount(0);
});

test('passo a passo executa uma linha por toque e destaca a linha', async ({ page }) => {
  await entrarNaFase(page, 1);
  await tocar(page, SOLUCAO_FASE_1);

  await page.getByTestId('btn-passo').click();
  await expect(page.getByTestId('linha-1')).toHaveClass(/ativa/);
  expect(await page.evaluate(() => window.__sinalAberto?.status)).toBe('passo');

  await page.getByTestId('btn-passo').click();
  await expect(page.getByTestId('linha-2')).toHaveClass(/ativa/);
  await expect(page.getByTestId('linha-1')).not.toHaveClass(/ativa/);
  // Depois do esperar(4) animado, dá para continuar.
  await expect(page.getByTestId('btn-passo')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('btn-passo').click();
  await expect(page.getByTestId('linha-3')).toHaveClass(/ativa/);
});

test('"Ver em JavaScript" mostra o algoritmo como código de verdade', async ({ page }) => {
  await entrarNaFase(page, 1);
  await tocar(page, SOLUCAO_FASE_1);
  await page.getByTestId('btn-ver-js').click();

  const codigo = page.getByTestId('codigo-js');
  await expect(codigo).toBeVisible();
  await expect(codigo).toContainText('while (true) {');
  await expect(codigo).toContainText('abrirSinal("Norte");');
  await expect(codigo).toContainText('esperar(4);');
  await page.getByTestId('btn-fechar-janela').click();
  await expect(codigo).toHaveCount(0);
});

test('esquecer o esperar mostra a mensagem amigável de repetição sem fim', async ({ page }) => {
  await entrarNaFase(page, 1);
  await tocar(page, ['bloco-abrir-norte', 'bloco-fechar-norte']);
  await page.getByTestId('btn-iniciar').click();
  await expect(page.getByTestId('msg-erro')).toContainText('esperar');
});

test('fase 3: o bloco "se" é montado por toque com OU', async ({ page }) => {
  await page.goto(URL_TESTE);
  await page.evaluate(() =>
    localStorage.setItem('sinalAberto.progresso.v1', JSON.stringify({ estrelas: { 1: 3, 2: 3 } })),
  );
  await page.reload(); // o progresso é lido ao abrir o jogo
  await page.getByTestId('btn-jogar').click();
  await page.getByTestId('btn-fase-3').click();
  await page.getByTestId('btn-comecar').click();
  await tocar(page, ['bloco-se', 'bloco-condicao-0', 'bloco-op-ou', 'bloco-condicao-1', 'bloco-pronto']);
  await expect(page.getByTestId('linha-1')).toHaveText('se (ambulanciaLeste == verdadeiro OU carrosLeste > 5) {');
  await tocar(page, ['bloco-fechar-norte', 'bloco-abrir-leste', 'bloco-senao', 'bloco-fechar-leste', 'bloco-abrir-norte', 'bloco-fim', 'bloco-esperar-2']);
  await page.getByTestId('btn-iniciar').click();
  await expect(page.getByTestId('msg-vitoria')).toBeVisible({ timeout: 40_000 });
});

test('fase 5: tocar no token conserta o JavaScript e leva ao fim de jogo', async ({ page }) => {
  await page.goto(URL_TESTE);
  await page.evaluate(() =>
    localStorage.setItem('sinalAberto.progresso.v1', JSON.stringify({ estrelas: { 1: 3, 2: 3, 3: 3, 4: 3 } })),
  );
  await page.reload(); // o progresso é lido ao abrir o jogo
  await page.getByTestId('btn-jogar').click();
  await page.getByTestId('btn-fase-5').click();
  await page.getByTestId('btn-comecar').click();

  const comparador = page.getByTestId('token-comparador');
  await expect(comparador).toHaveText('<');
  await page.getByTestId('btn-iniciar').click();
  await expect(page.getByTestId('msg-erro')).toBeVisible({ timeout: 40_000 });

  await comparador.click();
  await expect(comparador).toHaveText('>');
  await page.getByTestId('btn-iniciar').click();
  await expect(page.getByTestId('msg-vitoria')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('btn-continuar').click();

  await expect(page.getByTestId('tela-fim-jogo')).toContainText('Você leu e consertou código de verdade.');
  await expect(page.getByTestId('js-final')).toContainText('carrosLeste > 4');
});
