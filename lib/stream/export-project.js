'use strict';

var stream = require('stream');
var path = require('path');
var util = require('util');
var vfs = require('vinyl-fs');
var debug = require('debug')('si:export');

var objMode = {objectMode: true};

var ExportProjectStream = module.exports = function(dest) {
	stream.Writable.call(this, objMode);
	this.dest = dest;
	this.on('finish', this.emit.bind(this, 'end'));
};
util.inherits(ExportProjectStream, stream.Writable);

ExportProjectStream.prototype._write = function(project, enc, next) {
	// project import algorithm:
	// read all files from project source, then walk on each file and apply 
	// registered transformation that matches given file
	debug('export project %s', project.src);
	var dest = path.join(this.dest, project.prefix);
	var srcOpt = {
		cwd: project.src,
		ignore: project.ignore,
		nodir: true
	};
	if (typeof project.buffer === 'boolean') {
		srcOpt.buffer = project.buffer;
	}

	var self = this;
	vfs.src('**', srcOpt)
	.pipe(new FileTransform(project))
	.pipe(new SplitDestStream(dest))
	.once('finish', function() {
		next(null, project);
		self.emit('drain');
	});
	return false;
};

function FileTransform(project) {
	stream.Transform.call(this, objMode);
	this.project = project;
	this._pushFile = this.push.bind(this);
}
util.inherits(FileTransform, stream.Transform);

FileTransform.prototype._transform = function(file, enc, next) {
	debug('exporting file %s', file.path);
	var transforms = this.project.matchedTransforms(file.path);
	if (!transforms.length) {
		debug('no matching transforms, pass through');
		return next(null, file);
	}

	// create file transformation pipeline
	var onData = this._pushFile;

	var input = transforms.shift().stream();
	var output = input;
	while (transforms.length) {
		output = output.pipe(transforms.shift().stream());
	}

	output
	.on('data', onData)
	.once('finish', function() {
		debug('file pipeline complete');
		this.removeListener('data', onData);
		next();
	});

	// start file transformation pipeline
	input.end(file);
};

FileTransform.prototype.push = function(file) {
	if (file) {
		debug('pushing transformed file %s', file.path);
	} else {
		debug('finishing file transform stream');
	}
	stream.Transform.prototype.push.call(this, file);
};

function SplitDestStream(dest) {
	stream.Transform.call(this, objMode);

	this.dest = dest;
	var self = this;
	var pending = 2;
	var onEnd = function() {
		if (--pending <= 0) {
			debug('finished project import, cleaning up');
			self.emit('finishAll');
		}
	};

	this.files = vfs.dest(dest).once('end', onEnd);
	this.symlinks = vfs.symlink(dest).once('end', onEnd);
}

util.inherits(SplitDestStream, stream.Transform);

SplitDestStream.prototype._transform = function(file, enc, next) {
	var dest = file.symlink ? this.symlinks : this.files;
	dest.write(file, enc, next);
};

SplitDestStream.prototype._flush = function(next) {
	this.once('finishAll', next);
	this.files.end();
	this.symlinks.end();
};