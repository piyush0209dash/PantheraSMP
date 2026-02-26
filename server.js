const http = require('http');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

// ==========================================
// 1. CLOUD HTTP SERVER (Required for Render)
// ==========================================
const server = http.createServer((req, res) => {
    // This gives Render a "Health Check" page so it doesn't shut the bot down
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Panthera Watcher Uplink is Online.');
});

// ==========================================
// 2. WEBSOCKET SERVER (Sends data to website)
// ==========================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('[SYSTEM] Website connected to the Kill Feed uplink!');
    ws.on('error', console.error);
});

function broadcastKill(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event: 'kill', text: message }));
        }
    });
}

// ==========================================
// 3. MINEFLAYER BOT (Watches Panthera SMP)
// ==========================================
function createBot() {
    console.log('[SYSTEM] Attempting to connect to Panthera SMP...');
    
    const bot = mineflayer.createBot({
        host: 'pantherasmp.falixsrv.me',
        port: 55635,
        username: 'PantheraWatcher',
        auth: 'offline', // Critical for servers that allow cracked/bedrock players
        version: false   // Auto-detects server version
    });

    bot.on('login', () => {
        console.log('[SUCCESS] PantheraWatcher has entered the server!');
    });

    bot.on('message', (jsonMsg, position) => {
        const rawText = jsonMsg.toString();
        
        // Filter out normal player chat (which usually starts with < or [)
        if ((position === 'system' || position === 'chat') && !rawText.startsWith('<') && !rawText.startsWith('[')) {
            
            // Keywords that usually mean someone died
            const deathKeywords = [' slain ', ' fell ', ' shot ', ' burned ', ' killed ', ' void ', ' blew up ', ' died ', ' magic ', ' starved '];
            const isDeathMessage = deathKeywords.some(keyword => rawText.includes(keyword));

            if (isDeathMessage) {
                console.log(`[BLOOD SHED] ${rawText}`);
                broadcastKill(rawText);
            }
        }
    });

    bot.on('end', (reason) => {
        console.log(`[DISCONNECTED] Reason: ${reason}`);
        console.log('[SYSTEM] Reconnecting in 5 seconds...');
        setTimeout(createBot, 5000); 
    });

    bot.on('error', (err) => {
        console.log(`[ERROR] ${err.message}`);
    });
}

// Start the bot
createBot();

// ==========================================
// 4. START THE CLOUD SERVER
// ==========================================
// Render automatically assigns a port using process.env.PORT
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[SYSTEM] Cloud server listening on port ${PORT}`);
});
