/**
 * Simple file stream grep: applies given function only if context file
 * path matches given pattern
 */
'use strict';

const stream = require('stream');
const Minimatch = require('minimatch').Minimatch;

module.exports = function(pattern, transform, flush) {
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
    });

    return new stream.Transform({
        objectMode: true,
        transform(file, enc, next) {
            try {
                if (!positive.length || matches(positive, file.relative)) {
                    if (!matches(negative, file.relative)) {
                        return transform.call(this, file, enc, next);
                    }
                }
            } catch(err) {
                return next(err);
            }

            next(null, file);
        },

        flush(next) {
            if (flush) {
                try {
                    return flush.call(this, next);
                } catch(err) {
                    return next(err);
                }
            }

            next();
        }
    });
};

function matches(globs, str) {
    return globs.some(pattern => pattern.match(str));
}
