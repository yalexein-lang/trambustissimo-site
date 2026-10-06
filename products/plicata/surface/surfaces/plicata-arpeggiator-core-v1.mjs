export const PLICATA_ARP_STATE_SCHEMA='plicata.arp.v1'

export const PLICATA_ARP_DIVISIONS=Object.freeze([
  Object.freeze({id:'1/4',beats:1}),
  Object.freeze({id:'1/8',beats:.5}),
  Object.freeze({id:'1/16',beats:.25}),
  Object.freeze({id:'1/32',beats:.125}),
])
export const PLICATA_ARP_STYLES=Object.freeze(['UP','DOWN','UP_DOWN','AS_PLAYED','RANDOM','WALK','CONVERGE','DIVERGE','CHORD'])
export const PLICATA_ARP_RETRIGGER=Object.freeze(['OFF','FIRST','EACH'])
export const PLICATA_ARP_VELOCITY_MODES=Object.freeze(['KEY','FIX','ACCENT'])
export const PLICATA_ARP_CLOCK_MODES=Object.freeze(['INTERNAL','HOST','MIDI'])

const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,Number(value)))
const integer=(value,minimum,maximum,fallback)=>Math.max(minimum,Math.min(maximum,Number.isFinite(Number(value))?Math.round(Number(value)):fallback))
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))
const divisionRow=id=>PLICATA_ARP_DIVISIONS.find(row=>row.id===String(id))||PLICATA_ARP_DIVISIONS[2]
const mutationRng=seed=>{let state=(Number(seed)>>>0)||0x6d2b79f5;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state=(state>>>0)||0x6d2b79f5;return state/0x100000000}}
const mutationPick=(random,rows)=>rows[Math.max(0,Math.min(rows.length-1,Math.floor(random()*rows.length)))]
export const PLICATA_ARP_PATTERN_STEPS=32
const defaultPatternStep=()=>({enabled:true,octaveOffset:0,velocityOffset:0,gateOffset:0,pitchOffset:0,probability:1,ratchet:1})
const LIVE_PERFORMANCE_KEYS=Object.freeze(['gate','swing','probability','octaveProbability','ratchet','accentAmount'])
const defaultPattern=()=>Array.from({length:PLICATA_ARP_PATTERN_STEPS},defaultPatternStep)
const normalizePatternStep=value=>{const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};return{enabled:source.enabled!==false,octaveOffset:integer(source.octaveOffset,-2,2,0),velocityOffset:integer(source.velocityOffset,-63,63,0),gateOffset:clamp(Number.isFinite(Number(source.gateOffset))?Number(source.gateOffset):0,-.75,.75),pitchOffset:integer(source.pitchOffset,-12,12,0),probability:clamp(Number.isFinite(Number(source.probability))?Number(source.probability):1,0,1),ratchet:integer(source.ratchet,1,4,1)}}
const normalizePattern=value=>{const rows=Array.isArray(value)?value:[];return Array.from({length:PLICATA_ARP_PATTERN_STEPS},(_,index)=>normalizePatternStep(rows[index]))}

export const combinePlicataArpProbability=(globalProbability,stepProbability)=>clamp(clamp(globalProbability,0,1)*clamp(stepProbability,0,1),0,1)
export const combinePlicataArpRatchet=(globalRatchet,stepRatchet)=>integer(integer(globalRatchet,1,4,1)+(integer(stepRatchet,1,4,1)-1),1,4,1)

export const defaultPlicataArpState=()=>({
  schema:PLICATA_ARP_STATE_SCHEMA,
  enabled:false,
  bpm:120,
  division:'1/16',
  clockMode:'INTERNAL',
  style:'UP',
  octaves:1,
  octaveProbability:1,
  gate:.72,
  swing:0,
  hold:false,
  retrigger:'FIRST',
  probability:1,
  ratchet:1,
  velocityMode:'KEY',
  fixedVelocity:104,
  accentAmount:20,
  patternLength:8,
  patternRotation:0,
  pattern:defaultPattern(),
  seed:0x7f4a7c15,
})

export function normalizePlicataArpState(value={}){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{},fallback=defaultPlicataArpState()
  return{
    schema:PLICATA_ARP_STATE_SCHEMA,
    enabled:source.enabled===true,
    bpm:clamp(Number.isFinite(Number(source.bpm))?Number(source.bpm):fallback.bpm,20,300),
    division:divisionRow(source.division).id,
    clockMode:PLICATA_ARP_CLOCK_MODES.includes(String(source.clockMode))?String(source.clockMode):fallback.clockMode,
    style:PLICATA_ARP_STYLES.includes(String(source.style))?String(source.style):fallback.style,
    octaves:integer(source.octaves,1,4,fallback.octaves),
    octaveProbability:clamp(Number.isFinite(Number(source.octaveProbability))?Number(source.octaveProbability):fallback.octaveProbability,0,1),
    gate:clamp(Number.isFinite(Number(source.gate))?Number(source.gate):fallback.gate,.05,1),
    swing:clamp(Number.isFinite(Number(source.swing))?Number(source.swing):fallback.swing,0,1),
    hold:source.hold===true,
    retrigger:PLICATA_ARP_RETRIGGER.includes(String(source.retrigger))?String(source.retrigger):fallback.retrigger,
    probability:clamp(Number.isFinite(Number(source.probability))?Number(source.probability):fallback.probability,0,1),
    ratchet:integer(source.ratchet,1,4,fallback.ratchet),
    velocityMode:PLICATA_ARP_VELOCITY_MODES.includes(String(source.velocityMode))?String(source.velocityMode):fallback.velocityMode,
    fixedVelocity:integer(source.fixedVelocity,1,127,fallback.fixedVelocity),
    accentAmount:integer(source.accentAmount,0,63,fallback.accentAmount),
    patternLength:integer(source.patternLength,1,PLICATA_ARP_PATTERN_STEPS,fallback.patternLength),
    patternRotation:integer(source.patternRotation,0,PLICATA_ARP_PATTERN_STEPS-1,fallback.patternRotation),
    pattern:normalizePattern(source.pattern),
    seed:(Number.isFinite(Number(source.seed))?Number(source.seed):fallback.seed)>>>0||fallback.seed,
  }
}

export const plicataArpStepDurationMs=state=>{
  const s=normalizePlicataArpState(state)
  return 60000/s.bpm*divisionRow(s.division).beats
}

export function makePlicataArpMutation(value={},serial=1){
  const state=normalizePlicataArpState(value),mutationSerial=Math.max(1,Math.round(Number(serial)||1)),random=mutationRng((state.seed^(Math.imul(mutationSerial,0x9e3779b1)>>>0)^0xa511e9b3)>>>0),length=state.patternLength,pattern=state.pattern.map(row=>({...row}))
  let enabledCount=0
  for(let index=0;index<length;index++){
    const row={...pattern[index]}
    if(random()<.14)row.enabled=!row.enabled
    if(random()<.30)row.octaveOffset=integer(row.octaveOffset+mutationPick(random,[-1,1]),-2,2,row.octaveOffset)
    if(random()<.52)row.velocityOffset=integer(row.velocityOffset+mutationPick(random,[-16,-8,8,16]),-63,63,row.velocityOffset)
    if(random()<.48)row.gateOffset=clamp(row.gateOffset+mutationPick(random,[-.25,-.1,.1,.25]),-.75,.75)
    if(random()<.36)row.probability=clamp(row.probability+mutationPick(random,[-.25,-.12,.12,.25]),0,1)
    if(random()<.28)row.ratchet=integer(row.ratchet+mutationPick(random,[-1,1]),1,4,row.ratchet)
    pattern[index]=row;if(row.enabled)enabledCount++
  }
  if(enabledCount===0){const index=Math.floor(random()*length);pattern[index]={...pattern[index],enabled:true}}
  const probability=clamp(state.probability+mutationPick(random,[-.2,-.1,0,.1]),0,1),ratchet=random()<.34?integer(state.ratchet+mutationPick(random,[-1,1]),1,4,state.ratchet):state.ratchet
  return{schema:'plicata.arp.performance-mutation.v1',serial:mutationSerial,probability,ratchet,pattern}
}

const shiftedPitch=(pitch,semitones)=>{
  if(!pitch||typeof pitch!=='object')return null
  const shift=Number(semitones)||0,next=clone(pitch)
  for(const key of ['sourceNote','tunedNote','exactSemitones','midiNote'])if(Number.isFinite(Number(next[key])))next[key]=clamp(Number(next[key])+shift,0,127)
  if(Number.isFinite(Number(next.bend14)))next.bend14=integer(next.bend14,0,16383,8192)
  return next
}
const transposedPitch=(pitch,octave)=>shiftedPitch(pitch,12*Number(octave||0))

export class PlicataArpeggiatorEngine{
  constructor({noteOn=()=>true,noteOff=()=>true,onState=()=>{},onStep=()=>{},setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),now=()=>globalThis.performance?.now?.()??Date.now()}={}){
    this.noteOnCallback=noteOn
    this.noteOffCallback=noteOff
    this.onState=onState
    this.onStep=onStep
    this.setTimer=setTimer
    this.clearTimer=clearTimer
    this.now=now
    this.state=defaultPlicataArpState()
    this.held=new Map()
    this.serial=0
    this.cursor=0
    this.bounceDirection=1
    this.walkIndex=0
    this.randomState=this.state.seed
    this.chanceState=(this.state.seed^0x9e3779b9)>>>0||0x6d2b79f5
    this.octaveChanceState=(this.state.seed^0x85ebca6b)>>>0||0x7f4a7c15
    this.stepCounter=0
    this.externalTempoBpm=null
    this.performanceOverlay=null
    this.sounding=null
    this.tickTimer=null
    this.nextTickDeadline=null
    this.gateTimer=null
    this.auxTimers=new Set()
    this.destroyed=false
    this.allPhysicalReleased=false
    this.livePerformanceWriteCount=0
    this.livePerformanceNoopCount=0
  }

  // Runtime consumers must not serialize a complete pattern merely to read a flag.
  get heldCount(){return this.held.size}
  get stepIndex(){return this.stepCounter}
  hasLatchedNotes(){for(const row of this.held.values())if(row.physical!==true)return true;return false}
  hasSoundingOwner(ownerKey){if(Array.isArray(this.sounding)){for(const row of this.sounding)if(row.ownerKey===ownerKey)return true;return false}return this.sounding!==null&&this.sounding.ownerKey===ownerKey}
  snapshot(){return normalizePlicataArpState(this.state)}
  debug(){return{state:this.snapshot(),held:[...this.held.values()].map(row=>clone(row)),cursor:this.cursor,bounceDirection:this.bounceDirection,walkIndex:this.walkIndex,stepCounter:this.stepCounter,externalTempoBpm:this.externalTempoBpm,performanceOverlay:clone(this.performanceOverlay),sounding:clone(this.sounding),running:this.tickTimer!==null,nextTickDeadline:this.nextTickDeadline,auxTimerCount:this.auxTimers.size,allPhysicalReleased:this.allPhysicalReleased,livePerformanceWriteCount:this.livePerformanceWriteCount,livePerformanceNoopCount:this.livePerformanceNoopCount}}

  setState(value,{notify=true,startScheduler=true}={}){
    const previous=this.state,next=normalizePlicataArpState({...previous,...(value||{})})
    const disabled=previous.enabled&&!next.enabled,holdReleased=previous.hold&&!next.hold,seedChanged=next.seed!==previous.seed,ratchetChanged=next.ratchet!==previous.ratchet,clockChanged=next.clockMode!==previous.clockMode,timingChanged=next.bpm!==previous.bpm||next.division!==previous.division||next.swing!==previous.swing
    this.state=next
    if(seedChanged)this.resetSequence({keepSounding:true})
    if(!disabled&&(ratchetChanged||timingChanged||seedChanged||clockChanged)){this.clearAuxTimers();this.stopSounding();if((timingChanged||clockChanged)&&this.tickTimer!==null){this.clearTimer(this.tickTimer);this.tickTimer=null;this.nextTickDeadline=null}}
    if(holdReleased){
      for(const [key,row] of [...this.held])if(row.physical!==true)this.held.delete(key)
      this.allPhysicalReleased=[...this.held.values()].every(row=>row.physical!==true)
      if(!this.held.size)this.stopSounding()
    }
    if(disabled){this.stopScheduler();this.stopSounding()}
    if(startScheduler&&next.enabled&&this.held.size&&next.clockMode==='INTERNAL'){if(timingChanged||clockChanged)this.ensureRunning({delayMs:this.nextIntervalMs()});else this.ensureRunning()}
    if(notify)this.onState(this.snapshot())
    return this.snapshot()
  }

  setLivePerformanceState(value,{notify=true}={}){
    if(this.destroyed)return this.snapshot()
    const patch={}
    for(const key of LIVE_PERFORMANCE_KEYS)if(Object.prototype.hasOwnProperty.call(value||{},key))patch[key]=value[key]
    const keys=Object.keys(patch)
    if(!keys.length){this.livePerformanceNoopCount+=1;return this.snapshot()}
    const next=normalizePlicataArpState({...this.state,...patch}),changed=keys.some(key=>JSON.stringify(next[key])!==JSON.stringify(this.state[key]))
    if(!changed){this.livePerformanceNoopCount+=1;return this.snapshot()}
    this.state=next
    this.livePerformanceWriteCount+=1
    if(notify)this.onState(this.snapshot())
    return this.snapshot()
  }

  setSceneState(value,{notify=true}={}){
    if(this.destroyed)return this.snapshot()
    const previous=this.state,source=value&&typeof value==='object'&&!Array.isArray(value)?value:{}
    const next=normalizePlicataArpState({...previous,...source,enabled:previous.enabled,bpm:previous.bpm,clockMode:previous.clockMode,hold:previous.hold}),seedChanged=next.seed!==previous.seed
    this.state=next
    if(seedChanged){
      const phase=(this.stepCounter>>>0)+1
      this.randomState=(next.seed^(Math.imul(phase,0x9e3779b1)>>>0))>>>0||0x7f4a7c15
      this.chanceState=(next.seed^0x9e3779b9^(Math.imul(phase,0x85ebca6b)>>>0))>>>0||0x6d2b79f5
      this.octaveChanceState=(next.seed^0x85ebca6b^(Math.imul(phase,0xc2b2ae35)>>>0))>>>0||0x7f4a7c15
    }
    if(notify)this.onState(this.snapshot())
    return this.snapshot()
  }

  physicalNoteOn(payload={}){
    if(this.destroyed)return false
    const note=integer(payload.note,0,127,60),velocity=integer(payload.velocity,1,127,108),ownerKey=String(payload.ownerKey??note)
    const physicalBefore=[...this.held.values()].filter(row=>row.physical===true).length
    if(this.state.hold&&physicalBefore===0&&this.allPhysicalReleased&&this.held.size)this.held.clear()
    const prior=this.held.get(ownerKey)
    const row=prior?.physical===true?{...prior,velocity,pitch:clone(payload.pitch||prior.pitch||null),pressCount:integer(prior.pressCount,1,1024,1)+1}:{note,velocity,pitch:clone(payload.pitch||null),physical:true,pressCount:1,serial:++this.serial,ownerKey,xBendSemitones:0,xBendRangeSemitones:2}
    this.held.set(ownerKey,row)
    this.allPhysicalReleased=false
    const shouldReset=this.state.retrigger==='EACH'||(this.state.retrigger==='FIRST'&&physicalBefore===0)
    if(shouldReset)this.resetSequence({keepSounding:true})
    if(this.state.enabled&&this.state.clockMode==='INTERNAL'&&payload.deferInternalSchedule!==true)this.ensureRunning({immediate:!prior&&this.held.size===1})
    return true
  }

  physicalNoteHandoff(payload={}){
    if(this.destroyed)return false
    const ownerKey=String(payload.ownerKey??payload.fromNote??payload.note??''),row=this.held.get(ownerKey),note=integer(payload.note??payload.toNote,0,127,row?.note??60),velocity=integer(payload.velocity,1,127,row?.velocity??108)
    if(!row||row.physical!==true)return this.physicalNoteOn({note,velocity,pitch:clone(payload.pitch||null),ownerKey,deferInternalSchedule:payload.deferInternalSchedule===true})
    this.held.set(ownerKey,{...row,note,velocity,pitch:clone(payload.pitch||row.pitch||null),physical:true,pressCount:1})
    this.allPhysicalReleased=false
    return true
  }

  physicalNoteOff(payload={}){
    if(this.destroyed)return false
    const note=integer(payload.note,0,127,60),ownerKey=String(payload.ownerKey??note),row=this.held.get(ownerKey)
    if(!row)return true
    const pressCount=integer(row.pressCount,0,1024,row.physical===true?1:0)
    if(row.physical===true&&pressCount>1){this.held.set(ownerKey,{...row,pressCount:pressCount-1});return true}
    if(this.state.hold)this.held.set(ownerKey,{...row,physical:false,pressCount:0})
    else this.held.delete(ownerKey)
    this.allPhysicalReleased=[...this.held.values()].every(item=>item.physical!==true)
    if(!this.held.size){this.stopScheduler();this.stopSounding();this.resetSequence({keepSounding:true})}
    return true
  }

  updateHeldPitch(ownerKey,pitch){const key=String(ownerKey),row=this.held.get(key);if(!row)return false;this.held.set(key,{...row,pitch:clone(pitch)});if(Array.isArray(this.sounding))this.sounding=this.sounding.map(item=>item.ownerKey===key?{...item,pitch:clone(pitch)}:item);else if(this.sounding?.ownerKey===key)this.sounding={...this.sounding,pitch:clone(pitch)};return true}

  updateHeldBend(ownerKey,bendSemitones,rangeSemitones=2){const key=String(ownerKey),row=this.held.get(key);if(!row)return false;const bend=Number.isFinite(Number(bendSemitones))?Number(bendSemitones):0,range=Math.max(.01,Number(rangeSemitones)||2),next={...row,xBendSemitones:bend,xBendRangeSemitones:range};this.held.set(key,next);if(Array.isArray(this.sounding))this.sounding=this.sounding.map(item=>item.ownerKey===key?{...item,xBendSemitones:bend,xBendRangeSemitones:range}:item);else if(this.sounding?.ownerKey===key)this.sounding={...this.sounding,xBendSemitones:bend,xBendRangeSemitones:range};return true}

  phaseSnapshot(){return{cursor:this.cursor,bounceDirection:this.bounceDirection,walkIndex:this.walkIndex,randomState:this.randomState>>>0,chanceState:this.chanceState>>>0,octaveChanceState:this.octaveChanceState>>>0,stepCounter:this.stepCounter}}

  restorePhase(value){if(!value||typeof value!=='object')return false;this.cursor=Math.max(0,Math.round(Number(value.cursor)||0));this.bounceDirection=Number(value.bounceDirection)<0?-1:1;this.walkIndex=Math.max(0,Math.round(Number(value.walkIndex)||0));this.randomState=(Number(value.randomState)>>>0)||this.state.seed||0x7f4a7c15;this.chanceState=(Number(value.chanceState)>>>0)||((this.state.seed^0x9e3779b9)>>>0)||0x6d2b79f5;this.octaveChanceState=(Number(value.octaveChanceState)>>>0)||((this.state.seed^0x85ebca6b)>>>0)||0x7f4a7c15;this.stepCounter=Math.max(0,Math.round(Number(value.stepCounter)||0));this.clearAuxTimers();this.stopSounding();return true}

  removeHeldOwner(ownerKey){const key=String(ownerKey),row=this.held.get(key);if(!row)return false;this.held.delete(key);const soundingRows=Array.isArray(this.sounding)?this.sounding:(this.sounding?[this.sounding]:[]);if(soundingRows.some(item=>item.ownerKey===key))this.stopSounding();if(!this.held.size){this.stopScheduler();this.resetSequence({keepSounding:true})}return true}

  removeHeldOwnersByPrefix(prefix){const wanted=String(prefix||'');let removed=0;for(const key of [...this.held.keys()])if(String(key).startsWith(wanted)){if(this.removeHeldOwner(key))removed++}return removed}

  resetSequence({keepSounding=false}={}){
    this.clearAuxTimers()
    this.cursor=0
    this.bounceDirection=1
    this.walkIndex=0
    this.stepCounter=0
    this.randomState=this.state.seed||0x7f4a7c15
    this.chanceState=(this.state.seed^0x9e3779b9)>>>0||0x6d2b79f5
    this.octaveChanceState=(this.state.seed^0x85ebca6b)>>>0||0x7f4a7c15
    if(!keepSounding)this.stopSounding()
    return true
  }

  panic(){
    this.stopScheduler()
    this.stopSounding()
    this.held.clear()
    this.allPhysicalReleased=false
    this.resetSequence({keepSounding:true})
    return true
  }

  destroy(){if(this.destroyed)return;this.destroyed=true;this.panic()}

  sortedHeld(){
    const rows=[...this.held.values()]
    if(this.state.style==='AS_PLAYED')return rows.sort((a,b)=>a.serial-b.serial)
    return rows.sort((a,b)=>a.note===b.note?a.serial-b.serial:a.note-b.note)
  }

  expandedSequence(){
    const base=this.sortedHeld(),rows=[]
    for(let octave=0;octave<this.state.octaves;octave++)for(const row of base){
      const note=row.note+12*octave
      if(note<=127)rows.push({...row,note,sourceNote:row.note,octave,pitch:transposedPitch(row.pitch,octave)})
    }
    return rows
  }

  nextRandom(){
    let x=this.randomState||0x7f4a7c15
    x^=x<<13;x^=x>>>17;x^=x<<5
    this.randomState=(x>>>0)||0x7f4a7c15
    return this.randomState
  }

  convergeOrder(length){const order=[];for(let left=0,right=length-1;left<=right;left++,right--){order.push(left);if(right!==left)order.push(right)}return order}

  divergeOrder(length){const order=[];if(length<=0)return order;if(length%2){const center=Math.floor(length/2);order.push(center);for(let distance=1;order.length<length;distance++){if(center-distance>=0)order.push(center-distance);if(center+distance<length)order.push(center+distance)}}else{let left=length/2-1,right=length/2;while(left>=0||right<length){if(left>=0)order.push(left--);if(right<length)order.push(right++)}}return order}

  selectChordRows(){
    const base=this.sortedHeld();if(!base.length)return[]
    const octave=this.cursor%this.state.octaves;this.cursor=(this.cursor+1)%this.state.octaves
    return base.map(row=>{const note=row.note+12*octave;return note<=127?{...row,note,sourceNote:row.note,octave,pitch:transposedPitch(row.pitch,octave)}:null}).filter(Boolean).map(clone)
  }

  selectNext(){
    const rows=this.expandedSequence()
    if(!rows.length)return null
    let index=0
    switch(this.state.style){
      case'DOWN': index=rows.length-1-(this.cursor%rows.length);this.cursor=(this.cursor+1)%rows.length;break
      case'UP_DOWN':{
        if(rows.length===1){index=0;this.cursor=0;this.bounceDirection=1;break}
        index=Math.max(0,Math.min(rows.length-1,this.cursor))
        let next=this.cursor+this.bounceDirection
        if(next>=rows.length){this.bounceDirection=-1;next=rows.length-2}
        else if(next<0){this.bounceDirection=1;next=1}
        this.cursor=next
        break
      }
      case'CONVERGE':{const order=this.convergeOrder(rows.length);index=order[this.cursor%order.length];this.cursor=(this.cursor+1)%order.length;break}
      case'DIVERGE':{const order=this.divergeOrder(rows.length);index=order[this.cursor%order.length];this.cursor=(this.cursor+1)%order.length;break}
      case'RANDOM':index=this.nextRandom()%rows.length;break
      case'WALK':{
        index=Math.max(0,Math.min(rows.length-1,this.walkIndex))
        if(rows.length>1){let next=index+((this.nextRandom()&1)?1:-1);if(next<0)next=1;if(next>=rows.length)next=rows.length-2;this.walkIndex=Math.max(0,Math.min(rows.length-1,next))}
        break
      }
      case'AS_PLAYED':
      case'UP':
      default:index=this.cursor%rows.length;this.cursor=(this.cursor+1)%rows.length;break
    }
    return clone(rows[index])
  }

  setExternalTempo(value){const n=Number(value);this.externalTempoBpm=Number.isFinite(n)&&n>=20&&n<=400?n:null;return this.externalTempoBpm}

  stepDurationMs(){const bpm=this.externalTempoBpm??this.state.bpm;return 60000/bpm*divisionRow(this.state.division).beats}

  scheduleAux(fn,ms){
    let id=null
    id=this.setTimer(()=>{this.auxTimers.delete(id);fn()},Math.max(0,Number(ms)||0))
    this.auxTimers.add(id)
    return id
  }

  clearAuxTimers(){for(const id of this.auxTimers)this.clearTimer(id);this.auxTimers.clear()}

  nextChanceRandom(){let x=this.chanceState||0x6d2b79f5;x^=x<<13;x^=x>>>17;x^=x<<5;this.chanceState=(x>>>0)||0x6d2b79f5;return this.chanceState}

  nextOctaveChanceRandom(){let x=this.octaveChanceState||0x7f4a7c15;x^=x<<13;x^=x>>>17;x^=x<<5;this.octaveChanceState=(x>>>0)||0x7f4a7c15;return this.octaveChanceState}

  octaveProbabilityPass(octave=0){const oct=Math.max(0,Math.round(Number(octave)||0));if(oct<=0)return true;const base=clamp(Number(this.state.octaveProbability),0,1),probability=Math.pow(base,oct);if(probability>=.999999)return true;if(probability<=.000001)return false;return(this.nextOctaveChanceRandom()/0x100000000)<probability}

  probabilityPass(probability=this.state.probability){const value=clamp(Number(probability),0,1);if(value>=.999999)return true;if(value<=.000001)return false;return(this.nextChanceRandom()/0x100000000)<value}

  velocityFor(selected,stepIndex){
    if(this.state.velocityMode==='FIX')return this.state.fixedVelocity
    const base=integer(selected?.velocity,1,127,108)
    if(this.state.velocityMode==='ACCENT'&&stepIndex%4===0)return integer(base+this.state.accentAmount,1,127,127)
    return base
  }

  setPerformanceOverlay(value){
    if(!value||typeof value!=='object'){this.performanceOverlay=null;this.clearAuxTimers();this.stopSounding();return null}
    const probability=Number(value.probability),ratchet=Number(value.ratchet),pattern=Array.isArray(value.pattern)?normalizePattern(value.pattern):null
    this.performanceOverlay={
      probability:Number.isFinite(probability)?clamp(probability,0,1):null,
      ratchet:Number.isFinite(ratchet)?integer(ratchet,1,4,this.state.ratchet):null,
      pattern,
      fill:value.fill===true,
    }
    this.clearAuxTimers();this.stopSounding();return clone(this.performanceOverlay)
  }

  clearPerformanceOverlay(){return this.setPerformanceOverlay(null)}

  stopSounding(){
    if(this.gateTimer!==null){this.clearTimer(this.gateTimer);this.gateTimer=null}
    if(!this.sounding)return true
    const rows=Array.isArray(this.sounding)?this.sounding:[this.sounding]
    this.sounding=null
    for(const row of rows)try{this.noteOffCallback({note:row.note,pitch:clone(row.pitch),sourceNote:row.sourceNote,ownerKey:row.ownerKey,xBendSemitones:Number(row.xBendSemitones)||0,xBendRangeSemitones:Math.max(.01,Number(row.xBendRangeSemitones)||2),stepIndex:row.stepIndex,patternStepIndex:row.patternStepIndex,arp:true,chord:rows.length>1})}catch{}
    return true
  }

  planStep(){
    if(!this.state.enabled||!this.held.size)return null
    const chordMode=this.state.style==='CHORD',selectedRows=chordMode?this.selectChordRows():[this.selectNext()].filter(Boolean),selected=selectedRows[0],stepIndex=this.stepCounter,length=this.state.patternLength,sequencePatternStepIndex=stepIndex%length,rotation=((this.state.patternRotation%length)+length)%length,patternStepIndex=(sequencePatternStepIndex+rotation)%length,overlay=this.performanceOverlay||{},patternRows=overlay.pattern||this.state.pattern,basePatternStep=patternRows[patternStepIndex]||defaultPatternStep(),fill=overlay.fill===true,patternStep={...clone(basePatternStep)}
    if(fill){patternStep.enabled=true;patternStep.velocityOffset=integer(patternStep.velocityOffset+16,-63,63,16);patternStep.gateOffset=clamp(patternStep.gateOffset+.12,-.75,.75);if(sequencePatternStepIndex===length-1)patternStep.octaveOffset=integer(patternStep.octaveOffset+1,-2,2,1)}
    this.stepCounter+=1
    if(!selected)return null
    const semitoneShift=12*patternStep.octaveOffset+patternStep.pitchOffset,transformedRows=selectedRows.map(row=>{const targetNote=row.note+semitoneShift;if(targetNote<0||targetNote>127)return null;const transformed={...clone(row),note:targetNote,pitch:shiftedPitch(row.pitch,semitoneShift)};return{...transformed,velocity:integer(this.velocityFor(transformed,stepIndex)+patternStep.velocityOffset,1,127,108)}}).filter(Boolean),transformed=transformedRows[0]||{...clone(selected)},baseRatchet=Number.isFinite(Number(overlay.ratchet))?Number(overlay.ratchet):this.state.ratchet,combinedRatchet=combinePlicataArpRatchet(baseRatchet,patternStep.ratchet),repeats=fill?Math.max(2,combinedRatchet):combinedRatchet,stepMs=this.intervalForCounter(this.stepCounter),sliceMs=Math.max(1,stepMs/repeats),velocity=transformedRows[0]?.velocity??integer(this.velocityFor(transformed,stepIndex)+patternStep.velocityOffset,1,127,108),gate=clamp(this.state.gate+patternStep.gateOffset,.05,1),baseProbability=Number.isFinite(Number(overlay.probability))?Number(overlay.probability):this.state.probability,probability=fill?1:combinePlicataArpProbability(baseProbability,patternStep.probability),inRange=transformedRows.length>0,octavePass=this.octaveProbabilityPass(selected.octave||0),patternSkipped=!patternStep.enabled||!inRange,probabilityPass=patternSkipped||!octavePass?false:this.probabilityPass(probability),skipped=patternSkipped||!octavePass||!probabilityPass
    return{...transformed,velocity,gate,probability,stepIndex,sequencePatternStepIndex,patternStepIndex,patternStep:clone(patternStep),ratchet:repeats,stepMs,sliceMs,skipped,chord:chordMode?transformedRows.map(row=>({...row})):null,performance:{fill,mutation:!!overlay.pattern},skipReason:!patternStep.enabled?'pattern-rest':(!inRange?'pattern-range':(!octavePass?'octave-probability':(skipped?'probability':'')))}
  }

  performStep({scheduleGate=true}={}){
    if(!this.state.enabled||!this.held.size){this.stopSounding();return null}
    this.stopSounding()
    const plan=this.planStep()
    try{this.onStep(clone(plan))}catch{}
    if(!plan||plan.skipped)return plan
    const selected=plan,repeats=plan.ratchet,sliceMs=plan.sliceMs,stepIndex=plan.stepIndex,gate=plan.gate
    const emit=()=>{
      this.stopSounding()
      const sourceRows=Array.isArray(selected.chord)&&selected.chord.length?selected.chord:[selected],rows=sourceRows.map(item=>({...clone(item),velocity:item.velocity??selected.velocity,gate:selected.gate,stepIndex,ratchet:repeats,patternStepIndex:selected.patternStepIndex,patternStep:clone(selected.patternStep)}))
      this.sounding=rows.length>1?rows:rows[0]
      for(const row of rows)try{this.noteOnCallback({note:row.note,velocity:row.velocity,pitch:clone(row.pitch),sourceNote:row.sourceNote,ownerKey:row.ownerKey,xBendSemitones:Number(row.xBendSemitones)||0,xBendRangeSemitones:Math.max(.01,Number(row.xBendRangeSemitones)||2),octave:row.octave,arp:true,chord:rows.length>1,ratchet:repeats,gate:row.gate,patternStepIndex:row.patternStepIndex,patternStep:clone(row.patternStep),stepIndex})}catch{}
      if(scheduleGate&&(gate<.999||repeats>1)){
        const gateMs=Math.max(1,Math.min(sliceMs*.98,sliceMs*gate))
        this.gateTimer=this.setTimer(()=>{this.gateTimer=null;this.stopSounding()},gateMs)
      }
    }
    emit()
    for(let repeat=1;repeat<repeats;repeat++)this.scheduleAux(emit,sliceMs*repeat)
    return{...clone(selected),stepIndex,ratchet:repeats,stepMs:plan.stepMs,sliceMs:plan.sliceMs,skipped:false}
  }

  intervalForCounter(counter=this.stepCounter){
    const base=this.stepDurationMs(),phase=Math.max(0,Math.round(Number(counter)||0))&1
    const displacement=.5*this.state.swing
    return Math.max(1,base*(phase?1-displacement:1+displacement))
  }

  nextIntervalMs(){return this.intervalForCounter(this.stepCounter)}

  externalPlanStep(){if(this.destroyed||!this.state.enabled||!this.held.size||this.state.clockMode==='INTERNAL')return null;return this.planStep()}

  externalTick(){if(this.destroyed||!this.state.enabled||!this.held.size||this.state.clockMode==='INTERNAL')return null;return this.performStep()}

  ensureRunning({immediate=false,delayMs=null}={}){
    if(this.destroyed||!this.state.enabled||this.state.clockMode!=='INTERNAL'||!this.held.size||this.tickTimer!==null)return false
    const schedule=run=>{const now=Number(this.now?.())||0,delay=Math.max(0,(Number(this.nextTickDeadline)||now)-now);this.tickTimer=this.setTimer(run,delay)}
    const run=()=>{
      this.tickTimer=null
      if(this.destroyed||!this.state.enabled||!this.held.size){this.nextTickDeadline=null;return}
      const firedAt=Number(this.now?.())||0
      this.performStep()
      const interval=Math.max(1,this.nextIntervalMs())
      if(!Number.isFinite(Number(this.nextTickDeadline)))this.nextTickDeadline=firedAt
      this.nextTickDeadline+=interval
      const after=Number(this.now?.())||firedAt
      while(this.nextTickDeadline<after-Math.max(2,interval*.25))this.nextTickDeadline+=interval
      schedule(run)
    }
    const now=Number(this.now?.())||0
    this.nextTickDeadline=now+(immediate?0:(delayMs===null?0:Math.max(0,Number(delayMs)||0)))
    if(immediate)run()
    else schedule(run)
    return true
  }

  stopScheduler(){
    if(this.tickTimer!==null){this.clearTimer(this.tickTimer);this.tickTimer=null}
    this.nextTickDeadline=null
    if(this.gateTimer!==null){this.clearTimer(this.gateTimer);this.gateTimer=null}
    this.clearAuxTimers()
    return true
  }
}
