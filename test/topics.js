'use strict';

var async = require('async');
var assert = require('assert');
var validator = require('validator');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var User = require('../src/user');
var groups = require('../src/groups');
var socketPosts = require('../src/socket.io/posts');

describe('Topic\'s', function () {
	var topic;
	var categoryObj;
	var adminUid;

	before(function (done) {
		groups.resetCache();
		User.create({username: 'admin'}, function (err, uid) {
			if (err) {
				return done(err);
			}

			adminUid = uid;

			categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script'
			}, function (err, category) {
				if (err) {
					return done(err);
				}

				categoryObj = category;

				topic = {
					userId: uid,
					categoryId: categoryObj.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic'
				};
				done();
			});
		});
	});

	describe('.post', function () {

		it('should create a new topic with proper parameters', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should fail to create new topic with invalid user id', function (done) {
			topics.post({uid: null, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new topic with empty title', function (done) {
			topics.post({uid: topic.userId, title: '', content: topic.content, cid: topic.categoryId}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with empty content', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: '', cid: topic.categoryId}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new topic with non-existant category id', function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: 99}, function (err) {
				assert.equal(err.message, '[[error:no-category]]', 'received no error');
				done();
			});
		});
	});

	describe('.reply', function () {
		var newTopic;
		var newPost;

		before(function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		it('should create a new reply with proper parameters', function (done) {
			topics.reply({uid: topic.userId, content: 'test post', tid: newTopic.tid}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				done();
			});
		});

		it('should handle direct replies', function (done) {
			topics.reply({uid: topic.userId, content: 'test reply', tid: newTopic.tid, toPid: newPost.pid}, function (err, result) {
				assert.equal(err, null, 'was created with error');
				assert.ok(result);

				socketPosts.getReplies({uid: 0}, newPost.pid, function (err, postData) {
					assert.equal(err, null, 'posts.getReplies returned error');

					assert.ok(postData);

					assert.equal(postData.length, 1, 'should have 1 result');
					assert.equal(postData[0].pid, result.pid, 'result should be the reply we added');

					done();
				});
			});
		});

		it('should fail to create new reply with invalid user id', function (done) {
			topics.reply({uid: null, content: 'test post', tid: newTopic.tid}, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail to create new reply with empty content', function (done) {
			topics.reply({uid: topic.userId, content: '', tid: newTopic.tid}, function (err) {
				assert.ok(err);
				done();
			});
		});

		it('should fail to create new reply with invalid topic id', function (done) {
			topics.reply({uid: null, content: 'test post', tid: 99}, function (err) {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should fail to create new reply with invalid toPid', function (done) {
			topics.reply({uid: topic.userId, content: 'test post', tid: newTopic.tid, toPid: '"onmouseover=alert(1);//'}, function (err) {
				assert.equal(err.message, '[[error:invalid-pid]]');
				done();
			});
		});
	});

	describe('Get methods', function () {
		var	newTopic;
		var newPost;

		before(function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				if (err) {
					return done(err);
				}

				newTopic = result.topicData;
				newPost = result.postData;
				done();
			});
		});

		describe('.getTopicData', function () {
			it('should not receive errors', function (done) {
				topics.getTopicData(newTopic.tid, done);
			});
		});

		describe('.getTopicWithPosts', function () {
			it('should get a topic with posts and other data', function (done) {
				topics.getTopicData(newTopic.tid, function (err, topicData) {
					if (err) {
						return done(err);
					}
					topics.getTopicWithPosts(topicData, 'tid:' + newTopic.tid + ':posts', topic.userId, 0, -1, false, function (err, data) {
						if (err) {
							return done(err);
						}
						assert(data);
						assert.equal(data.category.cid, topic.categoryId);
						assert.equal(data.unreplied, true);
						assert.equal(data.deleted, false);
						assert.equal(data.locked, false);
						assert.equal(data.pinned, false);
						done();
					});
				});
			});
		});
	});

	describe('Title escaping', function () {

		it('should properly escape topic title', function (done) {
			var title = '"<script>alert(\'ok1\');</script> new topic test';
			var titleEscaped = validator.escape(title);
			topics.post({uid: topic.userId, title: title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				assert.ifError(err);
				topics.getTopicData(result.topicData.tid, function (err, topicData) {
					assert.ifError(err);
					assert.strictEqual(topicData.titleRaw, title);
					assert.strictEqual(topicData.title, titleEscaped);
					done();
				});
			});
		});
	});

	describe('tools/delete/restore/purge', function () {
		var newTopic;
		var followerUid;
		var moveCid;
		var socketTopics = require('../src/socket.io/topics');
		before(function (done) {
			async.waterfall([
				function (next) {
					groups.join('administrators', adminUid, next);
				},
				function (next) {
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
						assert.ifError(err);
						newTopic = result.topicData;
						next();
					});
				},
				function (next) {
					User.create({username: 'topicFollower', password: '123456'}, next);
				},
				function (_uid, next) {
					followerUid = _uid;
					topics.follow(newTopic.tid, _uid, next);
				},
				function (next) {
					categories.create({
						name: 'Test Category',
						description: 'Test category created by testing script'
					}, function (err, category) {
						if (err) {
							return next(err);
						}
						moveCid = category.cid;
						next();
					});
				}
			], done);
		});

		it('should load topic tools', function (done) {
			socketTopics.loadTopicTools({uid: 1}, {tid: newTopic.tid}, function (err, data) {
				assert.ifError(err);
				assert(data);
				done();
			});
		});

		it('should delete the topic', function (done) {
			socketTopics.delete({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should restore the topic', function (done) {
			socketTopics.restore({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should lock topic', function (done) {
			socketTopics.lock({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, function (err, isLocked) {
					assert.ifError(err);
					assert(isLocked);
					done();
				});
			});
		});

		it('should unlock topic', function (done) {
			socketTopics.unlock({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.isLocked(newTopic.tid, function (err, isLocked) {
					assert.ifError(err);
					assert(!isLocked);
					done();
				});
			});
		});

		it('should pin topic', function (done) {
			socketTopics.pin({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.getObjectField('topic:' + newTopic.tid, 'pinned', function (err, pinned) {
					assert.ifError(err);
					assert.strictEqual(parseInt(pinned, 10), 1);
					done();
				});
			});
		});

		it('should unpin topic', function (done) {
			socketTopics.unpin({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.getObjectField('topic:' + newTopic.tid, 'pinned', function (err, pinned) {
					assert.ifError(err);
					assert.strictEqual(parseInt(pinned, 10), 0);
					done();
				});
			});
		});

		it('should move all topics', function (done) {
			socketTopics.moveAll({uid: 1}, {cid: moveCid, currentCid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', function (err, cid) {
					assert.ifError(err);
					assert.equal(cid, moveCid);
					done();
				});
			});
		});

		it('should move a topic', function (done) {
			socketTopics.move({uid: 1}, {cid: categoryObj.cid, tids: [newTopic.tid]}, function (err) {
				assert.ifError(err);
				topics.getTopicField(newTopic.tid, 'cid', function (err, cid) {
					assert.ifError(err);
					assert.equal(cid, categoryObj.cid);
					done();
				});
			});
		});

		it('should purge the topic', function (done) {
			socketTopics.purge({uid: 1}, {tids: [newTopic.tid], cid: categoryObj.cid}, function (err) {
				assert.ifError(err);
				db.isSortedSetMember('uid:' + followerUid + ':followed_tids', newTopic.tid, function (err, isMember) {
					assert.ifError(err);
					assert.strictEqual(false, isMember);
					done();
				});
			});
		});
	});

	describe('order pinned topics', function () {
		var tid1;
		var tid2;
		var tid3;
		before(function (done) {
			function createTopic(callback) {
				topics.post({
					uid: topic.userId,
					title: 'topic for test',
					content: 'topic content',
					cid: topic.categoryId
				}, callback);
			}
			async.series({
				topic1: function (next) {
					createTopic(next);
				},
				topic2: function (next) {
					createTopic(next);
				},
				topic3: function (next) {
					createTopic(next);
				}
			}, function (err, results) {
				assert.ifError(err);
				tid1 = results.topic1.topicData.tid;
				tid2 = results.topic2.topicData.tid;
				tid3 = results.topic3.topicData.tid;
				async.series([
					function (next) {
						topics.tools.pin(tid1, adminUid, next);
					},
					function (next) {
						topics.tools.pin(tid2, adminUid, next);
					}
				], done);
			});
		});

		var socketTopics = require('../src/socket.io/topics');
		it('should error with invalid data', function (done) {
			socketTopics.orderPinnedTopics({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketTopics.orderPinnedTopics({uid: adminUid}, [null, null], function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error with unprivileged user', function (done) {
			socketTopics.orderPinnedTopics({uid: 0}, [{tid: tid1}, {tid: tid2}], function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should not do anything if topics are not pinned', function (done) {
			socketTopics.orderPinnedTopics({uid: adminUid}, [{tid: tid3}], function (err) {
				assert.ifError(err);
				db.isSortedSetMember('cid:' + topic.categoryId + ':tids:pinned', tid3, function (err, isMember) {
					assert.ifError(err);
					assert(!isMember);
					done();
				});
			});
		});

		it('should order pinned topics', function (done) {
			db.getSortedSetRevRange('cid:' + topic.categoryId + ':tids:pinned', 0, -1, function (err, pinnedTids) {
				assert.ifError(err);
				assert.equal(pinnedTids[0], tid2);
				assert.equal(pinnedTids[1], tid1);
				socketTopics.orderPinnedTopics({uid: adminUid}, [{tid: tid1, order: 1}, {tid: tid2, order: 0}], function (err) {
					assert.ifError(err);
					db.getSortedSetRevRange('cid:' + topic.categoryId + ':tids:pinned', 0, -1, function (err, pinnedTids) {
						assert.ifError(err);
						assert.equal(pinnedTids[0], tid1);
						assert.equal(pinnedTids[1], tid2);
						done();
					});
				});			
			});
		});

	});


	describe('.ignore', function () {
		var newTid;
		var uid;
		var newTopic;
		before(function (done) {
			uid = topic.userId;
			async.waterfall([
				function (done) {
					topics.post({uid: topic.userId, title: 'Topic to be ignored', content: 'Just ignore me, please!', cid: topic.categoryId}, function (err, result) {
						if (err) {
							return done(err);
						}

						newTopic = result.topicData;
						newTid = newTopic.tid;
						done();
					});
				},
				function (done) {
					topics.markUnread( newTid, uid, done );
				}
			],done);
		});

		it('should not appear in the unread list', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.equal(tids.indexOf(newTid), -1, 'The topic appeared in the unread list.');
					done();
				}
			], done);
		});

		it('should not appear as unread in the recent list', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.getLatestTopics( uid, 0, -1, 'year', done );
				},
				function (results, done) {
					var topics = results.topics;
					var topic;
					var i;
					for(i = 0; i < topics.length; ++i) {
						if (parseInt(topics[i].tid, 10) === parseInt(newTid, 10)) {
							assert.equal(false, topics[i].unread, 'ignored topic was marked as unread in recent list');
							return done();
						}
					}
					assert.ok(topic, 'topic didn\'t appear in the recent list');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as reading', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.follow( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});

		it('should appear as unread again when marked as following', function (done) {
			async.waterfall([
				function (done) {
					topics.ignore( newTid, uid, done );
				},
				function (done) {
					topics.follow( newTid, uid, done );
				},
				function (done) {
					topics.getUnreadTopics(0, uid, 0, -1, '', done );
				},
				function (results, done) {
					var topics = results.topics;
					var tids = topics.map( function (topic) { return topic.tid; } );
					assert.notEqual(tids.indexOf(newTid), -1, 'The topic did not appear in the unread list.');
					done();
				}
			], done);
		});
	});

	describe('.fork', function () {
		var newTopic;
		var replies = [];
		var topicPids;
		var originalBookmark = 5;
		function postReply(next) {
			topics.reply({uid: topic.userId, content: 'test post ' + replies.length, tid: newTopic.tid}, function (err, result) {
					assert.equal(err, null, 'was created with error');
					assert.ok(result);
					replies.push(result);
					next();
				}
			);
		}

		before(function (done) {
			async.waterfall([
				function (next) {
					groups.join('administrators', topic.userId, next);
				},
				function ( next ) {
					topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
						assert.ifError( err );
						newTopic = result.topicData;
						next();
					});
				},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) { postReply( next );},
				function ( next ) {
					topicPids = replies.map( function ( reply ) { return reply.pid; } );
					topics.setUserBookmark( newTopic.tid, topic.userId, originalBookmark, next );
				}],
				done );
		});

		it('should have 12 replies', function (done) {
			assert.equal( 12, replies.length );
			done();
		});

		it('should not update the user\'s bookmark', function (done) {
			async.waterfall([
				function (next) {
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( -2 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next) {
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ) {
					assert.equal( originalBookmark, bookmark );
					next();
				}
			],done);
		});

		it('should update the user\'s bookmark ', function (done) {
			async.waterfall([
				function (next) {
					topics.createTopicFromPosts(
						topic.userId,
						'Fork test, no bookmark update',
						topicPids.slice( 1, 3 ),
						newTopic.tid,
						next );
				},
				function ( forkedTopicData, next) {
					topics.getUserBookmark( newTopic.tid, topic.userId, next );
				},
				function ( bookmark, next ) {
					assert.equal( originalBookmark - 2, bookmark );
					next();
				}
			],done);
		});
	});

	it('should load topic', function (done) {
		topics.post({
			uid: topic.userId,
			title: 'topic for controller test',
			content: 'topic content',
			cid: topic.categoryId,
			thumb: 'http://i.imgur.com/64iBdBD.jpg'
		}, function (err, result) {
			assert.ifError(err);
			assert.ok(result);
			var request = require('request');
			request(nconf.get('url') + '/topic/' + result.topicData.slug, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(body);
				done();
			});
		});
	});

	describe('infinitescroll', function () {
		var socketTopics = require('../src/socket.io/topics');
		var tid;
		before(function (done) {
			topics.post({uid: topic.userId, title: topic.title, content: topic.content, cid: topic.categoryId}, function (err, result) {
				assert.ifError(err);
				tid = result.topicData.tid;
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketTopics.loadMore({uid: adminUid}, {}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should infinite load topic posts', function (done) {
			socketTopics.loadMore({uid: adminUid}, {tid: tid, after: 0}, function (err, data) {
				assert.ifError(err);
				assert(data.mainPost);
				assert(data.posts);
				assert(data.privileges);
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketTopics.loadMoreUnreadTopics({uid: adminUid}, {after: 'invalid'}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more unread topics', function (done) {
			socketTopics.markUnread({uid: adminUid}, tid, function (err) {
				assert.ifError(err);
				socketTopics.loadMoreUnreadTopics({uid: adminUid}, {cid: topic.categoryId, after: 0}, function (err, data) {
					assert.ifError(err);
					assert(data);
					assert(Array.isArray(data.topics));
					done();
				});
			});
		});

		it('should error with invalid data', function (done) {
			socketTopics.loadMoreRecentTopics({uid: adminUid}, {after: 'invalid'}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});


		it('should load more recent topics', function (done) {
			socketTopics.loadMoreRecentTopics({uid: adminUid}, {cid: topic.categoryId, after: 0}, function (err, data) {
				assert.ifError(err);
				assert(data);
				assert(Array.isArray(data.topics));
				done();
			});
		});

		it('should error with invalid data', function (done) {
			socketTopics.loadMoreFromSet({uid: adminUid}, {after: 'invalid'}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more from custom set', function (done) {
			socketTopics.loadMoreFromSet({uid: adminUid}, {set: 'uid:' + adminUid + ':topics', after: 0}, function (err, data) {
				assert.ifError(err);
				assert(data);
				assert(Array.isArray(data.topics));
				done();
			});
		});

	});

	describe('suggested topics', function () {
		var tid1;
		var tid2;
		before(function (done) {
			async.parallel({
				topic1: function (next) {
					topics.post({uid: adminUid, tags: ['nodebb'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId}, next);
				},
				topic2: function (next) {
					topics.post({uid: adminUid, tags: ['nodebb'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId}, next);
				}
			}, function (err, results) {
				assert.ifError(err);
				tid1 = results.topic1.topicData.tid;
				tid2 = results.topic2.topicData.tid;
				done();
			});
		});

		it('should return suggested topics', function (done) {
			topics.getSuggestedTopics(tid1, adminUid, 0, -1, function (err, topics) {
				assert.ifError(err);
				assert(Array.isArray(topics));
				done();
			});
		});
	});

	describe('unread', function () {
		var socketTopics = require('../src/socket.io/topics');
		var tid;
		var mainPid;
		var uid;
		before(function (done) {
			async.parallel({
				topic: function (next) {
					topics.post({uid: topic.userId, title: 'unread topic', content: 'unread topic content', cid: topic.categoryId}, next);
				},
				user: function (next) {
					User.create({username: 'regularJoe'}, next);
				}
			}, function (err, results) {
				assert.ifError(err);
				tid = results.topic.topicData.tid;
				mainPid = results.topic.postData.pid;
				uid = results.user;
				done();
			});
		});

		it('should fail with invalid data', function (done) {
			socketTopics.markUnread({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should fail if topic does not exist', function (done) {
			socketTopics.markUnread({uid: adminUid}, 1231082, function (err) {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should mark topic unread', function (done) {
			socketTopics.markUnread({uid: adminUid}, tid, function (err) {
				assert.ifError(err);
				topics.hasReadTopic(tid, adminUid, function (err, hasRead) {
					assert.ifError(err);
					assert.equal(hasRead, false);
					done();
				});
			});
		});


		it('should fail with invalid data', function (done) {
			socketTopics.markAsRead({uid: 0}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});


		it('should mark topic read', function (done) {
			socketTopics.markAsRead({uid: adminUid}, [tid], function (err) {
				assert.ifError(err);
				topics.hasReadTopic(tid, adminUid, function (err, hasRead) {
					assert.ifError(err);
					assert(hasRead);
					done();
				});
			});
		});

		it('should fail with invalid data', function (done) {
			socketTopics.markTopicNotificationsRead({uid: 0}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should mark topic notifications read', function (done) {
			var socketPosts = require('../src/socket.io/posts');

			async.waterfall([
				function (next) {
					socketTopics.follow({uid: adminUid}, tid, next);
				},
				function (next) {
					socketPosts.reply({uid: uid}, {content: 'some content', tid: tid}, next);
				},
				function (data, next) {
					setTimeout(next, 2500);
				},
				function (next) {
					User.notifications.getUnreadCount(adminUid, next);
				},
				function (count, next) {
					assert.equal(count, 1);
					socketTopics.markTopicNotificationsRead({uid: adminUid}, [tid], next);
				},
				function (next) {
					User.notifications.getUnreadCount(adminUid, next);
				},
				function (count, next) {
					assert.equal(count, 0);
					next();
				}
			], function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should fail with invalid data', function (done) {
			socketTopics.markAllRead({uid: 0}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
				done();
			});
		});

		it('should mark all read', function (done) {
			socketTopics.markUnread({uid: adminUid}, tid, function (err) {
				assert.ifError(err);
				socketTopics.markAllRead({uid: adminUid}, {}, function (err) {
					assert.ifError(err);
					topics.hasReadTopic(tid, adminUid, function (err, hasRead) {
						assert.ifError(err);
						assert(hasRead);
						done();
					});
				});
			});
		});

		it('should mark all read', function (done) {
			socketTopics.markUnread({uid: adminUid}, tid, function (err) {
				assert.ifError(err);
				socketTopics.markCategoryTopicsRead({uid: adminUid}, topic.categoryId, function (err) {
					assert.ifError(err);
					topics.hasReadTopic(tid, adminUid, function (err, hasRead) {
						assert.ifError(err);
						assert(hasRead);
						done();
					});
				});
			});
		});


		it('should fail with invalid data', function (done) {
			socketTopics.markAsUnreadForAll({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-tid]]');
				done();
			});
		});

		it('should fail with invalid data', function (done) {
			socketTopics.markAsUnreadForAll({uid: 0}, [tid], function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail if user is not admin', function (done) {
			socketTopics.markAsUnreadForAll({uid: uid}, [tid], function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should fail if topic does not exist', function (done) {
			socketTopics.markAsUnreadForAll({uid: uid}, [12312313], function (err) {
				assert.equal(err.message, '[[error:no-topic]]');
				done();
			});
		});

		it('should mark topic unread for everyone', function (done) {
			socketTopics.markAsUnreadForAll({uid: adminUid}, [tid], function (err) {
				assert.ifError(err);
				async.parallel({
					adminRead: function (next) {
						topics.hasReadTopic(tid, adminUid, next);
					},
					regularRead: function (next) {
						topics.hasReadTopic(tid, uid, next);
					}
				}, function (err, results) {
					assert.ifError(err);
					assert.equal(results.adminRead, false);
					assert.equal(results.regularRead, false);
					done();
				});
			});
		});
	});

	describe('tags', function () {
		var socketTopics = require('../src/socket.io/topics');
		var socketAdmin = require('../src/socket.io/admin');

		before(function (done) {
			async.parallel({
				topic1: function (next) {
					topics.post({uid: adminUid, tags: ['php', 'nosql', 'psql', 'nodebb'], title: 'topic title 1', content: 'topic 1 content', cid: topic.categoryId}, next);
				},
				topic2: function (next) {
					topics.post({uid: adminUid, tags: ['javascript', 'mysql', 'python', 'nodejs'], title: 'topic title 2', content: 'topic 2 content', cid: topic.categoryId}, next);
				}
			}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should return empty array if query is falsy', function (done) {
			socketTopics.autocompleteTags({uid: adminUid}, {query: ''}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([], data);
				done();
			});
		});

		it('should autocomplete tags', function (done) {
			socketTopics.autocompleteTags({uid: adminUid}, {query: 'p'}, function (err, data) {
				assert.ifError(err);
				['php', 'psql', 'python'].forEach(function (tag) {
					assert.notEqual(data.indexOf(tag), -1);
				});
				done();
			});
		});

		it('should return empty array if query is falsy', function (done) {
			socketTopics.searchTags({uid: adminUid}, {query: ''}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([], data);
				done();
			});
		});

		it('should search tags', function (done) {
			socketTopics.searchTags({uid: adminUid}, {query: 'no'}, function (err, data) {
				assert.ifError(err);
				['nodebb', 'nodejs', 'nosql'].forEach(function (tag) {
					assert.notEqual(data.indexOf(tag), -1);
				});
				done();
			});
		});

		it('should return empty array if query is falsy', function (done) {
			socketTopics.searchAndLoadTags({uid: adminUid}, {query: ''}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.matchCount, 0);
				assert.equal(data.pageCount, 1);
				assert.deepEqual(data.tags, []);
				done();
			});
		});

		it('should search and load tags', function (done) {
			socketTopics.searchAndLoadTags({uid: adminUid}, {query: 'no'}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.matchCount, 3);
				assert.equal(data.pageCount, 1);
				var tagData = [
					{ value: 'nodebb', color: '', bgColor: '', score: 3 },
					{ value: 'nodejs', color: '', bgColor: '', score: 1 },
					{ value: 'nosql', color: '', bgColor: '', score: 1 }
				];
				assert.deepEqual(data.tags, tagData);

				done();
			});
		});

		it('should return error if data is invalid', function (done) {
			socketTopics.loadMoreTags({uid: adminUid}, {after: 'asd'}, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should load more tags', function (done) {
			socketTopics.loadMoreTags({uid: adminUid}, {after: 0}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.tags));
				assert.equal(data.nextStart, 100);
				done();
			});
		});

		it('should error if data is invalid', function (done) {
			socketAdmin.tags.create({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if tag is invalid', function (done) {
			socketAdmin.tags.create({uid: adminUid}, {tag: ''}, function (err) {
				assert.equal(err.message, '[[error:invalid-tag]]');
				done();
			});
		});

		it('should error if tag is too short', function (done) {
			socketAdmin.tags.create({uid: adminUid}, {tag: 'as'}, function (err) {
				assert.equal(err.message, '[[error:tag-too-short]]');
				done();
			});
		});

		it('should create empty tag', function (done) {
			socketAdmin.tags.create({uid: adminUid}, {tag: 'emptytag'}, function (err) {
				assert.ifError(err);
				db.sortedSetScore('tags:topic:count', 'emptytag', function (err, score) {
					assert.ifError(err);
					assert.equal(score, 0);
					done();
				});
			});
		});

		it('should do nothing if tag exists', function (done) {
			socketAdmin.tags.create({uid: adminUid}, {tag: 'emptytag'}, function (err) {
				assert.ifError(err);
				db.sortedSetScore('tags:topic:count', 'emptytag', function (err, score) {
					assert.ifError(err);
					assert.equal(score, 0);
					done();
				});
			});
		});

		it('should error if data is invalid', function (done) {
			socketAdmin.tags.update({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if data.tag is invalid', function (done) {
			socketAdmin.tags.update({uid: adminUid}, {
				bgColor: '#ff0000',
				color: '#00ff00'
			}, function (err) {
				assert.equal(err.message, '[[error:invalid-tag]]');
				done();
			});
		});

		it('should update tag', function (done) {
			socketAdmin.tags.update({uid: adminUid}, {
				tag: 'emptytag',
				bgColor: '#ff0000',
				color: '#00ff00'
			}, function (err) {
				assert.ifError(err);
				db.getObject('tag:emptytag', function (err, data) {
					assert.ifError(err);
					assert.equal(data.bgColor, '#ff0000');
					assert.equal(data.color, '#00ff00');
					done();
				});
			});
		});

		it('should return related topics', function (done) {
			var meta = require('../src/meta');
			meta.config.maximumRelatedTopics = 2;
			var topicData = {
				tags: [{value: 'javascript'}]
			};
			topics.getRelatedTopics(topicData, 0, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				assert.equal(data[0].title, 'topic title 2');
				meta.config.maximumRelatedTopics = 0;
				done();
			});
		});

		it('should return error with invalid data', function (done) {
			socketAdmin.tags.deleteTags({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should do nothing if arrays is empty', function (done) {
			socketAdmin.tags.deleteTags({uid: adminUid}, {tags: []}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should delete tags', function (done) {
			socketAdmin.tags.create({uid: adminUid}, {tag: 'emptytag2'}, function (err) {
				assert.ifError(err);
				socketAdmin.tags.deleteTags({uid: adminUid}, {tags: ['emptytag', 'emptytag2', 'nodebb', 'nodejs']}, function (err) {
					assert.ifError(err);
					db.getObjects(['tag:emptytag', 'tag:emptytag2'], function (err, data) {
						assert.ifError(err);
						assert(!data[0]);
						assert(!data[1]);
						done();
					});
				});
			});
		});

		it('should delete tag', function (done) {
			topics.deleteTag('javascript', function (err) {
				assert.ifError(err);
				db.getObject('tag:javascript', function (err, data) {
					assert.ifError(err);
					assert(!data);
					done();
				});
			});
		});


	});


	after(function (done) {
		db.emptydb(done);
	});
});
