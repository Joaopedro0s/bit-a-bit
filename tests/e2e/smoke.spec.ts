import { test, expect } from '@playwright/test';

test('jogar a fase 1 até a tela de fim', async ({ page }) => {
  await page.goto('/');

  // Iniciar jogo
  await page.getByTestId('btn-jogar').click();

  // Fase 1: andar, andar, pegar
  await page.getByTestId('bloco-andar').click();
  await page.getByTestId('bloco-andar').click();
  await page.getByTestId('bloco-pegar').click();
  
  await page.getByTestId('btn-executar').click();

  // Esperar a animação e a mensagem de vitória
  const vitoria = page.getByTestId('msg-vitoria');
  await expect(vitoria).toBeVisible({ timeout: 5000 });
  await expect(vitoria).toContainText('Você venceu! Estrelas: 3');

  // Ir para a próxima fase
  await page.getByTestId('btn-proxima').click();

  // Tela da próxima fase, ou tela de fim se for a última (mas temos 2 fases no JSON)
  // Como são duas, vamos resolver a segunda também:
  // solucao: ["andar", "virar-direita", "andar", "pegar"]
  await page.getByTestId('bloco-andar').click();
  await page.getByTestId('bloco-dir').click();
  await page.getByTestId('bloco-andar').click();
  await page.getByTestId('bloco-pegar').click();

  await page.getByTestId('btn-executar').click();

  const vitoria2 = page.getByTestId('msg-vitoria');
  await expect(vitoria2).toBeVisible({ timeout: 5000 });
  
  await page.getByTestId('btn-proxima').click();

  const telaFim = page.getByTestId('tela-fim');
  await expect(telaFim).toBeVisible({ timeout: 5000 });
});
