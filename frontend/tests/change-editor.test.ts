import assert from 'node:assert/strict'
import {test} from 'node:test'
import {ApiError} from '../src/services/api/errors.ts'
import type {ChangeMutation} from '../src/features/change-editor/mutation.ts'
const forms=await import('../src/features/change-editor/form.ts').catch(()=>null)
const mutations=await import('../src/features/change-editor/mutation.ts').catch(()=>null)
const apis=await import('../src/features/change-editor/api.ts').catch(()=>null)
const draft={title:'Synthetic request',description:'Controlled description',change_type:'application',change_mode:'Normal',priority:'Medium',
  affected_system_ids:[1001],expected_downtime_minutes:'0',rollback_complexity:'Medium',security_sensitivity:'Medium',
  business_justification:'',planned_start:'2026-01-02T10:00',planned_end:'2026-01-02T11:00',revision_comment:'Corrected scope'}

test('editor validates the actual schema, Unicode lengths, IDs, enums, downtime and schedule without silently fixing unsafe values',()=>{
  assert.ok(forms)
  const result=forms.validateDraft(draft,[1001],false)
  assert.deepEqual(result.errors,{})
  assert.equal(result.payload?.expected_downtime_minutes,0)
  assert.equal(result.payload?.business_justification,null)
  assert.equal('revision_comment' in result.payload!,false)
  assert.equal(forms.validateDraft({...draft,title:'😀😀😀'},[1001],false).payload?.title,'😀😀😀')
  for(const [patch,key] of [
    [{title:'ab'},'title'],[{title:'x'.repeat(256)},'title'],[{description:'short'},'description'],
    [{affected_system_ids:[]},'affected_system_ids'],[{affected_system_ids:[1001,1001]},'affected_system_ids'],
    [{affected_system_ids:[2001]},'affected_system_ids'],[{affected_system_ids:[0]},'affected_system_ids'],
    [{affected_system_ids:[Number.MAX_SAFE_INTEGER+1]},'affected_system_ids'],
    [{change_type:'unknown'},'change_type'],[{change_mode:'normal'},'change_mode'],[{priority:'unknown'},'priority'],
    [{rollback_complexity:'Critical'},'rollback_complexity'],[{security_sensitivity:'Critical'},'security_sensitivity'],
    [{expected_downtime_minutes:'-1'},'expected_downtime_minutes'],[{expected_downtime_minutes:'43201'},'expected_downtime_minutes'],
    [{expected_downtime_minutes:'1.5'},'expected_downtime_minutes'],[{business_justification:'x'.repeat(8001)},'business_justification'],
    [{planned_start:'2026-02-30T10:00'},'planned_start'],[{planned_end:'2026-01-01T10:00'},'planned_end'],
  ] as const)assert.ok(forms.validateDraft({...draft,...patch},[1001],false).errors[key],key)
  assert.equal(forms.validateDraft({...draft,expected_downtime_minutes:'43200'},[1001],false).payload?.expected_downtime_minutes,43200)
})

test('revision requires owner, current permission and exact backend state; comment constraints do not alter the original DTO',()=>{
  assert.ok(forms)
  const record={requester_id:2,status:'Needs More Information'}
  assert.equal(forms.revisionAllowed(record,2,['changes.revise']),true)
  for(const [r,id,grants] of [[record,3,['changes.revise']],[record,2,[]],[{...record,status:'Approved'},2,['changes.revise']]] as const)
    assert.equal(forms.revisionAllowed(r,id,grants),false)
  for(const c of ['','  ','ab','x'.repeat(4001)])assert.ok(forms.validateDraft({...draft,revision_comment:c},[1001],true).errors.revision_comment)
  assert.equal(forms.validateDraft(draft,[1001],true).payload?.revision_comment,'Corrected scope')
  assert.ok(forms.validateDraft(draft,[],false).errors.affected_system_ids)
})

test('ordinary editor API denies both mutations before transport even for valid payloads and apparently privileged callers',async()=>{
  assert.ok(apis)
  let requests=0
  const api=apis.createEditorApi(async()=>{requests++;return {}},2)
  await assert.rejects(()=>api.create(draft,[1001]),e=>(e as ApiError).code==='configuration')
  await assert.rejects(()=>api.revise(100,draft,[1001]),e=>(e as ApiError).code==='configuration')
  assert.equal(requests,0)
})

test('planned schedule is organization wall time as specified by the model, without silently stripping supplied offsets',()=>{
  assert.ok(forms)
  for(const planned_start of ['2026-01-02T10:00Z','2026-01-02T10:00+03:00'])
    assert.ok(forms.validateDraft({...draft,planned_start},[1001],false).errors.planned_start)
})

test('write confirmation rejects changed payload fields, systems or schedule while accepting backend seconds normalization',()=>{
  assert.ok(forms);assert.equal(typeof forms.matchesWritten,'function')
  const payload=forms.validateDraft(draft,[1001],false).payload!
  const record={...payload,status:'Pending Approval',planned_start:'2026-01-02T10:00:00',planned_end:'2026-01-02T11:00:00'}
  assert.equal(forms.matchesWritten(record,payload),true)
  for(const patch of [{priority:'High'},{expected_downtime_minutes:2},{affected_system_ids:[1002]},{planned_end:'2026-01-02T12:00:00'},{status:'Approved'}])
    assert.equal(forms.matchesWritten({...record,...patch},payload),false)
})

test('mutation locks concurrent submissions, refreshes once after verified success and never retries',async()=>{
  assert.ok(mutations)
  const state:ChangeMutation<number>=new mutations.ChangeMutation<number>()
  let finish!:(v:number)=>void,calls=0,refreshes=0
  const first=state.run(async()=>{calls++;return new Promise<number>(done=>{finish=done})},async()=>{refreshes++})
  await state.run(async()=>{calls++;return 2},async()=>{refreshes++})
  assert.equal(calls,1);finish(100);await first
  assert.equal(refreshes,1);assert.equal(state.getSnapshot().status,'saved')
  await state.run(async()=>{calls++;return 3},async()=>{refreshes++})
  assert.equal(calls,1)
})

test('late mutation success or rejection after cancel cannot publish success, refresh or navigate in another session',async()=>{
  assert.ok(mutations)
  for(const reject of [false,true]){
    const state:ChangeMutation<number>=new mutations.ChangeMutation<number>();let finish!:(v:number)=>void,fail!:(e:Error)=>void,refreshes=0
    const pending=state.run(()=>new Promise<number>((ok,no)=>{finish=ok;fail=no}),async()=>{refreshes++})
    state.cancel();if(reject)fail(new ApiError('forbidden',403));else finish(100)
    await pending;assert.equal(refreshes,0);assert.equal(state.getSnapshot().status,'idle')
  }
  const state:ChangeMutation<number>=new mutations.ChangeMutation<number>()
  let finish!:()=>void,entered!:()=>void
  const refreshing=new Promise<void>(done=>{entered=done})
  const pending=state.run(async()=>100,async()=>{entered();await new Promise<void>(done=>{finish=done})})
  await refreshing;state.cancel();finish();await pending
  assert.equal(state.getSnapshot().status,'idle')
})

test('unknown write outcome remains locked including invalid response and post-write refresh failure; explicit rejections permit correction',async()=>{
  assert.ok(mutations)
  for(const error of [new ApiError('network'),new ApiError('timeout'),new ApiError('invalid_response'),new ApiError('http',500)]){
    const state:ChangeMutation<number>=new mutations.ChangeMutation<number>();let calls=0
    await state.run(async()=>{calls++;throw error},async()=>{})
    assert.equal(state.getSnapshot().status,'uncertain')
    await state.run(async()=>{calls++;return 1},async()=>{})
    assert.equal(calls,1)
  }
  for(const status of [400,403,404,409,422]){
    const state:ChangeMutation<number>=new mutations.ChangeMutation<number>()
    await state.run(async()=>{throw new ApiError('http',status)},async()=>{})
    assert.equal(state.getSnapshot().status,'rejected')
    await state.run(async()=>100,async()=>{})
    assert.equal(state.getSnapshot().status,'saved')
  }
  const state:ChangeMutation<number>=new mutations.ChangeMutation<number>()
  await state.run(async()=>100,async()=>{throw new ApiError('network')})
  assert.equal(state.getSnapshot().status,'uncertain')
})
