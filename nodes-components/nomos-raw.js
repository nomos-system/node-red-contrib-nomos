const nomosNode = require('./nomosnode');

module.exports = function(RED) {
    const node = new nomosNode(__filename, RED);

    node.onNodeInit = function(innerNode, config) {
        node.setPropertyNames(config.propertyname, config.mappingname);
    };
};
