import { placeSchema } from '@z-cloud/contracts';
let last=0;const cache=new Map<string,{at:number;data:{lat:number;lng:number;label:string}[]}>();
export async function searchPlaces(query:string){
 const key=query.trim().toLocaleLowerCase();const saved=cache.get(key);if(saved&&Date.now()-saved.at<24*3600000)return saved.data;
 if(Date.now()-last<1100)throw new Error('Place search is busy. Wait a moment and retry.');last=Date.now();
 const url=new URL(process.env.ZCLOUD_PLACE_SEARCH_URL??'https://photon.komoot.io/api/');url.searchParams.set('q',query);url.searchParams.set('limit','5');
 const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'ZCloud/0.1 (local personal travel studio)'},redirect:'error'});if(!r.ok)throw new Error('Place search is unavailable. Choose a point on the map.');
 const result=await r.json();const data=(result.features??[]).flatMap((f:{geometry?:{coordinates?:number[]};properties?:Record<string,string>})=>{
  const coordinates=f.geometry?.coordinates;const p=f.properties??{};const candidate=placeSchema.safeParse({lng:coordinates?.[0],lat:coordinates?.[1],label:[p.name,p.city,p.state,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')});return candidate.success?[candidate.data]:[];
 });if(cache.size>200)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),data});return data;
}
