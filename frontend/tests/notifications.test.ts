import assert from 'node:assert/strict'
import {test} from 'node:test'
import {ApiError} from '../src/services/api/errors.ts'
import {ApiSession} from '../src/services/api/session.ts'
import {createApiClient} from '../src/services/api/client.ts'
import {createWorkspaceGateway} from '../src/features/auth/workspaceGateway.ts'
import type {AuthSnapshot} from '../src/features/auth/authStore.ts'
import type {NotificationsMutation} from '../src/features/notifications/mutation.ts'
const query=await import('../src/features/notifications/query.ts').catch(()=>null)
const dto=await import('../src/features/notifications/decoders.ts').catch(()=>null)
const apiModule=await import('../src/features/notifications/api.ts').catch(()=>null)
const lifecycle=await import('../src/features/notifications/mutation.ts').catch(()=>null)
const notice={id:11,organization_id:1,recipient_id:2,actor_id:8,actor_name:'Synthetic actor',change_request_id:100,
  notification_type:'CHANGE_SUBMITTED',title:'billing/payments',message:'Synthetic notice',is_read:false,created_at:'2026-01-01T10:00:00',read_at:null}
const scope={organization:1,recipient:2,ownChangeId:2}
const invalid=(e:unknown)=>(e as ApiError).code==='invalid_response'

test('notifications query preserves server semantics and encoding without fabricating totals or restricting unknown legacy event labels',()=>{
  assert.ok(query)
  const q=query.readQuery(new URLSearchParams('page=2&page_size=5&unread_only=true&notification_type=LEGACY_LABEL&search=billing%2Fpayments'))
  assert.equal(query.serializeQuery(q),'page=2&page_size=5&unread_only=true&notification_type=LEGACY_LABEL&search=billing%2Fpayments')
  for(const v of ['page=0','page=1e2','page_size=101','unread_only=maybe'])assert.throws(()=>query.readQuery(new URLSearchParams(v)))
})

test('notification DTOs enforce tenant and recipient, safe IDs, boolean status and dates; nullable server read_at is never invented',()=>{
  assert.ok(dto)
  assert.equal(dto.decodeNotice(notice,scope).read_at,null)
  assert.equal(dto.decodeNotice({...notice,is_read:true,read_at:null},scope).read_at,null)
  for(const patch of [{organization_id:2},{recipient_id:9},{id:0},{id:Number.MAX_SAFE_INTEGER+1},{is_read:'false'},
    {created_at:'2026-02-30T10:00:00'},{change_request_id:'https://evil.example'},{actor_id:-1},{change_request_id:null}])
    assert.throws(()=>dto.decodeNotice({...notice,...patch},scope),invalid)
  assert.equal(dto.decodeNotice({...notice,change_request_id:null,notification_type:'GENERAL'},scope).change_request_id,null)
})

test('server metadata and read-filter contracts reject duplicate rows and mismatched pages; absent count is not zero',()=>{
  assert.ok(dto);assert.ok(query)
  const q=query.readQuery(new URLSearchParams('page=2&page_size=5&unread_only=true'))
  const page={items:[notice],total:12,page:2,page_size:5,total_pages:3}
  assert.equal(dto.decodePage(page,q,scope).total,12)
  for(const patch of [{page:1},{total_pages:1},{items:[notice,notice]},{items:[{...notice,is_read:true}]}])assert.throws(()=>dto.decodePage({...page,...patch},q,scope),invalid)
  assert.equal(dto.decodeCount({unread_count:0},'unread_count'),0)
  for(const v of [{},{unread_count:-1},{unread_count:'1'}])assert.throws(()=>dto.decodeCount(v,'unread_count'),invalid)
})

test('linked destination uses only the schema change reference, current grant and a safe integer, never title/type/URL metadata',()=>{
  assert.ok(dto)
  assert.equal(dto.destination(notice,['changes.read']),'/changes/100')
  assert.equal(dto.destination({...notice,notification_type:'https://evil.example',url:'//evil.example'},['changes.read']),'/changes/100')
  assert.equal(dto.destination(notice,['notifications.own']),null)
  for(const id of [null,0,-1,'//evil.example',100.5,Number.MAX_SAFE_INTEGER+1])assert.equal(dto.destination({...notice,change_request_id:id},['changes.read']),null)
})

test('bound notification API validates exact PATCH receipts and refuses unsafe IDs and untrusted linked destinations before transport',async()=>{
  assert.ok(apiModule)
  const paths:string[]=[]
  const api=apiModule.createNotificationsApi(async(path,options)=>{paths.push(path);assert.equal(options?.method,'PATCH');return {...notice,is_read:true,read_at:'2026-01-02T10:00:00'}},scope)
  assert.equal((await api.one(11)).read_at,'2026-01-02T10:00:00')
  await assert.rejects(()=>api.one(0),e=>(e as ApiError).code==='configuration')
  await assert.rejects(()=>api.target(notice,[],undefined),e=>(e as ApiError).code==='forbidden')
  assert.deepEqual(paths,['/notifications/11/read'])
  const bad=apiModule.createNotificationsApi(async()=>({...notice,id:12}),scope)
  await assert.rejects(()=>bad.one(11),invalid)
})

test('late notification 200 or 401 cannot cross a session binding or invalidate the new session',async()=>{
  assert.ok(apiModule);assert.ok(query)
  for(const status of [200,401]){
    const session=new ApiSession();session.setToken('old.fixture.signature')
    let state={status:'authenticated',binding:'one'} as AuthSnapshot,release!:(r:Response)=>void
    const client=createApiClient({baseUrl:'https://api.example.test',trustedOrigins:['https://api.example.test'],session,
      fetcher:()=>new Promise(done=>{release=done})})
    const api=apiModule.createNotificationsApi(createWorkspaceGateway(client,()=>state,'one'),scope)
    const pending=api.unread();session.setToken('new.fixture.signature');state={...state,binding:'two'}
    release(new Response(JSON.stringify({unread_count:999}),{status,headers:{'Content-Type':'application/json'}}))
    await assert.rejects(pending,e=>['session_changed','aborted'].includes((e as ApiError).code))
    assert.equal(session.snapshot().token,'new.fixture.signature')
  }
})

test('notification mutation prevents double PATCH, requires fresh confirmation, and never retries unknown outcomes',async()=>{
  assert.ok(lifecycle)
  const state=new lifecycle.NotificationsMutation();let finish!:()=>void,calls=0,reads=0,nav=0
  const action={kind:'one' as const,notice}
  const pending=state.run(action,async()=>{calls++;await new Promise<void>(done=>{finish=done})},async()=>{reads++},()=>true,()=>{nav++})
  await state.run(action,async()=>{calls++},async()=>{},()=>true)
  assert.equal(calls,1);assert.equal(state.getSnapshot().status,'saving');finish();await pending
  assert.equal(reads,1);assert.equal(nav,1);assert.equal(state.getSnapshot().status,'confirmed')
  await state.run(action,async()=>{calls++;throw new ApiError('network')},async()=>{},()=>true,()=>{nav++})
  assert.equal(state.getSnapshot().status,'uncertain')
  await state.run(action,async()=>{calls++},async()=>{},()=>true)
  assert.equal(calls,2);assert.equal(nav,1)
  await state.reconcile(async()=>false,async()=>{},()=>true);assert.equal(state.getSnapshot().status,'uncertain')
  await state.reconcile(async()=>true,async()=>{reads++},()=>true);assert.equal(state.getSnapshot().status,'observed');assert.equal(nav,1)
})

test('mutation scope changes, unmount, lost confirmation, validation failures and HTTP rejections cannot publish stale success/navigation',async()=>{
  assert.ok(lifecycle)
  for(const mode of ['scope','unmount','read-failure']){
    const state:NotificationsMutation=new lifecycle.NotificationsMutation();let finish!:()=>void,nav=0,current=true
    const pending=state.run({kind:'one',notice},()=>new Promise<void>(done=>{finish=done}),async()=>{if(mode==='read-failure')throw new ApiError('timeout')},()=>current,()=>{nav++})
    if(mode==='scope')current=false
    if(mode==='unmount')state.cancel()
    finish();await pending;assert.equal(nav,0)
    assert.equal(state.getSnapshot().status,mode==='unmount'?'idle':'uncertain')
  }
  for(const code of [400,401,403,404,409,422]){
    const state:NotificationsMutation=new lifecycle.NotificationsMutation()
    await state.run({kind:'all'},async()=>{throw new ApiError('http',code)},async()=>{},()=>true)
    assert.equal(state.getSnapshot().status,'rejected')
  }
})
