'use strict';

var extend = require('xtend');
var minimatch = require('minimatch');
var debug = require('debug')('si:project');

var ProjectConfig = module.exports = function(data) {
	// default ignore pattern
	this.ignore = ['{node_modules,bower_components}/**'];
	this.transforms = {};
	this.extend(data);
};

ProjectConfig.prototype.extend = function(data) {
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
};

ProjectConfig.prototype.copy = function(override) {
	return new ProjectConfig(this).extend(override);
};

/**
 * Registers a transformation stream for given file glob pattern.
 * If multiple patterns will be matched for a single file,
 * the one with longer pattern will be picked
 * @param  {String} pattern Glob pattern
 * @param  {stream.Transform} stream A transformation stream
 */
ProjectConfig.prototype.transform = function(pattern, stream) {
	if (stream === null && pattern in this.transforms) {
		debug('remove pattern %s', pattern);
		return delete this.transforms[pattern];
	}

	if (typeof stream === 'object') {
		debug('register pattern %s', pattern);
		this.transforms[pattern] = stream;
	}
};

/**
 * Find matched transformation stream for given file path
 * @param  {String} filePath
 * @return {stream.Transform}
 */
ProjectConfig.prototype.match = function(filePath) {
	var patterns = Object.keys(this.transforms);
	debug('matching %s against %o', filePath, patterns);
	var matches = patterns.filter(function(pattern) {
		return minimatch(filePath, pattern);
	}).sort(function(a, b) {
		return b.length - a.length;
	});

	debug('matches found: %o', matches);

	return matches.length ? this.transforms[matches[0]] : null;
};