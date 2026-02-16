const http = require('http');
const { parse } = require('url');

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

let nextApp = null;
let nextHandler = null;
let isReady = false;

const healthServer = http.createServer((req, res) => {
  const parsedUrl = parse(req.url, true);

  if (parsedUrl.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ready: isReady, timestamp: Date.now() }));
    return;
  }

  if (!isReady) {
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Starting up...</h2><meta http-equiv="refresh" content="3"></body></html>');
      return;
    }
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Service starting...');
    return;
  }

  nextHandler(req, res, parsedUrl);
});

healthServer.listen(PORT, HOSTNAME, () => {
  console.log(`> Health check server ready on http://${HOSTNAME}:${PORT}`);

  const next = require('next');
  nextApp = next({ dev: false, hostname: HOSTNAME, port: PORT });
  nextHandler = nextApp.getRequestHandler();

  nextApp.prepare().then(() => {
    isReady = true;
    console.log(`> Next.js ready on http://${HOSTNAME}:${PORT}`);
  }).catch((err) => {
    console.error('Failed to start Next.js:', err);
    process.exit(1);
  });
});
