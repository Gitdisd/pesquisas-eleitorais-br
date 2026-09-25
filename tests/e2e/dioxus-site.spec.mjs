import { test, expect } from '@playwright/test'

test.describe('Rust/Dioxus migration browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'networkidle' })
    await page.waitForSelector('svg.chart', { state: 'visible' })
  })

  test('renders native SVG and poll data on desktop and mobile', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Pesquisas Eleitorais BR — 2026' })).toBeVisible()
    await expect(page.locator('svg.chart')).toHaveAttribute('role', 'img')
    await expect(page.locator('svg.chart')).toHaveAttribute(
      'aria-label',
      'Gráfico customizado de pesquisas eleitorais',
    )
    await expect(page.locator('.poll-point').first()).toBeVisible()
    expect(await page.locator('.poll-point').count()).toBeGreaterThan(0)
    expect(await page.locator('.echarts-container').count()).toBe(0)
  })

  test('exposes model-2 projection and native hover inspection', async ({ page }) => {
    await page.getByRole('button', { name: 'Casa', exact: true }).click()
    await expect(page.locator('.projection-status')).toContainText('Projeção v2')

    const chart = page.locator('svg.chart')
    const box = await chart.boundingBox()
    if (!box) throw new Error('chart has no layout box')
    await chart.hover({ position: { x: box.width / 2, y: Math.min(120, box.height / 2) } })
    await expect(page.locator('.hover-crosshair')).toBeVisible()
    await expect(page.locator('.hover-tooltip')).toBeVisible()
  })

  test('supports wheel zoom without a chart library', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'wheel gesture is desktop-only')
    const zoom = page.locator('.chart-navigation span')
    await expect(zoom).toHaveText('Zoom 1.0×')
    await page.locator('svg.chart').hover()
    await page.mouse.wheel(0, -700)
    await expect(zoom).not.toHaveText('Zoom 1.0×')
  })
})
