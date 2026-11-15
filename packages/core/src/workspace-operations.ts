import { journeyChangeSchema, tripDataSchema, type WorkspaceData, type MediaInsight, type JourneyChange, type JourneyProposal } from '@z-cloud/contracts';
import type { MediaRepository } from './index';
export interface WorkspacePersistence{read():Promise<WorkspaceData>;mutate<T>(fn:(data:WorkspaceData)=>T|Promise<T>):Promise<T>}
export interface OperationsOptions{
 repository:MediaRepository;store:WorkspacePersistence;
 inspect?:(id:string)=>Promise<MediaInsight>;
 transfers?:()=>Promise<{id:string;status:string;phase:string;destinationName:string;receivedBytes:number;destinationBytes:number;metadata:{filename:string;size:number}}[]>;
 searchPlaces?:(query:string)=>Promise<{lat:number;lng:number;label:string}[]>;
 chatId?:string;
}
export class WorkspaceActionError extends Error{constructor(message:string,public status=400){super(message);}}
export class WorkspaceOperations{
 constructor(readonly options:OperationsOptions){}
 async overview(){
  const [assets,data,transfers]=await Promise.all([this.options.repository.list(),this.options.store.read(),this.options.transfers?.()??[]]);
  return {media:assets.filter(a=>a.source!=='demo').slice(0,30).map(({sourcePath,objectKey,...a})=>({...a,insight:data.insights.find(i=>i.assetId===a.id),tripIds:data.trips.filter(t=>!t.archived&&t.mediaIds.includes(a.id)).map(t=>t.id),transfer:transfers.find(t=>t.id===a.id)})),
   transfers:transfers.slice(0,30),trips:data.trips.filter(t=>!t.archived).map(t=>({id:t.id,title:t.title,revision:t.revision,destination:t.destination,startDate:t.startDate,endDate:t.endDate,mediaIds:t.mediaIds,logs:t.logs,tracks:t.tracks,status:t.status})),
   proposals:data.proposals.filter(p=>p.status==='pending'&&(!this.options.chatId||p.chatId===this.options.chatId)).slice(-20),};
 }
 async inspect(id:string){const asset=await this.options.repository.find(id);if(!asset)throw new WorkspaceActionError('Media not found.',404);const insight=this.options.inspect?await this.options.inspect(id):(await this.options.store.read()).insights.find(i=>i.assetId===id);return {id,title:asset.title,filename:asset.filename,type:asset.type,capturedAt:asset.capturedAt,location:asset.location,tags:asset.tags,description:asset.description,insight:insight??null,contentAvailable:asset.source==='upload',href:'/library?asset='+id,tripIds:(await this.options.store.read()).trips.filter(t=>t.mediaIds.includes(id)).map(t=>t.id)};}
 async propose(input:unknown){
  const change=journeyChangeSchema.parse(input);await this.validate(change);
  return this.options.store.mutate(data=>{
   if(change.tripId){const trip=data.trips.find(t=>t.id===change.tripId&&!t.archived);if(!trip)throw new WorkspaceActionError('Trip not found.',404);if(change.tripRevision===undefined)change.tripRevision=trip.revision;if(change.tripRevision!==trip.revision)throw new WorkspaceActionError('Trip changed; refresh its details.',409);}
   const proposal:JourneyProposal={id:crypto.randomUUID(),chatId:this.options.chatId,createdAt:new Date().toISOString(),status:'pending',change};data.proposals.push(proposal);return proposal;
  });
 }
 private async validate(change:JourneyChange){
  if(change.startDate&&change.endDate&&change.startDate>change.endDate)throw new WorkspaceActionError('End date precedes the start.');
  for(const id of change.mediaIds)if(!(await this.options.repository.find(id)))throw new WorkspaceActionError('One selected photo is not registered yet. Finish its upload first.',409);
 }
 async apply(id:string){
  return this.options.store.mutate(async data=>{
   const p=data.proposals.find(p=>p.id===id&&(!this.options.chatId||p.chatId===this.options.chatId));if(!p)throw new WorkspaceActionError('Proposal not found.',404);
   if(p.status==='applied')return {trip:data.trips.find(t=>t.id===p.resultTripId)!,proposal:p};
   if(p.status!=='pending')throw new WorkspaceActionError('This proposal was dismissed.',409);
   const c=p.change;await this.validate(c);let trip=c.tripId?data.trips.find(t=>t.id===c.tripId&&!t.archived):undefined;
   if(c.tripId&&(!trip||trip.revision!==c.tripRevision))throw new WorkspaceActionError('Trip changed. Create a fresh proposal before applying.',409);
   const now=new Date().toISOString();
   if(!trip){trip={...tripDataSchema.parse({title:c.title,destination:c.destination,startDate:c.startDate,endDate:c.endDate,status:c.intent==='plan'?'planning':'active'}),id:crypto.randomUUID(),revision:0,createdAt:now,updatedAt:now};data.trips.push(trip);}
   trip.mediaIds=[...new Set([...trip.mediaIds,...c.mediaIds])];
   if(c.place){
    trip.logs.push({id:crypto.randomUUID(),title:c.place.label,date:c.startDate||new Date().toISOString().slice(0,10),body:c.note||'Location confirmed by the user.',kind:c.intent==='plan'?'plan':'journal',done:false,lat:c.place.lat,lng:c.place.lng});
    if(c.intent==='record')for(const assetId of c.mediaIds){let fact=data.insights.find(i=>i.assetId===assetId);if(!fact){fact={assetId,checkedAt:now,status:'no-metadata'};data.insights.push(fact);}Object.assign(fact,{lat:c.place.lat,lng:c.place.lng,label:c.place.label,locationSource:'user'});}
   }else if(c.note)trip.logs.push({id:crypto.randomUUID(),title:c.title,date:c.startDate||new Date().toISOString().slice(0,10),body:c.note,kind:c.intent==='plan'?'plan':'journal',done:false});
   trip.revision++;trip.updatedAt=now;p.status='applied';p.resultTripId=trip.id;
   return {trip,proposal:p};
  });
 }
 async dismiss(id:string){return this.options.store.mutate(d=>{const p=d.proposals.find(p=>p.id===id&&(!this.options.chatId||p.chatId===this.options.chatId));if(!p)throw new WorkspaceActionError('Proposal not found.',404);if(p.status!=='pending')throw new WorkspaceActionError('Proposal is no longer pending.',409);p.status='dismissed';return p;});}
 async tool(name:string,input:Record<string,unknown>){
  if(name==='workspace_overview')return this.overview();
  if(name==='media_find'){const q=String(input.query??'').toLocaleLowerCase();const all=await this.overview();return {media:all.media.filter(a=>[a.title,a.filename,a.location,...a.tags].join(' ').toLocaleLowerCase().includes(q))};}
  if(name==='media_inspect')return this.inspect(String(input.id));
  if(name==='trip_list')return {trips:(await this.overview()).trips.map(({logs,tracks,...t})=>t)};
  if(name==='trip_get'){const trip=(await this.options.store.read()).trips.find(t=>t.id===input.id&&!t.archived);if(!trip)throw new WorkspaceActionError('Trip not found.',404);return {trip};}
  if(name==='place_search'){if(!this.options.searchPlaces)throw new WorkspaceActionError('Place search is unavailable. Ask the user to pick a point on the map.',503);return {places:await this.options.searchPlaces(String(input.query))};}
  if(name==='journey_propose')return {proposal:await this.propose(input.change)};
  throw new WorkspaceActionError('Unknown workspace tool.');
 }
}
