/**
 * Stream for transforming project files.
 *
 * NB: using stream classes instead of `through2` module to reduce memory
 * allocations since many streams allocated per file, not per session
 */
'use strict';

var stream = require('stream');
var path = require('path');
var util = require('util');
var through = require('through2');
var combine = require('stream-combiner2');
var debug = require('debug')('si:file-transform');
var FileImportError = require('../errors').FileImportError;

var objMode = {objectMode: true};

var FileTransform = module.exports = function(project) {
	stream.Transform.call(this, objMode);
	this.project = project;
	this._pushFile = this.push.bind(this);
}
util.inherits(FileTransform, stream.Transform);

FileTransform.prototype._transform = function(file, enc, next) {
	// add some useful data to file
	file.prefix = this.project.prefix;
	file.url = makeUrl(path.join(file.prefix, file.relative));
	file.originalUrl = makeUrl(file.relative);
	
	debug('exporting file %s (%s)', file.relative, file.prefix);

	var transforms = this.project.matchedTransforms(file.path);
	if (!transforms.length) {
		debug('no matching transforms, pass through');
		return next(null, file);
	}

	// create file transformation pipeline
	try {
		var pipeline = transforms.map(function(item) {
			return item.stream();
		});
	} catch(err) {
		return next(new FileImportError(file, err));
	}

	var self = this;
	pipeline.push(through.obj(function(file, enc, next) {
		self.push(file);
		next(null, file);
	}, function(_complete) {
		debug('file pipeline complete');
		next();
		_complete();
	}));


	combine.obj(pipeline)
	.on('error', function(err) {
		next(new FileImportError(file, err));
	})
	.end(file);
};

FileTransform.prototype.push = function(file) {
	if (file) {
		debug('pushing transformed %s (%s)', file.relative, file.prefix);
	} else {
		debug('finishing file transform stream');
	}
	stream.Transform.prototype.push.call(this, file);
};

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