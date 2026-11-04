import assert from 'node:assert/strict'
import {test} from 'node:test'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const module=await import('./controlled-build.mjs').catch(()=>null)
test('controlled build refuses ordinary roots, non-loopback APIs, absent ownership and a server that cannot prove owned synthetic mode',async()=>{
  assert.ok(module)
  let calls=0
  const fetcher=async()=>{calls++;return new Response(JSON.stringify({mode:'ordinary'}),{headers:{'Content-Type':'application/json'}})}
  const input={api:'http://127.0.0.1:1234',root:join(tmpdir(),'changeflow-a5-run-unit','test'),nonce:'f'.repeat(64),fetcher}
  for(const patch of [{nonce:''},{root:join(tmpdir(),'ordinary')},{api:'https://untrusted.example.test'}])await assert.rejects(()=>module.controlledBuild({...input,...patch}))
  assert.equal(calls,0)
  await assert.rejects(()=>module.controlledBuild(input));assert.equal(calls,1)
})
test('verified test plugin overrides only the explicit write boundary; ordinary modules and runtime flags cannot become write permits',async()=>{
  assert.ok(module)
  const plugin=await module.controlledBuild({api:'http://127.0.0.1:1234',root:join(tmpdir(),'changeflow-a5-run-unit','test'),nonce:'e'.repeat(64),
    fetcher:async()=>new Response(JSON.stringify({mode:'owned-synthetic-postgresql',nonce:'e'.repeat(64)}),{headers:{'Content-Type':'application/json'}})})
  assert.equal(plugin.resolveId('./form.ts','C:/project/src/features/change-editor/api.ts'),undefined)
  const id=plugin.resolveId('./boundary.ts','C:/project/src/features/change-editor/api.ts')
  assert.equal(typeof id,'string');assert.equal(plugin.resolveId('./boundary.ts','C:/project/src/features/auth/api.ts'),undefined)
})
