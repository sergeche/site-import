/**
 * Locates symlinks in given folder and resolved to array of relative
 * paths to symlinks. Additionally, array contains `dir` property that
 * point to absolute path for given folder
 */
'use strict';

var path = require('path');
var glob = require('glob');
var debug = require('debug')('si:locate-symlinks');
require('es6-promise').polyfill();

module.exports = function(dir) {
	return new Promise(function(resolve, reject) {
		dir = path.resolve(dir);
		debug('locating symlinks in %s', dir);
		var g = new glob.Glob('**', {cwd: dir, follow: false}, function(err, files) {
			if (err) {
				debug('got error %o', err);
				return reject(err);
			}

			// filter symlinks and make them relative
			var symlinks = Object.keys(g.symlinks).filter(function(p) {
				return g.symlinks[p];
			}).map(function(p) {
				return path.relative(dir, p);
			});

			symlinks.dir = dir;
			debug('found symlinks %o', symlinks);
			resolve(symlinks);
		});
	});
};