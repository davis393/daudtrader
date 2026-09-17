type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    TUTORIAL: 3,
    TRADING_BOTS: 4,
    BULK_TRADER: 5,
    ANALYSIS_TOOL: 6,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-tutorials',
    'id-trading-bots',
    'id-bulk-trader',
    'id-analysis-tool',
];

// Hash fragments are 1:1 with DBOT_TABS / TAB_IDS order and drive deep linking (e.g. `#analysis_tool`).
export const TAB_HASHES = [
    'dashboard',
    'bot_builder',
    'chart',
    'tutorial',
    'trading_bots',
    'bulk_trader',
    'analysis_tool',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
