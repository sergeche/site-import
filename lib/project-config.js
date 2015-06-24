'use strict';

var extend = require('xtend');
var minimatch = require('minimatch');

module.exports = class ProjectConfig {
	constructor(data) {
		// default ignore pattern
		this.ignore = ['{node_modules,bower_components}/**'];
		this.transforms = {};
		this.extend(data);
	}

	extend(data) {
		if (typeof data === 'object') {
			Object.keys(data).forEach(function(key) {
				var value = data[key];
				if (Array.isArray(value)) {
					value = value.slice(0);
				} else if (typeof value === 'object') {
					value = extend(value);
				}
				this[key] = value;
			}, this);
		}
		return this;
	}

	copy(override) {
		return new ProjectConfig(this).extend(override);
	}

	/**
	 * Registers a transformation stream for given file glob pattern.
	 * If multiple patterns will be matched for a single file,
	 * the one with longer pattern will be picked
	 * @param  {String} pattern Glob pattern
	 * @param  {stream.Transform} stream A transformation stream
	 */
	transform(pattern, stream) {
		if (stream === null && pattern in this.transforms) {
			return delete this.transforms[pattern];
		}
		if (typeof stream === 'object' && '_transform' in stream) {
			this.transforms[pattern] = stream;
		}
	}

	/**
	 * Find matched transformation stream for given file path
	 * @param  {String} filePath
	 * @return {stream.Transform}
	 */
	match(filePath) {
		var m = Object.keys(this.transforms).filter(function(pattern) {
			return minimatch(filePath, pattern);
		}).sort(function(a, b) {
			return b.length - a.length;
		})[0];

		return m && this.transforms[m];
	}
};