export const securityNames = ['login', 'A05', 'A06-control', 'A06-race', 'isolation', 'routes', 'session-boundaries']
export const presentationNames = ['P02-rtl', 'P02-ltr', 'P02-disabled', 'P02-frozen']
export const systemsNames = ['systems-catalog', 'systems-details', 'systems-races', 'systems-boundaries', 'systems-layout']
export const dashboardNames = ['dashboard-data','dashboard-faults','dashboard-races','dashboard-boundaries','dashboard-roles','dashboard-layout']

export function expectedCases(selection) {
  const all = [...securityNames, ...presentationNames]
  if (selection === 'dashboard') return [...dashboardNames]
  if (dashboardNames.includes(selection)) return [selection]
  if (selection === 'dashboard-forward') return [...all,...systemsNames,...dashboardNames]
  if (selection === 'dashboard-reverse') return [...all,...systemsNames,...dashboardNames].reverse()
  if (selection === 'systems-probe') return ['systems-catalog','systems-layout']
  if (selection === 'systems') return [...systemsNames]
  if (systemsNames.includes(selection)) return [selection]
  if (selection === 'systems-forward') return [...all, ...systemsNames]
  if (selection === 'systems-reverse') return [...all, ...systemsNames].reverse()
  if (selection === 'security') return [...securityNames]
  if (selection === 'presentation' || selection === 'P02') return [...presentationNames]
  if (selection === 'forward') return all
  if (selection === 'reverse') return all.reverse()
  if (selection === 'A06') return ['A06-control', 'A06-race']
  return all.includes(selection) ? [selection] : []
}

export function validateGateResults(rows, selection, exit) {
  const expected = expectedCases(selection)
  const results = rows.filter(row => 'case' in row)
  const lifecycle = rows.filter(row => 'contexts' in row || 'browser_exit' in row)
  return exit === 0 && expected.length > 0 && results.length === expected.length
    && results.every((row, index) => row.case === expected[index] && row.status === 'passed'
      && Number.isFinite(row.duration_ms) && row.duration_ms >= 0)
    && !rows.some(row => row.failed || row.exit)
    && lifecycle.length > 0 && lifecycle.every(row => row.contexts === 0 && row.browser_exit === 0)
}
