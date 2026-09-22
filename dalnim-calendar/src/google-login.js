let sdk;
export async function googleIdentity(firebaseConfig){
 if(!firebaseConfig?.apiKey)throw Error('클라우드 설정이 필요합니다.');
 sdk ||= Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
 const [appModule,authModule]=await sdk;
 const app=appModule.getApps().find(a=>a.name==='dalnim-login')||appModule.initializeApp(firebaseConfig,'dalnim-login');
 const auth=authModule.getAuth(app);await authModule.setPersistence(auth,authModule.inMemoryPersistence);
 const provider=new authModule.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 const {user}=await authModule.signInWithPopup(auth,provider);
 const result={idToken:await user.getIdToken(),refreshToken:user.refreshToken,expiresIn:3600};
 await authModule.signOut(auth);return result;
}
