"use strict";

var Q           					= require('q');
var fs								= require('fs-extra');

var Constants   					= require('./SingleConstants.js');
var LrClassNameConfig	    		= require('./SingleLrClassNameConfig.js');
var globalStructures				= require('./SingleStructures.js');
var globalTemplates					= require('./SingleTemplates.js');

var utilities						= require('./utilities.js');

var createUploadObject = function (file) {

	var deferred = Q.defer();

    var currentDDMs = [];
    var thisDDM = [];
    var oldDDMObject = {};
	var newScript = '';
	var fileClassObj = LrClassNameConfig.getSingleClassNameObjFromFilePath(file);
	var fileName = utilities.filenameAndPathToFilename(file);
	var isNewDDM = false;
	var returnObj = {
		fileLanguageType: utilities.filenameToLanguageType(file),
		exceptionFile: file,
		group: {}
	};


    // If file actually is a DDM
    if (fileClassObj === 'undefined') {
		returnObj.exception = 'File is not a DDM';
		deferred.reject(returnObj);
		return deferred.promise;
	}

	returnObj.fileClassObj = fileClassObj;
	returnObj.fileName = fileName;

	try {
		newScript = fs.readFileSync(file, {encoding: Constants.fetch('filesEncoding')});
	} catch(catchErr) {
		returnObj.exception = 'Could not read file';
		deferred.reject(returnObj);
		return deferred.promise;
	}

	// DO MAGIC TO FIGURE OUT IF IT'S A NEW DDM OR AN OLD ONE WE WANT TO UPDATE

	// Get list of templates or structures depending on what data we're dealing with.
	if(fileClassObj.type === 'template') {
		currentDDMs =  globalTemplates.fetch();
	} else if (fileClassObj.type === 'journalStructure') {
		currentDDMs = globalStructures.fetch();
	} else {
		returnObj.exception = 'Not a template nor a structure';
		deferred.reject(returnObj);
		return deferred.promise;
	}

	// Filter the array to only contain the structures/templates
	// of the same type (classNameId) as the file we're uploading
	currentDDMs = currentDDMs.filter(function(entry) {
		return entry.classNameId === fileClassObj.id;
	});

	// Search the array by DDM name.
	// If we find a match, we're *updating* that DDM. If we don't
	// Find a match, we're *creating a new* DDM.
	if (currentDDMs.length > 0) {
		thisDDM = currentDDMs.filter(function(entry) {
			return entry.nameCurrentValue === fileName;
		});
		if(thisDDM.length === 1) {
			isNewDDM = false;
			oldDDMObject = thisDDM[0];
		} else if (thisDDM.length > 1) {
			returnObj.exception = 'There are more than one structures/templates with the same name.\nName: ' + fileName + '\nDDM: ' + fileClassObj.friendlyName;
			deferred.reject(returnObj);
			return deferred.promise;
		} else {
			returnObj.status = 'create';
			isNewDDM = true;
		}
	} else {
		isNewDDM = true;
	}

	if (isNewDDM) {
		if (returnObj.fileClassObj.clazz === 'com.liferay.portlet.dynamicdatamapping.model.DDMStructure') {
			// New Journal Template
			var createUploadObjectNewJournalTemplate = require('./upload--co-new-journal-template.js');
			createUploadObjectNewJournalTemplate(newScript, returnObj).then(function (resp) {
				deferred.resolve(resp);
			}, function (er) {
				deferred.reject(er);
			});
		} else if(fileClassObj.type === 'template') {
			// New ADT Template
			var createUploadObjectNewGenericTemplate = require('./upload--co-new-adt-template.js');
			createUploadObjectNewGenericTemplate(newScript, returnObj).then(function (resp) {
				deferred.resolve(resp);
			}, function (er) {
				deferred.reject(er);
			});
		} else if(fileClassObj.type === 'journalStructure') {
			console.dir('New Journal Structure');
			//TODO New Journal Structure
		}
		// TODO New other structure
	} else {
		if(fileClassObj.type === 'journalStructure') {
			// Update journal structure
			// Todo: Make this work with all structures.
			var createUploadObjectUpdateStructure = require('./upload--co-update-structure.js');
			createUploadObjectUpdateStructure(newScript, oldDDMObject, returnObj).then(function (resp) {
				deferred.resolve(resp);
			}, function (er) {
				deferred.reject(er);
			});
		} else if(fileClassObj.type === 'template') {
			// Update Journal and ADT Template
			var createUploadObjectUpdateTemplate = require('./upload--co-update-template.js');
			createUploadObjectUpdateTemplate(newScript, oldDDMObject, returnObj).then(function (resp) {
				deferred.resolve(resp);
			}, function (er) {
				deferred.reject(er);
			});
		}
		// TODO Update other structure

	}

    return deferred.promise;

};

module.exports = createUploadObject;