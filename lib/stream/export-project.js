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
	// read all files from project source, then
	// walk on each file and apply registered 
	// transformation that matches given file
	debug('export project %s', project ? project.src : '(null)');
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
	var output = vfs.src('**', srcOpt).pipe(new FileTransform(project));

	// split output stream in two parts: one will copy/save actual files, 
	// another one will symlink files instead
	var pending = 2;
	var onEnd = function() {
		if (--pending <= 0) {
			debug('finished project import, cleaning up');
			next(null, project);
			self.emit('drain');
		}
	};

	// copy/save files
	output
	.pipe(new SymlinkFilterFiles())
	.pipe(vfs.dest(dest))
	.on('end', onEnd);

	// symlink files
	output
	.pipe(new SymlinkFilterFiles(true))
	.pipe(vfs.symlink(dest))
	.on('end', onEnd);

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

function SymlinkFilterFiles(keepSymlinks) {
	stream.Transform.call(this, objMode);
	this.keepSymlinks = !!keepSymlinks;
}
util.inherits(SymlinkFilterFiles, stream.Transform);

SymlinkFilterFiles.prototype._transform = function(file, enc, next) {
	if (this.keepSymlinks === !!file.symlink) {
		debug('keep %s file: %s', this.keepSymlinks ? 'symlink' : 'non-symlink', file.path);
		this.push(file);
	}
	next();
};