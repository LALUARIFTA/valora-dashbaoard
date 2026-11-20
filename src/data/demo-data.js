export const CURRENCY_CONFIG = {
  USD: { symbol: '$', rate: 1, compactSuffix: 'k' },
  IDR: { symbol: 'Rp', rate: 15800, compactSuffix: 'jt' },
  EUR: { symbol: '€', rate: 0.92, compactSuffix: 'k' },
  SGD: { symbol: 'S$', rate: 1.34, compactSuffix: 'k' }
};

export const DEFAULT_STATE = {
  user: {
    name: 'Elena Vance',
    avatar: '',
    cardLast4: '5678',
    cardFull: '4532  8910  3412  5678',
    expiry: '09/29',
    cardFrozen: false
  },
  currency: 'IDR',
  liveMarket: true,
  chartRange: '6M',
  strategy: 'Balanced', // Conservative | Balanced | Aggressive
  cashBalance: 176400, // Liquid cash in USD
  investedSeries: {
    '1M': [
      { label: 'W1', value: 21.4 },
      { label: 'W2', value: 23.1 },
      { label: 'W3', value: 22.6 },
      { label: 'W4', value: 25.4 }
    ],
    '6M': [
      { label: 'Jan', value: 12.2 },
      { label: 'Feb', value: 13.8 },
      { label: 'Mar', value: 18.4 },
      { label: 'Apr', value: 26.8 },
      { label: 'May', value: 23.5 },
      { label: 'Jun', value: 21.6 }
    ],
    '1Y': [
      { label: 'Q1', value: 11.5 },
      { label: 'Q2', value: 16.9 },
      { label: 'Q3', value: 24.8 },
      { label: 'Q4', value: 28.9 }
    ]
  },
  assets: [
    {
      id: 'ast-1',
      ticker: 'SPOT',
      name: 'Spotify',
      category: 'Stocks',
      price: 75.30,
      qty: 60,
      change: 1.2,
      color: '#10B981',
      spark: [18, 16, 17, 11, 13, 8, 6],
      logoUrl: ''
    },
    {
      id: 'ast-2',
      ticker: 'ABNB',
      name: 'Airbnb',
      category: 'Stocks',
      price: 95.58,
      qty: 45,
      change: 1.1,
      color: '#F43F5E',
      spark: [17, 15, 16, 11, 13, 8, 5],
      logoUrl: ''
    },
    {
      id: 'ast-3',
      ticker: 'DBX',
      name: 'Dropbox Inc.',
      category: 'Stocks',
      price: 310.00,
      qty: 12,
      change: 0.8,
      color: '#2563EB',
      spark: [19, 14, 16, 10, 12, 7, 4],
      logoUrl: ''
    },
    {
      id: 'ast-4',
      ticker: 'ETH',
      name: 'Ethereum Core',
      category: 'Crypto',
      price: 3420.00,
      qty: 2.5,
      change: 3.4,
      color: '#4F46E5',
      spark: [20, 18, 15, 14, 10, 8, 4],
      logoUrl: ''
    },
    {
      id: 'ast-5',
      ticker: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      category: 'ETFs',
      price: 512.40,
      qty: 10,
      change: 0.9,
      color: '#0D9488',
      spark: [18, 17, 15, 14, 12, 9, 7],
      logoUrl: ''
    },
    {
      id: 'ast-6',
      ticker: 'USTB',
      name: 'US Treasury 10Y Bond',
      category: 'Bonds',
      price: 102.50,
      qty: 30,
      change: 0.4,
      color: '#D97706',
      spark: [15, 14, 14, 13, 12, 11, 10],
      logoUrl: ''
    },
    {
      id: 'ast-7',
      ticker: 'ARTX',
      name: 'Valora Genesis Pass',
      category: 'NFTs',
      price: 1850.00,
      qty: 1,
      change: 2.1,
      color: '#7C3AED',
      spark: [19, 16, 17, 13, 11, 9, 6],
      logoUrl: ''
    }
  ],
  transactions: [
    {
      id: 'tx-1',
      title: 'Funds Loaded',
      date: '12 May 2026',
      type: 'deposit',
      amount: 3500
    },
    {
      id: 'tx-2',
      title: 'Funds Withdraw',
      date: '05 May 2026',
      type: 'withdraw',
      amount: 1300
    },
    {
      id: 'tx-3',
      title: 'Dividend Yield Payout',
      date: '28 Apr 2026',
      type: 'deposit',
      amount: 840
    },
    {
      id: 'tx-4',
      title: 'Funds Loaded',
      date: '14 Apr 2026',
      type: 'deposit',
      amount: 5000
    }
  ]
};
