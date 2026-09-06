import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(), target=path.join(root,'docs/licenses');await fs.mkdir(target,{recursive:true});
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));const inventory=[];const sections=['Schreibatelier — Third-party notices\nOwn application code is private and not offered under an open-source license.\nThird-party components retain the licenses reproduced below.\nPandoc and Typst are installed separately; they are not included in the app package.'];
async function exists(p){try{await fs.access(p);return true}catch{return false}}
const approved=new Set(['MIT','BSD-2-Clause','BSD-3-Clause','ISC','Apache-2.0','(MPL-2.0 OR Apache-2.0)','CC0-1.0','0BSD']);
for(const [folder,entry] of Object.entries(lock.packages)) {
 if(!folder||!await exists(folder+'/package.json'))continue;
 const p=JSON.parse(await fs.readFile(folder+'/package.json','utf8'));const license=typeof p.license==='object'?p.license.type:p.license;
 if(!approved.has(license))throw new Error(`License needs review: ${p.name} ${license}`);
 const files=(await fs.readdir(folder)).filter(f=>/^(licen[cs]e|copying|notice|copyright|third.?party)/i.test(f));
 let texts=[];for(const file of files){const full=path.join(folder,file);if((await fs.stat(full)).isFile())texts.push(file+'\n'+await fs.readFile(full,'utf8'))}
 // Platform binary packages are published from the same esbuild release under its MIT license.
 if(!texts.length&&p.name.startsWith('@esbuild/')&&p.version===JSON.parse(await fs.readFile('node_modules/esbuild/package.json','utf8')).version)texts.push(await fs.readFile('node_modules/esbuild/LICENSE.md','utf8'));
 if(!texts.length)throw new Error(`Missing license text: ${p.name}`);
 const text=texts.join('\n\n');const name=p.name.replaceAll('/','__').replace('@','')+'-'+p.version+'.txt';await fs.writeFile(path.join(target,name),text);
 inventory.push({ecosystem:'npm',name:p.name,version:p.version,license,scope:entry.dev?'development':'application',source:entry.resolved,integrity:entry.integrity,notice:'docs/licenses/'+name});
 sections.push(`${p.name} ${p.version}\nLicense: ${license}\nSource: ${entry.resolved}\n${text}`);
}
const nugetRoot=path.join(root,'.work/nuget');
for(const packageName of await fs.readdir(nugetRoot)) {
 for(const version of await fs.readdir(path.join(nugetRoot,packageName))) {
  const folder=path.join(nugetRoot,packageName,version);if(!(await fs.stat(folder)).isDirectory())continue;
  const names=await fs.readdir(folder);const nuspec=names.find(n=>n.endsWith('.nuspec'));if(!nuspec)continue;
  const xml=await fs.readFile(path.join(folder,nuspec),'utf8');const declared=xml.match(/<license[^>]*>([^<]+)<\/license>/)?.[1];
  const license=packageName==='microsoft.web.webview2'?'BSD-3-Clause':declared;
  if(!approved.has(license))throw new Error(`NuGet license needs review: ${packageName} ${declared}`);
  let texts=[];for(const name of names.filter(n=>/^(licen[cs]e|notice|third.party)/i.test(n)))if((await fs.stat(path.join(folder,name))).isFile())texts.push(name+'\n'+await fs.readFile(path.join(folder,name),'utf8'));
  if(packageName.startsWith('sqlitepclraw.')){texts.push(await fs.readFile(path.join(target,'SQLitePCL.raw-LICENSE.TXT'),'utf8'));texts.push(await fs.readFile(path.join(target,'SQLitePCL.raw-NOTICE.TXT'),'utf8'))}
  if(!texts.length&&license==='MIT')texts.push(await fs.readFile(path.join(target,'dotnet-MIT.txt'),'utf8'));
  if(!texts.length)throw new Error(`Missing NuGet license: ${packageName}`);
  const source=xml.match(/<repository[^>]+url="([^"]+)"/)?.[1]??`https://www.nuget.org/packages/${packageName}/${version}`;
  const copyright=xml.match(/<copyright>([^<]+)<\/copyright>/)?.[1]??'';
  const text=[copyright,...texts].join('\n\n');const name=packageName+'-'+version+'.txt';await fs.writeFile(path.join(target,name),text);
  inventory.push({ecosystem:'nuget',name:packageName,version,license,scope:'application',source,notice:'docs/licenses/'+name});
  sections.push(`${packageName} ${version}\nLicense: ${license}\nSource: ${source}\n${text}`);
 }
}
for(const component of [
 {name:'LanguageTool',version:'6.9-SNAPSHOT-20260905',folder:'.tools/languagetool/LanguageTool-6.9-SNAPSHOT',notice:'COPYING.txt',license:'LGPL-2.1-or-later',source:'https://languagetool.org/download/snapshots/LanguageTool-20260905-snapshot.zip'},
 {name:'Eclipse Temurin JRE',version:'21.0.12.1+1',folder:'.tools/java/jdk-21.0.12.1+1-jre',notice:'NOTICE',license:'GPL-2.0-only WITH Classpath-exception-2.0',source:'https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1'}
]) {
 const notice=await fs.readFile(path.join(component.folder,component.notice),'utf8');
 const filename=component.name.replaceAll(' ','-').toLowerCase()+'.txt';await fs.writeFile(path.join(target,filename),notice);
 inventory.push({ecosystem:'generic',name:component.name,version:component.version,license:component.license,scope:'application',source:component.source,notice:'docs/licenses/'+filename});
 sections.push(`${component.name} ${component.version}\nSource: ${component.source}\nThe original, unmodified distribution is included under Proofreading. Its complete resource and dependency license notices remain in that folder.\n${notice}`);
}
await fs.writeFile('THIRD_PARTY_NOTICES.txt',sections.join('\n\n'+'='.repeat(78)+'\n\n').replace(/[\t ]+$/gm,''));
await fs.writeFile('docs/components.json',JSON.stringify(inventory,null,2));
const packages=inventory.map((p,i)=>({SPDXID:'SPDXRef-Package-'+i,name:p.name,versionInfo:p.version,downloadLocation:p.source||'NOASSERTION',filesAnalyzed:false,licenseDeclared:p.license,licenseConcluded:'NOASSERTION',copyrightText:'See '+p.notice,externalRefs:[{referenceCategory:'PACKAGE-MANAGER',referenceType:'purl',referenceLocator:`pkg:${p.ecosystem}/${p.name.replace('@','%40').replaceAll(' ','%20')}@${encodeURIComponent(p.version)}`}]}));
await fs.writeFile('docs/sbom.spdx.json',JSON.stringify({spdxVersion:'SPDX-2.3',dataLicense:'CC0-1.0',SPDXID:'SPDXRef-DOCUMENT',name:'Schreibatelier dependencies',documentNamespace:'https://schreibatelier.invalid/spdx/'+crypto.randomUUID(),creationInfo:{creators:['Tool: Schreibatelier license inventory'],created:new Date().toISOString()},packages,relationships:packages.map(p=>({spdxElementId:'SPDXRef-DOCUMENT',relationshipType:'DESCRIBES',relatedSpdxElement:p.SPDXID}))},null,2));
console.log(`${inventory.length} components: license identifiers and original notices verified.`);
