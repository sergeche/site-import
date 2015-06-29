var imp = require('./');
var through = require('through2');

imp.src('./test/in/')
.pipe(imp.rewriteUrl(function(url, file, ctx) {
	if (ctx.stats) {
		url = '/-/' + ctx.stats.hash + url;
	}
	return url;
}))
.pipe(through.obj(function(project, enc, next) {
	project.addTransform('**/*.html', function() {
		return through.obj(function(file, enc, next) {
			var contents = file.contents.toString().replace(/<\/body>/i, '<!-- inject --></body>');
			file.contents = new Buffer(contents);
			setTimeout(function() {
				next(null, file);
			}, 100);
		});
	});
	next(null, project);
}))
.pipe(imp.symlink())
.pipe(imp.dest('./out'))
.on('end', function() {
	console.log('Finished project import');
})
.on('error', function(err) {
	console.error(err);
});