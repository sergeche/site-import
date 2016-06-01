'use strict';

const assert = require('assert');
const stream = require('stream');
const vfs = require('vinyl-fs');
const grep = require('../lib/grep');
const dummy = require('./assets/dummy-writer');

describe('Grep', () => {
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

    function src() {
        return vfs.src('./sample-project/**', {cwd: __dirname, nodir: true});
    }

    it('single pattern', done => {
        var files = [];
        var accum = accumulator();

        src().pipe(accum)
        .pipe(grep('**/*.html', (file, enc, next) => {
            files.push(file.relative);
            next(null, file);
        })).on('error', done)
		.pipe(dummy())
		.on('end', () => {
            assert.deepEqual(files.sort(), ['about/index.html', 'index.html']);
            assert(files.length < accum.items.length);
			done();
		});
    });

    it('multiple patterns', done => {
        var files = [];
        var accum = accumulator();

        src().pipe(accum)
        .pipe(grep(['**/*.html', '**/*.css', '!about/index.html'], (file, enc, next) => {
            files.push(file.relative);
            next(null, file);
        })).on('error', done)
		.pipe(dummy())
		.on('end', () => {
            assert.deepEqual(files.sort(), ['index.html', 'style.css']);
            assert(files.length < accum.items.length);
			done();
		});
    });

    it('single negative', done => {
        var files = [];
        var accum = accumulator();

        src().pipe(accum)
        .pipe(grep('!**/*.{html,css}', (file, enc, next) => {
            files.push(file.relative);
            next(null, file);
        })).on('error', done)
		.pipe(dummy())
		.on('end', () => {
            assert.deepEqual(files.sort(), ['bower.json', 'img/smiley.png']);
            assert(files.length < accum.items.length);
			done();
		});
    });
});
