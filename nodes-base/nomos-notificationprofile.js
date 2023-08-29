const ID = require('path').basename(__filename, '.js');

module.exports = function(RED) {

    function nomosObject(config) {
        // Init
        RED.nodes.createNode(this, config);
        var node = this;
        this.nomosHub = RED.nodes.getNode(config.config);

        //
        // Actions to Controller
        //
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

                if(!newPayload.variables) {
                    newPayload.variables = Object.values(msg.payload).map(function(v) {
                        if(typeof v !== 'object') return v;
                        return null;
                    });
                }
                newPayload.__command = 'sendNotification';
                newPayload.profile = config.profile;

                msg.payload = newPayload;
                node.nomosHub.emit(msg, function(result) {
                    const topic = config.topic ? config.topic : node.topic_in;
                    if(result.errorCode) {
                        node.send([{payload: true, topic: topic}]);
                    }
                    else {
                        node.send([{payload: !result, topic: topic}]);
                    }
                });
            });
        }
        else {
            log(node.error, 'No nomos Controller Configuration');
        }
    }

    RED.nodes.registerType(ID, nomosObject);
};

function log(logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(ID + ': ' + message);
}