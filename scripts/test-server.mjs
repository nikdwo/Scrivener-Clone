import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('src/Schreibatelier.App/Web');
http.createServer(async(req,res)=>{try{const filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return}const bytes=await readFile(filename);res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}}).listen(4177,'127.0.0.1');
