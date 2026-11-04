import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { createStaticServer } from './lib/staticServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const THRESHOLDS = {
    desktopMaxPaintMs: 35,
    mobileMaxPaintMs: 100,
    desktopMaxSyncMs: 20,
    mobileMaxSyncMs: 50
};

function generateEvents(count) {
    const types = [
        { event: 'Goal', lead: 15, lag: 5 },
        { event: 'FIRE BS2', lead: 10, lag: 10, team: 'FIRE', eventCode: 'BS' },
        { event: 'FIRE A25E2', lead: 5, lag: 10, team: 'FIRE', eventCode: 'A25E', labels: [{ group: 'Entry Channel', text: 'Right' }] },
        { event: 'FIRE CE2', lead: 10, lag: 10, team: 'FIRE', eventCode: 'CE', labels: [{ group: 'Flank', text: 'Center' }] },
        { event: 'FIRE SHOT', lead: 15, lag: 5, team: 'FIRE', eventCode: 'SHOT', labels: [{ group: 'Outcome', text: 'Saved' }] },
        { event: 'TIGERS BW3', lead: 5, lag: 5, team: 'TIGERS', eventCode: 'BW' },
        { event: 'TIGERS PC', lead: 2, lag: 10, team: 'TIGERS', eventCode: 'PC' }
    ];
    return Array.from({ length: count }, (_, i) => {
        const template = types[i % types.length];
        return {
            id: `evt-perf-${i}`,
            ...template,
            timeMs: (i + 1) * 4500,
            labels: template.labels ? [...template.labels] : []
        };
    });
}

function extractEventList(parsed) {
    if (Array.isArray(parsed)) {
        const perfGame = parsed.find(g => g.id === 'perf-game');
        return perfGame ? perfGame.events : null;
    }
    return parsed ? parsed.events : null;
}

function readStoredEventCount(rawStorage) {
    if (!rawStorage) return 0;
    const events = extractEventList(JSON.parse(rawStorage));
    return Array.isArray(events) ? events.length : 0;
}

async function launchBrowser() {
    try {
        return await chromium.launch({ headless: true });
    } catch (_) {
        return await chromium.launch({ channel: 'chrome', headless: true });
    }
}

async function executeBrowserTaps(page, config) {
    return page.evaluate(async (cfg) => {
        const btn = document.querySelector(cfg.buttonSelector);
        const video = document.getElementById('video-player');
        const firstCardBefore = document.querySelector('#timeline-events .timeline-event');
        const beforeDetailNodes = document.querySelectorAll(cfg.detailSelector).length;
        const samples = [];
        for (let i = 0; i < 5; i++) {
            if (video) video.currentTime = (cfg.count + i + 1) * 4.5;
            const t0 = performance.now();
            btn.click();
            const tSync = performance.now() - t0;
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
            samples.push({ syncMs: tSync, paintMs: performance.now() - t0 });
        }
        return {
            samples,
            totalDomNodes: document.querySelectorAll('*').length,
            beforeDetailNodes,
            detailNodes: document.querySelectorAll(cfg.detailSelector).length,
            preservedCard: firstCardBefore === document.querySelector('#timeline-events .timeline-event'),
            rawStorage: localStorage.getItem(cfg.storageKey) || ''
        };
    }, config);
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function formatMeasurementRow(stats, config) {
    const medSync = median(stats.samples.map(s => s.syncMs));
    const medPaint = median(stats.samples.map(s => s.paintMs));
    const postEventCount = readStoredEventCount(stats.rawStorage);
    const detailValue = config.measureDelta ? stats.detailNodes - stats.beforeDetailNodes : stats.detailNodes;
    return {
        events: config.count,
        cpu: config.throttleRate === 1 ? '1x (Desktop)' : `${config.throttleRate}x (Mobile)`,
        syncTapMs: Number(medSync.toFixed(1)),
        tapToPaintMs: Number(medPaint.toFixed(1)),
        eventsAdded: postEventCount - config.count,
        totalDomNodes: stats.totalDomNodes,
        [config.detailField]: detailValue,
        ...(config.measureDelta && { preservedCard: stats.preservedCard }),
        [config.sizeField]: Number((stats.rawStorage.length / 1024).toFixed(1))
    };
}

async function runTapMeasurement(browser, config) {
    const context = await browser.newContext({ viewport: config.viewport });
    const page = await context.newPage();
    await page.route('https://**', route => route.abort());

    const client = await context.newCDPSession(page);
    await page.addInitScript(({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
    }, { key: config.storageKey, value: config.storageValue });

    await page.goto(config.url, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: '.hidden { display: none !important; }' });
    await page.waitForSelector(config.waitSelector, { state: 'attached', timeout: 10000 });
    if (config.expandSelector) await page.click(config.expandSelector);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
    if (config.throttleRate > 1) {
        await client.send('Emulation.setCPUThrottlingRate', { rate: config.throttleRate });
    }

    const stats = await executeBrowserTaps(page, config);
    await context.close();
    return formatMeasurementRow(stats, config);
}

function buildLiveCaptureConfig(baseUrl, count, throttleRate) {
    return {
        count,
        throttleRate,
        viewport: { width: 390, height: 844 },
        url: `${baseUrl}/#event-capture`,
        waitSelector: '#coding-buttons-container button',
        buttonSelector: '#coding-buttons-container .event-button[data-event]',
        detailSelector: '#xmlView span',
        detailField: 'hiddenXmlSpans',
        sizeField: 'draftKB',
        storageKey: 'fieldHockeyCaptureDraft_v1',
        storageValue: {
            events: generateEvents(count),
            elapsedTime: count * 4500,
            runningSince: Date.now() - 1000,
            teams: [
                { code: 'FIRE', color: 'red' },
                { code: 'TIGERS', color: 'blue' }
            ],
            activeZone: '2',
            selectedTeam: 1,
            updatedAt: Date.now()
        }
    };
}

function buildVideoCodingConfig(baseUrl, count, throttleRate, splitMode = false) {
    const historicalGames = Array.from({ length: 10 }, (_, idx) => ({
        id: `hist-game-${idx}`,
        teams: `Team A${idx} vs Team B${idx}`,
        timestamp: new Date().toISOString(),
        elapsedTime: 3600000,
        events: generateEvents(300)
    }));
    const targetGame = {
        id: 'perf-game',
        teams: 'FIRE vs TIGERS',
        timestamp: new Date().toISOString(),
        elapsedTime: count * 4500,
        events: generateEvents(count)
    };
    return {
        count,
        throttleRate,
        viewport: { width: 1280, height: 800 },
        url: `${baseUrl}/timeline-video.html?game=perf-game&mode=tag`,
        waitSelector: '#quick-tags-container button',
        expandSelector: splitMode ? '#quick-tag-review-btn' : null,
        buttonSelector: '#quick-tags-container button',
        detailSelector: splitMode ? '#timeline-events .timeline-event' : '#timeline-events *',
        detailField: splitMode ? 'cardsAdded' : 'timelineDomNodes',
        measureDelta: splitMode,
        sizeField: 'storageKB',
        storageKey: 'fieldHockeyGames_v1',
        storageValue: [targetGame, ...historicalGames]
    };
}

function checkMetricThreshold(actual, limit, label, metricName) {
    return actual >= limit ? [`${label} ${metricName}=${actual}ms >= ${limit}ms`] : [];
}

function checkRowLatency(row, maxSyncMs, maxPaintMs, label, checkPaint = true) {
    if (!row) return [`${label} missing benchmark row`];
    const syncErrs = checkMetricThreshold(row.syncTapMs, maxSyncMs, label, 'syncTapMs');
    const paintErrs = checkPaint ? checkMetricThreshold(row.tapToPaintMs, maxPaintMs, label, 'tapToPaintMs') : [];
    return [...syncErrs, ...paintErrs];
}

function checkExactValue(actual, expected, scope, name) {
    return actual !== expected ? [`${scope} ${name}=${actual} !== ${expected}`] : [];
}

function checkSingleRowInvariants(row, label, detailKey, expectedDetailValue) {
    const scope = `${label} (${row.events} events, ${row.cpu})`;
    const preservedErrs = 'preservedCard' in row
        ? checkExactValue(row.preservedCard, true, scope, 'preservedCard')
        : [];
    return [
        ...checkExactValue(row.eventsAdded, 5, scope, 'eventsAdded'),
        ...checkExactValue(row[detailKey], expectedDetailValue, scope, detailKey),
        ...preservedErrs
    ];
}

function checkRowInvariants(results, label, detailKey, expectedDetailValue) {
    return results.flatMap(row => checkSingleRowInvariants(row, label, detailKey, expectedDetailValue));
}

function collectThresholdFailures(results, label, detailKey, expectedDetailValue, checkDesktopPaint = true) {
    const failures = checkRowInvariants(results, label, detailKey, expectedDetailValue);
    for (const targetCount of [500, 1000]) {
        const desktop = results.find(r => r.events === targetCount && r.cpu.startsWith('1x'));
        const mobile = results.find(r => r.events === targetCount && r.cpu.startsWith('4x'));
        failures.push(
            ...checkRowLatency(desktop, THRESHOLDS.desktopMaxSyncMs, THRESHOLDS.desktopMaxPaintMs, `${label} ${targetCount} events (1x Desktop)`, checkDesktopPaint),
            ...checkRowLatency(mobile, THRESHOLDS.mobileMaxSyncMs, THRESHOLDS.mobileMaxPaintMs, `${label} ${targetCount} events (4x Mobile)`, false)
        );
    }
    return failures;
}

async function runSuite(browser, baseUrl, counts, builder) {
    const results = [];
    for (const c of counts) {
        results.push(await runTapMeasurement(browser, builder(baseUrl, c, 1)));
        results.push(await runTapMeasurement(browser, builder(baseUrl, c, 4)));
    }
    return results;
}

async function runBenchmarks() {
    const server = createStaticServer(SRC_DIR);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const browser = await launchBrowser();

    try {
        const fullCounts = [10, 100, 250, 500, 1000];
        const liveResults = await runSuite(browser, baseUrl, fullCounts, buildLiveCaptureConfig);
        const videoFocusResults = await runSuite(browser, baseUrl, fullCounts, (u, c, r) => buildVideoCodingConfig(u, c, r, false));
        const videoSplitResults = await runSuite(browser, baseUrl, [500, 1000], (u, c, r) => buildVideoCodingConfig(u, c, r, true));

        console.log('\n=== LIVE EVENT CAPTURE (index.html#event-capture) ===');
        console.table(liveResults);

        console.log('\n=== VIDEO CODING FOCUS MODE (timeline-video.html?mode=tag + 10 saved games) ===');
        console.table(videoFocusResults);

        console.log('\n=== VIDEO CODING SPLIT MODE / EXPANDED PANEL (500 & 1000 events) ===');
        console.table(videoSplitResults);

        const failures = [
            ...collectThresholdFailures(liveResults, 'Live Capture', 'hiddenXmlSpans', 0, true),
            ...collectThresholdFailures(videoFocusResults, 'Video Focus Mode', 'timelineDomNodes', 0, true),
            ...collectThresholdFailures(videoSplitResults, 'Video Split Mode', 'cardsAdded', 5, false)
        ];

        if (failures.length > 0) {
            console.error('\n❌ Performance threshold or invariant failures:');
            failures.forEach(f => console.error(`  - ${f}`));
            process.exitCode = 1;
        } else {
            console.log(
                `\n✅ All 500 & 1000-event latency (< ${THRESHOLDS.desktopMaxPaintMs}ms Desktop, < ${THRESHOLDS.mobileMaxPaintMs}ms 4x Mobile) and DOM/storage invariant assertions passed.`
            );
        }
    } finally {
        await browser.close();
        server.close();
    }
}

runBenchmarks().catch(err => {
    console.error(err);
    process.exit(1);
});
