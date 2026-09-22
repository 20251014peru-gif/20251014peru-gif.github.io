import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createECDH} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import webpush from 'web-push';
// Run only inside an authenticated operator terminal. Secrets never go to stdout.
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1];
const project=args.includes('--project')?arg('--project'):null,owner=args.includes('--owner-uid')?arg('--owner-uid'):null,apply=args.includes('--apply');
if(!/^[a-z][a-z0-9-]{4,50}$/.test(project||'')||!owner)throw Error('--project and --owner-uid are required.');
const run=(cmd,argv,input)=>{const r=spawnSync(cmd,argv,{encoding:'utf8',input,shell:false});if(r.status!==0)throw Error(`${cmd} failed: ${String(r.stderr).slice(0,600)}`);return r.stdout.trim();};
const token=()=>run('gcloud',['auth','print-access-token']);
async function google(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(`${method} ${new URL(url).pathname}: ${d.error?.message||r.status}`);return d;}
await mkdir('.cloud-setup',{recursive:true});
const rulesBase=`https://firebaserules.googleapis.com/v1/projects/${project}`;
const release=await google(rulesBase+'/releases/cloud.firestore');
const ruleSet=await google('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
if(ruleSet.source.files.length!==1)throw Error('Multiple rule files: manual review required.');
const current=ruleSet.source.files[0].content;
await writeFile('.cloud-setup/firestore.before.rules',current,{mode:0o600});
const anchor="&& root != 'records';";
let proposed=current;
if(!current.includes("root != 'dalnimSpaces'")||!current.includes("root != 'dalnimReminderJobs'")){
 if(current.split(anchor).length!==2||!current.includes('match /{root}/{rest=**}'))throw Error('Current rules differ from reviewed rules. Review before applying.');
 proposed=current.replace(anchor,"&& root != 'records'\n        && root != 'dalnimSpaces' && root != 'dalnimReminderJobs';");
}
await writeFile('.cloud-setup/firestore.after.rules',proposed,{mode:0o600});
const app=initializeApp({projectId:project,credential:{getAccessToken:async()=>({access_token:token(),expires_in:3000})}});
const ownerUser=await getAuth(app).getUser(owner);
if(ownerUser.disabled||!ownerUser.emailVerified)throw Error('Owner must be an enabled verified account.');
const root=getFirestore(app).collection('dalnimSpaces').doc('family'),existing=await root.get();
if(existing.exists&&existing.data().members?.[owner]!=='owner')throw Error('Existing workspace has a different owner. No changes made.');
const apps=await google(`https://firebase.googleapis.com/v1beta1/projects/${project}/webApps`);
if(apps.apps?.length!==1)throw Error('Select the correct web app before continuing.');
const firebase=await google(`https://firebase.googleapis.com/v1beta1/${apps.apps[0].name}/config`);
if(firebase.projectId!==project)throw Error('Project mismatch.');
console.log('Preflight passed: verified owner, one web app, reviewed Firestore catch-all.');
console.log('Changes: protect only dalnimSpaces + dalnimReminderJobs; create family space if absent; prepare VAPID secret and public config. Existing worklog data is not read or modified.');
if(!apply){console.log('Dry run complete. Inspect .cloud-setup/firestore.after.rules, then rerun with --apply.');process.exit(0);}
// Fail closed on concurrent rules changes before replacing the release.
const latest=await google(rulesBase+'/releases/cloud.firestore');if(latest.rulesetName!==release.rulesetName)throw Error('Rules changed during preparation. Run preflight again.');
if(proposed!==current){const created=await google(rulesBase+'/rulesets','POST',{source:{files:[{name:ruleSet.source.files[0].name,content:proposed}]}});await google(rulesBase+'/releases/cloud.firestore','PATCH',{release:{name:release.name,rulesetName:created.name},updateMask:'rulesetName'});console.log('Dedicated calendar namespaces protected.');}
if(!existing.exists)await root.create({members:{[owner]:'owner'},createdAt:Date.now(),schemaVersion:1});
// gcloud only transports the secret in stdin; it is never written to the repo or logged.
run('gcloud',['services','enable','secretmanager.googleapis.com','--project',project,'--quiet']);
const secretName='DALNIM_VAPID_PRIVATE_KEY',list=JSON.parse(run('gcloud',['secrets','list','--project',project,'--format=json']));
let privateKey,publicKey;
if(list.some(s=>s.name.endsWith('/secrets/'+secretName))){
 privateKey=run('gcloud',['secrets','versions','access','latest','--secret',secretName,'--project',project]);
 const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(Buffer.from(privateKey,'base64url'));publicKey=ecdh.getPublicKey().toString('base64url');
}else{
 ({privateKey,publicKey}=webpush.generateVAPIDKeys());
 run('gcloud',['secrets','create',secretName,'--project',project,'--replication-policy=automatic','--data-file=-'],privateKey);
}
privateKey=null;
await writeFile(`.env.${project}`,`DALNIM_ALLOWED_ORIGINS=https://20251014peru-gif.github.io\nDALNIM_VAPID_PUBLIC_KEY=${publicKey}\nDALNIM_PUSH_SUBJECT=mailto:${ownerUser.email}\n`,{mode:0o600});
const configPath='src/config.js',configText=await readFile(configPath,'utf8');
const publicConfig={apiKey:firebase.apiKey,projectId:firebase.projectId,authDomain:firebase.authDomain,appId:firebase.appId};
const output=configText.replace(/firebase:\s*null/,`firebase: ${JSON.stringify(publicConfig)}`).replace("apiBase: ''",`apiBase: 'https://asia-northeast3-${project}.cloudfunctions.net/calendarApi'`).replace("vapidPublicKey: ''",`vapidPublicKey: '${publicKey}'`);
await writeFile('.cloud-setup/config.production.js',output);
console.log('Server configuration ready. Deploy only functions:dalnim-calendar. Publish .cloud-setup/config.production.js as src/config.js after API checks pass.');
