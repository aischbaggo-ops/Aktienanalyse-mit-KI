import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReanalyzeButton } from './ReanalyzeButton'

const render = (props: { disabled?: boolean; accessToken?: string }) =>
  renderToStaticMarkup(
    <ReanalyzeButton ticker="FE" accessToken={'accessToken' in props ? props.accessToken : 't'} disabled={props.disabled} onStarted={() => {}} />,
  )

describe('ReanalyzeButton', () => {
  it('zeigt "Neu analysieren" mit Kostenhinweis', () => {
    const html = render({})
    expect(html).toContain('Neu analysieren')
    expect(html).toContain('ohne 7-Tage-Cache')
    expect(html).toContain('ca. 0,04 USD')
    expect(html).not.toMatch(/ disabled=""/)
  })

  it('ist gesperrt, während ein Lauf läuft oder ohne Anmeldung', () => {
    expect(render({ disabled: true })).toMatch(/ disabled=""/)
    expect(render({ accessToken: undefined })).toMatch(/ disabled=""/)
  })
})
