import { expect, test } from '@playwright/test';

// Caminho relativo: funciona com BASE_URL em /hml/ e em /releases/<sha>/.
// ?teste=1 liga o hook window.__sinalAberto e &vel=20 acelera a simulação.
const URL_TESTE = './?teste=1&vel=20';

test('abre o jogo, monta a solução da fase 1 tocando nos blocos e vence', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto(URL_TESTE);
  await page.evaluate(() =>
    localStorage.setItem('sinalAberto.progresso.v1', JSON.stringify({ tutorialOmitido: true })),
  );
  await page.reload();
  await expect(page).toHaveTitle(/Sinal Aberto/);
  await expect(page.getByTestId('versao')).toHaveText(/v\d+\.\d+\.\d+|versão local/);

  await page.getByTestId('btn-jogar').click();
  await expect(page.getByTestId('btn-fase-2')).toBeDisabled(); // bloqueio progressivo
  await page.getByTestId('btn-fase-1').click();
  await expect(page.getByTestId('dica')).toBeVisible();
  await page.getByTestId('btn-comecar').click();

  for (const bloco of [
    'bloco-abrir-norte',
    'bloco-esperar-4',
    'bloco-fechar-norte',
    'bloco-abrir-leste',
    'bloco-esperar-4',
    'bloco-fechar-leste',
  ]) {
    await page.getByTestId(bloco).click();
  }
  await expect(page.getByTestId('linha-6')).toContainText('fecharSinal("Leste")');

  await page.getByTestId('btn-iniciar').click();
  const vitoria = page.getByTestId('msg-vitoria');
  await expect(vitoria).toBeVisible({ timeout: 30_000 });
  await expect(vitoria).toContainText('3 de 3 estrelas');

  await page.getByTestId('btn-continuar').click();
  await expect(page.getByTestId('tela-fim-fase')).toBeVisible();
  await expect(page.getByTestId('revelacao')).toContainText('algoritmo');
  expect(await page.evaluate(() => window.__sinalAberto)).toMatchObject({ tela: 'fim', fase: 1 });
  expect(erros).toEqual([]);
});
