import { stat } from 'node:fs/promises';
import exifr from 'exifr';
import {mediaInsightSchema,type MediaInsight} from '@z-cloud/contracts';
import type {WorkspaceStore} from '@z-cloud/db/workspace';
import type {MediaRepository} from '@z-cloud/core';
import type {UploadManager} from '@z-cloud/storage/uploads';
export function createMediaInspector(store:WorkspaceStore,repository:MediaRepository,uploads:UploadManager){
 const running=new Map<string,Promise<MediaInsight>>();
 return async(id:string):Promise<MediaInsight>=>{
  const saved=(await store.read()).insights.find(i=>i.assetId===id);
  if(saved&&(saved.status!=='unavailable'||Date.now()-Date.parse(saved.checkedAt)<60000))return saved;
  if(running.has(id))return running.get(id)!;
  const task=(async()=>{
   const asset=await repository.find(id);if(!asset)throw new Error('Media not found.');
   const result:MediaInsight={assetId:id,checkedAt:new Date().toISOString(),status:'unsupported'};
   if(asset.source==='upload'&&asset.type==='photo')try{
    const path=uploads.original(id);const info=await stat(path);
    if(info.size<=32*1024*1024){
     const tags=await exifr.parse(path,{pick:['DateTimeOriginal','Make','Model','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef'],reviveValues:false});
     result.status=tags?'read':'no-metadata';
     if(tags){
      const date=String(tags.DateTimeOriginal??'').slice(0,10).replace(/:/g,'-');if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date)))result.captureDate=date;
      const camera=[tags.Make,tags.Model].filter(x=>typeof x==='string').join(' ').slice(0,200);if(camera)result.camera=camera;
      const gps=await exifr.gps(path);if(Number.isFinite(gps?.latitude)&&Number.isFinite(gps?.longitude)){result.lat=gps!.latitude;result.lng=gps!.longitude;result.locationSource='exif';}
     }
    }
   }catch{result.status='unavailable';}
   const valid=mediaInsightSchema.parse(result);
   await store.mutate(data=>{const existing=data.insights.find(i=>i.assetId===id);if(existing?.locationSource==='user')Object.assign(valid,{lat:existing.lat,lng:existing.lng,label:existing.label,locationSource:'user'});if(existing)Object.assign(existing,valid);else data.insights.push(valid);});return valid;
  })();running.set(id,task);try{return await task;}finally{running.delete(id);}
 };
}
