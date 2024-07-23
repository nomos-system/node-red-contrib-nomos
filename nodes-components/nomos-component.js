const ID = require('path').basename(__filename, '.js');

module.exports = function(RED) {

    function nomosObject(config) {
        // Init
        RED.nodes.createNode(this, config);
        const node = this;
        this.nomosHub = RED.nodes.getNode(config.config);

        //
        // Actions to Controller
        //
        if(this.nomosHub) {
            this.nomosHub.register(node);

            this.on('close', function(done) {
                node.nomosHub.socket.off('onComponentUpdate', node.eventHandler);
                node.nomosHub.deregister(node, done);
            });

            node.on('input', function(msg) {
                // set topic and/or filter for topic
                const topic = config.topic ? config.topic : config.name;
                if(config.filter === true && msg.topic !== topic) {
                    log(node.warn, 'msg.topic doesn\'t match configured value and filter is enabled. Dropping message.');
                    return;
                }
                // remember input topic for later output
                node.topic_in = msg.topic ? msg.topic : '';

                let newPayload = msg.payload;
                if(typeof newPayload !== 'object') {
                    newPayload = {
                        property: msg.payload
                    };
                }

                if(newPayload.property === undefined) {
                    log(node.warn, 'No property set. Dropping message.');
                    return;
                }

                newPayload.cid = config.cid;
                newPayload.__command = 'componentUpdate';

                msg.payload = newPayload;
                node.nomosHub.emit(msg, function(result) {
                    const topic = config.topic ? config.topic : node.topic_in;
                    if(result.errorCode) {
                        node.send([{payload: true, topic: topic}]);
                    }
                    else {
                        node.send([{payload: !result[msg.payload.cid], topic: topic}]);
                    }
                });
            });
        }
        else {
            log(node.error, 'No nomos Controller Configuration');
        }

        //
        // Events from Controller
        //
        this.eventHandler = function(result) {
            const topic = config.topic ? config.topic : node.topic_in;
            result = result.map(function(data) {
                if(data.cid !== config.cid) return;    // filter
                return {payload: data, topic: topic};
            });
            node.send([null, result]);
        };
        if(node._wireCount) {
            if(this.nomosHub) {
                node.nomosHub.socket.on('onComponentUpdate', node.eventHandler);
            }
        }
    }

    RED.nodes.registerType(ID, nomosObject);
};

function log(logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(ID + ': ' + message);
}