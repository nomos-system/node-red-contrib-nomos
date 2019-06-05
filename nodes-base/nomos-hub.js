module.exports = function(RED) {

    const ID = 'nomos-hub';

    function log(log, message) {
        if(typeof message === 'object') message = JSON.stringify(message);
        log(ID + ': ' + message);
    }

    //
    // Config/Hub Node
    //
    function nomosConfigNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var subscriptions = {};
        node.nodesList = {};

        //
        // Internal Functions
        //
        this.register = function(n) {
            node.nodesList[n.id] = n;
        };

        this.deregister = function(n, done) {
            delete node.nodesList[n.id];
            return done();
        };

        this.on('close', function(done) {
            node.setStatus('disconnect');
            setTimeout(function() {
                node.socket.close();
                done();
            }, 200);
        });

        // api command execution
        this.emit = function(msg, callback) {
            var command = null;
            if(msg.payload && msg.payload.__command) {
                command = msg.payload.__command;
                delete msg.payload.__command;
                log(node.log, 'Executing "' + command + '" with payload ' + JSON.stringify(msg.payload));
                node.socket.emit(command, msg.payload, callback);
            }
        };

        // subscribe nodes
        this.subscribe = function(id, cid, property, callback) {
            const key = cid + '_' + property;
            if(!subscriptions[key]) {
                subscriptions[key] = [];
            }
            subscriptions[key].push(callback);
        };

        // emit updates to subscription nodes
        this.subscriptionHandler = function(data) {
            const key = data.cid + '_' + data.property;
            if(subscriptions[key]) {
                subscriptions[key].forEach(function(callback) {
                    callback(data);
                });
            }
        };

        // emit updates to subscription nodes
        this.componentUpdateHandler = function(result) {
            result.map(node.subscriptionHandler);
        };

        this.setStatus = function(c) {
            var s;
            switch (c) {
                case 'connecting':
                    s = {
                        fill: 'blue',
                        shape: 'ring',
                        text: 'node-red:common.status.connecting'
                    };
                    break;
                case 'connect':
                    s = {
                        fill: 'green',
                        shape: 'dot',
                        text: 'node-red:common.status.connected'
                    };
                    break;
                case 'disconnect':
                    s = {
                        fill: 'red',
                        shape: 'ring',
                        text: 'node-red:common.status.disconnected'
                    };
                    break;
                case 'invalidauth':
                    s = {
                        fill: 'red',
                        shape: 'ring',
                        text: 'authentication error'
                    };
                    break;
                default:
                    s = {
                        fill: 'red',
                        shape: 'ring',
                        text: c
                    };
            }
            Object.keys(node.nodesList).forEach(function(id) {
                node.nodesList[id].status(s);
            });
        };

        //
        // Socket.io Connection Handling
        //
        node.connected = false;
        const fullHost = 'http://' + config.host + ':' + config.port + '/api/v1';
        log(this.log, 'Connecting to ' + fullHost);
        node.setStatus('connecting');
        node.socket = require('socket.io-client')(fullHost + '?knxgroupaddresses=1');

        function socketInitialization() {
            node.socket.emit('init', {uagent: 'node-red-nomos v1', language: 'en'}, function() {
                node.socket.emit('getProductProfile', {}, function(profile) {
                    if(profile.modules.nodered === undefined) {
                        node.setStatus('disconnect');
                        log(node.error, 'Node.RED connection not possible with this nomos.hub');
                        setTimeout(function() {
                            node.socket.close();
                        }, 1000);
                    }
                });
            });
            node.socket.on('onComponentUpdate', node.componentUpdateHandler);
        }

        node.socket.on('connect', function() {
            node.socket.emit('auth', {username: node.credentials.username, password: node.credentials.password, persistent: false}, function(auth) {
                if(auth === true) {
                    // successful
                    node.connected = true;
                    node.setStatus('connect');
                    log(node.log, 'Connected to ' + fullHost);
                    socketInitialization();
                }
                else {
                    // not successful
                    node.setStatus('invalidauth');
                    setTimeout(function() {
                        node.socket.close();
                    }, 3000);
                }
            });
        });

        node.socket.on('disconnect', function() {
            node.connected = false;
            node.setStatus('disconnect');
            node.socket.off('onComponentUpdate', node.componentUpdateHandler);
            log(node.log, 'Disconnected from ' + fullHost);
        });
    }

    RED.nodes.registerType(ID, nomosConfigNode, {
        host: {
            type: 'host'
        },
        credentials: {
            username: {
                type: 'text'
            },
            password: {
                type: 'password'
            }
        }
    });
};