import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expectedCases, validateGateResults } from './gate-contract.mjs'

const names = ['login', 'A05', 'A06-control', 'A06-race', 'isolation', 'routes', 'session-boundaries']
const valid = [...names.map(name => ({ case: name, status: 'passed', duration_ms: 1 })), { contexts: 0, browser_exit: 0 }]
test('security gate cannot pass on filtered, skipped, failed or unclean results, even with exit0', () => {
  assert.equal(validateGateResults(valid, 'security', 0), true)
  for (const broken of [valid.slice(1), valid.slice(0, -1),
    valid.map((r, i) => i === 0 ? { ...r, status: 'skipped' } : r),
    valid.map((r, i) => i === 0 ? { ...r, status: 'failed' } : r),
    [...valid, { failed: 1 }], [...valid, { contexts: 1, browser_exit: 0 }]]) {
    assert.equal(validateGateResults(broken, 'security', 0), false)
  }
  assert.equal(validateGateResults(valid, 'security', 1), false)
  assert.equal(validateGateResults(valid, 'unknown', 0), false)
  assert.deepEqual(expectedCases('security'), names)
  assert.deepEqual(expectedCases('presentation'), ['P02-rtl', 'P02-ltr', 'P02-disabled', 'P02-frozen'])
  assert.deepEqual(expectedCases('reverse'), ['P02-frozen', 'P02-disabled', 'P02-ltr', 'P02-rtl',
    'session-boundaries', 'routes', 'isolation', 'A06-race', 'A06-control', 'A05', 'login'])
})

test('B2 combined gate retains security, presentation and systems cases and rejects a missing Dashboard case', () => {
  const dashboard = ['dashboard-data','dashboard-faults','dashboard-races','dashboard-boundaries','dashboard-roles','dashboard-layout']
  const combined = [...names,'P02-rtl','P02-ltr','P02-disabled','P02-frozen',
    'systems-catalog','systems-details','systems-races','systems-boundaries','systems-layout',...dashboard]
  assert.deepEqual(expectedCases('dashboard'),dashboard)
  assert.deepEqual(expectedCases('dashboard-forward'),combined)
  assert.deepEqual(expectedCases('dashboard-reverse'),[...combined].reverse())
  const rows = [...combined.map(name=>({case:name,status:'passed',duration_ms:1})),{contexts:0,browser_exit:0}]
  assert.equal(validateGateResults(rows,'dashboard-forward',0),true)
  assert.equal(validateGateResults(rows.filter(r=>r.case!=='dashboard-roles'),'dashboard-forward',0),false)
})

test('C1 gate includes all earlier cases and fails if any read-only change case is omitted',()=>{
  const names=['changes-list','changes-details','changes-races','changes-boundaries','changes-forbidden','changes-faults','changes-layout']
  assert.deepEqual(expectedCases('changes'),names)
  const all=[...expectedCases('dashboard-forward'),...names]
  assert.equal(all.length,29)
  assert.deepEqual(expectedCases('changes-forward'),all)
  assert.deepEqual(expectedCases('changes-reverse'),[...all].reverse())
  const rows=[...all.map(name=>({case:name,status:'passed',duration_ms:1})),{contexts:0,browser_exit:0}]
  assert.equal(validateGateResults(rows,'changes-forward',0),true)
  assert.equal(validateGateResults(rows.filter(r=>r.case!=='changes-forbidden'),'changes-forward',0),false)
})
