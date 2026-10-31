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

            const editStats = fs.statSync(editTagsPath);
            results.push({
                name: 'video-coding-edit-tags',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `video-coding-edit-tags-${vp.name}.png`,
                bytes: editStats.size
            });

            // 2b. Exercise move right and re-index
            const moveRightBtn = await videoPage.$('.quick-tag-move-btn.move-right:not([disabled])');
            if (moveRightBtn) await moveRightBtn.click();
            await videoPage.waitForTimeout(200);

            const reorderPath = path.join(OUTPUT_DIR, `video-coding-reordered-${vp.name}.png`);
            await videoPage.screenshot({ path: reorderPath, fullPage: true });

            const reorderStats = fs.statSync(reorderPath);
            results.push({
                name: 'video-coding-reordered',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `video-coding-reordered-${vp.name}.png`,
                bytes: reorderStats.size
            });

            // Exit edit mode back to normal coding before split view
            if (editTagsBtn) await editTagsBtn.click();
            await videoPage.waitForTimeout(200);

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

            // 4. In Events Panel, click more menu and note editor on first event
            const moreBtn = await videoPage.$('.timeline-event .timeline-event-more-btn');
            if (moreBtn) {
                await moreBtn.click();
                await videoPage.waitForTimeout(150);
            }
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

            // Launch Label Sweep: opens Scope Picker dialog
            await sweepPage.click('#label-sweep-btn');
            await sweepPage.waitForSelector('#sweep-scope-dialog:not(.hidden), dialog[open]');
            await sweepPage.waitForSelector('#sweep-scope-options button');
            await sweepPage.waitForTimeout(300);

            // Snapshot Step 1a: Sweep Scope Picker
            const sweepScopePath = path.join(OUTPUT_DIR, `timeline-video-sweep-scope-${vp.name}.png`);
            await sweepPage.screenshot({ path: sweepScopePath, fullPage: true });

            // Select first scope option to start sweep
            const firstScopeOption = await sweepPage.$('#sweep-scope-options button');
            if (firstScopeOption) await firstScopeOption.click();
            await sweepPage.waitForSelector('#sweep-dock:not(.hidden)');
            await sweepPage.waitForSelector('.sweep-action-card');
            await sweepPage.waitForTimeout(300);

            // Snapshot Step 1b: Dedicated Sweep Dock active below video
            const sweepModePath = path.join(OUTPUT_DIR, `timeline-video-sweep-${vp.name}.png`);
            await sweepPage.screenshot({ path: sweepModePath, fullPage: true });

            // Apply label to event via action card click
            const firstCard = await sweepPage.$('.sweep-action-card');
            if (firstCard) await firstCard.click();
            await sweepPage.waitForTimeout(300);

            // If dock is still visible (multiple clips in scope), exit to view timeline
            const exitBtn = await sweepPage.$('#dock-exit-sweep-btn');
            if (exitBtn && await exitBtn.isVisible()) {
                await exitBtn.click();
                await sweepPage.waitForTimeout(300);
            }

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

        // Capture Help Page Jump Links and Anchor Navigation Flow (Desktop & Mobile)
        for (const vp of VIEWPORTS) {
            const helpContext = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const helpPage = await helpContext.newPage();

            // 1. Land on Help view
            await helpPage.goto(`${baseUrl}/#help`, { waitUntil: 'domcontentloaded' });
            await helpPage.waitForSelector('#help-jump-bar');
            await helpPage.waitForSelector('#help-view:not(.hidden)');
            await helpPage.waitForTimeout(300);

            // 2. Click Jump to Board Configuration
            const boardConfigJump = await helpPage.$('#help-jump-bar a[href*="help-configuration-title"]');
            if (boardConfigJump) await boardConfigJump.click();
            await helpPage.waitForTimeout(1200);

            // Verify we did NOT navigate to saved-games
            const isHelpStillVisible = await helpPage.$eval('#help-view', el => !el.classList.contains('hidden'));
            if (!isHelpStillVisible) throw new Error('Help view was navigated away after clicking Board Configuration jump link!');

            const jumpConfigPath = path.join(OUTPUT_DIR, `help-jump-configuration-${vp.name}.png`);
            await helpPage.screenshot({ path: jumpConfigPath, fullPage: false });

            // 3. Click Jump to Label Sweep & AI Metadata
            const sweepJump = await helpPage.$('#help-jump-bar a[href*="help-sweep-metadata-title"]');
            if (sweepJump) await sweepJump.click();
            await helpPage.waitForTimeout(1200);

            const jumpSweepPath = path.join(OUTPUT_DIR, `help-jump-sweep-${vp.name}.png`);
            await helpPage.screenshot({ path: jumpSweepPath, fullPage: false });

            // 4. Click Jump to 3 Coding Modes
            const modesJump = await helpPage.$('#help-jump-bar a[href*="help-overview-heading"]');
            if (modesJump) await modesJump.click();
            await helpPage.waitForTimeout(1200);

            const jumpModesPath = path.join(OUTPUT_DIR, `help-jump-coding-modes-${vp.name}.png`);
            await helpPage.screenshot({ path: jumpModesPath, fullPage: false });

            // 5. Test direct anchor navigation without redirecting to index
            await helpPage.goto(`${baseUrl}/#help-configuration-title`, { waitUntil: 'domcontentloaded' });
            await helpPage.waitForSelector('#help-view:not(.hidden)');
            await helpPage.waitForTimeout(1000);

            const directAnchorPath = path.join(OUTPUT_DIR, `help-direct-anchor-${vp.name}.png`);
            await helpPage.screenshot({ path: directAnchorPath, fullPage: false });

            await helpContext.close();
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

        // Multi-viewport proof for Single-Pass Compound Tagging (Friction 2 Spike)
        for (const vp of VIEWPORTS) {
            const chordContext = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const chordPage = await chordContext.newPage();

            // 1. Live sideline event capture
            await chordPage.goto(`${baseUrl}/#event-capture?mock=active`, { waitUntil: 'domcontentloaded' });
            await chordPage.waitForSelector('#coding-buttons-container button');

            // Resume clock if paused
            await chordPage.waitForSelector('#pauseResumeButton');
            const pauseText = await chordPage.$eval('#pauseResumeButton', el => el.textContent);
            if (pauseText.includes('Resume')) {
                await chordPage.click('#pauseResumeButton');
                await chordPage.waitForTimeout(200);
            }

            // Dismiss any restore notification/toast before tagging
            await chordPage.evaluate(() => {
                document.querySelectorAll('[role="status"], .toast, #notification-container, .notification').forEach(el => el.remove());
            });

            // Click Circle Entry (CE) button to trigger transient chord thumb dock
            const ceBtn = await chordPage.waitForSelector('.event-button[data-event*="CE"], .event-button[data-base-event="CE"]');
            await ceBtn.click();
            await chordPage.waitForSelector('#chordThumbDock:not(.hidden)', { timeout: 5000 });
            await chordPage.waitForTimeout(200);

            const activeThumbPath = path.join(OUTPUT_DIR, `live-capture-chord-active-${vp.name}.png`);
            await chordPage.screenshot({ path: activeThumbPath, fullPage: false });

            // Click 'Left' pill to resolve modifier
            const leftPill = await chordPage.waitForSelector('#chordPillsContainer [data-chord-key="1"]', { timeout: 3000 });
            await leftPill.click();
            await chordPage.waitForTimeout(300);

            const resolvedThumbPath = path.join(OUTPUT_DIR, `live-capture-chord-resolved-${vp.name}.png`);
            await chordPage.screenshot({ path: resolvedThumbPath, fullPage: false });

            await chordContext.close();
        }

        // Desktop Video Coding Focus Tagging Chord Proof (1280px)
        const videoChordCtx = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            deviceScaleFactor: 2
        });
        const videoChordPage = await videoChordCtx.newPage();
        await videoChordPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mode=tag`, { waitUntil: 'domcontentloaded' });
        await videoChordPage.waitForSelector('#quick-tags-container button');

        // Press '3' (Circle Entry) to trigger transient video chord dock
        await videoChordPage.keyboard.press('3');
        await videoChordPage.waitForSelector('#video-chord-dock:not(.hidden)');
        await videoChordPage.waitForTimeout(200);

        const videoActiveChordPath = path.join(OUTPUT_DIR, 'video-coding-chord-active-desktop.png');
        await videoChordPage.screenshot({ path: videoActiveChordPath, fullPage: false });

        // Press '1' (Left) to attach modifier
        await videoChordPage.keyboard.press('1');
        await videoChordPage.waitForTimeout(300);

        const videoResolvedChordPath = path.join(OUTPUT_DIR, 'video-coding-chord-resolved-desktop.png');
        await videoChordPage.screenshot({ path: videoResolvedChordPath, fullPage: false });

        await videoChordCtx.close();

        // Video Alignment Modal & Event Log Clean Layout Proof
        for (const vp of VIEWPORTS) {
            const alignCtx = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                deviceScaleFactor: 2
            });
            const alignPage = await alignCtx.newPage();
            await alignPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
            await alignPage.waitForSelector('#timeline-events .timeline-event');
            await alignPage.waitForTimeout(300);

            // Screenshot clean event log with badges on single line and favorite / more buttons
            const cleanLogPath = path.join(OUTPUT_DIR, `timeline-events-clean-${vp.name}.png`);
            await alignPage.screenshot({ path: cleanLogPath, fullPage: false });
            results.push({
                name: 'timeline-events-clean',
                viewport: vp.name,
                size: `${vp.width}x${vp.height}`,
                file: `timeline-events-clean-${vp.name}.png`,
                bytes: fs.statSync(cleanLogPath).size
            });

            // Open More Menu on first event
            const moreBtn = await alignPage.$('.timeline-event-more-btn');
            if (moreBtn) {
                await moreBtn.click();
                await alignPage.waitForSelector('.timeline-event-more-menu:not(.hidden)');
                await alignPage.waitForTimeout(200);

                const moreMenuPath = path.join(OUTPUT_DIR, `timeline-event-more-menu-${vp.name}.png`);
                await alignPage.screenshot({ path: moreMenuPath, fullPage: false });
                results.push({
                    name: 'timeline-event-more-menu',
                    viewport: vp.name,
                    size: `${vp.width}x${vp.height}`,
                    file: `timeline-event-more-menu-${vp.name}.png`,
                    bytes: fs.statSync(moreMenuPath).size
                });
            }

            // Set video playhead so align modal has real video context to compute
            await alignPage.evaluate(() => {
                const video = document.getElementById('video-player');
                if (video) {
                    video.src = 'http://localhost/sample-video.mp4';
                    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
                    Object.defineProperty(video, 'currentTime', { value: 242, configurable: true });
                    video.dispatchEvent(new Event('loadeddata'));
                }
            });
            await alignPage.waitForTimeout(200);

            // Click Align Video button in toolbar
            const alignBtn = await alignPage.$('#align-video-btn:not(.hidden)');
            if (alignBtn) {
                await alignBtn.click();
                await alignPage.waitForSelector('#align-video-modal:not(.hidden)');
                await alignPage.waitForTimeout(200);

                const modalPath = path.join(OUTPUT_DIR, `align-video-modal-${vp.name}.png`);
                await alignPage.screenshot({ path: modalPath, fullPage: false });
                results.push({
                    name: 'align-video-modal',
                    viewport: vp.name,
                    size: `${vp.width}x${vp.height}`,
                    file: `align-video-modal-${vp.name}.png`,
                    bytes: fs.statSync(modalPath).size
                });
            }

            await alignCtx.close();
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
