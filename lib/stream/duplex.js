'use strict';

var stream = require('stream');
var util = require('util');

var DuplexStream = module.exports = function(options) {
	options = options || {};
	options.objectMode = true;

	stream.Duplex.call(this, options);

	var readable = this._readable = options.readable || new stream.PassThrough(options);
	var writable = this._writable = options.writable || new stream.PassThrough(options);
	writable.pipe(readable);

	this._bubbleErrors = (typeof options.bubbleErrors === 'undefined') || !!options.bubbleErrors;

	var self = this;
	var emitError = function(err) {
		self.emit('error', err);
	};

	writable.once('finish', function() {
		self.end();
	});

	this.once('finish', function() {
		writable.end();
		writable.removeListener('error', emitError);
		readable.removeListener('error', emitError);
	});

	readable.on('data', function(e) {
		if (!self.push(e)) {
			this.pause();
		}
	});

	readable.once('end', function() {
		return self.push(null);
	});

	if (this._bubbleErrors) {
		writable.on("error", emitError);
		readable.on("error", emitError);
	}
}

util.inherits(DuplexStream, stream.Duplex);

DuplexStream.prototype.inject = function() {
	this._writable.unpipe(this._readable);
	var stream = this._writable;
	for (var i = 0, il = arguments.length; i < il; i++) {
		if (arguments[i]) {
			stream = stream.pipe(arguments[i]);
		}
	}
	stream.pipe(this._readable);
	return this;
};

DuplexStream.prototype._read = function(n) {
	this._readable.resume();
};

DuplexStream.prototype._write = function(input, encoding, done) {
	this._writable.write(input, encoding, done);
};