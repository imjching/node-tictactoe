var gulp = require('gulp');
var gutil = require('gulp-util');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');

// run the watch task when gulp is called without arguments
gulp.task('default', ['build-css', 'watch'], function() {
  gutil.log('Gulp is running...');
});

gulp.task('build-css', function() {
  return gulp.src('./source/scss/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass())
    .pipe(minifyCss())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./public/assets/css'));
});

gulp.task('watch', function() {
  gulp.watch('./source/scss/**/*.scss', ['build-css']);
});
