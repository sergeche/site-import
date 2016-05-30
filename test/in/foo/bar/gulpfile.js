var gulp = require('gulp');
var argv = require('yargs').argv;
var uglify = require('gulp-uglify');
var cssmin = require('gulp-cssmin');
var through = require('through2');

var rewriteUrl = require('./gulp-tasks/rewrite-url');
var wrapAnimations = require('./gulp-tasks/wrap');

gulp.task('watch', function() {
	gulp.watch(['animations/*/*.{js,css}', 'lib/**/*.js'], ['default']);
});

gulp.task('default', function() {
	var stream = gulp.src('animations/*/characters.css')
		.pipe(rewriteUrl())
		.pipe(cssmin())
		.pipe(wrapAnimations({
			baseUrl: './lib',
			name: 'vendor/almond',
			include: ['./che'],
			optimize: 'none',
			wrap: {
				start: 'define(function() {',
				end: ';return require(\'che\');});'
			}
		}));

	if (argv.env === 'production') {
		stream.pipe(uglify());
	}
	stream.pipe(gulp.dest('./out'));
	return stream;
});