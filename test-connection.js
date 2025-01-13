import mysql from 'mysql2/promise';
import WebSocket from 'ws';

const TINODE_URL = 'ws://localhost:6060/v0/channels';
const API_KEY = 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K';

async function testConnections() {
    // Test MySQL Connection
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'tinode',
            password: 'tinode',
            database: 'tinode'
        });
        console.log('MySQL Connection successful');
        await connection.end();
    } catch (err) {
        console.error('MySQL Connection failed:', err);
    }

    // Enhanced Tinode WebSocket test
    console.log("\nTesting Tinode WebSocket connection...");
    const ws = new WebSocket(TINODE_URL, {
        headers: {
            'X-Tinode-APIKey': API_KEY
        }
    });

    ws.on('open', () => {
        console.log('WebSocket connected successfully');
        
        // Send initial handshake
        const hiMessage = {
            "hi": {
                "id": "1",
                "ver": "0.22",
                "user-agent": "test-connection/1.0",
                "api-key": API_KEY
            }
        };
        
        ws.send(JSON.stringify(hiMessage));
    });

    ws.on('message', (data) => {
        console.log('Received:', data.toString());
        const msg = JSON.parse(data);
        
        // Handle server version response
        if (msg.ctrl && msg.ctrl.params && msg.ctrl.params.ver) {
            console.log('Server version:', msg.ctrl.params.ver);
            
            // Try to login with 'alice:alice123'
            const credentials = Buffer.from("alice:alice123").toString('base64');
            const loginMsg = {
                "login": {
                    "id": "2",
                    "scheme": "basic",
                    "secret": credentials
                }
            };
            
            console.log('Attempting login...');
            ws.send(JSON.stringify(loginMsg));
        }
        // Handle login response
        else if (msg.ctrl && msg.ctrl.code === 200 && msg.ctrl.id === "2") {
            console.log('Login successful!');
            ws.close(1000, 'Test completed');
        }
        // Handle errors
        else if (msg.ctrl && msg.ctrl.code >= 400) {
            console.error('Server error:', msg.ctrl);
            ws.close();
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', (code, reason) => {
        console.log('WebSocket connection closed:', {
            code: code,
            reason: reason ? reason.toString() : 'No reason provided'
        });
    });
}

testConnections(); 