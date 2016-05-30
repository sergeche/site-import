/**
 * Find symlinks in given folder
 */
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = function(dir) {
    return walk('', dir).then(symlinks => symlinks.filter(Boolean));
};

function walk(dir, cwd) {
    cwd = cwd || process.cwd();
    return new Promise((resolve, reject) => {
        var absPath = path.resolve(cwd, dir || '');
        var result = [];

        fs.readdir(absPath, (err, files) => {
            if (err) {
                return reject(err);
            }

            Promise.all(files.map(f => getStats(f, absPath)))
            .then(stats => {
                var dirs = [];
                stats.forEach((stat, i) => {
                    // add each symlink to result
                    var relPath = path.join(dir, files[i]);
                    if (stat.isSymbolicLink()) {
                        result.push(relPath);
                    } else if (stat.isDirectory()) {
                        dirs.push(relPath);
                    }
                });

                if (!dirs.length) {
                    return result;
                }

                // walk deep into each subdir to find symlinks
                return Promise.all(dirs.map(dir => walk(dir, cwd)))
                .then(symlinks => symlinks.reduce((out, s) => out.concat(s), result));
            })
            .then(resolve, reject);
        });
    });
}

function getStats(file, base) {
    if (base) {
        file = path.resolve(base, file);
    }

    return new Promise((resolve, reject) => {
        fs.lstat(file, (err, stats) => err ? reject(err) : resolve(stats));
    });
}
