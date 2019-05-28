const path = require('path');

module.exports = function(RED) {
    module.ID = path.basename(__filename, '.js');

    function nomosObject(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.nomosHub = RED.nodes.getNode(config.config);

        if(this.nomosHub) {
            this.nomosHub.register(node);

            this.on('close', function(done) {
                node.nomosHub.deregister(node, done);
            });

            node.on('input', function(msg) {
                // set topic and/or filter for topic
                const topic = config.topic ? config.topic : config.name;
                if(config.filter === true && msg.topic !== topic) {
                    log(node.warn, "msg.topic doesn't match configured value and filter is enabled. Dropping message.");
                    return;
                }
                // remember input topic for later output
                node.topic_in = msg.topic ? msg.topic : '';

                var newPayload = msg.payload;
                if(typeof newPayload !== 'object') {
                    newPayload = {};
                }
                newPayload.__command = 'restoreBackup';

                msg.payload = newPayload;
                node.nomosHub.emit(msg, function(result) {
                    const topic = config.topic ? config.topic : node.topic_in;
                    if(result.errorCode) {
                        node.send([null, {payload: result, topic: topic}]);
                    }
                    else {
                        node.send([{payload: result, topic: topic}, null]);
                    }
                });
            });
        }
        else {
            log(node.error, 'No nomos.hub Configuration');
        }
    }

    RED.nodes.registerType(module.ID, nomosObject);
};

function log(logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(module.ID + ': ' + message);
}