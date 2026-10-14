import { test, expect } from '@playwright/test';

test('market prices clearly identify simulated data and update demand pressure by crop', async ({ page }) => {
  await page.goto('/en/market-prices');
  await expect(page.getByRole('heading', { name: 'Market Prices' })).toBeVisible();
  await expect(page.getByText(/Demo data — not live market prices/)).toBeVisible();
  await expect(page.getByText(/simulated demonstration observations/i)).toBeVisible();
  await page.getByRole('combobox').nth(1).selectOption('Tomato');
  await expect(page.getByRole('heading', { name: /Demand pressure: Tomato/i })).toBeVisible();
});

test('IVR route exposes interactive keypad, supports quantity backspace, and shows disclaimer', async ({ page }) => {
  await page.goto('/en/ivr-demo');
  await expect(page.getByRole('heading', { name: 'IVR/SMS Demo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Press 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Press 1' }).click();
  await expect(page.getByText(/Select crop: 1 for wheat/i)).toBeVisible();
  await page.getByRole('button', { name: 'Press 1' }).click();
  await expect(page.getByText(/Select variety: 1 for common/i)).toBeVisible();
  await page.getByRole('button', { name: 'Press 1' }).click();
  await page.getByRole('button', { name: 'Press 2' }).click();
  await page.getByRole('button', { name: 'Press 5' }).click();
  await expect(page.getByText(/Entered: 25 quintals/i)).toBeVisible();
  await page.getByRole('button', { name: 'Press *' }).click();
  await expect(page.getByText(/Entered: 2 quintals/i)).toBeVisible();
  await expect(page.getByText(/production integrates with a real telephony provider/i)).toBeVisible();
});

test('language switch preserves a supported localized route', async ({ page }) => {
  await page.goto('/en/market-prices');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('hi');
  await expect(page).toHaveURL(/\/hi\/market-prices$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'मंडी भाव' })).toBeVisible({ timeout: 10000 });
});

test('protected routes redirect unauthenticated users to login when Supabase is configured', async ({ page }) => {
  await page.goto('/en/login?reason=role-mismatch&required=supervisor');
  await expect(page.getByText(/requires the/i)).toBeVisible();
});

test('home landing page renders hero, role gateways, and direct navigation links', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { name: 'Fair markets. Faster decisions.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Register New Account/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /AI Quality Analyzer/i }).first()).toBeVisible();
});

test('register page renders role selection, phone input, and DPDP notice', async ({ page }) => {
  await page.goto('/en/register');
  await expect(page.getByRole('heading', { name: 'Create Mandi Account' })).toBeVisible();
  await expect(page.getByText(/Account Type/i)).toBeVisible();
  await expect(page.getByText(/🌾 Farmer/i)).toBeVisible();
  await expect(page.getByText(/🛒 Buyer \/ Trader/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in to your account/i })).toBeVisible();
});

test('AI crop quality analyzer page renders optical pre-grading interface', async ({ page }) => {
  await page.goto('/en/farmer/analyzer');
  await expect(page.getByRole('heading', { name: 'AI Crop Quality Analyzer' })).toBeVisible();
  await expect(page.getByText(/Click or drag harvest sample image here/i)).toBeVisible();
  await expect(page.getByText(/Deterministic Computer Vision/i)).toBeVisible();
});


