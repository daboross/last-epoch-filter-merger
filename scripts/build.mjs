import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const target of ['firefox','chromium']) {
  const out=path.join(root,'dist',target);fs.mkdirSync(out,{recursive:true});
  for(const file of fs.readdirSync(path.join(root,'extension')))fs.copyFileSync(path.join(root,'extension',file),path.join(out,file));
  if(target==='chromium') {
    const file=path.join(out,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
    m.manifest_version=3;m.action=m.browser_action;delete m.browser_action;
    m.background={service_worker:'background.js'};m.host_permissions=m.permissions.filter(p=>p.startsWith('https:'));m.permissions=m.permissions.filter(p=>!p.startsWith('https:'));delete m.browser_specific_settings;
    fs.writeFileSync(file,JSON.stringify(m,null,2));
  }
}
console.log('Built dist/firefox (Manifest V2) and dist/chromium (Manifest V3).');
