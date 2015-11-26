'use strict';

var ReadConfigStream = require('./lib/stream/read-config');
var RewriteUrlStream = require('./lib/stream/rewrite-url');
var ExportProjectStream = require('./lib/stream/export-project');
var SymlinkStream = require('./lib/stream/symlink');
var FileTransformStream = require('./lib/stream/file-transform');

/**
 * Creates readable stream with project configs in given `src` path
 * @param  {String} src
 * @return {ReadConfigStream}
 */
module.exports.src = function(src, options) {
	return new ReadConfigStream(src, options);
};

/**
 * Creates writable stream that exports projects defined in incoming
 * configs into `dest` folder
 * @param  {String} dest
 * @return {ExportProjectStream}
 */
module.exports.dest = function(dest, options) {
	return new ExportProjectStream(dest, options);
};

/**
 * Creates a transformation stream for rewriting URLs on imported files
 * @param  {Object} config Rewrite config
 * @return {RewriteUrlStream}
 */
module.exports.rewriteUrl = function(config) {
	return new RewriteUrlStream(config);
};

/**
 * Creates a transformation stream marking all files in current project that
 * has no transformations to be symlinked instead of copied
 * @return {SymlinkStream}
 */
module.exports.symlink = function() {
	return new SymlinkStream();
};

/**
 * A helper function that creates project’s file transform stream. Used by 
 * custom project consumers
 * @param  {Object} config Rewrite config
 * @return {FileTransformStream}
 */
module.exports.fileTransform = function(project) {
	return new FileTransformStream(project);
};

/**
 * Expose project config class for creating custom readers
 */
module.exports.ProjectConfig = require('./lib/project-config');