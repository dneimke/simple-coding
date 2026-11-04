import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { createStaticServer } from './lib/staticServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const THRESHOLDS = {
    desktop500MaxPaintMs: 25,
    mobile500MaxPaintMs: 60
};

function generateEvents(count) {
    const types = [
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
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));

    if (config.throttleRate > 1) {
        await client.send('Emulation.setCPUThrottlingRate', { rate: config.throttleRate });
    }

    const stats = await page.evaluate(async ({ buttonSelector, detailSelector, storageKey }) => {
        const btn = document.querySelector(buttonSelector);
        const samples = [];
        for (let i = 0; i < 5; i++) {
            const t0 = performance.now();
            btn.click();
            const tSync = performance.now() - t0;
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
            samples.push({ syncMs: tSync, paintMs: performance.now() - t0 });
        }
        return {
            samples,
            totalDomNodes: document.querySelectorAll('*').length,
            detailNodes: document.querySelectorAll(detailSelector).length,
            storageBytes: (localStorage.getItem(storageKey) || '').length
        };
    }, {
        buttonSelector: config.buttonSelector,
        detailSelector: config.detailSelector,
        storageKey: config.storageKey
    });

    await context.close();
    const avgSync = stats.samples.reduce((a, b) => a + b.syncMs, 0) / stats.samples.length;
    const avgPaint = stats.samples.reduce((a, b) => a + b.paintMs, 0) / stats.samples.length;

    return {
        events: config.count,
        cpu: config.throttleRate === 1 ? '1x (Desktop)' : `${config.throttleRate}x (Mobile)`,
        syncTapMs: Number(avgSync.toFixed(1)),
        tapToPaintMs: Number(avgPaint.toFixed(1)),
        totalDomNodes: stats.totalDomNodes,
        [config.detailField]: stats.detailNodes,
        [config.sizeField]: Number((stats.storageBytes / 1024).toFixed(1))
    };
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

function buildVideoCodingConfig(baseUrl, count, throttleRate) {
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
        buttonSelector: '#quick-tags-container button',
        detailSelector: '#timeline-events *',
        detailField: 'timelineDomNodes',
        sizeField: 'storageKB',
        storageKey: 'fieldHockeyGames_v1',
        storageValue: [targetGame, ...historicalGames]
    };
}

function checkThreshold(row, maxPaintMs, label) {
    if (!row || row.tapToPaintMs <= maxPaintMs) return [];
    return [`${label} tapToPaintMs=${row.tapToPaintMs}ms > ${maxPaintMs}ms`];
}

function collectThresholdFailures(results, label) {
    const desktop = results.find(r => r.events === 500 && r.cpu.startsWith('1x'));
    const mobile = results.find(r => r.events === 500 && r.cpu.startsWith('4x'));
    return [
        ...checkThreshold(desktop, THRESHOLDS.desktop500MaxPaintMs, `${label} 500 events (1x Desktop)`),
        ...checkThreshold(mobile, THRESHOLDS.mobile500MaxPaintMs, `${label} 500 events (4x Mobile)`)
    ];
}

async function runSuite(browser, baseUrl, builder) {
    const counts = [10, 100, 250, 500, 1000];
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
    const browser = await chromium.launch({ headless: true });

    try {
        const liveResults = await runSuite(browser, baseUrl, buildLiveCaptureConfig);
        const videoResults = await runSuite(browser, baseUrl, buildVideoCodingConfig);

        console.log('\n=== LIVE EVENT CAPTURE (index.html#event-capture) ===');
        console.table(liveResults);

        console.log('\n=== VIDEO CODING / REVIEW (timeline-video.html?mode=tag + 10 saved games) ===');
        console.table(videoResults);

        const failures = [
            ...collectThresholdFailures(liveResults, 'Live Capture'),
            ...collectThresholdFailures(videoResults, 'Video Coding')
        ];

        if (failures.length > 0) {
            console.error('\n❌ Performance threshold failures:');
            failures.forEach(f => console.error(`  - ${f}`));
            process.exitCode = 1;
        } else {
            console.log(`\n✅ All 500-event latency assertions passed (< ${THRESHOLDS.desktop500MaxPaintMs}ms Desktop, < ${THRESHOLDS.mobile500MaxPaintMs}ms 4x Mobile).`);
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
