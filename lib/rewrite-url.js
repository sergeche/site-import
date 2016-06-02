/**
 * Rewrites URLs in matched files
 */
'use strict';

const path = require('path');
const stream = require('stream');
const debug = require('debug')('si:rewrite-url');
const htmlTransform = require('html-transform');
const cssTransform = require('css-transform');

module.exports = function(options) {
    return new stream.Transform({
        objectMode: true,
        transform(file, enc, next) {
            var transform;
            var ext = path.extname(file.path);

            if (ext === '.css') {
                transform = cssTransform;
            } else if (ext === '.html' || ext === '.htm') {
                transform = htmlTransform;
            }

            if (transform) {
                transform(file, createConfig(file, options))
                .then(file => next(null, file), next);
            } else {
                next(null, file);
            }
        }
    });
};

function createConfig(file, options) {
    if (typeof options === 'function') {
        options = Object.assign({transformUrl: options}, options);
    }

    return Object.assign({
        prefix: file.project.prefix,
        baseDir: file.project.baseDir
    }, options);
}
