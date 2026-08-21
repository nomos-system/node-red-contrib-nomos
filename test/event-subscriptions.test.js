const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// The hub creates its socket asynchronously (axios probe for the v4 path,
// then the socket client). These tests drive that sequence step by step:
// resolveProbe()/rejectProbe() settle the probe, fakeSocket captures the
// listeners and can play back server-sent events via serverEmit().
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

function newSceneNode(hub, config) {
    delete require.cache[require.resolve('../nodes-base/nomos-scene.js')];
    const sceneModule = require('../nodes-base/nomos-scene.js');
    let SceneNode;
    sceneModule({
        nodes: {
            createNode(self) { nodeStubs(self); },
            getNode() { return hub; },
            registerType(id, fn) { SceneNode = fn; }
        }
    });
    const node = { id: config.id || 'scene1', _wireCount: 1 };
    SceneNode.call(node, config);
    return node;
}

function tick() {
    return new Promise(resolve => setImmediate(resolve));
}

test('scene node subscribed before the hub socket exists receives onSceneTriggered', async () => {
    const hub = newHub();                                       // probe pending, hub.socket undefined
    const node = newSceneNode(hub, { config: 'hub1', eid: '25' });

    resolveProbe();                                             // v4 probe succeeds, socket gets created
    await tick();

    fakeSocket.serverEmit('onSceneTriggered', { id: 25, stats: { day: 1 } });
    assert.strictEqual(node.sent.length, 1, 'scene node must fire on the trigger output');
    assert.strictEqual(node.sent[0][0], null, 'output 1 (command result) stays empty');
    assert.deepStrictEqual(node.sent[0][1].payload, { day: 1 });
});

test('scene node created after the socket exists also receives events', async () => {
    const hub = newHub();
    resolveProbe();
    await tick();

    const node = newSceneNode(hub, { config: 'hub1', eid: '7' });
    fakeSocket.serverEmit('onSceneTriggered', { id: 7, stats: { day: 2 } });
    assert.strictEqual(node.sent.length, 1);
});

test('event subscriptions attach on the v2 fallback socket too', async () => {
    const hub = newHub();
    const node = newSceneNode(hub, { config: 'hub1', eid: '3' });

    rejectProbe(new Error('no v4 endpoint'));                   // probe fails, v2 fallback socket
    await tick();

    fakeSocket.serverEmit('onSceneTriggered', { id: 3, stats: { day: 3 } });
    assert.strictEqual(node.sent.length, 1);
});

test('scene node filters events for other scene ids', async () => {
    const hub = newHub();
    const node = newSceneNode(hub, { config: 'hub1', eid: '25' });
    resolveProbe();
    await tick();

    fakeSocket.serverEmit('onSceneTriggered', { id: 99, stats: { day: 1 } });
    assert.strictEqual(node.sent.length, 0, 'foreign scene ids must be ignored');
});

test('closing the scene node removes its event handler', async () => {
    const hub = newHub();
    const node = newSceneNode(hub, { config: 'hub1', eid: '25' });
    resolveProbe();
    await tick();

    await new Promise(resolve => {
        node._handlers.close.forEach(fn => fn(resolve));
    });

    fakeSocket.serverEmit('onSceneTriggered', { id: 25, stats: { day: 1 } });
    assert.strictEqual(node.sent.length, 0, 'closed node must not fire any more');
});
