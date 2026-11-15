import {spawn} from 'node:child_process';
import {accessSync,constants} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
export type AgentEvent={type:'text'|'tool_start'|'tool_result';text?:string;name?:string;output?:unknown;error?:boolean};
export function findCLI(name:string){for(const dir of [...(process.env.PATH??'').split(delimiter),join(homedir(),'.local/bin'),'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS']){const path=join(dir,name);try{accessSync(path,constants.X_OK);return path;}catch{}}return null;}
const verified=new Set<string>();
export function nativeStatuses(){return (['codex','claude'] as const).map(id=>({id,label:id==='codex'?'Codex · ChatGPT':'Claude Code',available:!!findCLI(id),verified:verified.has(id)}));}
export async function runNative(provider:'codex'|'claude',prompt:string,chatId:string,storageRoot:string,dataFile:string,signal:AbortSignal,emit:(e:AgentEvent)=>void){
 const bin=findCLI(provider);if(!bin)throw new Error(`${provider} is not installed on this computer.`);
 const cwd=await mkdtemp(join(tmpdir(),'zcloud-assistant-'));
 const descriptor={command:process.execPath,args:[fileURLToPath(new URL('../../mcp/dist/stdio.js',import.meta.url))],env:{ZCLOUD_STORAGE_ROOT:storageRoot,ZCLOUD_DATA_FILE:dataFile,ZCLOUD_ACTOR:`assistant:${provider}`,ZCLOUD_TOOL_MODE:'assistant',ZCLOUD_CHAT_ID:chatId,...(process.env.DATABASE_URL?{DATABASE_URL:process.env.DATABASE_URL}:{})}};
 const enc=JSON.stringify;
 const args=provider==='claude'?['-p','--output-format','stream-json','--verbose','--strict-mcp-config','--mcp-config',enc({mcpServers:{zcloud:descriptor}}),'--allowedTools','mcp__zcloud','--tools','','--disable-slash-commands','--max-turns','10','--permission-mode','dontAsk']:
 ['exec','--json','--ephemeral','--ignore-user-config','--skip-git-repo-check','--sandbox','read-only','-c','approval_policy="never"','-c','features.shell_tool=false','-c',`mcp_servers.zcloud.command=${enc(descriptor.command)}`,'-c',`mcp_servers.zcloud.args=${enc(descriptor.args)}`,'-c',`mcp_servers.zcloud.env={${Object.entries(descriptor.env).map(([k,v])=>`${k}=${enc(v)}`).join(',')}}`,'-'];
 const env:NodeJS.ProcessEnv={NO_COLOR:'1',MCP_CONNECTION_NONBLOCKING:'false'};for(const key of ['HOME','PATH','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS'])if(process.env[key])env[key]=process.env[key];
 try{await new Promise<void>((resolve,reject)=>{
  const child=spawn(bin,args,{cwd,env,detached:true,stdio:['pipe','pipe','pipe']});let textSeen=false,failure=false,bytes=0;let force:ReturnType<typeof setTimeout>|undefined;
  const stop=()=>{try{process.kill(-child.pid!,'SIGTERM');}catch{}force=setTimeout(()=>{try{process.kill(-child.pid!,'SIGKILL');}catch{}},3000);force.unref();};
  signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
  const lines=createInterface({input:child.stdout});
  lines.on('line',raw=>{bytes+=raw.length;if(bytes>2_000_000){failure=true;stop();return;}let e:any;try{e=JSON.parse(raw);}catch{return;}
   if(provider==='codex'){
    const item=e.item;
    if(e.type==='turn.failed'||e.type==='error')failure=true;
    if(item?.type==='mcp_tool_call'){
     const name=String(item.tool??'workspace');if(e.type==='item.started')emit({type:'tool_start',name});
     if(e.type==='item.completed'){let output=item.result?.content?.find((c:any)=>c.type==='text')?.text;try{output=JSON.parse(output);}catch{}emit({type:'tool_result',name,output,error:!!item.error||item.status==='failed'});}
    }
    if(e.type==='item.completed'&&item?.type==='agent_message'&&typeof item.text==='string'){textSeen=true;emit({type:'text',text:item.text});}
   }else{
    if(e.type==='system'&&e.subtype==='init'){const server=e.mcp_servers?.find((s:any)=>s.name==='zcloud');if(server&&server.status!=='connected'){failure=true;stop();}}
    for(const part of e.message?.content??[]){
     if(part.type==='text'&&e.type==='assistant'){textSeen=true;emit({type:'text',text:part.text});}
     if(part.type==='tool_use')emit({type:'tool_start',name:String(part.name).replace(/^mcp__zcloud__/, '')});
     if(part.type==='tool_result'){let output=typeof part.content==='string'?part.content:part.content?.find((p:any)=>p.type==='text')?.text;try{output=JSON.parse(output);}catch{}emit({type:'tool_result',name:'workspace',output,error:!!part.is_error});}
    }
    if(e.type==='result'){if(e.is_error)failure=true;else if(!textSeen&&typeof e.result==='string'){textSeen=true;emit({type:'text',text:e.result});}}
   }
  });
  child.stderr.on('data',()=>{});
  child.on('error',()=>{failure=true;});
  child.on('close',code=>{signal.removeEventListener('abort',stop);if(force)clearTimeout(force);lines.close();if(signal.aborted)reject(new Error('Assistant stopped.'));else if(failure||code!==0||!textSeen)reject(new Error(`${provider} could not complete the request. Check its account login or usage limit. Your conversation is saved.`));else{verified.add(provider);resolve();}});
  child.stdin.end(prompt);
 });}finally{await rm(cwd,{recursive:true,force:true});}
}
