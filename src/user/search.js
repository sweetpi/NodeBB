
'use strict';

var async = require('async'),
	meta = require('../meta'),
	user = require('../user'),
	pagination = require('../pagination'),
	db = require('../database');

module.exports = function(User) {

	User.search = function(data, callback) {
		var query = data.query;
		var searchBy = data.searchBy || ['username'];
		var startsWith = data.hasOwnProperty('startsWith') ? data.startsWith : true;
		var page = data.page || 1;

		if (!query) {
			return callback(null, {timing: 0, users: [], matchCount: 0, pages: []});
		}

		if (searchBy.indexOf('ip') !== -1) {
			return searchByIP(query, callback);
		}

		var startTime = process.hrtime();
		var keys = searchBy.map(function(searchBy) {
			return searchBy + ':uid';
		});

		var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
		var start = Math.max(0, page - 1) * resultsPerPage;
		var end = start + resultsPerPage;
		var pageCount = 1;
		var matchCount = 0;
		var filterBy = Array.isArray(data.filterBy) ? data.filterBy : [];

		async.waterfall([
			function(next) {
				findUids(query, keys, startsWith, next);
			},
			function(uids, next) {
				filterAndSortUids(uids, filterBy, data.sortBy, next);
			},
			function(uids, next) {
				matchCount = uids.length;
				uids = uids.slice(start, end);

				User.getUsers(uids, next);
			},
			function(userData, next) {

				var diff = process.hrtime(startTime);
				var timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
				var data = {
					timing: timing,
					users: userData,
					matchCount: matchCount
				};

				var currentPage = Math.max(1, Math.ceil((start + 1) / resultsPerPage));
				pageCount = Math.ceil(matchCount / resultsPerPage);
				data.pagination = pagination.create(currentPage, pageCount);

				next(null, data);
			}
		], callback);
	};

	function findUids(query, keys, startsWith, callback) {
		db.getObjects(keys, function(err, hashes) {
			if (err || !hashes) {
				return callback(err, []);
			}

			hashes = hashes.filter(Boolean);

			query = query.toLowerCase();

			var uids = [];
			var resultsPerPage = parseInt(meta.config.userSearchResultsPerPage, 10) || 20;
			var hardCap = resultsPerPage * 10;

			for(var i=0; i<hashes.length; ++i) {
				for(var field in hashes[i]) {
					if ((startsWith && field.toLowerCase().startsWith(query)) || (!startsWith && field.toLowerCase().indexOf(query) !== -1)) {
						uids.push(hashes[i][field]);
						if (uids.length >= hardCap) {
							break;
						}
					}
				}

				if (uids.length >= hardCap) {
					break;
				}
			}

			if (hashes.length > 1) {
				uids = uids.filter(function(uid, index, array) {
					return array.indexOf(uid) === index;
				});
			}

			callback(null, uids);
		});
	}

	function filterAndSortUids(uids, filterBy, sortBy, callback) {
		sortBy = sortBy || 'joindate';

		var fields = filterBy.map(function(filter) {
			return filter.field;
		}).concat(['uid', sortBy]).filter(function(field, index, array) {
			return array.indexOf(field) === index;
		});

		async.parallel({
			userData: function(next) {
				user.getMultipleUserFields(uids, fields, next);
			},
			isOnline: function(next) {
				if (fields.indexOf('status') !== -1) {
					require('../socket.io').isUsersOnline(uids, next);
				} else {
					next();
				}
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var userData = results.userData;

			if (results.isOnline) {
				userData.forEach(function(userData, index) {
					userData.status = user.getStatus(userData.status, results.isOnline[index]);
				});
			}

			userData = filterUsers(userData, filterBy);

			sortUsers(userData, sortBy);

			uids = userData.map(function(user) {
				return user && user.uid;
			});
			callback(null, uids);
		});
	}

	function filterUsers(userData, filterBy) {
		function passesFilter(user, filter) {
			if (!user || !filter) {
				return false;
			}
			var userValue = user[filter.field];
			if (filter.type === '=') {
				return userValue === filter.value;
			} else if (filter.type === '!=') {
				return userValue !== filter.value;
			}
			return false;
		}

		if (!filterBy.length) {
			return userData;
		}

		return userData.filter(function(user) {
			for(var i=0; i<filterBy.length; ++i) {
				if (!passesFilter(user, filterBy[i])) {
					return false;
				}
			}
			return true;
		});
	}

	function sortUsers(userData, sortBy) {
		if (sortBy === 'joindate' || sortBy === 'postcount') {
			userData.sort(function(u1, u2) {
				return u2[sortBy] - u1[sortBy];
			});
		} else {
			userData.sort(function(u1, u2) {
				if(u1[sortBy] < u2[sortBy]) {
					return -1;
				} else if(u1[sortBy] > u2[sortBy]) {
					return 1;
				}
				return 0;
			});
		}
	}

	function searchByIP(ip, callback) {
		var start = process.hrtime();
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('ip:' + ip + ':uid', 0, -1, next);
			},
			function(uids, next) {
				User.getUsers(uids, next);
			},
			function(users, next) {
				var diff = process.hrtime(start);
				var timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
				next(null, {timing: timing, users: users});
			}
		], callback);
	}
};
