'use strict';

/* globals app, define, utils, socket*/

define('forum/search', ['search'], function(searchModule) {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#results').attr('data-search-query');

		$('#advanced-search #search-input').val(searchQuery);

		var searchIn = $('#advanced-search #search-in');

		fillOutFormFromQueryParams();

		searchIn.on('change', function() {
			$('.post-search-item').toggleClass('hide', searchIn.val() !== 'posts');
		});

		highlightMatches(searchQuery);

		$('#advanced-search').off('submit').on('submit', function(e) {
			e.preventDefault();
			var input = $(this).find('#search-input');

			searchModule.query({
				term: input.val(),
				in: $(this).find('#search-in').val(),
				by: $(this).find('#posted-by-user').val(),
				categories: $(this).find('#posted-in-categories').val(),
				searchChildren: $(this).find('#search-children').is(':checked'),
				replies: $(this).find('#reply-count').val(),
				repliesFilter: $(this).find('#reply-count-filter').val(),
				timeFilter: $(this).find('#post-time-filter').val(),
				timeRange: $(this).find('#post-time-range').val()
			}, function() {
				input.val('');
			});
		});

		enableAutoComplete();
	};

	function fillOutFormFromQueryParams() {
		var params = utils.params();
		if (params) {
			if (params.in) {
				$('#search-in').val(params.in);
				$('.post-search-item').toggleClass('hide', params.in !== 'posts');
			}

			if (params.by) {
				$('#posted-by-user').val(params.by);
			}

			if ((params['categories[]'] || params.categories)) {
				$('#posted-in-categories').val(params['categories[]'] || params.categories);
			}

			if (params.searchChildren) {
				$('#search-children').prop('checked', true);
			}

			if (params.replies) {
				$('#reply-count').val(params.replies);
				$('#reply-count-filter').val(params.repliesFilter);
			}

			if (params.timeRange) {
				$('#post-time-range').val(params.timeRange);
				$('#post-time-filter').val(params.timeFilter);
			}
		}
	}

	function highlightMatches(searchQuery) {
		var searchTerms = searchQuery.split(' ');
		var regexes = [];
		for (var i=0; i<searchTerms.length; ++i) {
			var regex = new RegExp(searchTerms[i], 'gi');
			regexes.push({regex: regex, term: searchTerms[i]});
		}

		$('.search-result-text').each(function() {
			var result = $(this);
			var text = result.html();
			for(var i=0; i<regexes.length; ++i) {
				text = text.replace(regexes[i].regex, '<strong>' + regexes[i].term + '</strong>');
			}
			result.html(text).find('img').addClass('img-responsive');
		});
	}


	function enableAutoComplete() {
		var input = $('#posted-by-user');
		input.autocomplete({
			delay: 100,
			source: function(request, response) {
				socket.emit('user.search', {query: request.term}, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.users) {
						var names = result.users.map(function(user) {
							return user && user.username;
						});
						response(names);
					}
					$('.ui-autocomplete a').attr('data-ajaxify', 'false');
				});
			}
		});
	}

	return Search;
});
