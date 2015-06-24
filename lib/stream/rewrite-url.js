/**
 * A transformation stream for setting default url transforms
 * on files of current project
 */
'use strict';

var stream = require('stream');
var extend = require('xtend');
var htmlTransform = require('html-transform');
var cssTransform = require('html-transform');

module.exports = class RewriteUrlStream extends stream.Transform {
	constructor(config) {
		super({objectMode: true});
		this.config = config || {};
	}

	_transform(project, enc, next) {
		var config = extend({prefix: project.prefix}, this.config);
		project.transform('*.html', htmlTransform(config));
		project.transform('*.css', cssTransform(config));
		return next(null, project);
	}
}