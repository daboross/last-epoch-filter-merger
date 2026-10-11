# Last Epoch Filter Merger

Merge two Last Epoch loot filters using a **Tampermonkey userscript** on Last Epoch Tools or an **offline Node.js CLI**. Preserve rule colors, sounds, icons, beams, conditions, disabled state and duplicates.

**This repository was fully LLM-generated with GPT 6.1 Sol**, including implementation, tests and documentation. It was built from human requirements and checked with automated tests and a separately authorized website import. It is an unofficial community tool.

## Install with Tampermonkey

1. Install [Tampermonkey from Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
2. Click **[Install Last Epoch Filter Merger](https://raw.githubusercontent.com/daboross/last-epoch-filter-merger/main/last-epoch-filter-merger.user.js)** and choose Install in Tampermonkey.
3. Open or reload a [Last Epoch Tools loot filter](https://www.lastepochtools.com/loot-filters/). A **Merge filters** button appears at the bottom right.

On the first filter's view page, choose **Use current page as A**. Visit the second filter and choose **Use current page as B**. Source XML stays in Tampermonkey's local storage across navigation. You can instead load exported XML files or paste them.

Choose a name and press **Merge**. Inspect the count and report, then download XML or, while logged in, choose **Import as a new private filter**. The site normally creates the new private filter immediately; check the resulting page. If site controls change, use its normal Export → Save To File and Create Loot Filter → Import From File controls with the userscript's file inputs/download.

The script has no remote dependencies, external requests, clipboard-read permission or access to passwords. It runs only on `https://www.lastepochtools.com/loot-filters/*`. Sources stay locally stored; importing explicitly submits XML to Last Epoch Tools.

## Automatic rule ordering

Default: A's rules followed by B's rules, with this exception applied **independently to each source**:

If all visible rules precede all hide rules, detach that source's trailing hide block and append it after both source bodies. Deferred blocks remain in A-then-B order. Mixed sources stay intact. SHOW and RECOLOR are visible actions; disabled rules still count toward structure. An all-hide source contributes a whole trailing block; an all-show source contributes none.

Example: A = `SHOW, SHOW, HIDE`; B = `SHOW, HIDE, SHOW`. Output = `A SHOW, A SHOW, B SHOW, B HIDE, B SHOW, A HIDE`.

No rules are deduplicated, combined or recolored. Optional **concat** mode disables the exception. First matching rule wins, so an earlier unconditional hide in a mixed source can shadow later rules; the report calls this out. More than 200 rules is rejected without dropping anything.

## Local game files

Requires Node.js 18 or newer. Clone the repository and run:

```sh
npm ci
node cli.mjs list
node cli.mjs merge "A.xml" "B.xml" --name "My merged filter" --out merged.xml
```

Bare filenames resolve in the default Windows directory:

```text
%USERPROFILE%\AppData\LocalLow\Eleventh Hour Games\Last Epoch\Filters
```

Use the game's **Open Filter Folder** to confirm the active directory, especially for Steam cloud. Supply `--dir "PATH"` for another location. Add `--install` to create a new game file; existing files and sources are never overwritten. Each merge also writes an XML report JSON beside the output.

Modern `Order` fields determine priority regardless of XML element order. For old filters without `Order`, default `--legacy-order reverse` assumes bottom-to-top game serialization. Use `--legacy-order document` if an older exporter wrote top to bottom. Verify such filters' priority before use.

## Offline tests and development

```sh
npm ci
npm run build
npm test
npm run test:browser
```

**No repository test calls the live website.** Unit tests use synthetic XML, temporary files and jsdom fixtures. Browser tests use an isolated profile and deterministic HTML fixtures; HTTP(S) requests are blocked unless fulfilled in memory. No account is needed. The browser runner defaults to installed Windows Edge; set `MERGER_BROWSER` to a compatible Chromium executable elsewhere. Development extension loading is reported separately when unavailable.

`npm run test:local -- "PATH"` optionally checks every ordered pair of your local filters without changing them or using the network. `node scripts/check-roundtrip.mjs input.xml exported.xml` compares two existing local files. Private account XML, screenshots and URLs are excluded from version control.

The build regenerates committed `last-epoch-filter-merger.user.js` from `extension/core.js`, `extension/site-adapter.js` and `userscript/ui.js`. The extension workbench remains as development scaffolding; Tampermonkey is the supported distribution.

See [research](RESEARCH.md) and [validation](VALIDATION.md). The merger preserves newer fields rather than guessing affix IDs or schema migrations. It cannot repair obsolete source filters or guarantee gameplay intent.

MIT license.
