# Use a C2-NRED to write ASCii or Modbus RTU using the serial port on the CLICK
The goal of this project is to take a list of numeric values or strings in Node-RED and write them out a serial port on the CLICK CPU.
This example project starts with a flow in Node-RED that has generated a list of data elements.  It writes them to the CLICK memory using the CLICK Write Node, it then sets a bit (C1) to indicate to the CPU that data is ready to write. 
On the Ladder side, when the CPU sees bit 1 go high it executes a SEND command.  Whether that command succeeds or fails, when it is complete, it clears the C1 bit.
<img src="CLICK Serial Flow.png">

The Inject node simply sends an Array of values [0,1,0] for Bits. [34, 23, 45] for integers, or ["Automation"] for a string.
The CLICK Write node sends that array to the designated registers in the CLICK
The "Change" Node writes a JSON Array [1] and the lst CLICK node writes that to C1.

In the Ladder logic, C1 triggers a SEND command, and when that is done a Copy command resets C1 to off.
<img src="CLICK Serial Ladder Logic.png">
