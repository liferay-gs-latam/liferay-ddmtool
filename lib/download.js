"use strict";

var Q								= require('q');
var _								= require('underscore');

var utilities	                    = require('./utilities.js');
var Constants                       = require('./Constants.js');
var lrException                     = require('./errorException.js');
var cache	                    	= require('./cache.js');
var getData							= require('./getData.js');
var LrClassNameConfig	    		= require('./ClassNameConfig.js');
var Sites							= require('./Sites.js');
var Structures						= require('./Structures.js');
var Templates						= require('./Templates.js');
var Config							= require('./Config.js');

var CompanyId						= 0;

var download = {
	downloadAllFromServer: function () {
		
		utilities.writeToScreen('Getting data from server', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		Q.resolve()
			.then(cache.clearCache)
			.then(download.getClassNameIds)
			.then(download.getUserSites)
			.then(download.getCompanyGroup)
			.then(download.getUserId)
			.then(download.getStructures)
			.then(download.getTemplates)
			.then(function () {

			})
			.done(function () {
				var router = require('./router.js');
				router(Constants.fetch('STEP_JUST_READ_ALL_FROM_SERVER'));
			}, function (e) {
				lrException(e);
			});
	},



	getUserId: function() {
		utilities.writeToScreen('Downloading user info', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
		return getData('{"/user/get-user-id-by-email-address": {"companyId": ' + CompanyId + ', "emailAddress": "' + Config.fetch('email') + '"}}').then(
			function (e) {
				if(e.length === 0) {
					throw Error('Could not find UserID');
				} else {
					Config.set('email', e);
				}
			});
	},


	getClassNameIds: function () {
		utilities.writeToScreen('Downloading id\'s', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		var payload = [];
		for (var i = 0; i < LrClassNameConfig.fetch().length; i++) {
			// console.log('classNameId: ' + LrClassNameConfig.fetch(i, 'clazz'));
			payload.push('{"/classname/fetch-class-name": {"value": "' + LrClassNameConfig.fetch(i, 'clazz') + '"}}');
		}

		return getData('[' + payload.join() + ']').then(
			function (e) {
				for (var i = 0; i < LrClassNameConfig.fetch().length; i++) {
					LrClassNameConfig.addToEntry(i, 'mvccVersion', e[i].mvccVersion);
					LrClassNameConfig.addToEntry(i, 'id', e[i].classNameId);
				}
				cache.saveToCache(LrClassNameConfig.fetch(), Constants.fetch('cacheClassNameConfig'));
			});
	},


	getUserSites: function() {
		utilities.writeToScreen('Downloading list of sites', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
		return getData('{"/group/get-user-sites-groups": {}}').then(
			function (e) {
				if(e.length === 0) {
					throw Error('Could not find any sites');
				} else {
					e.forEach(function(entry) {
						Sites.add(entry);
					});
					CompanyId = e[0].companyId;
				}
			});
	},


	getCompanyGroup: function () {
	utilities.writeToScreen('Downloading company site', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
	return getData('{"/group/get-company-group": {"companyId": ' + CompanyId + '}}').then(
		function (e) {
			// Dirty way of adding the global site to the list of sites.
			// Sites.setAll(JSON.parse('[' + JSON.stringify(Sites.fetch()).substr(1).slice(0, -1) + ',' + JSON.stringify(e) + ']'));
			cache.saveToCache(Sites.fetch(), Constants.fetch('cacheSitesFilename'));
		});
	},


	getStructures: function () {
		utilities.writeToScreen('Downloading structures', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		var sitesList = [];
		var payload = [];
		
		for (var i = 0; i < Sites.fetch().length; ++i) {
			sitesList.push(Sites.fetch(i, 'groupId'));
		}

		for (var i = 0; i < LrClassNameConfig.fetch().length; ++i) {
			payload.push('{"/ddm.ddmstructure/get-structures": {"companyId": ' + CompanyId + 
				', "groupIds": [' + sitesList.join() + '], "classNameId": ' + LrClassNameConfig.fetch(i, 'id') + 
				', "status": 0}}');
		}

		return getData('[' + payload.join() + ']').then(
			function (e) {

				// Make sure we have all the structures in our LrClassNameConfig
				// If not, warn the user about it!
				for (var i = 0; i < e.length; ++i) {
					var results = e[i];

					results.forEach(function(entry) {
						// console.log("Checking " + entry.classNameId);

						if (!LrClassNameConfig.checkExist('id', entry.classNameId)) {
							var newLrClassNameObj = {
								filesPath: 'unknown/' + entry.classNameId,
								friendlyName: 'Unknown with classNameId: ' + entry.classNameId,
								clazz: 'Unknown with classNameId: ' + entry.classNameId,
								type: 'structure',
								containsDDMs: true,
								id: entry.classNameId,
								isUnknown: true,
								getTemplate: false
							};
							utilities.writeToScreen(
									'\nFound a (custom?) structure I don\'t know about\n' +
									'It\'ll be saved in \'' + newLrClassNameObj.filesPath + '\' but I won\'t be able to manage it.\n\n' +
									'To be able to handle unknown structures:\n' +
									'1) Search you database: \'select value from classname_ where classNameId = ' + entry.classNameId + '\' to get className\n' +
									'2) Create an entry in \'' + Config.fetch('settingsFolder') + '/' + Constants.fetch('customClassNameConfig') + '\' (please read README)\n',
									Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_ERROR'));
							LrClassNameConfig.add(newLrClassNameObj);
						}
					});

					// Remove every entry (therer is only 1) with className 'PortletDocumentlibraryUtilRawMetadataProcessor'.
					// This is a Liferay internal structure which is used to parse
					// document metadata and display it in the Document and Media Portlet.
					var idRawMetaDataProcessor = LrClassNameConfig.getSingleValue('clazz', 'com.liferay.document.library.kernel.util.RawMetadataProcessor', 'id');
					results = results.filter(function(entry) {
						return entry.classNameId != idRawMetaDataProcessor;
					});

					// Check if there's a DDM we should ignore
					results = results.filter(function(entry) {
						if(_.contains(Config.fetch('ignoreDDMs'), entry.structureKey)) {
							return false;
						} else {
							return true;
						}
					});

					results.forEach(function(entry) {
						Structures.add(entry);
					});
				}

				cache.saveToCache(Structures.fetch(), Constants.fetch('cacheStructuresFilename'));
				// console.log(Structures.fetch());
			});
	},


	getTemplates: function () {

		utilities.writeToScreen('Downloading templates', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
		var payload = [];

		var pdtClassNameId = LrClassNameConfig.getSingleValue('clazz', 'com.liferay.portlet.display.template.PortletDisplayTemplate', 'id');
		// console.log("PortletDisplayTemplate classNameId: " + pdtClassNameId);

		var journalClassNameId = LrClassNameConfig.getSingleValue('clazz', 'com.liferay.journal.model.JournalArticle', 'id');

		for (var i = 0; i < Sites.fetch().length; ++i) {
			for (var ii = 0; ii < LrClassNameConfig.fetch().length; ii++) {
				if (LrClassNameConfig.fetch(ii, 'getTemplate')) {

					// console.log('Checking {"/ddm.ddmtemplate/get-templates": {"companyId": ' + CompanyId + 
					// 	', "groupId": ' + Sites.fetch(i, 'groupId') + 
					// 	', "classNameId": ' + LrClassNameConfig.fetch(ii, 'id') +
					// 	', "resourceClassNameId": ' + pdtClassNameId + 
					// 	', "status": 0}}');
					
					payload.push('{"/ddm.ddmtemplate/get-templates": {"companyId": ' + CompanyId + 
						', "groupId": ' + Sites.fetch(i, 'groupId') + 
						', "classNameId": ' + LrClassNameConfig.fetch(ii, 'id') +
						', "resourceClassNameId": ' + pdtClassNameId + 
						', "status": 0}}');

					Structures.fetch().forEach(function(entry) {
						
						// console.log('Checking {"/ddm.ddmtemplate/get-templates": {"companyId": ' + CompanyId + 
						// 	', "groupId": ' + Sites.fetch(i, 'groupId') + 
						// 	', "classNameId": ' + LrClassNameConfig.fetch(ii, 'id') +
						// 	', "classPK": ' + entry.structureId +
						// 	', "resourceClassNameId": ' + journalClassNameId + 
						// 	', "status": 0}}');
					
						payload.push('{"/ddm.ddmtemplate/get-templates": {"companyId": ' + CompanyId + 
							', "groupId": ' + Sites.fetch(i, 'groupId') + 
							', "classNameId": ' + LrClassNameConfig.fetch(ii, 'id') +
							', "classPK": ' + entry.structureId +
							', "resourceClassNameId": ' + journalClassNameId + 
							', "status": 0}}');
						
					});
				}
			}
		}

		return getData('[' + payload.join() + ']').then(
			function (e) {
				for (var y = 0; y < e.length; ++y) {
					for (i = 0; i < e[y].length; ++i) {
						// Check if there's a DDM we should ignore
						if(!_.contains(Config.fetch('ignoreDDMs'), e[y][i].templateKey)) {
							Templates.add(e[y][i]);
						}
					}
				}
				cache.saveToCache(Templates.fetch(), Constants.fetch('cacheTemplatesFilename'));
				// console.log(Templates.fetch());
			});
	}

};

module.exports = download;