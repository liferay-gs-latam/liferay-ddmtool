"use strict";

var Templates = [];

function fetch(entry, prop) {
	if (typeof entry === 'undefined') {
		return Templates;
	} else {
		if (typeof prop === 'undefined') {
			return Templates[entry];
		} else {
			return Templates[entry][prop];
		}
	}
}

function getAllFilter(lookForProperty, lookForValue) {
	return Templates.filter(function(entry) {
		return entry[lookForProperty] == lookForValue;
	});
}

function setAll(entries) {
	Templates = entries;
}

function add(entry) {
	var ret;

	// ignore duplicates
	ret = Templates.filter(function(element) {
		return element['uuid'] == entry.uuid;
	});

	if (ret.length === 1) {
		// console.log("Ignoring " + entry.nameCurrentValue + " (" + entry.uuid + ") because is duplicated");
	} else {
		// console.log("entry.uuid ====== " + entry.uuid);
		Templates.push(entry);
	}
}

function addToEntry(entry, prop, val) {
	Templates[entry][prop] = val;
}

function updateAll(entries) {
	var tempObj = [];
	for (var i = 0; i < entries.length; i++) {
		if (entries[i].hasOwnProperty('templateKey')) {
			/*jshint -W083 */
			tempObj = Templates.filter(function(entry) {
				return entry.templateKey != entries[i].templateKey;
			});
			/*jshint +W083 */
			tempObj.push(entries[i]);
			Templates = tempObj;
		}
	}
}

module.exports.fetch = fetch;
module.exports.getAllFilter = getAllFilter;
module.exports.add = add;
module.exports.setAll = setAll;
module.exports.addToEntry = addToEntry;
module.exports.updateAll = updateAll;

