const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// Same async-socket harness as event-subscriptions.test.js, but driving the
// generated nodes-api event nodes instead of the hand-written nodes-base ones.
let resolveProbe, rejectProbe;
let fakeSocket;

function makeFakeSocket() {
    const listeners = {};
    return {
        on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
        off(name, fn) {
            if(!listeners[name]) return;
            const idx = listeners[name].indexOf(fn);
            if(idx !== -1) listeners[name].splice(idx, 1);
        },
        emit() {},
        close() {},
        connect() {},
        disconnect() {},
        serverEmit(name, data) { (listeners[name] || []).slice().forEach(fn => fn(data)); }
    };
}

const origLoad = Module._load;
Module._load = function(req, parent, ...rest) {
    if(req === 'axios') {
        return { get: () => new Promise((res, rej) => { resolveProbe = res; rejectProbe = rej; }) };
    }
    if(req === 'socket.io-client' || req === 'socket.io-client-v4') {
        return function() {
            fakeSocket = makeFakeSocket();
            return fakeSocket;
        };
    }
    return origLoad.call(this, req, parent, ...rest);
};

function nodeStubs(self) {
    self.log = () => {};
    self.warn = () => {};
    self.error = () => {};
    self.status = () => {};
    self._handlers = {};
    self.on = function(name, fn) { (self._handlers[name] = self._handlers[name] || []).push(fn); };
    self.sent = [];
    self.send = function(msgs) { self.sent.push(msgs); };
}

function newHub() {
    delete require.cache[require.resolve('../nodes-base/nomos-hub.js')];
    const hubModule = require('../nodes-base/nomos-hub.js');
    let ConfigNode;
    hubModule({
        nodes: {
            createNode(self) {
                nodeStubs(self);
                self.credentials = {};
            },
            registerType(id, fn) { ConfigNode = fn; }
        },
        httpAdmin: { post() {} }
    });
    const hub = {};
    ConfigNode.call(hub, { host: 'localhost', port: 1234 });
    return hub;
}

function newApiNode(hub, file, config) {
    const target = require.resolve('../nodes-api/' + file);
    delete require.cache[target];
    const apiModule = require(target);
    let ApiNode;
    apiModule({
        nodes: {
            createNode(self) { nodeStubs(self); },
            getNode() { return hub; },
            registerType(id, fn) { ApiNode = fn; }
        }
    });
    const node = { id: config.id || 'api1', _wireCount: 1 };
    ApiNode.call(node, config);
    return node;
}

function tick() {
    return new Promise(resolve => setImmediate(resolve));
}

test('api event node constructed before the socket exists does not throw', async () => {
    const hub = newHub();                                       // probe pending, hub.socket undefined
    const node = newApiNode(hub, 'nomosapi-onscenetriggered.js', { config: 'hub1', topic: 'scenes' });

    resolveProbe();
    await tick();

    fakeSocket.serverEmit('onSceneTriggered', { id: 25 });
    assert.strictEqual(node.sent.length, 1, 'node must forward the event');
    assert.deepStrictEqual(node.sent[0][0].payload, { id: 25 });
    assert.strictEqual(node.sent[0][0].topic, 'scenes');
});

test('api event node created after the socket exists also receives events', async () => {
    const hub = newHub();
    resolveProbe();
    await tick();

    const node = newApiNode(hub, 'nomosapi-oncomponentchange.js', { config: 'hub1', topic: 'comp' });
    fakeSocket.serverEmit('onComponentChange', { cid: 'C1' });
    assert.strictEqual(node.sent.length, 1);
});

test('api event node attaches on the v2 fallback socket too', async () => {
    const hub = newHub();
    const node = newApiNode(hub, 'nomosapi-oneventtriggered.js', { config: 'hub1', topic: 'ev' });

    rejectProbe(new Error('no v4 endpoint'));
    await tick();

    fakeSocket.serverEmit('onEventTriggered', { id: 1 });
    assert.strictEqual(node.sent.length, 1);
});

test('closing an api event node removes its handler without touching hub.socket', async () => {
    const hub = newHub();
    const node = newApiNode(hub, 'nomosapi-onscenetriggered.js', { config: 'hub1', topic: 'scenes' });
    resolveProbe();
    await tick();

    await new Promise(resolve => {
        node._handlers.close.forEach(fn => fn(resolve));
    });

    fakeSocket.serverEmit('onSceneTriggered', { id: 25 });
    assert.strictEqual(node.sent.length, 0, 'closed node must not fire any more');
});

test('no generated node and no template touches hub.socket directly', () => {
    const dir = path.join(__dirname, '..', 'nodes-api');
    const offenders = fs.readdirSync(dir)
        .filter(f => f.endsWith('.js') || f.endsWith('.jstemplate'))
        .filter(f => /nomosHub\.socket/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    assert.deepStrictEqual(offenders, [], 'nodes must subscribe through hub.subscribeEvent()');
});
