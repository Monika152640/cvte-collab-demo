// server.js
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// 加上心跳检测，防止连接被平台断开[citation:5]
wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(process.env.PORT || 1234, () => {
  console.log(`WebSocket server is running on port ${server.address().port}`);
});