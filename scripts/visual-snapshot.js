#!/usr/bin/env node
/**
 * Automated Visual Snapshot Tool
 *
 * Runs headless Chromium via Playwright against seeded URLs (?mock=sample, ?mock=active, /dev/preview),
 * capturing high-fidelity screenshots at mobile (390px) and desktop (1280px) viewports,
 * and generates diff.png of the updated button grid.
 *
 * Enables "Asynchronous Dispatch" & instant 5-second PR visual review.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_DIR = path.resolve(__dirname, '../.visual-proof');
const DIFF_PATH = path.resolve(__dirname, '../diff.png');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const VIEWPORTS = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 800 }
];

const DEFAULT_SCREENS = [
    {
        name: 'event-capture-idle',
        path: '/#event-capture',
        waitForSelector: '#boardSelect'
    },
    {
        name: 'event-capture-active',
        path: '/#event-capture?mock=active',
        waitForSelector: '#coding-buttons-container button'
    },
    {
        name: 'saved-games',
        path: '/#saved-games?mock=sample',
        waitForSelector: '#savedGamesList'
    },
    {
        name: 'saved-game-log',
        path: '/#log/sample-game?mock=sample',
        waitForSelector: '#savedGameLogBanner'
    },
    {
        name: 'match-review',
        path: '/timeline-video.html?game=sample-game&mock=sample',
        waitForSelector: '#timeline-container'
    },
    {
        name: 'configure',
        path: '/#configure',
        waitForSelector: '#configBoardPreview'
    }
];

function createStaticServer() {
    return http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        let pathname = decodeURIComponent(parsedUrl.pathname);

        if (pathname === '/' || pathname === '' || pathname === '/dev/preview' || pathname === '/dev/preview/') {
            pathname = '/index.html';
        } else if (pathname.startsWith('/dev/')) {
            pathname = pathname.replace(/^\/dev/, '');
        }

        const filePath = path.join(SRC_DIR, pathname);

        // Security check: ensure path stays within SRC_DIR
        if (!filePath.startsWith(SRC_DIR)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.statusCode = 404;
                res.end('Not Found: ' + pathname);
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            fs.createReadStream(filePath).pipe(res);
        });
    });
}

async function runSnapshots() {
    const server = createStaticServer();

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`[visual-snapshot] Local dev server running at ${baseUrl}`);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const browser = await chromium.launch({ headless: true });
    const results = [];

    try {
        // Capture standard seeded screens
        for (const screen of DEFAULT_SCREENS) {
            for (const vp of VIEWPORTS) {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: 2
                });
                const page = await context.newPage();

                const targetUrl = `${baseUrl}${screen.path}`;
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

                if (screen.waitForSelector) {
                    try {
                        await page.waitForSelector(screen.waitForSelector, { timeout: 3000 });
                    } catch {
                        // Continue if timeout happens
                    }
                }

                // Brief pause for CSS transitions / layout settling
                await page.waitForTimeout(400);

                const fileName = `${screen.name}-${vp.name}.png`;
                const filePath = path.join(OUTPUT_DIR, fileName);

                await page.screenshot({ path: filePath, fullPage: true });

                const stats = fs.statSync(filePath);
                results.push({
                    name: screen.name,
                    viewport: vp.name,
                    size: `${vp.width}x${vp.height}`,
                    file: fileName,
                    bytes: stats.size
                });

                await context.close();
            }
        }

        // Capture custom board flow proof: Duplication, Import, and Event Capture
        const sampleImportBoardPath = path.join(OUTPUT_DIR, 'sample-coach-board.json');
        const sampleImportData = {
            name: 'Under-16 Pressing',
            zones: { values: ['1', '2', '3', '4'], default: '1', perspective: 'mirrored' },
            rowDefs: [
                { gridCols: 'grid-cols-3', buttons: [{ event: 'START', text: 'START', color: 'btn-gray' }, { event: 'END', text: 'END', color: 'btn-gray' }, { event: 'UMP', text: 'UMP', color: 'btn-gray' }] },
                { team: 1, grids: [{ gridCols: 'grid-cols-4', buttons: [{ event: 'HIGH PRESS', text: 'HIGH PRESS', lead: 10, lag: 10 }, { event: 'HALF COURT', text: 'HALF COURT', lead: 10, lag: 10 }, { event: 'TURNOVER FOR', text: 'TURNOVER FOR', lead: 5, lag: 10 }, { event: 'CIRCLE ENTRY', text: 'CIRCLE ENTRY', lead: 8, lag: 5 }] }] },
                { team: 2, grids: [{ gridCols: 'grid-cols-4', buttons: [{ event: 'HIGH PRESS', text: 'HIGH PRESS', lead: 10, lag: 10 }, { event: 'HALF COURT', text: 'HALF COURT', lead: 10, lag: 10 }, { event: 'TURNOVER AG', text: 'TURNOVER AG', lead: 5, lag: 10 }, { event: 'CIRCLE ENTRY', text: 'CIRCLE ENTRY', lead: 8, lag: 5 }] }] }
            ]
        };
        fs.writeFileSync(sampleImportBoardPath, JSON.stringify(sampleImportData, null, 2), 'utf8');

        // Test custom board creation via Duplicate
        const customContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 2
        });
        const customPage = await customContext.newPage();
        await customPage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
        await customPage.waitForSelector('#duplicateConfigButton');
        await customPage.click('#duplicateConfigButton');
        await customPage.waitForTimeout(400);

        const configCustomPath = path.join(OUTPUT_DIR, 'configure-custom-board-desktop.png');
        await customPage.screenshot({ path: configCustomPath, fullPage: true });

        // Navigate to Event Capture to prove the duplicated board is in boardSelect
        await customPage.goto(`${baseUrl}/#event-capture`, { waitUntil: 'domcontentloaded' });
        await customPage.waitForSelector('#boardSelect');
        await customPage.waitForTimeout(400);

        const captureCustomPath = path.join(OUTPUT_DIR, 'event-capture-custom-board-desktop.png');
        await customPage.screenshot({ path: captureCustomPath, fullPage: true });
        await customContext.close();

        // Multi-viewport proof for Board Import flow (Desktop & Mobile)
        for (const vp of VIEWPORTS) {
            const importContext = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const importPage = await importContext.newPage();

            // 1. Go to Configure
            await importPage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
            await importPage.waitForSelector('#importConfigButton');
            await importPage.waitForSelector('#boardFileInput', { state: 'attached' });

            // 2. Import the sample coach board file
            await importPage.setInputFiles('#boardFileInput', sampleImportBoardPath);
            await importPage.waitForTimeout(500);

            // Snapshot Configure showing imported board
            const configImportPath = path.join(OUTPUT_DIR, `configure-imported-board-${vp.name}.png`);
            await importPage.screenshot({ path: configImportPath, fullPage: true });

            // 3. Navigate to Event Capture to verify the imported board is active on pitch
            await importPage.goto(`${baseUrl}/#event-capture`, { waitUntil: 'domcontentloaded' });
            await importPage.waitForSelector('#boardSelect');
            await importPage.waitForTimeout(500);

            const captureImportPath = path.join(OUTPUT_DIR, `event-capture-imported-board-${vp.name}.png`);
            await importPage.screenshot({ path: captureImportPath, fullPage: true });

            await importContext.close();
        }

        // Capture diff.png: Button grid seeded with /dev/preview?state=adelaide-fire&mock=pc-counter
        const diffContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 2
        });
        const diffPage = await diffContext.newPage();
        const diffUrl = `${baseUrl}/dev/preview?state=adelaide-fire&mock=pc-counter`;
        await diffPage.goto(diffUrl, { waitUntil: 'networkidle' });

        try {
            await diffPage.waitForSelector('#coding-buttons-container button', { timeout: 5000 });
        } catch {
            // Continue if timeout happens
        }
        await diffPage.waitForTimeout(400);

        const gridElement = await diffPage.$('#coding-buttons-container');
        if (gridElement) {
            await gridElement.screenshot({ path: DIFF_PATH });
        } else {
            await diffPage.screenshot({ path: DIFF_PATH, fullPage: false });
        }
        const diffStats = fs.statSync(DIFF_PATH);
        console.log(`\n🎯 diff.png captured for Adelaide Fire Penalty Corner Counter: ${DIFF_PATH} (${diffStats.size} bytes)`);

        await diffContext.close();

        console.log('\n📸 Visual Snapshots Generated:\n');
        console.table(results);
        console.log(`\nArtifacts saved in: ${OUTPUT_DIR}\n`);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
    }
}

runSnapshots().catch((err) => {
    console.error('Error running visual snapshots:', err);
    process.exit(1);
});
