import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const luminance = hex => {
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(value => value + value).join('');
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };

for (const mode of ['light', 'dark', 'contrast']) test(`${mode} semantic text and action colours meet AA contrast`, () => {
  const declarations = [...css.matchAll(new RegExp(`(?:^|\\n)(?::root,)?\\[data-theme="${mode}"\\]\\{([^}]+)\\}`, 'g'))].map(match => match[1]).join(';');
  const tokens = Object.fromEntries([...declarations.matchAll(/--([\w-]+):(#[\da-f]+)/g)].map(match => [match[1], match[2]]));
  for (const background of ['bg', 'surface', 'soft']) for (const text of ['ink', 'muted']) assert.ok(contrast(tokens[text], tokens[background]) >= 4.5, `${text} on ${background}`);
  assert.ok(contrast(tokens['on-accent'], tokens.accent) >= 4.5, 'selected actions');
  for (const status of ['warning', 'danger']) assert.ok(contrast(tokens[status], tokens[`${status}-soft`]) >= 4.5, status);
  assert.ok(contrast(tokens['control-border'], tokens.bg) >= 3, 'input border');
});
