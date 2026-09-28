import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('UI server builds current sources before listening and fails closed', {timeout:30000}, async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url)), work=path.join(root,'.work');
  await mkdir(work,{recursive:true});
  const fixture=await mkdtemp(path.join(work,'test-server-')), children=[];
  t.after(async()=>{
    for(const {child} of children)if(child.exitCode===null)child.kill();
    await Promise.all(children.map(({exit})=>exit));
    assert.equal(path.dirname(path.resolve(fixture)),path.resolve(work));
    await rm(fixture,{recursive:true,force:true});
  });
  await mkdir(path.join(fixture,'scripts'));await mkdir(path.join(fixture,'web'));
  for(const file of ['test-server.mjs','build-web.mjs'])await copyFile(path.join(root,'scripts',file),path.join(fixture,'scripts',file));
  await writeFile(path.join(fixture,'web/index.html'),'<script src="main.js"></script>');
  await writeFile(path.join(fixture,'web/style.css'),'body{color:black}');
  const source=path.join(fixture,'web/main.ts'),bundle=path.join(fixture,'src/Schreibatelier.App/Web/main.js');
  async function start(){
    // Keep both production scripts unchanged; give only their HTTP listener an ephemeral test port.
    const child=spawn(process.execPath,['--input-type=module','--eval',`
      import http from 'node:http';
      const listen=http.Server.prototype.listen;
      http.Server.prototype.listen=function(port,...args){
        if(port!==4177)throw new Error('Unexpected production listener');
        this.once('listening',()=>console.log('SERVER_PORT='+this.address().port));
        return listen.call(this,0,...args);
      };
      await import('./scripts/test-server.mjs');
    `],{cwd:fixture,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='';
    const ready=new Promise(resolve=>child.stdout.on('data',data=>{output+=data;const match=output.match(/SERVER_PORT=(\d+)/);if(match)resolve({port:Number(match[1])})}));
    child.stderr.on('data',data=>output+=data);
    const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,output}))});
    children.push({child,exit});
    return {child,exit,...await Promise.race([ready,exit.then(result=>({result}))])};
  }
  async function stop(server){server.child.kill();await server.exit}

  await t.test('missing bundle is generated before the first response',async()=>{
    await writeFile(source,'globalThis.__testFreshness = "first-source";');
    await assert.rejects(readFile(bundle),{code:'ENOENT'});
    const server=await start();assert.ok(server.port,server.result?.output);
    const response=await fetch(`http://127.0.0.1:${server.port}/main.js`);
    assert.equal(response.status,200);assert.match(await response.text(),/first-source/);
    await stop(server);
  });
  await t.test('restart serves changed source rather than the existing bundle',async()=>{
    await writeFile(source,'globalThis.__testFreshness = "updated-source";');
    const server=await start();assert.ok(server.port,server.result?.output);
    const body=await (await fetch(`http://127.0.0.1:${server.port}/main.js`)).text();
    assert.match(body,/updated-source/);assert.doesNotMatch(body,/first-source/);
    await stop(server);
  });
  await t.test('build error exits without listening or serving the stale bundle',async()=>{
    const previous=await readFile(bundle,'utf8');
    await writeFile(source,'const broken = ;');
    const server=await start();assert.equal(server.port,undefined);
    assert.notEqual(server.result.code,0);assert.match(server.result.output,/ERROR/);
    assert.doesNotMatch(server.result.output,/SERVER_PORT=/);
    assert.equal(await readFile(bundle,'utf8'),previous);
  });
});
