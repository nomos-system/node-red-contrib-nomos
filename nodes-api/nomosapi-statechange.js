const path = require('path');

module.exports = function(RED) {
    module.ID = path.basename(__filename, '.js');

    function nomosObject(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        this.nomosHub = RED.nodes.getNode(config.config);

        this.eventHandler = function(result) {
            node.send([{payload: result, topic: config.topic}]);
        };

        if(this.nomosHub) {
            this.nomosHub.register(node);

            this.on('close', function(done) {
                node.nomosHub.socket.off('stateChange', node.eventHandler);
                node.nomosHub.deregister(node, done);
            });
        }
        else {
            log(node.error, 'No nomos Controller Configuration');
        }

        //
        // Events from Controller
        //
        if(node._wireCount) {
            if(this.nomosHub) {
                node.nomosHub.socket.on('stateChange', node.eventHandler);
            }
        }
    }

    RED.nodes.registerType(module.ID, nomosObject);
};

function log(logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(module.ID + ': ' + message);
}