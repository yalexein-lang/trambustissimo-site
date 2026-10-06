(()=>{
'use strict';
if(globalThis.PpwAUHost?.request)return;

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const storagePrefix='plicata-web-preview-v1:';
const stateStore=new Map();
try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(storagePrefix+'state:'))stateStore.set(k.slice((storagePrefix+'state:').length),localStorage.getItem(k));}}catch{}
let userPresets=[];try{userPresets=JSON.parse(localStorage.getItem(storagePrefix+'presets')||'[]')}catch{}
const persist=()=>{try{localStorage.setItem(storagePrefix+'presets',JSON.stringify(userPresets))}catch{}};
let manifest=null,contract=null,activeIndex=0,wire={},productState=null,currentPreset=null;
let midiConfig={
  schema:'trambustissimo-midi-mpe-config-v1',
  mode:'AUTO',
  profileId:'auto',
  masterChannel:1,
  memberChannelFirst:2,
  memberChannelLast:16,
  masterPitchBendRangeSemitones:2,
  memberPitchBendRangeSemitones:48,
  expression:{velocity:0,pressure:0,timbre:0,pitchBendSemitones:0}
};
let effectConfig={schema:'effects-bloom-system-state-v1'};

const load=async()=>{
  if(manifest&&contract)return;
  [manifest,contract]=await Promise.all([
    fetch('./ppw-auv3-manifest.json',{cache:'no-store'}).then(r=>r.json()),
    fetch('./contracts/'+String(globalThis.__STORE_MEDIA_CONFIG__?.contract||'mavis')+'.json',{cache:'no-store'}).then(r=>r.json()),
  ]);
  applyFactory(0);
};

const factoryRows=()=>Array.isArray(manifest?.presets)?manifest.presets:[];
const semantic=()=>contract?.semantic||{};
const macroDefaults=()=>Object.fromEntries((semantic().macros||[]).map(row=>[String(row.id),Number(row.default)||0]));
const presetPublic=(row,index)=>({
  id:String(row?.id||''),
  name:String(row?.name||row?.label||row?.id||'FACTORY'),
  number:index,
  category:String(row?.category||''),
  tags:Array.isArray(row?.tags)?row.tags.map(String):[],
});
const cleanPatch=value=>value&&typeof value==='object'?clone(value):{schema:'moog-patch-state-v1',slug:'mavis',cables:[]};

function applyFactory(which){
  const rows=factoryRows();
  let index=typeof which==='number'?which:rows.findIndex(row=>String(row?.id||'')===String(which||''));
  if(index<0||index>=rows.length)index=0;
  activeIndex=index;
  const row=rows[index]||{};
  wire=clone(row?.state?.parameters||row?.sourceState?.parameters||{});
  const controls=clone(row?.sourceState?.parameters||row?.state?.parameters||{});
  productState={
    schema:'moog-eurorack-product-state-v2',
    controls,
    macros:macroDefaults(),
    patchState:cleanPatch(row?.sourceState?.patchState||row?.state?.patchState),
    sourcePresetId:String(row?.id||''),
  };
  currentPreset={kind:'factory',...presetPublic(row,index),dirty:false};
  return row;
}

const runtime=()=>({
  schema:'plicata-web-preview-runtime-v1',
  sampleRate:48000,
  controlValues:{...wire,'gate-merged':0,'velocity-amp-factor':0,'envelope':0},
  lastPeak:0,
  errorCount:0,
  callbackErrors:0,
  callbackOverrunCount:0,
  xruns:0,
  moduleCpuPercent:0,
  midiMpe:{velocity:0,pressure:0,timbre:0,pitchBendSemitones:0},
});
const transport=()=>({
  available:false,playing:false,recording:false,cycling:false,
  tempo:120,beatPosition:0,samplePosition:0,renderSampleTime:0,sampleRate:48000,
  timeSignatureNumerator:4,timeSignatureDenominator:4,scheduleEpoch:1,
});
const snapshot=()=>({
  schema:'plicata-web-preview-snapshot-v1',
  productId:String(manifest?.productId||'tessera'),
  parameters:clone(wire),
  productState:clone(productState),
  factoryPresets:factoryRows().map(presetPublic),
  userPresets:userPresets.map(({wire,productState,...publicRow})=>clone(publicRow)),
  supportsUserPresets:true,
  userPresetStoreError:'',
  currentPreset:clone(currentPreset),
  presetDirty:false,
  runtime:runtime(),
  hostTransport:transport(),
});
const emptyMidiInput=()=>({
  connectedInputPorts:0,ports:[],latestSequence:0,earliestSequence:0,
  overwritten:0,dropped:0,events:[],
});

const applyControls=rows=>{
  for(const row of Array.isArray(rows)?rows:[]){
    const id=String(row?.id||'').replace(/^control\./,'');
    const value=Number(row?.value);
    if(!id||!Number.isFinite(value))continue;
    wire[id]=value;
    if(productState?.controls)productState.controls[id]=value;
  }
};

async function request(operation,payload={}){
  await load();
  const op=String(operation||'');
  if(op==='snapshot'||op==='liveSnapshot')return snapshot();
  if(op==='liveTelemetrySnapshot')return{live:snapshot(),telemetry:runtime()};
  if(op==='runtimeTelemetry'||op==='parameterTelemetry')return runtime();
  if(op==='hostTransport')return transport();
  if(op==='midiInputSnapshot')return emptyMidiInput();
  if(op==='sequenceSceneMidiRecallSnapshot')return{available:false,events:[],latestSequence:0};
  if(op==='midiMpeConfig')return{accepted:true,config:clone(midiConfig),input:emptyMidiInput()};
  if(op==='setMidiMpeConfig'){midiConfig={...midiConfig,...clone(payload?.config||{})};return{accepted:true,config:clone(midiConfig),input:emptyMidiInput()};}
  if(op==='resetMidiMpeAuto'){midiConfig={...midiConfig,mode:'AUTO',profileId:'auto'};return{accepted:true,config:clone(midiConfig),input:emptyMidiInput()};}
  if(op==='effectSystemConfig')return{accepted:true,config:clone(effectConfig)};
  if(op==='setEffectSystemConfig'){effectConfig=clone(payload?.config||effectConfig);return{accepted:true,config:clone(effectConfig)};}
  if(op==='stateLoad')return stateStore.get(String(payload?.key||''))??null;
  if(op==='stateSave'){const k=String(payload?.key||''),v=String(payload?.json??'');stateStore.set(k,v);try{localStorage.setItem(storagePrefix+'state:'+k,v)}catch{}return{accepted:true};}
  if(op==='stateRemove'){const k=String(payload?.key||'');stateStore.delete(k);try{localStorage.removeItem(storagePrefix+'state:'+k)}catch{}return{accepted:true};}
  if(op==='saveUserPreset'){
 let row=userPresets.find(x=>x.id===payload.id);if(!row){row={id:crypto.randomUUID(),number:-userPresets.length-1,kind:'user'};userPresets.push(row)}
 Object.assign(row,{name:String(payload.name||'Untitled'),category:String(payload.category||''),tags:payload.tags||[],wire:clone(wire),productState:clone(productState)});currentPreset={kind:'user',id:row.id,name:row.name,number:row.number,dirty:false,category:row.category,tags:row.tags};persist();return{accepted:true,snapshot:snapshot()};
 }
 if(op==='renameUserPreset'||op==='deleteUserPreset'||op==='duplicateUserPreset'){
 const row=userPresets.find(x=>x.id===payload.id);if(!row)return{accepted:false};
 if(op==='renameUserPreset')row.name=String(payload.name||row.name);
 if(op==='deleteUserPreset')userPresets=userPresets.filter(x=>x!==row);
 if(op==='duplicateUserPreset')userPresets.push({...clone(row),id:crypto.randomUUID(),number:-userPresets.length-1,name:String(payload.name||row.name+' copy')});persist();return{accepted:true,snapshot:snapshot()};
 }
 if(op==='presetMetadata'){
 const row=userPresets.find(x=>x.id===payload.id)||factoryRows().find(x=>x.id===payload.id);if(!row)return{accepted:false};for(const k of ['favorite','category','tags'])if(payload[k]!==undefined)row[k]=clone(payload[k]);persist();return{accepted:true,snapshot:snapshot()};
 }
 if(op==='selectPreset'){
 const user=userPresets.find(x=>payload.id?x.id===payload.id:x.number===payload.number);if(user){wire=clone(user.wire);productState=clone(user.productState);currentPreset={kind:'user',id:user.id,name:user.name,number:user.number,dirty:false,category:user.category,tags:user.tags};return{accepted:true,snapshot:snapshot()};}

    const rows=factoryRows();
    const index=payload?.id?rows.findIndex(row=>String(row?.id||'')===String(payload.id)):Math.trunc(Number(payload?.number)||0);
    applyFactory(index);
    return{accepted:true,snapshot:snapshot()};
  }
  if(op==='setControl'){applyControls([{id:payload?.id,value:payload?.value}]);return{accepted:true,snapshot:snapshot()};}
  if(op==='setControls'){applyControls(payload?.rows);return{accepted:Array.isArray(payload?.rows)?payload.rows.length:0,snapshot:snapshot()};}
  if(op==='setProductState'){
    const next=clone(payload?.state||{});
    if(next&&typeof next==='object'){
      productState={...productState,...next,controls:{...(productState?.controls||{}),...(next.controls||{})}};
      if(next.patchState)productState.patchState=cleanPatch(next.patchState);
      applyControls(Object.entries(next.controls||{}).map(([id,value])=>({id,value})));
      currentPreset={kind:'custom',id:'',name:'CUSTOM',number:null,dirty:true,category:''};
    }
    return{accepted:true,snapshot:snapshot()};
  }
  if(op==='patchStateApply'){
    productState.patchState=cleanPatch(payload?.state);
    return{accepted:true,state:clone(productState.patchState),snapshot:snapshot()};
  }
  if(op==='surfacePreferredSize'||op==='surfaceWindowSize'||op==='parameterGesture')return{accepted:true};
  if(op==='panic')return{accepted:true,receipt:{state:'applied',requestedEpoch:1,appliedEpoch:1}};
  if(op==='panicStatus')return{accepted:true,receipt:{state:'applied',requestedEpoch:1,appliedEpoch:1}};
  if(op==='scheduleReset')return{accepted:true,epoch:Math.max(1,Math.trunc(Number(payload?.epoch)||1))};
  if(op==='setArpeggiatorMidiCapture'||op==='setSequenceKeyswitchMidiCapture'||op==='sequenceSceneMidiLearnCapture')return{accepted:true,enabled:payload?.enabled===true,learn:payload?.learn===true};
  if(op==='midi'||op==='midiAt'||op==='midiAtBatch'||op==='midiOutput'||op==='midiOutputAt'||op==='midiOutputBatch'||op==='midiOutputAtBatch'||op==='eventIngress'||op==='action')return{accepted:true,sentPorts:0};
  if(op==='midiOutputDestinations')return{accepted:true,destinations:[]};
  if(op==='setControlIngresses')return{accepted:true};
  if(op==='applySequenceScene'||op==='sequenceSceneApply')return{accepted:true,snapshot:snapshot()};
  if(op==='runtimeProductSnapshot')return{accepted:true,snapshot:{}};
  if(op==='runtimeProductControls'||op==='runtimeProductCommand'||op==='sequencerTransport')return{accepted:true};
  if(op==='openExternalUrl'){const url=String(payload.url||'');if(/^https:\/\/(www\.)?trambustissimo\.com(?:\/|$)/.test(url)||url==='https://trambustissimo.com/'){window.open(url,'_blank','noopener');return{accepted:true}}return{accepted:false};}
  return{accepted:true,snapshot:snapshot()};
}

const fastRequest=(op,payload={})=>request(op,payload);
globalThis.PpwAUHost=Object.freeze({
  request,
  fastRequest,
  send:(op,payload={})=>{void request(op,payload);return true},
});
const mediaHost=Object.freeze({
  snapshot:()=>clone(snapshot()),
  selectFactory:id=>{applyFactory(id);return clone(snapshot())},
  factoryRows:()=>clone(factoryRows()),
  accent:String(globalThis.__STORE_MEDIA_CONFIG__?.accent||'#c05c43'),
  accentSoft:String(globalThis.__STORE_MEDIA_CONFIG__?.accentSoft||'#ecc1b4'),
});
globalThis.__STORE_MEDIA_HOST__=mediaHost;
globalThis.__PLICATA_STORE_MEDIA_HOST__=mediaHost;
})();
