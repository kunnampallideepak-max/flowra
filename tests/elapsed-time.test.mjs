import test from 'node:test';
import assert from 'node:assert/strict';
import { formatElapsedTime } from '../lib/elapsed-time.mjs';

test('elapsed labels round to whole seconds and carry across minute boundaries', () => {
  for (const [minutes, display] of [[0, '0 min'], [5 / 60, '5 sec'], [59.9 / 60, '1 min'], [4, '4 min'], [280 / 60, '4 min 40 sec']]) {
    assert.equal(formatElapsedTime(minutes), display);
  }
});
