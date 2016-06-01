/**
 * Dummy object stream writer: consumes vinyl files to let stream flow
 */
'use strict';

const stream = require('stream');

module.exports = function() {
    var writer = new stream.Writable({
        objectMode: true,
        write(obj, enc, next) {
            next();
        }
    });

    writer.on('finish', () => writer.emit('end'));
    return writer;
};
