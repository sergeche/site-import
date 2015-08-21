# Импорт статических сайтов [![Build Status](https://travis-ci.org/InnovaCo/site-import.svg?branch=master)](https://travis-ci.org/InnovaCo/site-import)

Механизм импорта статических сайтов в структуру другого сайта: копирует файлы из внешнего сайта в указанную папку текущего сайта таким образом, чтобы этот внешний сайт стал частью текущего, с правильной навигацией между страницами и ссылками на ресурсы. 

## Возможности

* Автоматическая перезапись абсолютных и относительных ссылок на страницы и файлы внутри HTML и CSS.
* При перезаписи ссылок на ресурсы сайта (графика, CSS, JS и т.д.) можно получать мета-информацию о файле и использовать её для генерации ссылок со сбросом кэша. Например, использовать CRC32 от содержимого файла или дату последней модификации.
* Файлы, в которых не меняется содержимое при импорте (графика, JS) можно как копировать, так и ставить симлинки для снижения общего веса сайта.
* Очень гибкий механизм для добавления своих преобразований ресурсов подсайта для получения нужного результата.

## Основные концепции

Для успешного импорта подсайта нужно знать следующие вещи:

* папка, *откуда* копировать подсайт;
* папка, *куда* копировать подсайт;
* *префикс*, который нужно добавить всем ссылкам внутри подсайта, чтобы правильно работала навигация в подсайте в контексте целевого сайта.

### Пример

Есть сайт `mini-site` со следующей стркутурой:

* `/index.html`
* `/help/index.html`
* `/img/**`
* `/css/**`

И мы хотим, чтобы этот `mini-site` стал частью сайта `global-site` и был доступен по адресу `http://global-site.com/company/about/`.

Для этого нам нужно:

* перенести файлы из папки `/path/to/mini-site` в папку `/path/to/global-site/www/company/about`;
* во время переноса заменить ссылки внутри `mini-site`. Например, ссылка `/help/` должна превратиться в ссылку `/company/about/help/`, то есть нужно добавить префикс `/company/about`.

Чтобы не придумывать отдельный конфиг для указания этой информации, в импорте есть специальный механизм для получения всей необходимой информации на основе файловой стркутуры. Для этого достаточно сделать специальную папку, в которой  симлинками разметить импортируемые разделы. Например:

```
/path/to/global-site/import
    /company
        /about -> /path/to/mini-site
```

*TODO: написать подробнее про файловую структуру (если кому-то будем предоставлять этот инструмент). Сейчас про разметку импорта симлинками все знают.*

## Как это работает

Импорт сайтов активно использует [Node Streams](http://nodejs.org/api/stream.html), которые не только позволяют снизить нагрузку и увеличить скорость работы импорта, но и предоставляют удобные механизмы для добавления новых механизмов трансформации файлов, необходимых для конкретного проекта.

Основной единицей потока импорта является *проект*. Проект — это объект, который содержит информацию об импортируемом сайте (`mini-site` в примере выше): путь к папке с проектом, префикс и т.д.

Когда проект переходит в стадию фактического переноса данных из одной папки в другую (в терминах Node Streams: пишем данные в writable stream), он начинает считывать все *файлы сайта* и применять к ним различные *трансформации*.

Концепция работы очень похожа на то, как работает [Gulp](http://gulpjs.com): из папки считываются файлы, которые затем как-то преобразуются и сохраняются в другую папку. Файлы можно не только преобразовывать, но и создавать новые или убирать из потока ненужные. Всё то же самое можно делать и в импорте сайтов, только оперировать нужно двумя единицами данных: *проект* и *файл проекта*.

Пример:

```js
var si = require('site-import');
var through = require('through2');

// считываем структуру импортируемых сайтов
si.src('/path/to/global-site/import')
.pipe(through.obj(function(project, enc, next) {
    // Делаем различные манипуляции с проектом.
    // Переменная `project` – экземпляр класса `ProjectConfig`, 
    // см. lib/project-config.js
    
    // ...
    
    // Передаём его дальше в импорт. Если проект нужно игнорировать,
    // то метод push() не вызываем.
    this.push(project);

    // Переходим к следующему проекту. Этот метод нужно вызывать ВСЕГДА,
    // когда закончились преобразования над текущим объектом.
    next();
}))
// сохраняем сайты в указанную папку
.pipe(si.dest('/path/to/global-site/www'))
.on('end', function() {
    console.log('Импорт завершён');
});
```

В этом примере все проекты из папки `/path/to/global-site/import` скопируются в папку `/path/to/global-site/www` как есть, без каких-либо преобразований.

Теперь сделаем так, чтобы во время иморта во всех HTML-файлах переписывались ссылки: к ним добавлялся префикс проекта. Для этого нам нужно *зарегистрировать трансформацию* для таких файлов с помощью метода `addTransform(pattern, factory)`:

```js
var si = require('site-import');
var through = require('through2');

si.src('/path/to/global-site/import')
.pipe(through.obj(function(project, enc, next) {
    project.addTransform('**/*.html', function() {
        return through.obj(function(file, enc, next2) {
            // переменная `file` -- экземпляр объекта `Vinyl`, как и в Gulp:
            // https://github.com/wearefractal/vinyl
            // Поэтому правильно проверять тип файла: это `Buffer` или `Stream` и соответствующим образом делать обработку. 
            // По умолчанию используется `Buffer`
            var contents = file.contents.toString();

            // добавляем префикс проекта всем ссылкам
            contents = contents.replace(/\shref=(['"])(.+?)\1/g, ' href=$1' + project.prefix + '$2$1');

            file.contents = new Buffer(contents);
            next2(null, file);
        });
    });
    next(null, project);
}))
.pipe(si.dest('/path/to/global-site/www'));
```

С помощью метода `addTransform(pattern, factory)` мы зарегистрировали фабрику, которая возвращает поток преобразования ([transform stream](https://nodejs.org/api/stream.html#stream_class_stream_transform_1)) файла. Во время переноса каждого файла проекта находятся все трансформации, у которых glob-шаблон `pattern` матчится на текущий файл и из найденных трансформаций создаётся отдельный pipeline потоков, через который пропускается файл. Таким образом можно очень точечно регистрировать трансформации для конкретных файлов в конкретных проектах, которые могут не только менять содержимое файлов, но и, например, добавлять новые файлы или удалять из потока ненужные.

Данная реализация перезаписи ссылок довольно наивная и не учитывает огромного количества нюансов. Для правильной перезаписи ссылок есть встроенный поток `rewriteUrl()`, который умеет правильно переписывать ссылки внутри HTML и CSS:

```js
var si = require('site-import');

si.src('/path/to/global-site/import')
.pipe(si.rewriteUrl())
.pipe(si.dest('/path/to/global-site/www'));
```

Для перезаписи ссылок используются проекты [html-transform](https://github.com/sergeche/html-transform) и [css-transform](https://github.com/sergeche/css-transform).