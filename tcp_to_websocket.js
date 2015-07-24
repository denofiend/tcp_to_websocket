#!/usr/bin/env node

// A TCP to WebSocket proxy
// Copyright 2015 DenoFiend
// Licensed under LGPL version 3 (see docs/LICENSE.LGPL-3)

// Known to work with node 0.8.9
// npm install
// node tcp_to_websocket.js 1986 10.142.99.144:10100


var argv = require('optimist').argv,
    net = require('net'),
    Buffer = require('buffer').Buffer,
    source_host, source_port, target_host, target_port;


Buffer.prototype.toByteArray = function() {
    return Array.prototype.slice.call(this, 0)
}

// parse source and target arguments into parts
try {
    source_arg = argv._[0].toString();
    target_arg = argv._[1].toString();

    var idx;
    idx = source_arg.indexOf(":");
    if (idx >= 0) {
        source_host = source_arg.slice(0, idx);
        source_port = parseInt(source_arg.slice(idx + 1), 10);
    } else {
        source_host = "0.0.0.0";
        source_port = parseInt(source_arg, 10);
    }

    idx = target_arg.indexOf(":");
    if (idx < 0) {
        throw ("target must be host:port");
    }
    target_host = target_arg.slice(0, idx);
    target_port = parseInt(target_arg.slice(idx + 1), 10);

    if (isNaN(source_port) || isNaN(target_port)) {
        throw ("illegal port");
    }
} catch (e) {
    console.error("tcp_to_websocket.js [source_addr:]source_port target_addr:target_port");
    process.exit(2);
}

console.log("TCP to WebSocket settings: ");
console.log("    - proxying from " + source_host + ":" + source_port +
    " to " + target_host + ":" + target_port);

net.createServer(function(sock) {
    console.log('TCP CONNECTED: ' +
        sock.remoteAddress + ':' + sock.remotePort);

    // 我们获得一个连接 - 该连接自动关联一个socket对象
    var WebSocketClient = require('websocket').client;

    var target = new WebSocketClient();

    target.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
        sock.end();
    });

    target.on('connect', function(connection) {
        console.log('WebSocket Connected');

        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
            sock.end();
        });
        connection.on('close', function() {
            sock.end();
        });
        connection.on('message', function(message) {
            console.log('<<< TO Client Data:' + JSON.stringify(message) + "\n");
            if (message.binaryData) {
                sock.write(message.binaryData);
            } else {
                sock.write(JSON.stringify(message));
            }
        });

        // 为这个socket实例添加一个"data"事件处理函数
        sock.on('data', function(data) {
            console.log('>>> From Client Data ' + sock.remoteAddress + ':[' + new Buffer(data).toByteArray() + "]");
            // 回发该数据，客户端将收到来自服务端的数据
            connection.sendBytes(new Buffer(data));
        });

        // 为这个socket实例添加一个"close"事件处理函数
        sock.on('close', function(data) {
            console.log('CLOSED: ' +
                sock.remoteAddress + ' ' + sock.remotePort);
            connection.close();
        });

        sock.on('error', function(data) {
            console.log('TCP error: ' +
                sock.remoteAddress + ' ' + sock.remotePort);
            connection.close();
        });

    });
    target.connect('ws://' + target_host + ':' + target_port, 'binary');
}).listen(source_port, source_host);

console.log('Server listening on ' + source_host + ':' + source_port);