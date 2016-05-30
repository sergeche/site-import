var fs = require('fs');
var path = require('path');
var assert = require('assert');
var stream = require('stream');
var through = require('through2');
var del = require('del');
var vfs = require('vinyl-fs');
var findSymlinks = require('../lib/find-symlinks');
var projectConfig = require('../lib/project-config2');
// var imp = require('../');

function p(file) {
	return path.join(__dirname, file);
}

function read(file) {
	return fs.readFileSync(p(file), 'utf8');
}

describe('Import site', function() {
	before(function(done) {
		del(path.join(__dirname, './out'), done);
	});
	
	it('import', function(done) {
		// create import pipeline
		var injectCode = '<!-- inject -->';
		var projects = 0;

		imp.src('./in', {cwd: __dirname})
		.pipe(imp.rewriteUrl(function(url, file, ctx) {
			// rewrite url for cache-busting
			return ctx.stats ? '/-/' + ctx.stats.hash + url : url;
		}))
		.pipe(through.obj(function(project, enc, next) {
			projects++;

			// custom html transform: inject something into code in async mode
			project.addTransform('**/*.html', function() {
				return through.obj(function(file, enc, next) {
					var contents = file.contents.toString().replace(/(<\/body>)/i, injectCode + '$1');
					file.contents = new Buffer(contents);
					setTimeout(function() {
						next(null, file);
					}, 10);
				});
			});
			next(null, project);
		}))
		.pipe(imp.symlink())
		.pipe(imp.dest('./out', {cwd: __dirname}))
		.on('end', function() {
			assert.equal(projects, 2);

			// validate imported project
			var contents = read('out/p1/index.html');
			assert(contents.indexOf(injectCode) !== -1);
			assert.equal(contents, read('fixtures/p1/index.html'));
			assert.equal(read('fixtures/p1/style.css'), read('fixtures/p1/style.css'));

			var stat = fs.lstatSync(p('out/p1/bower.json'));
			assert(stat.isSymbolicLink());
			assert.equal(fs.realpathSync(p('out/p1/bower.json')), p('sample-project/bower.json'));

			done();
		});
	});
});
