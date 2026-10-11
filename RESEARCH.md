# Research findings

Research performed October 10, 2026, America/Los_Angeles. The site shows UTC calendar dates that may be October 11.

| Finding | Evidence |
|---|---|
| Current season is 1.5, Rage of the Frostborn | [Official Season 5 patch notes](https://lastepoch.com/1-5/patchnotes/) and live Last Epoch Tools header |
| Newest published hotfix found is 1.5.2.1, published October 9 | [Official hotfix post](https://forum.lastepoch.com/t/last-epoch-hotfix-1-5-2-1-notes/82034), [patch-note index](https://forum.lastepoch.com/c/patch-notes/39) |
| A local filter declares 1.5.2.2; don't downgrade its metadata | Direct inspection of game-exported XML. This is local serialization evidence, not a claim that official 1.5.2.2 release notes were found. |
| First matching rule in top-to-bottom priority determines display | [Official support](https://support.lastepoch.com/hc/en-us/articles/46361669143067-Loot-Filter), [official forum explanation](https://forum.lastepoch.com/t/how-to-create-a-loot-filter/27576) |
| Current rule limit is 200 | [Official 1.4 patch notes, Quality of Life → Loot Filters](https://forum.lastepoch.com/t/last-epoch-shattered-omens-patch-notes/80571/), confirmed live by Filter Rules (20/200). Support's 75-rule figure is stale. |
| Windows default location is LocalLow/Eleventh Hour Games/Last Epoch/Filters | [Official forum import instructions](https://forum.lastepoch.com/t/pastebin-loot-filter-help/44051), confirmed by four local XML files |
| Steam cloud may use another filter directory | The live Last Epoch Tools Export/Import dialogs document `steamapps/userdata/<id>/899770/ac/WinAppDataLocalLow/.../Filters`. Use the game's Open Filter Folder. |
| Modern input schema is 9; local game XML stores descending Order | Direct inspection: four local filters with 28, 8, 10 and 10 rules; three declare schema 9, one declares 0. Their Order fields descend from N−1 to 0. Live import confirmed ascending Order renders top-first. |
| Import From File creates a new private filter immediately | Separately authorized live import, persisted after navigation/reload. Private account URLs are excluded. |
| Firefox development add-ons can be loaded temporarily, lasting until restart | [Mozilla installation guide](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension), [Mozilla web-ext workflow](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_second_WebExtension) |

The merger does not hardcode affix/base IDs or enumerate condition schemas. It preserves XML trees, including newer condition fields and styling. Format preservation can be tested; semantic correctness for every possible game condition requires actual gameplay and valid source filters. Merging does not repair outdated affix IDs or incompatible old filter logic.

The latest official patch and a local lastModifiedInVersion tag are separate evidence. We keep the newer input tag and do not claim that changing metadata itself upgrades a filter.

Userscript storage and metadata follow [official Tampermonkey documentation](https://www.tampermonkey.net/documentation.php?locale=en). The bundle uses local GM_getValue/GM_setValue and GM_registerMenuCommand without remote dependencies.
