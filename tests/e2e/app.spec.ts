import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function dismissCookies(page: Page) {
  const button = page.getByRole('button', { name: 'Recusar não essenciais' });
  const visible = await button.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
  if (visible) {
    await button.click();
    await expect(page.getByRole('region', { name: 'Aviso de cookies' })).toBeHidden();
  }
}

async function auditScreenshot(page: Page, testInfo: TestInfo, name: string) {
  if (process.env.VISUAL_AUDIT !== '1') return;
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function signInStaff(page: Page, email: string) {
  await page.goto('/barbeiro/login');
  await dismissCookies(page);
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill('ClasseA#2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('landing e início do agendamento funcionam em tela pequena', async ({ page }, testInfo) => {
  await page.goto('/');
  await dismissCookies(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu estilo');
  await expect(page.getByRole('link', { name: /agendar/i }).first()).toBeVisible();
  await expect(page.getByText('Corte', { exact: true }).first()).toBeVisible();
  const overflow = await page.evaluate(() => {
    const doc = (globalThis as unknown as { document: { documentElement: { scrollWidth: number; clientWidth: number } } }).document;
    return doc.documentElement.scrollWidth - doc.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await auditScreenshot(page, testInfo, 'landing');

  await page.goto('/agendar');
  await expect(page.getByRole('region', { name: 'Serviço' })).toBeVisible();
  await expect(page.getByText('Corte', { exact: true }).first()).toBeVisible();
  await auditScreenshot(page, testInfo, 'booking');
});

test('cliente autenticado abre o painel', async ({ page }, testInfo) => {
  await page.goto('/entrar');
  await dismissCookies(page);
  await page.getByLabel('E-mail').fill('cliente@classea.test');
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill('ClasseA#2026');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/cliente/);
  await expect(page.getByText(/Olá,/)).toBeVisible();
  await expect(page.getByText('Próximo atendimento')).toBeVisible();
  await auditScreenshot(page, testInfo, 'client-home');
});

test('barbeiro abre agenda e clientes', async ({ page }, testInfo) => {
  await signInStaff(page, 'rafael@classea.test');
  await expect(page).toHaveURL(/\/barbeiro$/);
  await expect(page.getByRole('heading', { name: /Hoje/ })).toBeVisible();
  await page.goto('/barbeiro/agenda');
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  await auditScreenshot(page, testInfo, 'barber-agenda');
});

test('administrador abre o painel completo', async ({ page }, testInfo) => {
  await signInStaff(page, 'dono@classea.test');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Agenda da equipe' })).toBeVisible();
  await page.goto('/admin/servicos');
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo serviço' })).toBeVisible();
  await expect(page.getByText('Corte', { exact: true }).first()).toBeVisible();
  await auditScreenshot(page, testInfo, 'admin-services');
});
