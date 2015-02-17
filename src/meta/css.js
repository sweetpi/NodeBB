'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	crypto = require('crypto'),
	async = require('async'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.css = {};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;
	Meta.css.branding = {};
	Meta.css.defaultBranding = {};

	Meta.css.minify = function(callback) {
		if (nconf.get('isPrimary') === 'true') {
			winston.verbose('[meta/css] Minifying LESS/CSS');
			db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
				var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
					baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
					paths = [
						baseThemePath,
						path.join(__dirname, '../../node_modules'),
						path.join(__dirname, '../../public/vendor/fontawesome/less'),
						path.join(__dirname, '../../public/vendor/bootstrap/less')
					],
					source = '@import "font-awesome";',
					acpSource,
					x;


				plugins.lessFiles = filterMissingFiles(plugins.lessFiles);
				for(x=0; x<plugins.lessFiles.length; ++x) {
					source += '\n@import ".' + path.sep + plugins.lessFiles[x] + '";';
				}

				plugins.cssFiles = filterMissingFiles(plugins.cssFiles);
				for(x=0; x<plugins.cssFiles.length; ++x) {
					source += '\n@import (inline) ".' + path.sep + plugins.cssFiles[x] + '";';
				}

				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css";';
				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";';
				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";';

				acpSource = '\n@import "..' + path.sep + 'public/less/admin/admin";\n' + source;
				acpSource += '\n@import (inline) "..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";';

				source = '@import "./theme";\n' + source;

				async.parallel([
					function(next) {
						minify(source, paths, 'cache', next);
					},
					function(next) {
						minify(acpSource, paths, 'acpCache', next);
					}
				], function(err, minified) {
					// Propagate to other workers
					if (process.send) {
						process.send({
							action: 'css-propagate',
							cache: minified[0],
							acpCache: minified[1],
							hash: Meta.css.hash
						});
					}

					emitter.emit('meta:css.compiled');

					if (typeof callback === 'function') {
						callback();
					}
				});
			});
		} else {
			winston.verbose('[meta/css] Cluster worker ' + process.pid + ' skipping LESS/CSS compilation');
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.css.commitToFile = function(filename) {
		var file = (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css';

		fs.writeFile(path.join(__dirname, '../../public/' + file), Meta.css[filename], function(err) {
			if (!err) {
				winston.verbose('[meta/css] ' + file + ' committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}
		});
	};

	Meta.css.getFromFile = function(callback) {
		var cachePath = path.join(__dirname, '../../public/stylesheet.css'),
			acpCachePath = path.join(__dirname, '../../public/admin.css');
		fs.exists(cachePath, function(exists) {
			if (exists) {
				if (nconf.get('isPrimary') === 'true') {
					winston.verbose('[meta/css] (Experimental) Reading stylesheets from file');
					async.map([cachePath, acpCachePath], fs.readFile, function(err, files) {
						Meta.css.cache = files[0];
						Meta.css.acpCache = files[1];

						emitter.emit('meta:css.compiled');
						callback();
					});
				} else {
					callback();
				}
			} else {
				winston.warn('[meta/css] (Experimental) No stylesheets found on disk, re-minifying');
				Meta.css.minify.apply(Meta.css, arguments);
			}
		});
	};

	function minify(source, paths, destination, callback) {
		less.render(source, {
			paths: paths,
			compress: true
		}, function(err, lessOutput) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			Meta.css[destination] = lessOutput.css;

			if (destination === 'cache') {
				// Calculate css buster
				var hasher = crypto.createHash('md5');

				hasher.update(lessOutput.css, 'utf-8');
				Meta.css.hash = hasher.digest('hex').slice(0, 8);
			}

			// Save the compiled CSS in public/ so things like nginx can serve it
			if (nconf.get('isPrimary') === 'true') {
				Meta.css.commitToFile(destination);
			}

			if (typeof callback === 'function') {
				callback(null, lessOutput.css);
			}
		});
	}

	function filterMissingFiles(files) {
		return files.filter(function(file) {
			var exists = fs.existsSync(path.join(__dirname, '../../node_modules', file));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + file);
			}
			return exists;
		});
	}
};