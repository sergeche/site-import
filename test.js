var imp = require('./');
var through = require('through2');


var input = through.obj(function(obj, enc, next) {
	console.log('write a');
	obj.contents += 'a';
	next(null, obj);
});

input
.pipe(through.obj(function(obj, enc, next) {
	setTimeout(function() {
		console.log('write b');
		obj.contents += 'b';
		next(null, obj);
	}, 1000);
}))
.pipe(through.obj(function(obj, enc, next) {
	console.log('write c');
	obj.contents += 'c';
	console.log('contents', obj);
	next(null, obj);
}))
.on('end', function() {
	console.log('complete');
});

console.log('writing');
input.write({contents: ''});


// imp.src('./test/in/')
// .pipe(imp.rewriteUrl(function(url, file, ctx) {
// 	if (ctx.stats) {
// 		url = '/-/' + ctx.stats.hash + url;
// 	}
// 	return url;
// }))
// .pipe(through.obj(function(project, enc, next) {
// 	project.addTransform('**/*.html', function() {
// 		return through.obj(function(file, enc, next) {
// 			var contents = file.contents.toString().replace(/<\/body>/i, '<!-- inject --></body>');
// 			file.contents = new Buffer(contents);
// 			console.log('do rewrite');
// 			setTimeout(function() {
// 				console.log('call next');
// 				next(null, file);
// 			}, 300);
// 		});
// 	});
// 	next(null, project);
// }))
// // .pipe(imp.symlink())
// .pipe(imp.dest('./out'))
// .on('end', function() {
// 	console.log('Finished project import');
// })
// .on('error', function(err) {
// 	console.error(err);
// });