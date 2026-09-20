# Earthquakes around the world, as they are recorded

A live dashboard of every earthquake the United States Geological Survey has
recorded in the last seven days, built on Lattice Grid loaded by `<script>`
tag: no npm install, no bundler, no build step, no `type="module"`.

**[See it running](https://toclocoinc.github.io/lattice-grid-demo-earthquakes-umd/)**

| | |
| --- | --- |
| Grid on npm | [@toclocoinc/lattice-grid](https://www.npmjs.com/package/@toclocoinc/lattice-grid) |
| Grid repository | [toclocoinc/latticegrid](https://github.com/toclocoinc/latticegrid) |
| Product site | [latticegrid.dev](https://www.latticegrid.dev) |
| The same demo as an ESM package | [lattice-grid-demo-earthquakes](https://github.com/toclocoinc/lattice-grid-demo-earthquakes) |

It is one arriving stream of data with several views on it: a table, a second
table of the significant events, a strip of headline figures and four charts.
They all read the same stream, so narrowing the table moves everything else
with it.

The point of the demo is what happens after the first load. USGS publishes an
automatic reading within a minute or two of an earthquake, then a seismologist
reviews it, and the magnitude and the place are corrected for hours
afterwards. The page polls for those corrections every minute and lands each
one on the row it belongs to, rather than adding a second row for the same
earthquake. When a magnitude changes, the cell lights up.

## How the grid gets onto the page

Six tags in `index.html`, and that is the whole of the library setup:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/lattice-grid.min.css">

<script src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/lattice-grid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/modules/charts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/modules/data-router.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/modules/kpi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@toclocoinc/lattice-grid@1.63.0/modules/tabs.min.js"></script>
```

Each file is the package's UMD build (`*.min.js`, beside the `*.esm.min.js`
the ESM edition imports) and leaves a global behind:

| File | Global | Used here for |
| --- | --- | --- |
| `lattice-grid.min.js` | `LatticeGrid` | `createGrid`, `setLicence` |
| `modules/charts.min.js` | extends `LatticeGrid` | `LatticeGrid.createChart` |
| `modules/data-router.min.js` | `LatticeGridDataRouter` | `createDataRouter` |
| `modules/kpi.min.js` | `LatticeGridKPI` | `createKPI` |
| `modules/tabs.min.js` | `LatticeGridTabs` | `createTabs` |

The charts module folds its exports into the core global rather than defining
one of its own, so its tag must come after the core's. The other three are
self-contained and can go in any order. `main.js` checks that every factory it
needs is actually there before it draws anything, so a tag that did not load
is reported as a sentence rather than as an error from inside the grid.

Every address names the exact release, `1.63.0`, and every tag carries the
`integrity` hash of the file it expects. The page cannot quietly pick up a
different build than the one it was checked against, and the browser refuses
a file that does not match. The hashes are the SHA-384 of the published files.

The demo's own code is four classic scripts, loaded in order after the
library: `src/licence.js`, `src/usgs-feed.js`, `src/dashboard.js`, `main.js`.
Each file wraps itself in a function and puts what it offers on one plain
object, `QuakeDemo`, for the next file to read. `src/dashboard.js` is handed
the grid's factories as arguments and never touches a global itself, which is
why it is the same file as in the ESM edition apart from the wrapper.

## When to choose script tags over the ESM package

Both editions of this demo show the same dashboard with the same behaviour.
The choice is about how the grid reaches the page, and the script-tag route is
the right one when:

- **There is no build.** A page served straight from disk, a CMS template, a
  static site, an internal tool someone maintains by editing one HTML file. A
  `<script src>` is a line of HTML; an `import` needs either a bundler or a
  server that serves the package files and a browser path to them.
- **The host page is not yours.** A widget dropped into a portal, an intranet
  page, a page built by a different team's stack. Script tags coexist with
  whatever else the page loads and ask nothing of its toolchain.
- **The stack has no module pipeline.** Older server-rendered applications,
  jQuery-era front ends, pages built by a back-end framework that emits HTML.
  The UMD build defines a global and gets out of the way, which is what those
  pages already expect of a library.
- **You want the CDN to do the hosting.** Nothing to install, nothing to copy
  into a `vendor` folder, and a pinned version plus an integrity hash gives
  you the same reproducibility a lockfile does.
- **You are evaluating.** Copy `index.html`, open it, and the grid is running.
  There is no quicker way to see whether it does what you need.

Choose the ESM package instead when:

- **You already have a bundler.** Then the ESM build is the natural fit: it
  tree-shakes, the four modules that extend the core share the one copy the
  page already imported, and you get TypeScript declarations wired through
  `package.json` with no configuration.
- **You want everything offline, including the library.** The ESM edition of
  this demo installs the grid into `node_modules` and serves it from there,
  so it runs with no network at all. This edition needs to reach jsDelivr for
  the library even when it reads the saved copy of the data.
- **You would rather not trust a third-party CDN in production.** A pinned
  version with an integrity hash is safe against a changed file, but not
  against the CDN being down. The ESM package can be served from your own
  origin.

What does not change between the two: the grid's API, the modules, the
licence, the behaviour, the figures. Both editions are verified against the
same saved data and produce the same row counts, tiles and chart marks.

## Running it

You need nothing but a browser and a way to serve the folder, because the
page fetches its data with `fetch()` and browsers will not do that from
`file://`. Any static server will do; one is included:

```
node tools/serve.mjs
```

That prints an address. Open it.

| Address | What you get |
| --- | --- |
| `/` | live, reading the USGS feeds and polling every minute |
| `/?source=snapshot` | the saved copy in `data/snapshot`, no feed needed |
| `/?source=snapshot&replay=1` | the saved copy fed in over time, so it moves offline |

Running a copy on your own machine needs no licence key. Publishing it on a
web address does.

## What it shows

**A rolling window.** The table keeps the last seven days and no more. The
window is measured against each earthquake's own timestamp rather than against
the moment its row arrived, and it rolls forward on a timer, so an event ages
out of the table whether or not anything new has come in.

**Corrections in place.** Each poll is a set of upserts keyed on the USGS
event id. A revised magnitude replaces the one on the row. The feed stamps
every revision with the moment it was made, and the page uses that stamp as
its ordering clock, so an older copy of a row arriving late cannot undo a
correction that has already landed.

**Two datasets, not one filtered twice.** The significant tab reads a
different feed, which reaches back a month. It holds earthquakes the seven day
window has already dropped, so narrowing the first table could never produce
it.

**Figures that follow the table.** The strip of tiles across the top is a KPI
panel bound to the table (`createKPI(host, { grid })`), so it reads whatever
the table currently matches and follows it on its own: turn on "Only M4.5 and
above" and the counts, the charts and the tiles all move together, and the
rows under a collapsed group still count. The one figure that is not a tile
is the named largest earthquake, which is a phrase rather than a number; it
is drawn by hand from the bound panel's own rows each time the panel re-reads
the table. A bound panel hands a tile the grid's value for each column, and
for a datetime column that is the grid's wall-clock text rather than the
feed's number, so the two elapsed-time tiles read it back into an instant
before doing arithmetic on it.

**A feed that can fail.** If a poll cannot reach USGS the page says so and
keeps showing what it already had, rather than emptying itself. If the feeds
cannot be reached when the page first opens, it shows the saved copy instead
and says so under the title.

## The data

Everything comes from the USGS earthquake feeds:

- <https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php>

The page reads the past week summary and the past month of significant
earthquakes when it opens, then polls the past day summary each minute:

- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson`
- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson`
- `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`

USGS regenerates each of those files every minute and serves them with open
cross-origin headers, so the browser reads them directly and there is no
server in the middle.

USGS data are in the public domain and free to use.

A few things worth knowing about the data:

- Times in the feed are UTC. The table shows your local time and the UTC time
  side by side, because every figure USGS publishes is UTC.
- Depth is in kilometres and comes from the third GeoJSON coordinate. The
  first two are longitude then latitude, in that order.
- `alert` is the PAGER level and is only present once an event has been
  assessed, which is a small minority of them. Unassessed events are shown as
  "Not assessed" rather than being hidden.
- `felt`, `cdi` and `mmi` come from public reports and are absent until
  somebody files one.
- A magnitude is `null` on a handful of records, so nothing assumes it is a
  number.

## Files

```
index.html                page shell, and the six library tags
main.js                   works out where the data comes from, then starts
src/licence.js            the key for this demo's own published address
src/usgs-feed.js          the feeds: fetching, parsing, polling, replay
src/dashboard.js          the views: router, tables, tiles, charts, tabs
styles.css                the page around the grid
tools/serve.mjs           a small static file server
tools/build-snapshot.mjs  save a real run into data/snapshot
tools/verify.mjs          open it in a real browser and check it
data/snapshot/            a saved run, so the demo works without the feeds
```

There is no `package.json` and no `node_modules`. The tools need Node 22 or
newer and nothing else.

The saved copy is shown as though its newest event had just arrived, so the
seven day window is never empty however long ago the file was built. The page
says so under the title.

## Checking it

```
node tools/build-snapshot.mjs   # save a fresh run from the live feeds
node tools/verify.mjs           # open the page in a real browser and assert
node tools/verify.mjs --all     # also open the live feeds
```

`tools/verify.mjs` is not a smoke test. It first insists on how the library
arrived: no `type="module"` script anywhere on the page, five script tags
pointing at the pinned release on the CDN, each with an integrity hash, and
each leaving the global it documents. It then recomputes the headline figures
from the saved feed data and compares them with what the page is showing,
narrows the table and insists the tiles and charts moved with it, pushes a
revised magnitude through and insists the row count did not change, pushes
two rows of different ages and insists the window kept one and dropped the
other, and finally blocks the USGS feeds in the browser and insists the saved
copy appears with a notice saying why. The GitHub Pages workflow runs it
before every publish.

## Licence

The demo code is MIT. See `LICENSE`.

The earthquake data is from the United States Geological Survey and is in the
public domain.

Lattice Grid itself is a separate commercial product with its own terms. It is
free to use on localhost, with no key and no watermark, so a copy of this
repository runs unrestricted on your own machine. This demo carries a key for
its own published address only, which is why you will find one in the source.
Keys for your own sites come from [latticegrid.dev](https://www.latticegrid.dev).

---
Built with [Lattice Grid](https://www.latticegrid.dev), a JavaScript data grid with a Data Router: one live feed keeps grids, charts, boards, Gantt and KPI tiles in step. [Documentation](https://www.latticegrid.dev/docs/) · [Demos](https://www.latticegrid.dev/demos/) · [Licence](https://www.latticegrid.dev/licence/)
