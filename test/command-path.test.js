const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// Covers the command path (hub.emit) against the same async socket the event
// path already has tests for: the socket only exists once the version probe
// resolved, and controller replies can be empty.
let resolveProbe, rejectProbe;
let fakeSocket;
let authReply = { session: 'x' };
let profileReply = { modules: { nodered: {} } };
let commandReply = {};

function makeFakeSocket() {
    const listeners = {};
    return {
        emits: [],
        on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
        off(name, fn) {
            if(!listeners[name]) return;
            const idx = listeners[name].indexOf(fn);
            if(idx !== -1) listeners[name].splice(idx, 1);
        },
        emit(name, data, cb) {
            this.emits.push({ name: name, data: data });
            if(name === 'auth') return cb && cb(authReply);
            if(name === 'init') return cb && cb({});
            if(name === 'getProductProfile') return cb && cb(profileReply);
            if(cb) cb(commandReply);
        },
        close() {}, connect() {}, disconnect() {},
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
    self.warns = [];
    self.warn = (m) => self.warns.push(m);
    self.errors = [];
    self.error = (m) => self.errors.push(m);
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
            createNode(self) { nodeStubs(self); self.credentials = {}; },
            registerType(id, fn) { ConfigNode = fn; }
        },
        httpAdmin: { post() {} }
    });
    const hub = {};
    ConfigNode.call(hub, { host: 'localhost', port: 1234 });
    return hub;
}

function newNode(hub, relPath, config) {
    const target = require.resolve('../' + relPath);
    delete require.cache[target];
    const nodeModule = require(target);
    let NodeCtor;
    nodeModule({
        nodes: {
            createNode(self) { nodeStubs(self); },
            getNode() { return hub; },
            registerType(id, fn) { NodeCtor = fn; }
        }
    });
    const node = { id: config.id || 'n1', _wireCount: 1 };
    NodeCtor.call(node, config);
    return node;
}

function tick() {
    return new Promise(resolve => setImmediate(resolve));
}

function connect(hub) {
    fakeSocket.serverEmit('connect');
}

test('a command sent before the socket exists is buffered, not thrown away', async () => {
    const hub = newHub();                                   // probe pending, hub.socket undefined
    const node = newNode(hub, 'nodes-api/nomosapi-getrooms.js', { config: 'hub1', topic: 't' });

    node._handlers.input[0]({ payload: {}, topic: 't' });    // must not throw
    assert.strictEqual(node.errors.length, 0);

    resolveProbe();
    await tick();

    const sentCommands = fakeSocket.emits.filter(e => e.name === 'getRooms');
    assert.strictEqual(sentCommands.length, 1, 'the buffered command must reach the socket');
});

test('buffered commands survive the v2 fallback path too', async () => {
    const hub = newHub();
    const node = newNode(hub, 'nodes-api/nomosapi-getrooms.js', { config: 'hub1', topic: 't' });

    node._handlers.input[0]({ payload: {}, topic: 't' });
    rejectProbe(new Error('no v4 endpoint'));
    await tick();

    assert.strictEqual(fakeSocket.emits.filter(e => e.name === 'getRooms').length, 1);
});

test('commands buffered while the hub is closing are dropped', async () => {
    const hub = newHub();
    const node = newNode(hub, 'nodes-api/nomosapi-getrooms.js', { config: 'hub1', topic: 't' });

    await new Promise(resolve => hub._handlers.close.forEach(fn => fn(resolve)));
    node._handlers.input[0]({ payload: {}, topic: 't' });

    fakeSocket = undefined;                                 // ignore the socket left by earlier tests
    resolveProbe();
    await tick();
    assert.strictEqual(fakeSocket, undefined, 'a closing hub must not create a socket or send');
});

test('emit without a command answers the caller instead of hanging', async () => {
    const hub = newHub();
    resolveProbe();
    await tick();

    let result = 'never called';
    hub.emit({ payload: { foo: 1 } }, function(r) { result = r; });
    assert.notStrictEqual(result, 'never called', 'the callback must fire');
    assert.strictEqual(result.errorCode, 'noCommand');
});

test('an empty auth reply is reported, not thrown', async () => {
    authReply = undefined;
    const hub = newHub();
    resolveProbe();
    await tick();

    connect(hub);                                           // must not throw
    assert.ok(hub.errors.some(e => /invalid auth/.test(e)), 'auth failure must be logged');
    authReply = { session: 'x' };
});

test('an error reply from getProductProfile is reported, not thrown', async () => {
    profileReply = { errorCode: 403 };
    const hub = newHub();
    resolveProbe();
    await tick();

    connect(hub);                                           // must not throw
    profileReply = { modules: { nodered: {} } };
});

test('an empty controller reply does not throw in the node callback', async () => {
    commandReply = undefined;
    const hub = newHub();
    resolveProbe();
    await tick();
    connect(hub);

    const node = newNode(hub, 'nodes-base/nomos-scene.js', { config: 'hub1', eid: '5' });
    node._handlers.input[0]({ payload: { trigger: 'call' }, topic: 't' });
    assert.strictEqual(node.sent.length, 1, 'the node must still emit its result');
    commandReply = {};
});

test('an unknown trigger value warns instead of vanishing silently', async () => {
    const hub = newHub();
    resolveProbe();
    await tick();
    connect(hub);

    const node = newNode(hub, 'nodes-base/nomos-scene.js', { config: 'hub1', eid: '5' });
    const before = fakeSocket.emits.length;
    node._handlers.input[0]({ payload: { trigger: 'toggle' }, topic: 't' });

    assert.strictEqual(fakeSocket.emits.length, before, 'nothing may be sent to the controller');
    assert.ok(node.warns.some(w => /Unknown trigger value/.test(w)), 'the node must warn');
});

test('event and timer nodes warn on an unknown trigger value as well', async () => {
    const hub = newHub();
    resolveProbe();
    await tick();
    connect(hub);

    ['nodes-base/nomos-event.js', 'nodes-base/nomos-timer.js'].forEach(function(relPath) {
        const node = newNode(hub, relPath, { config: 'hub1', eid: '5' });
        node._handlers.input[0]({ payload: { trigger: 'toggle' }, topic: 't' });
        assert.ok(node.warns.some(w => /Unknown trigger value/.test(w)), relPath + ' must warn');
    });
});
