import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { LoginGate, PageHeader, SymbolSelect, TradingField } from '@/components/trading';
import {
    DURATION_LIMITS,
    DURATION_UNIT_LABELS,
    getPredictionDigits,
    getTradeType,
    TDurationUnit,
    TRADE_TYPES,
} from '@/constants/manual-trading';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { useTradingSymbols } from '@/hooks/useTradingSymbols';
import {
    buyContract,
    getApiErrorMessage,
    subscribeContract,
    TStreamHandle,
} from '@/services/trading.service';
import { Localize, localize } from '@deriv-com/translations';
import './bulk-trader.scss';

type TRowStatus = 'pending' | 'open' | 'won' | 'lost' | 'failed';

type TTradeRow = {
    key: string;
    position: number;
    contract_id: number | null;
    side: string;
    buy_price: number;
    payout: number;
    profit: number;
    status: TRowStatus;
    error?: string;
};

const STATUS_BADGES: Record<TRowStatus, string> = {
    pending: 'tp-badge',
    open: 'tp-badge tp-badge--info',
    won: 'tp-badge tp-badge--success',
    lost: 'tp-badge tp-badge--danger',
    failed: 'tp-badge tp-badge--danger',
};

const STATUS_LABELS: Record<TRowStatus, string> = {
    pending: 'Placing',
    open: 'Open',
    won: 'Won',
    lost: 'Lost',
    failed: 'Failed',
};

const MAX_BATCH_SIZE = 50;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const BulkTrader = observer(() => {
    const { client } = useStore();
    const { isAuthorized } = useApiBase();
    const { symbols, is_loading: are_symbols_loading, error: symbols_error } = useTradingSymbols();

    const [symbol, setSymbol] = React.useState('R_100');
    const [trade_type_id, setTradeTypeId] = React.useState(TRADE_TYPES[0].id);
    const [contract_type, setContractType] = React.useState(TRADE_TYPES[0].contracts[0].value);
    const [prediction, setPrediction] = React.useState(5);
    const [stake, setStake] = React.useState(1);
    const [duration, setDuration] = React.useState(TRADE_TYPES[0].default_duration);
    const [duration_unit, setDurationUnit] = React.useState<TDurationUnit>('t');
    const [batch_size, setBatchSize] = React.useState(5);
    const [delay_seconds, setDelaySeconds] = React.useState(1);
    const [is_confirmed, setIsConfirmed] = React.useState(false);

    const [rows, setRows] = React.useState<TTradeRow[]>([]);
    const [is_running, setIsRunning] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const stop_requested = React.useRef(false);
    const contract_streams = React.useRef<TStreamHandle[]>([]);

    const trade_type = getTradeType(trade_type_id);
    const prediction_digits = getPredictionDigits(contract_type);
    const is_real_account = client.is_logged_in && !client.is_virtual;
    const needs_confirmation = is_real_account && !is_confirmed;

    // Drop every contract subscription when the page unmounts.
    React.useEffect(
        () => () => {
            stop_requested.current = true;
            contract_streams.current.forEach(stream => stream.unsubscribe());
            contract_streams.current = [];
        },
        []
    );

    // Keep the contract side and duration valid whenever the trade type changes.
    const handleTradeTypeChange = (next_id: string) => {
        const next = getTradeType(next_id);
        setTradeTypeId(next_id);
        setContractType(next.contracts[0].value);
        setDuration(next.default_duration);
        if (!next.duration_units.includes(duration_unit)) setDurationUnit(next.duration_units[0]);
    };

    const updateRow = (key: string, patch: Partial<TTradeRow>) => {
        setRows(current => current.map(row => (row.key === key ? { ...row, ...patch } : row)));
    };

    const watchContract = (key: string, contract_id: number) => {
        const stream = subscribeContract(
            contract_id,
            update => {
                updateRow(key, {
                    status: update.is_sold ? (update.profit >= 0 ? 'won' : 'lost') : 'open',
                    profit: update.profit,
                    payout: update.payout || 0,
                });
            },
            message => updateRow(key, { error: message })
        );
        contract_streams.current.push(stream);
    };

    const validate = (): string | null => {
        if (!symbol) return localize('Choose a market first.');
        if (stake <= 0) return localize('Enter a stake greater than zero.');
        const limits = DURATION_LIMITS[duration_unit];
        if (duration < limits.min || duration > limits.max) {
            return localize('Duration must be between {{min}} and {{max}} {{unit}}.', {
                min: limits.min,
                max: limits.max,
                unit: localize(DURATION_UNIT_LABELS[duration_unit]),
            });
        }
        if (batch_size < 1 || batch_size > MAX_BATCH_SIZE) {
            return localize('Number of trades must be between 1 and {{max}}.', { max: MAX_BATCH_SIZE });
        }
        return null;
    };

    const handleRun = async () => {
        const validation_error = validate();
        if (validation_error) {
            setError(validation_error);
            return;
        }

        setError(null);
        setRows([]);
        stop_requested.current = false;
        setIsRunning(true);

        const side_label =
            trade_type.contracts.find(contract => contract.value === contract_type)?.label ?? contract_type;
        const barrier = trade_type.barrier_mode === 'none' ? undefined : String(prediction);

        for (let position = 1; position <= batch_size; position++) {
            if (stop_requested.current) break;

            const key = `${Date.now()}-${position}`;
            setRows(current => [
                ...current,
                {
                    key,
                    position,
                    contract_id: null,
                    side: side_label,
                    buy_price: 0,
                    payout: 0,
                    profit: 0,
                    status: 'pending',
                },
            ]);

            try {
                const result = await buyContract({
                    symbol,
                    contract_type,
                    amount: stake,
                    currency: client.currency || 'USD',
                    duration,
                    duration_unit,
                    barrier,
                });
                updateRow(key, {
                    contract_id: result.contract_id,
                    buy_price: result.buy_price,
                    payout: result.payout,
                    status: 'open',
                });
                watchContract(key, result.contract_id);
            } catch (caught) {
                const message = getApiErrorMessage(caught, localize('The trade was rejected.'));
                updateRow(key, { status: 'failed', error: message });
                setError(message);
                break;
            }

            if (position < batch_size && delay_seconds > 0) await sleep(delay_seconds * 1000);
        }

        setIsRunning(false);
    };

    const handleStop = () => {
        stop_requested.current = true;
        setIsRunning(false);
    };

    const totals = React.useMemo(() => {
        const settled = rows.filter(row => row.status === 'won' || row.status === 'lost');
        return {
            placed: rows.filter(row => row.contract_id !== null).length,
            open: rows.filter(row => row.status === 'open').length,
            won: rows.filter(row => row.status === 'won').length,
            lost: rows.filter(row => row.status === 'lost').length,
            staked: rows.reduce((sum, row) => sum + row.buy_price, 0),
            profit: settled.reduce((sum, row) => sum + row.profit, 0),
        };
    }, [rows]);

    const formatMoney = (value: number) =>
        `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)} ${client.currency || ''}`.trim();

    if (!client.is_logged_in) {
        return (
            <div className='tp-page'>
                <PageHeader
                    eyebrow={localize('Execution')}
                    title={localize('Bulk Trader')}
                    subtitle={localize(
                        'Place a batch of identical contracts in one go, with a delay between each trade, and follow every position until it settles.'
                    )}
                />
                <LoginGate
                    message={localize(
                        'Bulk Trader buys contracts on your Deriv account, so it needs an authorised session. Log in to continue — a demo account is the safest way to try it.'
                    )}
                />
            </div>
        );
    }

    return (
        <div className='tp-page bulk-trader'>
            <PageHeader
                eyebrow={localize('Execution')}
                title={localize('Bulk Trader')}
                subtitle={localize(
                    'Place a batch of identical contracts in one go, with a delay between each trade, and follow every position until it settles.'
                )}
                actions={
                    <>
                        <span className={classNames('tp-badge', is_real_account ? 'tp-badge--danger' : 'tp-badge--info')}>
                            {is_real_account ? localize('Real account') : localize('Demo account')} · {client.loginid}
                        </span>
                        <span className='tp-badge'>
                            <Localize
                                i18n_default_text='Balance {{balance}} {{currency}}'
                                values={{ balance: client.balance, currency: client.currency }}
                            />
                        </span>
                    </>
                }
            />

            {!isAuthorized && (
                <div className='tp-notice'>
                    <Localize i18n_default_text='Connecting to your account… trading unlocks as soon as the session is authorised.' />
                </div>
            )}

            {symbols_error && <div className='tp-notice tp-notice--danger'>{symbols_error}</div>}
            {error && <div className='tp-notice tp-notice--danger'>{error}</div>}

            <section className='tp-panel'>
                <h2 className='tp-panel__title'>
                    <Localize i18n_default_text='Batch setup' />
                </h2>
                <div className='tp-grid'>
                    <TradingField label={localize('Market')} htmlFor='bulk-symbol'>
                        <SymbolSelect
                            id='bulk-symbol'
                            symbols={symbols}
                            value={symbol}
                            disabled={is_running || are_symbols_loading}
                            onChange={setSymbol}
                        />
                    </TradingField>

                    <TradingField label={localize('Trade type')} htmlFor='bulk-trade-type'>
                        <select
                            id='bulk-trade-type'
                            className='tp-select'
                            value={trade_type_id}
                            disabled={is_running}
                            onChange={event => handleTradeTypeChange(event.target.value)}
                        >
                            {TRADE_TYPES.map(item => (
                                <option key={item.id} value={item.id}>
                                    {localize(item.label)}
                                </option>
                            ))}
                        </select>
                    </TradingField>

                    <TradingField label={localize('Direction')} htmlFor='bulk-contract-type'>
                        <select
                            id='bulk-contract-type'
                            className='tp-select'
                            value={contract_type}
                            disabled={is_running}
                            onChange={event => {
                                const next_contract_type = event.target.value;
                                setContractType(next_contract_type);
                                const digits = getPredictionDigits(next_contract_type);
                                if (!digits.includes(prediction)) setPrediction(digits[0]);
                            }}
                        >
                            {trade_type.contracts.map(contract => (
                                <option key={contract.value} value={contract.value}>
                                    {localize(contract.label)}
                                </option>
                            ))}
                        </select>
                    </TradingField>

                    {trade_type.barrier_mode !== 'none' && (
                        <TradingField
                            label={localize('Last digit prediction')}
                            htmlFor='bulk-prediction'
                            hint={localize('0–9')}
                        >
                            <select
                                id='bulk-prediction'
                                className='tp-select'
                                value={prediction}
                                disabled={is_running}
                                onChange={event => setPrediction(Number(event.target.value))}
                            >
                                {prediction_digits.map(digit => (
                                    <option key={digit} value={digit}>
                                        {digit}
                                    </option>
                                ))}
                            </select>
                        </TradingField>
                    )}

                    <TradingField label={localize('Stake per trade')} htmlFor='bulk-stake'>
                        <input
                            id='bulk-stake'
                            className='tp-input'
                            type='number'
                            min={0.35}
                            step={0.01}
                            value={stake}
                            disabled={is_running}
                            onChange={event => setStake(Number(event.target.value))}
                        />
                    </TradingField>

                    <TradingField label={localize('Duration')} htmlFor='bulk-duration'>
                        <div className='bulk-trader__duration'>
                            <input
                                id='bulk-duration'
                                className='tp-input'
                                type='number'
                                min={DURATION_LIMITS[duration_unit].min}
                                max={DURATION_LIMITS[duration_unit].max}
                                value={duration}
                                disabled={is_running}
                                onChange={event => setDuration(Number(event.target.value))}
                            />
                            <select
                                className='tp-select'
                                value={duration_unit}
                                disabled={is_running || trade_type.duration_units.length === 1}
                                onChange={event => setDurationUnit(event.target.value as TDurationUnit)}
                                aria-label={localize('Duration unit')}
                            >
                                {trade_type.duration_units.map(unit => (
                                    <option key={unit} value={unit}>
                                        {localize(DURATION_UNIT_LABELS[unit])}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </TradingField>

                    <TradingField
                        label={localize('Number of trades')}
                        htmlFor='bulk-batch-size'
                        hint={localize('Up to {{max}} per batch', { max: MAX_BATCH_SIZE })}
                    >
                        <input
                            id='bulk-batch-size'
                            className='tp-input'
                            type='number'
                            min={1}
                            max={MAX_BATCH_SIZE}
                            value={batch_size}
                            disabled={is_running}
                            onChange={event => setBatchSize(Number(event.target.value))}
                        />
                    </TradingField>

                    <TradingField
                        label={localize('Delay between trades')}
                        htmlFor='bulk-delay'
                        hint={localize('Seconds')}
                    >
                        <input
                            id='bulk-delay'
                            className='tp-input'
                            type='number'
                            min={0}
                            max={60}
                            step={0.5}
                            value={delay_seconds}
                            disabled={is_running}
                            onChange={event => setDelaySeconds(Number(event.target.value))}
                        />
                    </TradingField>
                </div>

                <p className='tp-panel__hint'>{localize(trade_type.description)}</p>

                {is_real_account && (
                    <label className='bulk-trader__confirm'>
                        <input
                            type='checkbox'
                            checked={is_confirmed}
                            disabled={is_running}
                            onChange={event => setIsConfirmed(event.target.checked)}
                        />
                        <span>
                            <Localize
                                i18n_default_text='I understand that this places {{count}} real-money contracts on {{loginid}}.'
                                values={{ count: batch_size, loginid: client.loginid }}
                            />
                        </span>
                    </label>
                )}

                <div className='bulk-trader__actions'>
                    <button
                        className='tp-button tp-button--primary'
                        onClick={handleRun}
                        disabled={is_running || !isAuthorized || needs_confirmation}
                    >
                        {is_running ? (
                            <Localize i18n_default_text='Placing trades…' />
                        ) : (
                            <Localize
                                i18n_default_text='Place {{count}} trades · {{total}} total stake'
                                values={{ count: batch_size, total: formatMoney(batch_size * stake) }}
                            />
                        )}
                    </button>
                    <button className='tp-button tp-button--danger' onClick={handleStop} disabled={!is_running}>
                        <Localize i18n_default_text='Stop batch' />
                    </button>
                    {rows.length > 0 && !is_running && (
                        <button className='tp-button tp-button--secondary' onClick={() => setRows([])}>
                            <Localize i18n_default_text='Clear results' />
                        </button>
                    )}
                </div>
            </section>

            <section className='tp-panel'>
                <h2 className='tp-panel__title'>
                    <Localize i18n_default_text='Batch results' />
                </h2>

                <div className='bulk-trader__stats'>
                    <div className='tp-stat'>
                        <span className='tp-stat__label'>{localize('Placed')}</span>
                        <span className='tp-stat__value'>{totals.placed}</span>
                    </div>
                    <div className='tp-stat'>
                        <span className='tp-stat__label'>{localize('Open')}</span>
                        <span className='tp-stat__value'>{totals.open}</span>
                    </div>
                    <div className='tp-stat'>
                        <span className='tp-stat__label'>{localize('Won / Lost')}</span>
                        <span className='tp-stat__value'>
                            {totals.won} / {totals.lost}
                        </span>
                    </div>
                    <div className='tp-stat'>
                        <span className='tp-stat__label'>{localize('Total staked')}</span>
                        <span className='tp-stat__value'>{formatMoney(totals.staked)}</span>
                    </div>
                    <div className='tp-stat'>
                        <span className='tp-stat__label'>{localize('Net profit / loss')}</span>
                        <span
                            className={classNames('tp-stat__value', {
                                'tp-stat__value--profit': totals.profit > 0,
                                'tp-stat__value--loss': totals.profit < 0,
                            })}
                        >
                            {formatMoney(totals.profit)}
                        </span>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <div className='tp-empty'>
                        <span className='tp-empty__title'>{localize('No trades in this batch yet')}</span>
                        <span className='tp-empty__text'>
                            <Localize i18n_default_text='Set up the batch above and press “Place trades”. Each contract appears here and updates live until it settles.' />
                        </span>
                    </div>
                ) : (
                    <div className='tp-table-wrapper'>
                        <table className='tp-table'>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{localize('Contract')}</th>
                                    <th>{localize('Direction')}</th>
                                    <th>{localize('Stake')}</th>
                                    <th>{localize('Payout')}</th>
                                    <th>{localize('Status')}</th>
                                    <th>{localize('Profit / loss')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr key={row.key}>
                                        <td>{row.position}</td>
                                        <td>{row.contract_id ?? '—'}</td>
                                        <td>{row.side}</td>
                                        <td>{row.buy_price ? formatMoney(row.buy_price) : '—'}</td>
                                        <td>{row.payout ? formatMoney(row.payout) : '—'}</td>
                                        <td>
                                            <span className={STATUS_BADGES[row.status]}>
                                                {localize(STATUS_LABELS[row.status])}
                                            </span>
                                            {row.error && <div className='bulk-trader__row-error'>{row.error}</div>}
                                        </td>
                                        <td
                                            className={classNames({
                                                'tp-table__profit': row.profit > 0,
                                                'tp-table__loss': row.profit < 0,
                                            })}
                                        >
                                            {row.status === 'won' || row.status === 'lost'
                                                ? formatMoney(row.profit)
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
});

export default BulkTrader;
