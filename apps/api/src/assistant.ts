import {Hono} from 'hono';
import {streamSSE} from 'hono/streaming';
import {bodyLimit} from 'hono/body-limit';
import {z} from 'zod';
import {assistantTurnSchema,journeyChangeSchema,type AssistantMessage} from '@z-cloud/contracts';
import {WorkspaceOperations,WorkspaceActionError,type OperationsOptions} from '@z-cloud/core/workspace-operations';
import type {WorkspaceStore} from '@z-cloud/db/workspace';
import type {UploadManager} from '@z-cloud/storage/uploads';
import type {AIService} from './ai';
import type {ToolChatGateway} from '@z-cloud/ai';
import {createMediaInspector} from './media-insights';
import {searchPlaces} from './places';
import {nativeStatuses} from './native-assistant';
import {runAssistant} from './assistant-runtime';
export function createAssistantRoutes(options:{store:WorkspaceStore;repository:OperationsOptions['repository'];uploads:UploadManager;ai?:AIService;storageRoot:string;dataFile:string}){
 const routes=new Hono();const inspect=createMediaInspector(options.store,options.repository,options.uploads);
 const opsOptions:OperationsOptions={...options,inspect,searchPlaces,transfers:async()=>(await options.uploads.list()).map(s=>({id:s.id,status:s.status,phase:s.phase,destinationName:s.destinationName,receivedBytes:s.receivedBytes,destinationBytes:s.destinationBytes,metadata:{filename:s.metadata.filename,size:s.metadata.size}}))};
 const operations=new WorkspaceOperations(opsOptions);let running:string|undefined;
 routes.use('/assistant/*',bodyLimit({maxSize:40*1024}));
 routes.get('/desk',async c=>{const assets=(await options.repository.list()).filter(a=>a.source==='upload'&&a.type==='photo').slice(0,5);for(const asset of assets)await inspect(asset.id);return c.json(await operations.overview());});
 routes.get('/places/search',async c=>{const query=z.string().trim().min(2).max(200).parse(c.req.query('q'));try{return c.json({places:await searchPlaces(query)});}catch{return c.json({error:'Place search is unavailable or busy. You can choose a point on the map.'},503);}});
 routes.post('/journey/proposals',async c=>c.json({proposal:await operations.propose(journeyChangeSchema.parse(await c.req.json()))},201));
 routes.post('/journey/proposals/:id/apply',async c=>{const id=z.uuid().parse(c.req.param('id'));const result=await operations.apply(id);return c.json(result);});
 routes.post('/journey/proposals/:id/dismiss',async c=>c.json({proposal:await operations.dismiss(z.uuid().parse(c.req.param('id')))}));
 routes.get('/assistant/providers',c=>c.json({providers:[{id:'liara',label:'Liara',available:!!options.ai?.gateway.complete,verified:!!options.ai?.gateway.complete},...nativeStatuses()]}));
 routes.get('/assistant/chats',async c=>c.json({chats:(await options.store.read()).chats.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,30).map(({messages,...chat})=>chat)}));
 routes.post('/assistant/chats',async c=>{const chat={id:crypto.randomUUID(),title:'New conversation',messages:[],updatedAt:new Date().toISOString()};await options.store.mutate(data=>data.chats.push(chat));return c.json({chat},201);});
 routes.get('/assistant/chats/:id',async c=>{const id=z.uuid().parse(c.req.param('id'));const chat=(await options.store.read()).chats.find(t=>t.id===id);if(!chat)return c.json({error:'Conversation not found.'},404);return c.json({chat,proposals:(await options.store.read()).proposals.filter(p=>p.chatId===id)});});
 routes.post('/assistant/turn',async c=>{
  const input=assistantTurnSchema.parse(await c.req.json());if(running)return c.json({error:'An assistant is already running. Wait or cancel it first.'},409);
  const chat=(await options.store.read()).chats.find(t=>t.id===input.chatId);if(!chat)return c.json({error:'Start a conversation first.'},404);if(chat.messages.length>190)return c.json({error:'This conversation is full. Start a new conversation.'},409);
  if(input.provider==='liara'&&!options.ai?.gateway.complete)return c.json({error:'Liara is not configured. Choose an installed assistant.'},503);
  if(input.provider!=='liara'&&!nativeStatuses().find(p=>p.id===input.provider)?.available)return c.json({error:'This assistant is not installed on the server.'},503);
  running=input.chatId;
  return streamSSE(c,async stream=>{
   const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),180000);stream.onAbort(()=>abort.abort());
   const reply:AssistantMessage={id:crypto.randomUUID(),role:'assistant',text:'',status:'running',createdAt:new Date().toISOString(),tools:[],provider:input.provider};
   const user:AssistantMessage={id:crypto.randomUUID(),role:'user',text:input.text,status:'complete',createdAt:new Date().toISOString(),tools:[]};
   const persist=()=>options.store.mutate(data=>{const target=data.chats.find(t=>t.id===chat.id)!;const existing=target.messages.findIndex(m=>m.id===reply.id);if(existing>=0)target.messages[existing]=reply;target.updatedAt=new Date().toISOString();});
   let writes=Promise.resolve();
   const send=(event:Record<string,unknown>)=>{writes=writes.then(()=>stream.writeSSE({data:JSON.stringify(event)})).catch(()=>{abort.abort();});};
   try{
    await options.store.mutate(data=>{const target=data.chats.find(t=>t.id===chat.id)!;for(const m of target.messages)if(m.status==='running')m.status='cancelled';target.messages.push(user,reply);if(target.messages.length===2)target.title=input.text.slice(0,100);target.updatedAt=user.createdAt;});
    send({type:'start',messageId:reply.id,provider:input.provider});
    await runAssistant(opsOptions,options.ai?.gateway.complete?options.ai.gateway as ToolChatGateway:undefined,input.provider,chat,input,options,abort.signal,event=>{
     if(event.type==='text'){reply.text+=(reply.text?'\n\n':'')+event.text;send(event);}
     else if(event.type==='tool_start'){reply.tools.push({name:event.name!,status:'running',summary:''});send(event);}
     else{const tool=reply.tools.slice().reverse().find(t=>t.status==='running'&&(t.name===event.name||event.name==='workspace'));if(tool){tool.status=event.error?'error':'complete';tool.summary=event.error?'Action could not be completed.':'Workspace result received.';tool.output=event.output;}send(event);}
    });
    reply.status='complete';await persist();send({type:'done'});
   }catch(e){reply.status=abort.signal.aborted?'cancelled':'error';const error=abort.signal.aborted?'Assistant stopped. The conversation and proposals are saved.':(e as Error).message;reply.text+=(reply.text?'\n\n':'')+error;try{await persist();}catch{}send({type:'error',error});}
   finally{clearTimeout(timeout);running=undefined;await writes;}
  });
 });
 routes.onError((e,c)=>{if(e instanceof WorkspaceActionError)return c.json({error:e.message},e.status as 400);if(e instanceof z.ZodError)return c.json({error:'Check the supplied fields.'},400);return c.json({error:'The workspace action could not be completed.'},500);});
 return routes;
}
