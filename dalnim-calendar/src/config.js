// Personal investment and records. Keep the existing cloud namespace to preserve data.
export const config = {
  version: '0.14.1',
  updatedAt: '2026-09-28 13:02 KST',
  firebase: {"apiKey":"AIzaSyAyG1chECYsbO7cSZUuXmNa0_KDYBmahPY","projectId":"my-system-25497","authDomain":"my-system-25497.firebaseapp.com","appId":"1:800117843160:web:610b23896bc335f285e3ad"}, // { apiKey, projectId, authDomain, appId, messagingSenderId }
  apiBase: 'https://calendarapi-ng2m4osziq-du.a.run.app', // e.g. https://REGION-PROJECT.cloudfunctions.net/calendarApi
  vapidPublicKey: 'BJgs_pUgV-HNfQXpzUON4ldkGWhwjCwGvivhp_llZ59obhYySvGvyBB93px_b5TZzyB2Tt5GnLAsjhPkJ53Rg3E',
  workspaceId: 'family', // Existing database namespace; not a sharing feature.
  systemHomeUrl: 'https://20251014peru-gif.github.io/index.html',
  investmentArchiveUrl: 'https://20251014peru-gif.github.io/invest/records.html',
  youtubeUrl: 'https://20251014peru-gif.github.io/youtube3.html',
  predictionUrl: 'https://20251014peru-gif.github.io/invest/predict.html',
  modules: ['./modules/personal.js', './modules/investment.js'],
};
