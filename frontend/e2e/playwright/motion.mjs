import assert from 'node:assert/strict'

export function assertEntryMotion(motion) {
  assert.equal(motion.animated, true, 'Entry animation must exist')
  assert.equal(motion.advanced, true, 'Entry animation must advance')
  assert.ok(motion.duration >= 150 && motion.duration <= 250, 'Entry duration contract')
  assert.ok(motion.opacity >= .9, 'Content must remain visible during motion')
  assert.equal(motion.form, true, 'Content must exist during motion')
}

// Observe the real RouteSurface at its language-change boundary. No seek,
// synthetic clock, arbitrary delay, or changing the production animation.
export async function observeEntryMotion(page, language) {
  return page.evaluate(target => {
    const select = document.querySelector('[data-language-switch]')
    if (!select || select.value === target) throw new Error('Motion trigger contract')
    const result = new Promise((done, reject) => {
      const observer = new MutationObserver(() => {
        observer.disconnect()
        void (async () => {
          const surface = document.querySelector('[data-route-surface]')
          const animation = surface?.getAnimations().find(item => Number.isFinite(item.effect.getTiming().duration))
          if (!animation) { done({ animated: false }); return }
          await animation.ready
          const first = animation.currentTime
          const visible = { opacity: Number(getComputedStyle(surface).opacity), form: !!surface.querySelector('form') }
          if (animation.playState === 'paused' || animation.playbackRate === 0) {
            done({ animated: true, advanced: false, ...visible, duration: animation.effect.getTiming().duration })
            return
          }
          await animation.finished
          done({ animated: true, advanced: typeof first === 'number' && animation.currentTime > first,
            duration: animation.effect.getTiming().duration, ...visible })
        })().catch(reject)
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    })
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, target)
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return result
  }, language)
}
