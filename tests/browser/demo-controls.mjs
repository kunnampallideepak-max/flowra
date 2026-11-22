export async function openDemoSettings(page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Demo & settings', exact: true }).click();
}
export async function demoControl(page, name, stay = false) {
  const previous = await page.evaluate(() => location.hash || '#overview');
  await openDemoSettings(page);
  await page.getByRole('button', { name, exact: true }).click();
  if (!stay && previous !== '#about') await page.locator(`.sidebar nav a[href="${previous}"]`).click();
}
