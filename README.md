# ASLS WSC Server

ASLS WSC Server is a Node.js application that bridges Web Show Control (WSC) DMX packets to various lighting protocols, with current support for Art-Net. It enables seamless communication between web-based lighting control interfaces and traditional DMX lighting systems.

```
      ___           ___           ___       ___      
     /  /\         /  /\         /  /\     /  /\     
    /  /::\       /  /::\       /  /:/    /  /::\    
   /  /:/\:\     /__/:/\:\     /  /:/    /__/:/\:\   
  /  /::\\ \:\   _\_ \:\ \:\   /  /:/    _\_ \:\ \:\  
 /__/:/\:\_\:\ /__/\ \:\ \:\ /__/:/    /__/\ \:\ \:\ 
 \__\/  \:\/:/ \  \:\ \:\_\/ \  \:\    \  \:\ \:\_\/ 
      \__\::/   \  \:\_\:\    \  \:\    \  \:\_\:\   
      /  /:/     \  \:\/::/     \  \:\    \  \:\/::/   
     /__/:/       \  \::/       \  \:\    \  \::/    
     \__\/         \__\/         \__\/     \__\/     
```

- [ASLS WSC Server](#asls-wsc-server)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Usage](#usage)
    - [Command Line Interface](#command-line-interface)
      - [CLI Options](#cli-options)
    - [Programmatic Usage](#programmatic-usage)
    - [Data Flow](#data-flow)
  - [Protocol Support](#protocol-support)
    - [Current Implementation](#current-implementation)
    - [Packet Structure](#packet-structure)
  - [License](#license)
  - [Contributing](#contributing)
  - [Acknowledgments](#acknowledgments)
  - [Support](#support)


## Features

- WebRTC-based DMX data transmission
- Art-Net protocol support
- Real-time packet conversion and forwarding
- Websocket signaling for connection establishment
- Broadcast capability for network-wide DMX distribution

## Prerequisites

- Node.js (v12.0.0 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ASLS-org/asls-server
cd asls-server
```

2. Install dependencies:
```bash
npm install
```

## Configuration

Default configuration:
- WebSocket signaling port: 5214
- Art-Net UDP port: 6454

These values can be modified when initializing the server.

## Usage

### Command Line Interface

The server can be started using the CLI with optional port configurations:

```bash
# Start with default ports
DMXWebRTC

# Configure WebSocket port
DMXWebRTC -w 5215

# Configure UDP port
DMXWebRTC -u 6455

# Configure both ports
DMXWebRTC -w 5215 -u 6455

# Show help
DMXWebRTC --help
```

#### CLI Options

```
Usage: DMXWebRTC -w <web_socket_port> -u <udp_port>

Options:
  -w, --websocket-port  Sets up port number of the web socket server instance
                        used for signaling
  -u, --udp-port        Port number of the ArtNET server from which data will
                        be intercepted and/or forwarded through WebRTC
  --help                Show help information
```

### Programmatic Usage

```javascript
const DMXWebRTC = require('./DMXWebRTC');

// Initialize with default ports
DMXWebRTC.init();

// Or initialize with custom ports
DMXWebRTC.init(wsPort, udpPort);
```

### Data Flow

1. Client connects via WebSocket for signaling
2. WebRTC data channel is established
3. DMX data is transmitted through the WebRTC channel
4. Server converts and forwards packets to Art-Net devices

## Protocol Support

### Current Implementation
- Art-Net (OpCode: 0x5000)
  - Universe: 0-32767
  - Channels: 512 per universe
  - Supports standard DMX512 data format

### Packet Structure

Art-Net DMX packet structure:
```
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|      'A'      |      'r'      |      't'      |      '-'      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|      'N'      |      'e'      |      't'      |     0x00      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   OpCode Lo   |   OpCode Hi   |  ProtVer Hi   |  ProtVer Lo   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   Sequence    |   Physical    |    SubUni     |     Net       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    Length Hi  |    Length Lo  |                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               |
|                                                               |
/                            DMX Data                           /
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

## License

This project is licensed under the GNU General Public License v3.0 - see the COPYING file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with Node.js
- Uses WebRTC for reliable data transmission
- Implements Art-Net protocol specifications

## Support

For issues and feature requests, please create an issue in the repository.
