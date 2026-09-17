import { useEffect, useMemo, useRef, useState } from 'react';
import { getLastDigit, subscribeTicks } from '@/services/trading.service';

export type TDigitStat = {
    digit: number;
    count: number;
    percentage: number;
};

export type TTickAnalysis = {
    prices: number[];
    digits: number[];
    pip_size: number;
    latest_price: number | null;
    latest_digit: number | null;
    digit_stats: TDigitStat[];
    highest_digit: number | null;
    lowest_digit: number | null;
    even_count: number;
    odd_count: number;
    rise_count: number;
    fall_count: number;
    /** Length of the current run of the same parity, e.g. 3 consecutive odd digits. */
    parity_streak: { type: 'even' | 'odd' | null; length: number };
    /** Length of the current run of rises or falls. */
    direction_streak: { type: 'rise' | 'fall' | null; length: number };
};

type TUseTickAnalysis = TTickAnalysis & {
    is_loading: boolean;
    error: string | null;
};

const percentage = (part: number, total: number) => (total ? (part / total) * 100 : 0);

/**
 * Subscribes to a symbol's tick stream and derives the digit / direction
 * statistics the Analysis Tool renders. Pausing keeps the collected data but
 * drops the subscription.
 */
export const useTickAnalysis = ({
    symbol,
    tick_count,
    is_paused,
}: {
    symbol: string;
    tick_count: number;
    is_paused: boolean;
}): TUseTickAnalysis => {
    const [prices, setPrices] = useState<number[]>([]);
    const [pip_size, setPipSize] = useState(2);
    const [is_loading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const tick_count_ref = useRef(tick_count);

    tick_count_ref.current = tick_count;

    useEffect(() => {
        if (is_paused) return undefined;

        setIsLoading(true);
        setError(null);

        const stream = subscribeTicks(
            { symbol, count: tick_count },
            {
                onHistory: ({ prices: history_prices, pip_size: history_pip_size }) => {
                    setPipSize(history_pip_size);
                    setPrices(history_prices.slice(-tick_count_ref.current));
                    setIsLoading(false);
                },
                onTick: ({ quote, pip_size: tick_pip_size }) => {
                    setPipSize(tick_pip_size);
                    setPrices(current => [...current, quote].slice(-tick_count_ref.current));
                    setIsLoading(false);
                },
                onError: message => {
                    setError(message);
                    setIsLoading(false);
                },
            }
        );

        return () => stream.unsubscribe();
    }, [symbol, tick_count, is_paused]);

    // Trim in place when the window shrinks, so the stats follow immediately.
    useEffect(() => {
        setPrices(current => (current.length > tick_count ? current.slice(-tick_count) : current));
    }, [tick_count]);

    return useMemo(() => {
        const digits = prices.map(price => getLastDigit(price, pip_size));
        const total = digits.length;

        const counts = Array.from({ length: 10 }, () => 0);
        digits.forEach(digit => {
            counts[digit] += 1;
        });

        const digit_stats: TDigitStat[] = counts.map((count, digit) => ({
            digit,
            count,
            percentage: percentage(count, total),
        }));

        const sorted_by_count = [...digit_stats].filter(stat => total > 0).sort((a, b) => b.count - a.count);

        let rise_count = 0;
        let fall_count = 0;
        for (let index = 1; index < prices.length; index++) {
            if (prices[index] > prices[index - 1]) rise_count += 1;
            else if (prices[index] < prices[index - 1]) fall_count += 1;
        }

        const even_count = digits.filter(digit => digit % 2 === 0).length;

        let parity_streak: TTickAnalysis['parity_streak'] = { type: null, length: 0 };
        if (total) {
            const is_even = digits[total - 1] % 2 === 0;
            let length = 0;
            for (let index = total - 1; index >= 0; index--) {
                if ((digits[index] % 2 === 0) !== is_even) break;
                length += 1;
            }
            parity_streak = { type: is_even ? 'even' : 'odd', length };
        }

        let direction_streak: TTickAnalysis['direction_streak'] = { type: null, length: 0 };
        if (prices.length > 1) {
            const last_direction = prices[prices.length - 1] > prices[prices.length - 2] ? 'rise' : 'fall';
            let length = 0;
            for (let index = prices.length - 1; index > 0; index--) {
                const step = prices[index] > prices[index - 1] ? 'rise' : 'fall';
                if (step !== last_direction || prices[index] === prices[index - 1]) break;
                length += 1;
            }
            direction_streak = { type: last_direction, length };
        }

        return {
            prices,
            digits,
            pip_size,
            latest_price: total ? prices[total - 1] : null,
            latest_digit: total ? digits[total - 1] : null,
            digit_stats,
            highest_digit: sorted_by_count.length ? sorted_by_count[0].digit : null,
            lowest_digit: sorted_by_count.length ? sorted_by_count[sorted_by_count.length - 1].digit : null,
            even_count,
            odd_count: total - even_count,
            rise_count,
            fall_count,
            parity_streak,
            direction_streak,
            is_loading,
            error,
        };
    }, [prices, pip_size, is_loading, error]);
};

export default useTickAnalysis;
