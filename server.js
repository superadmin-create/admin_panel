const http = require('http');
const { parse } = require('url');

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOSTNAME = '0.0.0.0';

let nextHandler = null;
let isReady = false;

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url, true);

  if (parsedUrl.pathname === '/' && !isReady) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><p>Loading...</p><meta http-equiv="refresh" content="2"></body></html>');
    return;
  }

  if (!isReady) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    res.end('Starting...');
    return;
  }

  nextHandler(req, res, parsedUrl);
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`> Server listening on http://${HOSTNAME}:${PORT}`);

  const next = require('next');
  const app = next({ dev: false, hostname: HOSTNAME, port: PORT });
  nextHandler = app.getRequestHandler();

  app.prepare().then(() => {
    isReady = true;
    console.log(`> Next.js ready`);
  }).catch((err) => {
    console.error('Next.js failed to start:', err);
    process.exit(1);
  });
});
