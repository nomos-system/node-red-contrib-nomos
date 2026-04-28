<div align="center">

<img src="https://github.com/nomos-system/node-red-contrib-nomos/raw/master/nodes-base/icons/nomos.svg" alt="nomos system" width="120" />

# node-red-contrib-nomos

**A [Node-RED](https://nodered.org) integration for the [nomos system](https://www.nomos-system.com) Controller.**

[![npm version](https://badge.fury.io/js/node-red-contrib-nomos.svg)](https://badge.fury.io/js/node-red-contrib-nomos)
[![License][mit-badge]][mit-url]

</div>

---

Connect your [nomos system Controller](https://www.nomos-system.com) to [Node-RED](https://nodered.org) and build powerful automations with components, scenes, events and the full nomos system API at your fingertips.

> **Requirement:** nomos system Controller **2.0** or newer.

## Installation

Run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install node-red-contrib-nomos
```

Alternatively, install it directly via the Node-RED **Palette Manager**.

## Configuration

1. Drag a **nomos** node onto the flow.
2. Open the node and create a new **nomos-hub** configuration if none exists yet.

<p align="center">
  <img src="https://github.com/nomos-system/node-red-contrib-nomos/raw/master/docs/img2.png" alt="Add nomos-hub configuration" />
  <br/><br/>
  <img src="https://github.com/nomos-system/node-red-contrib-nomos/raw/master/docs/img1.png" alt="nomos-hub settings" />
</p>

## Usage

### Components

Connect directly to components and devices managed by your nomos system Controller. Each node is bound to a specific property — pick the one that matches what you want to read or write:

| Node            | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `state`         | Boolean on/off state of a component                  |
| `level`         | Level / brightness (0–100 %)                         |
| `hue`           | Color (hue/saturation) for lighting                  |
| `volume`        | Audio volume                                         |
| `position`      | Blind / shutter position                             |
| `angle`         | Slat angle for blinds                                |
| `setpoint`      | Target temperature                                   |
| `temperature`   | Measured temperature                                 |
| `humidity`      | Measured humidity                                    |
| `isheating`     | Heating state                                        |
| `iscooling`     | Cooling state                                        |
| `motion`        | Motion sensor                                        |
| `contact`       | Contact / door sensor                                |
| `openwindow`    | Open-window detection                                |
| `battery`       | Battery level                                        |
| `reachable`     | Reachability of a component                          |
| `raw`           | Raw component data                                   |
| `component`     | Generic node — read/write any component property     |

> Use the **`component`** node when no specialized node fits — it can access any property of any component.

### Extras

Direct access to system-level objects configured on your Controller. Each node can act as a **trigger** (chain further Node-RED logic to it) or as an **executor**.

| Node                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `event`               | nomos events                           |
| `timer`               | nomos timers                           |
| `scene`               | nomos scenes                           |
| `notificationprofile` | nomos notification profiles            |
| `hub`                 | Configuration node for the Controller  |

### API

The complete nomos system API is exposed as Node-RED nodes — over 500 endpoints covering device management, configuration, monitoring and more. See the inline help of each node for detailed information.

<details>
<summary><b>Supported integrations &amp; domains</b> (click to expand)</summary>

<br/>

**Smart-Home protocols & ecosystems**

KNX · Matter · Zigbee · Z-Wave · Hue · free@home · Somfy · Wiser · Zeptrion · Lutron · Sonos · Spotify · Miele · HomeConnect · Netatmo · Nuki · Husqvarna

**System management**

Backups · Cameras · Floors · Rooms · Links · Users · System variables · Special events · Webhooks · SIP clients · Monitoring · Accessories

**Networking & remote access**

VPN · WireGuard (server / clients / peers) · Port forwarding · Remote devices · Cloud sync · Management pairing

**Add-ons & online library**

Add-on profiles · Add-on devices · Online library profiles · Auto-detection

**Maintenance**

Logging · System debug · Software updates · Soft reset · Emergency mode · MCP tokens · Ping devices

</details>

## License

[MIT](LICENSE) &copy; nomos system AG

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
