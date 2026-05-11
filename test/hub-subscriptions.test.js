const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');

// Intercept axios + socket.io requires so that loading the hub module
// does not attempt any real network I/O.
const origLoad = Module._load;
Module._load = function(req, parent, ...rest) {
    if(req === 'axios') {
        return { get: () => new Promise(() => {}) };  // never resolves
    }
    if(req === 'socket.io-client' || req === 'socket.io-client-v4') {
        return function() {
            return { on() {}, off() {}, emit() {}, close() {}, connect() {}, disconnect() {} };
        };
    }
    return origLoad.call(this, req, parent, ...rest);
};

function makeFakeRED() {
    let ConfigNode;
    const RED = {
        nodes: {
            createNode(self) {
                self.log = () => {};
                self.warn = () => {};
                self.error = () => {};
                self.on = () => {};
                self.status = () => {};
                self.credentials = {};
            },
            registerType(id, fn) { ConfigNode = fn; }
        },
        httpAdmin: { post() {} }
    };
    return {
        RED,
        getConfigNode() { return ConfigNode; }
    };
}

function newHub() {
    // Fresh require each test so module-level state cannot leak across tests.
    delete require.cache[require.resolve('../nodes-base/nomos-hub.js')];
    const hubModule = require('../nodes-base/nomos-hub.js');
    const { RED, getConfigNode } = makeFakeRED();
    hubModule(RED);
    const ConfigNode = getConfigNode();
    const hub = {};
    ConfigNode.call(hub, { host: 'localhost', port: 1234 });
    return hub;
}

test('subscriptionHandler invokes subscribed callback', () => {
    const hub = newHub();
    const received = [];
    hub.register({ id: 'n1' });
    hub.subscribe('n1', 'cid-A', 'level', (data) => received.push(data));

    hub.subscriptionHandler({ cid: 'cid-A', property: 'level', value: 42 });
    assert.deepStrictEqual(received, [{ cid: 'cid-A', property: 'level', value: 42 }]);
});

test('deregister stops the leak: callback is removed from subscriptions', (t, done) => {
    const hub = newHub();
    let callCount = 0;

    hub.register({ id: 'n1' });
    hub.subscribe('n1', 'cid-A', 'level', () => callCount++);

    hub.subscriptionHandler({ cid: 'cid-A', property: 'level', value: 1 });
    assert.strictEqual(callCount, 1, 'callback fires while subscribed');

    hub.deregister({ id: 'n1' }, () => {
        hub.subscriptionHandler({ cid: 'cid-A', property: 'level', value: 2 });
        assert.strictEqual(callCount, 1, 'callback must NOT fire after deregister');
        done();
    });
});

test('repeated deploy cycles do not accumulate listeners for the same node id', (t, done) => {
    const hub = newHub();
    let callCount = 0;

    function cycle(cb) {
        hub.register({ id: 'n1' });
        hub.subscribe('n1', 'cid-A', 'level', () => callCount++);
        hub.subscribe('n1', 'cid-A', 'reachable', () => {});
        hub.deregister({ id: 'n1' }, cb);
    }

    cycle(() => cycle(() => cycle(() => {
        // After 3 deploy cycles, all subscriptions for n1 should be gone.
        hub.subscriptionHandler({ cid: 'cid-A', property: 'level', value: 1 });
        assert.strictEqual(callCount, 0, 'no stale callbacks left after deregister cycles');
        done();
    })));
});

test('deregistering one node does not remove another node\'s subscriptions', (t, done) => {
    const hub = newHub();
    const recA = [];
    const recB = [];

    hub.register({ id: 'nA' });
    hub.register({ id: 'nB' });
    hub.subscribe('nA', 'cid-X', 'state', (d) => recA.push(d.value));
    hub.subscribe('nB', 'cid-X', 'state', (d) => recB.push(d.value));

    hub.deregister({ id: 'nA' }, () => {
        hub.subscriptionHandler({ cid: 'cid-X', property: 'state', value: 7 });
        assert.deepStrictEqual(recA, [], 'nA was deregistered');
        assert.deepStrictEqual(recB, [7], 'nB still receives');
        done();
    });
});
