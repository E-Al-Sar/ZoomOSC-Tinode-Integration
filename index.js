import "fake-indexeddb/auto";
import tinodeSdk from 'tinode-sdk';
const { Tinode } = tinodeSdk;
import WebSocket from 'ws';
import XMLHttpRequest from 'xhr2';
import winston from 'winston';
import pkg from 'osc';
const { UDPPort } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up global providers for Node.js environment
global.WebSocket = WebSocket;
global.XMLHttpRequest = XMLHttpRequest;

// Enable Console Ninja debugging
if (process.env.NODE_ENV === 'development') {
    try {
        const consoleNinja = await import('console-ninja');
        consoleNinja.init();
    } catch (err) {
        console.warn('Console Ninja initialization failed:', err);
        setupLogger();
    }
}

class ZoomTinodeBridge {
    constructor(config) {
        this.config = config;
        this.participants = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.currentTopic = null;
        
        // Try to load existing topic ID from config or create new one
        this.topicId = this.config.tinode.topic || ('grp' + Math.random().toString(36).substr(2, 9));
        
        // Load mapping configuration
        this.mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapping.json')));
        
        // Setup logger
        this.logger = winston.createLogger({
            level: this.config.logging.level,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, this.config.logging.file),
                    options: { flags: 'w' }  
                }),
                new winston.transports.Console()
            ]
        });

        // Set up loggers for pertinent and ignored commands
        this.ignoredLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, 'ignored_commands.log'),
                    options: { flags: 'w' }
                }),
                new winston.transports.Console()
            ]
        });

        this.permittedLogger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({
                    filename: path.join(__dirname, 'pertinent_commands.log'), 
                    options: { flags: 'w' }
                }),
                new winston.transports.Console()
            ]
        });

        // Spawn two CMD.exe windows for logging
        this.spawnLogWindows();

        // Initialize Tinode client
        this.setupTinodeClient();
        
        this.setupOSCServer();
        
        // Handle process termination
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    async cleanup() {
        console.log('Cleaning up...');
        this.stop();
        process.exit(0);
    }

    setupTinodeClient() {
        const wsHeaders = {
            'X-Tinode-APIKey': this.config.tinode.apiKey
        };

        this.ws = new WebSocket(this.config.tinode.host, {
            headers: wsHeaders,
            handshakeTimeout: 5000,
            maxPayload: 50 * 1024 * 1024,
        });

        this.ws.on('open', () => {
            this.logger.info('WebSocket connected successfully');
            
            // Wait for the connection to be fully established
            setTimeout(() => {
                const hiMessage = {
                    "hi": {
                        "id": "1",
                        "ver": "0.22",
                        "user-agent": "zoom-tinode-bridge/1.0",
                        "api-key": this.config.tinode.apiKey
                    }
                };
                
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(hiMessage));
                } else {
                    this.logger.error('WebSocket not ready to send hi message');
                }
            }, 1000);
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data);
            this.logger.debug('Received message from Tinode:', {
                type: msg.ctrl ? 'ctrl' : msg.data ? 'data' : msg.pres ? 'pres' : 'unknown',
                message: msg
            });

            // Handle server version response
            if (msg.ctrl && msg.ctrl.params && msg.ctrl.params.ver) {
                this.logger.info('Server version:', msg.ctrl.params.ver);
                
                // Base64 encode the credentials
                const credentials = Buffer.from(`${this.config.tinode.login}:${this.config.tinode.password}`).toString('base64');
                const loginMsg = {
                    "login": {
                        "id": "2",
                        "scheme": "basic",
                        "secret": credentials
                    }
                };
                
                this.logger.debug('Sending login message');
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(loginMsg));
                } else {
                    this.logger.error('WebSocket not ready to send login message');
                }
            }
            // Handle login response
            else if (msg.ctrl && msg.ctrl.code === 200 && msg.ctrl.id === "2") {
                this.logger.info('Login successful!', msg.ctrl);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.setupTinodeTopics();
            }
            // Handle topic creation response
            else if (msg.ctrl && msg.ctrl.code === 200 && msg.ctrl.topic) {
                this.logger.info('Topic created/updated:', msg.ctrl.topic);
                this.currentTopic = msg.ctrl.topic;
            }
            // Handle pub message responses
            else if (msg.ctrl && msg.ctrl.id && msg.ctrl.id.startsWith('msg')) {
                if (msg.ctrl.code === 200) {
                    this.logger.info('Message successfully delivered to Tinode', msg.ctrl);
                } else {
                    this.logger.error('Failed to deliver message to Tinode', {
                        error: msg.ctrl,
                        code: msg.ctrl.code,
                        text: msg.ctrl.text
                    });
                }
            }
            // Handle data messages
            else if (msg.data) {
                this.handleTinodeMessage(msg.data);
            }
            // Handle errors
            else if (msg.ctrl && msg.ctrl.code >= 400) {
                this.logger.error('Server error:', {
                    ctrl: msg.ctrl,
                    text: msg.ctrl.text,
                    code: msg.ctrl.code
                });
                if (msg.ctrl.text === "unknown request") {
                    this.logger.error('Malformed message payload');
                }
            }
        });

        this.ws.on('error', (error) => {
            this.logger.error('WebSocket error:', {
                error: error.message,
                stack: error.stack,
                type: error.type,
                code: error.code,
                isConnected: this.isConnected,
                wsState: this.ws ? this.ws.readyState : 'no websocket'
            });
            this.isConnected = false;
            
            // Try to reconnect on error
            if (this.reconnectAttempts < 5) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
                setTimeout(() => this.setupTinodeClient(), delay);
            } else {
                this.logger.error('Max reconnection attempts reached, giving up');
            }
        });

        this.ws.on('close', (code, reason) => {
            this.logger.warn('WebSocket closed:', {
                code: code,
                reason: reason ? reason.toString() : 'No reason provided',
                isConnected: this.isConnected,
                wsState: this.ws ? this.ws.readyState : 'no websocket',
                currentTopic: this.currentTopic
            });
            this.isConnected = false;
            
            // Try to reconnect on close if it wasn't intentional
            if (code !== 1000) {
                if (this.reconnectAttempts < 5) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                    this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.setupTinodeClient(), delay);
                } else {
                    this.logger.error('Max reconnection attempts reached, giving up');
                }
            }
        });
    }

    async connectToTinode() {
        // The connection is now handled in setupTinodeClient
        return new Promise((resolve, reject) => {
            if (this.isConnected) {
                resolve();
            } else {
                this.setupTinodeClient();
                // Wait for connection
                const checkConnection = setInterval(() => {
                    if (this.isConnected) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkConnection);
                    reject(new Error('Connection timeout'));
                }, 10000);
            }
        });
    }

    async setupTinodeTopics() {
        try {
            // Try to attach to existing topic first
            const topicToUse = this.config.tinode.topic || this.topicId || ('grp' + Math.random().toString(36).substr(2, 9));
            
            const attachMsg = {
                "sub": {
                    "id": "3",
                    "topic": topicToUse,
                    "get": {
                        "what": "desc sub data del"
                    }
                }
            };

            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(attachMsg));
                this.logger.info(`Attempting to attach to topic ${topicToUse}`);
            }

            // Wait for attach response
            try {
                await new Promise((resolve, reject) => {
                    const handler = (data) => {
                        const msg = JSON.parse(data);
                        if (msg.ctrl && msg.ctrl.id === "3") {
                            this.ws.removeListener('message', handler);
                            if (msg.ctrl.code === 200) {
                                this.currentTopic = topicToUse;
                                this.topicId = topicToUse;
                                resolve();
                            } else if (msg.ctrl.code === 404) {
                                // Topic doesn't exist, we'll create it
                                reject(new Error('Topic not found'));
                            } else {
                                reject(new Error(`Failed to attach to topic: ${msg.ctrl.text}`));
                            }
                        }
                    };
                    this.ws.on('message', handler);
                    // Timeout after 5 seconds
                    setTimeout(() => reject(new Error('Attach timeout')), 5000);
                });
                return; // Successfully attached, no need to create new topic
            } catch (err) {
                if (err.message !== 'Topic not found') {
                    this.logger.error('Failed to attach to topic:', err);
                    throw err;
                }
                this.logger.info('Topic not found, creating new topic...');
            }

            // Create new topic with the specified name
            const subMsg = {
                "sub": {
                    "id": "4",
                    "topic": "new",
                    "name": topicToUse,
                    "set": {
                        "desc": {
                            "public": { 
                                "fn": "Zoom Meeting Chat",
                                "photo": { "data": null } 
                            },
                            "private": { "comment": "Bridge for Zoom meeting chat" }
                        },
                        "sub": {
                            "mode": "JRWPASO"
                        },
                        "tags": ["zoom", "bridge"],
                        "access": {
                            "auth": "JRWPAS",
                            "anon": ""
                        }
                    }
                }
            };
            
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(subMsg));
                this.logger.info('Creating new topic...');
            }

            // Wait for topic creation response
            await new Promise((resolve, reject) => {
                const handler = (data) => {
                    const msg = JSON.parse(data);
                    if (msg.ctrl && msg.ctrl.id === "4") {
                        this.ws.removeListener('message', handler);
                        if (msg.ctrl.code === 200) {
                            this.currentTopic = msg.ctrl.topic || topicToUse;
                            this.topicId = msg.ctrl.topic || topicToUse;
                            resolve();
                        } else {
                            reject(new Error(`Failed to create topic: ${msg.ctrl.text}`));
                        }
                    }
                };
                this.ws.on('message', handler);
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Create topic timeout')), 5000);
            });

            // Now attach to the newly created topic
            const reattachMsg = {
                "sub": {
                    "id": "5",
                    "topic": this.currentTopic,
                    "get": {
                        "what": "desc sub data del"
                    }
                }
            };

            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(reattachMsg));
                this.logger.info(`Attaching to newly created topic ${this.currentTopic}`);
                
                // Wait for reattach response
                await new Promise((resolve, reject) => {
                    const handler = (data) => {
                        const msg = JSON.parse(data);
                        if (msg.ctrl && msg.ctrl.id === "5") {
                            this.ws.removeListener('message', handler);
                            if (msg.ctrl.code === 200 || msg.ctrl.code === 304) {
                                // 304 means already subscribed, which is fine
                                this.logger.info(`Successfully attached to topic ${this.currentTopic}`);
                                resolve();
                            } else {
                                reject(new Error(`Failed to attach to new topic: ${msg.ctrl.text}`));
                            }
                        }
                    };
                    this.ws.on('message', handler);
                    // Timeout after 5 seconds
                    setTimeout(() => reject(new Error('Reattach timeout')), 5000);
                });
            }
            
        } catch (err) {
            this.logger.error('Failed to setup Tinode topics:', err);
            throw err;
        }
    }

    handleTinodeMessage(data) {
        this.logger.info('Received Tinode message:', {
            topic: data.topic,
            currentTopic: this.currentTopic,
            hasContent: !!data.content,
            timestamp: new Date().toISOString()
        });
        
        // Only process messages in our bridge topic
        if (data.topic !== this.currentTopic) {
            this.logger.debug('Ignoring message from different topic', {
                messageTopic: data.topic,
                expectedTopic: this.currentTopic
            });
            return;
        }

        // Handle incoming messages
        if (data.content) {
            const { text, fmt } = data.content;
            const head = data.head || {};
            const { from, userName, zoomId, messageType, replyTo } = head;

            this.logger.info('Processing Tinode message:', {
                from,
                userName,
                zoomId,
                messageType,
                hasReplyTo: !!replyTo,
                text: text.substring(0, 100), // Log first 100 chars only
                timestamp: new Date().toISOString()
            });

            // Skip messages that originated from Zoom (to avoid loops)
            if (messageType === 'chat' && zoomId) {
                this.logger.debug('Skipping Zoom-originated message', {
                    messageType,
                    zoomId
                });
                return;
            }

            // Format message for Zoom
            let zoomMessage = text;
            
            // If this is a reply to a Zoom user, format it appropriately
            if (replyTo && replyTo.startsWith('zoom')) {
                const replyToZoomId = replyTo.replace('zoom', '');
                const replyToParticipant = this.participants.get(parseInt(replyToZoomId));
                if (replyToParticipant) {
                    zoomMessage = `@${replyToParticipant.name} ${zoomMessage}`;
                    this.logger.debug('Formatted reply message', {
                        originalText: text,
                        formattedMessage: zoomMessage,
                        replyToUser: replyToParticipant.name
                    });
                }
            }

            // Find the sender's name (if it's a Zoom user)
            let senderName = "Tinode User";
            if (from && from.startsWith('zoom')) {
                const senderZoomId = from.replace('zoom', '');
                const sender = this.participants.get(parseInt(senderZoomId));
                if (sender) {
                    senderName = sender.name;
                }
            }

            // Send formatted message to ZoomOSC
            try {
                this.sendOSCMessage('/zoom/chatAll', [
                    `${senderName}: ${zoomMessage}`
                ]);
                this.logger.info('Successfully sent message to ZoomOSC', {
                    senderName,
                    message: zoomMessage.substring(0, 100), // Log first 100 chars only
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                this.logger.error('Failed to send message to ZoomOSC', {
                    error: err.message,
                    stack: err.stack,
                    senderName,
                    message: zoomMessage,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    stop() {
        console.log('Stopping bridge...');
        if (this.ws) {
            this.ws.close(1000, 'Stopping bridge');
        }
        if (this.udpPort) {
            this.udpPort.close();
        }
        this.isConnected = false;
    }

    onTinodeConnect(code, text, params) {
        this.logger.info(`Connected to Tinode: ${code} ${text}`, params);
        this.isConnected = true;
        this.reconnectAttempts = 0;
    }

    setupOSCServer() {
        const { listenPort, listenHost } = this.config.osc.udp;

        this.udpPort = new UDPPort({
            localAddress: listenHost,
            localPort: listenPort
        });

        this.udpPort.on('error', (err) => {
            console.error(`OSC Server error: ${err}`);
            // Attempt to reconnect OSC server after error
            setTimeout(() => {
                console.log('Attempting to reconnect OSC server...');
                this.udpPort.open();
            }, 5000);
        });

        this.udpPort.on('message', (oscMsg) => {
            this.handleOSCMessage(oscMsg);
        });

        this.udpPort.on('ready', () => {
            console.log(`OSC Server is listening on ${listenHost}:${listenPort}`);
        });

        this.udpPort.open();
    }

    spawnLogWindows() {
        const platform = process.platform;
        const logFile1 = path.join(__dirname, 'bridge.log');
        const logFile2 = path.join(__dirname, 'ignored_commands.log');

        // Ensure log directory exists
        const logDir = path.dirname(logFile1);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        if (platform === 'win32') {
            spawn('powershell.exe', ['-Command', `Start-Process PowerShell.exe -ArgumentList '-NoExit', '-Command', 'Get-Content -Path "${logFile1}" -Wait'`]);
            spawn('powershell.exe', ['-Command', `Start-Process PowerShell.exe -ArgumentList '-NoExit', '-Command', 'Get-Content -Path "${logFile2}" -Wait'`]);
        } else if (platform === 'darwin' || platform === 'linux') {
            spawn('osascript', ['-e', `tell application "Terminal" to do script "tail -f ${logFile1}"`]);
            spawn('osascript', ['-e', `tell application "Terminal" to do script "tail -f ${logFile2}"`]);
        } else {
            this.logger.warn(`Unsupported platform for spawning log windows: ${platform}`);
        }
    }

    handleOSCMessage(oscMsg) {
        const { address } = oscMsg;

        // Check if the command is in the ignored list
        const ignoredCommands = [
            '/zoomosc/user/mute',
            '/zoomosc/user/audioStatus',
            '/zoomosc/user/videoOn',
            '/zoomosc/user/videoOff',
            '/zoomosc/user/list'
        ];

        if (ignoredCommands.includes(address)) {
            this.ignoredLogger.info(`Ignored OSC message: ${this.formatMessage(oscMsg)}`);
            return; // Skip processing for ignored commands
        }

        // Log pertinent commands
        this.permittedLogger.info(`Processing OSC message: ${this.formatMessage(oscMsg)}`);

        // Find matching mapping for this OSC address
        let handler = null;
        let mapping = null;

        // Search through all categories in mapping
        for (const category of Object.values(this.mapping)) {
            for (const [action, config] of Object.entries(category)) {
                if (config.zoomOSC.address === address) {
                    handler = this[`handle${action.charAt(0).toUpperCase() + action.slice(1)}`];
                    mapping = config;
                    break;
                }
            }
            if (handler) break;
        }

        if (handler && mapping) {
            // Create params object from args based on mapping
            const params = {};
            mapping.zoomOSC.params.forEach((param, index) => {
                params[param] = oscMsg.args[index];
            });

            // Call the handler with the params
            handler.call(this, params, mapping.tinode);
        } else {
            this.logger.debug('Unhandled OSC message address:', address);
        }
    }

    // Custom function to format messages
    formatMessage(msg) {
        return JSON.stringify(msg, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value, null, 2); // Pretty print nested objects
            }
            return value;
        }, 2); // Indent the top-level object
    }

    // Participant Management Handlers
    handleQueryParticipants(params, tinodeConfig) {
        // Implementation for querying participants
        this.logger.debug('Querying participants');
        // TODO: Implement participant query logic
    }

    handleUserOnline(params, tinodeConfig) {
        const { userName, zoomId } = params;
        this.logger.debug(`User online: ${userName} (${zoomId})`);
        
        const tinodeUserId = `zoom${zoomId}`;
        
        this.participants.set(zoomId, {
            name: userName, 
            tinodeId: tinodeUserId,
            joinTime: Date.now()
        });

        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            const accMsg = {
                "acc": {
                    "id": "acc" + Date.now(),
                    "user": tinodeUserId,
                    "scheme": "basic",
                    "secret": tinodeUserId,
                    "login": true,
                    "desc": {
                        "public": {
                            "fn": userName,
                            "org": "Zoom Participant"
                        },
                        "private": {
                            "zoomId": zoomId
                        }
                    }
                }
            };
            this.ws.send(JSON.stringify(accMsg));
            
            // Subscribe user to the main topic after account creation
            const subMsg = {
                "sub": {
                    "id": "sub" + Date.now(),
                    "topic": this.currentTopic,
                    "get": {
                        "what": "sub desc data del"
                    }
                }
            };
            this.ws.send(JSON.stringify(subMsg));
        }
    }

    handleUserOffline(params, tinodeConfig) {
        const { userName, zoomId } = params;
        this.logger.debug(`User offline: ${userName} (${zoomId})`);
        
        this.participants.delete(zoomId);

        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            const accMsg = {
                "acc": {
                    "id": "acc" + Date.now(),
                    "user": `zoom${zoomId}`,
                    "status": "deleted"
                }
            };
            this.ws.send(JSON.stringify(accMsg));
        }
    }

    handleChatUser(params, tinodeConfig) {
        const { userName, zoomId, message, messageId } = params;
        
        // Enhanced logging for incoming message
        this.logger.info('Received chat message from ZoomOSC:', {
            userName,
            zoomId,
            message,
            messageId,
            timestamp: new Date().toISOString()
        });

        // Get the Tinode user ID for this Zoom participant
        const participant = this.participants.get(zoomId);
        if (!participant) {
            this.logger.error(`Unknown participant ${zoomId} trying to send message`, {
                currentParticipants: Array.from(this.participants.entries()),
                message: message,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Log connection state
        this.logger.info('Connection state:', {
            isConnected: this.isConnected,
            currentTopic: this.currentTopic,
            wsReadyState: this.ws ? this.ws.readyState : 'no websocket',
            timestamp: new Date().toISOString()
        });

        // Forward to Tinode with proper formatting
        if (this.isConnected && this.currentTopic && this.ws.readyState === WebSocket.OPEN) {
            const pubMsg = {
                "pub": {
                    "id": messageId || `msg${Date.now()}`,
                    "topic": this.currentTopic,
                    "head": {
                        "from": participant.tinodeId,
                        "userName": userName,
                        "zoomId": zoomId.toString(),
                        "messageType": "chat"
                    },
                    "content": {
                        "fmt": [
                            {
                                "at": 0,
                                "len": message.length,
                                "tp": "ZM"
                            }
                        ],
                        "text": message
                    }
                }
            };

            try {
                this.ws.send(JSON.stringify(pubMsg));
                this.logger.info('Successfully sent message to Tinode', {
                    messageId: pubMsg.pub.id,
                    topic: this.currentTopic,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                this.logger.error('Failed to send message to Tinode', {
                    error: err.message,
                    stack: err.stack,
                    pubMsg,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            this.logger.error('Cannot send message - connection state invalid', {
                isConnected: this.isConnected,
                currentTopic: this.currentTopic,
                wsReadyState: this.ws ? this.ws.readyState : 'no websocket',
                timestamp: new Date().toISOString()
            });
        }
    }

    handleChatAll(params, tinodeConfig) {
        const { message } = params;
        this.logger.debug(`Broadcast message: ${message}`);

        // Forward to Tinode
        if (this.isConnected && this.currentTopic && this.ws.readyState === WebSocket.OPEN) {
            const pubMsg = {
                ...tinodeConfig.message,
                pub: {
                    ...tinodeConfig.message.pub,
                    content: message
                }
            };
            this.ws.send(JSON.stringify(pubMsg));
        }
    }

    handleUserList(params, tinodeConfig) {
        const { userName, zoomId, audioStatus, videoStatus, handRaised, isHost } = params;
        this.logger.debug(`User list entry: ${userName} (${zoomId})`);
        
        // Track participant with extended info
        this.participants.set(zoomId, {
            name: userName,
            joinTime: Date.now(),
            status: {
                audioStatus,
                videoStatus,
                handRaised,
                isHost
            }
        });

        // Provision user in Tinode if needed
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            const accMsg = {
                ...tinodeConfig.message,
                acc: {
                    ...tinodeConfig.message.acc,
                    user: userName,
                    desc: {
                        status: {
                            audioStatus,
                            videoStatus,
                            handRaised,
                            isHost
                        }
                    }
                }
            };
            this.ws.send(JSON.stringify(accMsg));
        }
    }

    start() {
        this.logger.info('Starting Zoom-Tinode bridge...');
        return this.connectToTinode().catch(err => {
            this.logger.error('Failed to connect to Tinode:', err);
            throw err;
        });
    }

    sendOSCMessage(address, args) {
        if (this.udpPort) {
            const { host, port } = this.config.osc.udp.outbound;
            this.udpPort.send({
                address: address,
                args: args
            }, host, port);
            this.logger.debug(`Sent OSC message to ${host}:${port}`, { address, args });
        }
    }
}

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));

// Create and start bridge
const bridge = new ZoomTinodeBridge(config);
bridge.start().catch(err => {
    console.error('Failed to start bridge:', err);
    process.exit(1);
}); 