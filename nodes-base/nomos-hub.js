module.exports = function(RED) {

    const ID = 'nomos-hub';

    //
    // Config/Hub Node
    //
    function nomosConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const subscriptions = {};
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
            let command = null;
            if(msg.payload && msg.payload.__command) {
                command = msg.payload.__command;
                delete msg.payload.__command;
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
            let s;
            switch (c) {
                case 'connecting':
                    s = {
                        fill: 'blue',
                        shape: 'ring',
                        text: 'node-red:common.status.connecting'
                    };
                    break;
                case 'reconnecting':
                    s = {
                        fill: 'red',
                        shape: 'ring',
                        text: 'reconnecting'
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
                try {
                    node.nodesList[id].status(s);
                } catch(e) {}
            });
        };

        //
        // Socket.io Connection Handling
        //
        node.connected = false;
        const fullHost = 'http://' + config.host + ':' + config.port + '/api/v1';
        node.setStatus('connecting');
        node.socket = require('socket.io-client')(fullHost + '?knxgroupaddresses=1');

        function socketInitialization() {
            node.socket.emit('init', {uagent: 'node-red-nomos v1', language: 'en'}, function() {
                node.socket.emit('getProductProfile', {}, function(profile) {
                    if(profile.modules.nodered === undefined) {
                        node.setStatus('not enabled');
                        setTimeout(function() {
                            node.socket.close();
                        }, 1000);
                    }
                });
            });
            node.socket.on('onComponentUpdate', node.componentUpdateHandler);
        }

        function socketReconnect() {
            clearTimeout(node.reconnectTimer);
            node.setStatus('reconnecting');
            node.reconnectTimer = setTimeout(function() {
                node.socket.connect();
            }, 3000);
        }

        node.socket.on('connect', function() {
            node.socket.emit('auth', {username: node.credentials.username, password: node.credentials.password, persistent: false}, function(auth) {
                if(auth.errorCode || !auth) {
                    // not successful
                    node.error('socket.io invalid auth');
                    node.setStatus('invalidauth');
                    setTimeout(function() {
                        node.socket.close();
                    }, 3000);
                }
                else {
                    // successful
                    node.log('socket.io connected');
                    node.connected = true;
                    node.setStatus('connect');
                    socketInitialization();
                }
            });
        });

        node.socket.on('disconnect', function() {
            node.warn('socket.io disconnected');
            node.connected = false;
            node.setStatus('disconnect');
            node.socket.off('onComponentUpdate', node.componentUpdateHandler);
            socketReconnect();
        });

        node.socket.on('error', function() {
            node.socket.disconnect();
            socketReconnect();
        });

        node.socket.on('connect_error', function() {
            node.socket.disconnect();
            socketReconnect();
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
