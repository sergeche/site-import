'use strict';

var stream = require('stream');
var path = require('path');
var util = require('util');
var vfs = require('vinyl-fs');
var debug = require('debug')('si:export');

var ExportProjectStream = module.exports = function(dest) {
	stream.Writable.call(this, {objectMode: true});
	this.dest = dest;
	this.on('finish', onFinish);
};
util.inherits(ExportProjectStream, stream.Writable);

ExportProjectStream.prototype._write = function(project, enc, next) {
	// project import algorithm:
	// read all files from project source, then
	// walk on each file and apply registered 
	// transformation that matches given file
	debug('export project %s', project ? project.src : '(null)');
	var srcOpt = {
		cwd: project.src,
		ignore: project.ignore
	};
	if (typeof project.buffer === 'boolean') {
		srcOpt.buffer = project.buffer;
	}

	// pipe all registered transformation streams to fitting stream
	var fitting = new stream.PassThrough({objectMode: true});
	Object.keys(project.transforms).forEach(function(key) {
		project.transforms[key].pipe(fitting);
	});

	var self = this;
	vfs.src('**', srcOpt)
	.pipe(new FileTransform(project))
	.pipe(fitting)
	.pipe(vfs.dest(path.join(this.dest, project.prefix)))
	.on('end', function() {
		debug('finished project import, cleaning up');
		Object.keys(project.transforms).forEach(function(key) {
			project.transforms[key].unpipe(fitting);
		});
		next(null, project);
		self.emit('drain');
	});
	return false;
};


function FileTransform(project) {
	stream.Transform.call(this, {objectMode: true});
	this.project = project;
}
util.inherits(FileTransform, stream.Transform);

FileTransform.prototype._transform = function(file, enc, next) {
	debug('exporting file %s', file.path);
	var stream = this.project.match(file.path);
	if (stream) {
		debug('found matched transform, redirecting');
		stream.write(file, enc, next);
	} else {
		debug('pass through');
		next(null, file);
	}
};

function onFinish() {
	this.emit('end');
}