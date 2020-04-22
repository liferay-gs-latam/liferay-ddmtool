"use strict";

// TODO, make sure new Structures are uploaded first and that the list of structures is populated
// with the new structures (if there are any), so that we may bind new templates to those structures.

var Q           					= require('q');

var Constants                       = require('./Constants.js');
var utilities	                    = require('./utilities.js');

var uploadObjects = [];
var uploadOptions = {};

function createUploadObject(file) {

	var deferred = Q.defer();

	var returnObj = {
		fileLanguageType: utilities.filenameToLanguageType(file),
		exceptionFile: file,
		group: {}
	};

	// Figure out what kind of file it is based on it's path.
	var filePathSplit = file.split('/');
	if(filePathSplit[filePathSplit.length - 2] === 'templates') { // Is template
		var coTemplate = require('./uploadTemplate.js');
		coTemplate(file).then(function (resp) {
			deferred.resolve(resp);
		},function (resp) {
			deferred.reject(resp);
		});
	} else if(filePathSplit[filePathSplit.length - 2] === 'structures') {
		var coStructure = require('./uploadStructure.js');
		coStructure(file).then(function (resp) {
			deferred.resolve(resp);
		},function (resp) {
			deferred.reject(resp);
		});
	} else {
		returnObj.exception = 'File is not a structure nor a template';
		deferred.reject(returnObj);
		return deferred.promise;
	}

	return deferred.promise;
}


var preparePayloads = function (i, files, whenFinishedUploadingCallback) {
	createUploadObject(files[i]).then(function (e) {
		uploadObjects.push(e);
		if(i < files.length-1) {
			preparePayloads(++i, files);
		} else {
			doUploads(uploadObjects, whenFinishedUploadingCallback);
		}
	}, function(er) {
		utilities.writeToScreen('\nCould not upload file!\n', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_ERROR'));
		utilities.writeToScreen('Name:      ' + er.fileName, Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_ERROR'));
		utilities.writeToScreen('Error:     ' + er.exception, Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_ERROR'));
		utilities.writeToScreen('File Path: ' + er.exceptionFile, Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_ERROR'));
	});
};

var uploadFiles = function (files, options, whenFinishedUploadingCallback) {

	// Set default options and save to uploadOptions object.
	options = typeof options !== 'undefined' ? options : {};
	options.autoMode = typeof options.autoMode !== 'undefined' ? options.autoMode : false;
	uploadOptions = options;

	// Make single file into array
	if(typeof files === 'string') {
		files = [files];
	}

	// Clear uploadObjects
	uploadObjects = [];

	// Fire
	preparePayloads(0, files, whenFinishedUploadingCallback);
};

var doUploads = function (uploadObjects, whenFinishedUploadingCallback) {

	var Table 							= require('cli-table');
	var inquirer						= require("inquirer");

	var Structures						= require('./Structures.js');
	var Templates						= require('./Templates.js');
	var Config							= require('./Config.js');

	var cache	                    	= require('./cache.js');
	var lrException                     = require('./errorException.js');
	var getData	             			= require('./getData.js');
	var router	             			= require('./router.js');

	var fullPayload = [];
	var filteredUploadObjects = [];

	var friendlyTypeOutput = '';

	var states = [
		{
			status: 'uptodate',
			heading: 'Already up to date, will not update'
		},
		{
			status: 'update',
			heading: 'Update'
		},
		{
			status: 'create',
			heading: 'Create new'
		}
	];


	uploadObjects = uploadObjects.filter(function (entry) {
		if (entry.ignore === true) {
			utilities.writeToScreen('Ignoring file: ' + entry.exceptionFile, Constants.fetch('SEVERITY_IMPORTANT'), Constants.fetch('SCREEN_PRINT_ERROR'));
			utilities.writeToScreen(entry.ignoreMsg + '\n', Constants.fetch('SEVERITY_IMPORTANT'), Constants.fetch('SCREEN_PRINT_NORMAL'));
			return false;
		} else {
			return true;
		}
	});

	// Split the uploadObjects into 3, one with files that are already up to date,
	// one with files that needs updating and one with files that needs to be created,
	// to be able to present it to the user in a nice way (and avoid) updating things,
	// which does not need to be updated.
	utilities.writeToScreen('-', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_NORMAL'));
	for (var x = 0; x < states.length ; x++) {

		/*jshint -W083 */
		filteredUploadObjects = uploadObjects.filter(function(entry) {
			return entry.status == states[x].status;
		});
		/*jshint +W083 */

		states[x].table = new Table({
			head: ['Name', 'Type', 'GrpId', 'Group (Group Type)'],
			chars: {
				'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '',
				'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '',
				'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': '',
				'right': '' , 'right-mid': '' , 'middle': ' '
			},
			style: {
				'padding-left': 2,
				'padding-right': 0,
				'head': ['magenta']
			},
			colWidths: [35, 55, 7]
		});

		for (var i = 0; i < filteredUploadObjects.length; i++) {

			if (filteredUploadObjects[i].isADT) {
				friendlyTypeOutput = filteredUploadObjects[i].className;
			} else if (filteredUploadObjects[i].isTemplate) {
				friendlyTypeOutput = 'Template (Structure: ' + filteredUploadObjects[i].className + ')';
			} else if (filteredUploadObjects[i].isStructure) {
				friendlyTypeOutput = 'Structure (' + filteredUploadObjects[i].className + ')';
			}

			states[x].table.push([
				filteredUploadObjects[i].fileFriendlyName,
				friendlyTypeOutput,
				filteredUploadObjects[i].group.groupId,
				filteredUploadObjects[i].group.name + ' (' + filteredUploadObjects[i].group.type + ')'
			]);
		}

		if (states[x].table.length > 0) {
			utilities.writeToScreen(states[x].heading + ' (' + states[x].table.length + ')', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_HEADING'));
			utilities.writeToScreen('', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_HEADING'));
			utilities.writeToScreen(states[x].table.toString(), Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
			utilities.writeToScreen('', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_HEADING'));
		}


	}

	// Check to see that we actually have things which needs to be updated/created
	if (states[1].table.length > 0 || states[2].table.length > 0 ) {

		// Remove every file which is already to date.
		uploadObjects = uploadObjects.filter(function (entry) {
			return entry.status != 'uptodate';
		});

		// Create a batch of all payloads.
		uploadObjects.forEach(function(entry) {
			fullPayload.push(entry.payload);
		});

		if (uploadOptions.autoMode === true) {
			getData('[' + fullPayload.join() + ']').then(function (resp) {

				Templates.updateAll(resp);
				Structures.updateAll(resp);
				cache.saveToCache(Templates.fetch(), Constants.fetch('cacheTemplatesFilename'));
				cache.saveToCache(Structures.fetch(), Constants.fetch('cacheStructuresFilename'));

				resp.forEach(function(entry) {
					utilities.writeToScreen('Upload successful! (' + entry.nameCurrentValue + ')', Constants.fetch('SEVERITY_IMPORTANT'), Constants.fetch('SCREEN_PRINT_SAVE'));
				});

			}, function (e) {
				console.dir(e);
				lrException('Could not upload DDMs to server!\n');
			});
		} else {

			inquirer.prompt([
					{
						type: "list",
						name: "confirm",
						message: "Do you want to send this to the server?",
						choices: [
							{
								name: 'Send to server \'' + Config.fetch('hostFriendlyName').toUpperCase() + '\' (of project \'' + Config.fetch('projectName') + '\')',
								value: true
							},
							{
								name: 'Abort',
								value: false
							}
						]
					}
				], function (answers) {
					if (answers.confirm === true) {

						getData('[' + fullPayload.join() + ']').then(function (resp) {
							Templates.updateAll(resp);
							Structures.updateAll(resp);
							cache.saveToCache(Templates.fetch(), Constants.fetch('cacheTemplatesFilename'));
							cache.saveToCache(Structures.fetch(), Constants.fetch('cacheStructuresFilename'));
							utilities.writeToScreen('', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_SAVE'));
							utilities.writeToScreen('Files updated/created!', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_SAVE'));
							router(Constants.fetch('STEP_JUST_UPLOADED_DDMS'));
						}, function (e) {
							console.dir(e);
							lrException('Could not upload DDMs to server!\n');
						});

					} else {
						router(Constants.fetch('STEP_JUST_UPLOADED_DDMS'));
					}
				}
			);
		}




	} else {
		if (uploadOptions.autoMode !== true) {
			utilities.writeToScreen('Every file is already up to date\n', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_SAVE'));
			router(Constants.fetch('STEP_JUST_UPLOADED_DDMS'));
		}
	}

	if (typeof whenFinishedUploadingCallback === "function") {
		whenFinishedUploadingCallback.call();
	}
};

module.exports = uploadFiles;
