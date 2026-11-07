#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { createStaticServer } from './lib/staticServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const OUTPUT_DIR = path.resolve(__dirname, '../.visual-proof');
const DIFF_PATH = path.resolve(__dirname, '../diff.png');

const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 }
];

const DEFAULT_SCREENS = [
    {
        name: 'live-capture-active',
        path: '/#event-capture?mock=active',
        waitForSelector: '#coding-buttons-container button'
    },
    {
        name: 'live-capture-breakdown-panel',
        path: '/#event-capture?mock=active',
        waitForSelector: '#breakdownContent'
    },
    {
        name: 'in-game-log-active',
        path: '/#log?mock=active',
        waitForSelector: '#recentEventsList button'
    },
    {
        name: 'saved-games-matches-hub',
        path: '/#saved-games?mock=sample',
        waitForSelector: '#savedGamesList'
    },
    {
        name: 'saved-game-log',
        path: '/#log/sample-game',
        waitForSelector: '#timeline-container'
    },
    {
        name: 'saved-games-review-row',
        path: '/#saved-games?mock=sample',
        waitForSelector: '#savedGamesList .saved-game-card'
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

async function captureSingleScreen(browser, baseUrl, screen, vp, results) {
    const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${screen.path}`, { waitUntil: 'domcontentloaded' });

    if (screen.waitForSelector) {
        try {
            await page.waitForSelector(screen.waitForSelector, { timeout: 3000 });
        } catch {}
    }

    await page.waitForTimeout(400);
    const fileName = `${screen.name}-${vp.name}.png`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    await page.screenshot({ path: filePath, fullPage: true });

    results.push({
        name: screen.name,
        viewport: vp.name,
        size: `${vp.width}x${vp.height}`,
        file: fileName,
        bytes: fs.statSync(filePath).size
    });

    await context.close();
}

async function captureStandardScreens(browser, baseUrl, results) {
    for (const screen of DEFAULT_SCREENS) {
        for (const vp of VIEWPORTS) {
            await captureSingleScreen(browser, baseUrl, screen, vp, results);
        }
    }
}

async function captureTeamSetupSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const setupCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const setupPage = await setupCtx.newPage();
        await setupPage.goto(`${baseUrl}/#event-capture`, { waitUntil: 'domcontentloaded' });
        await setupPage.waitForSelector('#newGameButton');
        await setupPage.click('#newGameButton');
        await setupPage.waitForSelector('#teamSetupModal:not(.hidden)');
        await setupPage.waitForTimeout(300);

        const setupModalPath = path.join(OUTPUT_DIR, `event-capture-team-setup-${vp.name}.png`);
        await setupPage.screenshot({ path: setupModalPath, fullPage: true });

        const stats = fs.statSync(setupModalPath);
        results.push({
            name: 'event-capture-team-setup',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `event-capture-team-setup-${vp.name}.png`,
            bytes: stats.size
        });

        await setupCtx.close();
    }
}

async function captureDropdownSnapshots(browser, baseUrl, results) {
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
}

async function captureContinueCodingSnapshots(browser, baseUrl, results) {
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
}

async function captureAppendXmlSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const appendCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const appendPage = await appendCtx.newPage();
        await appendPage.goto(`${baseUrl}/#saved-games?mock=sample`, { waitUntil: 'domcontentloaded' });
        await appendPage.waitForSelector('#savedGamesList .saved-game-card');

        await appendPage.evaluate(async () => {
            const importUtilsPath = '/utils/importUtils.js';
            const { showAppendPreview } = await import(importUtilsPath);
            const storagePath = '/services/gameStorageManager.js';
            const { gameStorageManager } = await import(storagePath);
            const games = gameStorageManager.ensureGameIds();
            const target = games[0] || { id: 'sample', teams: 'FIRE vs TIGERS', events: [] };
            const incoming = [
                { event: 'SHOT', timeMs: 45000 },
                { event: 'TURNOVER', timeMs: 50000 },
                { event: 'CE', timeMs: 12000 }
            ];
            const previewContainer = document.getElementById('previewContainer');
            showAppendPreview(previewContainer, target, incoming);
            document.getElementById('previewModal').classList.remove('hidden');
        });
        await appendPage.waitForSelector('#previewModal:not(.hidden)');
        await appendPage.waitForTimeout(300);

        const appendModalPath = path.join(OUTPUT_DIR, `append-xml-preview-modal-${vp.name}.png`);
        await appendPage.screenshot({ path: appendModalPath, fullPage: true });
        results.push({
            name: 'append-xml-preview-modal',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `append-xml-preview-modal-${vp.name}.png`,
            bytes: fs.statSync(appendModalPath).size
        });

        await appendCtx.close();
    }
}

async function snapshotNewVideoTeamDialog(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const page = await ctx.newPage();
        await page.goto(`${baseUrl}/timeline-video.html?new=video`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#teamSetupModal:not(.hidden)');
        await page.waitForTimeout(300);

        const dialogPath = path.join(OUTPUT_DIR, `video-new-match-teams-${vp.name}.png`);
        await page.screenshot({ path: dialogPath, fullPage: true });
        results.push({
            name: 'video-new-match-teams',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-new-match-teams-${vp.name}.png`,
            bytes: fs.statSync(dialogPath).size
        });

        await page.click('#teamSetupSubmit');
        await page.waitForSelector('#video-coding-panel:not(.hidden)');
        await page.waitForSelector('#edit-match-teams-btn:not(.hidden)');
        await page.waitForTimeout(300);

        const stripPath = path.join(OUTPUT_DIR, `video-new-match-strip-${vp.name}.png`);
        await page.screenshot({ path: stripPath, fullPage: true });
        results.push({
            name: 'video-new-match-strip',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-new-match-strip-${vp.name}.png`,
            bytes: fs.statSync(stripPath).size
        });

        await page.click('#quick-tags-container .quick-tag-btn');
        await page.waitForFunction(() => document.getElementById('edit-match-teams-btn')?.classList.contains('hidden'));
        await page.waitForTimeout(300);

        const taggedPath = path.join(OUTPUT_DIR, `video-new-match-tagged-${vp.name}.png`);
        await page.screenshot({ path: taggedPath, fullPage: true });
        results.push({
            name: 'video-new-match-tagged',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-new-match-tagged-${vp.name}.png`,
            bytes: fs.statSync(taggedPath).size
        });

        await ctx.close();
    }
}

async function snapshotVideoCodingSplitAndNote(videoPage, vp, results) {
    const reviewBtn = await videoPage.$('#quick-tag-review-btn');
    if (reviewBtn) await reviewBtn.click();
    await videoPage.waitForSelector('#timeline-container', { state: 'visible' });
    await videoPage.waitForSelector('#timeline-panel-header', { state: 'visible' });
    await videoPage.waitForTimeout(300);

    const splitModePath = path.join(OUTPUT_DIR, `video-coding-split-mode-${vp.name}.png`);
    await videoPage.screenshot({ path: splitModePath, fullPage: true });

    results.push({
        name: 'video-coding-split-mode',
        viewport: vp.name,
        size: `${vp.width}x${vp.height}`,
        file: `video-coding-split-mode-${vp.name}.png`,
        bytes: fs.statSync(splitModePath).size
    });

    try {
        const moreBtn = await videoPage.$('.timeline-event .timeline-event-more-btn');
        if (moreBtn) {
            await moreBtn.click({ timeout: 2000 });
            await videoPage.waitForTimeout(150);
            const noteBtn = await videoPage.$('.timeline-event .edit-note-btn');
            if (noteBtn) await noteBtn.click({ timeout: 2000 });
            await videoPage.waitForTimeout(300);
        }
    } catch {}

    const videoCodingActivePath = path.join(OUTPUT_DIR, `video-coding-active-${vp.name}.png`);
    await videoPage.screenshot({ path: videoCodingActivePath, fullPage: true });
}

async function captureVideoCodingInteractionSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const videoCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const videoPage = await videoCtx.newPage();
        await videoPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample&mode=tag`, { waitUntil: 'domcontentloaded' });
        await videoPage.waitForSelector('#video-coding-panel:not(.hidden)');
        await videoPage.waitForSelector('.quick-tag-btn');
        
        const shotBtn = await videoPage.$('.quick-tag-btn[data-tag-id="t1-shot"]');
        if (shotBtn) await shotBtn.click();
        await videoPage.waitForTimeout(300);

        const taggingModePath = path.join(OUTPUT_DIR, `video-coding-tagging-mode-${vp.name}.png`);
        await videoPage.screenshot({ path: taggingModePath, fullPage: true });

        await snapshotVideoCodingSplitAndNote(videoPage, vp, results);

        await videoCtx.close();
    }
}

async function captureZoneSuffixSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const zoneCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const zonePage = await zoneCtx.newPage();
        await zonePage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample&mode=tag`, { waitUntil: 'domcontentloaded' });
        await zonePage.waitForSelector('#video-zone-bar:not(.hidden)');
        await zonePage.waitForSelector('.zone-button.is-active[data-zone="1"]');
        await zonePage.waitForFunction(() => {
            const label = (id) => document.querySelector(`[data-tag-id="${id}"] .tag-label`)?.textContent || '';
            return `${label('t1-bs')}|${label('t2-bs')}|${label('t1-shot')}` === 'BS1|BS4|SHOT';
        });

        const zone1Path = path.join(OUTPUT_DIR, `video-zone-step1-zone1-${vp.name}.png`);
        await zonePage.screenshot({ path: zone1Path, fullPage: true });
        const zone1Stats = fs.statSync(zone1Path);
        results.push({
            name: 'video-zone-step1-zone1',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-zone-step1-zone1-${vp.name}.png`,
            bytes: zone1Stats.size
        });

        await zonePage.click('.zone-button[data-zone="3"]');
        await zonePage.waitForFunction(() => {
            const label = (id) => document.querySelector(`[data-tag-id="${id}"] .tag-label`)?.textContent || '';
            return `${label('t1-bs')}|${label('t2-bs')}|${label('t1-shot')}` === 'BS3|BS2|SHOT';
        });

        const zone3Path = path.join(OUTPUT_DIR, `video-zone-step2-zone3-${vp.name}.png`);
        await zonePage.screenshot({ path: zone3Path, fullPage: true });
        const zone3Stats = fs.statSync(zone3Path);
        results.push({
            name: 'video-zone-step2-zone3',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-zone-step2-zone3-${vp.name}.png`,
            bytes: zone3Stats.size
        });

        const shotPath = path.join(OUTPUT_DIR, `video-zone-step3-shot-${vp.name}.png`);
        await zonePage.screenshot({ path: shotPath, fullPage: true });
        const shotStats = fs.statSync(shotPath);
        results.push({
            name: 'video-zone-step3-shot',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `video-zone-step3-shot-${vp.name}.png`,
            bytes: shotStats.size
        });

        await zoneCtx.close();
    }
}

async function captureVideoUrlAttachmentSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const urlCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const urlPage = await urlCtx.newPage();

        await urlPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
        await urlPage.waitForSelector('#attach-video-btn');

        await urlPage.click('#attach-video-btn');
        await urlPage.waitForSelector('#attach-video-modal:not(.hidden)');
        await urlPage.waitForSelector('#video-url-input');

        await urlPage.fill('#video-url-input', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
        await urlPage.waitForTimeout(300);

        const step1Path = path.join(OUTPUT_DIR, `video-url-step1-modal-${vp.name}.png`);
        await urlPage.screenshot({ path: step1Path, fullPage: true });

        await urlPage.click('#submit-attach-url-btn');
        await urlPage.waitForSelector('#attach-video-modal', { state: 'hidden' });
        await urlPage.waitForSelector('#video-stage-empty-overlay', { state: 'hidden' });
        await urlPage.waitForTimeout(500);

        const step2Path = path.join(OUTPUT_DIR, `video-url-step2-attached-${vp.name}.png`);
        await urlPage.screenshot({ path: step2Path, fullPage: true });

        await urlPage.goto(`${baseUrl}/timeline-video.html?game=sample-game`, { waitUntil: 'domcontentloaded' });
        await urlPage.waitForSelector('#video-stage-empty-overlay', { state: 'hidden' });
        await urlPage.waitForTimeout(500);

        const step3Path = path.join(OUTPUT_DIR, `video-url-step3-reload-${vp.name}.png`);
        await urlPage.screenshot({ path: step3Path, fullPage: true });

        await urlCtx.close();
    }
}

async function runSweepScopeAndDock(sweepPage, vp) {
    await sweepPage.waitForSelector('#label-sweep-btn');
    await sweepPage.waitForSelector('#timeline-events');

    await sweepPage.click('#label-sweep-btn');
    await sweepPage.waitForSelector('#sweep-scope-dialog:not(.hidden), dialog[open]');
    await sweepPage.waitForSelector('#sweep-scope-options button');
    await sweepPage.waitForTimeout(300);

    const sweepScopePath = path.join(OUTPUT_DIR, `timeline-video-sweep-scope-${vp.name}.png`);
    await sweepPage.screenshot({ path: sweepScopePath, fullPage: true });

    const firstScopeOption = await sweepPage.$('#sweep-scope-options button');
    await firstScopeOption?.click();
    await sweepPage.waitForSelector('#sweep-dock:not(.hidden)');
    await sweepPage.waitForSelector('.sweep-action-card');
    await sweepPage.waitForTimeout(300);

    const sweepModePath = path.join(OUTPUT_DIR, `timeline-video-sweep-${vp.name}.png`);
    await sweepPage.screenshot({ path: sweepModePath, fullPage: true });

    const firstCard = await sweepPage.$('.sweep-action-card');
    await firstCard?.click();
    await sweepPage.waitForTimeout(300);

    const exitBtn = await sweepPage.$('#dock-exit-sweep-btn');
    if (exitBtn && await exitBtn.isVisible()) {
        await exitBtn.click();
        await sweepPage.waitForTimeout(300);
    }
}

async function captureLabelSweepSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const sweepCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const sweepPage = await sweepCtx.newPage();

        await sweepPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
        await runSweepScopeAndDock(sweepPage, vp);

        const labelledPath = path.join(OUTPUT_DIR, `timeline-video-labelled-timeline-${vp.name}.png`);
        await sweepPage.screenshot({ path: labelledPath, fullPage: true });

        const unlabelledBtn = await sweepPage.$('#show-unlabelled');
        if (unlabelledBtn) await unlabelledBtn.click();
        await sweepPage.waitForTimeout(300);

        const unlabelledFilterPath = path.join(OUTPUT_DIR, `timeline-video-unlabelled-filter-${vp.name}.png`);
        await sweepPage.screenshot({ path: unlabelledFilterPath, fullPage: true });

        await sweepCtx.close();
    }
}

async function captureHelpJumpSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const helpContext = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const helpPage = await helpContext.newPage();

        await helpPage.goto(`${baseUrl}/#help`, { waitUntil: 'domcontentloaded' });
        await helpPage.waitForSelector('#help-jump-bar');
        await helpPage.waitForSelector('#help-view:not(.hidden)');
        await helpPage.waitForTimeout(300);

        const boardConfigJump = await helpPage.$('#help-jump-bar a[href*="help-configuration-title"]');
        await boardConfigJump?.click();
        await helpPage.waitForTimeout(1200);

        const isHelpStillVisible = await helpPage.$eval('#help-view', el => !el.classList.contains('hidden'));
        if (!isHelpStillVisible) throw new Error('Help view was navigated away after clicking Board Configuration jump link!');

        const jumpConfigPath = path.join(OUTPUT_DIR, `help-jump-configuration-${vp.name}.png`);
        await helpPage.screenshot({ path: jumpConfigPath, fullPage: false });

        const sweepJump = await helpPage.$('#help-jump-bar a[href*="help-sweep-metadata-title"]');
        await sweepJump?.click();
        await helpPage.waitForTimeout(1200);

        const jumpSweepPath = path.join(OUTPUT_DIR, `help-jump-sweep-${vp.name}.png`);
        await helpPage.screenshot({ path: jumpSweepPath, fullPage: false });

        const modesJump = await helpPage.$('#help-jump-bar a[href*="help-overview-heading"]');
        await modesJump?.click();
        await helpPage.waitForTimeout(1200);

        const jumpModesPath = path.join(OUTPUT_DIR, `help-jump-coding-modes-${vp.name}.png`);
        await helpPage.screenshot({ path: jumpModesPath, fullPage: false });

        await helpPage.goto(`${baseUrl}/#help-configuration-title`, { waitUntil: 'domcontentloaded' });
        await helpPage.waitForSelector('#help-view:not(.hidden)');
        await helpPage.waitForTimeout(1000);

        const directAnchorPath = path.join(OUTPUT_DIR, `help-direct-anchor-${vp.name}.png`);
        await helpPage.screenshot({ path: directAnchorPath, fullPage: false });

        await helpContext.close();
    }
}

async function captureBoardImportSnapshots(browser, baseUrl, results) {
    const sampleImportBoardPath = path.join(OUTPUT_DIR, 'sample-coach-board.json');
    const sampleImportData = {
        name: 'Under-16 Pressing',
        zones: { values: ['1', '2', '3', '4'], default: '1', perspective: 'mirrored' },
        rowDefs: [
            { team: null, grids: [{ gridCols: 'grid-cols-4', buttons: [{ event: 'A25E', text: 'A25E', lead: 5, lag: 3 }, { event: 'CE', text: 'CE', lead: 5, lag: 5 }, { event: 'SHOT', text: 'SHOT', lead: 5, lag: 5 }, { event: 'GOAL', text: 'GOAL', lead: 10, lag: 10 }] }] },
            { team: 1, grids: [{ gridCols: 'grid-cols-4', buttons: [{ event: 'HIGH PRESS', text: 'HIGH PRESS', lead: 10, lag: 10 }, { event: 'HALF COURT', text: 'HALF COURT', lead: 10, lag: 10 }, { event: 'TURNOVER FOR', lead: 5, lag: 10 }, { event: 'CIRCLE ENTRY', text: 'CIRCLE ENTRY', lead: 8, lag: 5 }] }] },
            { team: 2, grids: [{ gridCols: 'grid-cols-4', buttons: [{ event: 'HIGH PRESS', text: 'HIGH PRESS', lead: 10, lag: 10 }, { event: 'HALF COURT', text: 'HALF COURT', lead: 10, lag: 10 }, { event: 'TURNOVER AG', lead: 5, lag: 10 }, { event: 'CIRCLE ENTRY', text: 'CIRCLE ENTRY', lead: 8, lag: 5 }] }] }
        ]
    };
    fs.writeFileSync(sampleImportBoardPath, JSON.stringify(sampleImportData, null, 2), 'utf8');

    for (const vp of VIEWPORTS) {
        const importContext = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const importPage = await importContext.newPage();

        await importPage.goto(`${baseUrl}/#configure`, { waitUntil: 'domcontentloaded' });
        await importPage.waitForSelector('#importConfigButton');
        await importPage.waitForSelector('#boardFileInput', { state: 'attached' });

        await importPage.setInputFiles('#boardFileInput', sampleImportBoardPath);
        await importPage.waitForTimeout(500);

        const configImportPath = path.join(OUTPUT_DIR, `configure-imported-board-${vp.name}.png`);
        await importPage.screenshot({ path: configImportPath, fullPage: true });

        await importPage.goto(`${baseUrl}/#event-capture`, { waitUntil: 'domcontentloaded' });
        await importPage.waitForSelector('#boardSelect');
        await importPage.waitForTimeout(500);

        const captureImportPath = path.join(OUTPUT_DIR, `event-capture-imported-board-${vp.name}.png`);
        await importPage.screenshot({ path: captureImportPath, fullPage: true });

        await importContext.close();
    }
}

async function captureCompoundChordSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const chordContext = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const chordPage = await chordContext.newPage();

        await chordPage.goto(`${baseUrl}/#event-capture?mock=active`, { waitUntil: 'domcontentloaded' });
        await chordPage.waitForSelector('#coding-buttons-container button');

        await chordPage.waitForSelector('#pauseResumeButton');
        const pauseText = await chordPage.$eval('#pauseResumeButton', el => el.textContent);
        if (pauseText.includes('Resume') || pauseText.includes('Start Clock')) {
            await chordPage.click('#pauseResumeButton');
            await chordPage.waitForTimeout(200);
        }

        await chordPage.evaluate(() => {
            document.querySelectorAll('[role="status"], .toast, #notification-container, .notification').forEach(el => el.remove());
        });

        const ceBtn = await chordPage.waitForSelector('.event-button[data-event*="CE"], .event-button[data-base-event="CE"]');
        await ceBtn.click();
        await chordPage.waitForSelector('#chordThumbDock:not(.hidden)', { timeout: 5000 });
        await chordPage.waitForTimeout(200);

        const activeThumbPath = path.join(OUTPUT_DIR, `live-capture-chord-active-${vp.name}.png`);
        await chordPage.screenshot({ path: activeThumbPath, fullPage: false });

        const leftPill = await chordPage.waitForSelector('#chordPillsContainer [data-chord-key="1"]', { timeout: 3000 });
        await leftPill.click();
        await chordPage.waitForTimeout(300);

        const resolvedThumbPath = path.join(OUTPUT_DIR, `live-capture-chord-resolved-${vp.name}.png`);
        await chordPage.screenshot({ path: resolvedThumbPath, fullPage: false });

        await chordContext.close();
    }

    const videoChordCtx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2
    });
    const videoChordPage = await videoChordCtx.newPage();
    await videoChordPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mode=tag`, { waitUntil: 'domcontentloaded' });
    await videoChordPage.waitForSelector('#quick-tags-container button');

    await videoChordPage.keyboard.press('3');
    await videoChordPage.waitForSelector('#video-chord-dock:not(.hidden)');
    await videoChordPage.waitForTimeout(200);

    const videoActiveChordPath = path.join(OUTPUT_DIR, 'video-coding-chord-active-desktop.png');
    await videoChordPage.screenshot({ path: videoActiveChordPath, fullPage: false });

    await videoChordPage.keyboard.press('1');
    await videoChordPage.waitForTimeout(300);

    const videoResolvedChordPath = path.join(OUTPUT_DIR, 'video-coding-chord-resolved-desktop.png');
    await videoChordPage.screenshot({ path: videoResolvedChordPath, fullPage: false });

    await videoChordCtx.close();
}

async function captureVideoAlignmentSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const alignCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const alignPage = await alignCtx.newPage();
        await alignPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
        await alignPage.waitForSelector('#timeline-events .timeline-event');
        await alignPage.waitForTimeout(300);

        const cleanLogPath = path.join(OUTPUT_DIR, `timeline-events-clean-${vp.name}.png`);
        await alignPage.screenshot({ path: cleanLogPath, fullPage: false });
        results.push({
            name: 'timeline-events-clean',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `timeline-events-clean-${vp.name}.png`,
            bytes: fs.statSync(cleanLogPath).size
        });

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
}

async function capturePresentationSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const presCtx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const presPage = await presCtx.newPage();
        await presPage.goto(`${baseUrl}/timeline-video.html?game=sample-game&mock=sample`, { waitUntil: 'domcontentloaded' });
        await presPage.waitForSelector('#presentation-mode');
        await presPage.waitForSelector('#timeline-events');

        await presPage.click('#presentation-mode');
        await presPage.waitForSelector('#playlist-controls:not(.hidden)');
        await presPage.waitForTimeout(300);

        const presPath = path.join(OUTPUT_DIR, `presentation-mode-active-${vp.name}.png`);
        await presPage.screenshot({ path: presPath, fullPage: false });
        results.push({
            name: 'presentation-mode-active',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `presentation-mode-active-${vp.name}.png`,
            bytes: fs.statSync(presPath).size
        });

        await presCtx.close();
    }
}

async function captureSequenceSpikeSnapshots(browser, baseUrl, results) {
    for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}/spike/sequences/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#sequence-video-card, .entry-row', { timeout: 10000 });
        await page.waitForTimeout(300);

        const reportPath = path.join(OUTPUT_DIR, `sequence-spike-sample-${vp.name}.png`);
        await page.screenshot({ path: reportPath, fullPage: true });
        results.push({
            name: 'sequence-spike-sample',
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            file: `sequence-spike-sample-${vp.name}.png`,
            bytes: fs.statSync(reportPath).size
        });

        await context.close();
    }
}

async function captureDiffPreviewSnapshot(browser, baseUrl) {
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
}

async function runSnapshots() {
    const server = createStaticServer(SRC_DIR);

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
        await captureStandardScreens(browser, baseUrl, results);
        await captureTeamSetupSnapshots(browser, baseUrl, results);
        await captureDropdownSnapshots(browser, baseUrl, results);
        await captureContinueCodingSnapshots(browser, baseUrl, results);
        await captureAppendXmlSnapshots(browser, baseUrl, results);
        await captureVideoCodingInteractionSnapshots(browser, baseUrl, results);
        await snapshotNewVideoTeamDialog(browser, baseUrl, results);
        await captureZoneSuffixSnapshots(browser, baseUrl, results);
        await captureVideoUrlAttachmentSnapshots(browser, baseUrl, results);
        await captureLabelSweepSnapshots(browser, baseUrl, results);
        await captureHelpJumpSnapshots(browser, baseUrl, results);
        await captureBoardImportSnapshots(browser, baseUrl, results);
        await captureCompoundChordSnapshots(browser, baseUrl, results);
        await captureVideoAlignmentSnapshots(browser, baseUrl, results);
        await capturePresentationSnapshots(browser, baseUrl, results);
        await captureSequenceSpikeSnapshots(browser, baseUrl, results);
        await captureDiffPreviewSnapshot(browser, baseUrl);

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
