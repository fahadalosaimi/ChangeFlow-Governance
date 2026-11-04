import { useTranslation } from 'react-i18next'
import { Button,StateCard } from '../../components/ui/Primitives.tsx'
export function ChangesState({error,retry,section=false}:{error?:string;retry?:()=>void;section?:boolean}) {
  const {t}=useTranslation('changes')
  const kind=error==='forbidden'?'forbidden':error==='not_found'?'missing':error==='timeout'?'timeout':error?'error':'loading'
  return <div className="changes-state" aria-busy={!error}><StateCard state={`changes-${kind}`} level={section?2:1}
    title={t(`${kind}.title`)} body={t(`${kind}.body`)} loading={!error}>
    {error&&retry&&<Button variant="secondary" onClick={retry}>{t('retry')}</Button>}
  </StateCard></div>
}
export function ChangeValue({value,category}:{value:string|null;category:string}) {
  const {t,i18n}=useTranslation('changes')
  if(value===null)return <>{t('unavailable')}</>
  if(category==='recommendation'&&!i18n.exists(`changes:enum.recommendation.${value}`,{fallbackLng:false}))return <>{t('unknownRecommendation')}</>
  return <bdi>{i18n.exists(`changes:enum.${category}.${value}`,{fallbackLng:false})?t(`enum.${category}.${value}`):t('unknown',{value})}</bdi>
}
