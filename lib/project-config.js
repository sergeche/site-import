var extend = require('xtend');

module.exports = class ProjectConfig {
	constructor(data) {
		// default ignore pattern
		this.ignore = ['{node_modules,bower_components}/**'];
	}

	extend(data) {
		if (typeof data === 'object') {
			Object.keys(data).forEach(function(key) {
				this[key] = data[key];
			}, this);
		}
		return this;
	}

	copy(override) {
		return new ProjectConfig(this).extend(data);
	}
};