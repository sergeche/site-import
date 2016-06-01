'use strict';

const assert = require('assert');
const stream = require('stream');
const vfs = require('vinyl-fs');
const projectConfig = require('../lib/project-config2');
const dummy = require('./assets/dummy-writer');

describe('Detect project config for file', () => {
    it('file-based config', done => {
		var fileMap = {};

		vfs.src('./in/**', {cwd: __dirname, follow: true, nodir: true})
		.pipe(projectConfig()).on('error', done)
		.pipe(new stream.Transform({
			objectMode: true,
			transform(file, enc, next) {
				fileMap[file.relative] = file.project;
				next(null, file);
			}
		}))
		.pipe(dummy())
		.on('end', () => {
			let project = fileMap['build.sh'];
			assert.equal(project.prefix, '/');
			assert.equal(project.name, 'in', 'Get project name from parent folder');
			assert.equal(project.url, '/build.sh');

			project = fileMap['p1/about/index.html'];
			assert.equal(project.prefix, '/p1');
			assert.equal(project.name, 'demo-project', 'Get project name from bower.json');
			assert.equal(project.url, '/about/');

			project = fileMap['p2/img/smiley.png'];
			assert.equal(project.prefix, '/p2');
			assert.equal(project.name, 'p2', 'Get project name from parent folder');
			assert.equal(project.url, '/img/smiley.png');

			done();
		});
	});
});
