/**
 * Stream for saving transformed files. Depending on `symlink` property
 * of file, it is saved or symlinked to destination folder.
 *
 * NB: using stream classes instead of `through2` module to reduce memory
 * allocations since many streams allocated per file, not per session
 */
'use strict';

var stream = require('stream');
var path = require('path');
var fs = require('graceful-fs');
var util = require('util');
var vfs = require('vinyl-fs');
var prepareWrite = require('vinyl-fs/lib/prepareWrite');
var debug = require('debug')('si:export');

var objMode = {objectMode: true};

var ExportProjectStream = module.exports = function(dest, options) {
	stream.Writable.call(this, objMode);
	this.dest = dest;
	this.options = options;
	this.on('finish', this.emit.bind(this, 'end'));
};
util.inherits(ExportProjectStream, stream.Writable);

ExportProjectStream.prototype._write = function(project, enc, next) {
	// project import algorithm:
	// read all files from project source, then walk on each file and apply 
	// registered transformation that matches given file
	debug('export project %s', project.src);
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
	.pipe(new FileTransform(project)).once('error', function(err) {
		next(new ProjectImportError(project, err));
	})
	.pipe(new DestStream(this.dest, this.options))
	.once('finish', function() {
		next(null, project);
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
	// add some useful data to file
	file.prefix = this.project.prefix;
	file.url = makeUrl(file.relative);
	file.humanUrl = makeUrl(path.join(file.prefix, file.relative));
	
	debug('exporting file %s (%s)', file.relative, file.prefix);

	var transforms = this.project.matchedTransforms(file.path);
	if (!transforms.length) {
		debug('no matching transforms, pass through');
		return next(null, file);
	}

	// create file transformation pipeline
	var onData = this._pushFile;
	var onError = function(err) {
		output.emit('error', err);
	};

	var pipeline = transforms.map(function(item) {
		return item.stream();
	});

	var input = pipeline[0];
	var output = input;
	for (var i = 1, il = pipeline.length; i < il; i++) {
		output = output.once('error', onError).pipe(pipeline[i]);
	}

	output
	.on('data', onData)
	.once('error', function(err) {
		next(new FileImportError(file, err));
	})
	.once('finish', function() {
		debug('file pipeline complete');
		this.removeListener('data', onData);
		for (var i = 0, il = pipeline.length; i < il; i++) {
			pipeline[i].removeListener('error', onError);
		}
		next();
	});

	// start file transformation pipeline
	input.end(file);
};

FileTransform.prototype.push = function(file) {
	if (file) {
		debug('pushing transformed %s (%s)', file.relative, file.prefix);
	} else {
		debug('finishing file transform stream');
	}
	stream.Transform.prototype.push.call(this, file);
};

function DestStream(dest, options) {
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

	this.files = vfs.dest(dest, options).once('end', onEnd);
	this.symlinks = new SymlinkStream(dest, options).once('end', onEnd);
}

util.inherits(DestStream, stream.Transform);

DestStream.prototype._transform = function(file, enc, next) {
	var dest = file.symlink ? this.symlinks : this.files;
	if (file.prefix) {
		file.path = path.join(file.base, file.prefix, file.relative);
	}
	dest.write(file, enc, next);
};

DestStream.prototype._flush = function(next) {
	this.once('finishAll', next);
	this.files.end();
	this.symlinks.end();
};

/**
 * Creates symlink for given file. Pretty much the same as VinylFS’ symlink()
 * but ensures that symlink is relative and it’s uses original file path instead 
 * of current one
 * @param {String|Function} out Destination folder
 * @param {Object} options
 */
function SymlinkStream(out, options) {
	stream.Transform.call(this, objMode);
	this.out = out;
	this._options = options;
	this.resume();
}

util.inherits(SymlinkStream, stream.Transform);

SymlinkStream.prototype._transform = function(file, enc, next) {
	var srcPath = file.history[0];

	prepareWrite(this.out, file, this._options, function(err, writePath) {
		if (err) {
			return next(err);
		}

		var symlinkPath = path.relative(path.dirname(writePath), srcPath);
		fs.symlink(symlinkPath, writePath, function(err) {
			if (err && err.code !== 'EEXIST') {
				return next(err);
			}
			next(null, file);
		});
	});
};

function FileImportError(file, err) {
	Error.call(this);
	this.message = err.message + 'in file ' + file.path + '\n';
	Object.keys(err).forEach(function(key) {
		if (key !== 'message') {
			this[key] = err[key];
		}
	}, this);
	this.stack = formatStackTrace(err.stack, this.message);
}
util.inherits(FileImportError, Error);

function ProjectImportError(project, err) {
	Error.call(this);
	this.message = err.message + 'of project ' + project.prefix + '\n';
	Object.keys(err).forEach(function(key) {
		if (key !== 'message') {
			this[key] = err[key];
		}
	}, this);
	this.stack = formatStackTrace(err.stack, this.message);
}

util.inherits(ProjectImportError, Error);

function formatStackTrace(stacktrace, message) {
	var parts = stacktrace.split(/\n{2,}/);
	return 'Error: ' + message.trim() + '\n\n' + (parts[1] || parts[0]);
}

function makeUrl(file) {
	if (file[0] !== '/') {
		file = '/' + file;
	}

	if (/^index\.\w+$/.test(path.basename(file))) {
		file = path.dirname(file);
		if (file[file.length - 1] !== '/') {
			file += '/';
		}
	}

	return file;
}