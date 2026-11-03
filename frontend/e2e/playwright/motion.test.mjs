import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertEntryMotion } from './motion.mjs'

// Removing motion/progress/visibility checks must break these tests.
const valid = { animated: true, advanced: true, duration: 200, opacity: .96, form: true }
test('motion contract rejects absent, frozen, delayed-content and invalid-duration animations', () => {
  assert.doesNotThrow(() => assertEntryMotion(valid))
  for (const broken of [{ animated: false }, { advanced: false }, { opacity: 0 },
    { form: false }, { duration: 0 }, { duration: 251 }]) {
    assert.throws(() => assertEntryMotion({ ...valid, ...broken }))
  }
})
