'use strict'
const gulp = require('gulp');
const less = require('gulp-less');
//const concat = require('gulp-concat');
const plumber = require('gulp-plumber');
const debug = require('gulp-debug');
const gulplog = require('gulplog');
const sourcemaps = require('gulp-sourcemaps');
const gulpIf = require('gulp-if');
const del = require('del');
const browserSync = require('browser-sync').create();
const notify = require('gulp-notify');
const uglify = require('gulp-uglify');
const multipipe = require('multipipe');
const autoprefixer = require('gulp-autoprefixer');
const cssmin = require('gulp-csso');
const svgstore = require('gulp-svgstore');
const imagemin = require('gulp-imagemin');
const spritesmith = require('gulp-spritesmith');
const rigger = require('gulp-rigger');
const fileinclude = require('gulp-file-include');

const webpackStream = require('webpack-stream');
const webpack = webpackStream.webpack;
const named = require('vinyl-named');

const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV == 'development';

gulp.task('styles', function() {
  return multipipe(
    gulp.src('frontend/less/style.less'),
    gulpIf(isDevelopment, sourcemaps.init()),
    less(),
    autoprefixer(['last 15 versions'], {cascade: true}),
    cssmin(),
    gulpIf(isDevelopment, sourcemaps.write()),
    gulp.dest('public/css')).on('error', notify.onError());

});

gulp.task('webpack', function(callback) {

  let firstBuildReady = false;

  function done(err, stats) {
    firstBuildReady = true;

    if (err) { // hard error, see https://webpack.github.io/docs/node.js-api.html#error-handling
      return;  // emit('error', err) in webpack-stream
    }

    gulplog[stats.hasErrors() ? 'error' : 'info'](stats.toString({
      colors: true
    }));

  }

  let options = {

     output: {
      publicPath: '/js/',
      filename: '[name].js'
    },

    watch: isDevelopment,

    devtool: isDevelopment ? 'cheap-module-inline-source-map' : null,

    plugins: [
      new webpack.NoErrorsPlugin(),
      new webpack.DefinePlugin({
        NODE_ENV: JSON.stringify(isDevelopment)
      }),
    //  new webpack.optimize.CommonsChunkPlugin({
      //  name: "common"
      //})
    ],

    resolve: {
      modulesDirectories: ['node_modules'],
      extensions: ['', '.js']
    },

    resolveLoader: {
      modulesDirectories: ['node_modules'],
      moduleTemplates: ['*-loader', '*'],
      extensions: ['', '.js']
    },

    module: {
      loaders: [{
        test: /\.js$/,
        loader: 'babel?presets[]=es2015'
      }]
    }
  };

  return gulp.src('frontend/js/*.js')
      .pipe(plumber({
        errorHandler: notify.onError(err => ({
          title:   'Webpack',
          message: err.message
        }))
      }))
      .pipe(named())
      .pipe(webpackStream(options, null, done))
      .pipe(gulpIf(!isDevelopment, uglify()))
      .pipe(gulp.dest('public/js'))
      .on('data', function() {
        if (firstBuildReady) {
          callback();
        }
      });

});

gulp.task('clean', function() {
  return del('public');
});

gulp.task('svgstore', function() {
  return multipipe(
    gulp.src('frontend/img/*.svg'),
    svgstore(),
    gulp.dest('frontend/img')).on('error', notify.onError());
});


gulp.task('imagemin', function() {
  return multipipe(
    gulp.src('frontend/assets/img/*'),
    imagemin(),
    gulp.dest('public/img')).on('error', notify.onError());
});

gulp.task('sprites', function () {
  return multipipe(
    gulp.src('frontend/img/sprite/*.png'),
    tasks.spritesmith({
      imgName: 'sprite.png',
      styleName: 'sprite.css',
      imgPath: 'frontend/img/sprite.png'
    }),
    gulpif('*.png', gulp.dest('frontend/img/')),
    gulpif('*.css', gulp.dest('frontend/css/'))).on('error', notify.onError());
});

gulp.task('fileinclude', function() {
  return multipipe(
    gulp.src('frontend/assets/*.html'),
    fileinclude({
      prefix: '@@',
      basepath: '@file'
    }),
    gulp.dest('public')).on('error', notify.onError());
});

gulp.task('assets', function() {
  return gulp.src('frontend/assets/**', {since: gulp.lastRun('assets')})
    .pipe(gulp.dest('public'));
});

gulp.task('fonts', function() {
  return gulp.src('frontend/assets/fonts/**', {since: gulp.lastRun('fonts')})
    .pipe(gulp.dest('public/fonts'));
});

gulp.task('data', function() {
  return gulp.src('frontend/data/**', {since: gulp.lastRun('data')})
    .pipe(gulp.dest('public/data'));
});

gulp.task('build', gulp.series('clean', gulp.parallel('styles', 'fonts', 'imagemin', 'fileinclude', 'webpack', 'data')));

gulp.task('watch', function() {
  gulp.watch('frontend/less/**/*.*', gulp.series('styles'));

  gulp.watch('frontend/assets/*.html', gulp.series('fileinclude'));
  gulp.watch('frontend/assets/html_includes/*.html', gulp.series('fileinclude'));
});

gulp.task('serve', function() {
  browserSync.init({
    server: 'public'
  });

  browserSync.watch('public/**/*.*').on('change', browserSync.reload);
});

gulp.task('dev', gulp.series('build', gulp.parallel('watch', 'serve')));
