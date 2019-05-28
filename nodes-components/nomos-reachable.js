const nomosNode = require('./nomosnode');

module.exports = function(RED) {
    const node = new nomosNode(__filename, RED);
    node.setHasInput(false);
    node.setPropertyNames('reachable');
};
