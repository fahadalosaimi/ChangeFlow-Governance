// Test-only WCAG sRGB contrast for opaque normal-size text. Unsupported samples
// fail closed; this supplements Axe rather than suppressing any Axe violation.
const color = value => Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&n>=0&&n<=255)
export function contrastRatio(foreground,background) {
  if(!color(foreground)||!color(background)) return 0
  const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4)
    .reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0)
  const a=luminance(foreground),b=luminance(background)
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)
}
export const meetsTextContrast = sample => Boolean(sample&&contrastRatio(sample.foreground,sample.background)>=4.5)

// Serialized by locator.evaluate; use only this DOM node's computed CSS colors.
export function measuredTextColors(element) {
  const parse=value=>{
    const match=/^rgba?\(([^)]+)\)$/.exec(value)
    if(!match) return null
    const channels=match[1].split(',').map(Number)
    return channels.length===3||channels[3]===1?channels.slice(0,3):null
  }
  const foreground=parse(getComputedStyle(element).color)
  for(let parent=element;parent;parent=parent.parentElement) {
    const background=getComputedStyle(parent).backgroundColor
    if(background==='rgba(0, 0, 0, 0)'||background==='transparent') continue
    return {foreground,background:parse(background)}
  }
  return {foreground,background:null}
}
