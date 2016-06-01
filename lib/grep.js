/**
 * Simple file stream grep: applies given function only if context file
 * path matches given pattern
 */
'use strict';

const stream = require('stream');
const minimatch = require('minimatch');

module.exports = function(pattern, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = null;
    }

    if (!Array.isArray(pattern)) {
        pattern = [pattern];
    }

    var positive = [], negative = [];
    pattern.forEach(p => {
        if (p[0] === '!') {
            negative.push(p.slice(1));
        } else {
            positive.push(p);
        }
    })

    return new stream.Transform({
        objectMode: true,
        transform(file, enc, next) {
            if (!positive.length || matches(positive, file.relative, options)) {
                if (!matches(negative, file.relative, options)) {
                    return callback.call(this, file, enc, next);
                }
            }

            next(null, file);
        }
    });
};

function matches(globs, str, options) {
    return globs.some(pattern => minimatch(str, pattern, options));
}
