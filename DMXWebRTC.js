'use strict'

const EventEmitter = require('events').EventEmitter
const Ws = require("ws")
const Dgram = require("dgram");
const {
  networkInterfaces
} = require("os");
const WebRTC = require("wrtc");

/**
 * Dgram socket options
 * 
 * @constant {Object} UDP_OPT
 * @global
 */
const UDP_OPT = {
  type: "udp4",
  reuseAddr: true,
}

/**
 * List of handled WabRTC messages
 * 
 * @constant {Object} WS_MSG_TYPES
 * @global
 */
const WS_MSG_TYPES = {
  WebRTC_OFFER: "__WRTC_OFR",
  OUTPUTS_LIST: "__OUTPUTS_LIST",
  OUTPUTS_SET: "__OUTPUTS__SET"
}

/**
 * List of ArtNet OPCODES
 * 
 * @constant {Object} ARTNET_OPCODES
 * @global
 */
const ARTNET_OPCODES = {
  //Device Discovery Packets
  OpPoll: 0x2000,
  OpPollReply: 0x2100,
  //Device Configuration Packets
  OpAddress: 0x6000,
  OpInput: 0x7000,
  OpIpProg: 0xF800,
  OpIpProgReply: 0xF900,
  OpCOmmand: 0x2400,
  //Streaming Control Packets
  OpDmx: 0x5000,
  OpNzs: 0x5100,
  OpSync: 0x5200,
  //RDM Packets
  OpTodRequest: 0x8000,
  OpTodData: 0x8100,
  OpTodControl: 0x8200,
  OpRdm: 0x8300,
  OpRdmSub: 0x8400,
  //Time-Keeping Packets
  OpTimeCode: 0x9700,
  OpTimeSync: 0x9800,
  //Triggering Packets
  OpTrigger: 9900,
  //Diagnostics Packets
  OpDiagData: 0x2300
}

/**
 * ArtNet protocol version
 * 
 * @constant {Object} ARTNET_PROTOCOL_VERSION
 * @global
 */
const ARTNET_PROTOCOL_VERSION = {
  HI: 0,
  LO: 14
}

/**
 * ArtDMX packet SubUni slot byte offset
 * 
 * @constant {Number} ARTNET_PACKET_UNIVERSE_LOW_OFFSET
 * @global
 */
const ARTNET_PACKET_UNIVERSE_LOW_OFFSET = 14;
/**
 * ArtDMX packet Net slot byte offset
 * 
 * @constant {Number} ARTNET_PACKET_UNIVERSE_HI_OFFSET
 * @global
 */
const ARTNET_PACKET_UNIVERSE_HI_OFFSET = 15;
/**
 * ArtDMX packet Data slot byte offset
 * 
 * @constant {Number} ARTNET_PACKET_UNIVERSE_HI_OFFSET
 * @global
 */
const ARTNET_PACKET_DATA_OFFSET = 18;

/**
 * DataChannel identifier to be incremented at each new DataChannel instanciation. 
 * 
 * @var {Number} channelId
 * @global
 */
var channelId = 0;

/**
 * ArtNet packet sequence to be incremented on each packet forwarding (limit to 255).
 * 
 * @var {Number} channelId
 * @global
 */
var sequence = 0;

/**
 * ArtNet Streaming packet model.
 * 
 * @class ArtNetStreamingPacket
 */
class ArtNetStreamingPacket {

  /**
   * ArtNetStreamingPacket contructructor
   * 
   * @constructs ArtNetStreamingPacket
   * @param {Object} data
   * @param {Number} data.opCode ArtNet packet packet opcode
   * @param {Number} data.universe ArtNet packet universe
   * @param {Array<Number>} data.data ArtNet packet data
   */
  constructor(data) {
    this._opCodeLo = 0;
    this._opCodeHi = 0;
    this._protVerHi = ARTNET_PROTOCOL_VERSION.HI;
    this._protVerLo = ARTNET_PROTOCOL_VERSION.LO;
    this._sequence = sequence++ % 255;
    this._physical = 0;
    this._subUni = 0;
    this._net = 0;
    this._lengthHi = 0;
    this._lengthLo = 0;
    this._data = [];

    this.id = "Art-Net";
    this.opCode = data.opCode;
    this.universe = data.universe;
    this.length = 0;
    this.data = data.data;
  }

  /**
   * ArtNet packet universe ID
   * 
   * @property {Number} universe
   */
  set universe(universe) {
    this._subUni = ArtNetStreamingPacket.getLo(universe);
    this._net = ArtNetStreamingPacket.getHi(universe);
  }

  /**
   * ArtNet packet universe opCode
   * 
   * @property {Number} opCode
   */
  set opCode(opCode) {
    this._opCodeLo = ArtNetStreamingPacket.getLo(opCode);
    this._opCodeHi = ArtNetStreamingPacket.getHi(opCode);
  }

  /**
   * ArtNet packet data
   * 
   * @property {Number} data
   */
  set data(data) {
    this._data = data;
    this._lengthLo = ArtNetStreamingPacket.getLo(data.length);
    this._lengthHi = ArtNetStreamingPacket.getHi(data.length);
  }

  /**
   * ArtNet packet data
   * 
   * @property {Number} final
   * @returns {Array<Number>} raw ArtNet packet
   */
  get final() {
    return [
      this.id.split('').map(c => c.charCodeAt(0)).concat(0x00),
      this._opCodeLo,
      this._opCodeHi,
      this._protVerHi,
      this._protVerLo,
      this._sequence,
      this._physical,
      this._subUni,
      this._net,
      this._lengthHi,
      this._lengthLo,
      this._data
    ].flat()
  }

  /**
   * ArtNet packet buffer
   * 
   * @property {Number} buffer
   * @returns {Array<Number>} bufferized ArtNet packet
   */
  get buffer() {
    return Buffer.from(this.final)
  }

  /**
   * Returns an integer's Low byte
   * 
   * @method getLo
   * @param {Number} bytes Integer to be parsed
   * @returns {Number} Value's Low byte
   */
  static getLo(bytes) {
    return bytes & 0xFF;
  }

  /**
   * Returns an integer's High byte
   * 
   * @method getLo
   * @param {Number} bytes Integer to be parsed
   * @returns {Number} Value's High byte
   */
  static getHi(bytes) {
    return (bytes >> 8) & 0xFF
  }

}

/**
 * ArtDMX Streaming packet model.
 * 
 * @class ArtDmxPacket
 * @extends ArtNetStreamingPacket
 */
class ArtDmxPacket extends ArtNetStreamingPacket {

  /**
   * ArtDmxPacket constructor
   * 
   * @constructs ArtDmxPacket
   * @param {Number} universe 
   * @param {Array<Number>} data 
   */
  constructor(universe, data) {
    super({
      opCode: ARTNET_OPCODES.OpDmx,
      universe: universe,
      data: data
    })
  }

}

/**
 * WebRTC Data channel overlayer
 * 
 * @class
 * @extends EventEmitter
 */
class DataChannel extends EventEmitter {


  /**
   * DataChannel constructor
   * 
   * @constructs DataChannel
   * @param {Object} handle handle to a WebRTC data channel object
   */
  constructor(handle) {
    super();
    this.id = channelId++;
    this.handle = handle;
    this.handle.addEventListener("message", this.handleMsg.bind(this));
    this.handle.addEventListener("close", this.handleClose.bind(this));
  }

  /**
   * Handle channel closure
   * 
   * @method handleClose
   * @public
   */
  handleClose() {
    this.emit("close", this.id);
  }

  /**
   * Handle channel message
   * 
   * @method handleMsg
   * @param {Object} data WebRTC sata channel message
   * @public
   */
  handleMsg(data) {
    this.emit("message", data);
  }

  /**
   * Send data over the channel
   * 
   * @method send
   * @param {String} data A stringified message
   * @public
   */
  send(data) {
    if (this.handle.readyState === 'open') {
      this.handle.send(data);
    }
  }

}

/**
 * DMXWebRTC model
 * 
 * @class
 * @singleton
 * @extends EventEmitter
 */
class DMXWebRTC {

  /**
   * Constructs DMXWebRTC
   * @constructs DMXWebRTC
   */
  constructor() {
    if (!DMXWebRTCInstance) {
      this.dataChannels = [];
      this.outputs = [];
      DMXWebRTCInstance = this;
    }
    return DMXWebRTCInstance;
  }

  /**
   * Print ASLS watermark
   * 
   * @method printWatermark
   * @public
   */
  printWatermark() {
    console.log(`      ___           ___           ___       ___      
     /  /\\         /  /\\         /  /\\     /  /\\     
    /  /::\\       /  /::\\       /  /:/    /  /::\\    
   /  /:/\\:\\     /__/:/\\:\\     /  /:/    /__/:/\\:\\   
  /  /::\\ \\:\\   _\\_ \\:\\ \\:\\   /  /:/    _\\_ \\:\\ \\:\\  
 /__/:/\\:\\_\\:\\ /__/\\ \\:\\ \\:\\ /__/:/    /__/\\ \\:\\ \\:\\ 
 \\__\\/  \\:\\/:/ \\  \\:\\ \\:\\_\\/ \\  \\:\\    \\  \\:\\ \\:\\_\\/ 
      \\__\\::/   \\  \\:\\_\\:\\    \\  \\:\\    \\  \\:\\_\\:\\   
      /  /:/     \\  \\:\\/:/     \\  \\:\\    \\  \\:\\/:/   
     /__/:/       \\  \\::/       \\  \\:\\    \\  \\::/    
     \\__\\/         \\__\\/         \\__\\/     \\__\\/     

`);
  }

  /**
   * Print GPL notice
   * 
   * @method printGPLNotice
   * @public
   */
  printGPLNotice() {
    console.log(`DMXWebRTC_Server Copyright (C) ${new Date().getFullYear()}  Timé Kadel.
This program comes with ABSOLUTELY NO WARRANTY;
This is free software, and you are welcome to redistribute it
under certain conditions;\n\n`)
  }

  /**
   * Initialise DMXWebRTC singleton instance
   * 
   * @method init
   * @public
   * @param {Number} wsPort websocket port over which signaling will be done
   * @param {Number} udpPort Artnet server port over which packet transactions will be made
   */
  init(wsPort = 5214, udpPort = 6454) {
    this.printWatermark();
    this.printGPLNotice();
    this.wsPort = wsPort;
    this.udpPort = udpPort;
    console.log('Initialising DMWXWebRTC Server Instance...')
    console.log(`Websocket signaling through port ${this.wsPort}`);
    console.log(`Intercepting and forwarding ArtDMX packets on port ${this.udpPort}\n`);
    this.wss = new Ws.Server({
      port: wsPort
    })
    this.artnetSocket = Dgram.createSocket(UDP_OPT);
    this.artnetSocket.bind(udpPort, undefined, () => {
      this.artnetSocket.setBroadcast(true)
    });
    this.prepareWSListeners();
  }

  /**
   * Prepares web socket listeners
   * 
   * @method prepareWSListeners
   * @public
   */
  prepareWSListeners() {
    this.wss.on('connection', (ws) => {
      ws.on("message", async (jsonMsg) => {
        let msg = JSON.parse(jsonMsg);
        switch (msg.type) {
          case WS_MSG_TYPES.WebRTC_OFFER:
            console.log(`Websocket offer from: ${ws._socket.remoteAddress}`);
            let localDescriptor = await this.bindWRTCDatachannel(msg.data);
            ws.send(JSON.stringify({
              type: WS_MSG_TYPES.WebRTC_OFFER,
              data: localDescriptor
            }));
            break;
          case WS_MSG_TYPES.OUTPUTS_LIST:
            ws.send(JSON.stringify({
              type: WS_MSG_TYPES.OUTPUTS_LIST,
              data: this.getOutputsData()
            }));
            break;
          case WS_MSG_TYPES.OUTPUTS_SET:
            this.outputs = msg.data.map(output => {
              return Object.assign(output, {
                broadcast: DMXWebRTC._getBroadcast(output.address, output.mask)
              })
            })
            break;
        }
      })
    })
  }

  /**
   * Fetches available network interfaces
   * 
   * @method getOutputsData
   * @public
   * @returns {Array<Object>} an array containing network interface definitions
   */
  getOutputsData() {
    let outputsRaw = networkInterfaces();
    return Object.keys(outputsRaw).map(outputName => {
      let output = outputsRaw[outputName]
      return output.flatMap(i => {
        return i.family == "IPv4" ? {
          name: outputName,
          cidr: i.cidr,
          address: i.address,
          mask: i.netmask
        } : []
      })
    }).flat()
  }

  /**
   * Handles client offer and prepares peer connection and data channel
   * 
   * @method bindWRTCDatachannel
   * @public
   * @param {String} sdp WebRTC Session Description Protocol
   */
  async bindWRTCDatachannel(sdp) {
    console.log(`Creating per connection`);
    const peer = new WebRTC.RTCPeerConnection();
    peer.ondatachannel = this.dataChannelHandler.bind(this);
    await peer.setRemoteDescription(new WebRTC.RTCSessionDescription(sdp));
    console.log(`Preparing answer`);
    await peer.setLocalDescription(await peer.createAnswer());
    console.log(`Waiting fo data channel..\n`);
    return peer.localDescription;
  }

  /**
   * Handles DAtaChannel instance creation and lifecycle
   * 
   * @method dataChannelHandler
   * @param {Object} channel WebRTC data channel instance
   * @public
   */
  dataChannelHandler({
    channel
  }) {
    console.log(`Creating new DMX data channel`);
    let dataChannel = new DataChannel(channel)
    this.dataChannels.push(dataChannel);
    dataChannel.on("message", this.forwardDMXData.bind(this))
    dataChannel.on("connect", () => {
      console.log("Data channel connected.")
    })
    dataChannel.on("close", (id) => {
      console.log(`Data channel closed`);
      let dcIndex = this.dataChannels.findIndex(dc => dc.id === id);
      if (dcIndex > 1) {
        this.dataChannels.splice(dcIndex, 1);
      }
    })
  }

  /**
   * Forwards ArtDMX packet to artnet to artnet server
   * 
   * @method forwardDMXData
   * @param {Object} data raw DMX universe data
   * @public
   */
  forwardDMXData({
    data
  }) {
    data = JSON.parse(data);
    let artnetPacket = new ArtDmxPacket(data.universe, data.DMX512Buffer);
    if (this.outputs.length) {
      this.outputs.forEach(o => {
        this.artnetSocket.send(artnetPacket.buffer, 0, artnetPacket.buffer.length, this.udpPort, o.broadcast)
      })
    }
  }

  /**
   * Parses ArtDMX packets incoming from artnet server
   * 
   * @method parseARTNetData
   * @public
   * @param {Buffer} artnetFrame ArtDMX packet
   * @return {Object} parsed DMX data
   */
  static parseARTNetData(artnetFrame) {
    var DMXData = artnetFrame.slice(ARTNET_PACKET_DATA_OFFSET);
    let lo_uni_byte = artnetFrame[ARTNET_PACKET_UNIVERSE_LOW_OFFSET];
    let hi_uni_byte = artnetFrame[ARTNET_PACKET_UNIVERSE_HI_OFFSET];
    let universe_id = ((hi_uni_byte << 8) + (lo_uni_byte & 0xFF))
    return {
      universe: universe_id,
      DMX512Buffer: DMXData
    }
  }

  /**
   * Computes broadcast address from cidr
   * 
   * @method _getBroadcastFromCidr
   * @static
   * @param {String} address ip address string
   * @param {String} netmask netmask string
   * @return {String} Interface's broadcast address
   */
  static _getBroadcast(address, netmask) {
    const ip = DMXWebRTC._IPToInt(address);
    const mask = DMXWebRTC._IPToInt(netmask);
    const min = (ip & mask) >>> 0;
    const max = (min | ~mask) >>> 0;
    return DMXWebRTC._intToIP(max);
  }

  /**
   * Converts ip address string to unsigned 32bit integer
   * 
   * @method _IPToInt
   * @static
   * @param {String} ipStr ip address string
   * @returns {Number} ip address converted to unsigned 32bit integer
   */
  static _IPToInt(ipStr) {
    console.log(ipStr)
    const chunks = ipStr.split(".");
    let ip = 0;
    chunks.forEach(chunk => {
      ip <<= 8;
      ip += parseInt(chunk);
    })
    return ip >>> 0;
  }

  /**
   * Converts unsigned 32bit integer to ip address string
   * 
   * @method _intToIP
   * @static
   * @param {Number} intVal unsigned 32bit integer
   * @return {String} unsigned 32bit integer ip address converted to string
   */
  static _intToIP(intVal) {
    let ip = []
    for (let i = 4; i > 0; i--) {
      ip.unshift((intVal & 0x000000FF) >>> 0)
      intVal = intVal >> 8
    }
    return ip.join(".")
  }

}
var DMXWebRTCInstance = new DMXWebRTC();
module.exports = DMXWebRTCInstance;