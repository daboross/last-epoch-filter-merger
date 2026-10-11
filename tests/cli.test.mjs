import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const xml=name=>`<ItemFilter><name>${name}</name><lootFilterVersion>9</lootFilterVersion><rules><Rule><type>SHOW</type><conditions/><isEnabled>true</isEnabled><color>15</color><Order>0</Order></Rule></rules></ItemFilter>`;
test('CLI discovers game directory, merges, installs new file, writes report and refuses overwrite',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'le-cli-test-'));fs.writeFileSync(path.join(dir,'A.xml'),xml('A'));fs.writeFileSync(path.join(dir,'B.xml'),xml('B'));
  const run=args=>spawnSync(process.execPath,[path.join(root,'cli.mjs'),...args],{cwd:root,encoding:'utf8'});
  const list=run(['list','--dir',dir]);assert.equal(list.status,0);assert.equal(JSON.parse(list.stdout).filters.length,2);
  const out=path.join(dir,'output','merged.xml');const args=['merge','A.xml','B.xml','--dir',dir,'--name','New filter','--out',out,'--install'];
  const result=run(args);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(out+'.report.json','utf8')).count,2);assert.equal(fs.readFileSync(path.join(dir,'New filter.xml'),'utf8'),fs.readFileSync(out,'utf8'));
  const before=fs.readFileSync(out,'utf8');const again=run(args);assert.equal(again.status,1);assert.match(again.stderr,/Refusing to overwrite/);assert.equal(fs.readFileSync(out,'utf8'),before);assert.equal(fs.readFileSync(path.join(dir,'A.xml'),'utf8'),xml('A'));
});
