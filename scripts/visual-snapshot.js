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
        name: 'matches-hub-root',
        path: '/?mock=sample',
        waitForSelector: '#savedGamesList'
    },
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
        name: 'match-review-empty',
        path: '/timeline-video.html',
        waitForSelector: '#no-game-selected-state'
    },
    {
        name: 'match-review',
        path: '/timeline-video.html?game=sample-game&mock=sample',
        waitForSelector: '#timeline-events'
    },
    {
        name: 'configure',
        path: '/#configure',
        waitForSelector: '#configBoardPreview'
    },
    {
        name: 'help-coding-modes',
        path: '/#help',
        waitForSelector: '#help-view:not(.hidden)'
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
        // Capture vibrant Live Match screenshot for Help page (running clock, active team colors)
        const liveHeroCtx = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 2
        });
        const liveHeroPage = await liveHeroCtx.newPage();
        await liveHeroPage.goto(`${baseUrl}/#event-capture?mock=active`, { waitUntil: 'domcontentloaded' });
        await liveHeroPage.waitForSelector('#pauseResumeButton');
        await liveHeroPage.click('#pauseResumeButton');
        // Dismiss any restore toast so the screenshot is super clean
        await liveHeroPage.evaluate(() => {
            document.querySelectorAll('[role="status"], .toast, #notification-container').forEach(el => el.remove());
        });
        await liveHeroPage.waitForTimeout(300);
        const liveHeroPath = path.resolve(SRC_DIR, 'assets/help/mode-live-match.png');
        await liveHeroPage.screenshot({ path: liveHeroPath, fullPage: false });
        await liveHeroCtx.close();

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

        // Capture Create Match dropdown open state (desktop and mobile)
        for (const vp of VIEWPORTS) {
            const dropdownCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const dropdownPage = await dropdownCtx.newPage();
            await dropdownPage.goto(`${baseUrl}/?mock=sample`, { waitUntil: 'domcontentloaded' });
            await dropdownPage.waitForSelector('#createMatchDropdownButton');
            await dropdownPage.click('#createMatchDropdownButton');
            await dropdownPage.waitForSelector('#createMatchMenu:not(.hidden)');
            await dropdownPage.waitForTimeout(300);

            const dropdownOpenPath = path.join(OUTPUT_DIR, `create-match-dropdown-open-${vp.name}.png`);
            await dropdownPage.screenshot({ path: dropdownOpenPath, fullPage: true });

            const stats = fs.statSync(dropdownOpenPath);
            results.push({
                name: 'create-match-dropdown-open',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `create-match-dropdown-open-${vp.name}.png`,
                bytes: stats.size
            });

            await dropdownCtx.close();
        }

        // Capture Saved Game More menu open -> Continue coding flow (desktop and mobile)
        for (const vp of VIEWPORTS) {
            const continueCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const continuePage = await continueCtx.newPage();
            await continuePage.goto(`${baseUrl}/#saved-games?mock=sample`, { waitUntil: 'domcontentloaded' });
            await continuePage.waitForSelector('.saved-game-more button[aria-haspopup="menu"]');
            await continuePage.click('.saved-game-more button[aria-haspopup="menu"]');
            await continuePage.waitForSelector('.saved-game-menu:not(.hidden)');
            await continuePage.waitForTimeout(300);

            const step1Path = path.join(OUTPUT_DIR, `continue-coding-step1-menu-${vp.name}.png`);
            await continuePage.screenshot({ path: step1Path, fullPage: true });
            results.push({
                name: 'continue-coding-step1-menu',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `continue-coding-step1-menu-${vp.name}.png`,
                bytes: fs.statSync(step1Path).size
            });

            // Tap 1 -> Tap 2: Click "Continue coding" in the menu and land in Tagging Mode
            const continueMenuItem = await continuePage.$('#savedGamesList .saved-game-menu-item');
            if (continueMenuItem) {
                await Promise.all([
                    continuePage.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                    continueMenuItem.click()
                ]);
                await continuePage.waitForSelector('#video-coding-panel:not(.hidden)');
                await continuePage.waitForTimeout(300);

                const step2Path = path.join(OUTPUT_DIR, `continue-coding-step2-active-${vp.name}.png`);
                await continuePage.screenshot({ path: step2Path, fullPage: true });
                results.push({
                    name: 'continue-coding-step2-active',
                    viewport: vp.name,
                    size: `${vp.width}x${vp.height}`,
                    file: `continue-coding-step2-active-${vp.name}.png`,
                    bytes: fs.statSync(step2Path).size
                });
            }

            await continueCtx.close();
        }

        // Capture Board Actions dropdown open state on Configure (desktop and mobile)
        for (const vp of VIEWPORTS) {
            const configActionsCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const configActionsPage = await configActionsCtx.newPage();
            await configActionsPage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
            await configActionsPage.waitForSelector('#configActionsDropdownButton');
            await configActionsPage.click('#configActionsDropdownButton');
            await configActionsPage.waitForSelector('#configActionsMenu:not(.hidden)');
            await configActionsPage.waitForTimeout(300);

            const configActionsOpenPath = path.join(OUTPUT_DIR, `configure-actions-dropdown-open-${vp.name}.png`);
            await configActionsPage.screenshot({ path: configActionsOpenPath, fullPage: true });

            const stats = fs.statSync(configActionsOpenPath);
            results.push({
                name: 'configure-actions-dropdown-open',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `configure-actions-dropdown-open-${vp.name}.png`,
                bytes: stats.size
            });

            await configActionsCtx.close();
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

        // Test custom board creation and actions on mobile
        const customMobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2
        });
        const customMobilePage = await customMobileContext.newPage();
        await customMobilePage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
        await customMobilePage.waitForSelector('#duplicateConfigButton');
        await customMobilePage.click('#duplicateConfigButton');
        await customMobilePage.waitForTimeout(400);

        const configCustomMobilePath = path.join(OUTPUT_DIR, 'configure-custom-board-mobile.png');
        await customMobilePage.screenshot({ path: configCustomMobilePath, fullPage: true });

        await customMobilePage.click('#configActionsDropdownButton');
        await customMobilePage.waitForSelector('#configActionsMenu:not(.hidden)');
        await customMobilePage.waitForTimeout(300);
        const configCustomMobileActionsPath = path.join(OUTPUT_DIR, 'configure-custom-actions-open-mobile.png');
        await customMobilePage.screenshot({ path: configCustomMobileActionsPath, fullPage: true });

        await customMobileContext.close();

        // Capture Video Coding active interaction (desktop and mobile)
        for (const vp of VIEWPORTS) {
            const videoCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const videoPage = await videoCtx.newPage();
            // 1. Open with ?mode=tag to activate Focus Tagging Mode directly
            await videoPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample&mode=tag`, { waitUntil: 'domcontentloaded' });
            await videoPage.waitForSelector('#video-coding-panel:not(.hidden)');
            await videoPage.waitForSelector('.quick-tag-btn');
            
            // 1-tap quick tag Goal
            const goalBtn = await videoPage.$('.quick-tag-btn[data-quick-tag="Goal"]');
            if (goalBtn) await goalBtn.click();
            await videoPage.waitForTimeout(300);

            // Screenshot Focus Tagging Mode (video maximized, quick tags visible, ticker showing last event and undo)
            const taggingModePath = path.join(OUTPUT_DIR, `video-coding-tagging-mode-${vp.name}.png`);
            await videoPage.screenshot({ path: taggingModePath, fullPage: true });

            // 2. Open In-Place Tag Customization / Edit Tags view
            const editTagsBtn = await videoPage.$('#edit-quick-tags-btn');
            if (editTagsBtn) await editTagsBtn.click();
            await videoPage.waitForSelector('.quick-tag-delete-badge');
            await videoPage.waitForSelector('#quick-tags-edit-bar:not(.hidden)');
            await videoPage.waitForTimeout(300);

            const editTagsPath = path.join(OUTPUT_DIR, `video-coding-edit-tags-${vp.name}.png`);
            await videoPage.screenshot({ path: editTagsPath, fullPage: true });

            // 3. Open Events Panel alongside Quick Tags (Split Mode)
            const reviewBtn = await videoPage.$('#quick-tag-review-btn');
            if (reviewBtn) await reviewBtn.click();
            await videoPage.waitForSelector('#timeline-container', { state: 'visible' });
            await videoPage.waitForSelector('#timeline-panel-header', { state: 'visible' });
            await videoPage.waitForTimeout(300);

            const splitModePath = path.join(OUTPUT_DIR, `video-coding-split-mode-${vp.name}.png`);
            await videoPage.screenshot({ path: splitModePath, fullPage: true });

            const splitStats = fs.statSync(splitModePath);
            results.push({
                name: 'video-coding-split-mode',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `video-coding-split-mode-${vp.name}.png`,
                bytes: splitStats.size
            });

            // 4. In Events Panel, click note editor on first event
            const noteBtn = await videoPage.$('.timeline-event .edit-note-btn');
            if (noteBtn) await noteBtn.click();
            await videoPage.waitForTimeout(300);

            const videoCodingActivePath = path.join(OUTPUT_DIR, `video-coding-active-${vp.name}.png`);
            await videoPage.screenshot({ path: videoCodingActivePath, fullPage: true });
            await videoCtx.close();
        }

        
        // Capture Video URL Attachment Flow Proof (Desktop & Mobile)
        for (const vp of VIEWPORTS) {
            const urlCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const urlPage = await urlCtx.newPage();

            // Step 1: Open match review with sample game
            await urlPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
            await urlPage.waitForSelector('#attach-video-btn');

            // Open the Attach Video modal
            await urlPage.click('#attach-video-btn');
            await urlPage.waitForSelector('#attach-video-modal:not(.hidden)');
            await urlPage.waitForSelector('#video-url-input');

            // Type a realistic web video link
            await urlPage.fill('#video-url-input', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
            await urlPage.waitForTimeout(300);

            // Step 1 snapshot: Modal open with Web Video URL tab and filled input
            const step1Path = path.join(OUTPUT_DIR, `video-url-step1-modal-${vp.name}.png`);
            await urlPage.screenshot({ path: step1Path, fullPage: true });

            // Step 2: Submit and attach video
            await urlPage.click('#submit-attach-url-btn');
            await urlPage.waitForSelector('#attach-video-modal', { state: 'hidden' });
            await urlPage.waitForSelector('#video-stage-empty-overlay', { state: 'hidden' });
            await urlPage.waitForTimeout(500);

            // Step 2 snapshot: Active video attached, player controls live, notification shown
            const step2Path = path.join(OUTPUT_DIR, `video-url-step2-attached-${vp.name}.png`);
            await urlPage.screenshot({ path: step2Path, fullPage: true });

            // Step 3: Reload the page without mock reset to verify auto-restore from storage
            await urlPage.goto(`${baseUrl}/timeline-video.html?game=sample-game`, { waitUntil: 'domcontentloaded' });
            await urlPage.waitForSelector('#video-stage-empty-overlay', { state: 'hidden' });
            await urlPage.waitForTimeout(500);

            // Step 3 snapshot: Reloaded page retains video source automatically
            const step3Path = path.join(OUTPUT_DIR, `video-url-step3-reload-${vp.name}.png`);
            await urlPage.screenshot({ path: step3Path, fullPage: true });

            await urlCtx.close();
        }

        // Capture Label Sweep & Tactical Tagging Flow Proof (Desktop & Mobile)
        for (const vp of VIEWPORTS) {
            const sweepCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const sweepPage = await sweepCtx.newPage();

            // Step 1: Open match review with sample game
            await sweepPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
            await sweepPage.waitForSelector('#label-sweep-btn');
            await sweepPage.waitForSelector('#timeline-events');

            // Launch Label Sweep
            await sweepPage.click('#label-sweep-btn');
            await sweepPage.waitForSelector('#sweep-controls:not(.hidden)');
            await sweepPage.waitForSelector('.sweep-chip');
            await sweepPage.waitForTimeout(300);

            // Step 1 snapshot: Active Label Sweep controls docked with rapid-fire chips
            const sweepModePath = path.join(OUTPUT_DIR, `timeline-video-sweep-${vp.name}.png`);
            await sweepPage.screenshot({ path: sweepModePath, fullPage: true });

            // Apply label to first event via chip click
            const firstChip = await sweepPage.$('.sweep-chip');
            if (firstChip) await firstChip.click();
            await sweepPage.waitForTimeout(300);

            // Exit sweep to view timeline
            const exitBtn = await sweepPage.$('#exit-sweep-btn');
            if (exitBtn) await exitBtn.click();
            await sweepPage.waitForTimeout(300);

            // Step 2 snapshot: Timeline displaying the inline label badge pill
            const labelledPath = path.join(OUTPUT_DIR, `timeline-video-labelled-timeline-${vp.name}.png`);
            await sweepPage.screenshot({ path: labelledPath, fullPage: true });

            // Step 3: Click Unlabelled filter tab
            const unlabelledBtn = await sweepPage.$('#show-unlabelled');
            if (unlabelledBtn) await unlabelledBtn.click();
            await sweepPage.waitForTimeout(300);

            // Step 3 snapshot: Unlabelled view isolating events needing review
            const unlabelledFilterPath = path.join(OUTPUT_DIR, `timeline-video-unlabelled-filter-${vp.name}.png`);
            await sweepPage.screenshot({ path: unlabelledFilterPath, fullPage: true });

            await sweepCtx.close();
        }

        // Multi-viewport proof for Board Import flow (Desktop & Mobile)
        for (const vp of VIEWPORTS) {
            const importContext = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const importPage = await importContext.newPage();

            // 1. Go to Configure
            await importPage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
            await importPage.waitForSelector('#configActionsDropdownButton');
            await importPage.click('#configActionsDropdownButton');
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
