import '@fontsource-variable/plus-jakarta-sans';
import './styles/dashboard.css';
import demoAvatar from './assets/demo-avatar.jpg';
import { CURRENCY_CONFIG, DEFAULT_STATE } from './data/demo-data.js';

const STORAGE_KEY = 'valora_wealth_dashboard_v2';

let state = loadState();
let currentTab = 'dashboard';
let cardRevealed = false;
let assetPage = 1;
let txPage = 1;
const ITEMS_PER_PAGE = 5;
let selectedAssetIds = new Set();
let selectedTxIds = new Set();
let liveMarketInterval = null;
let activeDrawerAssetId = null;
let activeTradeSide = 'buy';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...JSON.parse(JSON.stringify(DEFAULT_STATE)), ...parsed };
    }
  } catch (e) {
    console.warn('Fallback to default state', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetDemoData() {
  localStorage.removeItem(STORAGE_KEY);
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  selectedAssetIds.clear();
  selectedTxIds.clear();
  renderAll();
  startLiveMarketEngine();
  showToast('Data portofolio berhasil dikembalikan ke pengaturan awal.', 'info');
}

// =========================================================================
// MULTI-CURRENCY FORMATTERS
// =========================================================================
function getCurrencyMeta() {
  return CURRENCY_CONFIG[state.currency] || CURRENCY_CONFIG.USD;
}

function formatCompactCurrency(usdAmount) {
  const { symbol, rate } = getCurrencyMeta();
  const converted = usdAmount * rate;
  if (state.currency === 'IDR') {
    if (converted >= 1e9) return symbol + (converted / 1e9).toFixed(2) + 'M';
    if (converted >= 1e6) return symbol + (converted / 1e6).toFixed(1) + 'jt';
    return symbol + Math.round(converted).toLocaleString('id-ID');
  }
  if (Math.abs(converted) >= 1000) {
    return symbol + (converted / 1000).toFixed(1) + 'k';
  }
  return symbol + converted.toFixed(0);
}

function formatDotThousands(usdAmount) {
  const { rate } = getCurrencyMeta();
  const val = Math.round(usdAmount * rate);
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCurrencyFull(usdAmount) {
  const { symbol, rate } = getCurrencyMeta();
  const val = usdAmount * rate;
  if (state.currency === 'IDR') {
    return symbol + ' ' + Math.round(val).toLocaleString('id-ID');
  }
  return symbol + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function changeCurrency(newCurr) {
  state.currency = newCurr;
  saveState();
  renderAll();
  if (activeDrawerAssetId) openAssetTradeDrawer(activeDrawerAssetId);
  showToast(`Mata uang tampilan diubah ke ${newCurr}`, 'info');
}

// Calculate Dynamic Totals
function calculateMetrics() {
  const totalAssetsValue = state.assets.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const stocksValue = state.assets
    .filter(a => a.category === 'Stocks')
    .reduce((acc, item) => acc + (item.price * item.qty), 0);
  const walletTotal = state.cashBalance + totalAssetsValue;

  return {
    totalAssetsValue,
    stocksValue,
    cashBalance: state.cashBalance,
    walletTotal
  };
}

// =========================================================================
// LIVE MARKET TICKER ENGINE
// =========================================================================
function startLiveMarketEngine() {
  clearInterval(liveMarketInterval);
  if (!state.liveMarket) return;
  liveMarketInterval = setInterval(() => {
    simulateMarketTick(false);
  }, 3800);
}

function toggleLiveMarket() {
  state.liveMarket = !state.liveMarket;
  saveState();
  updateLiveTickerUI();
  if (state.liveMarket) {
    startLiveMarketEngine();
    showToast('Live Market Ticker diaktifkan.', 'success');
  } else {
    if (liveMarketInterval) clearInterval(liveMarketInterval);
    showToast('Live Market Ticker dijeda.', 'info');
  }
}

function updateLiveTickerUI() {
  const btn = document.getElementById('liveTickerBtn');
  const dot = document.getElementById('liveTickerDot');
  const label = document.getElementById('liveTickerLabel');
  if (!btn || !dot || !label) return;

  if (state.liveMarket) {
    btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold transition-colors';
    dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping';
    label.textContent = 'LIVE';
  } else {
    btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-[11px] font-bold transition-colors';
    dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
    label.textContent = 'PAUSED';
  }
}

function simulateMarketTick(manual = false) {
  state.assets = state.assets.map(asset => {
    // Subtle realistic volatility per category
    const maxSwing = asset.category === 'Crypto' ? 0.016 : asset.category === 'Bonds' ? 0.002 : 0.008;
    const deltaPct = (Math.random() * 2 - 0.92) * maxSwing;
    const newPrice = Math.max(1, Number((asset.price * (1 + deltaPct)).toFixed(2)));
    const newChange = Number((asset.change + deltaPct * 100).toFixed(1));

    // Shift sparkline
    const oldSpark = asset.spark || [18, 15, 16, 11, 13, 8, 6];
    const nextPoint = Math.max(4, Math.min(21, Math.round(oldSpark[oldSpark.length - 1] - deltaPct * 260)));
    const newSpark = [...oldSpark.slice(1), nextPoint];

    return { ...asset, price: newPrice, change: newChange, spark: newSpark };
  });

  renderAll();
  if (activeDrawerAssetId) refreshDrawerLiveNumbers();
  if (manual) {
    saveState();
    showToast('Harga pasar diperbarui secara instan.', 'success');
  }
}

// =========================================================================
// NAVIGATION & VIEW SWITCHING
// =========================================================================
function switchTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll('#desktopNavLinks .nav-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabName) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

  if (tabName === 'dashboard') {
    document.getElementById('view-dashboard').classList.remove('hidden');
  } else if (tabName === 'stocks' || tabName === 'crypto') {
    const portfolioView = document.getElementById('view-portfolio');
    portfolioView.classList.remove('hidden');
    const catFilter = document.getElementById('assetCategoryFilter');
    if (tabName === 'stocks') {
      document.getElementById('portfolioEyebrow').textContent = 'EQUITIES & MARKET';
      document.getElementById('portfolioPageTitle').textContent = 'Stocks & Multi-Asset Portfolio';
      catFilter.value = 'ALL';
    } else {
      document.getElementById('portfolioEyebrow').textContent = 'DIGITAL ASSETS & WEB3';
      document.getElementById('portfolioPageTitle').textContent = 'Crypto & Digital Tokens';
      catFilter.value = 'Crypto';
    }
    assetPage = 1;
    renderPortfolioTable();
  } else if (tabName === 'accounting') {
    document.getElementById('view-accounting').classList.remove('hidden');
    txPage = 1;
    renderTransactionsTable();
  } else if (tabName === 'analytics') {
    document.getElementById('view-analytics').classList.remove('hidden');
    renderAnalyticsView();
  } else if (tabName === 'settings') {
    document.getElementById('view-settings').classList.remove('hidden');
    document.getElementById('settingsNameInput').value = state.user.name;
    document.getElementById('settingsAvatarInput').value = state.user.avatar;
    updateCardFreezeUI();
  }
}

function toggleMobileDrawer() {
  document.getElementById('mobileDrawer').classList.toggle('hidden');
}

// =========================================================================
// STRATEGY DIAL & AUTO-REBALANCE
// =========================================================================
const STRATEGIES = ['Conservative', 'Balanced', 'Aggressive'];
const KNOB_POSITIONS = {
  'Conservative': { left: '26px', right: 'auto', bottom: '54px' },
  'Balanced': { left: 'calc(50% - 7px)', right: 'auto', bottom: '12px' },
  'Aggressive': { left: 'auto', right: '26px', bottom: '54px' }
};

function cycleStrategy() {
  const idx = STRATEGIES.indexOf(state.strategy);
  const next = STRATEGIES[(idx + 1) % STRATEGIES.length];
  setStrategy(next);
}

function setStrategy(strategyName) {
  state.strategy = strategyName;
  saveState();
  updateStrategyUI();
  if (currentTab === 'analytics') renderAnalyticsView();
  showToast(`Strategi investasi diubah ke ${strategyName}`, 'success');
}

function updateStrategyUI() {
  const titleEl = document.getElementById('strategyTitle');
  const knobEl = document.getElementById('strategyKnob');
  if (titleEl) titleEl.textContent = state.strategy;
  const pos = KNOB_POSITIONS[state.strategy] || KNOB_POSITIONS['Aggressive'];
  if (knobEl) {
    knobEl.style.left = pos.left;
    knobEl.style.right = pos.right;
    knobEl.style.bottom = pos.bottom;
  }
}

function autoRebalancePortfolio() {
  const { totalAssetsValue } = calculateMetrics();
  if (totalAssetsValue <= 0) return;

  const targetWeights = {
    Conservative: { Bonds: 0.45, ETFs: 0.30, Stocks: 0.20, Crypto: 0.04, NFTs: 0.01 },
    Balanced:     { Stocks: 0.40, ETFs: 0.25, Bonds: 0.20, Crypto: 0.12, NFTs: 0.03 },
    Aggressive:   { Stocks: 0.45, Crypto: 0.30, ETFs: 0.15, NFTs: 0.06, Bonds: 0.04 }
  }[state.strategy];

  state.assets = state.assets.map(asset => {
    const catAssets = state.assets.filter(a => a.category === asset.category);
    const catWeight = targetWeights[asset.category] || 0.1;
    const targetBudget = (totalAssetsValue * catWeight) / Math.max(1, catAssets.length);
    const newQty = Math.max(0.1, Number((targetBudget / asset.price).toFixed(2)));
    return { ...asset, qty: newQty };
  });

  state.transactions.unshift({
    id: 'tx-' + Date.now(),
    title: `Auto-Rebalance (${state.strategy})`,
    date: '19 Nov 2026',
    type: 'trade',
    amount: Math.round(totalAssetsValue * 0.05)
  });

  saveState();
  renderAll();
  showToast(`Portofolio berhasil di-rebalance ke profil ${state.strategy}!`, 'success');
}

// =========================================================================
// VIRTUAL CARD INTERACTIONS (REVEAL, COPY, FREEZE)
// =========================================================================
function toggleCardReveal() {
  cardRevealed = !cardRevealed;
  const cardNumEl = document.getElementById('virtualCardNumber');
  if (cardRevealed) {
    cardNumEl.textContent = state.user.cardFull;
  } else {
    cardNumEl.innerHTML = `•••• &nbsp;•••• &nbsp;•••• &nbsp;${state.user.cardLast4}`;
  }
}

function copyCardNumber() {
  const cleanNum = state.user.cardFull.replace(/\s+/g, '');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(cleanNum).catch(() => {});
  }
  showToast('Nomor kartu virtual disalin ke clipboard.', 'success');
}

function toggleCardFreeze() {
  state.user.cardFrozen = !state.user.cardFrozen;
  saveState();
  updateCardFreezeUI();
  showToast(state.user.cardFrozen ? 'Kartu virtual dibekukan sementara.' : 'Kartu virtual diaktifkan kembali.', 'info');
}

function updateCardFreezeUI() {
  const box = document.getElementById('virtualCardBox');
  const badge = document.getElementById('cardFrozenBadge');
  const btn = document.getElementById('toggleFreezeBtn');
  const desc = document.getElementById('cardFreezeDesc');
  if (box && badge) {
    if (state.user.cardFrozen) {
      box.classList.add('frozen');
      badge.classList.remove('hidden');
    } else {
      box.classList.remove('frozen');
      badge.classList.add('hidden');
    }
  }
  if (btn && desc) {
    btn.textContent = state.user.cardFrozen ? 'Unfreeze Card' : 'Freeze Card';
    desc.textContent = state.user.cardFrozen
      ? 'Kartu sedang dibekukan. Penarikan dana dinonaktifkan sementara.'
      : 'Kartu aktif dan siap untuk pendanaan maupun penarikan.';
  }
}

// =========================================================================
// RENDER DASHBOARD CHARTS & WIDGETS
// =========================================================================
function setChartRange(range) {
  state.chartRange = range;
  saveState();
  document.querySelectorAll('.range-btn').forEach(btn => {
    if (btn.dataset.range === range) {
      btn.className = 'range-btn px-2 py-0.5 rounded-md bg-white text-brand-600 shadow-2xs transition-colors';
    } else {
      btn.className = 'range-btn px-2 py-0.5 rounded-md transition-colors';
    }
  });
  renderInvestedValueChart();
}

function renderInvestedValueChart() {
  const container = document.getElementById('investedChartContainer');
  if (!container) return;

  const { totalAssetsValue } = calculateMetrics();
  const series = state.investedSeries[state.chartRange] || state.investedSeries['6M'];
  const scaleFactor = Math.max(0.85, Math.min(1.25, totalAssetsValue / 24500));
  const spanX = 270 / Math.max(1, series.length - 1);

  const pts = series.map((d, i) => ({
    label: d.label,
    valUsd: d.value * 1000 * scaleFactor,
    x: 42 + i * spanX,
    y: Math.max(16, Math.min(134, 155 - ((d.value * scaleFactor - 6) / 28) * 125))
  }));

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) * 0.48;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (next.x - curr.x) * 0.52;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  const areaD = `${pathD} L ${pts[pts.length - 1].x} 142 L ${pts[0].x} 142 Z`;

  container.innerHTML = `
    <svg viewBox="0 0 330 155" class="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.26"/>
          <stop offset="85%" stop-color="#4F46E5" stop-opacity="0.02"/>
          <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <text x="4" y="34" fill="#A0A8B4" font-size="10.5" font-weight="500">${formatCompactCurrency(30000)}</text>
      <text x="4" y="82" fill="#A0A8B4" font-size="10.5" font-weight="500">${formatCompactCurrency(20000)}</text>
      <text x="4" y="130" fill="#A0A8B4" font-size="10.5" font-weight="500">${formatCompactCurrency(10000)}</text>

      <line x1="38" y1="30" x2="322" y2="30" stroke="#F3F5F8" stroke-width="1"/>
      <line x1="38" y1="78" x2="322" y2="78" stroke="#F3F5F8" stroke-width="1"/>
      <line x1="38" y1="126" x2="322" y2="126" stroke="#F3F5F8" stroke-width="1"/>

      <path d="${areaD}" fill="url(#investedGrad)"/>
      <path d="${pathD}" fill="none" stroke="#4F46E5" stroke-width="2.4" stroke-linecap="round" class="chart-path-animate"/>

      ${pts.map(p => `
        <g class="cursor-pointer group" data-invested-tooltip="${p.label}: ${formatCompactCurrency(p.valUsd)}">
          <line x1="${p.x}" y1="16" x2="${p.x}" y2="140" stroke="#C7D2FE" stroke-width="1" stroke-dasharray="3 3" class="opacity-0 group-hover:opacity-100 transition-opacity"/>
          <circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent"/>
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#FFFFFF" stroke="#4F46E5" stroke-width="2.2" class="opacity-0 group-hover:opacity-100 transition-opacity"/>
        </g>
      `).join('')}
    </svg>
  `;
}

function showInvestedTooltip(text) {
  const badge = document.getElementById('investedHoverBadge');
  if (badge) {
    badge.textContent = text;
    badge.classList.remove('opacity-0');
  }
}

function hideInvestedTooltip() {
  const badge = document.getElementById('investedHoverBadge');
  if (badge) badge.classList.add('opacity-0');
}

function renderRadarChart() {
  const container = document.getElementById('radarChartContainer');
  if (!container) return;

  const cats = ['Stocks', 'Crypto', 'ETFs', 'Bonds', 'NFTs', 'Cash'];
  const totals = cats.map(c => {
    if (c === 'Cash') return Math.min(22000, state.cashBalance * 0.12);
    return state.assets
      .filter(a => a.category === c)
      .reduce((s, a) => s + a.price * a.qty, 0) + 1800;
  });
  const maxVal = Math.max(...totals, 12000);

  const cx = 62, cy = 62, maxR = 48;
  const getPoint = (index, ratio) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    return {
      x: cx + maxR * ratio * Math.cos(angle),
      y: cy + maxR * ratio * Math.sin(angle)
    };
  };

  const rings = [1, 0.72, 0.45, 0.22].map(r => {
    const pts = [0, 1, 2, 3, 4, 5].map(i => getPoint(i, r));
    return `<polygon points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#E5E9F0" stroke-width="1"/>`;
  }).join('');

  const axes = [0, 1, 2, 3, 4, 5].map(i => {
    const p = getPoint(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#ECEFF4" stroke-width="1"/>`;
  }).join('');

  const dataPts = totals.map((val, i) => {
    const ratio = Math.max(0.28, Math.min(0.96, val / maxVal));
    return getPoint(i, ratio);
  });

  container.innerHTML = `
    <svg viewBox="0 0 124 124" class="w-[116px] h-[116px] cursor-pointer" data-click="switchTab" data-arg="analytics" title="Klik untuk melihat rincian alokasi aset">
      ${rings}
      ${axes}
      <polygon
        points="${dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
        fill="#0D9488"
        fill-opacity="0.18"
        stroke="#0D9488"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function renderDashboardTransactions() {
  const list = document.getElementById('dashboardTransactionsList');
  if (!list) return;

  const latest = state.transactions.slice(0, 2);
  if (latest.length === 0) {
    list.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Belum ada transaksi tercatat.</p>`;
    return;
  }

  list.innerHTML = latest.map(tx => {
    const isPositive = tx.type === 'deposit';
    const sign = isPositive ? '+' : '-';
    const amountColor = isPositive ? 'text-emerald-500' : 'text-amberpromo-600';
    return `
      <div data-click="switchTab" data-arg="accounting" class="bg-[#F6F8FB] hover:bg-[#EFF3F9] transition-colors rounded-[18px] px-4 py-3.5 flex items-center justify-between cursor-pointer">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-8 h-8 rounded-full border border-slate-300/90 bg-white flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
            ${isPositive ? '+' : '−'}
          </div>
          <div class="min-w-0">
            <p class="text-[10.5px] font-medium text-[#9CA3AF] leading-tight">${tx.date}</p>
            <p class="text-[13px] font-bold text-[#1E242B] leading-snug mt-0.5 truncate">${tx.title}</p>
          </div>
        </div>
        <span class="text-[12.5px] font-bold ${amountColor} tabular-nums shrink-0 ml-2">
          ${sign}${getCurrencyMeta().symbol}${formatDotThousands(tx.amount)}
        </span>
      </div>
    `;
  }).join('');
}

function buildSparklineSVG(points, isPositive, width = 58, height = 24) {
  const stroke = isPositive ? '#10B981' : '#F43F5E';
  const step = (width - 4) / (points.length - 1);
  const coords = points.map((y, idx) => ({ x: idx * step + 2, y }));
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const c = coords[i];
    const n = coords[i + 1];
    const midX = (c.x + n.x) / 2;
    d += ` Q ${c.x + (n.x - c.x) * 0.25} ${c.y}, ${midX} ${(c.y + n.y) / 2} T ${n.x} ${n.y}`;
  }
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="overflow-visible shrink-0" aria-hidden="true">
      <path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
}

function getAssetIconHTML(asset) {
  if (asset.logoUrl) {
    return `<img src="${asset.logoUrl}" alt="${asset.ticker}" data-asset-logo class="w-8 h-8 rounded-full object-cover shrink-0"/>`;
  }
  if (asset.ticker === 'SPOT') {
    return `
      <div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <path d="M5 9.5c4.5-1.4 9.8-1.1 14 1.2"/>
          <path d="M6.5 13c3.6-1.1 7.8-.8 11.2 1"/>
          <path d="M8 16.5c2.7-.8 5.8-.6 8.3.7"/>
        </svg>
      </div>`;
  }
  if (asset.ticker === 'ABNB') {
    return `
      <div class="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3C9.5 7.5 6 12.2 6 15.5A6 6 0 0 0 18 15.5C18 12.2 14.5 7.5 12 3Z"/>
          <circle cx="12" cy="15" r="2"/>
        </svg>
      </div>`;
  }
  if (asset.ticker === 'DBX') {
    return `
      <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.5 4L2 7.5L7.5 11L12 7.5L7.5 4ZM16.5 4L12 7.5L16.5 11L22 7.5L16.5 4ZM2 14.5L7.5 18L12 14.5L7.5 11L2 14.5ZM16.5 11L12 14.5L16.5 18L22 14.5L16.5 11ZM7.5 19.2L12 22L16.5 19.2L12 16.2L7.5 19.2Z"/>
        </svg>
      </div>`;
  }
  return `
    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold shrink-0" style="background-color: ${asset.color || '#4F46E5'}">
      ${asset.ticker.slice(0, 3)}
    </div>`;
}

function renderDashboardTopGainers() {
  const container = document.getElementById('dashboardTopGainers');
  if (!container) return;

  const sorted = [...state.assets].sort((a, b) => b.change - a.change).slice(0, 3);
  container.innerHTML = sorted.map(asset => {
    const isPos = asset.change >= 0;
    const formattedChange = `${isPos ? '+' : ''}${asset.change.toFixed(1).replace('.', ',')}%`;
    return `
      <div data-click="openAssetTradeDrawer" data-arg="${asset.id}" title="Klik untuk Buy / Sell ${asset.ticker}" class="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/90 rounded-xl px-1.5 -mx-1.5 transition-colors cursor-pointer group">
        <div class="flex items-center gap-3 min-w-0">
          ${getAssetIconHTML(asset)}
          <div class="min-w-0">
            <p class="text-[12.5px] font-bold text-[#1E242B] group-hover:text-brand-600 transition-colors leading-tight truncate">${asset.ticker}</p>
            <p class="text-[11px] font-medium text-[#9CA3AF] truncate mt-0.5">${asset.name}</p>
          </div>
        </div>

        <div class="flex items-center gap-3.5 shrink-0">
          <div class="text-right">
            <p class="text-[11.5px] font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'} leading-tight">${formattedChange}</p>
            <p class="whitespace-nowrap text-[11px] font-medium text-[#9CA3AF] tabular-nums mt-0.5">${formatCurrencyFull(asset.price)}</p>
          </div>
          ${buildSparklineSVG(asset.spark || [18, 15, 16, 11, 12, 8, 5], isPos)}
        </div>
      </div>
    `;
  }).join('');
}

// =========================================================================
// SLIDE-OVER ASSET INSPECTOR & INSTANT BUY / SELL DRAWER
// =========================================================================
function openAssetTradeDrawer(assetId) {
  const asset = state.assets.find(a => a.id === assetId);
  if (!asset) return;
  activeDrawerAssetId = assetId;
  activeTradeSide = 'buy';

  document.getElementById('drawerAssetHeader').innerHTML = `
    ${getAssetIconHTML(asset)}
    <div>
      <h3 class="text-base font-bold text-[#1E242B]">${asset.ticker} — ${asset.name}</h3>
      <p class="text-[11px] text-slate-400">Instant Market Execution</p>
    </div>
  `;

  document.getElementById('drawerCategoryBadge').textContent = asset.category;
  document.getElementById('drawerChartPreview').innerHTML = buildSparklineSVG(asset.spark || [18, 14, 15, 10, 9, 6], asset.change >= 0, 260, 48);

  document.getElementById('drawerEditMetaBtn').onclick = () => {
    closeAssetTradeDrawer();
    openAssetModal(asset.id);
  };
  document.getElementById('drawerDeleteAssetBtn').onclick = () => {
    closeAssetTradeDrawer();
    confirmDeleteAsset(asset.id);
  };

  document.getElementById('tradeQtyInput').value = '1';
  setTradeSide('buy');
  refreshDrawerLiveNumbers();

  document.getElementById('assetTradeDrawer').classList.remove('hidden');
}

function closeAssetTradeDrawer() {
  activeDrawerAssetId = null;
  document.getElementById('assetTradeDrawer').classList.add('hidden');
}

function refreshDrawerLiveNumbers() {
  const asset = state.assets.find(a => a.id === activeDrawerAssetId);
  if (!asset) return;
  const isPos = asset.change >= 0;

  document.getElementById('drawerUnitPrice').textContent = formatCurrencyFull(asset.price);
  const changeEl = document.getElementById('drawerPriceChange');
  changeEl.textContent = `${isPos ? '+' : ''}${asset.change.toFixed(1)}% (24h)`;
  changeEl.className = `text-xs font-bold mt-0.5 ${isPos ? 'text-emerald-500' : 'text-rose-500'}`;

  document.getElementById('drawerHoldingValue').textContent = formatCurrencyFull(asset.price * asset.qty);
  document.getElementById('drawerHoldingQty').textContent = `${asset.qty} Unit Dimiliki`;

  const hint = activeTradeSide === 'buy'
    ? `Cash Tersedia: ${formatCompactCurrency(state.cashBalance)}`
    : `Maks Jual: ${asset.qty} Unit`;
  document.getElementById('drawerAvailableBalanceHint').textContent = hint;

  updateTradeEstimate();
}

function setTradeSide(side) {
  activeTradeSide = side;
  const buyBtn = document.getElementById('tradeSideBuyBtn');
  const sellBtn = document.getElementById('tradeSideSellBtn');
  const submitBtn = document.getElementById('executeTradeSubmitBtn');

  if (side === 'buy') {
    buyBtn.className = 'py-2 rounded-lg font-bold bg-emerald-500 text-white transition-colors';
    sellBtn.className = 'py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors';
    submitBtn.className = 'w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-colors';
    submitBtn.textContent = 'Konfirmasi Order BUY';
  } else {
    sellBtn.className = 'py-2 rounded-lg font-bold bg-rose-500 text-white transition-colors';
    buyBtn.className = 'py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors';
    submitBtn.className = 'w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm transition-colors';
    submitBtn.textContent = 'Konfirmasi Order SELL';
  }
  refreshDrawerLiveNumbers();
}

function updateTradeEstimate() {
  const asset = state.assets.find(a => a.id === activeDrawerAssetId);
  if (!asset) return;
  const qty = parseFloat(document.getElementById('tradeQtyInput').value) || 0;
  document.getElementById('tradeEstimatedTotal').textContent = formatCurrencyFull(asset.price * qty);
}

function executeInstantTrade(e) {
  e.preventDefault();
  const asset = state.assets.find(a => a.id === activeDrawerAssetId);
  if (!asset) return;
  const qty = parseFloat(document.getElementById('tradeQtyInput').value);
  if (!qty || qty <= 0) return;

  const totalUsd = asset.price * qty;

  if (activeTradeSide === 'buy') {
    if (totalUsd > state.cashBalance) {
      showToast('Saldo Cash tidak mencukupi untuk order ini.', 'info');
      return;
    }
    state.cashBalance -= totalUsd;
    asset.qty = Number((asset.qty + qty).toFixed(4));
    state.transactions.unshift({
      id: 'tx-' + Date.now(),
      title: `Buy ${qty} ${asset.ticker}`,
      date: '19 Nov 2026',
      type: 'trade',
      amount: Math.round(totalUsd)
    });
    showToast(`Berhasil membeli ${qty} unit ${asset.ticker}!`, 'success');
  } else {
    if (qty > asset.qty) {
      showToast(`Jumlah unit melebihi kepemilikan (${asset.qty} unit).`, 'info');
      return;
    }
    state.cashBalance += totalUsd;
    asset.qty = Number((asset.qty - qty).toFixed(4));
    state.transactions.unshift({
      id: 'tx-' + Date.now(),
      title: `Sell ${qty} ${asset.ticker}`,
      date: '19 Nov 2026',
      type: 'deposit',
      amount: Math.round(totalUsd)
    });
    showToast(`Berhasil menjual ${qty} unit ${asset.ticker}!`, 'success');
  }

  saveState();
  renderAll();
  refreshDrawerLiveNumbers();
}

// =========================================================================
// RENDER PORTFOLIO CRUD TABLE
// =========================================================================
function renderPortfolioTable() {
  const tbody = document.getElementById('portfolioTableBody');
  if (!tbody) return;

  const query = (document.getElementById('assetSearchInput')?.value || '').toLowerCase().trim();
  const category = document.getElementById('assetCategoryFilter')?.value || 'ALL';
  const sortBy = document.getElementById('assetSortSelect')?.value || 'value_desc';

  let filtered = state.assets.filter(a => {
    const matchesQuery = a.ticker.toLowerCase().includes(query) || a.name.toLowerCase().includes(query);
    const matchesCat = category === 'ALL' || a.category === category;
    return matchesQuery && matchesCat;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'value_desc') return (b.price * b.qty) - (a.price * a.qty);
    if (sortBy === 'value_asc') return (a.price * a.qty) - (b.price * b.qty);
    if (sortBy === 'change_desc') return b.change - a.change;
    return a.name.localeCompare(b.name);
  });

  const filteredTotal = filtered.reduce((acc, a) => acc + a.price * a.qty, 0);
  document.getElementById('filteredPortfolioSum').textContent = formatCurrencyFull(filteredTotal);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (assetPage > totalPages) assetPage = totalPages;
  const startIdx = (assetPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">Tidak ada aset yang sesuai dengan filter pencarian.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(asset => {
      const totalVal = asset.price * asset.qty;
      const isPos = asset.change >= 0;
      const checked = selectedAssetIds.has(asset.id) ? 'checked' : '';
      return `
        <tr class="hover:bg-[#F9FAFC] transition-colors">
          <td class="py-3.5 px-4">
            <input type="checkbox" ${checked} data-change="toggleSelectAsset" data-arg="${asset.id}" class="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
          </td>
          <td data-click="openAssetTradeDrawer" data-arg="${asset.id}" class="py-3.5 px-4 cursor-pointer group">
            <div class="flex items-center gap-3">
              ${getAssetIconHTML(asset)}
              <div>
                <p class="font-bold text-[#1E242B] group-hover:text-brand-600 transition-colors">${asset.ticker}</p>
                <p class="text-[11px] text-slate-400">${asset.name}</p>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-brand-50 text-brand-600">${asset.category}</span>
          </td>
          <td class="py-3.5 px-4 text-right font-semibold text-[#1E242B] tabular-nums">${formatCurrencyFull(asset.price)}</td>
          <td class="py-3.5 px-4 text-right font-medium text-slate-600 tabular-nums">${asset.qty}</td>
          <td class="py-3.5 px-4 text-right font-bold text-[#1E242B] tabular-nums">${formatCurrencyFull(totalVal)}</td>
          <td class="py-3.5 px-4 text-right font-bold ${isPos ? 'text-emerald-500' : 'text-rose-500'} tabular-nums">
            ${isPos ? '+' : ''}${asset.change.toFixed(1)}%
          </td>
          <td class="py-3.5 px-4">
            <div class="flex justify-center">${buildSparklineSVG(asset.spark || [18,14,15,10,9,6], isPos)}</div>
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="inline-flex items-center gap-1.5">
              <button data-click="openAssetTradeDrawer" data-arg="${asset.id}" class="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition-colors">Trade</button>
              <button data-click="openAssetModal" data-arg="${asset.id}" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-600 font-bold transition-colors">Edit</button>
              <button data-click="confirmDeleteAsset" data-arg="${asset.id}" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('assetPaginationInfo').textContent = `Menampilkan ${pageItems.length} dari ${filtered.length} aset`;
  renderPaginationButtons('assetPaginationButtons', totalPages, assetPage, (p) => {
    assetPage = p;
    renderPortfolioTable();
  });
  updateBulkAssetUI();
}

function toggleSelectAsset(id) {
  if (selectedAssetIds.has(id)) selectedAssetIds.delete(id);
  else selectedAssetIds.add(id);
  updateBulkAssetUI();
}

function toggleSelectAllAssets(checkbox) {
  if (checkbox.checked) state.assets.forEach(a => selectedAssetIds.add(a.id));
  else selectedAssetIds.clear();
  renderPortfolioTable();
}

function updateBulkAssetUI() {
  const btn = document.getElementById('bulkDeleteAssetsBtn');
  const count = document.getElementById('selectedAssetsCount');
  if (!btn || !count) return;
  count.textContent = selectedAssetIds.size;
  if (selectedAssetIds.size > 0) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

function bulkDeleteAssets() {
  openConfirmModal(`Hapus ${selectedAssetIds.size} aset terpilih dari portofolio?`, () => {
    state.assets = state.assets.filter(a => !selectedAssetIds.has(a.id));
    selectedAssetIds.clear();
    saveState();
    renderAll();
    showToast('Aset terpilih berhasil dihapus.', 'success');
  });
}

// =========================================================================
// RENDER TRANSACTIONS CRUD TABLE & CSV EXPORT
// =========================================================================
function renderTransactionsTable() {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;

  const query = (document.getElementById('txSearchInput')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('txTypeFilter')?.value || 'ALL';
  const sortBy = document.getElementById('txSortSelect')?.value || 'newest';

  let filtered = state.transactions.filter(tx => {
    const matchText = tx.title.toLowerCase().includes(query) || tx.date.toLowerCase().includes(query);
    const matchType = typeFilter === 'ALL' || tx.type === typeFilter;
    return matchText && matchType;
  });

  if (sortBy === 'amount_desc') filtered.sort((a, b) => b.amount - a.amount);
  else if (sortBy === 'amount_asc') filtered.sort((a, b) => a.amount - b.amount);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (txPage > totalPages) txPage = totalPages;
  const startIdx = (txPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Tidak ada riwayat transaksi yang cocok.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(tx => {
      const isDeposit = tx.type === 'deposit';
      const badgeClass = tx.type === 'deposit'
        ? 'bg-emerald-50 text-emerald-600'
        : tx.type === 'trade'
          ? 'bg-brand-50 text-brand-600'
          : 'bg-amber-50 text-amber-700';
      const badgeLabel = tx.type === 'deposit' ? 'Deposit (+)' : tx.type === 'trade' ? 'Order Aset' : 'Withdraw (-)';
      const checked = selectedTxIds.has(tx.id) ? 'checked' : '';
      return `
        <tr class="hover:bg-[#F9FAFC] transition-colors">
          <td class="py-3.5 px-4">
            <input type="checkbox" ${checked} data-change="toggleSelectTx" data-arg="${tx.id}" class="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
          </td>
          <td class="py-3.5 px-4 font-bold text-[#1E242B]">${tx.title}</td>
          <td class="py-3.5 px-4 text-slate-500">${tx.date}</td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-full text-[10.5px] font-bold ${badgeClass}">
              ${badgeLabel}
            </span>
          </td>
          <td class="py-3.5 px-4 text-right font-bold tabular-nums ${isDeposit ? 'text-emerald-500' : 'text-amberpromo-600'}">
            ${isDeposit ? '+' : '-'}${getCurrencyMeta().symbol}${formatDotThousands(tx.amount)}
          </td>
          <td class="py-3.5 px-4 text-right">
            <div class="inline-flex items-center gap-1.5">
              <button data-click="openTransactionModal" data-arg="${tx.id}" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-600 font-bold transition-colors">Edit</button>
              <button data-click="confirmDeleteTx" data-arg="${tx.id}" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('txPaginationInfo').textContent = `Menampilkan ${pageItems.length} dari ${filtered.length} transaksi`;
  renderPaginationButtons('txPaginationButtons', totalPages, txPage, (p) => {
    txPage = p;
    renderTransactionsTable();
  });
  updateBulkTxUI();
}

function exportTransactionsCSV() {
  const headers = ['ID', 'Keterangan', 'Tanggal', 'Tipe', 'Nominal_USD'];
  const rows = state.transactions.map(t => [t.id, `"${t.title}"`, `"${t.date}"`, t.type, t.amount]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valora-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Laporan transaksi CSV berhasil diunduh.', 'success');
}

function exportStateJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `valora-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup JSON berhasil diunduh.', 'success');
}

function toggleSelectTx(id) {
  if (selectedTxIds.has(id)) selectedTxIds.delete(id);
  else selectedTxIds.add(id);
  updateBulkTxUI();
}

function toggleSelectAllTx(checkbox) {
  if (checkbox.checked) state.transactions.forEach(t => selectedTxIds.add(t.id));
  else selectedTxIds.clear();
  renderTransactionsTable();
}

function updateBulkTxUI() {
  const btn = document.getElementById('bulkDeleteTxBtn');
  const count = document.getElementById('selectedTxCount');
  if (!btn || !count) return;
  count.textContent = selectedTxIds.size;
  if (selectedTxIds.size > 0) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

function bulkDeleteTransactions() {
  openConfirmModal(`Hapus ${selectedTxIds.size} transaksi terpilih?`, () => {
    state.transactions = state.transactions.filter(t => !selectedTxIds.has(t.id));
    selectedTxIds.clear();
    saveState();
    renderAll();
    showToast('Transaksi terpilih berhasil dihapus.', 'success');
  });
}

function renderPaginationButtons(containerId, totalPages, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    const active = p === currentPage ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
    html += `<button data-page="${p}" class="w-7 h-7 rounded-lg font-bold transition-colors ${active}">${p}</button>`;
  }
  container.innerHTML = html;
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}

// =========================================================================
// RENDER ANALYTICS VIEW
// =========================================================================
function renderAnalyticsView() {
  const barsContainer = document.getElementById('analyticsAllocationBars');
  const projContainer = document.getElementById('analyticsProjectionSummary');
  const stratText = document.getElementById('analyticsActiveStrategyText');
  if (!barsContainer || !projContainer) return;

  const categories = ['Stocks', 'Crypto', 'ETFs', 'Bonds', 'NFTs'];
  const catSums = categories.map(c => ({
    name: c,
    val: state.assets.filter(a => a.category === c).reduce((s, a) => s + a.price * a.qty, 0)
  }));
  const total = Math.max(1, catSums.reduce((s, c) => s + c.val, 0));

  barsContainer.innerHTML = catSums.map(c => {
    const pct = Math.round((c.val / total) * 100);
    return `
      <div>
        <div class="flex justify-between text-xs font-bold mb-1">
          <span class="text-[#1E242B]">${c.name}</span>
          <span class="text-brand-600">${pct}% (${formatCompactCurrency(c.val)})</span>
        </div>
        <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full bg-brand-600 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const { walletTotal } = calculateMetrics();
  const rate = state.strategy === 'Conservative' ? 0.07 : state.strategy === 'Balanced' ? 0.12 : 0.19;
  const yr1 = walletTotal * Math.pow(1 + rate, 1);
  const yr3 = walletTotal * Math.pow(1 + rate, 3);
  const yr5 = walletTotal * Math.pow(1 + rate, 5);

  if (stratText) stratText.textContent = state.strategy;
  document.querySelectorAll('#view-analytics [data-click="setStrategy"]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.arg === state.strategy));
  });
  projContainer.innerHTML = `
    <div class="bg-white p-3.5 rounded-xl border border-slate-100">
      <p class="text-[10.5px] font-bold uppercase text-slate-400">Tahun ke-1</p>
      <p class="text-lg font-extrabold text-[#1E242B] mt-0.5">${formatCompactCurrency(yr1)}</p>
    </div>
    <div class="bg-white p-3.5 rounded-xl border border-slate-100">
      <p class="text-[10.5px] font-bold uppercase text-slate-400">Tahun ke-3</p>
      <p class="text-lg font-extrabold text-tealcard-600 mt-0.5">${formatCompactCurrency(yr3)}</p>
    </div>
    <div class="bg-white p-3.5 rounded-xl border border-slate-100">
      <p class="text-[10.5px] font-bold uppercase text-slate-400">Tahun ke-5</p>
      <p class="text-lg font-extrabold text-brand-600 mt-0.5">${formatCompactCurrency(yr5)}</p>
    </div>
  `;
}

// =========================================================================
// GLOBAL COMMAND SEARCH (CTRL + K)
// =========================================================================
function openCommandModal() {
  openModal('commandModal');
  const input = document.getElementById('commandSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderCommandResults();
}

function renderCommandResults() {
  const container = document.getElementById('commandResultsList');
  if (!container) return;
  const q = (document.getElementById('commandSearchInput')?.value || '').toLowerCase().trim();

  const assetMatches = state.assets
    .filter(a => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    .slice(0, 4)
    .map(a => `
      <button data-click="tradeFromSearch" data-arg="${a.id}" class="w-full py-2.5 px-3 flex items-center justify-between hover:bg-brand-50 rounded-xl text-left transition-colors">
        <div>
          <span class="font-bold text-[#1E242B]">${a.ticker}</span>
          <span class="text-slate-400 ml-1.5">${a.name}</span>
        </div>
        <span class="font-bold text-brand-600">${formatCurrencyFull(a.price)}</span>
      </button>
    `);

  const navMatches = [
    { label: 'Buka Dashboard Utama', tab: 'dashboard' },
    { label: 'Kelola Portofolio Stocks & ETFs', tab: 'stocks' },
    { label: 'Kelola Digital Assets & Crypto', tab: 'crypto' },
    { label: 'Lihat Accounting & Export CSV', tab: 'accounting' },
    { label: 'Simulasi Proyeksi & Auto-Rebalance', tab: 'analytics' }
  ]
    .filter(n => n.label.toLowerCase().includes(q))
    .map(n => `
      <button data-click="navigateFromSearch" data-arg="${n.tab}" class="w-full py-2.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-xl text-left text-slate-600 font-semibold transition-colors">
        <span>${n.label}</span>
        <span class="text-[10px] text-slate-400">Navigasi →</span>
      </button>
    `);

  container.innerHTML = [...assetMatches, ...navMatches].join('') || `<p class="py-6 text-center text-slate-400">Tidak ada hasil ditemukan.</p>`;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandModal();
  } else if (e.key === 'Escape') {
    closeModal('commandModal');
    closeModal('assetModal');
    closeModal('txModal');
    closeModal('confirmModal');
    closeAssetTradeDrawer();
  }
});

// =========================================================================
// MODALS & CRUD HANDLERS (CREATE, UPDATE, DELETE)
// =========================================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
}

function openAssetModal(editId = null, presetCategory = 'Stocks') {
  const form = document.getElementById('assetForm');
  form.reset();
  document.getElementById('assetIdField').value = '';

  if (editId) {
    const asset = state.assets.find(a => a.id === editId);
    if (asset) {
      document.getElementById('assetModalTitle').textContent = `Edit Aset (${asset.ticker})`;
      document.getElementById('assetIdField').value = asset.id;
      document.getElementById('assetTickerField').value = asset.ticker;
      document.getElementById('assetNameField').value = asset.name;
      document.getElementById('assetCategoryField').value = asset.category;
      document.getElementById('assetPriceField').value = asset.price;
      document.getElementById('assetQtyField').value = asset.qty;
      document.getElementById('assetChangeField').value = asset.change;
      document.getElementById('assetLogoField').value = asset.logoUrl || '';
    }
  } else {
    document.getElementById('assetModalTitle').textContent = `Tambah Aset (${presetCategory})`;
    document.getElementById('assetCategoryField').value = presetCategory;
  }
  openModal('assetModal');
}

function handleAssetSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('assetIdField').value;
  const ticker = document.getElementById('assetTickerField').value.trim().toUpperCase();
  const name = document.getElementById('assetNameField').value.trim();
  const category = document.getElementById('assetCategoryField').value;
  const price = parseFloat(document.getElementById('assetPriceField').value);
  const qty = parseFloat(document.getElementById('assetQtyField').value);
  const change = parseFloat(document.getElementById('assetChangeField').value);
  const logoUrl = document.getElementById('assetLogoField').value.trim();

  if (id) {
    const idx = state.assets.findIndex(a => a.id === id);
    if (idx !== -1) {
      state.assets[idx] = { ...state.assets[idx], ticker, name, category, price, qty, change, logoUrl };
      showToast(`Aset ${ticker} berhasil diperbarui.`, 'success');
    }
  } else {
    const newAsset = {
      id: 'ast-' + Date.now(),
      ticker,
      name,
      category,
      price,
      qty,
      change,
      color: '#4F46E5',
      spark: change >= 0 ? [19, 16, 15, 12, 10, 7, 5] : [6, 8, 11, 13, 16, 18, 20],
      logoUrl
    };
    state.assets.unshift(newAsset);
    showToast(`Aset baru ${ticker} ditambahkan ke portofolio.`, 'success');
  }

  saveState();
  closeModal('assetModal');
  renderAll();
}

function confirmDeleteAsset(id) {
  const asset = state.assets.find(a => a.id === id);
  if (!asset) return;
  openConfirmModal(`Hapus aset ${asset.ticker} (${asset.name}) dari portofolio Anda?`, () => {
    state.assets = state.assets.filter(a => a.id !== id);
    selectedAssetIds.delete(id);
    saveState();
    renderAll();
    showToast(`Aset ${asset.ticker} telah dihapus.`, 'info');
  });
}

function openDepositModal() {
  openTransactionModal(null, 'deposit');
}

function openTransactionModal(editId = null, defaultType = 'deposit') {
  const form = document.getElementById('txForm');
  form.reset();
  document.getElementById('txIdField').value = '';

  if (editId) {
    const tx = state.transactions.find(t => t.id === editId);
    if (tx) {
      document.getElementById('txModalTitle').textContent = 'Edit Transaksi';
      document.getElementById('txIdField').value = tx.id;
      document.getElementById('txTypeField').value = tx.type === 'trade' ? 'deposit' : tx.type;
      document.getElementById('txTitleField').value = tx.title;
      document.getElementById('txAmountField').value = tx.amount;
      document.getElementById('txDateField').value = tx.date;
    }
  } else {
    document.getElementById('txModalTitle').textContent = defaultType === 'deposit' ? 'Load More Funds' : 'Catat Transaksi Baru';
    document.getElementById('txTypeField').value = defaultType;
    document.getElementById('txTitleField').value = defaultType === 'deposit' ? 'Funds Loaded' : 'Funds Withdraw';
    document.getElementById('txDateField').value = '19 Nov 2026';
  }
  openModal('txModal');
}

function autoFillTxLabel() {
  const type = document.getElementById('txTypeField').value;
  const titleInput = document.getElementById('txTitleField');
  if (!document.getElementById('txIdField').value) {
    titleInput.value = type === 'deposit' ? 'Funds Loaded' : 'Funds Withdraw';
  }
}

function handleTxSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('txIdField').value;
  const type = document.getElementById('txTypeField').value;
  const title = document.getElementById('txTitleField').value.trim();
  const amount = parseFloat(document.getElementById('txAmountField').value);
  const date = document.getElementById('txDateField').value.trim();

  if (type === 'withdraw' && state.user.cardFrozen) {
    showToast('Penarikan gagal: Kartu virtual sedang dalam status FROZEN.', 'info');
    return;
  }

  if (id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const prev = state.transactions[idx];
      // Revert old cash effect
      state.cashBalance += prev.type === 'deposit' ? -prev.amount : prev.amount;
      // Apply new cash effect
      state.cashBalance += type === 'deposit' ? amount : -amount;
      state.transactions[idx] = { ...prev, type, title, amount, date };
      showToast('Transaksi berhasil diperbarui.', 'success');
    }
  } else {
    state.cashBalance += type === 'deposit' ? amount : -amount;
    state.transactions.unshift({
      id: 'tx-' + Date.now(),
      type,
      title,
      amount,
      date
    });
    showToast(`${title} sebesar $${formatDotThousands(amount)} berhasil dicatat.`, 'success');
  }

  saveState();
  closeModal('txModal');
  renderAll();
}

function confirmDeleteTx(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  openConfirmModal(`Hapus riwayat transaksi "${tx.title}"?`, () => {
    state.cashBalance += tx.type === 'deposit' ? -tx.amount : tx.amount;
    state.transactions = state.transactions.filter(t => t.id !== id);
    selectedTxIds.delete(id);
    saveState();
    renderAll();
    showToast('Transaksi berhasil dihapus.', 'info');
  });
}

function openConfirmModal(message, onConfirm) {
  document.getElementById('confirmModalMessage').textContent = message;
  const btn = document.getElementById('confirmDeleteActionBtn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => {
    onConfirm();
    closeModal('confirmModal');
  });
  openModal('confirmModal');
}

function saveProfileSettings(e) {
  e.preventDefault();
  const newName = document.getElementById('settingsNameInput').value.trim();
  const newAvatar = document.getElementById('settingsAvatarInput').value.trim();
  if (newName) state.user.name = newName;
  if (newAvatar) state.user.avatar = newAvatar;
  saveState();
  renderAll();
  showToast('Profil & kartu virtual berhasil diperbarui.', 'success');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-[#1E242B] text-white' : 'bg-brand-600 text-white';
  toast.className = `${bg} px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2.5 pointer-events-auto animate-stagger-1`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : 'bg-amber-300'}"></span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =========================================================================
// MASTER RENDER SYNCHRONIZER
// =========================================================================
function renderAll() {
  const { stocksValue, cashBalance, walletTotal } = calculateMetrics();

  document.getElementById('currencySelector').value = state.currency;
  document.getElementById('headerUserName').textContent = state.user.name;
  const avatar = document.getElementById('headerAvatarImg');
  avatar.src = state.user.avatar || demoAvatar;
  avatar.alt = state.user.name;
  document.getElementById('cardHolderDisplay').textContent = state.user.name;

  document.getElementById('headerWalletBalance').textContent = formatCompactCurrency(walletTotal);
  document.getElementById('cashReservePill').textContent = `Cash: ${formatCompactCurrency(cashBalance)}`;
  document.getElementById('dashboardStocksTotal').textContent = formatCompactCurrency(stocksValue);

  updateStrategyUI();
  updateLiveTickerUI();
  updateCardFreezeUI();

  renderInvestedValueChart();
  renderRadarChart();
  renderDashboardTransactions();
  renderDashboardTopGainers();

  if (currentTab === 'stocks' || currentTab === 'crypto') renderPortfolioTable();
  if (currentTab === 'accounting') renderTransactionsTable();
  if (currentTab === 'analytics') renderAnalyticsView();
}

// Static markup and dynamically rendered rows use the same action bindings.
const clickActions = {
  addAssetInCategory: category => openAssetModal(null, category),
  autoRebalancePortfolio,
  bulkDeleteAssets,
  bulkDeleteTransactions,
  closeAssetTradeDrawer,
  closeModal,
  confirmDeleteAsset,
  confirmDeleteTx,
  copyCardNumber,
  cycleStrategy,
  exportStateJSON,
  exportTransactionsCSV,
  navigateFromDrawer: tab => {
    switchTab(tab);
    toggleMobileDrawer();
  },
  navigateFromSearch: tab => {
    closeModal('commandModal');
    switchTab(tab);
  },
  openAssetModal,
  openAssetTradeDrawer,
  openCommandModal,
  openDepositModal,
  openTransactionModal,
  resetDemoData,
  resetFromDrawer: () => {
    resetDemoData();
    toggleMobileDrawer();
  },
  setChartRange,
  setStrategy,
  setTradeSide,
  simulateMarketTick: () => simulateMarketTick(true),
  switchTab,
  toggleCardFreeze,
  toggleCardReveal,
  toggleLiveMarket,
  toggleMobileDrawer,
  tradeFromSearch: id => {
    closeModal('commandModal');
    openAssetTradeDrawer(id);
  },
};

const eventActions = {
  click: clickActions,
  change: {
    autoFillTxLabel,
    changeCurrency: control => changeCurrency(control.value),
    renderPortfolioTable,
    renderTransactionsTable,
    toggleSelectAllAssets,
    toggleSelectAllTx,
    toggleSelectAsset: control => toggleSelectAsset(control.dataset.arg),
    toggleSelectTx: control => toggleSelectTx(control.dataset.arg),
  },
  input: { renderCommandResults, renderPortfolioTable, renderTransactionsTable, updateTradeEstimate },
  submit: { executeInstantTrade, handleAssetSubmit, handleTxSubmit, saveProfileSettings },
};

for (const [type, handlers] of Object.entries(eventActions)) {
  const attribute = `data-${type}`;
  document.addEventListener(type, event => {
    const control = event.target.closest(`[${attribute}]`);
    if (!control) return;
    const action = control.getAttribute(attribute);
    if (!Object.hasOwn(handlers, action)) return;
    const handler = handlers[action];
    if (type === 'submit') handler(event);
    else if (type === 'change') handler(control);
    else handler(control.dataset.arg);
  });
}

const investedChart = document.getElementById('investedChartContainer');
for (const type of ['pointerover', 'pointerout']) {
  investedChart.addEventListener(type, event => {
    const point = event.target.closest('[data-invested-tooltip]');
    if (!point || point.contains(event.relatedTarget)) return;
    if (type === 'pointerover') showInvestedTooltip(point.dataset.investedTooltip);
    else hideInvestedTooltip();
  });
}

document.addEventListener('error', ({ target }) => {
  if (!(target instanceof HTMLImageElement)) return;
  if (target.id === 'headerAvatarImg' && target.src !== demoAvatar) target.src = demoAvatar;
  if (target.hasAttribute('data-asset-logo')) target.hidden = true;
}, true);

renderAll();
startLiveMarketEngine();
