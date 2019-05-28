const nomosNode = require('./nomosnode');

module.exports = function(RED) {
    const node = new nomosNode(__filename, RED);
    node.setPropertyNames('position');

    node.actionParser = function(msg) {
        return parseInt(msg.payload);
    };
};
