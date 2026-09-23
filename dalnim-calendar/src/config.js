// Live mode is opt-in. Never write into an existing worklog collection implicitly.
export const config = {
  version: '0.7.1',
  firebase: {"apiKey":"AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY","projectId":"my-system-25497","authDomain":"my-system-25497.firebaseapp.com","appId":"1:800117843160:web:610b23896bc335f285e3ad"}, // { apiKey, projectId, authDomain, appId, messagingSenderId }
  apiBase: 'https://calendarapi-ng2m4osziq-du.a.run.app', // e.g. https://REGION-PROJECT.cloudfunctions.net/calendarApi
  vapidPublicKey: 'BJgs_pUgV-HNfQXpzUON4ldkGWhwjCwGvivhp_llZ59obhYySvGvyBB93px_b5TZzyB2Tt5GnLAsjhPkJ53Rg3E',
  modules: ['./modules/personal.js', './modules/worklog.js', './modules/investment.js', './modules/family.js'],
};
