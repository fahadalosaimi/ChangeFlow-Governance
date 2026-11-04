import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'
import { createWorkspaceGateway } from '../src/features/auth/workspaceGateway.ts'
import type { AuthSnapshot } from '../src/features/auth/authStore.ts'
import { routeAllowed, resolveWorkspaceRoute, safeDestination } from '../src/app/routePolicy.ts'
const queries = await import('../src/features/changes/query.ts').catch(()=>null)
const dto = await import('../src/features/changes/decoders.ts').catch(()=>null)
const apis = await import('../src/features/changes/api.ts').catch(()=>null)
const resources = await import('../src/features/changes/resource.ts').catch(()=>null)
const assessment={risk_level:'Unknown stored value',impact_score:null,decision_recommendation:'Proceed',
  directly_affected_systems:['Local System'],indirectly_affected_systems:[],affected_departments:[],system_owners:[],
  previous_incidents:[],risk_factors:['Stored factor'],recommendations:[],rollback_plan:[],testing_checklist:[],ai_explanation:'Stored rationale'}
const record={id:100,requester_id:2,requester_name:'Requester',requester_email:null,title:'Local Change',description:'Controlled description',
  change_type:'application',change_mode:'Normal',priority:'High',status:'Approved',expected_downtime_minutes:0,rollback_complexity:'Medium',security_sensitivity:'Low',
  business_justification:null,planned_start:'2026-01-02T10:00:00',planned_end:null,created_at:'2026-01-02T10:00:00',updated_at:'2026-01-02T11:00:00',
  affected_system_ids:[1001],latest_assessment:assessment}
const invalid=(e:unknown)=>(e as {code:string}).code==='invalid_response'

test('Changes query serializes supported server filters and literal slash safely, rejects invalid windows/IDs/pages, and bounds pagination controls',()=>{
  assert.ok(queries)
  const q=queries.readChangesQuery(new URLSearchParams('page=2&page_size=10&search=billing%2Fpayments&status=Approved&requester_id=2&created_from=2026-01-01'))
  assert.equal(queries.serializeChangesQuery(q),'page=2&page_size=10&search=billing%2Fpayments&status=Approved&requester_id=2&created_from=2026-01-01')
  assert.equal(queries.readChangesQuery(new URLSearchParams('search=a%252Fb')).search,'a%2Fb')
  for(const bad of ['page=0','page=1e3','page_size=101','requester_id=-1','created_from=2026-02-31','created_from=2026-02-02&created_to=2026-01-01','status=Invented'])
    assert.throws(()=>queries.readChangesQuery(new URLSearchParams(bad)),e=>(e as {code:string}).code==='configuration')
  assert.deepEqual(queries.visiblePages(50,100),[48,49,50,51,52])
  assert.deepEqual(queries.visiblePages(1,2),[1,2])
})
test('Changes decoders preserve null/unknown historical assessment and isolate invalid assessment from valid primary fields',()=>{
  assert.ok(dto)
  const value=dto.decodeChange(record,2)
  assert.equal(value.assessment.state,'ready')
  assert.equal(value.assessment.value?.impact_score,null)
  assert.equal(value.assessment.value?.risk_level,'Unknown stored value')
  assert.equal(dto.decodeChange({...record,latest_assessment:null},2).assessment.state,'missing')
  for(const patch of [{impact_score:101},{risk_factors:[null]},{recommendations:null},{impact_score:undefined}])
    assert.equal(dto.decodeChange({...record,latest_assessment:{...assessment,...patch}},2).assessment.state,'invalid')
  for(const patch of [{id:0},{id:Number.MAX_SAFE_INTEGER+1},{requester_id:10},{affected_system_ids:[1001,1001]},
    {planned_start:'2026-02-31T10:00:00'},{title:null}]) assert.throws(()=>dto.decodeChange({...record,...patch},2),invalid)
  assert.equal(dto.creationInstant(record.created_at),'2026-01-02T10:00:00Z')
  assert.equal(dto.decodeChange(record,2).planned_start,'2026-01-02T10:00:00')
})
test('Server page totals never come from items and payload cannot substitute another query, requester or duplicate row',()=>{
  assert.ok(dto);assert.ok(queries)
  const q=queries.readChangesQuery(new URLSearchParams('page=2&page_size=5&status=Approved'))
  const page={items:[record],total:12,page:2,page_size:5,total_pages:3}
  assert.equal(dto.decodePage(page,q,2).total,12)
  for(const bad of [{...page,page:1},{...page,page_size:10},{...page,total_pages:1},{...page,items:[record,record]},
    {...page,items:[{...record,status:'Rejected'}]}]) assert.throws(()=>dto.decodePage(bad,q,2),invalid)
  assert.equal(dto.decodePage({...page,page:2,items:[],total:0,total_pages:1},q,2).total_pages,1)
  assert.throws(()=>dto.decodeRequesters([{id:2,organization_id:2,full_name:'Foreign',is_active:'active'}],1),invalid)
})
test('Changes API uses bound relative GETs and refuses unsafe IDs; a late response cannot cross the tenant/session binding',async()=>{
  assert.ok(apis);assert.ok(queries)
  const session=new ApiSession();session.setToken('fixture.payload.signature')
  let state={status:'authenticated',binding:'one'} as AuthSnapshot
  const urls:string[]=[];let hold=false;let release!:(r:Response)=>void
  const client=createApiClient({baseUrl:'https://api.example.test/api',trustedOrigins:['https://api.example.test'],session,
    fetcher:async(url,options)=>{
      urls.push(String(url));assert.equal(options?.method,'GET')
      if(hold)return new Promise(done=>{release=done})
      return new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json'}})
    }})
  const api=apis.createChangesApi(createWorkspaceGateway(client,()=>state,'one'),1,2)
  assert.equal((await api.detail(100)).id,100)
  assert.deepEqual(urls,['https://api.example.test/api/change-management/requests/100'])
  await assert.rejects(()=>api.detail(0),e=>(e as {code:string}).code==='configuration')
  assert.equal(urls.length,1)
  hold=true;const pending=api.detail(100);state={...state,binding:'two'}
  release(new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json'}}))
  await assert.rejects(pending,e=>(e as {code:string}).code==='session_changed')
})
test('Changes resources discard late success/error across filter/page/A→B/session keys and cleanup replay',async()=>{
  assert.ok(resources)
  const r=new resources.ChangesResource<string>()
  let release!:(s:string)=>void,fail!:(e:Error)=>void,signal!:AbortSignal
  const a=r.load('tenant1:page1',s=>{signal=s;return new Promise(done=>{release=done})})
  const b=r.load('tenant1:page2',()=>new Promise((_done,reject)=>{fail=reject}))
  await r.load('tenant2:filterB',async()=> 'current')
  release('stale');fail(new Error('private'));await Promise.all([a,b])
  assert.equal(signal.aborted,true)
  assert.deepEqual(r.getSnapshot(),{key:'tenant2:filterB',status:'ready',data:'current'})
  r.cancel();assert.equal('data' in r.getSnapshot(),false)
  await r.load('tenant2:filterB',async()=> 'replay');assert.equal(r.getSnapshot().data,'replay')
})
test('modern and legacy handoff routes require changes.read and retain existing create/revise grants',()=>{
  for(const p of ['/changes','/changes/100','/legacy/changes','/legacy/changes/100']) {
    assert.equal(routeAllowed(p,['changes.read']),true)
    assert.equal(routeAllowed(p,['identity.read','users.read']),false)
    assert.equal(safeDestination(p),p)
  }
  assert.equal(routeAllowed('/changes/new',['changes.read']),false)
  assert.equal(routeAllowed('/changes/100/revise',['changes.revise']),true)
  assert.equal(resolveWorkspaceRoute('/legacy/changes/01'),null)
})
