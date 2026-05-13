const BINANCE_API = 'https://api.binance.com/api/v3/klines';
const DEFAULT_LIMIT = 365;

export function simpleMovingAverage(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return average(slice);
  });
}

export function exponentialMovingAverage(values, period) {
  const multiplier = 2 / (period + 1);
  let previous = null;

  return values.map((value, index) => {
    if (index + 1 < period) return null;
    if (previous === null) {
      previous = average(values.slice(index + 1 - period, index + 1));
      return previous;
    }
    previous = (value - previous) * multiplier + previous;
    return previous;
  });
}

export function calculateRsi(values, period = 14) {
  const rsi = Array(values.length).fill(null);
  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  rsi[period] = rsiFromAverages(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    rsi[index] = rsiFromAverages(averageGain, averageLoss);
  }

  return rsi;
}

export function calculateMacd(values, fastPeriod = 14, slowPeriod = 28, signalPeriod = 9) {
  const fast = exponentialMovingAverage(values, fastPeriod);
  const slow = exponentialMovingAverage(values, slowPeriod);
  const macdLine = values.map((_, index) => (
    fast[index] === null || slow[index] === null ? null : fast[index] - slow[index]
  ));
  const signalLine = emaWithNulls(macdLine, signalPeriod);
  const histogram = macdLine.map((value, index) => (
    value === null || signalLine[index] === null ? null : value - signalLine[index]
  ));

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(values, period = 20, deviation = 2) {
  return values.map((_, index) => {
    if (index + 1 < period) return { middle: null, upper: null, lower: null };
    const slice = values.slice(index + 1 - period, index + 1);
    const middle = average(slice);
    const variance = average(slice.map((value) => (value - middle) ** 2));
    const standardDeviation = Math.sqrt(variance);
    return {
      middle,
      upper: middle + deviation * standardDeviation,
      lower: middle - deviation * standardDeviation,
    };
  });
}

export function analyzeMarket(candles, symbol) {
  const closes = candles.map((candle) => candle.close);
  const ma100 = simpleMovingAverage(closes, 100);
  const ma200 = simpleMovingAverage(closes, 200);
  const rsi = calculateRsi(closes, 14);
  const macd = calculateMacd(closes, 14, 28, 9);
  const bollinger = calculateBollingerBands(closes, 20, 2);
  const index = closes.length - 1;
  const previous = index - 1;
  const latest = {
    price: closes[index],
    ma100: ma100[index],
    ma200: ma200[index],
    rsi: rsi[index],
    macd: macd.macdLine[index],
    macdSignal: macd.signalLine[index],
    macdHistogram: macd.histogram[index],
    bollinger: bollinger[index],
  };

  const entryReasons = [];
  const exitReasons = [];

  if (latest.ma100 && latest.ma200 && latest.price > latest.ma100 && latest.price > latest.ma200 && latest.ma100 > latest.ma200) {
    entryReasons.push('قیمت بالاتر از MA100 و MA200 است و روند اصلی صعودی دیده می‌شود.');
  }
  if (latest.ma100 && latest.price < latest.ma100) {
    exitReasons.push('قیمت زیر MA100 قرار گرفته و مومنتوم کوتاه‌تر ضعیف شده است.');
  }
  if (latest.ma200 && latest.price < latest.ma200) {
    exitReasons.push('قیمت زیر MA200 است و روند بلندمدت ریسک نزولی دارد.');
  }

  const bullishMacd = macd.macdLine[previous] !== null && macd.signalLine[previous] !== null
    && macd.macdLine[previous] <= macd.signalLine[previous]
    && latest.macd > latest.macdSignal;
  const bearishMacd = macd.macdLine[previous] !== null && macd.signalLine[previous] !== null
    && macd.macdLine[previous] >= macd.signalLine[previous]
    && latest.macd < latest.macdSignal;

  if (bullishMacd || latest.macdHistogram > 0) {
    entryReasons.push('MACD 14 بالاتر از خط سیگنال یا در ناحیه مثبت قرار دارد.');
  }
  if (bearishMacd || latest.macdHistogram < 0) {
    exitReasons.push('MACD 14 زیر خط سیگنال یا در ناحیه منفی قرار دارد.');
  }

  if (latest.rsi >= 45 && latest.rsi <= 68) {
    entryReasons.push('RSI در محدوده سالم ورود است؛ نه بیش‌خرید و نه خیلی ضعیف.');
  }
  if (latest.rsi > 70) {
    exitReasons.push('RSI بالای ۷۰ است و احتمال اصلاح به خاطر بیش‌خرید وجود دارد.');
  }
  if (latest.rsi < 40) {
    exitReasons.push('RSI زیر ۴۰ است و فشار فروش غالب است.');
  }

  if (latest.bollinger.lower && latest.price <= latest.bollinger.lower * 1.02 && latest.rsi < 45) {
    entryReasons.push('قیمت نزدیک باند پایینی بولینگر است و می‌تواند فرصت برگشت کوتاه‌مدت باشد.');
  }
  if (latest.bollinger.upper && latest.price >= latest.bollinger.upper * 0.99) {
    exitReasons.push('قیمت به باند بالایی بولینگر رسیده و احتمال ذخیره سود بیشتر است.');
  }

  const entryScore = entryReasons.length;
  const exitScore = exitReasons.length;
  const action = entryScore >= 3 && entryScore > exitScore
    ? 'buy'
    : exitScore >= 2 && exitScore >= entryScore
      ? 'sell'
      : 'wait';

  return {
    symbol,
    candles,
    indicators: { ma100, ma200, rsi, macd, bollinger },
    latest,
    action,
    entryScore,
    exitScore,
    reasons: action === 'buy' ? entryReasons : action === 'sell' ? exitReasons : [...entryReasons, ...exitReasons].slice(0, 4),
  };
}

async function fetchCandles(symbol, interval, limit) {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  const response = await fetch(`${BINANCE_API}?${params}`);
  if (!response.ok) throw new Error(`Binance API error for ${symbol}`);
  const rows = await response.json();
  return rows.map((row) => ({
    time: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rsiFromAverages(averageGain, averageLoss) {
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - (100 / (1 + relativeStrength));
}

function emaWithNulls(values, period) {
  const result = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let previous = null;
  let validValues = [];

  values.forEach((value, index) => {
    if (value === null) return;
    validValues.push(value);
    if (validValues.length < period) return;
    if (previous === null) previous = average(validValues.slice(-period));
    else previous = (value - previous) * multiplier + previous;
    result[index] = previous;
  });

  return result;
}

function formatPrice(value) {
  if (value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: value > 100 ? 2 : 6 }).format(value);
}

function parseSymbols(input) {
  return input
    .split(/[،,\s]+/)
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12);
}

function actionLabel(action) {
  if (action === 'buy') return 'ورود';
  if (action === 'sell') return 'خروج';
  return 'انتظار';
}

function renderSignals(results) {
  const container = document.querySelector('#signals');
  container.innerHTML = results.map((result, index) => `
    <article class="signal-item" role="button" tabindex="0" data-index="${index}">
      <div class="signal-head">
        <span class="symbol">${result.symbol}</span>
        <span class="badge ${result.action}">${actionLabel(result.action)}</span>
      </div>
      <div class="metrics">
        <div>قیمت: <span>${formatPrice(result.latest.price)}</span></div>
        <div>RSI: <span>${formatPrice(result.latest.rsi)}</span></div>
        <div>MA100: <span>${formatPrice(result.latest.ma100)}</span></div>
        <div>MA200: <span>${formatPrice(result.latest.ma200)}</span></div>
      </div>
      <ul class="reasons">
        ${result.reasons.length ? result.reasons.map((reason) => `<li>${reason}</li>`).join('') : '<li>تایید کافی برای ورود یا خروج وجود ندارد.</li>'}
      </ul>
    </article>
  `).join('');

  container.querySelectorAll('.signal-item').forEach((item) => {
    item.addEventListener('click', () => renderChart(results[Number(item.dataset.index)]));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') renderChart(results[Number(item.dataset.index)]);
    });
  });
}

function renderChart(result) {
  document.querySelector('#activeSymbol').textContent = result.symbol;
  const canvas = document.querySelector('#priceChart');
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 28, right: 58, bottom: 34, left: 20 };
  const start = Math.max(0, result.candles.length - 180);
  const candles = result.candles.slice(start);
  const closes = candles.map((candle) => candle.close);
  const ma100 = result.indicators.ma100.slice(start);
  const ma200 = result.indicators.ma200.slice(start);
  const upper = result.indicators.bollinger.slice(start).map((band) => band.upper);
  const lower = result.indicators.bollinger.slice(start).map((band) => band.lower);
  const allValues = [...closes, ...ma100, ...ma200, ...upper, ...lower].filter((value) => value !== null);
  const min = Math.min(...allValues) * 0.995;
  const max = Math.max(...allValues) * 1.005;

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#020617';
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height, padding, min, max);

  drawLine(context, lower, '#334155', width, height, padding, min, max);
  drawLine(context, upper, '#334155', width, height, padding, min, max);
  drawLine(context, ma200, '#f59e0b', width, height, padding, min, max);
  drawLine(context, ma100, '#38bdf8', width, height, padding, min, max);
  drawLine(context, closes, '#22c55e', width, height, padding, min, max, 3);
  drawLegend(context);
}

function drawLine(context, values, color, width, height, padding, min, max, lineWidth = 2) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  context.beginPath();
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  let started = false;

  values.forEach((value, index) => {
    if (value === null) return;
    const x = padding.left + (index / (values.length - 1)) * chartWidth;
    const y = padding.top + (1 - (value - min) / (max - min)) * chartHeight;
    if (!started) {
      context.moveTo(x, y);
      started = true;
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
}

function drawGrid(context, width, height, padding, min, max) {
  context.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  context.fillStyle = '#94a3b8';
  context.font = '13px Arial';
  const chartHeight = height - padding.top - padding.bottom;

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (index / 4) * chartHeight;
    const value = max - (index / 4) * (max - min);
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.fillText(formatPrice(value), width - padding.right + 8, y + 4);
  }
}

function drawLegend(context) {
  const items = [
    ['قیمت', '#22c55e'],
    ['MA100', '#38bdf8'],
    ['MA200', '#f59e0b'],
    ['Bollinger', '#334155'],
  ];
  context.font = '13px Tahoma';
  items.forEach(([label, color], index) => {
    const x = 24 + index * 110;
    context.fillStyle = color;
    context.fillRect(x, 18, 22, 4);
    context.fillStyle = '#cbd5e1';
    context.fillText(label, x + 30, 23);
  });
}

function makeDemoCandles(limit = DEFAULT_LIMIT) {
  let price = 42000;
  return Array.from({ length: limit }, (_, index) => {
    const wave = Math.sin(index / 15) * 900 + Math.cos(index / 29) * 500;
    price = Math.max(1000, price + wave * 0.02 + (Math.random() - 0.45) * 260);
    return {
      time: Date.now() - (limit - index) * 86_400_000,
      open: price * 0.99,
      high: price * 1.02,
      low: price * 0.98,
      close: price,
      volume: 1000 + index,
    };
  });
}

async function runAnalysis() {
  const button = document.querySelector('#analyzeBtn');
  const status = document.querySelector('#status');
  const symbols = parseSymbols(document.querySelector('#symbols').value);
  const interval = document.querySelector('#interval').value;
  const limit = Math.max(Number(document.querySelector('#limit').value), 220);

  if (!symbols.length) {
    status.textContent = 'حداقل یک نماد وارد کنید؛ مثال: BTCUSDT';
    return;
  }

  button.disabled = true;
  status.textContent = 'در حال دریافت داده و محاسبه اندیکاتورها...';

  try {
    const results = await Promise.all(symbols.map(async (symbol) => {
      const candles = await fetchCandles(symbol, interval, limit);
      return analyzeMarket(candles, symbol);
    }));
    renderSignals(results);
    renderChart(results[0]);
    status.textContent = `${results.length} رمز ارز با موفقیت تحلیل شد.`;
  } catch (error) {
    const demo = analyzeMarket(makeDemoCandles(limit), 'DEMO');
    renderSignals([demo]);
    renderChart(demo);
    status.textContent = `دریافت داده زنده ممکن نشد؛ نسخه نمایشی نمایش داده شد. خطا: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

if (typeof document !== 'undefined') {
  document.querySelector('#analyzeBtn').addEventListener('click', runAnalysis);
}
