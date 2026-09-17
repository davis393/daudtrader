/**
 * Catalog of ready-made bots shown on the Trading Bots page.
 *
 * Every entry points at a Blockly strategy file in `src/xml`. To publish your own
 * bot, drop its `.xml` export in `src/xml/` and add an entry here — see
 * `src/pages/trading-bots/README.md` for the full walkthrough.
 */

export type TCatalogBot = {
    /** Stable id used for React keys and load tracking. */
    id: string;
    name: string;
    /** File name (without extension) inside `src/xml`. */
    xml_file: string;
    description: string;
    category: string;
    risk: 'low' | 'medium' | 'high';
    tags: string[];
};

export const BOT_CATEGORIES = ['All', 'Martingale', "D'Alembert", "Oscar's Grind", 'Sequence', 'Accumulators'];

export const BOT_CATALOG: TCatalogBot[] = [
    {
        id: 'martingale',
        name: 'Martingale',
        xml_file: 'martingale',
        description:
            'Doubles the stake after every loss so a single win recovers the run, then resets to the base stake.',
        category: 'Martingale',
        risk: 'high',
        tags: ['Rise/Fall', 'Recovery'],
    },
    {
        id: 'martingale-max-stake',
        name: 'Martingale with max stake',
        xml_file: 'martingale_max-stake',
        description:
            'The classic Martingale progression with a hard stake ceiling, so a losing streak stops compounding.',
        category: 'Martingale',
        risk: 'medium',
        tags: ['Rise/Fall', 'Recovery', 'Capped'],
    },
    {
        id: 'reverse-martingale',
        name: 'Reverse Martingale',
        xml_file: 'reverse_martingale',
        description: 'Increases the stake after each win to ride a streak, and drops back to base after a loss.',
        category: 'Martingale',
        risk: 'medium',
        tags: ['Rise/Fall', 'Streaks'],
    },
    {
        id: 'dalembert',
        name: "D'Alembert",
        xml_file: 'dalembert',
        description: 'Adds one unit to the stake after a loss and removes one after a win — a gentler recovery curve.',
        category: "D'Alembert",
        risk: 'medium',
        tags: ['Rise/Fall', 'Recovery'],
    },
    {
        id: 'dalembert-max-stake',
        name: "D'Alembert with max stake",
        xml_file: 'dalembert_max-stake',
        description: "D'Alembert unit stepping with an upper stake limit that caps the size of any recovery attempt.",
        category: "D'Alembert",
        risk: 'low',
        tags: ['Rise/Fall', 'Recovery', 'Capped'],
    },
    {
        id: 'reverse-dalembert',
        name: "Reverse D'Alembert",
        xml_file: 'reverse_dalembert',
        description: 'Steps the stake up after a win and down after a loss, compounding good runs one unit at a time.',
        category: "D'Alembert",
        risk: 'medium',
        tags: ['Rise/Fall', 'Streaks'],
    },
    {
        id: 'oscars-grind',
        name: "Oscar's Grind",
        xml_file: 'oscars_grind',
        description:
            'Grinds out one unit of profit per cycle: the stake only rises after a win and never overshoots the target.',
        category: "Oscar's Grind",
        risk: 'low',
        tags: ['Rise/Fall', 'Conservative'],
    },
    {
        id: 'oscars-grind-max-stake',
        name: "Oscar's Grind with max stake",
        xml_file: 'oscars_grind_max-stake',
        description: "Oscar's Grind with a stake ceiling, for accounts that need a strict per-trade exposure limit.",
        category: "Oscar's Grind",
        risk: 'low',
        tags: ['Rise/Fall', 'Conservative', 'Capped'],
    },
    {
        id: '1-3-2-6',
        name: '1-3-2-6',
        xml_file: '1_3_2_6',
        description:
            'A fixed four-step progression on consecutive wins (1, 3, 2, 6 units). Any loss restarts the sequence.',
        category: 'Sequence',
        risk: 'medium',
        tags: ['Rise/Fall', 'Fixed sequence'],
    },
    {
        id: 'accumulators-martingale',
        name: 'Accumulators Martingale',
        xml_file: 'accumulators_martingale',
        description: 'Runs Accumulators contracts and doubles the stake after a losing contract to recover it.',
        category: 'Accumulators',
        risk: 'high',
        tags: ['Accumulators', 'Recovery'],
    },
    {
        id: 'accumulators-martingale-stat-reset',
        name: 'Accumulators Martingale on stat reset',
        xml_file: 'accumulators_martingale_on_stat_reset',
        description:
            'Accumulators Martingale that only escalates when the growth statistics reset, keeping runs shorter.',
        category: 'Accumulators',
        risk: 'high',
        tags: ['Accumulators', 'Recovery', 'Stat reset'],
    },
    {
        id: 'accumulators-dalembert',
        name: "Accumulators D'Alembert",
        xml_file: 'accumulators_dalembert',
        description: "Accumulators contracts with D'Alembert unit stepping instead of doubling.",
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Recovery'],
    },
    {
        id: 'accumulators-dalembert-stat-reset',
        name: "Accumulators D'Alembert on stat reset",
        xml_file: 'accumulators_dalembert_on_stat_reset',
        description: "D'Alembert stepping on Accumulators, applied when the growth statistics reset.",
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Recovery', 'Stat reset'],
    },
    {
        id: 'accumulators-reverse-martingale',
        name: 'Accumulators Reverse Martingale',
        xml_file: 'accumulators_reverse_martingale',
        description: 'Scales the Accumulators stake up while contracts keep winning, resetting after a loss.',
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Streaks'],
    },
    {
        id: 'accumulators-reverse-martingale-stat-reset',
        name: 'Accumulators Reverse Martingale on stat reset',
        xml_file: 'accumulators_reverse_martingale_on_stat_reset',
        description: 'Reverse Martingale on Accumulators, re-evaluated each time the growth statistics reset.',
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Streaks', 'Stat reset'],
    },
    {
        id: 'accumulators-reverse-dalembert',
        name: "Accumulators Reverse D'Alembert",
        xml_file: 'accumulators_reverse_dalembert',
        description: "Reverse D'Alembert stepping on Accumulators contracts for gradual compounding.",
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Streaks'],
    },
    {
        id: 'accumulators-reverse-dalembert-stat-reset',
        name: "Accumulators Reverse D'Alembert on stat reset",
        xml_file: 'accumulators_reverse_dalembert_on_stat_reset',
        description: "Reverse D'Alembert on Accumulators, triggered from the growth statistics reset.",
        category: 'Accumulators',
        risk: 'medium',
        tags: ['Accumulators', 'Streaks', 'Stat reset'],
    },
];

/** Reads a catalog strategy from `src/xml` as an XML string. */
export const loadBotXml = async (xml_file: string): Promise<string> => {
    const strategy = await import(/* webpackChunkName: `[request]` */ `../../xml/${xml_file}.xml`);
    return strategy.default as string;
};
