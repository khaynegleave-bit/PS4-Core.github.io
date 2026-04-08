/**
 * PS4 Core - Local Proxy Server
 * Run: node server.js
 * Then open the Network URL printed below in your browser.
 */

const http  = require('http');
const https = require('https');
const net   = require('net');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const os    = require('os');

const PORT = 8080;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
};

function getNetworkIPs() {
    const results = [];
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const n of iface) {
            if (n.family === 'IPv4' && !n.internal) results.push(n.address);
        }
    }
    return results;
}

function getLocalSubnets() {
    const subnets = [];
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const n of iface) {
            if (n.family === 'IPv4' && !n.internal) {
                const parts = n.address.split('.');
                subnets.push(parts.slice(0, 3).join('.'));
            }
        }
    }
    return subnets;
}

/** TCP probe — returns true if port is open within timeoutMs */
function probePort(ip, port, timeoutMs) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        let done = false;
        const settle = result => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(result);
        };
        const timer = setTimeout(() => settle(false), timeoutMs);
        socket.connect(port, ip, () => { clearTimeout(timer); settle(true); });
        socket.on('error', () => { clearTimeout(timer); settle(false); });
    });
}

/** Scan a /24 subnet for PS4 RPI on port 12800 */
async function scanSubnet(subnet, concurrency = 50, timeout = 500) {
    const ips = [];
    for (let i = 1; i <= 254; i++) ips.push(`${subnet}.${i}`);

    const found = [];
    for (let b = 0; b < ips.length; b += concurrency) {
        const batch = ips.slice(b, b + concurrency);
        const results = await Promise.all(
            batch.map(ip => probePort(ip, 12800, timeout).then(ok => ok ? ip : null))
        );
        results.forEach(ip => { if (ip) found.push(ip); });
    }
    return found;
}

/** Fetch a URL with automatic redirect following */
function fetchURL(targetUrl, method, reqHeaders, body, depth = 0) {
    return new Promise((resolve, reject) => {
        if (depth > 8) return reject(new Error('Too many redirects'));
        let parsed;
        try { parsed = new URL(targetUrl); } catch (e) { return reject(e); }
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   method || 'GET',
            headers:  { ...reqHeaders, host: parsed.hostname },
            timeout:  30000,
        };
        const req = lib.request(options, res => {
            const loc = res.headers.location;
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && loc) {
                res.resume();
                const nextUrl    = new URL(loc, targetUrl).toString();
                const nextMethod = [307, 308].includes(res.statusCode) ? method : 'GET';
                const nextBody   = [307, 308].includes(res.statusCode) ? body   : null;
                return fetchURL(nextUrl, nextMethod, reqHeaders, nextBody, depth + 1)
                    .then(resolve).catch(reject);
            }
            resolve({ statusCode: res.statusCode, headers: res.headers, stream: res });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        if (body) req.write(body);
        req.end();
    });
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
}

function forwardHeaders(proxyHeaders) {
    const skip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'proxy-connection']);
    const out = {};
    for (const [k, v] of Object.entries(proxyHeaders)) {
        if (!skip.has(k.toLowerCase())) out[k] = v;
    }
    out['access-control-allow-origin'] = '*';
    return out;
}

const server = http.createServer(async (req, res) => {
    const parsed   = url.parse(req.url, true);
    const pathname = parsed.pathname;

    setCORS(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // ── PS4 Network Scanner ──────────────────────────────────────────────────
    if (pathname === '/scan-ps4') {
        try {
            const subnets = getLocalSubnets();
            if (subnets.length === 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ found: [] }));
            }
            const allFound = [];
            for (const subnet of subnets) {
                const hits = await scanSubnet(subnet);
                hits.forEach(ip => { if (!allFound.includes(ip)) allFound.push(ip); });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ found: allFound }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ── PS4 Task Progress Proxy ──────────────────────────────────────────────
    if (pathname === '/ps4-tasks') {
        const ps4ip = parsed.query.ip;
        if (!ps4ip) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing ip parameter' }));
        }
        const taskUrl = `http://${ps4ip}:12800/api/tasks`;
        fetchURL(taskUrl, 'GET', { 'accept': 'application/json' }, null)
            .then(({ statusCode, headers, stream }) => {
                const chunks = [];
                stream.on('data', c => chunks.push(c));
                stream.on('end', () => {
                    const body = Buffer.concat(chunks).toString();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(body);
                });
            })
            .catch(err => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message, tasks: [] }));
            });
        return;
    }

    // ── PS4 Task Delete ──────────────────────────────────────────────────────
    if (pathname.startsWith('/ps4-task-delete/')) {
        const ps4ip  = parsed.query.ip;
        const taskId = pathname.split('/ps4-task-delete/')[1];
        if (!ps4ip || !taskId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing ip or task id' }));
        }
        fetchURL(`http://${ps4ip}:12800/api/tasks/${taskId}`, 'DELETE', {}, null)
            .then(({ statusCode }) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, statusCode }));
            })
            .catch(err => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            });
        return;
    }

    // ── Real-Debrid API proxy ────────────────────────────────────────────────
    if (pathname.startsWith('/rd-proxy')) {
        const rdPath = pathname.slice('/rd-proxy'.length) || '/';
        const rdURL  = `https://api.real-debrid.com/rest/1.0${rdPath}${parsed.search || ''}`;
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
            const body       = Buffer.concat(chunks);
            const fwdHeaders = {};
            if (req.headers['content-type'])  fwdHeaders['content-type']   = req.headers['content-type'];
            if (req.headers['authorization'])  fwdHeaders['authorization']  = req.headers['authorization'];
            if (body.length)                   fwdHeaders['content-length'] = body.length;
            fetchURL(rdURL, req.method, fwdHeaders, body.length ? body : null)
                .then(({ statusCode, headers, stream }) => {
                    res.writeHead(statusCode, forwardHeaders(headers));
                    stream.pipe(res);
                })
                .catch(err => {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
        });
        return;
    }

    // ── Package stream proxy (for PS4 downloads) ─────────────────────────────
    if (pathname === '/pkg-stream') {
        const pkgURL = parsed.query.url ? decodeURIComponent(parsed.query.url) : null;
        if (!pkgURL) { res.writeHead(400); return res.end('Missing url parameter'); }
        const fwdHeaders = {
            'user-agent': 'PS4Application libhttp/1.000 (PS4) libhttp/6.72 (PlayStation 4)',
            'accept':     '*/*',
        };
        if (req.headers['range']) fwdHeaders['range'] = req.headers['range'];
        const method = req.method === 'HEAD' ? 'HEAD' : 'GET';
        fetchURL(pkgURL, method, fwdHeaders, null)
            .then(({ statusCode, headers, stream }) => {
                res.writeHead(statusCode, forwardHeaders(headers));
                if (req.method !== 'HEAD') stream.pipe(res);
                else res.end();
            })
            .catch(err => { res.writeHead(502); res.end(err.message); });
        return;
    }

    // ── Static file server ───────────────────────────────────────────────────
    const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const filePath = path.join(__dirname, safePath);
    const ext      = path.extname(filePath).toLowerCase();
    const mime     = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found'); }
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const ips = getNetworkIPs();
    console.log('\n  ╔══════════════════════════════════════════╗');
    console.log('  ║       PS4 Core - Proxy Server            ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║  Local:   http://localhost:${PORT}          ║`);
    ips.forEach(ip => console.log(`  ║  Network: http://${ip.padEnd(15)}:${PORT}   ║`));
    console.log('  ╠══════════════════════════════════════════╣');
    console.log('  ║  Open the NETWORK URL in your browser.   ║');
    console.log('  ║  (Not localhost - PS4 must reach it too) ║');
    console.log('  ╚══════════════════════════════════════════╝\n');
});
