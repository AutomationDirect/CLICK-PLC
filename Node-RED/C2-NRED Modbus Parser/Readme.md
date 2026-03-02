# CLICK PLC Modbus message to Node-RED (Modbus Parser)
This example project uses the TCP in node to recieve a message from the CLICK Send command.  Based on the data type sent in the "StartingSlave Address" field, it parses the raw Modbus message into an array of values.
This ladder example shows several "Send" commands which each send a range of address values to the TCP In node in a Node-RED flow.
<img src="ModbusLadder.png">

To Configure the Send Command in CLICK follow these steps:
<img src="Send%20config.png">
1. Enter the Node-RED server's IP address
2. Enter a Port number that the Node-RED server will listed to (make sure to open the port)
3. Ignore slave ID, it isn't used in this example
4. Pick a modbus function code to perform the send.
   --- 05 - Write single coil.  Use this if you are writing a single C, X or Y bit
   --- 06 - Write a single register.  Use this if you are writing an integer (DS), system code (SD), or a single charater (TXT)
   --- 15 - Write multiple coils.  Use this to write an array of 1's and 0's representing a range of C, X, or Y bits
   --- 16 - Write multiple registers.  Use this to write an array of numberic or char values.
5. Addressing type is easiest to select CLICK Addressing.  The Node-RED code will use this along with the Starting Slave Address to determine the data type to write.  All characters in Modbus are sent as a stream of Hex values.  When Node-RED recieves the stream, it must infer the intended target data type.
6. Starting Master Address should be the first address in a range that you want to send to Node-RED
7. Number of Bits/Addresses is the number of consecutive address values that you want to send to Node-RED
8. Leave Word Swap off, that logic is handled in Node-RED

The status flags are optional but can make debuggin in CLICK easier

Below is the corresponding example flow in Node-RED:
<img src="ModbusFlow.png">

The TCP node is always listening for a data stream into the specified port.  This port value must match the CLICK Send port number.  There are two Javascript function blocks:
1. Parse Modbus.  This function recieves the data stream from CLICK and converts it from Modbus back into an array of values
2. Modbus Response.  This function block replies to the CLICK to confirm the Modbus message was received.
3. The switch node looks at the packet data type and sends it back to CLICK.

See below for the full flow:
<pre lang=javascript>
[
    {
        "id": "21bd0383a84c91e3",
        "type": "tcp in",
        "z": "78e4b9f47921c876",
        "name": "",
        "server": "server",
        "host": "",
        "port": "5002",
        "datamode": "stream",
        "datatype": "buffer",
        "newline": "",
        "topic": "",
        "trim": false,
        "base64": false,
        "tls": "",
        "x": 100,
        "y": 300,
        "wires": [
            [
                "c3778d9c1ed82734",
                "9c55e19a6d60a612"
            ]
        ]
    },
    {
        "id": "11dea8f49e814aa8",
        "type": "tcp out",
        "z": "78e4b9f47921c876",
        "name": "",
        "host": "",
        "port": "",
        "beserver": "reply",
        "base64": false,
        "end": false,
        "tls": "",
        "x": 510,
        "y": 380,
        "wires": []
    },
    {
        "id": "c3778d9c1ed82734",
        "type": "function",
        "z": "78e4b9f47921c876",
        "name": "function 1",
        "func": "var hexvalue;\nvar mbusRange=[];\nvar i;\nvar slaverange;\nvar dtype;\n//https://www.modbustools.com/modbus.html#function15\n//https://www.fernhillsoftware.com/help/drivers/modbus/modbus-protocol.html\n//6: Single reg\n//5: Single coil\n//15: Multiple Coils\n//16: Multiple Registers\n\nslaverange=msg.payload[8]*256 + msg.payload[9];\n\nvar startpos;\nif(msg.payload[7]==6 || msg.payload[7]==5) startpos=10;\nif(msg.payload[7]==16 || msg.payload[7]==15) startpos=13;\n\n//DS-Single or multiple registers to array of Signed INT -32767 to 32767\nif((msg.payload[7]==6 || msg.payload[7]==16) && (slaverange>=0 && slaverange<=4499)){ \t//Message type 16\n    for (i = startpos; i < msg.payload.length; i += 2){\n        hexvalue=msg.payload[i]*256 + msg.payload[i+1];\n        if(hexvalue>32767)\n            hexvalue=hexvalue-65536;\n        mbusRange.push(hexvalue);\n        dtype=\"DS\";\n    }\n}\n//DD-Single or multiple registers to array of Double INT\nif((msg.payload[7]==6 || msg.payload[7]==16) && (slaverange>=16384 && slaverange<=18383)){ \t//Message type 16\n    for (i = startpos; i < msg.payload.length; i += 4){\n        hexvalue = msg.payload[i+2]*16777216 + msg.payload[i+3]*65536 + msg.payload[i]*256 + msg.payload[i+1];\n        if(hexvalue>2147483647)\n            hexvalue=hexvalue-4294967296;\n        mbusRange.push(hexvalue);\n        dtype=\"DD\";\n    }\n}\n//TXT-Single or Multiple registers to string\nif((msg.payload[7]==6 || msg.payload[7]==16) && (slaverange>=36864 && slaverange<=37363)){\n    for (i = startpos; i < msg.payload.length; i += 2){\n        hexvalue=msg.payload[i+1]; //charCode.toString(16);\n        mbusRange.push(String.fromCharCode(hexvalue));\n        hexvalue=msg.payload[i];\n        mbusRange.push(String.fromCharCode(hexvalue));\n        mbusRange=[mbusRange.join(\"\")];\n        dtype=\"TXT\";\n    }\n}\n//DF-Single or Multiple registers to Float wordswap=off\nif((msg.payload[7]==6 || msg.payload[7]==16) && (slaverange>=28672 && slaverange<=29670)){\n    for (i = startpos; i < msg.payload.length; i += 4){\n        var hex=(msg.payload[i+2].toString(16).length<2) ? \"0\"+msg.payload[i+2].toString(16) : msg.payload[i+2].toString(16);\n        hex+=(msg.payload[i+3].toString(16).length<2) ? \"0\"+msg.payload[i+3].toString(16) : msg.payload[i+3].toString(16);\n        hex+=(msg.payload[i].toString(16).length<2) ? \"0\"+msg.payload[i].toString(16) : msg.payload[i].toString(16);\n        hex+=(msg.payload[i+1].toString(16).length<2) ? \"0\"+msg.payload[i+1].toString(16) : msg.payload[i+1].toString(16);\n        const bytes = new Uint8Array(4)\n        for (let i = 0; i < 4; i++) {\n            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);\n        }\n        const view = new DataView(bytes.buffer);\n        mbusRange.push(view.getFloat32(0, false));\n        dtype=\"DF\";\n    }\n}\n\nif((msg.payload[7]==5 || msg.payload[7]==15) && (slaverange>=8192 && slaverange<=8463))\n    dtype=\"Y\";\nif((msg.payload[7]==5 || msg.payload[7]==15) && (slaverange>=16384 && slaverange<=18383))\n    dtype=\"C\";\n\n//C,Y-Single Coil to array of binary number\nif(msg.payload[7]==5) {\t\t\t//Message type 05\n    hexvalue=0;\t\t\t\t//default to 0\n    if(msg.payload[startpos]==255)\t\t//if bit is high, set to 1\n        hexvalue=1;\n    mbusRange.push(hexvalue);\n}\n//C,Y-Multiple Coils to array of binary numbers\nif(msg.payload[7]==15){ \t\t\t//Message type 15\n    mbusrange='';\n    for (i = startpos; i < msg.payload.length; i += 1){\n        hexvalue=msg.payload[i].toString(2).padStart(8, '0');\n        mbusrange=hexvalue+mbusrange;\n    }\n    mbusRange=mbusrange.split(\"\");\n    mbusRange=mbusRange.map(Number);\n    mbusRange.reverse();\n    var coilCount=msg.payload[10]*256 + msg.payload[11];\n    mbusRange=mbusRange.slice(0,coilCount);\n}\n\nmsg.payload=mbusRange;\nmsg.dataType=dtype;\nreturn msg;\n",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 300,
        "y": 300,
        "wires": [
            [
                "fb5920737825a4b7"
            ]
        ]
    },
    {
        "id": "82762fbb6bfe0a61",
        "type": "CLICK Write",
        "z": "78e4b9f47921c876",
        "name": "Write text (TXT)",
        "memorytype": "TXT",
        "memoryaddress": "21",
        "memorysize": "10",
        "wswap": "OFF",
        "showErrCode": 1,
        "showErrText": 1,
        "x": 720,
        "y": 220,
        "wires": [
            []
        ]
    },
    {
        "id": "fb5920737825a4b7",
        "type": "switch",
        "z": "78e4b9f47921c876",
        "name": "",
        "property": "dataType",
        "propertyType": "msg",
        "rules": [
            {
                "t": "eq",
                "v": "TXT",
                "vt": "str"
            },
            {
                "t": "eq",
                "v": "DS",
                "vt": "str"
            },
            {
                "t": "eq",
                "v": "DF",
                "vt": "str"
            },
            {
                "t": "eq",
                "v": "DD",
                "vt": "str"
            },
            {
                "t": "eq",
                "v": "C",
                "vt": "str"
            }
        ],
        "checkall": "true",
        "repair": false,
        "outputs": 5,
        "x": 510,
        "y": 300,
        "wires": [
            [
                "82762fbb6bfe0a61"
            ],
            [
                "6461f0a30f78996b"
            ],
            [
                "8998cf29f7536b38"
            ],
            [
                "fc7789398a3945cc"
            ],
            [
                "1c3cbcc1acd38ce7"
            ]
        ]
    },
    {
        "id": "6461f0a30f78996b",
        "type": "CLICK Write",
        "z": "78e4b9f47921c876",
        "name": "Write Int (DS)",
        "memorytype": "DS",
        "memoryaddress": "10",
        "memorysize": "5",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 720,
        "y": 260,
        "wires": [
            []
        ]
    },
    {
        "id": "8998cf29f7536b38",
        "type": "CLICK Write",
        "z": "78e4b9f47921c876",
        "name": "Write Float (DF)",
        "memorytype": "DF",
        "memoryaddress": "10",
        "memorysize": "7",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 720,
        "y": 300,
        "wires": [
            []
        ]
    },
    {
        "id": "fc7789398a3945cc",
        "type": "CLICK Write",
        "z": "78e4b9f47921c876",
        "name": "Write Double Int (DD)",
        "memorytype": "DD",
        "memoryaddress": "10",
        "memorysize": "5",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 740,
        "y": 340,
        "wires": [
            []
        ]
    },
    {
        "id": "1c3cbcc1acd38ce7",
        "type": "CLICK Write",
        "z": "78e4b9f47921c876",
        "name": "Write Bits (C)",
        "memorytype": "C",
        "memoryaddress": "10",
        "memorysize": "12",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 710,
        "y": 380,
        "wires": [
            []
        ]
    },
    {
        "id": "9c55e19a6d60a612",
        "type": "function",
        "z": "78e4b9f47921c876",
        "name": "function 2",
        "func": "if((msg.payload[7]==15) || (msg.payload[7]==16)){\n    msg.payload=msg.payload.slice(0,12);\n}\nreturn msg;",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 300,
        "y": 380,
        "wires": [
            [
                "11dea8f49e814aa8"
            ]
        ]
    }
]
</pre>
