#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
let PORT = parseInt(process.env.PORT, 10) || 3000;

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

function startServer(port) {
    const server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${port}`);
        let pathname = decodeURIComponent(parsedUrl.pathname);

        if (pathname === '/' || pathname === '') {
            pathname = '/index.html';
        }

        const filePath = path.join(SRC_DIR, pathname);

        if (!filePath.startsWith(SRC_DIR)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.statusCode = 404;
                res.end(`Not Found: ${pathname}`);
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
