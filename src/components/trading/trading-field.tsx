import React from 'react';
import './trading.scss';

type TTradingFieldProps = {
    label: string;
    hint?: string;
    htmlFor?: string;
    children: React.ReactNode;
};

/** Label + control wrapper used by every form on the trading pages. */
const TradingField = ({ label, hint, htmlFor, children }: TTradingFieldProps) => (
    <label className='tp-field' htmlFor={htmlFor}>
        <span className='tp-field__label'>{label}</span>
        {children}
        {hint && <span className='tp-field__hint'>{hint}</span>}
    </label>
);

export default TradingField;
