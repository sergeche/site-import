/**
 * Grep stream that creates symlinks for matched files. These files are not
 * passed down to prevent from saving Vinyl files as regular files via `.dest()`
 * method
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const grep = require('./grep');

module.exports = function(pattern, options) {
    var cache = new Set();
    return grep(pattern, function(file, enc, next) {
        prepareWrite(file, options, cache)
        .then(writePath => {
            var srcPath = file.history[0];
            var symlinkPath = path.relative(path.dirname(writePath), srcPath);
    		fs.symlink(symlinkPath, writePath, function(err) {
                // do not pass file further
    			next(err && err.code !== 'EEXIST' ? err : null);
    		});
        })
        .catch(next);
    });
};

function prepareWrite(file, options, cache) {
    return new Promise((resolve, reject) => {
        options = Object.assign({
            cwd: process.cwd(),
            dest: '',
            dirMode: null
        }, options);

        var cwd = path.resolve(options.cwd);
        var outFolderPath = stringOrFunc(options.dest, file);
        if (!outFolderPath) {
            return reject(new Error('Invalid output folder'));
        }

        var basePath = options.base ?
            stringOrFunc(options.base, file) : path.resolve(cwd, outFolderPath);
        if (!basePath) {
            throw new Error('Invalid base option');
        }

        var writePath = path.resolve(basePath, file.relative);
        var writeFolder = path.dirname(writePath);

        // for less disk I/O
        if (cache && cache.has(writeFolder)) {
            return resolve(writePath)
        }

        var mkdirpOpts = {mode: options.dirMode};
        mkdirp(writeFolder, mkdirpOpts, err => {
            if (err) {
                return reject(err);
            }
            cache && cache.add(writeFolder);
            resolve(writePath);
        });
    });
}

function stringOrFunc(v, file) {
    if (typeof v !== 'string' && typeof v !== 'function') {
        return null;
    }

    return typeof v === 'string' ? v : v(file);
}
