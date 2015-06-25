'use strict';

var ReadConfigStream = require('./lib/stream/read-config');
var RewriteUrlStream = require('./lib/stream/rewrite-url');
var ExportProjectStream = require('./lib/stream/export-project');

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

/**
 * Creates a transformation stream for rewriting URLs on imported files
 * @param  {Object} config Rewrite config
 * @return {RewriteUrlStream}
 */
module.exports.rewriteUrl = function(config) {
	return new RewriteUrlStream(config);
};