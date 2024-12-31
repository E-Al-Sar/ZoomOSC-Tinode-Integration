import WebSocket from 'ws';
import http from 'http';

const TINODE_URL = 'ws://localhost:6060/v0/channels';
const API_KEY = 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K';  // From your tinode.conf

// Test HTTP connection first
console.log("Testing HTTP connection...");
http.get('http://localhost:6060/', {
  headers: {
    'X-Tinode-APIKey': API_KEY
  }
}, (res) => {
  console.log('HTTP Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
    testWebSocket();
  });
}).on('error', (err) => {
  console.error('HTTP Error details:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  
  // Check if Docker containers are running
  console.log('\nChecking Docker containers status...');
  
  import('child_process').then(({ exec }) => {
    exec('docker ps', (error, stdout, stderr) => {
      if (error) {
        console.error('Error checking Docker:', error);
        return;
      }
      console.log('Running containers:\n', stdout);
      process.exit(1);
    });
  });
});

function testWebSocket() {
  console.log("\nTesting WebSocket connection...");
  
  const wsHeaders = {
    'X-Tinode-APIKey': API_KEY
  };
  
  const ws = new WebSocket(TINODE_URL, {
    headers: wsHeaders,
    handshakeTimeout: 5000,
    maxPayload: 50 * 1024 * 1024,
  });

  ws.on('open', () => {
    console.log('WebSocket connected successfully');
    
    const hiMessage = {
      "hi": {
        "id": "1",
        "ver": "0.22",
        "user-agent": "test-ws/1.0",
        "api-key": API_KEY
      }
    };
    
    ws.send(JSON.stringify(hiMessage));
  });

  ws.on('message', (data) => {
    console.log('Received raw:', data.toString());
    
    const msg = JSON.parse(data);
    
    // Handle server version response
    if (msg.ctrl && msg.ctrl.params && msg.ctrl.params.ver) {
      console.log('Server version:', msg.ctrl.params.ver);
      
      // Base64 encode the credentials
      const credentials = Buffer.from("alice:alice123").toString('base64');
      const loginMsg = {
        "login": {
          "id": "2",
          "scheme": "basic",
          "secret": credentials
        }
      };
      
      console.log('Sending login message:', loginMsg);
      ws.send(JSON.stringify(loginMsg));
    }
    // Handle login response
    else if (msg.ctrl && msg.ctrl.code === 200 && msg.ctrl.id === "2") {
      console.log('Login successful!', msg.ctrl);
      
      // Create a new group topic with proper initialization
      const newTopicMsg = {
        "sub": {
          "id": "3",
          "topic": "new",     // Tell Tinode to create a new group topic
          "set": {
            "desc": { 
              "public": { 
                "fn": "Test Group",
                "photo": { "data": null } 
              },
              "private": { "comment": "Test group for testing" }
            },
            "sub": {
              "mode": "JRWPASO"  // Join, Read, Write, Presence, Approve, Share, Owner
            },
            "tags": ["test", "demo"],
            "access": {
              "auth": "JRWPAS",  // Default access for authenticated users
              "anon": ""         // No access for anonymous users
            }
          }
        }
      };
      
      console.log('Creating new group topic:', newTopicMsg);
      ws.send(JSON.stringify(newTopicMsg));
    }
    // Handle subscription/topic creation response
    else if (msg.ctrl && msg.ctrl.code === 200 && msg.ctrl.id === "3") {
      console.log('Successfully created/subscribed to topic:', msg.ctrl.topic);
      
      // Send a test message to the new topic
      const pubMsg = {
        "pub": {
          "id": "4",
          "topic": msg.ctrl.topic,
          "content": "Hello from test client!"
        }
      };
      
      console.log('Sending test message:', pubMsg);
      ws.send(JSON.stringify(pubMsg));
    }
    // Handle published message response
    else if (msg.ctrl && msg.ctrl.id === "4") {
      if (msg.ctrl.code === 200 || msg.ctrl.code === 202) {
        console.log('Message published successfully');
      } else {
        console.error('Failed to publish message:', msg.ctrl);
      }
      // Close connection after successful test
      console.log('Test completed successfully');
      ws.close(1000, 'Test completed');
    }
    // Handle data messages
    else if (msg.data) {
      console.log('Received data message:', msg.data);
    }
    // Handle errors
    else if (msg.ctrl && msg.ctrl.code >= 400) {
      console.error('Server error:', msg.ctrl);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });
    // Try to reconnect on error
    setTimeout(testWebSocket, 5000);
  });

  ws.on('close', (code, reason) => {
    console.log('WebSocket closed:', {
      code: code,
      reason: reason ? reason.toString() : 'No reason provided'
    });
    // Try to reconnect on close if it wasn't intentional
    if (code !== 1000) {
      console.log('Attempting to reconnect in 5 seconds...');
      setTimeout(testWebSocket, 5000);
    }
  });
}