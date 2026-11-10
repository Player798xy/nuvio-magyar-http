const { ALL_CHANNELS } = require('../src/scrapers/onlinestream');

const cleanId = 'mediaklikk-live-m1';
const numId = cleanId.replace('onlinestream-live-', '').replace('mediaklikk-live-', '');

const ch = ALL_CHANNELS.find(c => c.mtvaKey && (c.mtvaKey === cleanId || c.mtvaKey === numId || cleanId.includes(c.mtvaKey)));
console.log('Found ch for mediaklikk-live-m1:', ch ? ch.name : null);
