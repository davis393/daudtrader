import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { botNotification } from '@/components/bot-notification/bot-notification';
import { PageHeader } from '@/components/trading';
import { DBOT_TABS } from '@/constants/bot-contents';
import { load, save_types } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import { BOT_CATALOG, BOT_CATEGORIES, loadBotXml, TCatalogBot } from './bot-catalog';
import './trading-bots.scss';

const RISK_LABELS: Record<TCatalogBot['risk'], string> = {
    low: 'Low risk',
    medium: 'Medium risk',
    high: 'High risk',
};

const RISK_BADGES: Record<TCatalogBot['risk'], string> = {
    low: 'tp-badge--success',
    medium: 'tp-badge--warning',
    high: 'tp-badge--danger',
};

const TradingBots = observer(() => {
    const { dashboard } = useStore();
    const { setActiveTab } = dashboard;

    const [search, setSearch] = React.useState('');
    const [category, setCategory] = React.useState('All');
    const [loading_bot_id, setLoadingBotId] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const file_input_ref = React.useRef<HTMLInputElement>(null);

    const visible_bots = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        return BOT_CATALOG.filter(bot => {
            const in_category = category === 'All' || bot.category === category;
            if (!in_category) return false;
            if (!query) return true;
            return [bot.name, bot.description, bot.category, ...bot.tags]
                .join(' ')
                .toLowerCase()
                .includes(query);
        });
    }, [category, search]);

    /** Pushes an XML strategy into the Blockly workspace and opens Bot Builder. */
    const loadIntoBuilder = async (xml: string, file_name: string) => {
        const workspace = window.Blockly?.derivWorkspace;
        if (!workspace) {
            throw new Error(localize('Bot Builder is still starting up. Please try again in a moment.'));
        }
        await load({
            block_string: xml,
            file_name,
            workspace,
            from: save_types.UNSAVED,
            drop_event: null,
            strategy_id: null,
            showIncompatibleStrategyDialog: null,
        });
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const handleLoadBot = async (bot: TCatalogBot) => {
        setError(null);
        setLoadingBotId(bot.id);
        try {
            const xml = await loadBotXml(bot.xml_file);
            await loadIntoBuilder(xml, bot.name);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : localize('Could not load this bot. Please try again or pick another one.')
            );
        } finally {
            setLoadingBotId(null);
        }
    };

    const handleDownloadBot = async (bot: TCatalogBot) => {
        setError(null);
        try {
            const xml = await loadBotXml(bot.xml_file);
            const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${bot.xml_file}.xml`;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch {
            setError(localize('Could not prepare the download for this bot.'));
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setError(null);
        setLoadingBotId('upload');
        try {
            const xml = await file.text();
            if (!xml.includes('<xml')) {
                throw new Error(localize('That file is not a Deriv Bot strategy. Expected an .xml strategy export.'));
            }
            await loadIntoBuilder(xml, file.name.replace(/\.xml$/i, ''));
            botNotification(localize('Bot loaded into Bot Builder.'));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : localize('Could not read that file.'));
        } finally {
            setLoadingBotId(null);
        }
    };

    return (
        <div className='tp-page trading-bots'>
            <PageHeader
                eyebrow={localize('Strategy library')}
                title={localize('Trading Bots')}
                subtitle={localize(
                    'Ready-made strategies you can load straight into Bot Builder, tweak, and run. Bring your own bot by importing its XML export.'
                )}
                actions={
                    <>
                        <span className='tp-badge tp-badge--info'>
                            <Localize
                                i18n_default_text='{{count}} bots available'
                                values={{ count: BOT_CATALOG.length }}
                            />
                        </span>
                        <button
                            className='tp-button tp-button--primary'
                            onClick={() => file_input_ref.current?.click()}
                            disabled={loading_bot_id === 'upload'}
                        >
                            {loading_bot_id === 'upload' ? (
                                <Localize i18n_default_text='Importing…' />
                            ) : (
                                <Localize i18n_default_text='Import your bot (.xml)' />
                            )}
                        </button>
                    </>
                }
            />

            <input
                ref={file_input_ref}
                className='trading-bots__file-input'
                type='file'
                accept='.xml,application/xml,text/xml'
                onChange={handleFileUpload}
            />

            {error && <div className='tp-notice tp-notice--danger'>{error}</div>}

            <div className='trading-bots__filters'>
                <input
                    className='tp-input trading-bots__search'
                    type='search'
                    value={search}
                    placeholder={localize('Search by name, market or tag')}
                    onChange={event => setSearch(event.target.value)}
                    aria-label={localize('Search bots')}
                />
                <div className='trading-bots__categories'>
                    {BOT_CATEGORIES.map(item => (
                        <button
                            key={item}
                            className={classNames('tp-chip', { 'tp-chip--active': item === category })}
                            onClick={() => setCategory(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            {visible_bots.length === 0 ? (
                <div className='tp-empty'>
                    <span className='tp-empty__title'>{localize('No bots match that search')}</span>
                    <span className='tp-empty__text'>
                        <Localize i18n_default_text='Clear the search or choose a different category to see the full library again.' />
                    </span>
                    <button
                        className='tp-button tp-button--secondary'
                        onClick={() => {
                            setSearch('');
                            setCategory('All');
                        }}
                    >
                        <Localize i18n_default_text='Reset filters' />
                    </button>
                </div>
            ) : (
                <div className='trading-bots__grid'>
                    {visible_bots.map(bot => (
                        <article key={bot.id} className='trading-bots__card tp-fade-in'>
                            <div className='trading-bots__card-head'>
                                <h2 className='trading-bots__card-title'>{bot.name}</h2>
                                <span className={classNames('tp-badge', RISK_BADGES[bot.risk])}>
                                    {localize(RISK_LABELS[bot.risk])}
                                </span>
                            </div>
                            <p className='trading-bots__card-text'>{bot.description}</p>
                            <ul className='trading-bots__tags'>
                                {[bot.category, ...bot.tags].map(tag => (
                                    <li key={tag} className='trading-bots__tag'>
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                            <div className='trading-bots__card-actions'>
                                <button
                                    className='tp-button tp-button--primary'
                                    onClick={() => handleLoadBot(bot)}
                                    disabled={loading_bot_id !== null}
                                >
                                    {loading_bot_id === bot.id ? (
                                        <Localize i18n_default_text='Loading…' />
                                    ) : (
                                        <Localize i18n_default_text='Load in Bot Builder' />
                                    )}
                                </button>
                                <button className='tp-button tp-button--secondary' onClick={() => handleDownloadBot(bot)}>
                                    <Localize i18n_default_text='Download XML' />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <section className='tp-panel tp-panel--accent trading-bots__byob'>
                <h2 className='tp-panel__title'>
                    <Localize i18n_default_text='Adding your own bots' />
                </h2>
                <p className='tp-panel__hint'>
                    <Localize i18n_default_text='Use “Import your bot” above for a one-off run — nothing is uploaded, the strategy is read in the browser and opened in Bot Builder. To publish a bot permanently in this library, drop its .xml export into src/xml/ and add an entry to src/pages/trading-bots/bot-catalog.ts.' />
                </p>
            </section>
        </div>
    );
});

export default TradingBots;
