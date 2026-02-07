require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const push = require('./push');

const PORT = process.env.PORT || 3000;

// Cleanup old messages every hour
setInterval(() => db.cleanupOldMessages(), 60 * 60 * 1000);
db.cleanupOldMessages();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function getBearerToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

function serveStaticFile(res, filePath, contentType) {
  const fullPath = path.join(__dirname, 'public', filePath);
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // Service worker must be served from root scope
    if (req.method === 'GET' && pathname === '/sw.js') {
      return serveStaticFile(res, 'sw.js', 'application/javascript');
    }

    // Redirect page
    if (req.method === 'GET' && pathname === '/redirect') {
      return serveStaticFile(res, 'redirect.html', 'text/html; charset=utf-8');
    }

    // Serve static files (favicon, images)
    if (req.method === 'GET' && (pathname === '/favicon.ico' || pathname.startsWith('/images/'))) {
      const mimeTypes = {
        '.ico': 'image/x-icon',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
      };
      const ext = path.extname(pathname);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      return serveStaticFile(res, pathname.slice(1), contentType);
    }

    // POST to root = send notification
    if (req.method === 'POST' && pathname === '/') {
      const token = getBearerToken(req);
      if (!token) {
        return sendJson(res, 401, { error: 'Authorization header with Bearer token required' });
      }

      const user = db.getUser(token);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      const body = await parseBody(req);
      const contentType = req.headers['content-type'] || '';
      let payload;

      if (contentType.includes('application/json')) {
        try {
          payload = JSON.parse(body);
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON' });
        }
      } else {
        // Plain text — wrap into JSON with "text" field
        payload = { text: body };
      }

      if (!payload.text) {
        return sendJson(res, 400, { error: 'Message must have a "text" field' });
      }

      db.addMessage(token, payload);

      const subscription = {
        endpoint: user.endpoint,
        keys: { p256dh: user.p256dh, auth: user.auth },
      };

      console.log(`Sending push notification to user ${token}`);
      try {
        await push.sendNotification(subscription, payload);
        console.log(`Push notification sent successfully to user ${token}`);
      } catch (err) {
        console.error(`Push notification failed for user ${token}:`, err.message);
        console.error('Error details:', err.statusCode, err.body);
        
        // If subscription is invalid/expired (410 Gone, or ENOTFOUND), clean up
        if (err.statusCode === 410 || err.message.includes('ENOTFOUND') || err.message.includes('permanently-removed')) {
          console.log(`Removing invalid subscription for user ${token}`);
          db.deleteUser(token);
        }
      }

      return sendJson(res, 200, { status: 'ok' });
    }

    // GET root = main page
    if (req.method === 'GET' && pathname === '/') {
      return serveStaticFile(res, 'index.html', 'text/html; charset=utf-8');
    }

    // Subscribe
    if (req.method === 'POST' && pathname === '/api/subscribe') {
      const body = await parseBody(req);
      let subscription;
      try {
        subscription = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      if (!subscription.endpoint || !subscription.keys) {
        return sendJson(res, 400, { error: 'Invalid push subscription' });
      }

      console.log('Registering subscription with endpoint:', subscription.endpoint);
      
      if (subscription.endpoint.includes('permanently-removed.invalid')) {
        console.error('Browser returned invalid endpoint - VAPID key mismatch or browser cache issue');
        return sendJson(res, 400, { error: 'Invalid subscription endpoint. Check VAPID keys or clear browser data.' });
      }

      const id = crypto.randomUUID();
      db.addUser(id, subscription);
      console.log('User registered with ID:', id);
      return sendJson(res, 201, { id });
    }

    // Unsubscribe
    if (req.method === 'POST' && pathname === '/api/unsubscribe') {
      const body = await parseBody(req);
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      if (!data.id) {
        return sendJson(res, 400, { error: 'Missing id' });
      }

      db.deleteUser(data.id);
      return sendJson(res, 200, { status: 'ok' });
    }

    // Get messages
    if (req.method === 'GET' && pathname === '/api/messages') {
      const token = getBearerToken(req);
      if (!token) {
        return sendJson(res, 401, { error: 'Authorization header with Bearer token required' });
      }

      const user = db.getUser(token);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      const messages = db.getMessages(token);
      db.deleteMessages(token);

      const parsed = messages.map((m) => ({
        id: m.id,
        payload: JSON.parse(m.payload),
        created_at: m.created_at,
      }));

      return sendJson(res, 200, parsed);
    }

    // VAPID public key endpoint
    if (req.method === 'GET' && pathname === '/api/vapid-public-key') {
      return sendJson(res, 200, { publicKey: push.publicKey });
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
