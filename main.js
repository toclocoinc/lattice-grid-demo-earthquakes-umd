/**
 * The entry point: work out where the data should come from, fetch it, hand
 * it to the dashboard, and then keep it moving.
 *
 * Three ways to open the page:
 *
 *   (nothing)            live, reading the USGS feeds and polling every minute
 *   ?source=snapshot     the saved copy in `data/snapshot`, held still
 *   ?source=snapshot&replay=1
 *                        the saved copy, fed in over time so it moves offline
 *
 * When the live feeds cannot be reached the page opens the saved copy instead
 * and says so at the top, rather than showing an error.
 *
 * This is the script-tag edition. The grid and its modules arrived as classic
 * `<script src>` tags from jsDelivr, ahead of this file, and left globals
 * behind: `LatticeGrid` (the core, which the charts module extends),
 * `LatticeGridDataRouter`, `LatticeGridKPI` and `LatticeGridTabs`. This file
 * picks the factories off those globals and hands them to the dashboard, which
 * never touches a global itself.
 */
(function (root) {
  'use strict';

  const TITLE = 'Earthquakes around the world, as they are recorded';

  const host = document.querySelector('#app');
  const params = new URLSearchParams(location.search);
  const mode = params.get('source') === 'snapshot' ? 'snapshot' : 'live';
  const replayWanted = params.get('replay') === '1';

  /** Draw the waiting state, and return a function that updates its message. */
  function showProgress(first) {
    host.textContent = '';
    const panel = document.createElement('div');
    panel.className = 'loading';
    const title = document.createElement('h1');
    title.textContent = TITLE;
    const message = document.createElement('p');
    message.className = 'loading-message';
    message.textContent = first;
    const bar = document.createElement('div');
    bar.className = 'loading-bar';
    const fill = document.createElement('div');
    fill.className = 'loading-fill';
    bar.append(fill);
    panel.append(title, message, bar);
    host.append(panel);
    return (text, fraction) => {
      message.textContent = text;
      fill.style.width = `${Math.round((fraction || 0) * 100)}%`;
    };
  }

  /** Say what went wrong, in words a reader can act on. */
  function showError(error) {
    host.textContent = '';
    const panel = document.createElement('div');
    panel.className = 'loading';
    const title = document.createElement('h1');
    title.textContent = 'The earthquake data could not be loaded';
    const message = document.createElement('p');
    message.className = 'loading-message';
    message.textContent = String((error && error.message) || error);
    const hint = document.createElement('p');
    hint.className = 'loading-message';
    hint.textContent = 'You can open the same dashboard from the saved copy by adding ?source=snapshot to the address.';
    panel.append(title, message, hint);
    host.append(panel);
    console.error('[earthquake demo]', error);
  }

  /**
   * The grid's factories, read off the globals the script tags left behind.
   *
   * Checked by name rather than assumed, so a script tag that did not load,
   * or loaded in the wrong order, is reported as the sentence it is rather
   * than as "undefined is not a function" somewhere inside the dashboard.
   *
   * @returns {object} the five factories and `setLicence`
   */
  function libraryFromGlobals() {
    const missing = [];
    const need = (object, name, what) => {
      const value = object && object[name];
      if (typeof value !== 'function') missing.push(what);
      return value;
    };
    const createGrid = need(root.LatticeGrid, 'createGrid', 'lattice-grid.min.js (LatticeGrid.createGrid)');
    const setLicence = need(root.LatticeGrid, 'setLicence', 'lattice-grid.min.js (LatticeGrid.setLicence)');
    /* The charts module extends the core global rather than defining its own,
       so it has to be loaded after the core; this is where that shows. */
    const createChart = need(root.LatticeGrid, 'createChart', 'modules/charts.min.js (LatticeGrid.createChart)');
    const createDataRouter = need(root.LatticeGridDataRouter, 'createDataRouter', 'modules/data-router.min.js (LatticeGridDataRouter.createDataRouter)');
    const createKPI = need(root.LatticeGridKPI, 'createKPI', 'modules/kpi.min.js (LatticeGridKPI.createKPI)');
    const createTabs = need(root.LatticeGridTabs, 'createTabs', 'modules/tabs.min.js (LatticeGridTabs.createTabs)');
    if (missing.length) {
      throw new Error(
        `The grid did not load from the CDN. Missing: ${missing.join('; ')}. ` +
          'Check that the script tags in index.html are reachable and in order, with the core first.',
      );
    }
    return { createGrid, setLicence, createChart, createDataRouter, createKPI, createTabs };
  }

  /** Read the saved copy that ships with the demo. */
  async function loadSnapshot() {
    const [quakes, meta] = await Promise.all(
      ['quakes', 'meta'].map(async (name) => {
        const response = await fetch(`./data/snapshot/${name}.json`);
        if (!response.ok) throw new Error(`The saved copy is missing ${name}.json.`);
        return response.json();
      }),
    );
    return { rows: quakes, meta: { ...meta, live: false } };
  }

  async function start() {
    const started = performance.now();
    try {
      const { createGrid, setLicence, createChart, createDataRouter, createKPI, createTabs } = libraryFromGlobals();
      const { buildDashboard, createReplay, fetchInitial, POLL_MS, shiftToNow, startPolling } = root.QuakeDemo;

      /* Applied before anything is drawn, because a grid that already exists
         keeps whatever licence was in force when it was built. */
      setLicence(DEMO_LICENCE);

      let rows;
      let meta;
      let significantIds = new Set();

      if (mode === 'snapshot') {
        const update = showProgress('Reading the saved copy...');
        const saved = await loadSnapshot();
        meta = saved.meta;
        rows = saved.rows;
        update('Building the dashboard...', 1);
      } else {
        const update = showProgress('Reading the USGS earthquake feeds...');
        try {
          const initial = await fetchInitial({ onProgress: update });
          rows = initial.rows;
          significantIds = initial.significantIds;
          meta = {
            live: true,
            fetchedAt: Date.now(),
            feeds: initial.feeds.map((feed) => ({ name: feed.name, title: feed.title, generated: feed.generated, count: feed.count })),
          };
        } catch (liveError) {
          /* The feeds are out of our hands, so a bad day for them should not be
             a blank page here. The saved copy shows the same dashboard, and the
             masthead says plainly that is what you are looking at. */
          console.warn('[earthquake demo] the live fetch failed, falling back to the saved copy:', liveError);
          update('The USGS earthquake feeds could not be reached. Opening the saved copy...', 1);
          const saved = await loadSnapshot();
          rows = saved.rows;
          meta = { ...saved.meta, live: false, fellBack: true };
        }
      }

      const fetched = performance.now();

      /*
       * The saved copy is shifted forward so the newest saved event lands on
       * now, whether it was asked for by name or is standing in for feeds that
       * could not be reached. The window is always the last seven days, so
       * without the shift a copy saved a fortnight ago would open with an empty
       * table. The page says plainly that this is what it is doing.
       *
       * `?replay=1` goes further and releases the last stretch a batch at a
       * time, so the saved copy also moves.
       */
      let replay = null;
      let seedRows = rows;
      let shiftMs = 0;
      if (!meta.live) {
        const shifted = shiftToNow(rows);
        shiftMs = shifted.shiftMs;
        if (mode === 'snapshot' && replayWanted) {
          replay = { all: shifted.rows };
          seedRows = [];
        } else {
          seedRows = shifted.rows;
        }
        meta.shiftMs = shiftMs;
      }

      const built = buildDashboard({
        root: host,
        createGrid,
        createChart,
        createKPI,
        createTabs,
        createDataRouter,
        rows: seedRows,
        meta,
      });

      if (replay) {
        const handle = createReplay({
          rows: replay.all,
          onBatch: (batch) => built.ingest(batch),
        });
        built.ingest(handle.seed);
        built.setFreshness({ replaying: true });
        built.replay = handle;
      }

      /* Not started after a fallback: the saved rows have been shifted in time,
         and a poll that later got through would mix real timestamps in with
         them. The masthead says that reloading tries the feeds again. */
      let poller = null;
      if (mode === 'live' && meta.live) {
        poller = startPolling({
          significantIds,
          intervalMs: POLL_MS,
          onPoll: (result) => built.onPoll(result),
          onError: (error) => built.onPollError(error),
        });
        built.poller = poller;
      }

      const finished = performance.now();
      const timings = {
        mode: replay ? 'replay' : mode,
        fellBack: !!meta.fellBack,
        rows: built.allGrid ? built.allGrid.rows.count() : 0,
        loaded: rows.length,
        fetchMs: Math.round(fetched - started),
        buildMs: Math.round(finished - fetched),
        totalMs: Math.round(finished - started),
      };

      /* Kept by reference, not copied: the significant table is only created
         when its tab is first opened, and a copy taken now would never see it. */
      root.__quakeDemo = Object.assign(built, { meta, timings, ready: true });
      console.log('[earthquake demo] ready', timings);
    } catch (error) {
      root.__quakeDemo = { ready: false, error: String((error && error.message) || error) };
      showError(error);
    }
  }

  start();
})(window);
