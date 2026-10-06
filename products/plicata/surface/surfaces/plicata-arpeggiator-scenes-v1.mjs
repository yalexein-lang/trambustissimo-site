import {defaultPlicataArpState,normalizePlicataArpState,PLICATA_ARP_PATTERN_STEPS} from './plicata-arpeggiator-core-v1.mjs'

export const PLICATA_ARP_SCENES_SCHEMA='plicata.arp.scenes.v1'
export const PLICATA_ARP_SCENE_SCHEMA='plicata.arp.scene.v1'
export const PLICATA_ARP_SCENE_COUNT=7
export const PLICATA_ARP_KEYSWITCH_DEFAULT_BASE_NOTE=24

export const PLICATA_ARP_SCENE_KEYS=Object.freeze([
  'division','style','octaves','octaveProbability','gate','swing','retrigger',
  'probability','ratchet','velocityMode','fixedVelocity','accentAmount',
  'patternLength','patternRotation','pattern','seed',
])

const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const integer=(value,minimum,maximum,fallback)=>Math.max(minimum,Math.min(maximum,Number.isFinite(Number(value))?Math.round(Number(value)):fallback))
const normalizedKeyswitchChannel=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?integer(value,0,15,0):null
// Read-model queries depend only on three keyswitch fields, never on scene
// serialization. This remains safe for raw imported values without touching
// or allocating any of the seven pattern banks.
const keyswitchView=value=>({
  enabled:value?.keyswitch?.enabled!==false,
  baseNote:integer(value?.keyswitch?.baseNote,0,127-(PLICATA_ARP_SCENE_COUNT-1),PLICATA_ARP_KEYSWITCH_DEFAULT_BASE_NOTE),
  channel:normalizedKeyswitchChannel(value?.keyswitch?.channel),
})

export function snapshotPlicataArpScene(value={}){
  const state=normalizePlicataArpState(value),scene={schema:PLICATA_ARP_SCENE_SCHEMA}
  // normalizePlicataArpState already owns fresh flat pattern rows. Do not
  // JSON-clone all 32 rows twice while constructing one scene snapshot.
  for(const key of PLICATA_ARP_SCENE_KEYS)scene[key]=state[key]
  return scene
}

export function defaultPlicataArpScenesState(activeState=defaultPlicataArpState()){
  const scene=snapshotPlicataArpScene(activeState)
  return{
    schema:PLICATA_ARP_SCENES_SCHEMA,
    activeScene:1,
    scenes:Array.from({length:PLICATA_ARP_SCENE_COUNT},()=>clone(scene)),
    keyswitch:{enabled:true,baseNote:PLICATA_ARP_KEYSWITCH_DEFAULT_BASE_NOTE,channel:null},
  }
}

export function normalizePlicataArpScenesState(value={},legacyState=defaultPlicataArpState()){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{}
  const rows=Array.isArray(source.scenes)?source.scenes:[]
  const scenes=Array.from({length:PLICATA_ARP_SCENE_COUNT},(_,index)=>snapshotPlicataArpScene(rows[index]??legacyState))
  const channel=normalizedKeyswitchChannel(source.keyswitch?.channel)
  return{
    schema:PLICATA_ARP_SCENES_SCHEMA,
    activeScene:integer(source.activeScene,1,PLICATA_ARP_SCENE_COUNT,1),
    scenes,
    keyswitch:{
      enabled:source.keyswitch?.enabled!==false,
      baseNote:integer(source.keyswitch?.baseNote,0,127-(PLICATA_ARP_SCENE_COUNT-1),PLICATA_ARP_KEYSWITCH_DEFAULT_BASE_NOTE),
      channel,
    },
  }
}

export function replacePlicataArpScene(value,sceneNumber,state){
  const bank=normalizePlicataArpScenesState(value,state),slot=integer(sceneNumber,1,PLICATA_ARP_SCENE_COUNT,bank.activeScene)
  bank.scenes[slot-1]=snapshotPlicataArpScene(state)
  return bank
}

export function activatePlicataArpScene(value,sceneNumber,legacyState=defaultPlicataArpState()){
  const bank=normalizePlicataArpScenesState(value,legacyState)
  bank.activeScene=integer(sceneNumber,1,PLICATA_ARP_SCENE_COUNT,bank.activeScene)
  return bank
}

export function plicataArpSceneState(value,sceneNumber=null,legacyState=defaultPlicataArpState()){
  const bank=normalizePlicataArpScenesState(value,legacyState),slot=integer(sceneNumber??bank.activeScene,1,PLICATA_ARP_SCENE_COUNT,bank.activeScene)
  return clone(bank.scenes[slot-1])
}

export function mergePlicataArpSceneWithRuntime(sceneValue,runtimeValue={}){
  const runtime=normalizePlicataArpState(runtimeValue),scene=snapshotPlicataArpScene(sceneValue)
  return normalizePlicataArpState({...runtime,...scene,enabled:runtime.enabled,bpm:runtime.bpm,clockMode:runtime.clockMode,hold:runtime.hold})
}

export function setPlicataArpKeyswitch(value,patch={},legacyState=defaultPlicataArpState()){
  const bank=normalizePlicataArpScenesState(value,legacyState),next={...bank.keyswitch,...(patch||{})}
  bank.keyswitch={
    enabled:next.enabled!==false,
    baseNote:integer(next.baseNote,0,127-(PLICATA_ARP_SCENE_COUNT-1),bank.keyswitch.baseNote),
    channel:normalizedKeyswitchChannel(next.channel),
  }
  return bank
}

export function plicataArpKeyswitchScene(value,note,channel,legacyState){
  void legacyState;
  const ks=keyswitchView(value),n=integer(note,0,127,-1),ch=integer(channel,0,15,-1)
  if(!ks.enabled||n<ks.baseNote||n>=ks.baseNote+PLICATA_ARP_SCENE_COUNT)return null
  if(ks.channel!==null&&ch!==ks.channel)return null
  return n-ks.baseNote+1
}

export function plicataMidiNoteName(value){
  const note=integer(value,0,127,60),names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
  return `${names[note%12]}${Math.floor(note/12)-2}`
}

export function plicataArpKeyswitchLabel(value,sceneNumber,legacyState){
  void legacyState;
  const slot=integer(sceneNumber,1,PLICATA_ARP_SCENE_COUNT,1),note=keyswitchView(value).baseNote+slot-1
  return `S${slot} · ${note} ${plicataMidiNoteName(note)}`
}
