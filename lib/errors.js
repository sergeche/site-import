/**
 * Collection of project import error classes
 */
'use strict';
var util = require('util');

var FileImportError = module.exports.FileImportError = function(file, err) {
	Error.call(this);
	this.file = file.path;
	this.message = err.message + ' in file ' + file.path + '\n';
	Object.keys(err).forEach(function(key) {
		if (key !== 'message') {
			this[key] = err[key];
		}
	}, this);
	this.stack = formatStackTrace(err.stack, this.message);
}
util.inherits(FileImportError, Error);

var ProjectImportError = module.exports.ProjectImportError = function(project, err) {
	Error.call(this);
	this.message = err.message + ' of project ' + project.prefix + '\n';
	this.project = project.prefix;
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