This example uses the dashboard feature of NodeRED to turn on/off internal control relays.
<img src="CLICKControlRelayDashboard.png">

Here is how your NodeRED Dashboard will look:
<img src="CLICKControlRelayDashboard02.png">

See below for the full flow:
<pre lang=javascript>
[
    {
        "id": "383b2d2f52806bf7",
        "type": "tab",
        "label": "Control Relay Example",
        "disabled": false,
        "info": "",
        "env": []
    },
    {
        "id": "fa4fb8e00136e386",
        "type": "CLICK Write",
        "z": "383b2d2f52806bf7",
        "name": "Write C300",
        "memorytype": "C",
        "memoryaddress": "300",
        "memorysize": "1",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 450,
        "y": 100,
        "wires": [
            [
                "df63aa28eee03a3b"
            ]
        ]
    },
    {
        "id": "f0b496181c2539ce",
        "type": "ui_switch",
        "z": "383b2d2f52806bf7",
        "name": "",
        "label": "Switch C300",
        "tooltip": "",
        "group": "efd504cc315d6be5",
        "order": 1,
        "width": 0,
        "height": 0,
        "passthru": true,
        "decouple": "false",
        "topic": "C300",
        "topicType": "str",
        "style": "",
        "onvalue": "[1]",
        "onvalueType": "json",
        "onicon": "",
        "oncolor": "",
        "offvalue": "[0]",
        "offvalueType": "json",
        "officon": "",
        "offcolor": "",
        "animate": false,
        "className": "",
        "x": 140,
        "y": 100,
        "wires": [
            [
                "fa4fb8e00136e386",
                "ecf9ccc968bfafea"
            ]
        ]
    },
    {
        "id": "df63aa28eee03a3b",
        "type": "debug",
        "z": "383b2d2f52806bf7",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "",
        "statusType": "auto",
        "x": 670,
        "y": 100,
        "wires": []
    },
    {
        "id": "f18874e973d8d54c",
        "type": "CLICK Write",
        "z": "383b2d2f52806bf7",
        "name": "Write C301",
        "memorytype": "C",
        "memoryaddress": "301",
        "memorysize": "1",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 450,
        "y": 160,
        "wires": [
            []
        ]
    },
    {
        "id": "56c8f286bb29c450",
        "type": "ui_switch",
        "z": "383b2d2f52806bf7",
        "name": "",
        "label": "Switch C301",
        "tooltip": "",
        "group": "efd504cc315d6be5",
        "order": 2,
        "width": 0,
        "height": 0,
        "passthru": true,
        "decouple": "false",
        "topic": "C301",
        "topicType": "str",
        "style": "",
        "onvalue": "[1]",
        "onvalueType": "json",
        "onicon": "",
        "oncolor": "",
        "offvalue": "[0]",
        "offvalueType": "json",
        "officon": "",
        "offcolor": "",
        "animate": false,
        "className": "",
        "x": 140,
        "y": 160,
        "wires": [
            [
                "f18874e973d8d54c",
                "ecf9ccc968bfafea"
            ]
        ]
    },
    {
        "id": "bdbd83b160ac16fe",
        "type": "CLICK Write",
        "z": "383b2d2f52806bf7",
        "name": "Write C302",
        "memorytype": "C",
        "memoryaddress": "302",
        "memorysize": "1",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 450,
        "y": 220,
        "wires": [
            []
        ]
    },
    {
        "id": "f1b2b47bb8d75979",
        "type": "ui_switch",
        "z": "383b2d2f52806bf7",
        "name": "",
        "label": "Switch C302",
        "tooltip": "",
        "group": "efd504cc315d6be5",
        "order": 3,
        "width": 0,
        "height": 0,
        "passthru": true,
        "decouple": "false",
        "topic": "C302",
        "topicType": "str",
        "style": "",
        "onvalue": "[1]",
        "onvalueType": "json",
        "onicon": "",
        "oncolor": "",
        "offvalue": "[0]",
        "offvalueType": "json",
        "officon": "",
        "offcolor": "",
        "animate": false,
        "className": "",
        "x": 140,
        "y": 220,
        "wires": [
            [
                "bdbd83b160ac16fe",
                "ecf9ccc968bfafea"
            ]
        ]
    },
    {
        "id": "71abb2d0bffee820",
        "type": "CLICK Write",
        "z": "383b2d2f52806bf7",
        "name": "Write C303",
        "memorytype": "C",
        "memoryaddress": "303",
        "memorysize": "1",
        "wswap": "OFF",
        "showErrCode": 0,
        "showErrText": 0,
        "x": 450,
        "y": 280,
        "wires": [
            []
        ]
    },
    {
        "id": "8a6a45a0d5c8b2b9",
        "type": "ui_switch",
        "z": "383b2d2f52806bf7",
        "name": "",
        "label": "Switch C303",
        "tooltip": "",
        "group": "efd504cc315d6be5",
        "order": 4,
        "width": 0,
        "height": 0,
        "passthru": true,
        "decouple": "false",
        "topic": "C303",
        "topicType": "str",
        "style": "",
        "onvalue": "[1]",
        "onvalueType": "json",
        "onicon": "",
        "oncolor": "",
        "offvalue": "[0]",
        "offvalueType": "json",
        "officon": "",
        "offcolor": "",
        "animate": false,
        "className": "",
        "x": 140,
        "y": 280,
        "wires": [
            [
                "71abb2d0bffee820",
                "ecf9ccc968bfafea"
            ]
        ]
    },
    {
        "id": "578020d00c35a1fc",
        "type": "debug",
        "z": "383b2d2f52806bf7",
        "name": "Dashboard Log",
        "active": true,
        "tosidebar": false,
        "console": false,
        "tostatus": false,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "",
        "statusType": "auto",
        "x": 680,
        "y": 360,
        "wires": []
    },
    {
        "id": "ecf9ccc968bfafea",
        "type": "function",
        "z": "383b2d2f52806bf7",
        "name": "Save Events",
        "func": "\n// initialise the counter to 0 if it doesn't exist already\nvar dashboardLog = context.get('dashboardLog')|| [];\n\ndashboardLog.push(msg);\nif (dashboardLog.length > 10){\n    // Delete oldest message if > 10\n    dashboardLog.shift();\n    dashboardLog.length = 10;\n} \n\n\n// store the value back\ncontext.set('dashboardLog',dashboardLog);\n\n// make it part of the outgoing msg object\nmsg = {};\nmsg.payload = dashboardLog;\nreturn msg;\n",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 450,
        "y": 400,
        "wires": [
            [
                "578020d00c35a1fc",
                "c40702e610d7ca93"
            ]
        ]
    },
    {
        "id": "c40702e610d7ca93",
        "type": "ui_template",
        "z": "383b2d2f52806bf7",
        "group": "45c38846034c979c",
        "name": "Dashboard Event Log ",
        "order": 1,
        "width": 5,
        "height": 10,
        "format": "<ul>\n <li ng-repeat=\"x in msg.payload\">\n <font color=\"red\">{{x.topic}}</font>\n    <ul>\n        <li>{{x.payload}}</li>\n    </ul>\n </li>\n</ul>",
        "storeOutMessages": true,
        "fwdInMessages": true,
        "resendOnRefresh": false,
        "templateScope": "local",
        "className": "",
        "x": 700,
        "y": 420,
        "wires": [
            []
        ]
    },
    {
        "id": "2362c1df2755640f",
        "type": "comment",
        "z": "383b2d2f52806bf7",
        "name": "This example uses the Dashboard switch object to control the On and Off state of the CPU internal Control Relays C300 to C303.",
        "info": "This example uses the Dashboard switch opbject to control the On and Off state of the CPU internal Control Relays C300 to C303.",
        "x": 530,
        "y": 40,
        "wires": []
    },
    {
        "id": "27f9ab6d9236efd2",
        "type": "comment",
        "z": "383b2d2f52806bf7",
        "name": "Debug Troubleshoot",
        "info": "Helpful hint: Add a Debug node to see the values in the debug window when troublshooting. ",
        "x": 810,
        "y": 140,
        "wires": []
    },
    {
        "id": "f1fb063e1de1557b",
        "type": "comment",
        "z": "383b2d2f52806bf7",
        "name": "Open the Node-RED Dashboard and try it http://xxx.xxx.xxx.xxx:1880/ui/",
        "info": "Open the Node-RED Dashboard and try it. http://xxx.xxx.xxx.xxx:1880/ui/",
        "x": 530,
        "y": 500,
        "wires": []
    },
    {
        "id": "5b6ed7b8d21ac661",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 2,
        "width": 1,
        "height": 1
    },
    {
        "id": "e850fbb161e07294",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 3,
        "width": 1,
        "height": 1
    },
    {
        "id": "6c107f7efe06fec5",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 4,
        "width": 1,
        "height": 1
    },
    {
        "id": "a249e68f963a6fc1",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 5,
        "width": 1,
        "height": 1
    },
    {
        "id": "7dd0b0b4cb093fbd",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 6,
        "width": 1,
        "height": 1
    },
    {
        "id": "fd81d6e3a7cb460f",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 7,
        "width": 1,
        "height": 1
    },
    {
        "id": "0c8c0dfb36c783be",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 8,
        "width": 1,
        "height": 1
    },
    {
        "id": "cddd7237cd89c74e",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 9,
        "width": 1,
        "height": 1
    },
    {
        "id": "6486dbc4e2ebd947",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 10,
        "width": 1,
        "height": 1
    },
    {
        "id": "77721bbe55b065fd",
        "type": "ui_spacer",
        "z": "383b2d2f52806bf7",
        "name": "spacer",
        "group": "45c38846034c979c",
        "order": 11,
        "width": 1,
        "height": 1
    },
    {
        "id": "efd504cc315d6be5",
        "type": "ui_group",
        "name": "Switches",
        "tab": "eb23f248b6641ee9",
        "order": 1,
        "disp": true,
        "width": "4",
        "collapse": false,
        "className": ""
    },
    {
        "id": "45c38846034c979c",
        "type": "ui_group",
        "name": "Log",
        "tab": "eb23f248b6641ee9",
        "order": 2,
        "disp": true,
        "width": 6,
        "collapse": false,
        "className": ""
    },
    {
        "id": "eb23f248b6641ee9",
        "type": "ui_tab",
        "name": "Control Relays",
        "icon": "dashboard",
        "order": 3,
        "disabled": false,
        "hidden": false
    }
]
</pre>
