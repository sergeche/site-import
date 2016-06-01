'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const stream = require('stream');
const del = require('del');
const vfs = require('vinyl-fs');
const symlink = require('../lib/write-symlink');
const dummy = require('./assets/dummy-writer');

describe.only('Symlink', () => {
    const destDir = './out-symlink';
    function accumulator() {
        var s = new stream.Transform({
            objectMode: true,
            transform(file, enc, next) {
                this.items.push(file.relative);
                next(null, file);
            }
        });
        s.items = [];
        return s;
    }

    before(function(done) {
		del(path.join(__dirname, destDir), done);
	});

    it('save & filter symlinks', done => {
        var accum = accumulator();

        vfs.src('./sample-project/**', {cwd: __dirname, nodir: true})
        .pipe(symlink('!**/*.{html,css}', {dest: destDir, cwd: __dirname}))
        .pipe(accum)
        .pipe(dummy())
        .on('end', () => {
            // destination stream should countain *.html & *.css files only,
            // all the others should be saved as symlinks
            const stat = file => fs.lstatSync(path.resolve(__dirname, destDir, file));
            assert.deepEqual(accum.items.sort(), ['about/index.html', 'index.html', 'style.css']);
            assert(stat('bower.json').isSymbolicLink());
            assert(stat('img/smiley.png').isSymbolicLink());
            done();
        });
    });
});
