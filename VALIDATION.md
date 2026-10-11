# Validation

Validation performed October 10–11, 2026.

All repository tests are offline. No tests authenticate to, fetch from, or modify the production website. Fixtures use a production-shaped URL to exercise host-scoped code; HTML is supplied in memory and unmatched HTTP(S) requests are blocked.

- **40 automated tests:** priority/order, per-source trailing hide exception, mixed sources, disabled rules, duplicates, styling and conditions, namespace collisions, invalid XML/actions/orders, 200-rule boundary, CLI discovery/install/no-overwrite, mock export/import adapter, userscript capture/storage/download/import and metadata permissions.
- **Real browser:** workbench file selection, XML download, style/order checks, alternate mode, invalid inputs and stale result invalidation; packaged development extension and bundled userscript against deterministic fixtures.
- **Local compatibility:** all 16 ordered pairs of four existing game filters merged read-only; counts, conditions and style fields matched sources.

A separately authorized live acceptance check imported a 75-rule merger-generated file into Last Epoch Tools as a new private filter. A separate 20-rule import/export roundtrip preserved priority, styling and conditions. These observations are not automated repository tests. Account XML, screenshots and private URLs are excluded from version control.

Game execution was not tested. Website acceptance was the requested acceptance criterion. Firefox installation could not be automated because its native browser automation was blocked. Tampermonkey installation instructions are in the README.
