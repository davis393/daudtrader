import React from 'react';
import classNames from 'classnames';
import { PageHeader, SymbolSelect, TradingField } from '@/components/trading';
import { DEFAULT_SYMBOL } from '@/constants/manual-trading';
import { useTradingSymbols } from '@/hooks/useTradingSymbols';
import { Localize, localize } from '@deriv-com/translations';
import { useTickAnalysis } from './use-tick-analysis';
import './analysis-tool.scss';

const TICK_WINDOWS = [100, 250, 500, 1000];

type TMeterProps = {
    label: string;
    left: { label: string; value: number };
    right: { label: string; value: number };
};

/** Two-sided share meter used for even/odd, over/under and rise/fall splits. */
const SplitMeter = ({ label, left, right }: TMeterProps) => {
    const total = left.value + right.value;
    const left_share = total ? (left.value / total) * 100 : 50;
    const right_share = 100 - left_share;

    return (
        <div className='analysis-tool__meter'>
            <span className='analysis-tool__meter-label'>{label}</span>
            <div className='analysis-tool__meter-bar' role='img' aria-label={`${label}: ${left_share.toFixed(1)}%`}>
                <span className='analysis-tool__meter-fill analysis-tool__meter-fill--up' style={{ width: `${left_share}%` }} />
                <span
                    className='analysis-tool__meter-fill analysis-tool__meter-fill--down'
                    style={{ width: `${right_share}%` }}
                />
            </div>
            <div className='analysis-tool__meter-legend'>
                <span className='analysis-tool__meter-side analysis-tool__meter-side--up'>
                    {left.label} {left_share.toFixed(1)}%
                </span>
                <span className='analysis-tool__meter-side analysis-tool__meter-side--down'>
                    {right.label} {right_share.toFixed(1)}%
                </span>
            </div>
        </div>
    );
};

const AnalysisTool = () => {
    const { symbols, error: symbols_error } = useTradingSymbols();
    const [symbol, setSymbol] = React.useState(DEFAULT_SYMBOL);
    const [tick_count, setTickCount] = React.useState(500);
    const [threshold, setThreshold] = React.useState(5);
    const [is_paused, setIsPaused] = React.useState(false);

    const analysis = useTickAnalysis({ symbol, tick_count, is_paused });
    const {
        digits,
        digit_stats,
        error,
        even_count,
        fall_count,
        highest_digit,
        is_loading,
        latest_digit,
        latest_price,
        lowest_digit,
        odd_count,
        parity_streak,
        direction_streak,
        pip_size,
        rise_count,
    } = analysis;

    const total_ticks = digits.length;
    const over_count = digits.filter(digit => digit > threshold).length;
    const under_count = digits.filter(digit => digit < threshold).length;
    const max_percentage = Math.max(...digit_stats.map(stat => stat.percentage), 1);
    const recent_digits = digits.slice(-24);
    const active_symbol = symbols.find(item => item.symbol === symbol);

    return (
        <div className='tp-page analysis-tool'>
            <PageHeader
                eyebrow={localize('Market research')}
                title={localize('Analysis Tool')}
                subtitle={localize(
                    'Live last-digit, parity and direction statistics for any Deriv market. Use it to size up a market before you build a bot or place a trade.'
                )}
                actions={
                    <>
                        <span className={classNames('tp-badge', is_paused ? 'tp-badge--warning' : 'tp-badge--success')}>
                            <span className='tp-badge__dot' />
                            {is_paused ? localize('Paused') : localize('Streaming')}
                        </span>
                        <button className='tp-button tp-button--secondary' onClick={() => setIsPaused(current => !current)}>
                            {is_paused ? (
                                <Localize i18n_default_text='Resume stream' />
                            ) : (
                                <Localize i18n_default_text='Pause stream' />
                            )}
                        </button>
                    </>
                }
            />

            {symbols_error && <div className='tp-notice tp-notice--danger'>{symbols_error}</div>}
            {error && <div className='tp-notice tp-notice--danger'>{error}</div>}

            <section className='tp-panel'>
                <div className='tp-grid'>
                    <TradingField label={localize('Market')} htmlFor='analysis-symbol'>
                        <SymbolSelect id='analysis-symbol' symbols={symbols} value={symbol} onChange={setSymbol} />
                    </TradingField>
                    <TradingField
                        label={localize('Ticks analysed')}
                        htmlFor='analysis-ticks'
                        hint={localize('Rolling window of the most recent ticks')}
                    >
                        <select
                            id='analysis-ticks'
                            className='tp-select'
                            value={tick_count}
                            onChange={event => setTickCount(Number(event.target.value))}
                        >
                            {TICK_WINDOWS.map(window => (
                                <option key={window} value={window}>
                                    {window}
                                </option>
                            ))}
                        </select>
                    </TradingField>
                    <TradingField
                        label={localize('Over / Under threshold')}
                        htmlFor='analysis-threshold'
                        hint={localize('Digits equal to the threshold count for neither side')}
                    >
                        <select
                            id='analysis-threshold'
                            className='tp-select'
                            value={threshold}
                            onChange={event => setThreshold(Number(event.target.value))}
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(digit => (
                                <option key={digit} value={digit}>
                                    {digit}
                                </option>
                            ))}
                        </select>
                    </TradingField>
                </div>
            </section>

            <section className='analysis-tool__tiles'>
                <div className='tp-stat'>
                    <span className='tp-stat__label'>{localize('Current spot')}</span>
                    <span className='tp-stat__value'>
                        {latest_price === null ? '—' : latest_price.toFixed(pip_size)}
                    </span>
                </div>
                <div className='analysis-tool__digit-tile'>
                    <span className='tp-stat__label'>{localize('Last digit')}</span>
                    <span
                        className={classNames('analysis-tool__digit-tile-value', {
                            'analysis-tool__digit-tile-value--even': latest_digit !== null && latest_digit % 2 === 0,
                            'analysis-tool__digit-tile-value--odd': latest_digit !== null && latest_digit % 2 !== 0,
                        })}
                    >
                        {latest_digit ?? '—'}
                    </span>
                </div>
                <div className='tp-stat'>
                    <span className='tp-stat__label'>{localize('Ticks in window')}</span>
                    <span className='tp-stat__value'>{total_ticks}</span>
                </div>
                <div className='tp-stat'>
                    <span className='tp-stat__label'>{localize('Most frequent digit')}</span>
                    <span className='tp-stat__value'>{highest_digit ?? '—'}</span>
                </div>
                <div className='tp-stat'>
                    <span className='tp-stat__label'>{localize('Least frequent digit')}</span>
                    <span className='tp-stat__value'>{lowest_digit ?? '—'}</span>
                </div>
                <div className='tp-stat'>
                    <span className='tp-stat__label'>{localize('Current streak')}</span>
                    <span className='tp-stat__value'>
                        {parity_streak.type
                            ? `${parity_streak.length}× ${localize(parity_streak.type === 'even' ? 'even' : 'odd')}`
                            : '—'}
                    </span>
                </div>
            </section>

            <section className='tp-panel'>
                <h2 className='tp-panel__title'>
                    <Localize i18n_default_text='Last digit distribution' />
                    <span className='tp-panel__hint'>
                        {active_symbol ? active_symbol.display_name : symbol} ·{' '}
                        <Localize i18n_default_text='{{count}} ticks' values={{ count: total_ticks }} />
                    </span>
                </h2>

                {is_loading && total_ticks === 0 ? (
                    <div className='analysis-tool__chart analysis-tool__chart--loading'>
                        {Array.from({ length: 10 }, (_, index) => (
                            <div key={index} className='tp-skeleton analysis-tool__chart-skeleton' />
                        ))}
                    </div>
                ) : (
                    <div className='analysis-tool__chart'>
                        {digit_stats.map(stat => {
                            const is_current = stat.digit === latest_digit;
                            const is_highest = stat.digit === highest_digit;
                            return (
                                <div key={stat.digit} className='analysis-tool__bar-column'>
                                    <span className='analysis-tool__bar-value'>{stat.percentage.toFixed(1)}%</span>
                                    <div className='analysis-tool__bar-track'>
                                        <div
                                            className={classNames('analysis-tool__bar', {
                                                'analysis-tool__bar--current': is_current,
                                                'analysis-tool__bar--highest': is_highest && !is_current,
                                            })}
                                            style={{ height: `${(stat.percentage / max_percentage) * 100}%` }}
                                        />
                                    </div>
                                    <span
                                        className={classNames('analysis-tool__bar-label', {
                                            'analysis-tool__bar-label--current': is_current,
                                        })}
                                    >
                                        {stat.digit}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className='tp-panel__hint'>
                    <Localize i18n_default_text='Bars show how often each last digit appeared in the window. The highlighted bar is the digit of the latest tick.' />
                </p>
            </section>

            <div className='analysis-tool__splits'>
                <section className='tp-panel'>
                    <SplitMeter
                        label={localize('Even / Odd')}
                        left={{ label: localize('Even'), value: even_count }}
                        right={{ label: localize('Odd'), value: odd_count }}
                    />
                </section>
                <section className='tp-panel'>
                    <SplitMeter
                        label={localize('Over {{threshold}} / Under {{threshold}}', { threshold })}
                        left={{ label: localize('Over'), value: over_count }}
                        right={{ label: localize('Under'), value: under_count }}
                    />
                </section>
                <section className='tp-panel'>
                    <SplitMeter
                        label={localize('Rise / Fall')}
                        left={{ label: localize('Rise'), value: rise_count }}
                        right={{ label: localize('Fall'), value: fall_count }}
                    />
                    <p className='tp-panel__hint'>
                        {direction_streak.type
                            ? localize('Current run: {{length}} consecutive {{type}}s', {
                                  length: direction_streak.length,
                                  type: localize(direction_streak.type),
                              })
                            : localize('Waiting for enough ticks to measure a run.')}
                    </p>
                </section>
            </div>

            <section className='tp-panel'>
                <h2 className='tp-panel__title'>
                    <Localize i18n_default_text='Latest digits' />
                </h2>
                {recent_digits.length === 0 ? (
                    <div className='tp-empty'>
                        <span className='tp-empty__title'>{localize('Waiting for ticks')}</span>
                        <span className='tp-empty__text'>
                            <Localize i18n_default_text='Digits appear here as soon as the market sends its next tick.' />
                        </span>
                    </div>
                ) : (
                    <ol className='analysis-tool__digits'>
                        {recent_digits.map((digit, index) => (
                            <li
                                key={`${index}-${digit}`}
                                className={classNames('analysis-tool__digit', {
                                    'analysis-tool__digit--even': digit % 2 === 0,
                                    'analysis-tool__digit--odd': digit % 2 !== 0,
                                    'analysis-tool__digit--last': index === recent_digits.length - 1,
                                })}
                            >
                                {digit}
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
};

export default AnalysisTool;
