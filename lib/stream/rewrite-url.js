/**
 * A transformation stream for setting default url transforms
 * on files of current project
 */
'use strict';

var stream = require('stream');
var extend = require('xtend');
var util = require('util');
var debug = require('debug')('si:rewrite-url');
var htmlTransform = require('html-transform');
var cssTransform = require('css-transform');

var RewriteUrlStream = module.exports = function(config) {
	stream.Transform.call(this, {objectMode: true});
	if (typeof config === 'function') {
		config = {transformUrl: config};
	}

	this.config = config || {};
};

util.inherits(RewriteUrlStream, stream.Transform);

RewriteUrlStream.prototype._transform = function(project, enc, next) {
	var config = extend({prefix: project.prefix}, this.config);
	debug('register pattern transformers');
	project.transform('**/*.html', htmlTransform(config));
	project.transform('**/*.css', cssTransform(config));
	return next(null, project);
};