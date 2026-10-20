#!/usr/bin/env node
/**
 * Automated Visual Snapshot Tool
 *
 * Runs headless Chromium via Playwright against seeded URLs (?mock=sample, ?mock=active),
 * capturing high-fidelity screenshots at mobile (390px) and desktop (1280px) viewports.
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
        waitForSelector: '#configJsonInput'
    }
];

function createStaticServer() {
    return http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, 'http://localhost');
        let pathname = decodeURIComponent(parsedUrl.pathname);

        if (pathname === '/' || pathname === '') {
            pathname = '/index.html';
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
                res.end('Not Found');
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
