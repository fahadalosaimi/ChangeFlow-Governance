import { test } from 'node:test'
import assert from 'node:assert/strict'
const contract = await import('./contrast.mjs').catch(()=>null)

test('measured normal-text contrast rejects a real low-contrast fault and invalid color samples',()=>{
  assert.ok(contract,'Measured contrast contract is missing')
  assert.equal(contract.contrastRatio([0,0,0],[255,255,255]),21)
  assert.equal(contract.contrastRatio([255,255,255],[255,255,255]),1)
  assert.equal(contract.meetsTextContrast({foreground:[170,170,170],background:[255,255,255]}),false)
  assert.equal(contract.meetsTextContrast({foreground:[79,96,85],background:[227,239,218]}),true)
  for(const bad of [null,{foreground:[NaN,0,0],background:[255,255,255]},
    {foreground:[0,0,300],background:[255,255,255]}]) assert.equal(contract.meetsTextContrast(bad),false)
})
