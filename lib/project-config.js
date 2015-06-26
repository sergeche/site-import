'use strict';

var stream = require('stream');
var extend = require('xtend');
var minimatch = require('minimatch');
var DuplexStream = require('./stream/duplex');
var debug = require('debug')('si:project');

var ProjectConfig = module.exports = function(data) {
	// default ignore pattern
	this.ignore = ['{node_modules,bower_components}/**'];
	this.transforms = [];
	this._pipelineCache = {
		noop: new stream.PassThrough({objectMode: true})
	};
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
 * @param  {Function} factory A stream costruction factory
 */
ProjectConfig.prototype.addTransform = function(pattern, factory) {
	this.transforms.push(new TransformItem(pattern, factory, Array.prototype.slice.call(arguments, 2)));
	this.reset();
};

/**
 * Removes previously registered transformation stream. If `factory`
 * is not passed, all transformations with the same pattern will be removed
 * @param  {String} pattern Glob pattern
 * @param  {stream.Transform} stream  Transformation stream
 */
ProjectConfig.prototype.removeTransform = function(pattern, factory) {
	var prevLen = this.transforms.length;
	this.transforms = this.transforms.filter(function(item) {
		return !(item.pattern === pattern && (!factory || factory == item.factory));
	});

	if (this.transforms.length !== prevLen) {
		this.reset();
	}
};

/**
 * Find matched transformation stream for given file path
 * @param  {String} filePath
 * @return {stream.Transform}
 */
ProjectConfig.prototype.match = function(filePath) {
	debug('matching %s against registered patterns', filePath);
	var matches = this.transforms.filter(function(item) {
		return item.matches(filePath);
	});
	
	debug('matches found: %d', matches.length);
	return matches;
};

/**
 * Creates transformation pipeline for given file name
 * @param  {String} filePath
 * @return {stream}
 */
ProjectConfig.prototype.createPipeline = function(filePath) {
	var matches = this.match(filePath);
	if (!matches.length) {
		debug('use noop pipeline');
		return this._pipelineCache.noop;
	}

	var cacheKey = matches.map(function(item) {
		return item.id;
	}).join(':');

	if (!this._pipelineCache[cacheKey]) {
		debug('creating pipeline for %s with %d %s', filePath, matches.length, 
			matches.length === 1 ? 'stream' : 'streams');

		var pipeline = matches.map(function(item) {
			return item.stream();
		});

		var s = new DuplexStream();
		s.inject.apply(s, pipeline);
		this._pipelineCache[cacheKey] = s;
	}

	return this._pipelineCache[cacheKey];
};

ProjectConfig.prototype.reset = function() {
	Object.keys(this._pipelineCache).forEach(function(key) {
		var stream = this._pipelineCache[key];
		stream.unpipe();
		if (key !== 'noop') {
			delete this._pipelineCache[key];
		}
	}, this);
}

function TransformItem(pattern, factory, args) {
	this.id = TransformItem._id++;
	this.pattern = pattern;
	this.factory = factory;
	this.args = args || [];
}

TransformItem._id = 0;

TransformItem.prototype.matches = function(filePath) {
	return minimatch(filePath, this.pattern);
};

TransformItem.prototype.stream = function() {
	return this.factory.apply(null, this.args);
};