import React from 'react';
import { TTradingSymbol } from '@/services/trading.service';
import { localize } from '@deriv-com/translations';
import './trading.scss';

type TSymbolSelectProps = {
    id?: string;
    symbols: TTradingSymbol[];
    value: string;
    disabled?: boolean;
    onChange: (symbol: string) => void;
};

/** Market-grouped symbol picker. Closed markets stay selectable but are flagged. */
const SymbolSelect = ({ id, symbols, value, disabled, onChange }: TSymbolSelectProps) => {
    const groups = React.useMemo(() => {
        const grouped = new Map<string, TTradingSymbol[]>();
        symbols.forEach(symbol => {
            const key = symbol.market_display_name || symbol.market;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)?.push(symbol);
        });
        return Array.from(grouped.entries());
    }, [symbols]);

    return (
        <select
            id={id}
            className='tp-select'
            value={value}
            disabled={disabled || !symbols.length}
            onChange={event => onChange(event.target.value)}
        >
            {!symbols.length && <option value=''>{localize('Loading markets…')}</option>}
            {groups.map(([market, market_symbols]) => (
                <optgroup key={market} label={market}>
                    {market_symbols.map(symbol => (
                        <option key={symbol.symbol} value={symbol.symbol}>
                            {symbol.is_open ? symbol.display_name : `${symbol.display_name} (${localize('closed')})`}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
};

export default SymbolSelect;
