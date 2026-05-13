import assert from 'node:assert/strict';
import {
  analyzeMarket,
  calculateBollingerBands,
  calculateMacd,
  calculateRsi,
  simpleMovingAverage,
} from '../app.js';

const values = Array.from({ length: 240 }, (_, index) => 100 + index * 0.8 + Math.sin(index / 6) * 4);
const candles = values.map((close, index) => ({
  time: index,
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close,
  volume: 1000,
}));

const ma = simpleMovingAverage(values, 100);
assert.equal(ma[98], null);
assert.ok(ma[99] > 100);
assert.ok(ma.at(-1) > ma[120]);

const rsi = calculateRsi(values, 14);
assert.equal(rsi[13], null);
assert.ok(rsi.at(-1) > 50);
assert.ok(rsi.at(-1) <= 100);

const macd = calculateMacd(values, 14, 28, 9);
assert.equal(macd.macdLine[26], null);
assert.ok(Number.isFinite(macd.macdLine.at(-1)));
assert.ok(Number.isFinite(macd.signalLine.at(-1)));

const bands = calculateBollingerBands(values, 20, 2);
assert.equal(bands[18].middle, null);
assert.ok(bands.at(-1).upper > bands.at(-1).middle);
assert.ok(bands.at(-1).middle > bands.at(-1).lower);

const analysis = analyzeMarket(candles, 'TESTUSDT');
assert.equal(analysis.symbol, 'TESTUSDT');
assert.ok(['buy', 'sell', 'wait'].includes(analysis.action));
assert.ok(analysis.latest.ma100 > 0);
assert.ok(analysis.latest.ma200 > 0);

console.log('indicator calculations passed');
