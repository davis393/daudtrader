import React from 'react';
import { generateOAuthURL } from '@/components/shared';
import { Localize, localize } from '@deriv-com/translations';
import './trading.scss';

type TLoginGateProps = {
    title?: string;
    message: string;
};

/** Shown instead of a trading form when there is no authorised account. */
const LoginGate = ({ title, message }: TLoginGateProps) => {
    const [is_redirecting, setIsRedirecting] = React.useState(false);

    const handleLogin = async () => {
        setIsRedirecting(true);
        const oauth_url = await generateOAuthURL();
        if (oauth_url) {
            window.location.replace(oauth_url);
            return;
        }
        setIsRedirecting(false);
    };

    return (
        <div className='tp-login-gate tp-fade-in'>
            <span className='tp-login-gate__title'>{title ?? localize('Log in to start trading')}</span>
            <p className='tp-login-gate__text'>{message}</p>
            <button className='tp-button tp-button--primary' onClick={handleLogin} disabled={is_redirecting}>
                {is_redirecting ? <Localize i18n_default_text='Redirecting…' /> : <Localize i18n_default_text='Log in' />}
            </button>
        </div>
    );
};

export default LoginGate;
