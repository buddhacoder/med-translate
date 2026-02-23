import { test, expect } from '@playwright/test';

test.describe('MedTranslate Critical Path', () => {
    test('completes authentication, specialty, and language setup', async ({ page }) => {
        // 1. Wait for PWA initialization
        await page.goto('/');

        // CSS Verification (Protects against the Service Worker cache poisoning issue)
        const loginBtn = page.locator('#login-btn');
        await expect(loginBtn).toHaveCSS('min-height', '48px');

        // 2. Authentication Flow
        const pinDigits = page.locator('.pin-digit');
        for (let i = 0; i < 6; i++) {
            await pinDigits.nth(i).focus();
            await page.keyboard.press('1');
        }
        await expect(loginBtn).toBeEnabled();
        await loginBtn.click();

        // 3. Specialty Selection 
        const specialtyScreen = page.locator('#specialty-screen');
        await expect(specialtyScreen).toBeVisible();

        const erCard = page.locator('.specialty-card[data-specialty="er"]');
        await erCard.click();
        await expect(erCard).toHaveClass(/selected/);

        const confirmSpecialtyBtn = page.locator('#confirm-specialty-btn');
        await expect(confirmSpecialtyBtn).toBeEnabled();
        await confirmSpecialtyBtn.click();

        // 4. Language Setup
        const setupScreen = page.locator('#setup-screen');
        await expect(setupScreen).toBeVisible();

        const spanishCard = page.locator('.lang-flag-card[data-lang="es"]');
        await spanishCard.click();
        await expect(spanishCard).toHaveClass(/selected/);

        const startSessionBtn = page.locator('#start-session-btn');
        await expect(startSessionBtn).toBeEnabled();
        await startSessionBtn.click();

        // 5. Enter Session
        const sessionScreen = page.locator('#session-screen');
        await expect(sessionScreen).toBeVisible();

        // Verify previous bug fixes (Support Button should be stripped)
        await expect(page.locator('.donate-btn')).toBeHidden();
    });
});
