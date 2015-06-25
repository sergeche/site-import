/**
 * A project transformation stream: marks all files with `symlink: true`
 * property which will be used to create symlink to a file instead of copying it
 */
'use strict';

var stream = require('stream');
var util = require('util');

var SymlinkStream = module.exports = function() {
	stream.Transform.call(this, {objectMode: true});
};

util.inherits(SymlinkStream, stream.Transform);

SymlinkStream.prototype._transform = function(project, enc, next) {
	project.transform('**/*.*', new FileSymlinkStream());
	next(null, project);
};

function FileSymlinkStream() {
	stream.Transform.call(this, {objectMode: true});
}
util.inherits(FileSymlinkStream, stream.Transform);

FileSymlinkStream.prototype._transform = function(file, enc, next) {
	file.symlink = true;
	next(null, file);
};