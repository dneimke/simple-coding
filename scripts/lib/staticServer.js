import http from 'http';
import fs from 'fs';
import path from 'path';

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

const ROOT_PATHS = new Set(['', '/', '/dev/preview', '/dev/preview/']);

/**
 * Resolves request pathname to a secure relative file path.
 *
 * @param {string} rawPathname
 * @returns {string}
 */
function normalizePathname(rawPathname) {
    const pathname = decodeURIComponent(rawPathname);
    if (ROOT_PATHS.has(pathname)) return '/index.html';
    return pathname.startsWith('/dev/') ? pathname.slice(4) : pathname;
}

/**
 * Serves static files safely from a source directory.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} srcDir
 */
function serveStaticFile(req, res, srcDir) {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = normalizePathname(parsedUrl.pathname);
    const filePath = path.join(srcDir, pathname);

    if (!filePath.startsWith(srcDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
            sendFile(res, filePath);
            return;
        }
        if (!isDirectoryRequest(err, stats, pathname)) {
            sendMissing(res, pathname);
            return;
        }
        sendDirectoryIndex(res, path.join(filePath, 'index.html'), pathname);
    });
}

function isDirectoryRequest(err, stats, pathname) {
    return (!err && stats.isDirectory()) || (Boolean(err) && !path.extname(pathname));
}

function sendDirectoryIndex(res, indexPath, pathname) {
    fs.stat(indexPath, (indexErr, indexStats) => {
        if (indexErr || !indexStats.isFile()) {
            sendMissing(res, pathname);
            return;
        }
        sendFile(res, indexPath);
    });
}

function sendMissing(res, pathname) {
    res.statusCode = 404;
    res.end(`Not Found: ${pathname}`);
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
}

/**
 * Creates an HTTP server serving static files from srcDir.
 *
 * @param {string} srcDir
 * @returns {import('http').Server}
 */
export function createStaticServer(srcDir) {
    return http.createServer((req, res) => {
        serveStaticFile(req, res, srcDir);
    });
}
