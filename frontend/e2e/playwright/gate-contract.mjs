export const securityNames = ['login', 'A05', 'A06-control', 'A06-race', 'isolation', 'routes', 'session-boundaries']
export const presentationNames = ['P02-rtl', 'P02-ltr', 'P02-disabled', 'P02-frozen']

export function expectedCases(selection) {
  const all = [...securityNames, ...presentationNames]
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
