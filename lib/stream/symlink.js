/**
 * A project transformation stream: marks all files with `symlink: true`
 * property which will be used to create symlink to a file instead of copying it
 */
'use strict';

var stream = require('stream');
var util = require('util');

var objMode = {objectMode: true};

var SymlinkStream = module.exports = function() {
	stream.Transform.call(this, objMode);
};

util.inherits(SymlinkStream, stream.Transform);

SymlinkStream.prototype._transform = function(project, enc, next) {
	project.addTransform('**/*.*', streamFactory, project);
	next(null, project);
};

function streamFactory(project) {
	return new FileSymlinkStream(project);
}

function FileSymlinkStream(project) {
	stream.Transform.call(this, objMode);
	this.project = project;
}
util.inherits(FileSymlinkStream, stream.Transform);

FileSymlinkStream.prototype._transform = function(file, enc, next) {
	var transforms = this.project.matchedTransforms(file.path);
	// if the only matched transform for current file is current one —
	// mark file as symlink
	file.symlink = transforms.length === 1 && transforms[0].factory === streamFactory;
	next(null, file);
};