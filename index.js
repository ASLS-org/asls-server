const WS_PORT = 5214;
const UDP_PORT = 6454;

const DMXWebRTC = require("./DMXWebRTC.js");
DMXWebRTC.init(WS_PORT, UDP_PORT);