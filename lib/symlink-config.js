/**
 * Resolves given symlink list to project config
 */
'use strict';

var path = require('path');
var stream = require('stream');
var fs = require('graceful-fs');
var glob = require('glob');
var extend = require('xtend');
var debug = require('debug')('si:symlink-config');
var ProjectConfig = require('./project-config');
require('es6-promise').polyfill();

module.exports = function(symlinks) {
	return new Promise(function(resolve, reject) {
		var dir = symlinks.dir || process.cwd();
		var configs = [];
		symlinks = symlinks.slice(0);

		var next = function(config) {
			if (config && !(config instanceof Error)) {
				configs.push(config);
			}

			if (!symlinks.length) {
				resolve(configs);
				return dir = configs = symlinks = null;
			}

			createConfig({
				basePath: dir,
				prefix: symlinks.pop()
			})
			// If we were unable to properly create project import config,
			// do not throw/reject with error, simply ignore this entry
			.then(next, next);
		};
		next();
	});
};

var createConfig = module.exports.create = function(data) {
	debug('creating config %o', data);
	return Promise.resolve(new ProjectConfig(data))
	.then(realPath)
	.then(projectName);
};

/**
 * Get real path for given config object by resolving symlink path
 * @param  {Object} config
 * @return {Promise}
 */
function realPath(config) {
	return new Promise(function(resolve, reject) {
		var p = path.join(config.basePath, config.prefix);
		fs.realpath(p, function(err, real) {
			if (err) {
				console.warn('Unable to resolve %s: %s', p, err.message);
				return reject(err);
			}

			resolve(config.copy({src: real}));
		});
	});
}

/**
 * Resolves project name for given config object: tries to find
 * package manififest file and read `name` from it. If package manifest does not 
 * exists, uses name basename of symlink
 * @param  {Object} config
 * @return {Promise}
 */
function projectName(config) {
	return new Promise(function(resolve, reject) {
		config.name = path.basename(config.prefix);
		glob('{.bower,bower,package}.json', {cwd: config.src}, function(err, files) {
			if (err) {
				console.warn(err);
			}

			if (files && files.length) {
				fs.readFile(path.join(config.src, files[0]), 'utf8', function(err, content) {
					if (err) {
						console.warn(err);
						return resolve(config);
					}

					resolve(config.copy({name: JSON.parse(content).name || config.name}));
				});
			} else {
				resolve(config);
			}
		});
	});
}