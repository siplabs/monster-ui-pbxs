define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		toastr = require('toastr'),
		nicescroll = require('nicescroll');

	var app = {

		name: "pbxs",

		i18n: [ 'en-US', 'fr-FR' ],

		requests: {
			'pbxsManager.listCallflows': {
				url: 'accounts/{accountId}/callflows',
				verb: 'GET'
			},
			'pbxsManager.getAccount': {
				url: 'accounts/{accountId}',
				verb: 'GET'
			},
			'pbxsManager.listNumbers': {
				url: 'accounts/{accountId}/phone_numbers',
				verb: 'GET'
			},
			'pbxsManager.get': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}',
				verb: 'GET'
			},
			'pbxsManager.update': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}',
				verb: 'POST'
			},
			'pbxsManager.activate': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}/activate',
				verb: 'PUT'
			},
			'pbxsManager.search': {
				url: 'phone_numbers?prefix={prefix}&quantity={quantity}',
				verb: 'GET'
			},
			'pbxsManager.delete': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}',
				verb: 'DELETE'
			},
			'pbxsManager.create': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}/docs/{fileName}',
				verb: 'PUT'
			},
			'pbxsManager.port': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}/port',
				verb: 'PUT'
			},
			'pbxsManager.createDoc': {
				url: 'accounts/{accountId}/phone_numbers/{phoneNumber}/docs/{fileName}',
				verb: 'PUT'
			},
			'oldTrunkstore.create': {
				url: 'accounts/{accountId}/connectivity',
				verb: 'PUT'
			},
			'oldTrunkstore.list': {
				url: 'accounts/{accountId}/connectivity',
				verb: 'GET'
			},
			'oldTrunkstore.get': {
				url: 'accounts/{accountId}/connectivity/{connectivityId}',
				verb: 'GET'
			},
			'oldTrunkstore.update': {
				url: 'accounts/{accountId}/connectivity/{connectivityId}',
				verb: 'POST'
			}
		},

		subscribe: {
			'pbxsManager.activate': '_render',
			'pbxsManager.edit': 'editServer',
		},

		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container){
			var self = this;

			self._render(container);
		},

		// subscription handlers
		_render: function(container) {
			var self = this,
				pbxsManager = $(monster.template(self, 'pbxsManager')),
				parent = _.isEmpty(container) ? $('#ws-content') : container;

			(parent)
				.empty()
				.append(pbxsManager);

			self.renderList(-1, parent, function(data) {
				self.refreshUnassignedList(function() {
					self.bindEvents(pbxsManager);

					if(data.length === 0) {
						monster.pub('pbxsManager.edit', {});
					}
					else if(data.length >= 1) {
						monster.pub('pbxsManager.edit', { id: 0 });

						pbxsManager.find('.pbx-wrapper[data-id="0"]').addClass('selected');
					}
				});
			});

			pbxsManager.find('#pbxs_manager_listpanel').niceScroll({
				cursorcolor:"#333",
				autohidemode:false,
				cursorborder:"1px solid #666"
			}).railh.addClass('pbx-fixed-hscroll');

			pbxsManager.find('#unassigned_numbers_wrapper').niceScroll({
				cursorcolor:"#333",
				cursoropacitymin:0.5,
				hidecursordelay:1000
			}).rail.addClass('unassigned-number-fixed-vscroll');
		},

		editServer: function(args) {
			var self = this;

			monster.parallel({
				realm: function(callback){
					 monster.request({
						resource: 'pbxsManager.getAccount',
						data: {
							accountId: self.accountId,
						},
						success: function(_data_account, status) {

							callback(null, _data_account.data.realm);
						}
					});
				},
				account: function(callback){
					self.getAccount(function(_data) {
						callback(null, _data);
					});
				},
				numbers: function(callback) {
					self.listAllNumbers(function(_data) {
						callback(null, _data);
					});
				}
			},
			function(err, results){
				var parent = args.parent || $('#ws-content'),
					target = args.target || parent.find('#pbxs_manager_view'),
					_callbacks = args.callbacks || {},
					callbacks = {
						saveSuccess: _callbacks.saveSuccess || function(_data) {
							var savedId = (args.id === 0 || args.id) ? args.id : _data.data.servers.length-1;

							self.renderList(savedId, parent, function() {
								self.renderPbxsManager(_data, $.extend(true, defaults, _data.data.servers[savedId]), target, callbacks);
							}, _data.data.servers);
						},

						saveError: _callbacks.saveError,

						deleteSuccess: _callbacks.deleteSuccess || function() {
							target.empty();

							 self.renderList();
						},

						cancelSuccess: _callbacks.cancelSuccess || function() {
							monster.pub('pbxsManager.edit', {
								id: args.id,
								parent: parent,
								target: target,
								callbacks: callbacks
							});
						},

						deleteError: _callbacks.deleteError,

						afterRender: _callbacks.afterRender
					},
					defaults = $.extend(true, {
						auth: {
							auth_user: 'user_' + monster.util.randomString(8),
							auth_password: monster.util.randomString(12),
							auth_method: 'IP'
						},
						options: {
							e911_info: {}
						},
						cfg: {
							register_time: '360',
							opening_pings: true,
							caller_id_header: 'p-asserted',
							supported_codecs: 'g722',
							signaling_type: 'rfc_2833',
							allow_refer: true,
							use_t38: true
						},
						extra: {
							support_email: monster.config.support_email || 'support@2600hz.com',
							pbx_help_link: monster.config.pbx_help_link || 'https://2600hz.atlassian.net/wiki/display/docs/Trunking.io',
							pbx_help_configuration_link: monster.config.pbx_help_configuration_link || 'https://2600hz.atlassian.net/wiki/display/docs/Trunking_config.io',
							configure: 'manually',
							realm: results.realm,
							id: args.id || (args.id === 0 ? 0 : 'new')
						}
					}, args.data_defaults || {});

				if(results.account.data.servers) {
					$.each(results.account.data.servers, function(k, server) {
						$.each(server.DIDs, function(did, v) {
							if(did in results.numbers.data.numbers) {
								var num = results.numbers.data.numbers[did];
								results.account.data.servers[k].DIDs[did].features = num.features;
								if('locality' in num) {
									results.account.data.servers[k].DIDs[did].isoCountry = num.locality.country || '';
								}
							}
						});
					});
				}

				if(typeof args === 'object' && (args.id || args.id === 0)) {
					self.renderPbxsManager(results.account, $.extend(true, defaults, results.account.data.servers[args.id]), target, callbacks);
				}
				else {
					self.renderEndpoint(results.accounts, defaults, target, callbacks, parent);
				}
			});
		},

		listAvailablePbxs: function() {
			return ['allworks', 'altigen', 'asterisk', 'avaya', 'bluebox', 'cisco', 'digium', 'epygi', 'freepbx', 'freeswitch', 'mitel', 'objectworld', 'other', 'pingtel', 'responsepoint', 'samsung', 'shoretel', 'sutus', 'talkswitch', 'threecom', 'taridium'];
		},

		listAllNumbers: function(success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.listNumbers',
				data: {
					accountId: self.accountId,
				},
				success: function(data, status) {
					if(typeof success == 'function') {
						success(data, status);
					}
				},
				error: function(data, status) {
					if(typeof error == 'function') {
						error(data, status);
					}
				}
			});
		},

		listCallflows: function(success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.listCallflows',
				data: {
					accountId: self.accountId,
				},
				success: function(data, status) {
					if(typeof success == 'function') {
						success(data, status);
					}
				},
				error: function(data, status) {
					if(typeof error == 'function') {
						error(data, status);
					}
				}
			});
		},

		createAccount: function(success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.getAccount',
				data: {
					accountId: self.accountId,
				},
				success: function(_data, status) {
					var account_data = {
						account: {
							credits: {
								prepay: '0.00'
							},
							trunks: '0',
							inbound_trunks: '0',
							auth_realm: _data.data.realm
						},
						billing_account_id: self.accountId,
						DIDs_Unassigned: {},
						servers: []
					};

					monster.request({
						resource: 'oldTrunkstore.create',
						data: {
							accountId: self.accountId,
							data: account_data
						},
						success: function(data, status) {
							if(typeof success == 'function') {
								success(data, status);
							}
						},
						error: function(data, status) {
							if(typeof error == 'function') {
								error(data, status);
							}
						}
					});
				}
			});
		},

		listAccounts: function(success, error) {
			var self = this;

			monster.request({
				resource: 'oldTrunkstore.list',
				data: {
					accountId: self.accountId,
				},
				success: function(data, status) {
					if(typeof success == 'function') {
						success(data, status);
					}
				},
				error: function(data, status) {
					if(typeof error == 'function') {
						error(data, status);
					}
				}
			});
		},

		getAccount: function(success, error) {
			var self = this;

			monster.request({
				resource: 'oldTrunkstore.get',
				data: {
					accountId: self.accountId,
					connectivityId: self.connectivityId
				},
				success: function(data, status) {
					if(typeof success == 'function') {
						success(data, status);
					}
				},
				error: function(data, status) {
					if(typeof error == 'function') {
						error(data, status);
					}
				}
			});
		},

		listServers: function(success, error) {
			var self = this,
				getAccount = function() {
					self.getAccount(
						function(_data, status) {
							success(_data.data.servers, status);
						}
					);
				};

			self.listAccounts(function(data, status) {
				if(data.data.length) {
					self.connectivityId = data.data[0];

					getAccount();
				}
				else {
					self.createAccount(function(_data) {
							self.listAccounts(function(data, status) {
								self.connectivityId = data.data[0];

								getAccount();
							});
						},
						function(_data, status) {
							var template = monster.template(self, '!' + self.i18n.active().error_signup, { status: status });

							monster.ui.alert(template);
						}
					);
				}
			});
		},

		getNumber: function(phone_number, success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.get',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(phone_number)
				},
				success: function(_data, status) {
					if(typeof success === 'function') {
						success(_data);
					}
				},
				error: function(_data, status) {
					if(typeof error === 'function') {
						error(_data);
					}
				}
			});
		},

		updateNumber: function(phone_number, data, success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.update',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(phone_number),
					data: data
				},
				success: function(_data, status) {
					if(typeof success === 'function') {
						success(_data);
					}
				},
				error: function(_data, status) {
					if(typeof error === 'function') {
						error(_data);
					}
				}
			});
		},

		createNumber: function(phone_number, success, error) {
			var self = this;

			//TODO flag request Check to avoid multiple creation
			monster.request({
				resource: 'pbxsManager.create',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(phone_number),
					data: {}
				},
				success: function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status);
					}
				},
				error: function(_data, status) {
					if(typeof error == 'function') {
						error(_data, status);
					}
				}
			});
		},

		activateNumber: function(phone_number, success, error) {
			var self = this;

			//TODO flag request Check to avoid multiple creation
			monster.request({
				resource: 'pbxsManager.activate',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(phone_number),
					data: {}
				},
				success: function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status);
					}
				},
				error: function(_data, status) {
					if(typeof error == 'function') {
						error(_data, status);
					}
				}
			});
		},

		deleteNumber: function(phone_number, success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.delete',
				data: {
					accountId: self.accountId,
					phoneNumber: encodeURIComponent(phone_number)
				},
				success: function(data, status) {
					if(typeof success == 'function') {
						success(data, status);
					}
				},
				error: function(data, status) {
					if(typeof error == 'function') {
						error(data, status);
					}
				}
			});
		},

		searchNumbers: function(data, success, error) {
			var self = this;

			monster.request({
				resource: 'pbxsManager.search',
				data: {
					prefix: data.prefix,
					quantity: data.quantity || 15
				},
				success: function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status);
					}
				},
				error: function(_data, status) {
					if(typeof error == 'function') {
						error(_data, status);
					}
				}
			});
		},

		cleanPhoneNumberData: function(data) {
			var self = this;

			return data;
		},

		cleanFormData: function(data) {
			var self = this;

			if(data.server_name === '' || !('server_name' in data)) {
				data.server_name = "PBX " + data.extra.serverid;
			}

			if(data.hasOwnProperty('extra') && data.extra.hasOwnProperty('compatibilityMode')) {
				data.options.media_handling = data.extra.compatibilityMode === true ? 'process' : 'bypass';
			}

			delete data.extra;

			return data;
		},

		saveEndpoint: function(endpointData, data, success, error) {
			var self = this,
				index = endpointData.extra.serverid,
				new_data = $.extend(true, {}, data.data);

			self.cleanFormData(endpointData);

			if(endpointData.server_name) {
				if((index || index === 0) && index != 'new') {
					$.extend(true, new_data.servers[index], endpointData);
				}
				else {
					new_data.servers.push($.extend(true, {
						DIDs: {},
						options: {
							enabled: true,
							inbound_format: 'e.164',
							international: false,
							caller_id: {},
							e911_info: {},
							failover: {}
						},
						permissions: {
							users: []
						},
						monitor: {
							monitor_enabled: false
						}
					}, endpointData));
				}

				self.updateOldTrunkstore(new_data, success, error);
			}
			else {
				monster.ui.alert('formatting_error');
			}
		},

		normalizeData: function(data) {
			var self = this;

			// We don't accept false for a disabled feature anymore, so we delete the key now. 
			// We also delete empty key set at the servers level
			$.each(data.servers, function(k, server) {
				delete data.servers[k][''];
				$.each(server.DIDs, function(k2, number) {
					$.each(number, function(k3, feature) {
						if(feature === false) {
							delete data.servers[k].DIDs[k2][k3];
						}
					});
				});
			});

			return data;
		},

		updateOldTrunkstore: function(data, success, error) {
			var self = this;

			self.normalizeData(data);

			monster.request({
				resource: 'oldTrunkstore.update',
				data: {
					accountId: self.accountId,
					connectivityId: self.connectivityId,
					data: data
				},
				success: function(_data, status) {
					if(typeof success == 'function') {
						success(_data, status);
					}
				},
				error: function(_data, status) {
					if(typeof error == 'function') {
						error(_data, status);
					}
				}
			});
		},

		loadSpecificStep: function(step_index, callbacks, parent) {
			$('.wizard-top-bar', parent).hide();
			$('.wizard-content-step', parent).hide();
			$('.wizard-content-step[data-step="'+ step_index +'"]', parent).show();

			$('.wizard-buttons button', parent).hide();
			$('.cancel', parent).show();
			$('.submit-btn', parent).show();

			$('#list_pbxs_navbar').hide();

			$('.cancel', parent).off()
								.on('click', function(ev) {
				ev.preventDefault();

				if(typeof callbacks.cancelSuccess === 'function') {
					callbacks.cancelSuccess();
				}
			});
		},

		initializeWizard: function(parent, callback_submit) {
			var self = this,
				max_step = parseInt($('.wizard-top-bar', parent).attr('data-max_step'));

			$('.wizard-top-bar', parent).attr('data-active_step', '1');

			$('.wizard-content-step', parent).hide();
			$('.wizard-content-step[data-step="1"]', parent).show();

			$('.wizard-top-bar', parent).attr('data-active_step', '1');

			if(max_step !== 1) {
				$('.submit-btn', parent).hide();
			}
			else {
				$('.next-step', parent).hide();
			}

			$('.prev-step', parent).hide();

			$('.step', parent).on('click', function() {
				var step = $(this).data('step');
				if($(this).hasClass('completed')) {
					self.validate_step($('.wizard-top-bar', parent).attr('data-active_step'), parent, function() {
						self.change_step(step, max_step, parent);
					});
				}
			});

			$('.next-step', parent).on('click', function(ev) {
				ev.preventDefault();

				current_step = parseInt($('.wizard-top-bar', parent).attr('data-active_step'));
				self.validate_step(current_step, parent, function() {
					self.change_step(++current_step, max_step, parent);
				});
			});

			$('.prev-step', parent).on('click', function(ev) {
				ev.preventDefault();

				current_step = parseInt($('.wizard-top-bar', parent).attr('data-active_step'));
				self.change_step(--current_step, max_step, parent);
			});

			$('.cancel', parent).on('click', function(ev) {
				ev.preventDefault();

				monster.pub('pbxsManager.activate');
			});

			$('.submit-btn', parent).on('click', function(ev) {
				ev.preventDefault();

				current_step = parseInt($('.wizard-top-bar', parent).attr('data-active_step'));
				self.validate_step(current_step, parent, function() {
					if(typeof callback_submit === 'function') {
						callback_submit();
					}
				});
			});
		},

		change_step: function(step_index, max_step, parent) {
			var self = this;

			$('.step', parent).removeClass('active');
			$('.step[data-step="'+step_index+'"]', parent).addClass('active');

			for(var i = step_index; i >= 1; --i) {
				$('.step[data-step="'+i+'"]', parent).addClass('completed');
			}

			$('.wizard-content-step', parent).hide();
			$('.wizard-content-step[data-step="'+ step_index +'"]', parent).show();

			$('.cancel', parent).hide();
			$('.prev-step', parent).show();
			$('.next-step', parent).show();
			$('.submit-btn', parent).hide();

			if(step_index === max_step) {
				$('.next-step', parent).hide();
				$('.submit-btn', parent).show();
			}

			if(step_index === 1) {
				$('.prev-step', parent).hide();
				$('.cancel', parent).show();
			}

			$('.wizard-top-bar', parent).attr('data-active_step', step_index);
		},

		validate_step: function(step, parent, callback) {
			var self = this,
				validated = monster.ui.valid($('#endpoint')),
				step = parseInt(step),
				error_message = self.i18n.active().please_correct;

			var form_data = form2object('endpoint');

			if(validated) {
				if(step === 1) {
					if($('.pbx-brand-list .pbx.selected', parent).size() === 0) {
						error_message += '<br/>- ' + self.i18n.active().no_pbx_selected;
						validated = false;
					}
				}
				else if(step === 2) {
					/* IP */
					if($('input[type="radio"][name="auth.auth_method"]:checked', parent).val() === 'IP') {
						if(!($('#auth_ip', parent).val().match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/) !== null)) {
							validated = false;
							error_message += '<br/>- ' + self.i18n.active().not_valid_ip;
						}
					}
					/* Auth */
					else {

					}
				}
				else if(step === 3) {
				}

				if(validated === true) {
					if(typeof callback === 'function') {
						callback();
					}
				}
				else {
					monster.ui.alert(error_message);
				}
			}
		},

		renderEndpoint: function(data, endpointData, target, callbacks, parent) {
			if(!endpointData.server_name) {
				endpointData.server_name = null;
			}

			var self = this,
				interval,
				interval_bar,
				current_automatic_step = 1,
				pause_polling = false,
				submit_wizard_callback = function() {
					var form_data = form2object('endpoint');

					form_data.auth.auth_method = $('input[type="radio"][name="auth.auth_method"]:checked', endpointHtml).val(),
					form_data.server_type = $('.pbx-brand-list .pbx.selected', endpointHtml).data('pbx_name'),
					form_data.cfg = $.extend(true, cfg, form_data.cfg);

					self.getAccount(function(globalData) {
						self.saveEndpoint(form_data, globalData, function(_data) {
							if(typeof callbacks.saveSuccess == 'function') {
								callbacks.saveSuccess(_data);
							}
						});
					});
				},
				cfg = {},
				dataTemplate = _.extend({ i18n: { supportEmail: endpointData.extra.support_email }}, endpointData),
				endpointHtml = $(monster.template(self, 'endpoint', dataTemplate));

			$('.icon-question-sign[data-toggle="tooltip"]', endpointHtml).tooltip();

			$.each(endpointData.cfg, function(k, v) {
				if(typeof v === 'object') {
					$.each(v, function(k2, v2) {
						$('button[data-value="'+v2+'"]', $('.btn-group[data-type="'+k+'"]', endpointHtml)).addClass('btn-primary');
					});
				}
				else {
					$('button[data-value="'+v+'"]', $('.btn-group[data-type="'+k+'"]', endpointHtml)).addClass('btn-primary');
				}
			});

			self.initializeWizard(endpointHtml, submit_wizard_callback);

			$('.static-ip-block', endpointHtml).hide();
			$('.static-ip-block[data-value="'+ endpointData.auth.auth_method +'"]', endpointHtml).show();

			$('.btn-group .btn', endpointHtml).on('click', function(ev) {
				ev.preventDefault();

				var $btn_group = $(this).parent('.btn-group');
				if($btn_group.data('select') === 'multi') {
					$(this).toggleClass('btn-primary');

					cfg[$btn_group.data('type')] = [];
					$('.btn', $btn_group).each(function(k, v) {
						if($(v).hasClass('btn-primary')) {
							cfg[$btn_group.data('type')].push($(v).data('value'));
						}
					});
				}
				else {
					if(!($(this).hasClass('btn-primary'))) {
						$('.btn', $(this).parent()).removeClass('btn-primary');
						$(this).addClass('btn-primary');
					}

					cfg[$btn_group.data('type')] = $(this).data('value');
				}
			});

			$('#submit_settings', endpointHtml).on('click', function(ev) {
				ev.preventDefault();

				submit_wizard_callback();
			});

			$('input[type="radio"][name="auth.auth_method"]', endpointHtml).on('click', function() {
				$('.static-ip-block', endpointHtml).hide();
				$('.static-ip-block[data-value="'+$(this).val()+'"]', endpointHtml).slideDown();
			});

			$('.pbx-brand-list .pbx', endpointHtml).each(function() {
				if($(this).data('pbx_name') === endpointData.server_type) {
					$(this).addClass('selected');
					$('.pbx-brand-list .pbx:not(.selected)', endpointHtml).css('opacity', '0.2');
					return false;
				}
			});

			if(endpointData.server_type && $('.pbx-brand-list .pbx.selected', endpointHtml).size() === 0) {
				$('.pbx-brand-list .pbx.other', endpointHtml).addClass('selected');
				$('.pbx-brand-list .pbx:not(.selected)', endpointHtml).css('opacity', '0.2');
			}

			if(!endpointData.server_type) {
				$('.info_pbx', endpointHtml).hide();
			}

			$('.pbx-brand-list .pbx', endpointHtml).click(function() {
				$('.pbx-brand-list .pbx', endpointHtml).removeClass('selected').css('opacity', '0.2');
				$(this).addClass('selected');

				$('.selected-pbx', endpointHtml).html($('.pbx-brand-list .selected', endpointHtml).data('pbx_name'));
				$('.info_pbx', endpointHtml).slideDown();
			});

			if(endpointData.load_step && endpointData.load_step > 0) {
				self.loadSpecificStep(endpointData.load_step, callbacks, endpointHtml);
			}
			else {
				$('#list_pbxs_navbar', parent).hide();
			}

			endpointHtml.find('.switch').bootstrapSwitch()
			monster.ui.protectField(endpointHtml.find('#auth_password'), endpointHtml);
			monster.ui.validate(endpointHtml.find('#endpoint'), {
				rules: {
					"auth.ip": {
						"ipv4": true
					}
				}
			});

			(target)
				.empty()
				.append(endpointHtml);
		},

		refreshListNumbers: function(didsList, _parent) {
			var parent = _parent || $('#pbx_connector_container'),
				self = this,
				numberWrapper = parent.find('#numbers_wrapper');

			numberWrapper.empty();

			var arrayNumbers = [];

			_.each(didsList, function(details, number) {
				details.phoneNumber = number;
				arrayNumbers.push(details);
			});

			arrayNumbers = monster.util.sort(arrayNumbers, 'phoneNumber');

			if($.isEmptyObject(didsList)) {
				numberWrapper.append(monster.template(self, 'noNumbers'));
			}
			else {
				numberWrapper.append(monster.template(self, 'listNumbers', { DIDs: arrayNumbers }));
			}

			$('#count_phones', parent).html(arrayNumbers.length);
			$('#trigger_links', parent).hide();
		},

		renderPbxsManager: function(data, endpointData, target, callbacks) {
			var self = this,
				serverId = endpointData.extra.id,
				img_link = endpointData.server_type ? endpointData.server_type.replace('.','').toLowerCase() : 'other';

			$.inArray(img_link, self.listAvailablePbxs()) < 0 ? img_link = 'other' : true;
			endpointData.img_link = img_link;

			endpointData.servers_list = [];

			$.each(data.data.servers, function(k, v) {
				if(k !== serverId) {
					var temp_img_link = v.server_type ? v.server_type.replace('.','').toLowerCase() : 'other';
					$.inArray(temp_img_link, self.listAvailablePbxs()) < 0 ? temp_img_link = 'other' : true;

					endpointData.servers_list.push({
						index: k,
						server_name: v.server_name,
						img_link: temp_img_link
					});
				}
			});

			var pbxsManager = $(monster.template(self, 'endpointNumbers', endpointData)),
				callback_listing = function(data_cb) {
					self.refreshListNumbers(data_cb, pbxsManager);
				};

			self.refreshListNumbers(endpointData.DIDs, pbxsManager);

			$('#list_pbxs_navbar').show();

			var searchResults = pbxsManager.find('#search_results'),
				numbersWrapper = pbxsManager.find('#numbers_wrapper');

			searchResults.hide();

			pbxsManager.find('.search-query').on('keyup', function() {
				var input = $(this),
					rows = numbersWrapper.find('.number-wrapper'),
					searchString = $.trim(input.val().toLowerCase().replace(/[^0-9]/g, '')),
					matches = [],
					cache = {};

				$.each(rows, function(k, v) {
					var data = $(this).data(),
						key = data.phone_number;

					cache[key] = $(this);
				});

				if (!searchString) {
					numbersWrapper.show();
					searchResults.empty().hide();
				}
				else {
					searchResults.show().empty();

					$.each(cache, function(phone_number, rowArray) {
						if (phone_number.indexOf(searchString)>-1) {
							matches.push({phone_number: phone_number, selected: $(rowArray).hasClass('selected')});
						}
					});

					if(matches.length > 0) {
						searchResults.append(monster.template(self, 'searchResults', _.extend({ i18n: { amountNumbers: matches.length }}, {matches: matches})));
					}
					else {
						searchResults.append(monster.template(self, 'noResults'));
					}

					numbersWrapper.hide();
				}
			});

			pbxsManager.on('click', '.number-wrapper', function(event) {
				if($(event.target).closest('.number-options').size() < 1) {
					var toggleNumberSelected = function(element, updateCb) {
							var currentCb = element.find('input[type="checkbox"]'),
								cbValue = currentCb.prop('checked');

							if(updateCb) {
								currentCb.prop('checked', !cbValue);
							}

							element.toggleClass('selected');
						},
						currentNumberWrapper = $(this);

					toggleNumberSelected(currentNumberWrapper, !$(event.target).is('input:checkbox'));

					if(currentNumberWrapper.parents('#search_results').size() > 0) {
						var $wrapper = pbxsManager.find('#numbers_wrapper .number-wrapper[data-phone_number="'+currentNumberWrapper.data('phone_number')+'"]');

						toggleNumberSelected($wrapper, true);
					}

					var links = pbxsManager.find('#trigger_links');

					pbxsManager.find('.number-wrapper.selected').size() > 0 ? links.show('fast') : links.hide();
				}
			});

			pbxsManager.find('#delete_pbx').on('click', function() {
				monster.ui.confirm(self.i18n.active().delete_pbx_confirmation, function() {
					self.getAccount(function(_globalData) {
						_globalData.data.servers.splice(endpointData.extra.id, 1);

						self.updateOldTrunkstore(_globalData.data, callbacks.deleteSuccess);
					});
				});
			});

			pbxsManager.find('.settings-pbx-link').on('click', function() {
				endpointData.load_step = parseInt($(this).data('step'));
				self.renderEndpoint(data, endpointData, target, callbacks, pbxsManager);
			});

			pbxsManager.find('.buy-numbers-link').on('click', function(e) {
				e.preventDefault();

				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					callbacks: {
						success: function(numbers) {
							self.getAccount(function(globalData) {

								_.each(numbers, function(val, key) {
									globalData.data.servers[serverId].DIDs[key] = {
										failover: false,
										cnam: false,
										dash_e911: false
									};
								});

								self.updateOldTrunkstore(globalData.data, function(updatedData) {
									self.renderList(serverId, undefined, undefined, updatedData.data.servers);
									self.listNumbersByPbx(serverId, callback_listing);
								});
							});
						}
					}
				});
			});

			pbxsManager.find('.pbx-dropdown:not(.empty)').on('click', function(ev) {
				ev.preventDefault();

				var list_numbers = [];
				pbxsManager.find('.number-wrapper.selected').each(function() {
					list_numbers.push($(this).data('phone_number'));
				});

				if(list_numbers.length > 0) {
					var newIndex = $(this).data('index');

					self.getAccount(function(globalData) {
						var serverName = globalData.data.servers[newIndex].server_name,
							template = monster.template(self, '!' + self.i18n.active().confirm_move, { serverName: serverName });

						monster.ui.confirm(template, function() {
							$.each(list_numbers, function(k, v) {
								globalData.data.servers[newIndex].DIDs[v] = globalData.data.servers[serverId].DIDs[v];
								delete globalData.data.servers[serverId].DIDs[v];
							});

							self.updateOldTrunkstore(globalData.data, function(dataTrunkstore) {
								self.listNumbersByPbx(serverId, callback_listing, dataTrunkstore.data);
								self.renderList(serverId);
							});
						});
					});
				}
				else {
					monster.ui.alert(self.i18n.active().no_number_selected);
				}
			});

			pbxsManager.find('#port_numbers').on('click', function(ev) {
				ev.preventDefault();

				monster.pub('common.port.render', {
					accountId: self.accountId,
					callbacks: {}
				});
			});

			pbxsManager.on('click', '.failover-number', function() {
				var failoverCell = $(this).parents('.number-wrapper').first(),
					phoneNumber = failoverCell.data('phone_number');

				if(phoneNumber) {
					var args = {
						phoneNumber: phoneNumber,
						callbacks: {
							success: function(data) {
								if('failover' in data.data) {
									if(failoverCell.find('.features i.icon-thumbs-down').size() === 0) {
										failoverCell
											.find('.features')
											.append('<i class="icon-green icon-thumbs-down"></i>')
									}
								}
								else {
									failoverCell
										.find('.features i.icon-thumbs-down')
										.remove()
								}
							}
						}
					};

					monster.pub('common.failover.renderPopup', args);
				}
			});

			pbxsManager.on('click', '.cnam-number', function() {
				var cnamCell = $(this).parents('.number-wrapper').first(),
					phoneNumber = cnamCell.data('phone_number');

				if(phoneNumber) {
					var args = {
						phoneNumber: phoneNumber,
						callbacks: {
							success: function(data) {
								if(!($.isEmptyObject(data.data.cnam))) {
									if(cnamCell.find('.features i.icon-user').size() === 0) {
										cnamCell
											.find('.features')
											.append('<i class="icon-green icon-user"></i>')
									}
								}
								else {
									cnamCell
										.find('.features i.icon-user')
										.remove()
								}
							}
						}
					};

					monster.pub('common.callerId.renderPopup', args);
				}
			});

			pbxsManager.on('click', '.e911-number', function() {
				var e911Cell = $(this).parents('.number-wrapper').first(),
					phoneNumber = e911Cell.data('phone_number');

				if(phoneNumber) {
					var args = {
						phoneNumber: phoneNumber,
						callbacks: {
							success: function(data) {
								if(!($.isEmptyObject(data.data.dash_e911))) {
									if(e911Cell.find('.features i.icon-ambulance').size() === 0) {
										e911Cell
											.find('.features')
											.append('<i class="icon-green icon-ambulance"></i>')
									}
								}
								else {
									e911Cell
										.find('.features i.icon-ambulance')
										.remove()
								}
							}
						}
					};

					monster.pub('common.e911.renderPopup', args);
				}
			});

			pbxsManager.find('#remove_numbers').on('click', function() {
				var dataPhoneNumber,
					phone_number,
					$selected_numbers = pbxsManager.find('.number-wrapper.selected'),
					nb_numbers = $selected_numbers.size();

				if(nb_numbers > 0) {
					monster.ui.confirm(self.i18n.active().remove_number_confirmation, function() {
							var array_DIDs = [];

							$selected_numbers.each(function() {
								dataPhoneNumber = $(this).data('phone_number'),
								phone_number = dataPhoneNumber.match(/^\+?1?([2-9]\d{9})$/);

								if(phone_number[1]) {
									array_DIDs.push('+1' + phone_number[1]);
								}
							});

							self.getAccount(function(_globalData) {
								$.each(array_DIDs, function(i, k) {
									if(k in _globalData.data.servers[serverId].DIDs) {
										delete _globalData.data.servers[serverId].DIDs[k]
									}
								});

								self.updateOldTrunkstore(_globalData.data,
									function(dataTrunkstore) {
										self.refreshUnassignedList(function() {
											self.listNumbersByPbx(serverId, callback_listing, dataTrunkstore.data);

											self.renderList(serverId, undefined, undefined, dataTrunkstore.data.servers);
										});
									},
									function() {
										self.listNumbersByPbx(serverId, callback_listing);
									}
								);
							});
						},
						function() {

						}
					);
				}
				else {
					monster.ui.alert(self.i18n.active().no_number_selected);
				}
			});

			(target || $('#ws-content'))
				.empty()
				.append(pbxsManager);
		},

		refreshUnassignedList: function(_callback) {
			var self = this;

			self.listAvailableNumbers(function(unassignedNumbers) {
				unassignedNumbers = monster.util.sort(unassignedNumbers, 'phoneNumber');

				var data = {
					unassignedNumbers: unassignedNumbers
				};

				$('#unassigned_numbers_wrapper').empty()
												.append(monster.template(self, 'pbxsUnassignedNumbers', data));

				$('#unassigned_numbers_count').empty()
											  .html(unassignedNumbers.length);

				if(typeof _callback === 'function') {
					_callback();
				}
			});
		},

		bindEvents: function(parent) {
			var self = this,
				serverId;

			parent.find('[data-toggle="tooltip"]').tooltip();

			parent.find('.link-box.assign').on('click', function() {
				var numbersData = [];

				parent.find('#unassigned_numbers .unassigned-number.selected').each(function(k, v) {
					if($(v).data('phone_number')) {
						numbersData.push($(this).data('phone_number'));
					}
				});

				serverId = parseInt(parent.find('#pbx_connector_container').data('id'));

				if(serverId >= 0) {
					self.getAccount(function(globalData) {
						$.each(numbersData, function(k, v) {
							globalData.data.servers[serverId].DIDs[v] = {};
						});

						self.updateOldTrunkstore(globalData.data, function(dataTrunkstore) {
							self.refreshUnassignedList(function() {
								self.listNumbersByPbx(serverId, function(cb_data) {
									self.refreshListNumbers(cb_data, parent);
									self.renderList(serverId, undefined, undefined, dataTrunkstore.data.servers);
								}, dataTrunkstore.data);
							});
						});
					});
				}
				else {
					monster.ui.alert(self.i18n.active().no_pbx_selected);
				}
			});

			parent.find('#unassigned_numbers_header').on('click', function() {
				var $this = $(this),
					$content = parent.find('#unassigned_numbers .content'),
					niceScrollBar = $('#unassigned_numbers_wrapper', parent).getNiceScroll()[0];

				if($this.hasClass('open')) {
					$this.removeClass('open');
					$content.hide();
					niceScrollBar.resize();
				}
				else {
					$this.addClass('open');
					$content.slideDown(niceScrollBar.resize);
				}
			});

			parent.on('click', '.unassigned-number', function(event) {
				var $this = $(this);
				$this.toggleClass('selected');

				if(!$(event.target).is('input:checkbox')) {
					var $current_cb = $this.find('input[type="checkbox"]'),
						cb_value = $current_cb.prop('checked');

					$current_cb.prop('checked', !cb_value);
				}
			});

			parent.on('click', '#pbxs_manager_listpanel .pbx-wrapper', function() {
				$('#pbxs_manager_listpanel .pbx-wrapper', parent).removeClass('selected');
				serverId = $(this).data('id');
				monster.pub('pbxsManager.edit', { id: serverId });
				$(this).addClass('selected');
			});

			parent.find('#add_pbx').on('click', function() {
				monster.pub('pbxsManager.edit', {});
			});

			parent.find('.link-box.delete').on('click', function() {
				var dataPhoneNumber,
					phone_number,
					$selected_numbers = $('.unassigned-number.selected', parent),
					nb_numbers = $selected_numbers.size(),
					refresh_list = function() {
						nb_numbers--;
						if(nb_numbers === 0) {
							self.refreshUnassignedList();
						}
					};

				if(nb_numbers > 0) {
					monster.ui.confirm(self.i18n.active().delete_numbers_confirmation, function() {
							$selected_numbers.each(function() {
								dataPhoneNumber = $(this).data('phone_number');

								if(dataPhoneNumber) {
									self.deleteNumber(dataPhoneNumber,
										function() {
											refresh_list();
										},
										function() {
											refresh_list();
										}
									);
								}
							});
						},
						function() {
						}
					);
				}
				else {
					monster.ui.alert(self.i18n.active().no_number_selected);
				}
			});

			parent.find('#unassigned_numbers .search-query').on('keyup', function() {
				var input = $(this),
					rows = $('#unassigned_numbers .content .unassigned-number', parent),
					searchString = $.trim(input.val().toLowerCase().replace(/[^0-9]/g, '')),
					matches = [],
					cache = {};

				$.each(rows, function(k, v) {
					var data = $(this).data(),
						key = data.phone_number;

					cache[key] = $(this);
				});

				$('#empty_search', parent).hide();

				if (!searchString) {
					rows.show();
				}
				else {
					rows.hide();
					$.each(cache, function(phone_number, rowArray) {
						if (phone_number.indexOf(searchString)>-1) {
							matches.push(rowArray);
						}
					});

					if(matches.length > 0) {
						$.each(matches, function(k, v) {
							$(v).show();
						});
					}
					else {
						$('#empty_search', parent).show();
					}
				}
			});
		},

		renderList: function(_id, _parent, _callback, _data) {
			var self = this,
				callback = _callback,
				parent = _parent || $('#ws-content'),
				id = _id || 0,
				refreshList = function(data) {
					$('#list_pbxs_navbar', parent).show();
					$('#unassigned_numbers', parent).show();

					var mapCrossbarData = function(data) {
							var newList = [];

							if(data.length > 0) {
								var i = 0;
								$.each(data, function(key, val) {
									var countDids = 0;

									$.each(val.DIDs, function(number,obj){
										countDids ++
									});

									newList.push({
										id: i,
										name: val.server_name || '(no name)',
										count: countDids
									});
									i++;
								});
							}

							return newList;
						},
						dataTemplate = {
							numbers: mapCrossbarData(data)
						};

					$('#list_pbxs_navbar #pbxs_manager_listpanel', parent).empty()
																		  .append(monster.template(self, 'pbxsListElement', dataTemplate))
																		  .show();

					$('#list_pbxs_navbar #pbxs_manager_listpanel .pbx-wrapper[data-id='+id+']', parent).addClass('selected');

					$.each(data, function(k, v) {
						var imgLink = v.server_type ? v.server_type.replace('.','').toLowerCase() : 'other';

						$.inArray(imgLink, self.listAvailablePbxs()) < 0 ? imgLink = 'other' : true;

						$('#pbxs_manager_listpanel .pbx-wrapper[data-id="'+k+'"] .img-wrapper', parent).append('<img class="img_style" src="'+self.appPath+'/static/images/endpoints/'+ imgLink +'.png" height="49" width=72"/>');
					});

					callback && callback(data);
				};

			if(_data) {
				refreshList(_data);
			}
			 else {
				self.listServers(function(data, status) {
					refreshList(data);
				});
			}
		},

		listNumbersByPbx: function(id, _callback, _optional_data) {
			var self = this;

			if(id || id > -1) {
				monster.parallel({
					list_numbers: function(callback){
						self.listAllNumbers(function(_data_numbers) {
							callback(null, _data_numbers.data.numbers);
						});
					},
					account: function(callback){
						if(_optional_data) {
							callback(null, _optional_data);
						}
						else {
							self.getAccount(function(_data) {
								callback(null, _data.data);
							});
						}
					}
				},
				function(err, results){
					var json_data = {};

					$.each(results.account.servers[id].DIDs, function(k, v) {
						if(k in results.list_numbers) {
							json_data[k] = results.list_numbers[k];
						}
					});

					_callback && _callback(json_data);
				});
			}
		},

		listAvailableNumbers: function(_callback) {
			var self = this;

			monster.parallel({
				listNumbers: function(callback){
					self.listAllNumbers(function(_dataNumbers) {
						callback(null, _dataNumbers.data);
					});
				}
			},
			function(err, results){
				var tabData = [];

				//Build available numbers list
				if('numbers' in results.listNumbers) {
					$.each(results.listNumbers.numbers, function(k, v) {
						if(!v.used_by) {
							tabData.push({
								phoneNumber: k,
								isoCountry: 'locality' in v ? (v.locality.country || '') : ''
							});
						}
					});
				}

				_callback && _callback(tabData);
			});
		}
	};

	return app;
});
