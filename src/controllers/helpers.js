'use strict';

var nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

	translator = require('../../public/src/translator'),
	categories = require('../categories'),
	meta = require('../meta');

var helpers = {};

helpers.notFound = function(req, res, error) {
	if (res.locals.isAPI) {
		res.status(404).json({path: req.path.replace(/^\/api/, ''), error: error});
	} else {
		res.status(404).render('404', {path: req.path, error: error});
	}
};

helpers.notAllowed = function(req, res, error) {
	var uid = req.user ? req.user.uid : 0;

	if (uid) {
		if (res.locals.isAPI) {
			res.status(403).json({path: req.path.replace(/^\/api/, ''), loggedIn: !!uid, error: error});
		} else {
			res.status(403).render('403', {path: req.path, loggedIn: !!uid, error: error});
		}
	} else {
		if (res.locals.isAPI) {
			req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = nconf.get('relative_path') + req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	}
};

helpers.buildCategoryBreadcrumbs = function(cid, callback) {
	var breadcrumbs = [];

	async.whilst(function() {
		return parseInt(cid, 10);
	}, function(next) {
		categories.getCategoryFields(cid, ['name', 'slug', 'parentCid'], function(err, data) {
			if (err) {
				return next(err);
			}

			breadcrumbs.unshift({
				text: validator.escape(data.name),
				url: nconf.get('relative_path') + '/category/' + data.slug
			});

			cid = data.parentCid;
			next();
		});
	}, function(err) {
		if (err) {
			return callback(err);
		}

		breadcrumbs.unshift({
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/'
		});

		callback(null, breadcrumbs);
	});
};

helpers.buildBreadcrumbs = function(crumbs) {
	var breadcrumbs = [
		{
			text: '[[global:home]]',
			url: nconf.get('relative_path') + '/'
		}
	];

	crumbs.forEach(function(crumb) {
		if (crumb) {
			if (crumb.url) {
				crumb.url = nconf.get('relative_path') + crumb.url;
			}
			breadcrumbs.push(crumb);
		}
	});

	return breadcrumbs;
};

module.exports = helpers;