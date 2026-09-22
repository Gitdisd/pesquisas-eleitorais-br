import { test, expect } from 'playwright/test'

test.describe('polling site browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__pebr?.polls?.length))
    await page.waitForSelector('#chartPanel .echarts-container', { state: 'visible' })
    await page.waitForSelector('#allSourcesPanel .echarts-container', { state: 'visible' })
  })

  test('renders both charts, data table and accessible chart containers', async ({ page }) => {
    await expect(page.locator('#tbody tr').first()).toBeVisible()
    await expect(page.locator('#chartPanel .echarts-container[role="img"]')).toHaveAttribute(
      'aria-label',
      /Evolução da intenção de voto/,
    )
    await expect(page.locator('#allSourcesPanel .echarts-container[role="img"]')).toHaveAttribute(
      'aria-label',
      /todas as fontes/i,
    )

    const chartIdentity = await page.evaluate(() => ({
      national: window.__pebrE2E?.nationalChart?.id,
      regional: window.__pebrE2E?.regionalChart?.id,
      distinct: window.__pebrE2E?.nationalChart !== window.__pebrE2E?.regionalChart,
    }))
    expect(chartIdentity.distinct).toBe(true)
    expect(chartIdentity.national).toBeTruthy()
    expect(chartIdentity.regional).toBeTruthy()
  })

  test('loads the actual browser WASM adapter and reports truthful parity state', async ({ page }) => {
    await page.waitForFunction(() => Boolean(window.__pebr?.wasm))
    const wasm = await page.evaluate(() => window.__pebr.wasm)
    expect(wasm.available).toBe(true)
    expect(wasm.source).toBe('wasm')
    expect(wasm.runtimeVerified).toBe(true)
    expect(wasm.parityOk).toBe(true)
    expect(wasm.parityDifference).not.toBeNull()
    expect(Number(wasm.parityDifference)).toBeLessThan(1e-12)
  })

  test('keeps low-value second-round series visible and preserves zoom/legend state across chart refresh', async ({ page }) => {
    const firstCandidate = page.locator('.candidate-focus button[data-candidate]').first()
    await firstCandidate.click()
    const hiddenCandidate = await firstCandidate.getAttribute('data-candidate')

    await page.evaluate(() => {
      const chart = window.__pebrE2E.nationalChart
      chart.dispatchAction({ type: 'dataZoom', start: 15, end: 70 })
    })

    await page.locator('[data-round="2"]').click()

    const result = await page.evaluate((hiddenCandidate) => {
      const chart = window.__pebrE2E.nationalChart
      const option = chart.getOption()
      const yAxis = option.yAxis?.[0] || {}
      const zoom = (option.dataZoom || []).find((z) => z.xAxisIndex === 0 && (z.start != null || z.end != null))
      const selected = option.legend?.[0]?.selected || {}
      return {
        yMin: Number(yAxis.min),
        zoomStart: zoom?.start,
        zoomEnd: zoom?.end,
        hidden: selected[hiddenCandidate],
        hasLowRound2Series: (option.series || []).some((s) =>
          s.seriesRole === 'poll' && /branco|nulo/i.test(String(s.name))),
      }
    }, hiddenCandidate)

    expect(result.yMin).toBeLessThan(20)
    expect(result.zoomStart).toBeCloseTo(15, 0)
    expect(result.zoomEnd).toBeCloseTo(70, 0)
    expect(result.hidden).toBe(false)
    expect(result.hasLowRound2Series).toBe(true)
  })
})
