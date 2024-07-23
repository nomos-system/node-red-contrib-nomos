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
                node.nomosHub.socket.off('onEventTriggered', node.eventHandler);
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
                        trigger: msg.payload
                    };
                }

                if(newPayload.trigger === undefined) {
                    log(node.warn, 'No trigger set. Dropping message.');
                    return;
                }

                newPayload.eid = config.eid;
                switch(newPayload.trigger.toString().toLowerCase()) {
                    case '1':
                    case 'true':
                    case 'enable':
                        newPayload.__command = 'enableEvent';
                    break;
                    case '0':
                    case 'false':
                    case 'disable':
                        newPayload.__command = 'disableEvent';
                    break;
                }
                delete newPayload.trigger;

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

        //
        // Events from Controller
        //
        this.eventHandler = function(result) {
            if(result.eid !== config.eid) return;    // filter
            const topic = config.topic ? config.topic : node.topic_in;
            delete result.eid;
            node.send([null, {payload: result, topic: topic}]);
        };
        if(node._wireCount) {
            if(this.nomosHub) {
                node.nomosHub.socket.on('onEventTriggered', node.eventHandler);
            }
        }
    }

    RED.nodes.registerType(ID, nomosObject);
};

function log(logger, message) {
    if(typeof message === 'object') message = JSON.stringify(message);
    logger(ID + ': ' + message);
}