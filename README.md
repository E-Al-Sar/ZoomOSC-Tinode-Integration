# Tinode-ZoomOSC Bridge

A bridge application that connects ZoomOSC events to a Tinode chat server, enabling real-time communication between Zoom meetings and Tinode chat.

## Current Status

The bridge currently supports:
- WebSocket connection to Tinode server
- OSC message handling for Zoom events
- Basic participant management (online/offline tracking)
- Chat message bridging
- Configurable UDP ports for OSC communication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure the application:
- Copy `config.json.example` to `config.json`
- Update the configuration with your Tinode server details and OSC settings

3. Start the bridge:
```bash
node index.js
```

## Configuration

The `config.json` file contains:
- Tinode server connection details
- OSC UDP port configurations
- Message mapping settings
- Logging preferences

## Message Mapping

See `MAPPING.md` for detailed documentation of how ZoomOSC events are mapped to Tinode messages.

## Next Steps

- [ ] Implement error recovery for lost connections
- [ ] Add support for direct messages
- [ ] Implement user pinning functionality
- [ ] Add message history synchronization
- [ ] Improve logging and monitoring
- [ ] Add unit tests

## Development Notes

The main components are:
1. `index.js` - Main bridge application
2. `config.json` - Configuration settings
3. `MAPPING.md` - Message mapping documentation

## Troubleshooting

1. Check `bridge.log` for detailed error messages
2. Ensure Tinode server is running and accessible
3. Verify OSC ports are correctly configured and not blocked 