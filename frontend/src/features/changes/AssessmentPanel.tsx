import { useTranslation } from 'react-i18next'
import { Notice } from '../../components/ui/Primitives.tsx'
import { formatNumber } from '../../localization/formatters.ts'
import type { Language } from '../../preferences/store.ts'
import { assessmentLists,type AssessmentState } from './decoders.ts'
import { ChangeValue } from './ChangesState.tsx'
export function AssessmentPanel({assessment,compact=false}:{assessment:AssessmentState;compact?:boolean}) {
  const {t,i18n}=useTranslation('changes')
  if(assessment.state!=='ready'||!assessment.value)return <p data-assessment={assessment.state}>{t(assessment.state==='missing'?'noAssessment':'invalidAssessment')}</p>
  const value=assessment.value
  const summary=<dl className="changes-assessment-facts">
    <div><dt>{t('storedRisk')}</dt><dd><ChangeValue category="risk" value={value.risk_level}/></dd></div>
    <div><dt>{t('storedScore')}</dt><dd>{value.impact_score===null?t('unavailable'):formatNumber(value.impact_score,i18n.language as Language)+'/100'}</dd></div>
    <div><dt>{t('storedRecommendation')}</dt><dd><ChangeValue category="recommendation" value={value.decision_recommendation}/></dd></div>
  </dl>
  if(compact)return <div className="changes-assessment-compact" data-assessment="ready">{summary}</div>
  return <section className="changes-assessment" aria-labelledby="changes-assessment-title" data-assessment="ready">
    <h2 id="changes-assessment-title">{t('assessment')}</h2><Notice><p>{t('assessmentWarning')}</p></Notice>{summary}
    <p className="muted small">{t('originalNarrative')}</p>
    <div className="changes-narrative" lang="en" dir="ltr"><p>{value.ai_explanation??t('unavailable')}</p></div>
    <div className="changes-assessment-sections">{assessmentLists.map(key=><section key={key} aria-labelledby={`assessment-${key}`}>
      <h3 id={`assessment-${key}`}>{t(`assessmentLists.${key}`)}</h3>
      {value[key].length?<ul lang="en" dir="ltr">{value[key].map((item,index)=><li key={index}>{item}</li>)}</ul>:<p>{t('noItems')}</p>}
    </section>)}</div>
  </section>
}
