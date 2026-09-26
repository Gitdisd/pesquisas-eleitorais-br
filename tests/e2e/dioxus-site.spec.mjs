import { test, expect } from '@playwright/test'

test.describe('Rust/Dioxus migration browser smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./', { waitUntil: 'networkidle' })
    await page.waitForSelector('svg.chart', { state: 'visible' })
  })

  test('renders the migrated native dashboard and poll data', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Pesquisas eleitorais')
    await expect(page.locator('svg.chart')).toHaveAttribute('role', 'img')
    await expect(page.locator('svg.chart')).toHaveAttribute(
      'aria-label',
      'Gráfico customizado de pesquisas eleitorais por candidato',
    )
    await expect(page.locator('.poll-point').first()).toBeVisible()
    expect(await page.locator('.poll-point').count()).toBeGreaterThan(0)
    expect(await page.locator('.echarts-container')).toHaveCount(0)
    await expect(page.locator('#overview')).toBeVisible()
    await expect(page.locator('#methodology')).toBeVisible()
  })

  test('migrated controls change the Rust/Dioxus view', async ({ page }) => {
    await page.getByRole('button', { name: '2º turno', exact: true }).first().click()
    await expect(page.locator('.chart-subtitle')).toContainText('2º turno')

    await page.getByRole('button', { name: '90d', exact: true }).click()
    await expect(page.locator('.chart-navigation span')).toContainText('Zoom 1.0×')

    await page.getByRole('button', { name: '30d', exact: true }).first().click()
    await page.getByRole('button', { name: '7d', exact: true }).click()
  })

  test('candidate focus and overlay toggles are native Rust state', async ({ page }) => {
    const lula = page.getByRole('button', { name: 'Lula', exact: true }).last()
    await expect(lula).toHaveAttribute('aria-pressed', 'true')
    const visibleBefore = await page.locator('.series-line').count()
    await lula.click()
    await expect(lula).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.series-line')).toHaveCount(visibleBefore - 1)

    const overlay = page.getByRole('button', { name: 'SMA 7', exact: true })
    await overlay.click()
    await expect(overlay).toHaveAttribute('aria-pressed', 'true')

    await lula.click()
    await expect(lula).toHaveAttribute('aria-pressed', 'true')
    expect(await page.locator('.overlay-line').count()).toBeGreaterThan(0)
  })

  test('model-2 projection and native hover inspection remain available', async ({ page }) => {
    await page.getByRole('button', { name: 'Casa', exact: true }).click()
    await page.getByRole('button', { name: 'Desligada', exact: true }).click()
    await expect(page.locator('.projection-status')).toContainText('Projeção v2')

    const chart = page.locator('svg.chart').first()
    const box = await chart.boundingBox()
    if (!box) throw new Error('chart has no layout box')
    await chart.hover({ position: { x: box.width / 2, y: Math.min(120, box.height / 2) } })
    const crosshair = page.locator('.hover-crosshair').first()
    await expect(crosshair).toHaveCount(1)
    const crosshairX1 = await crosshair.getAttribute('x1')
    const crosshairX2 = await crosshair.getAttribute('x2')
    expect(crosshairX1).toBeTruthy()
    expect(crosshairX1).toBe(crosshairX2)
  })

  test('table search, language, theme, refresh and regional surface are migrated', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: /Filtrar instituto/i })
    await expect(search).toBeVisible()
    const before = await page.locator('#pollsPanel tbody tr').count()
    await search.fill('atlas')
    const after = await page.locator('#pollsPanel tbody tr').count()
    expect(after).toBeLessThanOrEqual(before)

    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page).toHaveTitle(/Brazilian Electoral Polls/)
    await page.getByRole('button', { name: /CRT amber/i }).click()
    await expect(page.locator('.app-shell')).toHaveAttribute('style', /--bg:/)

    await expect(page.getByRole('button', { name: /Atualizar|Refresh/ })).toBeVisible()
    if (await page.locator('#allSourcesPanel').count()) {
      await expect(page.locator('#allSourcesPanel')).toBeVisible()
    }
  })

  test('supports wheel zoom on desktop without a chart library', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', 'wheel gesture is desktop-only')
    const zoom = page.locator('.chart-navigation span')
    await expect(zoom).toHaveText('Zoom 1.0×')
    await page.locator('svg.chart').hover()
    await page.mouse.wheel(0, -700)
    await expect(zoom).not.toHaveText('Zoom 1.0×')
  })
})
