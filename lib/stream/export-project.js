'use strict';

var stream = require('stream');
var path = require('path');
var util = require('util');
var vfs = require('vinyl-fs');
var debug = require('debug')('si:export');
var DuplexStream = require('./duplex');

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
	DuplexStream.call(this, {objectMode: true});
	this.project = project;
}
util.inherits(FileTransform, DuplexStream);

FileTransform.prototype._write = function(file, enc, next) {
	debug('exporting file %s', file.path);
	var pipeline = this.project.createPipeline(file.path);
	if (!isPiped(pipeline, this._readable)) {
		debug('send pipeline data to file transform stream');
		pipeline.pipe(this._readable);
	} else {
		debug('file transform is already piped');
	}
	pipeline.write(file, enc, next);
};

// FileTransform.prototype._transform = function(file, enc, next) {
// 	debug('exporting file %s', file.path);
// 	var pipeline = this.project.createPipeline(file.path);
// 	if (!isPiped(pipeline, this)) {
// 		debug('send pipeline data to file transform stream');
// 		pipeline.pipe(this);
// 	} else {
// 		debug('file transform is already piped');
// 	}
// 	pipeline.write(file, enc, next);
// };

function onFinish() {
	this.emit('end');
}

/**
 * Check if `dest` stream is piped into `src` stream
 * @param  {stream}  src  Readable stream
 * @param  {stream}  dest Writable stream
 * @return {Boolean}
 */
function isPiped(src, dest) {
	// XXX might be very hacky because `.pipes` property is not
	// officially documented
	return Array.isArray(src.pipes) ? src.pipes.indexOf(dest) !== -1 : src.pipes === dest;
}

function SymlinkFilterFiles(keepSymlinks) {
	stream.Transform.call(this, {objectMode: true});
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