# Trading Bots page

The **Trading Bots** tab is a library of ready-made Blockly strategies that can be
loaded into Bot Builder in one click.

## Adding your own bot permanently

1. Export the strategy from Bot Builder (**Save** → *Local*) to get an `.xml` file.
2. Copy that file into `src/xml/` (for example `src/xml/my_bot.xml`).
3. Add an entry to `BOT_CATALOG` in `bot-catalog.ts`:

```ts
{
    id: 'my-bot',
    name: 'My bot',
    xml_file: 'my_bot',           // file name in src/xml, without the extension
    description: 'What the bot does and when to use it.',
    category: 'Sequence',         // must be one of BOT_CATEGORIES
    risk: 'medium',               // 'low' | 'medium' | 'high'
    tags: ['Rise/Fall', 'Recovery'],
}
```

4. If the bot needs a new grouping, add the label to `BOT_CATEGORIES` as well.

Strategy XML is bundled at build time via `raw-loader`, so no server or database is
involved — the file ships with the app.

## One-off imports

Users can also press **Import your bot (.xml)** on the page. The file is read in the
browser and loaded straight into Bot Builder; nothing is uploaded anywhere.
