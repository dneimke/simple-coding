#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createStaticServer } from './lib/staticServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
let PORT = parseInt(process.env.PORT, 10) || 3000;

function startServer(port) {
    const server = createStaticServer(SRC_DIR);

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });

    server.listen(port, '127.0.0.1', () => {
        const origin = `http://localhost:${port}`;
        const matchesUrl = `${origin}/index.html#saved-games?mock=sample`;
        const liveUrl = `${origin}/index.html#event-capture?mock=active`;
        const reviewUrl = `${origin}/timeline-video.html?game=sample-game`;

        console.log(`\nLocal server running at ${origin}`);
        console.log(`Matches (sample): ${matchesUrl}`);
        console.log(`Live capture: ${liveUrl}`);
        console.log(`Match review: ${reviewUrl}\n`);

        openInBrowser(matchesUrl);
    });
}

function openInBrowser(url) {
    if (process.env.BROWSER === 'none') {
        return;
    }

    const command = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;

    exec(command, () => {});
}

startServer(PORT);
