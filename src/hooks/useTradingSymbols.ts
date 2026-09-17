import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTradingSymbols, getApiErrorMessage, TTradingSymbol } from '@/services/trading.service';

type TUseTradingSymbols = {
    symbols: TTradingSymbol[];
    is_loading: boolean;
    error: string | null;
    reload: () => void;
};

/** Loads the tradeable symbol list once and shares the cached result across pages. */
export const useTradingSymbols = (): TUseTradingSymbols => {
    const [symbols, setSymbols] = useState<TTradingSymbol[]>([]);
    const [is_loading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const is_mounted = useRef(true);

    const load = useCallback(() => {
        setIsLoading(true);
        setError(null);
        fetchTradingSymbols()
            .then(result => {
                if (!is_mounted.current) return;
                setSymbols(result);
                setIsLoading(false);
            })
            .catch(caught => {
                if (!is_mounted.current) return;
                setError(getApiErrorMessage(caught, 'Could not load the market list.'));
                setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        is_mounted.current = true;
        load();
        return () => {
            is_mounted.current = false;
        };
    }, [load]);

    return { symbols, is_loading, error, reload: load };
};

export default useTradingSymbols;
