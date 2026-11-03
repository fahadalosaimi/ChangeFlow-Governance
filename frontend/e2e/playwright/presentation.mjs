import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { expect } from '@playwright/test'
import { assertEntryMotion, observeEntryMotion } from './motion.mjs'

const require = createRequire(import.meta.url)

async function prepare(page) {
  await page.addInitScript(() => localStorage.setItem('changeflow_language', 'en'))
  await page.goto('/login')
  await expect(page.locator('#workspace')).toBeVisible()
}

export const presentationCases = [
  ...[['rtl', 'ar-SA', 'rtl'], ['ltr', 'en', 'ltr']].map(([name, language, direction]) => [
    `P02-${name}`, async ({ page }) => {
      await prepare(page)
      if (language === 'en') await page.locator('[data-language-switch]:visible').selectOption('ar-SA')
      assertEntryMotion(await observeEntryMotion(page, language))
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 960 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        await expect(page.locator('#workspace')).toBeVisible()
        expect(await page.locator('.login-form input').evaluateAll(inputs => inputs.every(input => input.labels.length > 0))).toBe(true)
      }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      expect(await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      })).violations.length)).toBe(0)
      await page.setViewportSize({ width: 1440, height: 960 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.locator('[data-language-switch]:visible').selectOption(language === 'en' ? 'ar-SA' : 'en')
      await expect(page.locator('html')).toHaveAttribute('lang', language === 'en' ? 'ar-SA' : 'en')
      await expect.poll(() => page.locator('[data-route-surface]').evaluate(el => el.getAnimations().length)).toBe(0)
      await page.locator('#workspace').focus()
      expect(await page.locator('#workspace').evaluate(el => getComputedStyle(el).outlineStyle !== 'none')).toBe(true)
      expect(await page.locator('.btn').first().evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) < .001))).toBe(true)
    },
  ]),
  ...['disabled', 'frozen'].map(mode => [`P02-${mode}`, async ({ page }) => {
    await prepare(page)
    // A test-only fault on the real browser's animation API. No source/build
    // replacements, fake result object, or changed assertion under test.
    await page.evaluate(fault => {
      const original = Element.prototype.animate
      window.__motionFaults = 0
      Element.prototype.animate = function (...args) {
        const animation = original.apply(this, args)
        if (this.matches('[data-route-surface]')) {
          window.__motionFaults++
          if (fault === 'disabled') animation.cancel()
          else animation.pause()
        }
        return animation
      }
    }, mode)
    const motion = await observeEntryMotion(page, 'ar-SA')
    expect(await page.evaluate(() => window.__motionFaults)).toBeGreaterThan(0)
    if (mode === 'disabled') expect(motion.animated).toBe(false)
    else expect(motion.advanced).toBe(false)
    assert.throws(() => assertEntryMotion(motion), /Entry animation must (exist|advance)/)
  }]),
]
