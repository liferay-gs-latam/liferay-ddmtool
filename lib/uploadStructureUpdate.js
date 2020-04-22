"use strict";

var createUploadObject = function (newObj) {

	var PortletKeys                     = require("./PortletKeys.js");

	var Q           					= require('q');

	var LrClassNameConfig				= require('./ClassNameConfig.js');
	var Sites							= require('./Sites.js');
	var utilities						= require('./utilities.js');

	var deferred = Q.defer();
	var payload = {};

	var returnObj = {
		exceptionFile: newObj.file,
		group: {}
	};

	// Check if the file already is up to date
	if(newObj.oldObj.definition === newObj.newScript) {
		returnObj.status = 'uptodate';
	} else {
		returnObj.status = 'update';
	}

	// Set some values in our return object to be able to do a nice print to the user.
	returnObj.className = LrClassNameConfig.getSingleValue('id', newObj.classNameId, 'friendlyName');
	returnObj.fileFriendlyName = newObj.fileFriendlyName;
	returnObj.isStructure = true;

	// Set some values in our return object to be able to do a nice print to the user.
	returnObj.group.description = Sites.getSingleValue('groupId', newObj.oldObj.groupId, 'description');
	returnObj.group.name = Sites.getSingleValue('groupId', newObj.oldObj.groupId, 'descriptiveName');
	returnObj.group.type = LrClassNameConfig.getSingleValue('id', Sites.getSingleValue('groupId', newObj.oldObj.groupId, 'classNameId'), 'friendlyName');
	returnObj.group.friendlyURL = Sites.getSingleValue('groupId', newObj.oldObj.groupId, 'friendlyURL');
	returnObj.group.groupId = newObj.oldObj.groupId;
	
	// Populate payload with data from old structure (things we aren't updating)
	payload = {
		structureId: newObj.oldObj.structureId,
		parentStructureId: newObj.oldObj.parentStructureId,
		'+ddmForm': 'com.liferay.dynamic.data.mapping.model.DDMForm',
		'ddmFom.ddmFormFields': newObj.newScript,
		'+ddmFormLayout': 'com.liferay.dynamic.data.mapping.model.DDMFormLayout',
		'ddmFormLayout.paginationMode': 'single-page',
		'+serviceContext': 'com.liferay.portal.kernel.service.ServiceContext',
		'serviceContext.addGroupPermissions': true,
		'serviceContext.addGuestPermissions': true,
		'serviceContext.attributes': { refererPortletName: PortletKeys.fetch('JOURNAL') }
	};

	// Populate payload with data from old template (things we aren't updating)
	// but we need to make it into a Map which Liferay wants.
	utilities.xmlMapToObj(newObj.oldObj.name, 'Name')
		.then(function (resName) {
			payload.nameMap = resName;
		})
		.then(utilities.xmlMapToObj(newObj.oldObj.description, 'Description')
			.then(function (resDesc) {
				payload.descriptionMap = resDesc;
			}))
		.then(
		function () {
			returnObj.payload = '{"/ddm.ddmstructure/update-structure": ' + JSON.stringify(payload) + '}';
			deferred.resolve(returnObj);
		}
	);

	return deferred.promise;

};

module.exports = createUploadObject;