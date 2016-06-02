'use strict';

const combine = require('stream-combiner2');
const project = require('./lib/project-config');
const grep = require('./lib/grep');
const symlink = require('./lib/write-symlink');
const rewriteUrl = require('./lib/rewrite-url');

/**
 * Default stream for site import: read project config from files in stream
 * and rewrite URLs if HTML and CSS files
 * @param  {Object} options
 * @return {stream.Transform}
 */
module.exports = function(options) {
	return combine.obj([
		project(options),
		rewriteUrl(options)
	]);
};

/**
 * Return VinylFS stream for reading project config from stream file
 * @type {stream.Transform}
 */
module.exports.project = project;

/**
 * Applies given `callback` function to files that matches given glob `pattern`
 * @param {String|Array} patterns
 * @param {Function} callback
 * @type {stream.Transform}
 */
module.exports.grep = grep;

/**
 * Returns stream that rewrites URL in HTML and CSS files. Rewrite is performed
 * with data from project config
 * @type {stream.Transform}
 */
module.exports.rewriteUrl = rewriteUrl;

/**
 * Returns stream that will create symlinks for files matching given `patterns`.
 * These files won’t be passed further to prevent from saving file via VinylFS
 * `.dest()` method
 * @type {stream.Transform}
 */
module.exports.symlink = symlink;
