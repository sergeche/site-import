'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const stream = require('stream');
const del = require('del');
const vfs = require('vinyl-fs');
const transform = require('../');

function p(file) {
	return path.join(__dirname, file);
}

function read(file) {
	return fs.readFileSync(p(file), 'utf8');
}

function readStream(s, callback) {
	var chunks = [];
	return s.pipe(new stream.Writable({
		write(chunk, enc, next) {
			chunks.push(chunk);
			next();
		}
	}))
	.on('finish', () => callback(null, Buffer.concat(chunks)))
	.on('error', callback);
}

describe('Import site', function() {
	before(function(done) {
		del(path.join(__dirname, './out'), done);
	});

	it('import', function(done) {
		// create import pipeline
		var injectCode = '<!-- inject -->';
		var projects = new Set();

		vfs.src('./in/**', {cwd: __dirname, follow: true, nodir: true})
		.pipe(transform(function(url, file, ctx) {
			// rewrite url for cache-busting
			return ctx.stats ? '/-/' + ctx.stats.hash + url : url;
		})).on('error', done)
		.pipe(new stream.Transform({
			// calculate how much distinct projects we have
			objectMode: true,
			transform(file, enc, next) {
				projects.add(file.project.prefix);
				next(null, file);
			}
		}))
		.pipe(transform.grep('**/*.html', (file, enc, next) => {
			// custom html transform: inject something into code in async mode
			readStream(file, (err, contents) => {
				if (err) {
					return next(err);
				}
				file.contents = new Buffer(contents.toString().replace(/(<\/body>)/i, injectCode + '$1'));
				next(null, file);
			});
		})).on('error', done)
		// make symlinks for all files except ones that must be rewritten
		.pipe(transform.symlink('!**/*.{html,css}', {dest: './out', cwd: __dirname}))
		.on('error', done)
		.pipe(vfs.dest('./out', {cwd: __dirname}))
		.on('end', function() {
			assert.equal(projects.size, 5);

			// validate imported project
			var contents = read('out/p1/index.html');
			assert(contents.indexOf(injectCode) !== -1);
			assert.equal(contents, read('fixtures/p1/index.html'));
			assert.equal(read('out/p1/style.css'), read('fixtures/p1/style.css'));
			assert.equal(read('out/foo/bar/zzz/style.css'), read('fixtures/zzz/style.css'));

			var stat = fs.lstatSync(p('out/p1/bower.json'));
			assert(stat.isSymbolicLink());
			assert.equal(fs.realpathSync(p('out/p1/bower.json')), p('sample-project/bower.json'));

			done();
		})
		.on('error', done);
	});
});
