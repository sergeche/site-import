/**
 * For given VinylFS file stream locates project path for each file
 * and creates config for it as a `project` property of vinyl file.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const stream = require('stream');
const glob = require('glob');
const debug = require('debug')('si:project-config')
const findSymlinks = require('./find-symlinks');

const rePathSep = /[\\\/]+/g;

module.exports = function(options) {
    var cache = {symlink: {}};
    return new stream.Transform({
        objectMode: true,
        transform(file, enc, next) {
            if (!cache.symlink[file.base]) {
                cache.symlink[file.base] = findSymlinks(file.base);
            }

            cache.symlink[file.base]
            .then(symlinks => {
                debug('symlinks for %s: %o', file.base, symlinks)
                return detectProject(file, symlinks, cache);
            })
            .then(project => {
                debug('saving project for %s: %o', file.relative, project);
                file.project = project;
                file.cwd = project.baseDir;
                next(null, file);
            })
            .catch(next);
        }
    });
};

function detectProject(file, symlinks, cache) {
    debug('detecting project for %s', file.base);
    cache = cache || {};
    var filePath = file.relative;
    for (var i = 0; i < symlinks.length; i++) {
        if (hasPathPrefix(filePath, symlinks[i])) {
            return generateProject(file, symlinks[i], cache);
        }
    }

    // no symlink found in path, use first folder as path prefix
    var parts = file.relative.split(rePathSep);
    return generateProject(file, parts.length > 1 ? parts[0] : '', cache);
}

function generateProject(file, prefix, cache) {
    cache = cache || {};
    prefix = normalizeUrl(prefix);
    var baseDir = path.join(file.base, prefix);
    debug('generate project for %s', baseDir);
    if (!cache[baseDir]) {
        cache[baseDir] = getProjectName(baseDir);
    }

    return cache[baseDir].then(name => {
        debug('project name: %s', name);
        var url = getUrl(file, prefix);

        return {
            baseDir,
            prefix,
            name,
            url,
            destUrl: normalizeUrl(prefix + url)
        };
    });
}

function hasPathPrefix(filePath, prefix) {
    var filePathParts = filePath.split(rePathSep);
    var prefixParts = prefix.split(rePathSep);
    return prefixParts.length <= filePathParts.length
        && prefixParts.every((part, i) => filePathParts[i] === part);
}

/**
 * Resolves project name for folder: tries to find
 * package manifest file and read `name` from it. If package manifest does not
 * exists, uses name basename of prefix
 * @param  {Object} config
 * @return {Promise}
 */
function getProjectName(dir) {
	return new Promise((resolve, reject) => {
		var name = path.basename(dir);
        debug('detecting project name for %s', dir);
		glob('{.bower,bower,package}.json', {cwd: dir}, (err, files) => {
			if (err) {
				console.warn(err);
			}

			if (files && files.length) {
				fs.readFile(path.join(dir, files[0]), 'utf8', function(err, content) {
					if (err) {
						console.warn(err);
						return resolve(name);
					}

                    resolve(JSON.parse(content).name || name);
				});
			} else {
				resolve(name);
			}
		});
	});
}

function getUrl(file, prefix) {
    var base = path.join(file.base, prefix);
    var url = normalizeUrl(path.relative(base, file.path));
    debug('get url for %s: %s', base, url);
    var basename = path.basename(url);
    if (/^index\.html?$/.test(basename)) {
        url = url.slice(0, -basename.length);
    }

    debug('clean url: %s', url);
    return url;
}

function normalizeUrl(url) {
    url = url.replace(rePathSep, '/');
    if (url[0] !== '/') {
        url = '/' + url;
    }
    return url;
}
