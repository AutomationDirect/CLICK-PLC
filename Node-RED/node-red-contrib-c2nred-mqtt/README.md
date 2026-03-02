# node-red-contrib-c2nred-mqtt
MQTT Broker for CLICK C2-NRED Node-RED modules based on [node-red-contrib-aedes](https://github.com/martin-doyle/node-red-contrib-aedes) which is based on [Aedes](https://github.com/moscajs/aedes).

You can use the MQTT protocol in Node-RED without an external MQTT broker like Mosquitto.

![Node.js CI](https://github.com/martin-doyle/node-red-contrib-aedes/workflows/Node.js%20CI/badge.svg)
[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/standard/semistandard)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/898bf62b040a4d999b150487e9cc837b)](https://www.codacy.com/manual/martin-doyle/node-red-contrib-aedes?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=martin-doyle/node-red-contrib-aedes&amp;utm_campaign=Badge_Grade)
<!--
[![Dependency Status](https://david-dm.org/martin-doyle/node-red-contrib-aedes.svg)](https://david-dm.org/martin-doyle/node-red-contrib-aedes)
[![devDependency Status](https://david-dm.org/martin-doyle/node-red-contrib-aedes/dev-status.svg)](https://david-dm.org/martin-doyle/node-red-contrib-aedes#info=devDependencies)
-->
[![Open Source Love](https://badges.frapsoft.com/os/mit/mit.svg?v=102)](https://github.com/ellerbrock/open-source-badge/)
<!--
[![NPM version](https://img.shields.io/npm/v/node-red-contrib-aedes.svg?style=flat)](https://www.npmjs.com/node-red-contrib-aedes)
-->

## Background
This node was created because the node-red-contrib-aedes MQTT Broker had a dependency of a dependency that did not work for the C2-NRED module [node-red-contrib-aedes] (https://github.com/martin-doyle/node-red-contrib-aedes)
## Installation
You can install the node directly within the editor by using the [Palette Manager](https://nodered.org/docs/user-guide/editor/palette/manager).

## Flows
Just put this node on Node-RED and hit the deploy button. The MQTT Broker will run on your Node-RED instance.
![flows](./flows.png)

## Features
- Works with AutomationDirect.com CLICK C2-NRED module
- Standard TCP Support
- WebSocket Support via port or path
- SSL / TLS
- Message Persistence (In-memory, LevelDB or MongoDB)
 
For more information see ???.

## Server without public IP or behind firewall
If your server is behind a firewall or you cannot open any ports other than the standard http/https ports, the MQTT broker node can be accessible by public clients through a WebSocket path.

When your Node-RED server address is `https://yourserver/`, you can set the WebSocket to bind to, e.g., `"/ws/mqtt"` path, to have `wss://yourserver/ws/mqtt` WebSocket at port `443`.

You can also bind the WebSocket to the root `"/"` path and having `wss://yourserver/` WebSocket listening at port `443` (or `ws://yourserver/` at port `80`).
 
## License
 
 Licensed under [MIT](./LICENSE).
