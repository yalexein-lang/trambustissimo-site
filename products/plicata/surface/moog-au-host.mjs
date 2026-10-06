import {generateMoogProductState} from './surfaces/moog-state-generator-v1.mjs'
import {isSurfacePresented,surfacePresentationRevision,subscribeSurfacePresentation} from './surfaces/surface-visibility-v1.mjs'
import {installMoogUIDiagnostics} from './moog-au-ui-diagnostics.mjs'
import {createLatestControlMailbox} from './surfaces/continuous-control-gesture-v1.mjs'
import {plicataNeutralBendBytes,plicataNoteOffBytes,plicataNoteOnBytes,plicataPitchBendBytes,plicataPitchBendRangeMessages,plicataTwelveTetPitch,resolvePlicataKeyboardPitch} from './surfaces/plicata-keyboard-pitch-v1.mjs'

const nativeHost=globalThis.PpwAUHost
if(!nativeHost?.request)throw new Error('moogAuv3.hostBridgeMissing')
let encodeControlRowsForNative=rows=>rows
let useProductRuntimeControls=false
let controlDiagnostics=null
const controlMailbox=createLatestControlMailbox(async rows=>{
  const started=controlDiagnostics?performance.now():null
  try{
  const encodedRows=encodeControlRowsForNative(rows)
  if(useProductRuntimeControls){
    const result=await requestRealtime('runtimeProductControls',{rows:encodedRows})
    if(result?.accepted!==true)throw new Error('moogAuv3.productControlBatchRejected')
    return
  }
  const result=await (typeof nativeHost.fastRequest==='function'?nativeHost.fastRequest('setControls',{rows:encodedRows}):nativeHost.request('setControls',{rows:encodedRows}))
  if(Number(result?.accepted)!==rows.length)throw new Error('moogAuv3.controlBatchRejected')
  }finally{if(started!==null)controlDiagnostics.record('controlBatchRoundTripMs',performance.now()-started)}
},{intervalMs:()=>globalThis.__PPW_MOOG_FAST_CONTROLS__===true?8:1000/60,onError:error=>showStatus(`AU · ${String(error?.message||error)}`)})
// Ordered commands cannot overtake an outstanding parameter batch. Telemetry is
// a separate read-only lane; audio/MIDI timestamped delivery is not frame-clocked.
const timedEventOps=new Set(['midi','midiAt','midiAtBeat','midiOutput','midiOutputAt','midiOutputAtBeat','midiOutputBatch','eventIngress','scheduleReset'])
// Read-only transport sampling is latency-sensitive ARP clock telemetry, not an
// ordered musical mutation. Putting it behind the continuous-control mailbox
// inserted a fence every ~12 ms while a knob was being dragged on Android,
// allowing UI work to contend with ARP clock polling. Keep mutation/state
// commands ordered, but let transport reads observe the latest native clock
// independently of the parameter-write lane. Incremental MIDI journal/config
// reads are also observational, not write fences. Use Apple's reply-based fast
// channel so touch tracking cannot stall controls behind evaluateJavaScript replies.
const realtimeReadOps=new Set(['hostTransport','liveTelemetrySnapshot','midiInputSnapshot','sequenceSceneMidiRecallSnapshot','midiMpeConfig'])
const host={
  request:(op,payload)=>(timedEventOps.has(op)||realtimeReadOps.has(op))?nativeHost.request(op,payload):controlMailbox.barrier(()=>nativeHost.request(op,payload)),
  fastRequest:typeof nativeHost.fastRequest==='function'?(op,payload)=>nativeHost.fastRequest(op,payload):undefined,
}
const requestRealtime=(op,payload={})=>typeof host.fastRequest==='function'?host.fastRequest(op,payload):host.request(op,payload)

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const mergeMidiConfigIdentity=(requested,actual)=>{const next={...(requested&&typeof requested==='object'?requested:{}),...(actual&&typeof actual==='object'?actual:{})};if(String(actual?.profileId||'')==='auv3-custom'&&requested?.profileId)next.profileId=String(requested.profileId);return next}
const statusNode=document.getElementById('status')
let statusTimer=0
const showStatus=text=>{clearTimeout(statusTimer);statusNode.textContent=String(text||'');statusNode.dataset.visible=text?'1':'0';if(text)statusTimer=setTimeout(()=>{statusNode.dataset.visible='0'},1500)}

const manifest=await fetch('./ppw-auv3-manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`manifestHttp:${r.status}`);return r.json()})
const manifestParameterById=new Map((manifest.parameters||[]).map(row=>[String(row.id),row]))
const auValueFromPortable=(id,value)=>{const spec=manifestParameterById.get(String(id));const number=Number(value);if(!spec||!Number.isFinite(number))return number;const values=Array.isArray(spec.portableValues)?spec.portableValues:[];if(!values.length)return number;const index=values.findIndex(candidate=>Number.isFinite(Number(candidate))&&Math.abs(Number(candidate)-number)<=1e-9);return index>=0?index:Number.NaN}
const portableValueFromAU=(id,value)=>{const spec=manifestParameterById.get(String(id));const number=Number(value);if(!spec||!Number.isFinite(number))return number;const values=Array.isArray(spec.portableValues)?spec.portableValues:[];if(!values.length)return number;const index=Math.round(number);return index>=0&&index<values.length&&Math.abs(number-index)<=1e-6?Number(values[index]):Number.NaN}
const decodeNativeParameters=record=>{const source=record&&typeof record==='object'?record:{},decoded={};for(const id in source){if(!Object.prototype.hasOwnProperty.call(source,id))continue;const value=source[id],portable=portableValueFromAU(id,value);decoded[id]=Number.isFinite(portable)?portable:value}return decoded}
const sameNativeParameterWire=(left,right)=>{if(left===right)return true;if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;let leftCount=0,rightCount=0;for(const id in left){if(!Object.prototype.hasOwnProperty.call(left,id))continue;leftCount+=1;if(!Object.prototype.hasOwnProperty.call(right,id)||left[id]!==right[id])return false}for(const id in right)if(Object.prototype.hasOwnProperty.call(right,id))rightCount+=1;return leftCount===rightCount}
encodeControlRowsForNative=rows=>(Array.isArray(rows)?rows:[]).map(row=>{const encoded=auValueFromPortable(row?.id,row?.value);return{id:String(row?.id||''),value:encoded}})
const slug=String(manifest?.nativeComposite?.slug||manifest?.surface?.slug||'')
const uiDiagnostics=installMoogUIDiagnostics({enabled:manifest?.surface?.uiDiagnostics===true,slug,request:requestRealtime})
if(manifest?.surface?.uiDiagnostics===true)controlDiagnostics=uiDiagnostics
if(!slug)throw new Error('moogAuv3.slugMissing')
useProductRuntimeControls=slug==='chronomorph'
globalThis.__PPW_MOOG_FAST_CONTROLS__=slug==='mavis'||slug==='mother32'||slug==='chronomorph'||slug==='tirante'
globalThis.__PPW_PLICATA_FAST_CONTROLS__=slug==='mavis'
const surfaceMap={
  mavis:{module:'mavis-objectual-v1.mjs',implementationId:'mavis-objectual-v1'},
  mother32:{module:'mother32-objectual-v1.mjs',implementationId:'mother32-objectual-v1'},
  dfam:{module:'dfam-objectual-v1.mjs',implementationId:'dfam-objectual-v1'},
  subharmonicon:{module:'subharmonicon-objectual-v1.mjs',implementationId:'subharmonicon-objectual-v1'},
  spectravox:{module:'spectravox-objectual-v1.mjs',implementationId:'spectravox-objectual-v1'},
  labyrinth:{module:'labyrinth-objectual-v1.mjs',implementationId:'labyrinth-objectual-v1'},
  neritic:{module:'neritic-r12-product-v1.mjs',implementationId:'neritic-r12-product-v1'},
  chronomorph:{module:'chronomorph-ascii-v1.mjs',implementationId:'chronomorph-ascii-v1'},
  tirante:{module:'tirante-objectual-v1.mjs',implementationId:'tirante-objectual-v1'},
}
const surfaceInfo=surfaceMap[slug]
if(!surfaceInfo)throw new Error(`moogAuv3.surfaceUnsupported:${slug}`)
const fixedCanvasWebScale=globalThis.__JUCE__?.initialisationData?.ppwFixedCanvasWebScale?.[0]===true
document.title=String(manifest?.nativeComposite?.releaseName||manifest?.component?.name||'TRAMBUSTISSIMO')
document.documentElement.dataset.ppwCenterSurface=manifest?.surface?.centerInHost===true?'1':'0'
document.documentElement.dataset.ppwAuv3DesktopScale=manifest?.surface?.desktopScaleOnly===true||fixedCanvasWebScale?'1':'0'

const contract=await fetch(`./contracts/${slug}.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`contractHttp:${r.status}`);return r.json()})
const patchContract=contract?.semantic?.capabilities?.patchbay
  ?await fetch('./patch-editor-contract-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`patchContractHttp:${r.status}`);return r.json()})
  :{schema:'moog-patch-editor-contract-v1',slug,targets:[],jacks:[]}
await import(`./surfaces/${surfaceInfo.module}`)

let nativeSnapshot=await host.request('snapshot')
let liveParameterWireCache=nativeSnapshot?.parameters&&typeof nativeSnapshot.parameters==='object'?nativeSnapshot.parameters:null,liveParameterWireCacheHits=0
let temporaCatalog=null,temporaBank=null,temporaNativeBank=null,temporaProductRuntime=null,temporaRevision=0
const mergeTemporaProductSnapshot=product=>{
  if(slug!=='chronomorph'||!product||typeof product!=='object')return product
  temporaProductRuntime=product
  const controls=product.controlValues&&typeof product.controlValues==='object'?product.controlValues:{},portableControls=Object.fromEntries(Object.entries(controls).filter(([id])=>manifestParameterById.has(String(id))))
  nativeSnapshot={...(nativeSnapshot||{}),parameters:{...(nativeSnapshot?.parameters||{}),...controls},productState:{...(nativeSnapshot?.productState||{}),controls:{...(nativeSnapshot?.productState?.controls||{}),...portableControls}}}
  temporaRevision+=1
  return product
}
const readTemporaProductSnapshot=async()=>{
  if(slug!=='chronomorph')return null
  const result=await requestRealtime('runtimeProductSnapshot')
  if(result?.accepted!==true||!result.snapshot)throw new Error('temporaAuv3.productSnapshotUnavailable')
  return mergeTemporaProductSnapshot(result.snapshot)
}
if(slug==='chronomorph'){
  ;[temporaCatalog,temporaBank,temporaNativeBank]=await Promise.all([
    fetch('./tempora-source-catalog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`temporaCatalogHttp:${r.status}`);return r.json()}),
    fetch('./tempora-complete-bank.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`temporaBankHttp:${r.status}`);return r.json()}),
    fetch('./tempora-native-bank.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`temporaNativeBankHttp:${r.status}`);return r.json()}),
  ])
  if(temporaCatalog?.modelCount!==21||temporaCatalog?.pairCount!==441||temporaBank?.presetCount!==103||temporaNativeBank?.presetCount!==103)throw new Error('temporaAuv3.catalogIdentityInvalid')
  await readTemporaProductSnapshot()
}
let mounted=null
let txSerial=0
let polling=false
let telemetryPolling=false
let livePollTicket=0,telemetryPollTicket=0
let telemetryRevision=0
let telemetryVisualTicket=0,telemetryVisualQueued=false
const telemetrySubscribers=new Set()
let destroyed=false
let activeTransactions=0
const gestureLeases=new Map(),leaseEndpoints=meta=>[...(Array.isArray(meta?.endpointIds)?meta.endpointIds:[]),...(meta?.endpointId?[meta.endpointId]:[])].map(String).filter(id=>id.startsWith('control.')||id.startsWith('macro.')),noteGestureValue=(transaction,endpointId,value)=>{const tx=String(transaction||''),id=String(endpointId||''),number=Number(value),lease=gestureLeases.get(tx);if(!lease||!Number.isFinite(number)||(id&&!id.startsWith('control.')&&!id.startsWith('macro.')))return;lease.endpoints.add(id);lease.values.set(id,number)},activeGestureValues=()=>{const result={};for(const lease of gestureLeases.values())for(const id of lease.endpoints){const value=lease.values.get(id);if(Number.isFinite(value))result[id]=value}return result}
const resetInteractionGuard=()=>{activeTransactions=0;gestureLeases.clear();controlInteractionHotUntil=0;return true}
let macroCommitTimer=0
let timelineEpoch=1
let controlInteractionHotUntil=0
const pendingMacroCommits=new Map()
const optimisticControlValues=new Map()
const OPTIMISTIC_CONTROL_TTL_MS=1500

const semantic=clone(contract.semantic)
const flavourControlIds=Array.isArray(manifest?.surface?.flavourControlIds)?manifest.surface.flavourControlIds.map(String):[]
if(flavourControlIds.length){
  const semanticControls=Array.isArray(semantic.controls)?semantic.controls:[],known=new Set(semanticControls.map(row=>String(row.id||'')))
  const endpoints=new Set(Array.isArray(semantic.surfaceApi?.endpointIds)?semantic.surfaceApi.endpointIds.map(String):[])
  const formatFor=spec=>{const unit=String(spec?.unitName||spec?.unit||'').toLowerCase();if(unit.includes('hz'))return'hz';if(unit.includes('db'))return'db';if(unit.includes('ms'))return'ms';if(unit.includes('semitone'))return'semitones';return'unit'}
  for(const id of flavourControlIds){
    if(known.has(id))continue
    const spec=manifestParameterById.get(id)
    if(!spec)throw new Error(`moogAuv3.flavourControlMissing:${id}`)
    const minimum=Number(spec.portableMinimum??spec.minimum),maximum=Number(spec.portableMaximum??spec.maximum),def=Number(spec.portableDefaultValue??spec.defaultValue)
    if(![minimum,maximum,def].every(Number.isFinite)||minimum>maximum||def<minimum||def>maximum)throw new Error(`moogAuv3.flavourControlRangeInvalid:${id}`)
    const row={id,label:String(spec.label||id).replace(/[-_]+/g,' ').toUpperCase(),minimum,maximum,default:def,format:formatFor(spec)}
    if(String(spec.scaling||'').toLowerCase()==='stepped')row.quantize=1
    const values=Array.isArray(spec.portableValues)?spec.portableValues.map(Number).filter(Number.isFinite):[]
    if(values.length)row.choices=values.map(value=>({value,label:String(value)}))
    semanticControls.push(row);known.add(id);endpoints.add(`control.${id}`)
  }
  semantic.controls=semanticControls
  semantic.surfaceApi={...(semantic.surfaceApi||{}),endpointIds:[...endpoints]}
}
const macroById=new Map((semantic.macros||[]).map(row=>[String(row.id),row]))
const controlById=new Map((semantic.controls||[]).map(row=>[String(row.id),row]))
const hostControlById=new Map((manifest.hostParameters||[]).map(row=>[String(row.id),row]))
const presetById=new Map((manifest.presets||[]).map(row=>[String(row.id),row]))
const signatureMacro=(semantic.macros||[]).find(row=>row?.signature===true)||null
const signatureProductKey=String(manifest?.nativeComposite?.productKey||contract?.runtimeBinding?.productKey||'')
const signatureStorageBase=`trambustissimo:${String(manifest?.productId||slug)}:${signatureProductKey||slug}`
const signatureStateKey=`${signatureStorageBase}:signature-macro-state-v1`
const signatureBankKey=`${signatureStorageBase}:signature-macro-presets-v1`
let signatureTargets=clone(signatureMacro?.targets||[]),signaturePresetId='factory',signatureDirty=false,signatureRevision=1,signaturePresetRows=[]
let signatureValue=Number(nativeSnapshot?.productState?.macros?.[signatureMacro?.id]??signatureMacro?.default??0)
let signatureBaseline={}
const normalizeSignatureTargets=(rows,{allowEmpty=false}={})=>{
  if(!signatureMacro)throw new Error('signature macro unavailable')
  if(!Array.isArray(rows)||rows.length>32||(!allowEmpty&&rows.length<1))throw new Error('signature targets invalid')
  const result=[],seen=new Set()
  for(const raw of rows){const controlId=String(raw?.controlId||''),spec=controlById.get(controlId);if(!controlId||!spec||seen.has(controlId))throw new Error(`signature target invalid:${controlId||'missing'}`);const minimum=Number(raw?.minimum),maximum=Number(raw?.maximum),specMinimum=Number(spec.minimum),specMaximum=Number(spec.maximum);if(![minimum,maximum,specMinimum,specMaximum].every(Number.isFinite)||minimum<specMinimum-1e-9||minimum>specMaximum+1e-9||maximum<specMinimum-1e-9||maximum>specMaximum+1e-9)throw new Error(`signature range invalid:${controlId}`);const mapping=String(raw?.mapping||'linear');if(!['linear','log'].includes(mapping)||(mapping==='log'&&(minimum<=0||maximum<=0)))throw new Error(`signature mapping invalid:${controlId}`);seen.add(controlId);result.push({controlId,minimum,maximum,mapping})}
  return result
}
const signatureFactoryTargets=()=>signatureMacro?normalizeSignatureTargets(signatureMacro.targets||[]):[]
const signatureSnapshot=()=>signatureMacro?{schema:'moog-signature-macro-state-v1',productId:String(manifest?.productId||''),productKey:signatureProductKey,macroId:String(signatureMacro.id),label:String(signatureMacro.label||signatureMacro.id),value:Math.max(0,Math.min(1,Number(signatureValue)||0)),activePresetId:String(signaturePresetId||'custom'),dirty:signatureDirty===true,revision:Number(signatureRevision||0),targets:clone(signatureTargets),presets:[{id:'factory',name:`${String(signatureMacro.label||signatureMacro.id)} · FACTORY`,kind:'factory',targetCount:(signatureMacro.targets||[]).length},...signaturePresetRows.map(row=>({id:row.id,name:row.name,kind:'user',targetCount:row.targets.length,updatedAt:row.updatedAt||''}))]}:null
const validSignaturePresetRows=value=>{if(!signatureMacro||!Array.isArray(value))return[];const result=[];for(const raw of value.slice(0,64)){try{if(raw?.schema!=='moog-signature-macro-preset-v1'||String(raw.productId||'')!==String(manifest?.productId||'')||String(raw.productKey||'')!==signatureProductKey||String(raw.macroId||'')!==String(signatureMacro.id))continue;const id=String(raw.id||''),name=String(raw.name||'').trim(),value=Math.max(0,Math.min(1,Number(raw.value??signatureMacro.default??0)));if(!id||!name||new TextEncoder().encode(name).length>128||result.some(row=>row.id===id||row.name.toLocaleLowerCase()===name.toLocaleLowerCase()))continue;result.push({...raw,id,name,value,targets:normalizeSignatureTargets(raw.targets||[])})}catch{}}return result}
const loadHostJson=async key=>{try{const raw=await host.request('stateLoad',{key});return typeof raw==='string'&&raw?JSON.parse(raw):null}catch{return null}}
const saveHostJson=async(key,value,{musical=false}={})=>{const result=await host.request('stateSave',{key,json:JSON.stringify(value),musical:musical===true});if(result?.accepted===false)throw new Error('host state write rejected');return true}
const persistSignatureBank=async()=>saveHostJson(signatureBankKey,signaturePresetRows)
const persistSignatureState=async()=>saveHostJson(signatureStateKey,{schema:'moog-signature-macro-active-v1',productId:String(manifest?.productId||''),productKey:signatureProductKey,macroId:String(signatureMacro?.id||''),activePresetId:String(signaturePresetId||'custom'),dirty:signatureDirty===true,targets:clone(signatureTargets)},{musical:true})
const initializeSignatureState=async()=>{
  if(!signatureMacro)return
  signatureTargets=signatureFactoryTargets();signaturePresetId='factory';signatureDirty=false;signatureRevision=1
  signaturePresetRows=validSignaturePresetRows(await loadHostJson(signatureBankKey))
  const raw=await loadHostJson(signatureStateKey)
  if(raw?.schema==='moog-signature-macro-active-v1'&&String(raw.productId||'')===String(manifest?.productId||'')&&String(raw.productKey||'')===signatureProductKey&&String(raw.macroId||'')===String(signatureMacro.id)){try{signatureTargets=normalizeSignatureTargets(raw.targets||[]);const active=String(raw.activePresetId||'custom');signaturePresetId=active==='factory'||signaturePresetRows.some(row=>row.id===active)?active:'custom';signatureDirty=raw.dirty===true||signaturePresetId==='custom'}catch{}}
}
await initializeSignatureState()

let generatedPresetPresentation=null
const currentPresetView=()=>{const current=nativeSnapshot?.currentPreset||{};if(generatedPresetPresentation&&String(current?.kind||'').toLowerCase()==='custom'&&!String(current?.id||''))return{...current,...generatedPresetPresentation,kind:'custom',id:'',number:null,dirty:true,generated:true};return current}
const stateView=()=>({
  controls:{...(nativeSnapshot?.productState?.controls||{}),...(decodeNativeParameters(nativeSnapshot?.parameters)||{})},
  macros:{...(nativeSnapshot?.productState?.macros||{})},
  productState:nativeSnapshot?.productState||{},
  factoryPresets:nativeSnapshot?.factoryPresets||[],
  userPresets:nativeSnapshot?.userPresets||[],
  currentPreset:currentPresetView(),
  supportsUserPresets:nativeSnapshot?.supportsUserPresets===true,
  userPresetStoreError:String(nativeSnapshot?.userPresetStoreError||''),
  runtime:nativeSnapshot?.runtime||{},
  hostTransport:nativeSnapshot?.hostTransport||{},
  signatureMacro:signatureSnapshot(),
})
let local=stateView()

const rememberOptimisticControl=(id,value)=>optimisticControlValues.set(String(id),{value:Number(value),at:performance.now()})
const reconcileOptimisticControls=parameters=>{
  const source=parameters&&typeof parameters==='object'?parameters:{}
  if(!optimisticControlValues.size)return source
  const merged={...source},now=performance.now()
  for(const [id,row] of optimisticControlValues){
    const incoming=Number(merged[id])
    if(Number.isFinite(incoming)&&Math.abs(incoming-row.value)<1e-6){optimisticControlValues.delete(id);continue}
    if(now-row.at<OPTIMISTIC_CONTROL_TTL_MS)merged[id]=row.value
    else optimisticControlValues.delete(id)
  }
  return merged
}
const clearOptimisticControls=()=>optimisticControlValues.clear()
const optimisticControlView=()=>Object.fromEntries([...optimisticControlValues].map(([id,row])=>[id,row.value]))
const sameRecord=(left,right,tolerance=0)=>{
  const a=left&&typeof left==='object'?left:{},b=right&&typeof right==='object'?right:{},aKeys=Object.keys(a),bKeys=Object.keys(b)
  if(aKeys.length!==bKeys.length)return false
  for(const key of aKeys){if(!Object.prototype.hasOwnProperty.call(b,key))return false;const av=a[key],bv=b[key];if(tolerance>0&&Number.isFinite(Number(av))&&Number.isFinite(Number(bv))){if(Math.abs(Number(av)-Number(bv))>tolerance)return false}else if(av!==bv)return false}
  return true
}

const applyNativeSnapshot=next=>{
  if(!next||typeof next!=='object')return
  const wireParameters=next.parameters&&typeof next.parameters==='object'?next.parameters:null
  const parameters=reconcileOptimisticControls(decodeNativeParameters(wireParameters))
  if(wireParameters)liveParameterWireCache=wireParameters
  const productState=clone(next.productState||{})
  if(productState.controls)productState.controls={...productState.controls,...optimisticControlView()}
  nativeSnapshot={...next,parameters,productState}
  if(next?.currentPreset&&['factory','user'].includes(String(next.currentPreset.kind||'').toLowerCase()))generatedPresetPresentation=null
  if(signatureMacro&&Number.isFinite(Number(next?.productState?.macros?.[signatureMacro.id])))signatureValue=Number(next.productState.macros[signatureMacro.id])
  telemetryRevision+=1
  local=stateView()
  mounted?.refresh?.(local)
}
const applyNativeLiveSnapshot=next=>{
  if(!next||typeof next!=='object')return
  const previousSnapshot=nativeSnapshot&&typeof nativeSnapshot==='object'?nativeSnapshot:{},previousCurrent=previousSnapshot.currentPreset||{},incomingCurrent=next.currentPreset||{}
  if(next?.currentPreset&&['factory','user'].includes(String(incomingCurrent.kind||'').toLowerCase()))generatedPresetPresentation=null
  const wireParameters=next.parameters&&typeof next.parameters==='object'?next.parameters:null,wireUnchanged=Boolean(wireParameters&&optimisticControlValues.size===0&&liveParameterWireCache&&sameNativeParameterWire(wireParameters,liveParameterWireCache))
  const parameters=wireUnchanged?previousSnapshot.parameters:wireParameters?reconcileOptimisticControls(decodeNativeParameters(wireParameters)):null
  if(wireParameters){if(wireUnchanged)liveParameterWireCacheHits+=1;else liveParameterWireCache=wireParameters}
  let parametersChanged=false,changedControlIds=[]
  if(parameters){
    const previousParameters=previousSnapshot.parameters&&typeof previousSnapshot.parameters==='object'?previousSnapshot.parameters:{},previousKeys=Object.keys(previousParameters),parameterKeys=Object.keys(parameters)
    parametersChanged=previousKeys.length!==parameterKeys.length
    for(const id of parameterKeys){const incoming=Number(parameters[id]),previous=Number(previousParameters[id]),changed=!Object.prototype.hasOwnProperty.call(previousParameters,id)||!(Number.isFinite(incoming)&&Number.isFinite(previous)?Math.abs(incoming-previous)<=1e-6:parameters[id]===previousParameters[id]);if(changed){parametersChanged=true;if(!Number.isFinite(previous)||Math.abs(incoming-previous)>1e-6)changedControlIds.push(id)}}
  }
  const currentPresetSignal=next.currentPreset!==undefined,currentPresetPresent=Boolean(next.currentPreset),dirtySignal=next.presetDirty!==undefined
  let nextCurrent=previousCurrent
  if(currentPresetPresent){nextCurrent={...previousCurrent,...incomingCurrent};if(dirtySignal)nextCurrent.dirty=next.presetDirty===true}
  else if(dirtySignal&&previousSnapshot.currentPreset)nextCurrent={...previousCurrent,dirty:next.presetDirty===true}
  const presetChanged=currentPresetSignal&&!sameRecord(previousCurrent,nextCurrent)
    ||dirtySignal&&Boolean(previousSnapshot.presetDirty)!==Boolean(next.presetDirty)
  nativeSnapshot=previousSnapshot
  if(parameters)nativeSnapshot.parameters=parameters
  if(next.runtime)nativeSnapshot.runtime=next.runtime
  if(next.hostTransport)nativeSnapshot.hostTransport=next.hostTransport
  if(next.sequencerTransport)nativeSnapshot.sequencerTransport=next.sequencerTransport
  if(currentPresetPresent||dirtySignal&&previousSnapshot.currentPreset)nativeSnapshot.currentPreset=nextCurrent
  if(dirtySignal)nativeSnapshot.presetDirty=next.presetDirty
  if(next.runtime)telemetryRevision+=1
  // No state clone, signature rebuild or DOM refresh for an unchanged poll.
  if(parametersChanged||presetChanged)local=stateView()
  else{
    if(next.runtime)local.runtime=next.runtime
    if(next.hostTransport)local.hostTransport=next.hostTransport
  }
  // Host transport and runtime telemetry are consumed by the shared visual ticker. Rebuilding
  // every bound control for those high-frequency changes fights an active WKWebView gesture.
  if(parametersChanged||presetChanged)mounted?.refresh?.(local,{changedControlIds,presetChanged})
}
// This is a data-revision notification, not a rendering clock. Gating it on
// rAF stranded new playhead data behind the same late frame it should update.
// Coalesce same-task arrivals; each view still owns bounded local visual work.
const cancelTelemetryVisual=()=>{telemetryVisualTicket+=1;telemetryVisualQueued=false}
const deliverTelemetryVisual=()=>{
  telemetryVisualQueued=false
  if(destroyed||!isSurfacePresented())return
  for(const callback of telemetrySubscribers)callback()
}
const scheduleTelemetryVisual=()=>{
  if(telemetryVisualQueued||!isSurfacePresented()||!telemetrySubscribers.size)return
  telemetryVisualQueued=true
  const ticket=++telemetryVisualTicket
  queueMicrotask(()=>{if(ticket===telemetryVisualTicket)deliverTelemetryVisual()})
}
const applyNativeTelemetry=telemetry=>{
  if(!telemetry||typeof telemetry!=='object')return
  nativeSnapshot=mutableRecord(nativeSnapshot);nativeSnapshot.runtime=telemetry
  local=mutableRecord(local);local.runtime=telemetry
  telemetryRevision+=1
  scheduleTelemetryVisual()
}
const reportError=error=>showStatus(`AU · ${String(error?.message||error||'error')}`)
const fire=request=>Promise.resolve(request).then(value=>{
  if(value?.snapshot)applyNativeSnapshot(value.snapshot)
  return value
}).catch(error=>{reportError(error);return null})
const sendFast=(op,payload)=>{
  fire(host.request(op,payload))
  return true
}
const flushPendingControlWrites=()=>{fire(controlMailbox.flush());return true}
const scheduleControlWrite=(id,value)=>{
  controlMailbox.push(String(id),Number(value))
  return true
}
const mutableRecord=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const ensureHotStateRecords=()=>{
  local.controls=mutableRecord(local.controls)
  local.macros=mutableRecord(local.macros)
  local.productState=mutableRecord(local.productState)
  local.productState.controls=mutableRecord(local.productState.controls)
  local.productState.macros=mutableRecord(local.productState.macros)
  nativeSnapshot=mutableRecord(nativeSnapshot)
  nativeSnapshot.parameters=mutableRecord(nativeSnapshot.parameters)
  nativeSnapshot.productState=mutableRecord(nativeSnapshot.productState)
  nativeSnapshot.productState.controls=mutableRecord(nativeSnapshot.productState.controls)
  nativeSnapshot.productState.macros=mutableRecord(nativeSnapshot.productState.macros)
}
const writeLocalControl=(controlId,number)=>{
  ensureHotStateRecords()
  const portable=manifestParameterById.has(String(controlId))
  local.controls[controlId]=number
  if(portable)local.productState.controls[controlId]=number
  // Keep the native-cache side optimistic too. stateView() is rebuilt from this
  // cache on every live poll; leaving it stale allowed a 120 ms poll to snap an
  // actively dragged TESSERA control (especially IGNITE) back to its old value.
  // These maps are private mutable caches. Updating one key avoids copying the
  // complete parameter/product state (and its JSON clone) on every touch frame.
  nativeSnapshot.parameters[controlId]=number
  if(portable)nativeSnapshot.productState.controls[controlId]=number
  rememberOptimisticControl(controlId,number)
}
const flushMacroCommits=()=>{
  if(macroCommitTimer){clearTimeout(macroCommitTimer);macroCommitTimer=0}
  if(!pendingMacroCommits.size)return true
  const rows=[...pendingMacroCommits.values()]
  pendingMacroCommits.clear()
  for(const payload of rows)sendFast('setMacro',payload)
  return true
}
const scheduleMacroCommit=payload=>{
  pendingMacroCommits.set(String(payload.id),payload)
  if(activeTransactions===0){if(macroCommitTimer)clearTimeout(macroCommitTimer);macroCommitTimer=setTimeout(flushMacroCommits,50)}
  return true
}

const hostTransportView=()=>{
  const raw=nativeSnapshot?.hostTransport||{}
  return{available:raw.available===true,playing:raw.playing===true,recording:raw.recording===true,cycling:raw.cycling===true,tempo:Number.isFinite(Number(raw.tempo))?Number(raw.tempo):120,beatPosition:Number.isFinite(Number(raw.beatPosition))?Number(raw.beatPosition):0,samplePosition:Number.isFinite(Number(raw.samplePosition))?Number(raw.samplePosition):0,sequencerTransport:clone(nativeSnapshot?.sequencerTransport||{supported:false})}
}
const endpointValue=id=>{
  const key=String(id||'')
  if(key.startsWith('control.'))return local.controls[key.slice(8)]??null
  if(key.startsWith('macro.'))return local.macros[key.slice(6)]??null
  return null
}
const mapMacroValue=(target,value)=>{
  const lo=Number(target.minimum),hi=Number(target.maximum),v=Math.max(0,Math.min(1,Number(value)))
  if(target.mapping==='log'&&lo>0&&hi>0)return Math.exp(Math.log(lo)+(Math.log(hi)-Math.log(lo))*v)
  return lo+(hi-lo)*v
}
const currentControlValue=id=>Number(local.controls?.[id]??nativeSnapshot?.parameters?.[id]??nativeSnapshot?.productState?.controls?.[id])
const captureSignatureBaseline=targets=>{
  const baseline={}
  for(const target of targets){const id=String(target.controlId||''),value=currentControlValue(id);if(id&&Number.isFinite(value))baseline[id]=value}
  return baseline
}
const mapSignatureValue=(target,value,baseline)=>{
  const wet=Math.max(0,Math.min(1,Number(value))),transformed=mapMacroValue(target,wet)
  return baseline+(transformed-baseline)*wet
}
const writeMacro=(macroId,value)=>{
  const macro=macroById.get(macroId)
  if(!macro)return false
  const isSignature=signatureMacro&&String(macroId)===String(signatureMacro.id)
  const targets=isSignature?signatureTargets:(macro.targets||[]),mapped={}
  const number=Math.max(0,Math.min(1,Number(value)))
  if(!Number.isFinite(number))return false
  if(isSignature){
    const previous=Math.max(0,Math.min(1,Number(signatureValue)||0))
    if(number>0&&previous<=0)signatureBaseline=captureSignatureBaseline(targets)
    if(number<=0){
      if(previous>0){for(const target of targets){const id=String(target.controlId||''),baseline=Number(signatureBaseline[id]);if(id&&Number.isFinite(baseline))mapped[id]=baseline}}
    }else{
      for(const target of targets){const id=String(target.controlId||'');if(!id)continue;let baseline=Number(signatureBaseline[id]);if(!Number.isFinite(baseline)){baseline=currentControlValue(id);if(Number.isFinite(baseline))signatureBaseline[id]=baseline}if(Number.isFinite(baseline))mapped[id]=mapSignatureValue(target,number,baseline)}
    }
    signatureValue=number
  }else for(const target of targets){const id=String(target.controlId||'');if(id)mapped[id]=mapMacroValue(target,number)}
  ensureHotStateRecords()
  local.macros[macroId]=number
  local.productState.macros[macroId]=number
  nativeSnapshot.productState.macros[macroId]=number
  for(const [id,mappedValue] of Object.entries(mapped)){
    local.controls[id]=mappedValue
    local.productState.controls[id]=mappedValue
    nativeSnapshot.parameters[id]=mappedValue
    nativeSnapshot.productState.controls[id]=mappedValue
    rememberOptimisticControl(id,mappedValue)
    scheduleControlWrite(id,mappedValue)
  }
  // Signature macros optimistically update the native cache before the next poll.
  // Without an immediate scoped refresh, that poll sees no parameter delta and the
  // physical target controls stay visually stale even though DSP/native state moved.
  // Refresh only the mapped bindings so an active macro gesture stays lightweight.
  if(isSignature&&Object.keys(mapped).length)mounted?.refresh?.(local,{changedControlIds:Object.keys(mapped),presetChanged:false})
  if(!isSignature||Object.keys(mapped).length)scheduleMacroCommit({id:macroId,value:number,controls:mapped})
  if(isSignature&&number<=0)signatureBaseline={}
  return true
}
const writeEndpoint=(id,value)=>{
  const key=String(id||''),number=Number(value)
  if(!Number.isFinite(number))return false
  if(key.startsWith('control.')){
    const controlId=key.slice(8)
    writeLocalControl(controlId,number)
    controlInteractionHotUntil=performance.now()+180
    scheduleControlWrite(controlId,number)
    return true
  }
  if(key.startsWith('macro.'))return writeMacro(key.slice(6),number)
  if(key.startsWith('ingress.')){
    const ingressId=key.slice(8)
    if(!ingressId)return false
    fire(requestRealtime('setControlIngresses',{rows:[{id:ingressId,value:number}]}))
    return true
  }
  return false
}

const iosWebKit=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
const fixedSurface=manifest?.surface?.fixedSurfaceSize===true||(manifest?.surface?.iosNativePresentationScale===true&&iosWebKit)
const viewport=()=>{
  if(globalThis.__ppwNativePresentationViewport)return globalThis.__ppwNativePresentationViewport
  const fixedWidth=Math.max(1,Math.round(Number(manifest?.surface?.layoutWidth)||Number(manifest?.surface?.preferredWidth)||1140)),fixedHeight=Math.max(1,Math.round(Number(manifest?.surface?.layoutHeight)||Number(manifest?.surface?.preferredHeight)||522))
  const width=fixedSurface?fixedWidth:Math.max(1,Math.round(innerWidth||Number(manifest?.surface?.preferredWidth)||864)),height=fixedSurface?fixedHeight:Math.max(1,Math.round(innerHeight||Number(manifest?.surface?.preferredHeight)||396)),coarse=matchMedia?.('(pointer: coarse)')?.matches===true
  // Apple plug-ins deliberately expose only the desktop hardware layout. Host resizing
  // changes one presentation scale; it must never cross responsive breakpoints and reflow
  // the panel after the user releases the resize gesture.
  return{mode:'expanded',width,height,pixelRatio:Number(devicePixelRatio||1),pointerCapabilities:{coarse,fine:!coarse,hover:!coarse,multiTouch:coarse},reducedMotion:matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true,safeInsets:{top:0,right:0,bottom:0,left:0}}
}

const buildCompatibility=()=>{
  const targets=Array.isArray(patchContract.targets)?patchContract.targets:[]
  const targetOrder=targets.map(row=>String(row.id||''))
  const targetStatus=targets.map(row=>Array.isArray(row.options)&&row.options.length?'editable':'blocked')
  const outputs=(semantic.capabilities?.patchbay?.jacks||[]).filter(row=>row.direction==='output')
  const validMasks={},blockedMasks={},blockedReasons={}
  for(const source of outputs){
    let valid=0n,blocked=0n
    targets.forEach((target,index)=>{
      const bit=1n<<BigInt(index),ok=(target.options||[]).some(option=>String(option.id||'')===`source:${source.id}`)
      if(ok)valid|=bit
      else{blocked|=bit;blockedReasons[`${source.id}>${target.id}`]='route unavailable in native patch compiler'}
    })
    validMasks[source.id]=valid.toString(16)
    blockedMasks[source.id]=blocked.toString(16)
  }
  return{schema:'trambustissimo-patch-compatibility-v1',slug,targetOrder,targetStatus,validMasks,blockedMasks,blockedReasons}
}
const compatibility=buildCompatibility()

let temporaCurrentPresetId=''
let temporaProjectShadow=null
const normalizeTemporaProject=(raw,fallbackSequencer=null)=>{
  let value=raw
  if(typeof value==='string'){try{value=JSON.parse(value)}catch{return null}}
  if(value&&typeof value==='object'&&value.project&&typeof value.project==='object')value=value.project
  const sequencer=value?.sequencer&&typeof value.sequencer==='object'?value.sequencer:(fallbackSequencer&&typeof fallbackSequencer==='object'?fallbackSequencer:null)
  if(!sequencer||String(sequencer.schema||'')!=='chronomorph-sequencer-instance-v2')return null
  return{schema:'tempora-project-v1',version:1,sequencer:clone(sequencer)}
}
const temporaProjectAction=async(action,payload={})=>{
  if(slug!=='chronomorph')return null
  if(action==='tempora.project.sequencer.commit'){
    const project=normalizeTemporaProject(null,payload?.sequencer)
    if(!project)return{accepted:false,error:'tempora.project.sequencerInvalid'}
    temporaProjectShadow=project
    return{accepted:true,sequencer:clone(project.sequencer)}
  }
  if(action==='tempora.project.capture'){
    const project=normalizeTemporaProject(null,payload?.sequencer||temporaProjectShadow?.sequencer)
    return project?{accepted:true,project,sequencer:clone(project.sequencer)}:{accepted:false,error:'tempora.project.sequencerUnavailable'}
  }
  if(action==='tempora.project.validate'){
    const project=normalizeTemporaProject(payload?.project)
    return project?{accepted:true,project,sequencer:clone(project.sequencer)}:{accepted:false,error:'tempora.project.invalid'}
  }
  if(action==='tempora.project.import'){
    const project=normalizeTemporaProject(payload?.project)
    if(!project)return{accepted:false,error:'tempora.project.invalid'}
    const json=JSON.stringify(project.sequencer)
    if(new TextEncoder().encode(json).length>1024*1024)return{accepted:false,error:'tempora.project.tooLarge'}
    const saved=await host.request('stateSave',{key:'chronomorph.sequencer.v2',json,musical:true})
    if(saved?.accepted!==true)return{accepted:false,error:'tempora.project.persistRejected'}
    temporaProjectShadow=project
    return{accepted:true,project,sequencer:clone(project.sequencer)}
  }
  if(action==='tempora.project.load'){
    if(temporaProjectShadow)return{accepted:true,found:true,project:clone(temporaProjectShadow),sequencer:clone(temporaProjectShadow.sequencer)}
    return{accepted:false,found:false,error:'tempora.project.empty'}
  }
  if(action==='tempora.project.apply'){
    const project=normalizeTemporaProject(payload?.project)
    if(!project)return{accepted:false,error:'tempora.project.invalid'}
    temporaProjectShadow=project
    return{accepted:true,project,sequencer:clone(project.sequencer)}
  }
  return null
}
const temporaPairKey=(a,b)=>`${String(a)}\u0000${String(b)}`
const temporaPairs=()=>new Map((temporaCatalog?.pairs||[]).map(row=>[temporaPairKey(row.modelA,row.modelB),row]))
const temporaControlSpecs=()=>new Map((temporaCatalog?.controls||[]).map(row=>[String(row.id),row]))
const temporaNativePresets=()=>new Map((temporaNativeBank?.presets||[]).map(row=>[String(row.id),row]))
const temporaActiveSelection=()=>{
  const source=temporaProductRuntime?.selection||temporaProductRuntime?.requestedSelection||{}
  return{a:String(source.a||'point'),b:String(source.b||'point')}
}
const temporaSourceBase=()=>{
  if(slug!=='chronomorph'||!temporaCatalog||!temporaBank||!temporaProductRuntime)return{accepted:false,error:'temporaAuv3.runtimeUnavailable'}
  const selection=temporaActiveSelection(),pair=temporaPairs().get(temporaPairKey(selection.a,selection.b))
  if(!pair)return{accepted:false,error:'temporaAuv3.pairUnavailable'}
  const primaryCount=ids=>(ids||[]).filter(id=>!String(id).includes('-native-')).length
  const resourceAmplitudes=temporaProductRuntime.resourceAmplitudes&&typeof temporaProductRuntime.resourceAmplitudes==='object'?temporaProductRuntime.resourceAmplitudes:{}
  return{accepted:true,previewOnly:false,revision:temporaRevision,busy:Number(temporaProductRuntime.transitionRemaining||0)>0,lastError:'',runtimeSyncPending:false,runtimeResourceFresh:true,runtimeResourceCount:Object.keys(resourceAmplitudes).length,runtimeResourceIdentities:Object.entries(resourceAmplitudes).map(([lane,amplitude])=>({lane,amplitude:Number(amplitude)})),selection,currentPresetId:temporaCurrentPresetId,productId:String(pair.productId||''),productKey:String(pair.productKey||''),resourceBindingCount:(pair.resourceBindings||[]).length,resourceRecipeCount:(pair.resourceBindings||[]).length,modelCount:Number(temporaCatalog.modelCount||0),pairCount:Number(temporaCatalog.pairCount||0),presetCount:Number(temporaNativeBank.presetCount||0),catalogControlCount:Number(temporaCatalog.controlCount||(temporaCatalog.controls||[]).length),controlCounts:{primary:{a:primaryCount(pair.laneAControlIds),b:primaryCount(pair.laneBControlIds)},native:{a:(pair.laneAControlIds||[]).length,b:(pair.laneBControlIds||[]).length}}}
}
const temporaPage=(rows,payload={})=>{
  const total=rows.length,offset=Math.max(0,Math.min(total,Math.trunc(Number(payload?.offset)||0))),limit=Math.max(1,Math.min(64,Math.trunc(Number(payload?.limit)||64)))
  return{offset,total,rows:rows.slice(offset,offset+limit)}
}
const waitTemporaSelection=async(a,b)=>{
  let last=temporaProductRuntime
  for(let attempt=0;attempt<16;attempt+=1){
    last=await readTemporaProductSnapshot()
    const selection=last?.selection||{}
    if(String(selection.a)===String(a)&&String(selection.b)===String(b)&&Number(last?.transitionRemaining||0)===0)return last
    await new Promise(resolve=>setTimeout(resolve,5))
  }
  return last
}
const temporaSourceAction=async(action,payload={})=>{
  if(slug!=='chronomorph')return null
  if(!temporaProductRuntime)await readTemporaProductSnapshot()
  if(action==='tempora.source.catalog')return{...temporaSourceBase(),models:(temporaCatalog.models||[]).map(row=>({...row}))}
  if(action==='tempora.source.controls'){
    const lane=String(payload?.lane||'');if(!['a','b'].includes(lane))return{accepted:false,error:'temporaAuv3.laneInvalid'}
    const base=temporaSourceBase();if(base.accepted!==true)return base
    const pair=temporaPairs().get(temporaPairKey(base.selection.a,base.selection.b)),ids=(lane==='a'?pair?.laneAControlIds:pair?.laneBControlIds)||[],includeNative=payload?.includeNative===true,specs=temporaControlSpecs(),values=temporaProductRuntime?.controlValues||{}
    const rows=ids.filter(id=>includeNative||!String(id).includes('-native-')).map(id=>{const spec=specs.get(String(id));return spec?{...spec,value:Number.isFinite(Number(values[id]))?Number(values[id]):Number(spec.default)}:null}).filter(Boolean)
    return{...base,...temporaPage(rows,payload),lane,includeNative}
  }
  if(action==='tempora.source.bank'){
    const rows=(temporaNativeBank.presets||[]).map(row=>({id:row.id,label:row.label,category:row.category,modelTerritory:row.modelTerritory,modelA:row.modelA,modelB:row.modelB,humanReview:row.humanReview}))
    return{...temporaSourceBase(),...temporaPage(rows,payload)}
  }
  if(action==='tempora.source.control'){
    const id=String(payload?.id||''),value=Number(payload?.value)
    if(!id||!Number.isFinite(value))return{accepted:false,error:'temporaAuv3.controlInvalid'}
    if(temporaProductRuntime?.controlValues)temporaProductRuntime.controlValues[id]=value
    writeLocalControl(id,value);temporaCurrentPresetId='';temporaRevision+=1
    scheduleControlWrite(id,value)
    return{...temporaSourceBase(),accepted:true,id,value,revision:temporaRevision}
  }
  if(action==='tempora.source.select'){
    const current=temporaActiveSelection(),modelA=String(payload?.modelA||current.a),modelB=String(payload?.modelB||current.b),fade=Number.isFinite(Number(payload?.sourceFadeMs))?Number(payload.sourceFadeMs):8
    if(!temporaPairs().has(temporaPairKey(modelA,modelB)))return{accepted:false,error:'temporaAuv3.selectionInvalid'}
    const result=await requestRealtime('runtimeProductCommand',{id:'tempora.source.select',arguments:{modelA,modelB,sourceFadeMs:fade}})
    if(result?.accepted!==true)return{accepted:false,error:'temporaAuv3.selectionRejected'}
    await waitTemporaSelection(modelA,modelB);temporaCurrentPresetId='';temporaRevision+=1
    return{...temporaSourceBase(),accepted:true}
  }
  if(action==='tempora.source.preset'){
    const preset=temporaNativePresets().get(String(payload?.id||''));if(!preset)return{accepted:false,error:'temporaAuv3.presetMissing'}
    for(const recipe of preset.resourceRecipes||[]){
      if(recipe?.kind!=='cycle-bank-harmonic-morph-v1'||Number(recipe.cycleCount)!==64||Number(recipe.cycleSamples)!==256||Number(recipe.sampleRate)!==48000)return{accepted:false,error:'temporaAuv3.resourceRecipeInvalid'}
      const lane=String(recipe.ingressId||'').startsWith('source-a-')?'a':String(recipe.ingressId||'').startsWith('source-b-')?'b':''
      const model=lane==='a'?String(preset.modelA):String(preset.modelB)
      const resource=await requestRealtime('runtimeProductCommand',{id:'tempora.source.resource',arguments:{lane,model,amplitude:Number(recipe.amplitude)}})
      if(resource?.accepted!==true)return{accepted:false,error:'temporaAuv3.resourceRejected'}
    }
    const rows=Array.isArray(preset.controls)?preset.controls:[]
    for(let offset=0;offset<rows.length;offset+=192){
      const result=await requestRealtime('runtimeProductControls',{rows:rows.slice(offset,offset+192)})
      if(result?.accepted!==true)return{accepted:false,error:`temporaAuv3.presetControlsRejected:${offset}`}
    }
    const selected=await requestRealtime('runtimeProductCommand',{id:'tempora.source.select',arguments:{modelA:preset.modelA,modelB:preset.modelB,sourceFadeMs:8}})
    if(selected?.accepted!==true)return{accepted:false,error:'temporaAuv3.presetSelectionRejected'}
    await waitTemporaSelection(preset.modelA,preset.modelB);temporaCurrentPresetId=String(preset.id);temporaRevision+=1
    const values=temporaProductRuntime?.controlValues||{};for(const row of rows){values[row.id]=Number(row.value);writeLocalControl(row.id,row.value)}
    nativeSnapshot={...(nativeSnapshot||{}),currentPreset:{kind:'custom',id:'',name:String(preset.label||preset.id),number:null,dirty:false,category:String(preset.category||'')},presetDirty:false}
    return{...temporaSourceBase(),accepted:true,presetId:preset.id,snapshot:clone(nativeSnapshot)}
  }
  return null
}

let plicataKeyboardMidiState={held:false,sourceNote:null,pitch:null,channel:0,velocity:0,mode:'off',xBendSemitones:0}
const clampMidi7=value=>Math.max(0,Math.min(127,Math.round(Number(value)||0)))
const pitchBendBytesForSemitones=(semitones,rangeSemitones=2,channel=0)=>{const range=Math.max(.01,Math.abs(Number(rangeSemitones)||2)),normalized=Math.max(-1,Math.min(1,(Number(semitones)||0)/range)),bend=Math.max(0,Math.min(16383,Math.round(8192+normalized*(normalized>=0?8191:8192)))),ch=Math.max(0,Math.min(15,Math.round(Number(channel)||0)));return[0xE0|ch,bend&0x7F,(bend>>7)&0x7F]}
const resetPlicataKeyboardMidiState=()=>{plicataKeyboardMidiState={held:false,sourceNote:null,pitch:null,channel:0,velocity:0,mode:'off',xBendSemitones:0}}
const plicataPitchFromPayload=(sourceNote,payload={})=>{
  const fallback=resolvePlicataKeyboardPitch({sourceNote,transposeSemitones:payload.transposeSemitones,tuningCents:payload.tuningCents,kbScale:payload.kbScale,rootNote:payload.rootNote??60,bendRangeSemitones:payload.bendRangeSemitones??2}),exact=Number(payload.exactSemitones)
  if(!Number.isFinite(exact))return fallback
  const bendRangeSemitones=Math.max(.01,Math.abs(Number(payload.bendRangeSemitones)||fallback.bendRangeSemitones||2)),midiNote=Number.isFinite(Number(payload.midiNote))?clampMidi7(payload.midiNote):clampMidi7(Math.round(exact)),residualSemitones=Number.isFinite(Number(payload.residualSemitones))?Number(payload.residualSemitones):exact-midiNote,bend14=Number.isFinite(Number(payload.bend14))?Math.max(0,Math.min(16383,Math.round(Number(payload.bend14)))):Math.max(0,Math.min(16383,Math.round(8192+Math.max(-1,Math.min(1,residualSemitones/bendRangeSemitones))*8192)))
  return{...fallback,...payload,sourceNote:clampMidi7(payload.sourceNote??sourceNote),exactSemitones:exact,tunedNote:Number.isFinite(Number(payload.tunedNote))?Number(payload.tunedNote):exact,midiNote,residualSemitones,bendRangeSemitones,bend14}
}

const adapter={
  read:id=>endpointValue(id),
  write:(id,value,transaction=null)=>{noteGestureValue(transaction,id,value);return writeEndpoint(id,value)},
  writeBatch(rows){
    if(!Array.isArray(rows)||rows.length<1)return false
    if(slug==='neritic'){
      const prepared=[]
      for(const row of rows){
        const key=String(row?.id||''),value=Number(row?.value)
        if(!key.startsWith('control.')||!Number.isFinite(value))return false
        const controlId=key.slice(8);writeLocalControl(controlId,value);prepared.push({id:controlId,value})
      }
      controlInteractionHotUntil=performance.now()+120
      return sendFast('setControls',{rows:prepared})
    }
    return rows.every(row=>writeEndpoint(row?.id,row?.value))
  },
  beginTransaction(meta={}){const id=`auv3-${++txSerial}`,endpoints=leaseEndpoints(meta),lease={meta:clone(meta),endpoints:new Set(endpoints),values:new Map()};for(const endpointId of endpoints){const value=Number(endpointValue(endpointId));if(Number.isFinite(value))lease.values.set(endpointId,value)}gestureLeases.set(id,lease);activeTransactions=gestureLeases.size;controlInteractionHotUntil=performance.now()+180;return id},
  endTransaction(id){const owned=gestureLeases.delete(String(id||''));activeTransactions=gestureLeases.size;if(!owned)return true;controlInteractionHotUntil=performance.now()+180;flushPendingControlWrites();if(activeTransactions===0)flushMacroCommits();return true},
  activeGestureValues,
  trigger(command,payload=null){
    const id=String(command||'')
    if(id==='keyboard.pitchBend'){
      const bendSemitones=Math.max(-24,Math.min(24,Number(payload?.bendSemitones)||0)),internalRange=24,active=plicataKeyboardMidiState
      fire(requestRealtime('midi',{bytes:pitchBendBytesForSemitones(bendSemitones,internalRange,0)}))
      if(active.held){active.xBendSemitones=bendSemitones;if(active.mode==='pitch-bend'){const residual=Number(active.pitch?.residualSemitones)||0,range=Number(active.pitch?.bendRangeSemitones)||2;fire(requestRealtime('midiOutputBatch',{messages:[pitchBendBytesForSemitones(residual+bendSemitones,range,active.channel??0)]}))}}
      return true
    }
    if(id==='keyboard.noteOn'||id==='keyboard.noteOff'){
      const sourceNote=clampMidi7(payload?.note??60),velocity=clampMidi7(payload?.velocity??108),channel=0,pitchPayload=payload?.pitch&&typeof payload.pitch==='object'?payload.pitch:{},mode=pitchPayload.externalMidi===true?'off':(['off','12tet','pitch-bend'].includes(String(pitchPayload.midiOutMode||''))?String(pitchPayload.midiOutMode):'pitch-bend'),pitch=plicataPitchFromPayload(sourceNote,pitchPayload),outputPitch=mode==='12tet'?plicataTwelveTetPitch(pitch):pitch
      if(id.endsWith('noteOn')){
        const inputBytes=[0x90,sourceNote,velocity],outputMessages=[]
        if(plicataKeyboardMidiState.held&&plicataKeyboardMidiState.pitch&&plicataKeyboardMidiState.mode!=='off')outputMessages.push(plicataNoteOffBytes(plicataKeyboardMidiState.pitch,plicataKeyboardMidiState.channel??channel))
        if(mode==='pitch-bend')outputMessages.push(...plicataPitchBendRangeMessages(outputPitch.bendRangeSemitones,channel),plicataPitchBendBytes(outputPitch,channel))
        if(mode!=='off')outputMessages.push(plicataNoteOnBytes(outputPitch,velocity,channel))
        plicataKeyboardMidiState={held:true,sourceNote,pitch:outputPitch,channel,velocity,mode,xBendSemitones:0}
        const externalBend=Number(pitchPayload.externalBendSemitones)||0,inputBend=externalBend?pitchBendBytesForSemitones(externalBend,24,channel):plicataNeutralBendBytes(channel)
        fire(requestRealtime('midi',{bytes:inputBend}));fire(requestRealtime('midi',{bytes:inputBytes}));if(outputMessages.length)fire(requestRealtime('midiOutputBatch',{messages:outputMessages}));return true
      }
      fire(requestRealtime('midi',{bytes:[0x80,sourceNote,0]}));fire(requestRealtime('midi',{bytes:plicataNeutralBendBytes(channel)}))
      if(!plicataKeyboardMidiState.held||plicataKeyboardMidiState.sourceNote!==sourceNote)return true
      const active=plicataKeyboardMidiState,outputMessages=[]
      if(active.mode!=='off')outputMessages.push(plicataNoteOffBytes(active.pitch||outputPitch,active.channel??channel))
      if(active.mode==='pitch-bend')outputMessages.push(plicataNeutralBendBytes(active.channel??channel))
      resetPlicataKeyboardMidiState();if(outputMessages.length)fire(requestRealtime('midiOutputBatch',{messages:outputMessages}));return true
    }
    if(id.startsWith('event.')){
      const eventId=id.slice(6),value=Number.isFinite(Number(payload?.value))?Number(payload.value):1,sampleOffset=Math.max(0,Math.min(65535,Math.trunc(Number(payload?.sampleOffset)||0)))
      if(!eventId)return false
      fire(requestRealtime('eventIngress',{id:eventId,value,sampleOffset}));return true
    }
    fire(host.request('action',{id,payload:clone(payload)}));return true
  },
  midi(endpointId,bytes,sampleOffset=0){void endpointId;void sampleOffset;fire(requestRealtime('midi',{bytes:Array.from(bytes||[])}));return true},
  transport:hostTransportView,
  telemetry:()=>local.runtime||{},
  telemetryRevision:()=>telemetryRevision,
  subscribeTelemetry(callback){telemetrySubscribers.add(callback);return()=>telemetrySubscribers.delete(callback)},
  resource:()=>undefined,
  viewport,
  async requestHostAction(id,payload=null){
    const action=String(id||'')
    if(action==='sequence.transport'){
      if(nativeSnapshot?.sequencerTransport?.supported!==true)return{accepted:true,state:{supported:false}}
      const result=await requestRealtime('sequencerTransport',payload||{})
      if(result?.state)nativeSnapshot={...(nativeSnapshot||{}),sequencerTransport:clone(result.state)}
      return result
    }
    if(action==='patch.edit'&&String(payload?.op||'')==='apply'&&nativeSnapshot?.capabilities?.patchStateApply===true){
      // A cable edit is a routing transaction, not a preset recall. Keep live
      // controls, pending gestures, MIDI/HOLD and sequence state authoritative.
      const requested=clone(payload?.state),result=await host.request('patchStateApply',{state:requested})
      if(result?.accepted!==true)return{accepted:false,patchAccepted:false,error:String(result?.error||'native patch rejected')}
      const patchState=clone(result.state||requested)
      nativeSnapshot={...(nativeSnapshot||{}),productState:{...(nativeSnapshot?.productState||{}),patchState},presetDirty:result.presetDirty!==false,currentPreset:{...(nativeSnapshot?.currentPreset||{}),dirty:result.presetDirty!==false}}
      local=stateView()
      return{accepted:true,patchAccepted:true,state:patchState}
    }
    if(action.startsWith('tempora.project.')){
      const result=await temporaProjectAction(action,payload&&typeof payload==='object'?payload:{})
      if(result)return result
    }
    if(action.startsWith('tempora.source.')){
      const result=await temporaSourceAction(action,payload&&typeof payload==='object'?payload:{})
      if(result)return result
    }
    if(action==='app.openExternalUrl'){
      const url=String(payload?.url||'').trim(),allowed=url==='mailto:support@alessandroguardascione.com'||/^https:\/\/(?:www\.)?alessandroguardascione\.com(?:\/|$)/i.test(url)
      if(!allowed)return{accepted:false,reason:'external-url-not-allowed'}
      const result=await host.request('openExternalUrl',{url})
      return{accepted:result?.accepted===true,reason:String(result?.reason||'')}
    }
    if(action==='runtime.panic'){
      clearOptimisticControls();resetPlicataKeyboardMidiState()
      flushPendingControlWrites();flushMacroCommits();controlInteractionHotUntil=performance.now()+240
      const result=await host.request('panic')
      if(result?.accepted===false)return{accepted:false,error:result?.receipt?.error||result?.error||'native MIDI panic rejected'}
      let receipt=result?.receipt||result||{}
      for(let attempt=0;attempt<24&&!['applied','quiescent'].includes(String(receipt?.state||''));attempt+=1){
        await new Promise(resolve=>setTimeout(resolve,8))
        const status=await host.request('panicStatus')
        if(status?.accepted===false)return{accepted:false,error:status?.receipt?.error||status?.error||'native MIDI panic status rejected'}
        receipt=status?.receipt||status||receipt
      }
      const requestedEpoch=Number(receipt?.requestedEpoch||0),appliedEpoch=Number(receipt?.appliedEpoch||0)
      const applied=['applied','quiescent'].includes(String(receipt?.state||''))&&requestedEpoch>0&&appliedEpoch>=requestedEpoch
      return{accepted:applied,receipt,error:applied?'':'native MIDI panic acknowledgement timed out'}
    }
    if(action==='tirante.performance.state'){
      if(slug!=='tirante')return{accepted:false,error:'tirante performance state unavailable'}
      const performance=payload?.state&&typeof payload.state==='object'&&!Array.isArray(payload.state)?clone(payload.state):null
      if(!performance||performance.schema!=='tirante-performance-adjunct-v1')return{accepted:false,error:'tirante performance state invalid'}
      const product=clone(local.productState||{})
      product.tirantePerformance=performance
      const result=await host.request('setProductState',{state:product})
      if(result?.snapshot)applyNativeSnapshot(result.snapshot)
      local=stateView()
      return{accepted:result?.accepted!==false,productState:clone(nativeSnapshot?.productState||product),error:result?.accepted===false?String(result?.error||'native TIRANTE performance state rejected'):''}
    }
    if(action==='product.generate'){
      clearOptimisticControls();flushPendingControlWrites();flushMacroCommits();controlInteractionHotUntil=performance.now()+300
      // GEN owns its own cutover. Queue one native panic before replacing product
      // state, but do not wait through the long external panic-status polling path:
      // native command ordering guarantees the panic reaches the render mailbox
      // before the generated state replacement.
      const panic=await host.request('panic')
      if(panic?.accepted===false)return{accepted:false,error:panic?.receipt?.error||panic?.error||'native GEN panic rejected'}
      // The generator needs the complete route rows, not the compact bit-mask
      // compatibility payload exposed to the patch UI.
      const generationSemantic=slug==='chronomorph'?{...semantic,controls:(semantic?.controls||[]).filter(row=>manifestParameterById.has(String(row?.id||'')))}:semantic
      const generated=generateMoogProductState({slug,semantic:generationSemantic,manifest,currentState:local.productState,compatibility:patchContract,seed:payload?.seed})
      const result=await host.request('setProductState',{state:generated.state})
      if(result?.snapshot)applyNativeSnapshot(result.snapshot)
      const accepted=result?.accepted!==false
      if(accepted){const identity=generated.identity||{};generatedPresetPresentation={name:String(identity.name||generated.generatedName||'GENERATED'),category:String(identity.category||''),tags:Array.isArray(identity.tags)?identity.tags.map(String):[],favorite:false,generated:true,seed:Number(generated.seed)>>>0};nativeSnapshot={...(nativeSnapshot||{}),presetDirty:true,currentPreset:{kind:'custom',id:'',...generatedPresetPresentation,number:null,dirty:true}};local=stateView();mounted?.refresh?.(local,{presetChanged:true})}
      return{accepted,generated:accepted,seed:generated.seed,parentPresetIds:generated.parentPresetIds,identity:generated.identity||null,generatedName:String(generated.generatedName||generated.identity?.name||''),snapshot:clone(nativeSnapshot),error:accepted?'':'native generated state rejected'}
    }
    if(action==='product.sequence.sync'){
      const next=await host.request('snapshot')
      if(next)applyNativeSnapshot(next)
      local=stateView();mounted?.refresh?.(local,{presetChanged:false})
      return{accepted:!!next,snapshot:clone(nativeSnapshot),error:next?'':'sequence scene snapshot unavailable'}
    }
    if(action==='product.sequence.apply'){
      const scene=payload?.scene&&typeof payload.scene==='object'?payload.scene:null,slot=Math.max(0,Math.min(6,Math.trunc(Number(payload?.slot)||0)))
      if(String(payload?.productSlug||'')!==slug)return{accepted:false,error:'sequence scene product mismatch'}
      if(!scene||scene.schema!=='moog-sequence-scene-v1'||!scene.controls||typeof scene.controls!=='object')return{accepted:false,error:'sequence scene invalid'}
      for(const [id,raw] of Object.entries(scene.controls)){const spec=controlById.get(String(id)),value=Number(raw);if(!spec||!Number.isFinite(value))return{accepted:false,error:`sequence control invalid:${String(id)}`}}
      for(const [id,value] of Object.entries(scene.extensions||{}))if(id!=='mutavia.sequence.v1'||!value||typeof value!=='object')return{accepted:false,error:`sequence extension invalid:${String(id)}`}
      const soundState=scene.soundState&&typeof scene.soundState==='object'&&!Array.isArray(scene.soundState)?clone(scene.soundState):null
      if(soundState&&soundState.schema!=='moog-eurorack-product-state-v2')return{accepted:false,error:'sequence sound state invalid'}
      if(soundState){soundState.sourcePresetId=String(soundState.sourcePresetId||'');soundState.controls={...(soundState.controls||{}),...clone(scene.controls)};if(Object.keys(scene.extensions||{}).length)soundState.extensions={...(soundState.extensions||{}),...clone(scene.extensions)}}
      const changedControlIds=[...new Set([...Object.keys(soundState?.controls||{}),...Object.keys(scene.controls)])]
      await controlMailbox.flush();flushMacroCommits();controlInteractionHotUntil=performance.now()+160
      let result=null
      if(soundState){result=await host.request('setProductState',{state:soundState,transitionFadeMs:4});if(result?.accepted===false)return{accepted:false,error:String(result?.error||'sequence full sound state rejected')}}
      else result=globalThis.__PPW_ANDROID_NATIVE_HOST__===true
        ?await host.request('applySequenceScene',{scene:clone(scene)})
        :await host.request('sequenceSceneApply',{index:slot})
      if(result?.snapshot)applyNativeSnapshot(result.snapshot)
      const accepted=result?.accepted!==false
      if(accepted){local=stateView();mounted?.refresh?.(local,soundState?null:{presetChanged:false,changedControlIds})}
      return{accepted,snapshot:clone(nativeSnapshot),changedControlIds,error:accepted?'':String(result?.error||'native sequence scene rejected')}
    }
    if(action==='midi.keyswitch.capture.set'){
      const enabled=payload?.enabled===true,learn=payload?.learn===true,baseNote=Math.max(0,Math.min(121,Math.trunc(Number(payload?.baseNote)||24))),noteCount=Math.max(1,Math.min(7,Math.trunc(Number(payload?.noteCount)||7))),channel=payload?.channel===null||payload?.channel===undefined?null:Math.max(1,Math.min(16,Math.trunc(Number(payload.channel)||1)))
      if(globalThis.__PPW_ANDROID_NATIVE_HOST__===true){
        const result=await host.request('setSequenceKeyswitchMidiCapture',{enabled,learn,baseNote,noteCount,channel})
        return{accepted:result?.accepted===true,enabled,learn,headless:false,error:String(result?.error||'')}
      }
      const result=await host.request('sequenceSceneMidiLearnCapture',{enabled:learn})
      return{accepted:result?.accepted!==false,enabled,learn,headless:true,baseNote,noteCount,channel,error:String(result?.error||'')}
    }
    if(action==='midi.config.get'){
      const result=await host.request('midiMpeConfig')
      return{accepted:result?.accepted!==false,config:clone(result?.config||{}),input:clone(result?.input||{}),error:String(result?.error||'')}
    }
    if(action==='midi.config.set'){
      const config=payload?.config&&typeof payload.config==='object'?clone(payload.config):null
      if(!config||config.schema!=='trambustissimo-midi-mpe-config-v1')return{accepted:false,error:'MIDI/MPE config invalid'}
      const result=await host.request('setMidiMpeConfig',{config})
      return{accepted:result?.accepted===true,config:mergeMidiConfigIdentity(config,clone(result?.config||config)),input:clone(result?.input||{}),error:String(result?.error||'')}
    }
    if(action==='midi.config.resetAuto'){
      const result=await host.request('resetMidiMpeAuto')
      return{accepted:result?.accepted===true,config:clone(result?.config||{}),input:clone(result?.input||{}),error:String(result?.error||'')}
    }
    if(action==='effect.system.get'){
      const result=await host.request('effectSystemConfig')
      return{accepted:result?.accepted!==false,config:clone(result?.config||{}),error:String(result?.error||'')}
    }
    if(action==='effect.system.set'){
      const config=payload?.config&&typeof payload.config==='object'?clone(payload.config):null
      if(!config||config.schema!=='effects-bloom-system-state-v1')return{accepted:false,error:'Effect system config invalid'}
      const result=await host.request('setEffectSystemConfig',{config})
      return{accepted:result?.accepted===true,config:clone(result?.config||config),error:String(result?.error||'')}
    }
    if(action==='midi.input.snapshot'){
      const afterSequence=Math.max(0,Math.trunc(Number(payload?.afterSequence)||0)),result=await requestRealtime('midiInputSnapshot',{afterSequence})
      return{accepted:result&&typeof result==='object',snapshot:clone(result||{}),error:result&&typeof result==='object'?'':'MIDI input snapshot unavailable'}
    }
    if(action==='midi.keyswitch.recall.snapshot'){
      const afterSequence=Math.max(0,Math.trunc(Number(payload?.afterSequence)||0)),result=await requestRealtime('sequenceSceneMidiRecallSnapshot',{afterSequence})
      const accepted=Boolean(result&&typeof result==='object'&&result.available!==false)
      return{accepted,snapshot:clone(result||{}),error:accepted?'':'Sequence scene recall feed unavailable'}
    }
    if(action==='midi.arp.capture.set'){
      const enabled=payload?.enabled===true,result=await host.request('setArpeggiatorMidiCapture',{enabled})
      return{accepted:result?.accepted===true,enabled:result?.enabled===true,error:String(result?.error||'')}
    }
    if(action==='midi.diagnostics'){
      const afterSequence=Math.max(0,Math.trunc(Number(payload?.afterSequence)||0)),[configResult,inputCapture,runtimeSnapshot]=await Promise.all([requestRealtime('midiMpeConfig'),requestRealtime('midiInputSnapshot',{afterSequence}),requestRealtime('runtimeTelemetry')])
      const baseInput=configResult?.input&&typeof configResult.input==='object'?clone(configResult.input):{},capture=inputCapture&&typeof inputCapture==='object'?clone(inputCapture):{}
      const input={...baseInput,...capture,connectedInputPorts:baseInput.connectedInputPorts??capture.connectedInputPorts??null,ports:Array.isArray(baseInput.ports)?baseInput.ports:(Array.isArray(capture.ports)?capture.ports:[]),events:Array.isArray(capture.events)?capture.events:[]}
      const runtime=clone(runtimeSnapshot||{});if(configResult?.config?.expression)runtime.midiMpe={...(runtime.midiMpe||{}),...clone(configResult.config.expression)}
      return{accepted:configResult?.accepted!==false,input,runtime,error:String(configResult?.error||'')}
    }
    if(action==='state.load'){
      const key=String(payload?.key||'');if(!key||key.length>128)return{accepted:false,json:null,reason:'state-key-invalid'}
      const raw=await host.request('stateLoad',{key})
      return{accepted:true,json:typeof raw==='string'?raw:null}
    }
    if(action==='state.save'){
      const key=String(payload?.key||''),json=String(payload?.json??''),musical=payload?.musical===true
      if(!key||key.length>128||new TextEncoder().encode(json).length>1024*1024)return{accepted:false,reason:'state-payload-invalid'}
      const result=await host.request('stateSave',{key,json,musical})
      return{accepted:result?.accepted===true}
    }
    if(action==='state.remove'){
      const key=String(payload?.key||'');if(!key||key.length>128)return{accepted:false,reason:'state-key-invalid'}
      const result=await host.request('stateRemove',{key})
      return{accepted:result?.accepted===true}
    }
    if(action.startsWith('sample.resource.')){
      const result=await host.request(action,payload&&typeof payload==='object'?payload:{})
      if(result?.snapshot)applyNativeSnapshot(result.snapshot)
      return result
    }
    if(action==='keyboard.schedule.batchAtFrame'){
      const events=Array.isArray(payload?.events)?payload.events:[],epoch=Math.max(0,Math.trunc(Number(payload?.epoch)||0))
      if(!events.length||events.length>128||epoch<1)return{accepted:false,reason:'keyboard-schedule-batch-invalid'}
      const inputRows=[],outputRows=[]
      for(const event of events){
        const kind=String(event?.kind||''),targetFrame=Number(event?.targetFrame),sourceNote=clampMidi7(event?.note??60),velocity=clampMidi7(event?.velocity??108),channel=0,pitchPayload=event?.pitch&&typeof event.pitch==='object'?event.pitch:{},mode=pitchPayload.externalMidi===true?'off':(['off','12tet','pitch-bend'].includes(String(pitchPayload.midiOutMode||''))?String(pitchPayload.midiOutMode):'pitch-bend'),pitch=plicataPitchFromPayload(sourceNote,pitchPayload),outputPitch=mode==='12tet'?plicataTwelveTetPitch(pitch):pitch,externalBend=Number(pitchPayload.externalBendSemitones)||0,inputMessages=[],outputMessages=[]
        if(!Number.isSafeInteger(targetFrame)||targetFrame<0)return{accepted:false,reason:'keyboard-schedule-frame-invalid'}
        if(kind==='on'){inputMessages.push(externalBend?pitchBendBytesForSemitones(externalBend,24,channel):plicataNeutralBendBytes(channel),[0x90|channel,sourceNote,velocity]);if(mode==='pitch-bend')outputMessages.push(...plicataPitchBendRangeMessages(outputPitch.bendRangeSemitones,channel),plicataPitchBendBytes(outputPitch,channel));if(mode!=='off')outputMessages.push(plicataNoteOnBytes(outputPitch,velocity,channel))}
        else if(kind==='off'){inputMessages.push([0x80|channel,sourceNote,0],plicataNeutralBendBytes(channel));if(mode!=='off')outputMessages.push(plicataNoteOffBytes(outputPitch,channel));if(mode==='pitch-bend')outputMessages.push(plicataNeutralBendBytes(channel))}
        else return{accepted:false,reason:'keyboard-schedule-kind-invalid'}
        for(const bytes of inputMessages)inputRows.push({bytes,targetFrame})
        for(const bytes of outputMessages)outputRows.push({bytes,targetFrame})
      }
      const input=await requestRealtime('midiAtBatch',{rows:inputRows,epoch}),output=outputRows.length?await requestRealtime('midiOutputAtBatch',{rows:outputRows,epoch}):{accepted:true,queued:0}
      return{accepted:input?.accepted===true&&output?.accepted!==false,inputCount:inputRows.length,outputCount:outputRows.length,epoch}
    }
    if(action==='keyboard.schedule.atBeat'||action==='keyboard.schedule.atFrame'){
      const kind=String(payload?.kind||''),atBeat=action.endsWith('atBeat'),beat=Number(payload?.beat),targetFrame=Math.max(0,Math.trunc(Number(payload?.targetFrame)||0)),epoch=Math.max(0,Math.trunc(Number(payload?.epoch)||0)),sourceNote=clampMidi7(payload?.note??60),velocity=clampMidi7(payload?.velocity??108),channel=0,pitchPayload=payload?.pitch&&typeof payload.pitch==='object'?payload.pitch:{},mode=pitchPayload.externalMidi===true?'off':(['off','12tet','pitch-bend'].includes(String(pitchPayload.midiOutMode||''))?String(pitchPayload.midiOutMode):'pitch-bend'),pitch=plicataPitchFromPayload(sourceNote,pitchPayload),outputPitch=mode==='12tet'?plicataTwelveTetPitch(pitch):pitch,externalBend=Number(pitchPayload.externalBendSemitones)||0,inputMessages=[],outputMessages=[]
      if(kind==='on'){inputMessages.push(externalBend?pitchBendBytesForSemitones(externalBend,24,channel):plicataNeutralBendBytes(channel),[0x90|channel,sourceNote,velocity]);if(mode==='pitch-bend')outputMessages.push(...plicataPitchBendRangeMessages(outputPitch.bendRangeSemitones,channel),plicataPitchBendBytes(outputPitch,channel));if(mode!=='off')outputMessages.push(plicataNoteOnBytes(outputPitch,velocity,channel))}
      else if(kind==='off'){inputMessages.push([0x80|channel,sourceNote,0],plicataNeutralBendBytes(channel));if(mode!=='off')outputMessages.push(plicataNoteOffBytes(outputPitch,channel));if(mode==='pitch-bend')outputMessages.push(plicataNeutralBendBytes(channel))}
      else return{accepted:false,reason:'keyboard-schedule-kind-invalid'}
      if(!atBeat&&(typeof payload?.targetFrame!=='number'||!Number.isSafeInteger(payload.targetFrame)||payload.targetFrame<0))return{accepted:false,reason:'invalid-target-frame'};
      // Absolute deadlines survive asynchronous bridge transit. delayFrames is
      // retained solely for older native hosts; current Android/Apple use targetFrame.
      let delayFrames=0;if(!atBeat){const suppliedFrame=payload?.currentFrame;let currentFrame;if(typeof suppliedFrame==='number'&&Number.isFinite(suppliedFrame)&&suppliedFrame>=0)currentFrame=suppliedFrame;else{const clock=await requestRealtime('hostTransport'),renderFrame=Number(clock?.renderSampleTime),position=Number(clock?.samplePosition);currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(position)?position:0))}delayFrames=Math.max(0,targetFrame-currentFrame)}
      const inputOp=atBeat?'midiAtBeat':'midiAt',outputOp=atBeat?'midiOutputAtBeat':'midiOutputAt',timing=atBeat?{beat,epoch}:{targetFrame,delayFrames,epoch},results=[];for(const bytes of inputMessages)results.push(await requestRealtime(inputOp,{bytes,...timing}));for(const bytes of outputMessages)results.push(await requestRealtime(outputOp,{bytes,...timing}));return{accepted:results.length>0&&results.every(row=>row?.accepted===true),inputCount:inputMessages.length,outputCount:outputMessages.length,beat:atBeat?beat:null,targetFrame:atBeat?null:targetFrame}
    }
    if(action==='product.midi'){
      const bytes=Array.from(payload?.bytes||[]).slice(0,3).map(value=>Math.max(0,Math.min(255,Math.trunc(Number(value)||0))))
      if(bytes.length<1)return{accepted:false,reason:'product-midi-empty'}
      const result=await requestRealtime('midi',{bytes})
      return{accepted:result?.accepted===true,bytes,error:result?.accepted===true?'':String(result?.error||'native product MIDI rejected')}
    }
    if(action==='runtime.ensure'){
      // All native products share the same readiness contract. TEMPORA must not
      // fall through to unsupported-action just because it is not NERITIC.
      const transport=await requestRealtime('hostTransport')
      return{accepted:Boolean(transport)&&Number(transport.sampleRate)>0&&Number.isFinite(Number(transport.renderSampleTime)),hostContext:globalThis.__PPW_AUV3_BOOT__?.hostContext||{}}
    }
    if(action==='timeline.clock'){
      const transport=await requestRealtime('hostTransport'),sampleRate=Math.max(1,Number(transport?.sampleRate)||48000),renderFrame=Number(transport?.renderSampleTime),samplePosition=Number(transport?.samplePosition),currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(samplePosition)?samplePosition:0))
      return{accepted:transport&&typeof transport==='object',clock:{currentTime:currentFrame/sampleRate,currentFrame,sampleRate,quantum:128},transport:clone(transport||{})}
    }
    if(action==='timeline.schedule.reset'){
      const epoch=Math.max(0,Math.trunc(Number(payload?.epoch)||0)),result=await requestRealtime('scheduleReset',{epoch});return{accepted:result?.accepted!==false,epoch:Number(result?.epoch??epoch)}
    }
    if(action==='timeline.midi.at'||action==='timeline.midi.output.at'){
      const bytes=Array.from(payload?.bytes||[]).slice(0,3),targetFrame=Number(payload?.targetFrame),epoch=Math.max(0,Math.trunc(Number(payload?.epoch)||0));if(typeof payload?.targetFrame!=='number'||!Number.isSafeInteger(targetFrame)||targetFrame<0)return{accepted:false,reason:'invalid-target-frame'};const clock=await requestRealtime('hostTransport'),renderFrame=Number(clock?.renderSampleTime),position=Number(clock?.samplePosition),currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(position)?position:0)),delayFrames=Math.max(0,targetFrame-currentFrame),op=action==='timeline.midi.output.at'?'midiOutputAt':'midiAt',result=await requestRealtime(op,{bytes,targetFrame,delayFrames,epoch});return{accepted:result?.accepted===true,sampleTime:Number(result?.sampleTime??targetFrame)}
    }
    if(action==='timeline.midi.atBeat'||action==='timeline.midi.output.atBeat'){
      const bytes=Array.from(payload?.bytes||[]).slice(0,3),beat=Number(payload?.beat),epoch=Math.max(0,Math.trunc(Number(payload?.epoch)||0)),op=action==='timeline.midi.output.atBeat'?'midiOutputAtBeat':'midiAtBeat',result=await host.request(op,{bytes,beat,epoch});return{accepted:result?.accepted===true,sampleTime:Number(result?.sampleTime??0)}
    }
    if(slug==='neritic'){
      if(action==='runtime.snapshot'){
        const snap=await requestRealtime('liveSnapshot');if(snap)applyNativeLiveSnapshot(snap)
        const runtime=snap?.runtime||nativeSnapshot?.runtime||{}
        return{accepted:true,productKey:signatureProductKey,errorCount:Number(runtime.errorCount||0),callbackOverrunCount:Number(runtime.callbackOverrunCount||0),scheduledMidiPending:Number(runtime.scheduledMidiPending||0),scheduledDelivered:Number(runtime.scheduledDelivered||0),scheduledLateClamps:Number(runtime.scheduledLateClamps||0),controlValues:{...(runtime.controlValues||{})}}
      }
      if(action==='runtime.telemetry.select'){
        // The outer AU host already maintains a native live snapshot.  Serving the
        // child LEDs/meters from that cache removes a second 12.5 Hz native bridge
        // round-trip that previously competed with pointer gestures on iPad.
        const source=nativeSnapshot?.runtime?.controlValues||{},selected=Array.isArray(payload?.keys)?payload.keys.map(String):[],controlValues={}
        for(const key of selected)if(Number.isFinite(Number(source[key])))controlValues[key]=Number(source[key])
        return{accepted:true,controlValues}
      }
      if(action==='timeline.clock'){
        const snap=await requestRealtime('liveSnapshot');if(snap)applyNativeLiveSnapshot(snap)
        const transport=snap?.hostTransport||nativeSnapshot?.hostTransport||{},sampleRate=Math.max(1,Number(transport.sampleRate)||48000)
        const renderFrame=Number(transport.renderSampleTime),position=Number(transport.samplePosition),currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(position)?position:0))
        return{accepted:true,clock:{currentTime:currentFrame/sampleRate,currentFrame,sampleRate,quantum:128},epoch:timelineEpoch}
      }
      if(action==='timeline.schedule.reset'){
        const requested=Math.max(1,Math.trunc(Number(payload?.epoch)||timelineEpoch+1));timelineEpoch=requested
        const result=await host.request('scheduleReset',{epoch:timelineEpoch});return{accepted:result?.accepted!==false,epoch:timelineEpoch}
      }
      if(action==='timeline.midi.at'){
        const bytes=Array.from(payload?.bytes||[]).slice(0,3),targetFrame=Math.max(0,Math.trunc(Number(payload?.targetFrame)||0)),epoch=Math.max(1,Math.trunc(Number(payload?.epoch)||timelineEpoch))
        const snap=await requestRealtime('liveSnapshot'),transport=snap?.hostTransport||{},renderFrame=Number(transport.renderSampleTime),position=Number(transport.samplePosition),currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(position)?position:0)),delayFrames=Math.max(0,targetFrame-currentFrame)
        return host.request('midiAt',{bytes,delayFrames,epoch})
      }
      if(action==='timeline.midi.output.at'){
        const bytes=Array.from(payload?.bytes||[]).slice(0,3),targetFrame=Math.max(0,Math.trunc(Number(payload?.targetFrame)||0)),epoch=Math.max(1,Math.trunc(Number(payload?.epoch)||timelineEpoch))
        const snap=await requestRealtime('liveSnapshot'),transport=snap?.hostTransport||{},renderFrame=Number(transport.renderSampleTime),position=Number(transport.samplePosition),currentFrame=Math.max(0,Number.isFinite(renderFrame)&&renderFrame>=0?renderFrame:(Number.isFinite(position)?position:0)),delayFrames=Math.max(0,targetFrame-currentFrame)
        return host.request('midiOutputAt',{bytes,delayFrames,epoch})
      }
      if(action==='timeline.event.at')return{accepted:false,reason:'native-event-scheduler-open'}
      if(action==='patch.edit'){
        const op=String(payload?.op||'')
        const emptyState={schema:'neritic-patch-state-v1',productId:String(manifest?.productId||''),cables:[]}
        if(op==='state')return{accepted:true,state:clone(local.productState?.patchState||emptyState)}
        if(op==='compatibility')return{accepted:true,compatibility:clone(compatibility)}
        if(op==='apply'){
          const state=clone(payload?.state)
          if(state?.schema!=='neritic-patch-state-v1'||state?.productId!==String(manifest?.productId||'')||!Array.isArray(state?.cables))return{accepted:false,patchAccepted:false,reason:'invalid-neritic-patch-state'}
          const product=clone(local.productState||{});product.patchState=state
          const result=await host.request('setProductState',{state:product});if(result?.snapshot)applyNativeSnapshot(result.snapshot)
          const accepted=result?.accepted!==false
          return{accepted,patchAccepted:accepted,state:clone(nativeSnapshot?.productState?.patchState||state),error:accepted?'':'native patch rejected'}
        }
        return{accepted:false,patchAccepted:false,reason:'unsupported-patch-operation'}
      }
      if(action.startsWith('automation.fleet.'))return{accepted:false,reason:'native-automation-scheduler-open'}
      if(action==='patch.event'){
        const targetId=String(payload?.targetId||''),value=Number.isFinite(Number(payload?.value))?Number(payload.value):1,sampleOffset=Math.max(0,Math.min(65535,Math.trunc(Number(payload?.sampleOffset)||0)))
        const result=await host.request('eventIngress',{id:targetId,value,sampleOffset})
        return{accepted:result?.accepted!==false,inputIndex:result?.inputIndex,reason:result?.accepted===false?'native-event-ingress-rejected':''}
      }
      if(action==='audio.ingress.file.load'||action==='audio.ingress.file.clear')return{accepted:false,reason:'native-file-ingress-open'}
    }
    if(action==='preset.snapshot'){
      const next=await host.request('snapshot');if(next)applyNativeSnapshot(next)
      return{accepted:!!next,snapshot:clone(nativeSnapshot),error:next?'':'native preset snapshot unavailable'}
    }
    if(action==='preset.load'){
      generatedPresetPresentation=null
      clearOptimisticControls()
      const id=String(payload?.id||'');let requestPayload={}
      if(id){const row=presetById.get(id);requestPayload=row?{id,number:Number(row.index)}:{id}}
      else{const number=Number(payload?.number);if(!Number.isFinite(number))throw new Error('preset unavailable');requestPayload={number}}
      const result=await host.request('selectPreset',requestPayload);if(result?.snapshot)applyNativeSnapshot(result.snapshot);if(result?.accepted!==false)dispatchEvent(new CustomEvent('ppw-sequence-scenes-reload'));return result
    }
    if(action==='preset.list')return{accepted:true,snapshot:clone(nativeSnapshot)}
    if(action==='preset.metadata'){
      const requestPayload={kind:String(payload?.kind||''),id:String(payload?.id||''),...(payload?.favorite===undefined?{}:{favorite:payload.favorite===true}),...(payload?.category===undefined?{}:{category:String(payload?.category||'')}),...(payload?.tags===undefined?{}:{tags:Array.isArray(payload.tags)?payload.tags.map(String):[]})}
      const result=await host.request('presetMetadata',requestPayload);if(result?.snapshot)applyNativeSnapshot(result.snapshot);return result
    }
    if(action==='preset.duplicate'){
      const stableId=String(payload?.id||'');if(!stableId)throw new Error('user preset identity missing')
      const result=await host.request('duplicateUserPreset',{id:stableId,name:String(payload?.name||'')});if(result?.snapshot)applyNativeSnapshot(result.snapshot);return result
    }
    if(action==='preset.save'||action==='preset.rename'||action==='preset.delete'){
      const op=action==='preset.save'?'saveUserPreset':action==='preset.rename'?'renameUserPreset':'deleteUserPreset'
      const stableId=String(payload?.id||''),number=Number(payload?.number),identity={...(stableId?{id:stableId}:{}),...(Number.isFinite(number)&&number<0?{number}:{})}
      const requestPayload=action==='preset.delete'?identity:action==='preset.rename'?{...identity,name:String(payload?.name||'')}:{...identity,name:String(payload?.name||''),...(payload?.category===undefined?{}:{category:String(payload?.category||'')}),...(payload?.tags===undefined?{}:{tags:Array.isArray(payload.tags)?payload.tags.map(String):[]})}
      const result=await host.request(op,requestPayload);if(result?.snapshot)applyNativeSnapshot(result.snapshot);return result
    }
    if(action==='host.parameter'){
      const id=String(payload?.id||''),value=Number(payload?.value),spec=hostControlById.get(id)
      if(!spec||!Number.isFinite(value)||value<Number(spec.minimum)||value>Number(spec.maximum))throw new Error('host parameter invalid')
      // Host-only MIX/TILT are not portable DSP endpoints. Keep their writes in
      // the acknowledged control mailbox, without polluting product.controls.
      rememberOptimisticControl(id,value)
      nativeSnapshot={...(nativeSnapshot||{}),parameters:{...(nativeSnapshot?.parameters||{}),[id]:value}};local=stateView()
      controlInteractionHotUntil=performance.now()+180
      scheduleControlWrite(id,value)
      try{await controlMailbox.flush()}catch(error){optimisticControlValues.delete(id);throw error}
      return{accepted:true}
    }
    if(action.startsWith('signature.')){
      if(!signatureMacro)throw new Error('signature macro unavailable')
      if(action==='signature.state'||action==='signature.preset.list')return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}
      if(action==='signature.configure'){signatureTargets=normalizeSignatureTargets(payload?.targets||[]);signaturePresetId='custom';signatureDirty=true;signatureRevision+=1;if(payload?.apply!==false)writeMacro(signatureMacro.id,signatureValue);await persistSignatureState();return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      if(action==='signature.factory.reset'){signatureTargets=signatureFactoryTargets();signaturePresetId='factory';signatureDirty=false;signatureRevision+=1;writeMacro(signatureMacro.id,signatureValue);await persistSignatureState();return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      if(action==='signature.preset.load'){const presetId=String(payload?.id||''),wasZero=Math.max(0,Math.min(1,Number(signatureValue)||0))===0;if(presetId==='factory'){signatureTargets=signatureFactoryTargets();signaturePresetId='factory';signatureDirty=false;if(!wasZero)signatureValue=Number(signatureMacro.default??0)}else{const row=signaturePresetRows.find(item=>item.id===presetId);if(!row)throw new Error('signature preset missing');signatureTargets=normalizeSignatureTargets(row.targets);signaturePresetId=row.id;signatureDirty=false;if(!wasZero)signatureValue=Number(row.value)}signatureRevision+=1;writeMacro(signatureMacro.id,wasZero?0:signatureValue);await persistSignatureState();return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      if(action==='signature.preset.save'){const requestedId=String(payload?.id||''),requestedName=String(payload?.name||'').trim();let row=requestedId?signaturePresetRows.find(item=>item.id===requestedId):null;if(!row){if(!requestedName)throw new Error('signature preset name missing');if(new TextEncoder().encode(requestedName).length>128||signaturePresetRows.some(item=>item.name.toLocaleLowerCase()===requestedName.toLocaleLowerCase()))throw new Error('signature preset name invalid');const now=new Date().toISOString();row={schema:'moog-signature-macro-preset-v1',productId:String(manifest?.productId||''),productKey:signatureProductKey,macroId:String(signatureMacro.id),id:`sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,name:requestedName,createdAt:now,updatedAt:now,targets:[],value:0};signaturePresetRows.push(row)}else if(requestedName){if(new TextEncoder().encode(requestedName).length>128||signaturePresetRows.some(item=>item.id!==row.id&&item.name.toLocaleLowerCase()===requestedName.toLocaleLowerCase()))throw new Error('signature preset name invalid');row.name=requestedName}row.targets=normalizeSignatureTargets(signatureTargets);row.value=Math.max(0,Math.min(1,Number(signatureValue)||0));row.updatedAt=new Date().toISOString();await persistSignatureBank();signaturePresetId=row.id;signatureDirty=false;signatureRevision+=1;await persistSignatureState();return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      if(action==='signature.preset.rename'){const presetId=String(payload?.id||''),name=String(payload?.name||'').trim(),row=signaturePresetRows.find(item=>item.id===presetId);if(!row||!name||new TextEncoder().encode(name).length>128||signaturePresetRows.some(item=>item.id!==presetId&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('signature preset rename invalid');row.name=name;row.updatedAt=new Date().toISOString();await persistSignatureBank();signatureRevision+=1;return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      if(action==='signature.preset.delete'){const presetId=String(payload?.id||'');if(!presetId||presetId==='factory')throw new Error('signature preset delete invalid');const before=signaturePresetRows.length;signaturePresetRows=signaturePresetRows.filter(item=>item.id!==presetId);if(signaturePresetRows.length===before)throw new Error('signature preset missing');await persistSignatureBank();if(signaturePresetId===presetId){signaturePresetId='custom';signatureDirty=true;await persistSignatureState()}signatureRevision+=1;return{accepted:true,signature:signatureSnapshot(),snapshot:stateView()}}
      throw new Error(`signature action unknown:${action}`)
    }
    if(action==='patch.edit'){
      const op=String(payload?.op||'')
      if(op==='state')return{accepted:true,state:clone(local.productState?.patchState||{schema:'moog-patch-state-v1',slug,cables:[]})}
      if(op==='compatibility')return{accepted:true,compatibility:clone(compatibility)}
      if(op==='apply'){
        clearOptimisticControls()
        controlInteractionHotUntil=performance.now()+240
        const product=clone(local.productState||{});product.patchState=clone(payload?.state)
        const result=await host.request('setProductState',{state:product});if(result?.snapshot)applyNativeSnapshot(result.snapshot)
        return{accepted:result?.accepted!==false,state:clone(nativeSnapshot?.productState?.patchState||product.patchState),error:result?.accepted===false?'native patch rejected':''}
      }
    }
    return host.request('action',{id:action,payload:clone(payload)})
  },
  onSurfaceError:error=>reportError(error),
}

const runtime=globalThis.TrambustissimoSurfaceRuntime
if(!runtime||runtime.version!==1)throw new Error('moogAuv3.surfaceRuntimeMissing')
mounted=runtime.mount({
  root:document.getElementById('surface'),
  descriptor:{kind:'custom_dom',endpointIds:semantic.surfaceApi.endpointIds,maxElements:4096,descriptorDigest:contract.semanticDigest},
  implementationId:surfaceInfo.implementationId,
  metadata:{semantic,slug,semanticDigest:contract.semanticDigest,hostContext:globalThis.__PPW_AUV3_BOOT__?.hostContext||{}},
  config:{galleryMode:'auv3-inprocess-web',surfaceMode:'live'},
  adapter,
})
mounted.refresh(local)
mounted.resize(viewport())
const signalAndroidSurfaceReady=attempt=>{
  if(!globalThis.__PPW_ANDROID_NATIVE_HOST__)return
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const shell=document.querySelector('.mavis-object,.mother32-object,.mog-object,.tirante-object')
    if(shell&&shell.getBoundingClientRect().width>0&&document.getElementById('surface')?.childElementCount){
      document.documentElement.dataset.ppwSurfaceReady='1'
      try{globalThis.PpwAndroidHost?.surfaceReady?.()}catch{}
      return
    }
    if(attempt<30)setTimeout(()=>signalAndroidSurfaceReady(attempt+1),16)
  }))
}
signalAndroidSurfaceReady(0)
if(fixedCanvasWebScale)globalThis.__JUCE__?.backend?.addEventListener?.('ppwHostViewport',message=>{
  const width=Math.max(1,Math.round(Number(message?.width)||innerWidth||1140)),height=Math.max(1,Math.round(Number(message?.height)||innerHeight||522))
  mounted?.resize?.({...viewport(),mode:'expanded',width,height})
})
document.documentElement.dataset.ppwMoogAuv3=slug
document.documentElement.dataset.ppwMoogImplementation=surfaceInfo.implementationId
setTimeout(()=>{
  // Remote AUv3 hosts own the view size once they select an AUAudioUnitViewConfiguration.
  // Do not immediately fight that selection by snapping the remote view back to the
  // canonical shell size. VST3/non-remote wrappers can still opt into the initial fit.
  if(manifest.surface?.hostOwnsWindowSize){globalThis.__ppwMoogSurfaceFit={skipped:true,reason:'host-owns-window-size'};return}
  const shell=document.querySelector('.mavis-object,.mother32-object,.mog-object')
  const rect=shell?.getBoundingClientRect?.()
  if(rect&&rect.width>0&&rect.height>0){
    const requested={width:Math.ceil(rect.width),height:Math.ceil(rect.height)+2}
    globalThis.__ppwMoogSurfaceFit={requested,done:false,error:''}
    host.request('surfacePreferredSize',requested).then(value=>{globalThis.__ppwMoogSurfaceFit={requested,done:true,value}}).catch(error=>{globalThis.__ppwMoogSurfaceFit={requested,done:true,error:String(error)}})
  }
},0)

if(!manifest.surface?.hostOwnsWindowSize){
const resizeGrip=document.createElement('button')
resizeGrip.type='button'
resizeGrip.setAttribute('aria-label','Resize plug-in window')
resizeGrip.title='Drag to resize'
resizeGrip.style.cssText='position:fixed;right:2px;bottom:2px;z-index:10000;width:22px;height:22px;min-width:22px;min-height:22px;padding:0;border:0;border-radius:4px;background:linear-gradient(135deg,transparent 0 44%,rgba(67,59,48,.42) 45% 51%,transparent 52% 62%,rgba(67,59,48,.55) 63% 69%,transparent 70%);cursor:nwse-resize;opacity:.48;touch-action:none;'
document.body.append(resizeGrip)
let resizeDrag=null,resizePending=null,resizeBusy=false,resizeMoved=false
const flushResize=async()=>{
  if(resizeBusy||!resizePending)return
  const target=resizePending;resizePending=null;resizeBusy=true
  try{await host.request('surfaceWindowSize',target)}catch(error){reportError(error)}finally{resizeBusy=false;if(resizePending)void flushResize()}
}
resizeGrip.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return
  event.preventDefault();event.stopPropagation();resizeGrip.setPointerCapture?.(event.pointerId)
  resizeMoved=false
  resizeDrag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,startWidth:innerWidth,startHeight:innerHeight}
})
resizeGrip.addEventListener('pointermove',event=>{
  if(!resizeDrag||event.pointerId!==resizeDrag.pointerId)return
  event.preventDefault();event.stopPropagation()
  const surface=manifest.surface||{},minW=Number(surface.minimumWidth||520),minH=Number(surface.minimumHeight||420),maxW=Number(surface.maximumWidth||1600),maxH=Number(surface.maximumHeight||1200)
  const dx=event.clientX-resizeDrag.startX,dy=event.clientY-resizeDrag.startY
  if(Math.abs(dx)>3||Math.abs(dy)>3)resizeMoved=true
  resizePending={width:Math.max(minW,Math.min(maxW,Math.round(resizeDrag.startWidth+dx))),height:Math.max(minH,Math.min(maxH,Math.round(resizeDrag.startHeight+dy)))}
  void flushResize()
})
const endResize=event=>{if(!resizeDrag||event.pointerId!==resizeDrag.pointerId)return;resizeDrag=null;try{resizeGrip.releasePointerCapture?.(event.pointerId)}catch{}}
resizeGrip.addEventListener('pointerup',endResize);resizeGrip.addEventListener('pointercancel',endResize);resizeGrip.addEventListener('lostpointercapture',endResize)
const steppedResize=(dw,dh)=>{
  const surface=manifest.surface||{},minW=Number(surface.minimumWidth||520),minH=Number(surface.minimumHeight||420),maxW=Number(surface.maximumWidth||1600),maxH=Number(surface.maximumHeight||1200)
  resizePending={width:Math.max(minW,Math.min(maxW,Math.round(innerWidth+dw))),height:Math.max(minH,Math.min(maxH,Math.round(innerHeight+dh)))}
  void flushResize()
}
resizeGrip.addEventListener('click',event=>{if(resizeMoved){resizeMoved=false;return}event.preventDefault();steppedResize(innerWidth>=1440?-(innerWidth-1024):160,innerHeight>=1000?-(innerHeight-600):100)})
resizeGrip.addEventListener('keydown',event=>{const step=event.shiftKey?100:24;if(event.key==='ArrowRight'){event.preventDefault();steppedResize(step,0)}else if(event.key==='ArrowLeft'){event.preventDefault();steppedResize(-step,0)}else if(event.key==='ArrowDown'){event.preventDefault();steppedResize(0,step)}else if(event.key==='ArrowUp'){event.preventDefault();steppedResize(0,-step)}})
}
let surfaceResizeFrame=0,resizeQuietTimer=0,resizeActive=false,lastSurfaceResizeKey=''
const scheduleSurfaceResize=()=>{
  resizeActive=true
  document.documentElement.dataset.ppwAuv3Resizing='1'
  if(resizeQuietTimer)clearTimeout(resizeQuietTimer)
  resizeQuietTimer=setTimeout(()=>{resizeActive=false;document.documentElement.removeAttribute('data-ppw-auv3-resizing')},140)
  // One native presentation owner, delivered before paint; no nested rAF.
  const next=viewport(),key=`${next.mode}:${next.width}x${next.height}@${next.pixelRatio}`
  if(key===lastSurfaceResizeKey)return
  lastSurfaceResizeKey=key
  mounted?.resize?.(next)
}
let surfaceResizeObserver=null
// Presentation protocol only; never touches audio, state or storage.
let nativePresentationRevision=0;
globalThis.__ppwCommitNativePresentation=async(width,height)=>{
  if(!fixedSurface||!manifest.surface.nativeAdaptivePresentation||mounted?.status!=='mounted')return false;
  if(activeTransactions>0)return false;
  const w=Math.round(Number(width)),h=Math.round(Number(height));
  if(!(w>0&&h>0&&w<=4096&&h<=4096))return false;
  const previous=viewport(),key=`${w}x${h}`;
  if(globalThis.__ppwNativePresentationViewport?.presentationKey===key)return true;
  globalThis.__ppwNativePresentationViewport={...previous,width:w,height:h,presentationKey:key};
  scheduleSurfaceResize();
  nativePresentationRevision++;
  // UIKit keeps the previous frame visible until WebKit has painted this revision.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return true;
};
if(!fixedSurface){
  addEventListener('resize',scheduleSurfaceResize,{passive:true})
  globalThis.visualViewport?.addEventListener?.('resize',scheduleSurfaceResize,{passive:true})
  // During an interactive remote-AU resize, some WKWebView versions update the
  // layout viewport before dispatching window.resize. Observe the actual root
  // box as well so every intermediate host-provided size can reach the surface.
  if(typeof ResizeObserver==='function'){
    surfaceResizeObserver=new ResizeObserver(scheduleSurfaceResize)
    surfaceResizeObserver.observe(document.documentElement)
  }
}

const poll=async()=>{
  if(destroyed||polling||controlMailbox.pending||activeTransactions>0||resizeActive||!isSurfacePresented()||performance.now()<controlInteractionHotUntil)return
  const presentationRevision=surfacePresentationRevision(),ticket=++livePollTicket
  polling=true
  try{
    const next=await requestRealtime('liveSnapshot')
    // A request can start in an idle frame and return after the finger has gone down. Never
    // apply that stale structural snapshot in the middle of the newly-started gesture.
    if(ticket===livePollTicket&&isSurfacePresented()&&presentationRevision===surfacePresentationRevision()&&activeTransactions===0&&!resizeActive&&performance.now()>=controlInteractionHotUntil)applyNativeLiveSnapshot(next)
  }catch(error){if(ticket===livePollTicket)reportError(error)}finally{if(ticket===livePollTicket)polling=false}
}
let lastTelemetryArrival=0
const pollTelemetry=async()=>{
  if(destroyed||telemetryPolling||!isSurfacePresented())return
  const presentationRevision=surfacePresentationRevision(),ticket=++telemetryPollTicket
  telemetryPolling=true
  const started=performance.now()
  try{
    const next=await requestRealtime('runtimeTelemetry'),now=performance.now()
    uiDiagnostics.record('telemetryRoundTripMs',now-started)
    if(lastTelemetryArrival)uiDiagnostics.record('telemetryArrivalIntervalMs',now-lastTelemetryArrival)
    lastTelemetryArrival=now;uiDiagnostics.record('nativeTelemetryMs',next?.uiNativeReadMs)
    if(ticket===telemetryPollTicket&&isSurfacePresented()&&presentationRevision===surfacePresentationRevision())applyNativeTelemetry(next)
  }catch(error){if(ticket===telemetryPollTicket)reportError(error)}finally{if(ticket===telemetryPollTicket)telemetryPolling=false}
}
// Full snapshots update parameter/preset/transport state and may yield while a gesture is
// active. Runtime telemetry is a separate lock-free lane that stays live during touch so
// playheads, LEDs and meters do not freeze while controls are being edited.
const androidNativeHost=Boolean(globalThis.__PPW_ANDROID_NATIVE_HOST__)
const livePollMs=androidNativeHost?120:(slug==='neritic'?240:slug==='chronomorph'||slug==='mother32'||slug==='spectravox'?120:33)
const telemetryPollMs=androidNativeHost?50:(slug==='chronomorph'?66:slug==='mother32'?1000/60:slug==='spectravox'?66:33)
const bundledLiveTelemetry=!androidNativeHost&&['mavis','dfam','subharmonicon','labyrinth'].includes(slug)&&livePollMs===telemetryPollMs
const pollLiveTelemetry=async()=>{
  if(destroyed||telemetryPolling||!isSurfacePresented())return
  const presentationRevision=surfacePresentationRevision(),telemetryTicket=++telemetryPollTicket
  const includeLive=!polling&&!controlMailbox.pending&&activeTransactions===0&&!resizeActive&&performance.now()>=controlInteractionHotUntil
  const liveTicket=includeLive?++livePollTicket:0
  telemetryPolling=true;if(includeLive)polling=true
  const started=performance.now()
  try{
    const bundle=await requestRealtime(includeLive?'liveTelemetrySnapshot':'runtimeTelemetry'),now=performance.now(),nextTelemetry=includeLive?bundle?.telemetry:bundle
    uiDiagnostics.record('telemetryRoundTripMs',now-started)
    if(lastTelemetryArrival)uiDiagnostics.record('telemetryArrivalIntervalMs',now-lastTelemetryArrival)
    lastTelemetryArrival=now;uiDiagnostics.record('nativeTelemetryMs',nextTelemetry?.uiNativeReadMs)
    if(telemetryTicket===telemetryPollTicket&&isSurfacePresented()&&presentationRevision===surfacePresentationRevision())applyNativeTelemetry(nextTelemetry)
    if(includeLive&&liveTicket===livePollTicket&&isSurfacePresented()&&presentationRevision===surfacePresentationRevision()&&activeTransactions===0&&!resizeActive&&performance.now()>=controlInteractionHotUntil)applyNativeLiveSnapshot(bundle?.live)
  }catch(error){if(telemetryTicket===telemetryPollTicket)reportError(error)}finally{if(telemetryTicket===telemetryPollTicket)telemetryPolling=false;if(includeLive&&liveTicket===livePollTicket)polling=false}
}
let timer=0,telemetryTimer=0
const syncPresentationPolling=visible=>{
  clearInterval(timer);clearInterval(telemetryTimer);timer=0;telemetryTimer=0
  if(!visible||destroyed){
    // Invalidate only read-only requests belonging to the previous presentation.
    // A withheld old response must not keep a reopened editor permanently busy,
    // nor clear a newer request's flag when it eventually arrives.
    livePollTicket+=1;telemetryPollTicket+=1;polling=false;telemetryPolling=false;lastTelemetryArrival=0
    cancelTelemetryVisual()
    resetInteractionGuard();return
  }
  // Preserve the qualified visible cadence and reconcile immediately on return.
  // This never changes the musical scheduler or the continuous-control mailbox.
  if(bundledLiveTelemetry){telemetryTimer=setInterval(pollLiveTelemetry,telemetryPollMs);void pollLiveTelemetry()}
  else{timer=setInterval(poll,livePollMs);telemetryTimer=setInterval(pollTelemetry,telemetryPollMs);void poll();void pollTelemetry()}
}
const stopPresentationPolling=subscribeSurfacePresentation(syncPresentationPolling,{immediate:true})
const onFullStateRestored=async()=>{
  try{
    if(signatureMacro)await initializeSignatureState()
    const next=await host.request('snapshot')
    if(next)applyNativeSnapshot(next)
    dispatchEvent(new CustomEvent('plicata-host-state-restored'))
  }catch(error){reportError(error)}
}
addEventListener('ppw-au-state-restored',onFullStateRestored)
const onVisibilityChange=()=>{if(document.hidden)resetInteractionGuard()};document.addEventListener('visibilitychange',onVisibilityChange)
addEventListener('pagehide',()=>uiDiagnostics.destroy(),{once:true})
globalThis.__ppwMoogUIDiagnostics=uiDiagnostics
addEventListener('pagehide',()=>{destroyed=true;stopPresentationPolling();resetInteractionGuard();removeEventListener('ppw-au-state-restored',onFullStateRestored);document.removeEventListener('visibilitychange',onVisibilityChange);clearInterval(timer);clearInterval(telemetryTimer);if(!fixedSurface){removeEventListener('resize',scheduleSurfaceResize);globalThis.visualViewport?.removeEventListener?.('resize',scheduleSurfaceResize);surfaceResizeObserver?.disconnect?.()}if(surfaceResizeFrame)cancelAnimationFrame(surfaceResizeFrame);cancelTelemetryVisual();if(resizeQuietTimer)clearTimeout(resizeQuietTimer);if(macroCommitTimer)clearTimeout(macroCommitTimer);flushPendingControlWrites();flushMacroCommits();mounted?.destroy?.()},{once:true})

globalThis.__ppwMoogAuv3WebPilot={slug,contract,manifest,mounted,adapter,snapshot:()=>clone(nativeSnapshot),applySnapshot:next=>{applyNativeSnapshot(next);return clone(nativeSnapshot)},applyLiveSnapshot:next=>{applyNativeLiveSnapshot(next);return clone(nativeSnapshot)},applyTelemetry:next=>{applyNativeTelemetry(next);return clone(nativeSnapshot)},debug:()=>mounted?.debugState?.(),hostDebug:()=>({activeTransactions,gestureLeaseCount:gestureLeases.size,activeGestureValues:activeGestureValues(),controlMailboxPending:controlMailbox.pending,resizeActive,polling,telemetryPolling,liveParameterWireCacheHits,hidden:document.hidden}),poll,pollTelemetry}
