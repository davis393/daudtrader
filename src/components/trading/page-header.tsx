import React from 'react';
import './trading.scss';

type TPageHeaderProps = {
    eyebrow: string;
    title: string;
    subtitle: string;
    actions?: React.ReactNode;
};

/** Shared page title block for the trading pages. */
const PageHeader = ({ eyebrow, title, subtitle, actions }: TPageHeaderProps) => (
    <header className='tp-header'>
        <div className='tp-header__titles'>
            <span className='tp-header__eyebrow'>{eyebrow}</span>
            <h1 className='tp-header__title'>{title}</h1>
            <p className='tp-header__subtitle'>{subtitle}</p>
        </div>
        {actions && <div className='tp-header__actions'>{actions}</div>}
    </header>
);

export default PageHeader;
