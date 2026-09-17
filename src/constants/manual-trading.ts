/**
 * Contract definitions shared by the manual trading pages (Bulk Trader, DTrader)
 * and the Analysis Tool. Each trade type maps to the pair of Deriv contract types
 * that can be bought for it, plus the inputs the API requires for that pair.
 */

export type TDurationUnit = 't' | 's' | 'm' | 'h';

export type TBarrierMode = 'none' | 'digit' | 'digit_over_under';

export type TContractOption = {
    /** Deriv `contract_type` sent in the buy/proposal request. */
    value: string;
    label: string;
    /** Used to colour the buy button — 'up' is the bullish side of the pair. */
    direction: 'up' | 'down';
};

export type TTradeTypeConfig = {
    id: string;
    label: string;
    description: string;
    contracts: TContractOption[];
    barrier_mode: TBarrierMode;
    duration_units: TDurationUnit[];
    default_duration: number;
};

export const DURATION_UNIT_LABELS: Record<TDurationUnit, string> = {
    t: 'ticks',
    s: 'seconds',
    m: 'minutes',
    h: 'hours',
};

/** Loose client-side bounds; the API remains the source of truth and its errors are surfaced inline. */
export const DURATION_LIMITS: Record<TDurationUnit, { min: number; max: number }> = {
    t: { min: 1, max: 10 },
    s: { min: 15, max: 3600 },
    m: { min: 1, max: 1440 },
    h: { min: 1, max: 24 },
};

export const TRADE_TYPES: TTradeTypeConfig[] = [
    {
        id: 'rise_fall',
        label: 'Rise / Fall',
        description: 'Win if the exit spot is strictly higher or lower than the entry spot.',
        contracts: [
            { value: 'CALL', label: 'Rise', direction: 'up' },
            { value: 'PUT', label: 'Fall', direction: 'down' },
        ],
        barrier_mode: 'none',
        duration_units: ['t', 's', 'm', 'h'],
        default_duration: 5,
    },
    {
        id: 'even_odd',
        label: 'Even / Odd',
        description: 'Win if the last digit of the exit spot is even or odd.',
        contracts: [
            { value: 'DIGITEVEN', label: 'Even', direction: 'up' },
            { value: 'DIGITODD', label: 'Odd', direction: 'down' },
        ],
        barrier_mode: 'none',
        duration_units: ['t'],
        default_duration: 1,
    },
    {
        id: 'over_under',
        label: 'Over / Under',
        description: 'Win if the last digit of the exit spot is above or below your prediction.',
        contracts: [
            { value: 'DIGITOVER', label: 'Over', direction: 'up' },
            { value: 'DIGITUNDER', label: 'Under', direction: 'down' },
        ],
        barrier_mode: 'digit_over_under',
        duration_units: ['t'],
        default_duration: 1,
    },
    {
        id: 'matches_differs',
        label: 'Matches / Differs',
        description: 'Win if the last digit of the exit spot matches or differs from your prediction.',
        contracts: [
            { value: 'DIGITMATCH', label: 'Matches', direction: 'up' },
            { value: 'DIGITDIFF', label: 'Differs', direction: 'down' },
        ],
        barrier_mode: 'digit',
        duration_units: ['t'],
        default_duration: 1,
    },
];

export const getTradeType = (id: string): TTradeTypeConfig =>
    TRADE_TYPES.find(trade_type => trade_type.id === id) ?? TRADE_TYPES[0];

/** Volatility indices trade 24/7, so they are the most useful default for every page. */
export const DEFAULT_SYMBOL = 'R_100';

export const PREFERRED_MARKET_ORDER = ['synthetic_index', 'forex', 'indices', 'commodities', 'cryptocurrency'];

/**
 * Valid last-digit predictions for a contract type. "Over" cannot be 9 and
 * "Under" cannot be 0, since those contracts could never win.
 */
export const getPredictionDigits = (contract_type: string): number[] => {
    if (contract_type === 'DIGITOVER') return [0, 1, 2, 3, 4, 5, 6, 7, 8];
    if (contract_type === 'DIGITUNDER') return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
};
