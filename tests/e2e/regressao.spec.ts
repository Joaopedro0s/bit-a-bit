import { test, expect } from '@playwright/test';

test('errar e ver o bloco do erro', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('btn-jogar').click();

  // Fase 1: errar colocando virar-esquerda na parede
  await page.getByTestId('bloco-esq').click();
  await page.getByTestId('bloco-andar').click();
  
  await page.getByTestId('btn-executar').click();

  const derrota = page.getByTestId('msg-derrota');
  await expect(derrota).toBeVisible({ timeout: 5000 });
  await expect(derrota).toContainText('Falha no bloco 1');

  // Verificar se o bloco 1 está destacado com background vermelho
  // Como o Playwright não consegue ler cor com expect trivialmente, a gente
  // checa o atributo style
  const blocoErro = page.getByTestId('prog-1');
  await expect(blocoErro).toHaveCSS('background-color', 'rgb(255, 0, 0)'); // 'red' is parsed to rgb(255, 0, 0)
});
