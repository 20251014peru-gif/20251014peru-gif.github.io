// Live mode is opt-in. Never write into an existing worklog collection implicitly.
export const config = {
  version: '0.2.0',
  firebase: null, // { apiKey, projectId, authDomain, appId, messagingSenderId }
  apiBase: '', // e.g. https://REGION-PROJECT.cloudfunctions.net/calendarApi
  vapidPublicKey: '',
  modules: ['./modules/worklog.js', './modules/investment.js', './modules/family.js'],
};
