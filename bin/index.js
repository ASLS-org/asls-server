#! /usr/bin/env node

const yargs = require("yargs");
const DMXWebRTC = require("../DMXWebRTC.js");

const DEFAULT_WS_PORT = 5214;
const DEFAULT_UDP_PORT = 6454;

const usage = "\nUsage: DMXWebRTC -w <web_socket_port> -u <udp_port>";
const options = yargs
  .usage(usage)
  .option("w", {
    alias: "websocket-port",
    describe: "Sets up port number of the web socket server instance used for signaling.",
    type: "number",
    demandOption: false
  })
  .option("u", {
    alias: "udp-port",
    describe: "Port number of the ArtNET server from which data will be intercepted and/or forwareded through WebRTC.",
    type: "number",
    demandOption: false
  })
  .help(true)
  .argv;

DMXWebRTC.init(yargs.argv.w || DEFAULT_WS_PORT, yargs.argv.u || DEFAULT_UDP_PORT);