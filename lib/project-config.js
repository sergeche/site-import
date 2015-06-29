'use strict';

var stream = require('stream');
var extend = require('xtend');
var minimatch = require('minimatch');
var debug = require('debug')('si:project');

var ProjectConfig = module.exports = function(data) {
	// default ignore pattern
	this.ignore = ['{node_modules,bower_components}/**'];
	this.transforms = [];
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
};

/**
 * Removes previously registered transformation stream. If `factory`
 * is not passed, all transformations with the same pattern will be removed
 * @param  {String} pattern Glob pattern
 * @param  {stream.Transform} stream  Transformation stream
 */
ProjectConfig.prototype.removeTransform = function(pattern, factory) {
	this.transforms = this.transforms.filter(function(item) {
		return !(item.pattern === pattern && (!factory || factory == item.factory));
	});
};

/**
 * Find matched transformation stream for given file path
 * @param  {String} filePath
 * @return {stream.Transform}
 */
ProjectConfig.prototype.matchedTransforms = function(filePath) {
	debug('matching %s against registered patterns', filePath);
	var matches = this.transforms.filter(function(item) {
		return item.matches(filePath);
	});
	
	debug('matches found: %d', matches.length);
	return matches;
};

function TransformItem(pattern, factory, args) {
	this.pattern = pattern;
	this.factory = factory;
	this.args = args || [];
}

TransformItem.prototype.matches = function(filePath) {
	return minimatch(filePath, this.pattern);
};

TransformItem.prototype.stream = function() {
	return this.factory.apply(null, this.args);
};