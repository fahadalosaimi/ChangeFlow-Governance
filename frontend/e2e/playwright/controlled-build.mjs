import {resolve,dirname,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
// Used exclusively by the owned Playwright build, never imported by application code.
export async function controlledBuild({api,root,nonce,fetcher=fetch}){
  const url=new URL(api)
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash||url.pathname!=='/'
    ||!isAbsolute(root)||!root.split(/[\\/]/).some(part=>/^changeflow-a5-run-[\w-]+$/.test(part))||!/^\w{64}$/.test(nonce??''))throw new Error('Unowned controlled build')
  const response=await fetcher(`${url.origin}/_test/controlled-writes`,{headers:{'X-Synthetic-Ownership':nonce},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(3000)})
  const proof=await response.json()
  if(!response.ok||response.redirected||proof.mode!=='owned-synthetic-postgresql'||proof.nonce!==nonce)throw new Error('Unowned controlled build')
  const virtual='\0changeflow-owned-write-boundary',frontend=fileURLToPath(new URL('../..',import.meta.url))
  return {name:'owned-synthetic-write-boundary',enforce:'pre',
    resolveId(id,importer){
      if(importer&&resolve(dirname(importer),id).replaceAll('\\','/').endsWith('/src/features/change-editor/boundary.ts'))return virtual
    },
    load(id){if(id!==virtual)return
      return `import {ApiError} from ${JSON.stringify(resolve(frontend,'src/services/api/errors.ts'))};
        export const controlledWritesAvailable=true;
        export async function assertControlledWrite(){
          try {const response=await fetch(${JSON.stringify(url.origin+'/_test/controlled-writes')},{headers:{'X-Synthetic-Ownership':${JSON.stringify(nonce)}},redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)});
            const proof=await response.json();if(!response.ok||response.redirected||proof.mode!=='owned-synthetic-postgresql'||proof.nonce!==${JSON.stringify(nonce)})throw new Error();
          }catch{throw new ApiError('configuration')}
        }`
    }}
}
