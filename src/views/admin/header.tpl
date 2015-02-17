<!DOCTYPE html>
<html>
<head>
	<title>NodeBB Admin Control Panel</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<link rel="stylesheet" href="{relative_path}/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css?{cache-buster}">
	<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/nanoscroller/nanoscroller.css?{cache-buster}">
	<link rel="stylesheet" type="text/css" href="{relative_path}/admin.css?{cache-buster}" />

	<script>
		var RELATIVE_PATH = "{relative_path}";
		var config = JSON.parse('{configJSON}');
		var app = {};
		app.user = JSON.parse('{userJSON}');
	</script>

	<!--[if lt IE 9]>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/es5-shim/2.3.0/es5-shim.min.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7/html5shiv.js"></script>
  		<script src="//cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.js"></script>
	    <script>__lt_ie_9__ = 1;</script>
	<![endif]-->

	<script type="text/javascript" src="{relative_path}/vendor/chart.js/chart.min.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/hammer/hammer.min.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/nodebb.min.js?{cache-buster}"></script>
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			waitSeconds: 3,
			urlArgs: "{cache-buster}",
			paths: {
				'admin': '../admin',
				'vendor': '../../vendor',
				'buzz': '../../vendor/buzz/buzz.min'
			}
		});

		app.inAdmin = true;
	</script>
	<script type="text/javascript" src="{relative_path}/vendor/colorpicker/colorpicker.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/src/admin/admin.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/ace/ace.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/nanoscroller/nanoscroller.min.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/jquery/event/jquery.event.drag.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/jquery/event/jquery.event.drop.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/semver/semver.browser.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/jquery/deserialize/jquery.deserialize.min.js?{cache-buster}"></script>
	<script type="text/javascript" src="{relative_path}/vendor/mousetrap/mousetrap.js?{cache-buster}"></script>

	<!-- BEGIN scripts -->
	<script type="text/javascript" src="{scripts.src}"></script>
	<!-- END scripts -->
</head>

<body class="admin">
	<div class="navbar navbar-inverse navbar-fixed-top header">
		<div class="container">
			<div class="navbar-header">
				<a class="navbar-brand nodebb-logo" href="{relative_path}/admin/general/dashboard"><img src="{relative_path}/images/logo.png" alt="NodeBB ACP" /> Admin Control Panel <span id="breadcrumbs" class="hidden-xs"></span></a>
			</div>
			<ul class="nav navbar-nav">
				<li>
					<a href="#" id="reconnect"></a>
				</li>
			</ul>

			<ul id="logged-in-menu" class="nav navbar-nav navbar-right">
				<form class="navbar-form navbar-left hidden-xs" role="search">
					<div class="form-group" id="acp-search" >
						<div class="dropdown" >
							<input type="text" data-toggle="dropdown" class="form-control" placeholder="/">
							<ul class="dropdown-menu" role="menu"></ul>
						</div>
					</div>
				</form>
				<li class="nav-home">
					<a href="{relative_path}/" target="_blank" title="Open forum homepage"><i class="fa fa-home"></i></a>
				</li>

				<li id="user_label" class="dropdown">
					<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
						<img src="{userpicture}"/>
					</a>
					<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
						<li>
							<a id="user-profile-link" href="{relative_path}/user/{userslug}" target="_top"><span>Profile</span></a>
						</li>
						<li id="logout-link">
							<a href="#">Log out</a>
						</li>
					</ul>
				</li>
			</ul>
		</div>
	</div>

	<div class="wrapper">
		<div id="main-menu" class="nano">
			<div class="nano-content">
			<!-- IMPORT admin/partials/menu.tpl -->
			</div>
		</div>
		<div class="col-sm-12" id="content">