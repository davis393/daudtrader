/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Thin wrapper around the Deriv WebSocket API for the manual trading and
 * analysis pages.
 *
 * Two connections are already maintained by the app and are reused here:
 * - `chart_api` is unauthenticated, so market data (symbols, tick streams)
 *   works for visitors who have not logged in yet.
 * - `api_base` is the authorised connection and is required for anything that
 *   touches an account (proposals with payouts, buying, selling).
 */

import { api_base } from '@/external/bot-skeleton';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';

type TApi = {
    send: (request: unknown) => Promise<any>;
    onMessage: () => { subscribe: (cb: (message: { data: any }) => void) => { unsubscribe: () => void } } | undefined;
    forget: (id: string) => Promise<unknown>;
};

export type TStreamHandle = {
    unsubscribe: () => void;
};

export type TTradingSymbol = {
    symbol: string;
    display_name: string;
    market: string;
    market_display_name: string;
    submarket_display_name: string;
    is_open: boolean;
};

export type TBuyParams = {
    symbol: string;
    contract_type: string;
    amount: number;
    currency: string;
    duration: number;
    duration_unit: string;
    barrier?: string;
};

export type TBuyResult = {
    contract_id: number;
    buy_price: number;
    payout: number;
    longcode: string;
    transaction_id: number;
    start_time: number;
};

/** Deriv returns errors both as a rejected promise and as an `error` key; flatten both. */
export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.'): string => {
    const candidate = error as any;
    return (
        candidate?.error?.message ??
        candidate?.error?.error?.message ??
        candidate?.message ??
        (typeof candidate === 'string' ? candidate : fallback)
    );
};

const assertNoError = (response: any) => {
    if (response?.error) throw response;
    return response;
};

/** Market-data connection — available without logging in. */
export const getMarketApi = async (): Promise<TApi> => {
    if (!chart_api.api) await chart_api.init();
    return chart_api.api as unknown as TApi;
};

/** Authorised connection — required for buying and selling. */
export const getAccountApi = (): TApi => {
    if (!api_base?.api) throw new Error('Not connected to Deriv. Please wait for the connection or log in again.');
    return api_base.api as unknown as TApi;
};

type TSubscribeOptions = {
    onData: (data: any) => void;
    onError?: (message: string) => void;
    /** Extra match for streams whose follow-up messages omit the subscription id. */
    matches?: (data: any) => boolean;
};

/**
 * Subscribe to a streaming API call. The first response is delivered to `onData`
 * as well, so callers get the seed payload (history, first proposal, …).
 */
const subscribeStream = (api: TApi, request: Record<string, unknown>, options: TSubscribeOptions): TStreamHandle => {
    const { onData, onError, matches } = options;
    let subscription_id: string | null = null;
    let is_cancelled = false;

    const message_subscription = api.onMessage()?.subscribe(({ data }) => {
        if (is_cancelled || !data) return;
        const incoming_id = data?.subscription?.id;
        const is_match = (subscription_id && incoming_id === subscription_id) || (!incoming_id && matches?.(data));
        if (is_match) onData(data);
    });

    api.send({ ...request, subscribe: 1 })
        .then(response => {
            assertNoError(response);
            if (is_cancelled) {
                const id = response?.subscription?.id;
                if (id) api.forget(id);
                return;
            }
            subscription_id = response?.subscription?.id ?? null;
            onData(response);
        })
        .catch(error => {
            if (!is_cancelled) onError?.(getApiErrorMessage(error));
        });

    return {
        unsubscribe: () => {
            is_cancelled = true;
            message_subscription?.unsubscribe();
            if (subscription_id) {
                api.forget(subscription_id).catch(() => {
                    /* the socket may already be gone — nothing to clean up */
                });
            }
        },
    };
};

const MARKET_ORDER: Record<string, number> = {
    synthetic_index: 0,
    forex: 1,
    indices: 2,
    commodities: 3,
    cryptocurrency: 4,
};

let symbols_cache: TTradingSymbol[] | null = null;

/** Tradeable symbols, synthetics first. Cached for the lifetime of the page. */
export const fetchTradingSymbols = async (): Promise<TTradingSymbol[]> => {
    if (symbols_cache) return symbols_cache;

    const api = await getMarketApi();
    const response = assertNoError(await api.send({ active_symbols: 'brief', product_type: 'basic' }));

    const symbols: TTradingSymbol[] = (response?.active_symbols ?? [])
        .filter((symbol: any) => symbol?.symbol)
        .map((symbol: any) => ({
            symbol: symbol.symbol,
            display_name: symbol.display_name,
            market: symbol.market,
            market_display_name: symbol.market_display_name,
            submarket_display_name: symbol.submarket_display_name,
            is_open: symbol.exchange_is_open === 1,
        }))
        .sort((a: TTradingSymbol, b: TTradingSymbol) => {
            const market_diff = (MARKET_ORDER[a.market] ?? 99) - (MARKET_ORDER[b.market] ?? 99);
            if (market_diff !== 0) return market_diff;
            return a.display_name.localeCompare(b.display_name);
        });

    symbols_cache = symbols;
    return symbols;
};

export type TTickStreamHandlers = {
    onHistory: (payload: { prices: number[]; times: number[]; pip_size: number }) => void;
    onTick: (payload: { quote: number; epoch: number; pip_size: number }) => void;
    onError?: (message: string) => void;
};

/** Seed with `count` historical ticks, then stream every new tick for `symbol`. */
export const subscribeTicks = (
    { symbol, count }: { symbol: string; count: number },
    handlers: TTickStreamHandlers
): TStreamHandle => {
    let handle: TStreamHandle | null = null;
    let is_cancelled = false;

    getMarketApi()
        .then(api => {
            if (is_cancelled) return;
            handle = subscribeStream(
                api,
                { ticks_history: symbol, adjust_start_time: 1, count, end: 'latest', style: 'ticks' },
                {
                    matches: data => data?.echo_req?.ticks_history === symbol || data?.tick?.symbol === symbol,
                    onError: handlers.onError,
                    onData: data => {
                        if (data?.history) {
                            handlers.onHistory({
                                prices: (data.history.prices ?? []).map(Number),
                                times: (data.history.times ?? []).map(Number),
                                pip_size: Number(data.pip_size ?? 2),
                            });
                        } else if (data?.tick) {
                            handlers.onTick({
                                quote: Number(data.tick.quote),
                                epoch: Number(data.tick.epoch),
                                pip_size: Number(data.tick.pip_size ?? data.pip_size ?? 2),
                            });
                        }
                    },
                }
            );
        })
        .catch(error => {
            if (!is_cancelled) handlers.onError?.(getApiErrorMessage(error));
        });

    return {
        unsubscribe: () => {
            is_cancelled = true;
            handle?.unsubscribe();
        },
    };
};

const buildContractParameters = ({
    symbol,
    contract_type,
    amount,
    currency,
    duration,
    duration_unit,
    barrier,
}: TBuyParams) => ({
    amount,
    basis: 'stake',
    contract_type,
    currency,
    duration,
    duration_unit,
    symbol,
    ...(barrier !== undefined && barrier !== '' ? { barrier } : {}),
});

/** Live price/payout quote for a contract, updated on every tick. */
export const subscribeProposal = (
    params: TBuyParams,
    onData: (payload: { payout: number; ask_price: number; spot: number; longcode: string }) => void,
    onError?: (message: string) => void
): TStreamHandle => {
    const api = getAccountApi();
    return subscribeStream(
        api,
        { proposal: 1, ...buildContractParameters(params) },
        {
            onError,
            matches: data =>
                data?.msg_type === 'proposal' &&
                data?.echo_req?.contract_type === params.contract_type &&
                data?.echo_req?.symbol === params.symbol,
            onData: data => {
                if (data?.error) {
                    onError?.(getApiErrorMessage(data));
                    return;
                }
                if (!data?.proposal) return;
                onData({
                    payout: Number(data.proposal.payout ?? 0),
                    ask_price: Number(data.proposal.ask_price ?? 0),
                    spot: Number(data.proposal.spot ?? 0),
                    longcode: data.proposal.longcode ?? '',
                });
            },
        }
    );
};

/** Buy a contract directly from its parameters (no proposal round-trip required). */
export const buyContract = async (params: TBuyParams): Promise<TBuyResult> => {
    const api = getAccountApi();
    const response = assertNoError(
        await api.send({ buy: '1', price: params.amount, parameters: buildContractParameters(params) })
    );

    return {
        contract_id: Number(response.buy.contract_id),
        buy_price: Number(response.buy.buy_price),
        payout: Number(response.buy.payout),
        longcode: response.buy.longcode ?? '',
        transaction_id: Number(response.buy.transaction_id),
        start_time: Number(response.buy.start_time),
    };
};

export type TContractUpdate = {
    contract_id: number;
    status: 'open' | 'won' | 'lost' | 'sold';
    profit: number;
    payout: number;
    buy_price: number;
    current_spot: number | null;
    entry_spot: number | null;
    is_sold: boolean;
    is_valid_to_sell: boolean;
    bid_price: number;
    tick_count: number | null;
    current_tick: number | null;
};

/** Track a bought contract until it is sold/expired. */
export const subscribeContract = (
    contract_id: number,
    onData: (update: TContractUpdate) => void,
    onError?: (message: string) => void
): TStreamHandle => {
    const api = getAccountApi();
    return subscribeStream(
        api,
        { proposal_open_contract: 1, contract_id },
        {
            onError,
            matches: data => Number(data?.proposal_open_contract?.contract_id) === contract_id,
            onData: data => {
                const contract = data?.proposal_open_contract;
                if (!contract) return;
                const profit = Number(contract.profit ?? 0);
                const is_sold = Boolean(contract.is_sold);
                onData({
                    contract_id: Number(contract.contract_id),
                    status: is_sold ? (profit >= 0 ? 'won' : 'lost') : 'open',
                    profit,
                    payout: Number(contract.payout ?? 0),
                    buy_price: Number(contract.buy_price ?? 0),
                    current_spot: contract.current_spot ? Number(contract.current_spot) : null,
                    entry_spot: contract.entry_spot ? Number(contract.entry_spot) : null,
                    is_sold,
                    is_valid_to_sell: Boolean(contract.is_valid_to_sell),
                    bid_price: Number(contract.bid_price ?? 0),
                    tick_count: contract.tick_count ? Number(contract.tick_count) : null,
                    current_tick: contract.current_spot_time ? Number(contract.tick_stream?.length ?? 0) : null,
                });
            },
        }
    );
};

/** Sell an open contract at market price. */
export const sellContract = async (contract_id: number): Promise<{ sold_for: number }> => {
    const api = getAccountApi();
    const response = assertNoError(await api.send({ sell: contract_id, price: 0 }));
    return { sold_for: Number(response?.sell?.sold_for ?? 0) };
};

/** Last digit of a quote, respecting the symbol's pip size (e.g. 1234.56 → 6). */
export const getLastDigit = (quote: number, pip_size: number): number => {
    const formatted = quote.toFixed(pip_size);
    return Number(formatted[formatted.length - 1]);
};
