function nomosNode(filename, RED) {
    const ID = require('path').basename(filename, '.js');

    const base = this;
    base.propertyName = '';
    base.mappingName = '';
    base.hasInput = true;

    function nomosObject(config) {
        // Init
        RED.nodes.createNode(this, config);
        var node = this;
        this.nomosHub = RED.nodes.getNode(config.config);
        base.onNodeInit(node, config);
        node.propertyName = base.propertyName;      // important to assign it to inner object (for "raw" nodes working properly)
        node.mappingName = base.mappingName;

        //
        // Actions to Hub
        //
        if(this.nomosHub) {
            this.nomosHub.register(node);

            this.on('close', function(done) {
                node.nomosHub.deregister(node, done);
            });

            if(base.hasInput) {
                node.on('input', function(msg) {
                    // set topic and/or filter for topic
                    const topic = config.topic ? config.topic : config.name;
                    if(config.filter === true && msg.topic !== topic) {
                        log(ID, node.warn, "msg.topic doesn't match configured value and filter is enabled. Dropping message.");
                        return;
                    }
                    // remember input topic for later output
                    node.topic_in = msg.topic ? msg.topic : '';

                    var newPayload = msg.payload;
                    if(typeof newPayload !== 'object') {
                        newPayload = {};
                    }

                    newPayload.__command = 'componentUpdate';
                    newPayload.property = node.propertyName;
                    newPayload.cid = config.cid;
                    newPayload.value = base.actionParser(msg);

                    if(!newPayload.property || newPayload.property === '-none-') {
                        log(ID, node.warn, "No property set. Dropping message.");
                        return;
                    }
                    if(!newPayload.cid) {
                        log(ID, node.warn, "No component set. Dropping message.");
                        return;
                    }

                    msg.payload = newPayload;
                    node.nomosHub.emit(msg, function(result) {
                        const topic = config.topic ? config.topic : node.topic_in;
                        node.send([{payload: !result[msg.payload.cid], topic: topic}]);
                    });
                });
            }
        }
        else {
            log(ID, node.error, 'No nomos.hub Configuration');
        }

        //
        // Events from Hub
        //
        if(node._wireCount) {
            if(this.nomosHub) {
                node.nomosHub.subscribe(node.id, config.cid, node.mappingName, function(result) {
                    const topic = config.topic ? config.topic : node.topic_in;

                    if(base.hasInput) {
                        node.send([null, {payload: result, topic: topic}, {payload: result.value, topic: topic}]);
                    }
                    else {
                        node.send([{payload: result, topic: topic}, {payload: result.value, topic: topic}]);
                    }
                });
            }
        }

        //
        // 'Reachable' event from Hub
        //
        if(this.nomosHub) {
            node.nomosHub.subscribe(node.id, config.cid, 'reachable', function(result) {
                var status = {
                    fill: 'green',
                    shape: 'dot',
                    text: 'node-red:common.status.connected'
                };
                if(!result.value) {
                    status = {
                        fill: 'yellow',
                        shape: 'ring',
                        text: 'unreachable'
                    };
                }
                node.status(status);
            });
        }
    }

    RED.nodes.registerType(ID, nomosObject);
}

nomosNode.prototype.actionParser = function(msg) {
    return msg.payload;
};

nomosNode.prototype.onNodeInit = function() {
};

nomosNode.prototype.setHasInput = function(hasInput) {
    this.hasInput = hasInput;
};

nomosNode.prototype.setPropertyNames = function(propertyName, mappingName) {
    this.propertyName = propertyName;
    this.mappingName = mappingName;
    if(!this.mappingName) this.mappingName = this.propertyName;
};

function log(id, logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(id + ': ' + message);
}

module.exports = nomosNode;
