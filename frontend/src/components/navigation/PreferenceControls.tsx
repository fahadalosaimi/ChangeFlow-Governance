import { useTranslation } from 'react-i18next'
import { usePreferences } from '../../preferences/context.ts'
import { Icon } from '../ui/Icon.tsx'
import { Button, SelectField } from '../ui/Primitives.tsx'

export function PreferenceControls() {
  const { t } = useTranslation('common')
  const { state, store } = usePreferences()
  return <div className="preferences">
    <div className="language-control"><Icon name="language" />
      <SelectField label={t('preferences.language')} value={state.language} data-language-switch
        onChange={event => store.setLanguage(event.target.value === 'en' ? 'en' : 'ar-SA')}>
        <option value="ar-SA" lang="ar-SA">{t('preferences.arabic')}</option><option value="en" lang="en">{t('preferences.english')}</option>
      </SelectField>
    </div>
    <Button variant="ghost" className="btn-icon theme-trigger" data-theme-switch
      aria-label={t(state.theme === 'dark' ? 'preferences.light' : 'preferences.dark')}
      onClick={() => store.setTheme(state.theme === 'dark' ? 'light' : 'dark')}>
      <Icon key={state.theme} name={state.theme === 'dark' ? 'sun' : 'moon'} />
    </Button>
  </div>
}
