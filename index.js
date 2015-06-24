'use strict';

var stream = require('stream');
var locateSymlinks = require('./lib/locate-symlinks');
var symlinkConfig = require('./lib/symlink-config');

/**
 * Creates readable stream with project configs in given `src` path
 * @param  {String} src
 * @return {ReadConfigStream}
 */
module.exports.src = function(src) {
	return new ReadConfigStream(src);
};

/**
 * Creates writable stream that exports projects defined in incoming
 * configs into `dest` folder
 * @param  {String} dest
 * @return {ExportProjectStream}
 */
module.exports.dest = function(dest) {
	return new ExportProjectStream(dest);
};

class ReadConfigStream extends stream.Readable {
	constructor(src) {
		super({objectMode: true});
		this.src = src;
		this._reader = null;
		this._symlinks = null;
		this._process = this.processSymlink.bind(this);
		this.once('end', this.onEnd);
	}

	_read() {
		if (!this._reader) {
			var self = this;
			this._reader = locateSymlinks(this.src).then(function(symlinks) {
				self._symlinks = symlinks.slice(0);
			});
		}

		this._reader.then(self._process);
	}

	processSymlink() {
		if (!this._symlinks || !this._symlinks.length) {
			// finishing stream
			return this.push(null);
		}

		var self = this;
		symlinkConfig.create(this._symlinks.pop(), this._symlinks.dir)
		.then(function(config) {
			if (self.push(config)) {
				self._process();
			}
		}, function(err) {
			self.emit('error', err);
		});
	}

	onEnd() {
		this._reader = this._symlinks = this._process = null;
	}
};

class ExportProjectStream extends stream.Writable {
	constructor(dest) {
		super({objectMode: true});
		this.dest = dest;
	}

	_write(config, enc, next) {

	}
};