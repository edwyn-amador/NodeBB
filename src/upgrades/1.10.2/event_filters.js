'use strict';

const async = require('async');
const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'add filters to events',
	timestamp: Date.UTC(2018, 9, 4),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('events:time', (eids, next) => {
			async.eachSeries(eids, (eid, next) => {
				progress.incr();

				db.getObject(`event:${eid}`, (err, eventData) => {
					if (err) {
						return next(err);
					}
					if (!eventData) {
						return db.sortedSetRemove('events:time', eid, next);
					}
					// privilege events we're missing type field
					if (!eventData.type && eventData.privilege) {
						eventData.type = 'privilege-change';
						async.waterfall([
							function (next) {
								db.setObjectField(`event:${eid}`, 'type', 'privilege-change', next);
							},
							function (next) {
								db.sortedSetAdd(`events:time:${eventData.type}`, eventData.timestamp, eid, next);
							},
						], next);
						return;
					}

					db.sortedSetAdd(`events:time:${eventData.type || ''}`, eventData.timestamp, eid, next);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
