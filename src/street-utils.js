/* global AFRAME, THREE */
/* 3DStreet utils functions */

function checkOrCreateEntity(elementId, outerHTML) {
	// clear old element data and replace with new HTML string
	let newElement = document.getElementById(elementId);
	if (!newElement) {
		newElement = document.createElement('a-entity');
		newElement.id = elementId;
		AFRAME.scenes[0].appendChild(newElement);
	}
	if (outerHTML.length > 0) {
		// replace element HTML data
		newElement.outerHTML = outerHTML;
	}
	return newElement;
}

/* 
clear old scene elements and data. Create blank scene 
*/
function newScene(clearMetaData=true, clearUrlHash=true, addDefaultStreet=true) {

    const environmentHTML = 
    `<a-entity id="environment" data-layer-name="Environment" street-environment="preset: day;"></a-entity>`;

    const referenceLayersHTML = 
    `<a-entity id="reference-layers" data-layer-name="Reference Layers" data-layer-show-children></a-entity>`;

	const streetContainerEl = document.querySelector("#street-container");
	const environmentEl = document.querySelector("#environment");
	const referenceLayersEl = document.querySelector("#reference-layers");

	// clear street-container element
	const streetContainerArray = Array.from(streetContainerEl.children);
	for (childEl of streetContainerArray) {
		if (!addDefaultStreet || childEl.id !== 'default-street') {
			streetContainerEl.removeChild(childEl);
		} else {
			// clear default-street element
			const defaultStreet = childEl;
			const defaultStreetArray = Array.from(defaultStreet.children);
			for (defaultStreetChild of defaultStreetArray) {
				defaultStreet.removeChild(defaultStreetChild);
			}
			// clear data from previous scene
			defaultStreet.removeAttribute('data-layer-name');
			defaultStreet.removeAttribute('street');
			defaultStreet.removeAttribute('streetmix-loader');
		}
	}

	if (!streetContainerEl.querySelector("#default-street") && addDefaultStreet) {
		// create default-street element
		const defaultStreet = document.createElement("a-entity");
		defaultStreet.id = "default-street";
		streetContainerEl.appendChild(defaultStreet);
		defaultStreet.setAttribute('set-loader-from-hash');
	}

	checkOrCreateEntity("environment", environmentHTML);
	checkOrCreateEntity("reference-layers", referenceLayersHTML);

	if (AFRAME.INSPECTOR && AFRAME.INSPECTOR.opened) {
		// update sceneGraph
		
	}

	// clear metadata
	if (clearMetaData) {
		AFRAME.scenes[0].setAttribute('metadata', 'sceneId', '');
		AFRAME.scenes[0].setAttribute('metadata', 'sceneTitle', '');
	}

	// clear url hash
	if (clearUrlHash) {
		setTimeout(function () {
			window.location.hash = '';
		});		
	}	
}

STREET.utils.newScene = newScene;

function getVehicleEntities() {
	return getEntitiesByCategories(['vehicles', 'vehicles-rigged', 'vehicles-transit', 'cyclists']);
}

module.exports.getVehicleEntities = getVehicleEntities;

function getStripingEntities() {
	return getEntitiesByCategories(['lane-separator']);
}

module.exports.getStripingEntities = getStripingEntities;

function getEntitiesByCategories(categoriesArray) {
	// get entity Nodes by array of their mixin categories
	const queryForCategoriesMixins = categoriesArray.map(categoryName => `a-mixin[category="${categoryName}"]`).join(',');
	const allCategoriesMixins = document.querySelectorAll(queryForCategoriesMixins);
	const categoriesMixinIds = Array.from(allCategoriesMixins).map(el => el.id);
	const queryForAllElements = categoriesMixinIds.map(mixinId => `a-entity[mixin~="${mixinId}"]`).join(',');
	return document.querySelectorAll(queryForAllElements);
}
