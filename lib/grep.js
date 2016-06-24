/**
 * Simple file stream grep: applies given function only if context file
 * path matches given pattern
 */
'use strict';

const stream = require('stream');
const Minimatch = require('minimatch').Minimatch;

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
            negative.push(new Minimatch(p.slice(1)));
        } else {
            positive.push(new Minimatch(p));
        }
    })

    return new stream.Transform({
        objectMode: true,
        transform(file, enc, next) {
            if (!positive.length || matches(positive, file.relative)) {
                if (!matches(negative, file.relative)) {
                    try {
                        return callback.call(this, file, enc, next);
                    } catch(err) {
                        return next(err);
                    }
                }
            }

            next(null, file);
        }
    });
};

function matches(globs, str) {
    return globs.some(pattern => pattern.match(str));
}
