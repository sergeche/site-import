/**
 * A stream for generating site import configs by reading
 * symlinks in given folder
 */
'use strict';

var stream = require('stream');
var extend = require('xtend');
var util = require('util');
var debug = require('debug')('si:read-config');
var locateSymlinks = require('../locate-symlinks');
var symlinkConfig = require('../symlink-config');

var ReadConfigStream = module.exports = function(src, options) {
	stream.Readable.call(this, {objectMode: true});
	debug('create reader for %s', src);
	this._options = options || {};
	this.src = src;
	this._reader = null;
	this._symlinks = null;
	this._process = this.processSymlink.bind(this);
	this.once('end', this.onEnd);
};

util.inherits(ReadConfigStream, stream.Readable);

ReadConfigStream.prototype._read = function() {
	if (!this._reader) {
		var self = this;
		debug('creating reader');
		this._reader = locateSymlinks(this.src)
		.then(function(symlinks) {
			debug('symlinks: %o', symlinks);
			self._symlinks = symlinks.slice(0);
			self._symlinks.dir = symlinks.dir;
		}, function(err) {
			debug('symlinks error: %o', err);
			self.emit('error', err);
		});
	} else {
		debug('use existing reader');
	}

	this._reader.then(this._process);
};

ReadConfigStream.prototype.processSymlink = function() {
	if (!this._symlinks || !this._symlinks.length) {
		// finishing stream
		debug('finish');
		return this.push(null);
	}

	debug('processing symlink %s', this._symlinks[0]);
	var self = this;
	symlinkConfig.create(extend(this._options, {
		prefix: '/' + this._symlinks.shift(), 
		basePath: this._symlinks.dir
	}))
	.then(function(config) {
		debug('created config');
		self.push(config);
	}, function(err) {
		debug('got error\n%s', err.stack);
		self.emit('error', err);
	});
};

ReadConfigStream.prototype.onEnd = function() {
	debug('clean-up');
	this._reader = this._symlinks = this._process = null;
};