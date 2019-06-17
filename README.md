# node-red-contrib-nomos
> A <a href="http://nodered.org" target="_new">Node-RED</a> node to connect with nomos system hubs.

[![Version](https://badge.fury.io/gh/nomos-system%2Fnode-red-contrib-nomos.svg)](https://badge.fury.io/gh/nomos-system%2Fnode-red-contrib-nomos)
[![License][mit-badge]][mit-url]

With this Nodes you can connect [nomos.hub](https://www.nomos-system.com) and [Node-RED](https://nodered.org/). Minimum requirement is you have nomos.hub 2.0 up and running. 

### Installation
-------

Run command on Node-RED installation directory.

	npm install node-red-contrib-nomos

or use the palette manager.

### Configuration
-----
1. Add a nomos node
2. Add a new *nomos.hub* if not done already
![img2](docs/img2.png)
![img1](docs/img1.png)


### Usage
-----

#### nomos Components
With this nodes you can connect directly to nomos.hub components/devices. The nodes are bound to certain properties. For example components with *Level/Brightness* property. *Component* and *Generic* nodes are more flexible in the way you can control or query component properties.

#### nomos Extras
Direct access to *Events*, *Timers*, *Scenes* and *Notifications* you have configured on your nomos.hub. Triggers are working as well. For example: You can use a *Scenes* node as trigger and attach for additional execution other Node-RED nodes to it. 

#### nomos API
The complete nomos API available as Node-RED nodes. See the documentation of each node for further informations. 


# Changelog

### v1.0.0
* Initial release

# License

MIT (c) nomos system AG

[mit-badge]: https://img.shields.io/badge/License-MIT-blue.svg?style=flat
[mit-url]: LICENSE
