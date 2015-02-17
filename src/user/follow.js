
'use strict';

var async = require('async'),
	db = require('./../database');

module.exports = function(User) {

	User.follow = function(uid, followuid, callback) {
		toggleFollow('follow', uid, followuid, callback);
	};

	User.unfollow = function(uid, unfollowuid, callback) {
		toggleFollow('unfollow', uid, unfollowuid, callback);
	};

	function toggleFollow(type, uid, theiruid, callback) {
		if (!parseInt(uid, 10) || !parseInt(theiruid, 10)) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
			return callback(new Error('[[error:you-cant-follow-yourself]]'));
		}

		if (type === 'follow') {
			var now = Date.now();
			async.parallel([
				async.apply(db.sortedSetAdd, 'following:' + uid, now, theiruid),
				async.apply(db.sortedSetAdd, 'followers:' + theiruid, now, uid),
				async.apply(User.incrementUserFieldBy, uid, 'followingCount', 1),
				async.apply(User.incrementUserFieldBy, theiruid, 'followerCount', 1)
			], callback);
		} else {
			async.parallel([
				async.apply(db.sortedSetRemove, 'following:' + uid, theiruid),
				async.apply(db.sortedSetRemove, 'followers:' + theiruid, uid),
				async.apply(User.decrementUserFieldBy, uid, 'followingCount', 1),
				async.apply(User.decrementUserFieldBy, theiruid, 'followerCount', 1)
			], callback);
		}
	}

	User.getFollowing = function(uid, start, end, callback) {
		getFollow(uid, 'following:' + uid, start, end, callback);
	};

	User.getFollowers = function(uid, start, end, callback) {
		getFollow(uid, 'followers:' + uid, start, end, callback);
	};

	function getFollow(uid, set, start, end, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, []);
		}

		db.getSortedSetRevRange(set, start, end, function(err, uids) {
			if (err) {
				return callback(err);
			}

			User.getUsers(uids, callback);
		});
	}

	User.isFollowing = function(uid, theirid, callback) {
		if (!parseInt(uid, 10) || !parseInt(theirid, 10)) {
			return callback(null, false);
		}
		db.isSortedSetMember('following:' + uid, theirid, callback);
	};

};
