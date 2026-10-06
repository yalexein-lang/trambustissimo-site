const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value))

const randomWord=()=>{
  const words=new Uint32Array(1)
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(words)
  else words[0]=Math.floor(Math.random()*0x100000000)
  return words[0]>>>0
}

const makeRandom=seed=>{
  let state=(Number(seed)>>>0)||0x6d2b79f5
  return()=>{state=(state+0x6d2b79f5)>>>0;let value=state;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return((value^(value>>>14))>>>0)/0x100000000}
}

const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,value))
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback
const sourceState=row=>row?.sourceState||row?.state||{}
const parameterState=row=>sourceState(row)?.parameters||sourceState(row)?.controls||{}
const patchState=row=>sourceState(row)?.patchState||null
const performanceState=row=>row?.performance||sourceState(row)?.performance||null
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
const canonical=value=>JSON.stringify(stable(value))

const SAFE_CONTROL_RANGES=Object.freeze({
  'output-level':[.38,.78],
  'master-level':[.38,.78],
  'volume':[.38,.78],
  'filter-resonance':[0,.78],
  'resonance':[0,.78],
  'feedback':[0,.72],
  'filter-drive':[0,.72],
  'drive':[0,.72],
})

// A generated sound may mutate musical timing, but it must not silently change
// who owns the clock.  Preserve the user's FREE/HOST/EXT selection and its
// transport division/phase while generating the rest of the sound and patch.
const SESSION_SYNC_CONTROL=/(?:^|[-_])sync-(?:mode|division|phase)$|^transport-sync-|^host-sync-|^midi-channel$|^pitch-bend-range-semitones$|^keyboard-transpose-semitones$|^follow-midi-|^midi-clock-division$|^tempo-(?:input|output)-|^delay-pattern-change$|^load-saved-timing$|^keyboard-entry-enabled$/

// Product-specific performance invariants.  PLICATA's VCA ON position is a
// deliberate drone mode, not a neutral preset value: selecting it at random
// can leave the oscillator audible with no held MIDI/gate.  Generated PLICATA
// sounds therefore start in the envelope-gated position; the user can still
// select ON explicitly after generation.
const GENERATED_CONTROL_OVERRIDES=Object.freeze({
  mavis:Object.freeze({'vca-mode':0}),
})

// The compiler intentionally accepts expert modular patches, including
// feedback, audio-rate CV and normal-breaking routes.  The GENERATE button has
// a different contract: it must create a playable sound, must remain silent
// without a note/gate, and must not hide a self-running patch behind a random
// choice.  Keep PLICATA's generative subset explicit and conservative; users
// can still author every compiler-supported route by hand.
const PLICATA_GENERATOR_PAIRS=Object.freeze({
  // Keep the default VCO→FOLD normal available, but also admit the new SUB
  // output as a musically useful alternate source.  Never admit R-VCA feedback
  // or SUB OUT→SUB IN self-routing in generated states.
  'fold-in':Object.freeze(['vco','sub-out']),
  '1v-oct':Object.freeze(['kb-cv','lfo','eg','sample-hold','atten','mult-1','mult-2']),
  pwm:Object.freeze(['lfo','eg','sample-hold','kb-cv','atten','sub-out']),
  'one-minus5':Object.freeze(['vco','lfo','eg','sample-hold','kb-cv']),
  'lfo-rate':Object.freeze(['kb-cv','eg','sample-hold','atten']),
  cutoff:Object.freeze(['lfo','eg','sample-hold','kb-cv','atten','sub-out']),
  two:Object.freeze(['vco','lfo','eg','sample-hold','kb-cv','one']),
  'sample-hold-vco':Object.freeze(['vco','lfo','one','one-plus-two','atten','mult-1','mult-2']),
  'sample-hold-gate-lfo':Object.freeze(['lfo']),
  'atten-plus5':Object.freeze(['vco','lfo','eg','sample-hold','kb-cv','one','one-plus-two']),
  mult:Object.freeze(['vco','lfo','eg','sample-hold','kb-cv','one','one-plus-two','atten']),
  // PLICATA extension patch points. SUB IN is a true normal-break, so only use
  // independent upstream audio/DC sources. SUB CV stays in a bounded musical
  // modulation subset. LFO RESET deliberately excludes the LFO itself to avoid
  // a random self-reset loop.
  'sub-in':Object.freeze(['vco','lfo']),
  'sub-cv':Object.freeze(['kb-cv','lfo','eg','sample-hold']),
  'lfo-sync':Object.freeze(['kb-cv','eg','sample-hold']),
})

const unsafePair=(slug,source,target)=>{
  const key=`${source}>${target}`
  if(slug==='mavis')return !PLICATA_GENERATOR_PAIRS[target]?.includes(source)
  return /(?:vca|output)>/.test(key)&&/(?:audio|fold|carrier|program|external)/.test(target)
}

const choiceValues=spec=>(Array.isArray(spec?.choices)?spec.choices:[]).map(row=>finite(row?.value,NaN)).filter(Number.isFinite)

const generatedValue=(spec,a,b,random)=>{
  const minimum=finite(spec?.minimum,Math.min(a,b)),maximum=finite(spec?.maximum,Math.max(a,b)),choices=choiceValues(spec)
  if(choices.length)return choices[Math.floor(random()*choices.length)%choices.length]
  if(String(spec?.control||'')==='toggle')return random()<.5?0:1
  const scaling=String(spec?.scaling||spec?.scale||'').toLowerCase(),useLog=(scaling==='log'||String(spec?.format||'').toLowerCase()==='hz'||String(spec?.format||'').toLowerCase()==='ms')&&minimum>0&&a>0&&b>0
  const blend=.18+random()*.64,mutation=(random()-.5)*.18
  let value
  if(useLog){const lo=Math.log(Math.max(minimum,a)),hi=Math.log(Math.max(minimum,b)),span=Math.max(.000001,Math.log(maximum)-Math.log(minimum));value=Math.exp(lo+(hi-lo)*blend+span*mutation)}
  else value=a+(b-a)*blend+(maximum-minimum)*mutation
  const safety=SAFE_CONTROL_RANGES[String(spec?.id||'')]
  if(safety){const safeMin=Math.max(minimum,safety[0]),safeMax=Math.min(maximum,safety[1]);value=clamp(value,safeMin,safeMax)}
  else value=clamp(value,minimum,maximum)
  const quantize=finite(spec?.quantize,0)
  if(quantize>0)value=clamp(Math.round(value/quantize)*quantize,minimum,maximum)
  return Number(value.toPrecision(12))
}

const compatiblePairs=(slug,compatibility)=>{
  const pairs=[]
  for(const target of compatibility?.targets||[]){
    const targetId=String(target?.id||'')
    for(const option of target?.options||[]){
      const id=String(option?.id||'')
      if(!id.startsWith('source:'))continue
      const source=id.slice(7)
      if(source&&targetId&&!unsafePair(slug,source,targetId))pairs.push({source,target:targetId})
    }
  }
  return pairs
}

const generatedPatch=(slug,parents,compatibility,random)=>{
  const byTarget=new Map()
  for(const parent of parents){for(const cable of patchState(parent)?.cables||[]){const source=String(cable?.source||''),target=String(cable?.target||'');if(source&&target&&!unsafePair(slug,source,target)&&random()<.68)byTarget.set(target,{source,target})}}
  if(!byTarget.size){const candidates=parents.flatMap(parent=>(patchState(parent)?.cables||[]).map(cable=>({source:String(cable?.source||''),target:String(cable?.target||'')}))).filter(row=>row.source&&row.target&&!unsafePair(slug,row.source,row.target));if(candidates.length){const cable=candidates[Math.floor(random()*candidates.length)%candidates.length];byTarget.set(cable.target,cable)}}
  const pairs=compatiblePairs(slug,compatibility),desired=1+Math.floor(random()*3)
  for(let attempt=0;attempt<64&&byTarget.size<desired&&pairs.length;attempt+=1){const pair=pairs[Math.floor(random()*pairs.length)%pairs.length];if(!byTarget.has(pair.target))byTarget.set(pair.target,pair)}
  return{schema:'moog-patch-state-v1',slug,cables:[...byTarget.values()].slice(0,3)}
}

// MONODIA's generator must be musical rather than merely parameter-valid.
// The generic Moog generator is intentionally broad, but independently
// interpolating 32 * 6 sequencer lanes destroys phrase grammar and arbitrary
// compatible patch cables can normal-break a useful sound.  Keep the sound
// morphing broad while deriving one coherent phrase from a single curated
// factory anchor and restricting automatic cables to low-risk modulation.
const MOTHER32_STEP_LANES=Object.freeze(['note','gate','rest','accent','glide','ratchet'])
const MOTHER32_PATTERN_CONTROLS=Object.freeze(['tempo-bpm','sequence-end-step','sequence-direction','sequence-random','sequence-transpose-semitones','swing-amount','swing-base','swing-modifier'])
const MOTHER32_VOICE_ANCHOR_CONTROLS=Object.freeze([
  'pulse-width','lfo-rate-hz','lfo-wave','vco-wave','vco-mod-source','vco-mod-destination','vco-mod-amount','portamento-enabled',
  'mix','attack-ms','decay-ms','sustain-mode','filter-mode','filter-cutoff','filter-resonance',
  'vcf-mod-source','vcf-mod-amount','vca-mode','output-level','glide-ms',
])
const MOTHER32_SAFE_PATCH_PAIRS=Object.freeze([
  Object.freeze({source:'eg',target:'vcf-cutoff'}),
  Object.freeze({source:'lfo-triangle',target:'vcf-cutoff'}),
  Object.freeze({source:'lfo-square',target:'vcf-cutoff'}),
  Object.freeze({source:'lfo-triangle',target:'vco-mod'}),
  Object.freeze({source:'lfo-square',target:'vco-mod'}),
  Object.freeze({source:'kb',target:'vcf-cutoff'}),
])
const MOTHER32_TRANSPOSE_CHOICES=Object.freeze([-12,-7,-5,0,0,0,5,7,12])
const nearestRatchetCode=value=>{const v=clamp(finite(value,0),0,127);if(v<32)return 0;if(v<64)return 32;if(v<96)return 64;return 96}
const generatedMother32Patch=(compatibility,random,{highPass=false}={})=>{
  const allowed=new Set(compatiblePairs('mother32',compatibility).map(row=>`${row.source}>${row.target}`))
  // In HP mode, automatic cutoff modulation is intentionally excluded. The
  // Mother-32 HP progressively removes the body of the sound as cutoff rises;
  // combining a high generated cutoff with EG/LFO/KB cutoff modulation was the
  // dominant source of musically valid but effectively silent GEN results.
  const candidates=MOTHER32_SAFE_PATCH_PAIRS.filter(row=>allowed.has(`${row.source}>${row.target}`)&&(!highPass||row.target!=='vcf-cutoff'))
  if(!candidates.length)return{schema:'moog-patch-state-v1',slug:'mother32',cables:[]}
  const first=candidates[Math.floor(random()*candidates.length)%candidates.length],cables=[{...first}],usedTargets=new Set([first.target])
  if(random()<.38){
    const seconds=candidates.filter(row=>!usedTargets.has(row.target)&&row.source!==first.source)
    if(seconds.length){const second=seconds[Math.floor(random()*seconds.length)%seconds.length];cables.push({...second})}
  }
  return{schema:'moog-patch-state-v1',slug:'mother32',cables}
}
const musicalizeMother32=(controls,parents,compatibility,random)=>{
  const anchor=parents[Math.floor(random()*parents.length)%parents.length],source=parameterState(anchor)
  // Voice-critical controls come from one coherent factory sound.  Interpolating
  // attack/decay/mode/source selectors between unrelated presets produced valid
  // numbers but audibly broken voices (including sub-millisecond envelopes that
  // were effectively clicks and long attacks paired with vanishing decays).
  for(const id of [...MOTHER32_PATTERN_CONTROLS,...MOTHER32_VOICE_ANCHOR_CONTROLS])if(Number.isFinite(Number(source[id])))controls[id]=Number(source[id])
  const transpose=MOTHER32_TRANSPOSE_CHOICES[Math.floor(random()*MOTHER32_TRANSPOSE_CHOICES.length)%MOTHER32_TRANSPOSE_CHOICES.length]
  const length=clamp(Math.round(finite(controls['sequence-end-step'],15))+1,1,32)
  let activeSteps=0
  for(let step=1;step<=32;step+=1){
    const noteId=`note-step-${step}`,gateId=`gate-step-${step}`,restId=`rest-step-${step}`,accentId=`accent-step-${step}`,glideId=`glide-step-${step}`,ratchetId=`ratchet-step-${step}`
    const anchorNote=finite(source[noteId],finite(controls[noteId],60))
    controls[noteId]=Math.round(clamp(anchorNote+transpose,24,96))
    const rest=finite(source[restId],0)>=64
    controls[restId]=rest?127:0
    if(step<=length&&!rest)activeSteps+=1
    const gate=finite(source[gateId],82)
    controls[gateId]=gate>=126?127:Math.round(clamp(gate,48,118))
    controls[accentId]=finite(source[accentId],0)>=64?127:0
    controls[glideId]=finite(source[glideId],0)>=64?127:0
    controls[ratchetId]=nearestRatchetCode(source[ratchetId])
  }
  if(activeSteps===0){controls['rest-step-1']=0;controls['gate-step-1']=82}
  // Generated states should respond predictably to a played note/sequence.
  // Mutations are correlated around the anchor rather than independent across
  // the whole semantic range.  This keeps the result recognisably new while
  // preserving the envelope/filter/source grammar that made the anchor musical.
  controls['vca-mode']=0
  controls['output-level']=clamp(finite(source['output-level'],.72)+(random()-.5)*.08,.62,.80)
  controls['mix']=clamp(finite(source.mix,.25)+(random()-.5)*.18,.06,.62)
  controls['glide-ms']=clamp(finite(source['glide-ms'],0)*(0.82+random()*.36),0,650)
  controls['pulse-width']=clamp(finite(source['pulse-width'],.5)+(random()-.5)*.14,.12,.88)
  controls['vco-mod-amount']=clamp(finite(source['vco-mod-amount'],.08)+(random()-.5)*.10,-.34,.34)
  const lfoBase=Math.max(.1,finite(source['lfo-rate-hz'],2));controls['lfo-rate-hz']=clamp(lfoBase*Math.pow(2,(random()-.5)*.7),.1,24)
  const sustain=finite(source['sustain-mode'],0)>=.5?1:0;controls['sustain-mode']=sustain
  const envScale=.82+random()*.36
  controls['attack-ms']=clamp(Math.max(.8,finite(source['attack-ms'],8))*envScale,.8,sustain?240:90)
  controls['decay-ms']=clamp(Math.max(90,finite(source['decay-ms'],300))*(.80+random()*.40),sustain?180:110,sustain?1400:900)
  // LP is the default musical generation domain. HP remains available, but is
  // rare and kept low enough that it colours rather than erases the oscillator.
  let highPass=finite(source['filter-mode'],0)>=.5
  if(highPass&&random()<.78){controls['filter-mode']=0;highPass=false}else controls['filter-mode']=highPass?1:0
  const cutoffMutation=(random()-.5)*.14
  if(highPass){
    controls['filter-cutoff']=clamp(finite(source['filter-cutoff'],.22)+cutoffMutation,.03,.34)
    controls['filter-resonance']=0
    controls['vcf-mod-amount']=clamp(finite(source['vcf-mod-amount'],0)+(random()-.5)*.08,-.16,.16)
  }else{
    controls['filter-cutoff']=clamp(finite(source['filter-cutoff'],.55)+cutoffMutation,.22,.82)
    controls['filter-resonance']=clamp(finite(source['filter-resonance'],.25)+(random()-.5)*.10,.04,.76)
    controls['vcf-mod-amount']=clamp(finite(source['vcf-mod-amount'],.25)+(random()-.5)*.12,-.58,.66)
  }
  if(finite(controls['sequence-random'],0)>=.5)controls['sequence-direction']=0
  return{patch:generatedMother32Patch(compatibility,random,{highPass}),anchorPresetId:String(anchor?.id||'')}
}


// PLICATA GEN is a performance sound generator, not a parameter lottery.
// Build around one coherent factory voice, then make correlated bounded changes.
const MAVIS_VOICE_CONTROLS=Object.freeze([
  'vco-frequency-hz','vco-wave','vco-wave-mode','pulse-width','fold-amount','fold-drive','amp-sat','drift','tolerance',
  'sub-level','sub-octave','sub-transpose-semitones','sub-fine-cents','sub-sync-mode','sub-wave','sub-pulse-width',
  'lfo-rate-hz','lfo-wave','lfo-wave-mode','lfo-run-mode','vco-mod-mix','vco-mod-depth','pwm-mod-depth',
  'attack-ms','decay-ms','sustain','release-ms','env-curve','glide-ms','filter-cutoff','filter-resonance',
  'filter-drive','vcf-mod-mix','vcf-mod-depth','velocity-amp','velocity-filter','output-level','kb-scale',
])
const MAVIS_PROFILE_BY_PRESET_ID=Object.freeze({
  'ember-pluck':'pluck','copper-bass':'bass','rubber-filter':'bass','midnight-pwm':'pad','slow-tide':'pad',
  'random-glint':'pluck','random-pulse':'bass','silk-vibrato':'lead','broken-clock':'keys','dual-motion':'lead',
  'scatter-motion':'lead','parallel-fold':'bass','fold-bell':'pluck','fold-drone':'drone','tremolo-wire':'keys',
  'gate-pulse':'arp','offset-bloom':'pad','envelope-vca':'keys','audio-fm-filter':'arp','breathing-rate':'arp',
})
const MAVIS_PROFILE_BANK=Object.freeze(['bass','bass','bass','bass','lead','lead','lead','keys','keys','keys','pluck','pluck','pluck','pad','pad','pad','drone','arp','arp','arp'])
const MAVIS_ARP_STYLES=Object.freeze(['UP','DOWN','UP_DOWN','AS_PLAYED','RANDOM','WALK','CONVERGE','DIVERGE','CHORD'])
const MAVIS_ARP_DIVISIONS=Object.freeze(['1/8','1/16','1/16','1/16','1/32'])
const MAVIS_ARP_Y_TARGETS=Object.freeze([
  Object.freeze({endpointId:'arp.probability',minimum:1,maximum:.5,mapping:'linear'}),
  Object.freeze({endpointId:'arp.swing',minimum:0,maximum:.65,mapping:'linear'}),
  Object.freeze({endpointId:'arp.ratchet',minimum:1,maximum:3,mapping:'linear'}),
  Object.freeze({endpointId:'arp.gate',minimum:1,maximum:.45,mapping:'linear'}),
  Object.freeze({endpointId:'arp.octaveProbability',minimum:1,maximum:.25,mapping:'linear'}),
])
const MAVIS_ARP_SCENE_KEYS=Object.freeze(['division','style','octaves','octaveProbability','gate','swing','retrigger','probability','ratchet','velocityMode','fixedVelocity','accentAmount','patternLength','patternRotation','pattern','seed'])
const mavisArpSceneSnapshot=arp=>{const row={schema:'plicata.arp.scene.v1'};for(const key of MAVIS_ARP_SCENE_KEYS)row[key]=copy(arp[key]);return row}
const generatedMavisScenes=arp=>{
  const base=mavisArpSceneSnapshot(arp),length=Math.max(1,Math.min(32,Math.round(finite(base.patternLength,8)))),scenes=Array.from({length:7},()=>copy(base))
  scenes[1].patternRotation=(base.patternRotation+1)%length;scenes[2].patternRotation=(base.patternRotation+length-1)%length
  scenes[3].style=base.style==='DOWN'?'UP':'DOWN';scenes[4].octaveProbability=Math.min(finite(base.octaveProbability,1),.75);scenes[5].ratchet=Math.max(2,Math.round(finite(base.ratchet,1)));scenes[6].probability=Math.min(finite(base.probability,1),.75)
  for(let index=1;index<scenes.length;index++)scenes[index].seed=((Number(base.seed)>>>0)+(Math.imul(index,0x9e3779b9)>>>0))>>>0
  return{schema:'plicata.arp.scenes.v1',activeScene:1,scenes,keyswitch:{enabled:true,baseNote:24,channel:null}}
}
const mavisCutoffTarget=()=>({endpointId:'control.filter-cutoff',minimum:16000,maximum:80,mapping:'log'})
const boundedAround=(value,spread,minimum,maximum,random)=>clamp(finite(value,(minimum+maximum)*.5)+(random()-.5)*spread,minimum,maximum)
const logAround=(value,octaves,minimum,maximum,random)=>clamp(Math.max(minimum,finite(value,Math.sqrt(minimum*maximum)))*Math.pow(2,(random()-.5)*octaves),minimum,maximum)
const generatedMavisPerformance=(anchor,random,seed,profile)=>{
  const source=copy(performanceState(anchor)?.arpeggiator||{})
  const enabled=profile==='arp'
  const patternLength=enabled?[8,8,12,16][Math.floor(random()*4)%4]:8
  const arp={
    schema:'plicata.arp.v1',enabled,bpm:clamp(Math.round(finite(source.bpm,110)+(random()-.5)*20),72,138),
    division:MAVIS_ARP_DIVISIONS[Math.floor(random()*MAVIS_ARP_DIVISIONS.length)%MAVIS_ARP_DIVISIONS.length],
    clockMode:'INTERNAL',style:enabled?(random()<.72&&MAVIS_ARP_STYLES.includes(String(source.style))?String(source.style):['UP','DOWN','UP_DOWN','AS_PLAYED'][Math.floor(random()*4)%4]):'UP',
    octaves:enabled?Math.max(1,Math.min(2,Math.round(finite(source.octaves,1)+(random()<.24?1:0)))):1,
    octaveProbability:enabled?[1,1,.75][Math.floor(random()*3)%3]:1,
    gate:enabled?[.62,.72,.82][Math.floor(random()*3)%3]:.72,swing:enabled?[0,.12,.20,.35][Math.floor(random()*4)%4]:0,
    hold:false,retrigger:'FIRST',probability:enabled?[1,1,.9,.8][Math.floor(random()*4)%4]:1,
    ratchet:enabled?(random()<.10?2:1):1,velocityMode:enabled&&random()<.24?'ACCENT':'KEY',fixedVelocity:104,accentAmount:18,
    patternLength,patternRotation:0,
    pattern:Array.from({length:32},(_,index)=>{const base=source.pattern?.[index]||{},activeStep=enabled&&index<patternLength;return{enabled:activeStep?(random()<.07?false:base.enabled!==false):true,octaveOffset:activeStep&&random()<.10?(random()<.5?-1:1):0,velocityOffset:activeStep&&random()<.22?(random()<.5?-8:8):0,gateOffset:activeStep&&random()<.14?(random()<.5?-.08:.08):0,pitchOffset:activeStep&&random()<.06?(random()<.5?-2:2):0,probability:activeStep&&random()<.12?[.75,.9,1][Math.floor(random()*3)%3]:clamp(finite(base.probability,1),0,1),ratchet:activeStep&&random()<.07?2:Math.max(1,Math.min(2,Math.round(finite(base.ratchet,1))))}}),
    seed:(Number(seed)>>>0)||0x7f4a7c15,
  }
  // Never let a generated pattern become all-rest.
  if(enabled&&!arp.pattern.slice(0,arp.patternLength).some(row=>row.enabled!==false))arp.pattern[0].enabled=true
  arp.scenes=generatedMavisScenes(arp)
  const keyboardYTargets=[mavisCutoffTarget()]
  if(enabled&&random()<.60)keyboardYTargets.push({...MAVIS_ARP_Y_TARGETS[Math.floor(random()*MAVIS_ARP_Y_TARGETS.length)%MAVIS_ARP_Y_TARGETS.length]})
  return{arpeggiator:arp,keyboardYTargets}
}
const musicalizeMavis=(controls,presets,compatibility,random,seed)=>{
  const profile=MAVIS_PROFILE_BANK[Math.floor(random()*MAVIS_PROFILE_BANK.length)%MAVIS_PROFILE_BANK.length]
  const roleCandidates=presets.filter(row=>MAVIS_PROFILE_BY_PRESET_ID[String(row?.id||'')]===profile)
  const pool=roleCandidates.length?roleCandidates:presets
  const anchor=pool[Math.floor(random()*pool.length)%pool.length],source=parameterState(anchor)
  for(const id of MAVIS_VOICE_CONTROLS)if(Number.isFinite(Number(source[id])))controls[id]=Number(source[id])
  controls['vca-mode']=0;controls['kb-scale']=1
  controls['output-level']=boundedAround(source['output-level'],.12,.58,.76,random)
  controls['filter-cutoff']=logAround(source['filter-cutoff'],.9,120,12000,random)
  controls['filter-resonance']=boundedAround(source['filter-resonance'],.16,.06,.50,random)
  controls['filter-drive']=boundedAround(source['filter-drive'],.14,0,.28,random)
  controls['fold-amount']=boundedAround(source['fold-amount'],.20,0,.72,random)
  controls['fold-drive']=boundedAround(source['fold-drive'],.24,1,1.7,random)
  controls['amp-sat']=boundedAround(source['amp-sat'],.22,0,.42,random)
  controls.tolerance=boundedAround(source.tolerance,.20,0,.38,random)
  controls['pulse-width']=boundedAround(source['pulse-width'],.18,.18,.82,random)
  controls['sub-level']=boundedAround(source['sub-level'],.16,0,.46,random)
  controls['glide-ms']=boundedAround(source['glide-ms'],160,0,320,random)
  controls['velocity-amp']=boundedAround(source['velocity-amp'],.16,0,.48,random)
  controls['velocity-filter']=boundedAround(source['velocity-filter'],.12,-.10,.22,random)
  controls['vco-mod-depth']=boundedAround(source['vco-mod-depth'],.06,0,.12,random)
  controls['pwm-mod-depth']=boundedAround(source['pwm-mod-depth'],.14,0,.48,random)
  controls['vcf-mod-depth']=boundedAround(source['vcf-mod-depth'],.16,0,.58,random)
  const oneShotChance={pluck:.32,arp:.20,bass:.14,lead:.10,keys:.07,pad:.04,drone:.02}[profile]??.07
  controls['lfo-run-mode']=random()<oneShotChance?1:0
  const curveCenter={pluck:-.42,arp:-.24,bass:-.20,lead:-.04,keys:.02,pad:.34,drone:.42}[profile]??0
  controls['env-curve']=clamp(curveCenter+(random()-.5)*.34,-.65,.65)
  const envelope={
    pad:{attack:[220,950],decay:[900,2400],sustain:[.70,.92],release:[1200,3600]},
    bass:{attack:[2,14],decay:[220,700],sustain:[.48,.78],release:[120,520]},
    lead:{attack:[5,35],decay:[280,760],sustain:[.66,.88],release:[260,820]},
    pluck:{attack:[1,8],decay:[180,720],sustain:[.06,.38],release:[140,850]},
    arp:{attack:[1,35],decay:[220,900],sustain:[.34,.74],release:[160,950]},
    keys:{attack:[4,55],decay:[380,1000],sustain:[.52,.82],release:[320,1100]},
    drone:{attack:[80,650],decay:[900,2200],sustain:[.80,.96],release:[1600,4200]},
  }[profile]
  const between=([lo,hi])=>lo+random()*(hi-lo)
  controls['attack-ms']=between(envelope.attack);controls['decay-ms']=between(envelope.decay);controls.sustain=between(envelope.sustain);controls['release-ms']=between(envelope.release)
  // Preserve one curated cable if possible, then permit at most one compatible
  // extra route. This keeps GEN semi-modular without routinely destroying the voice.
  const candidate=generatedPatch('mavis',[anchor],compatibility,random),patch={...candidate,cables:(candidate.cables||[]).slice(0,2)}
  if((patch.cables||[]).some(row=>String(row?.target||'')==='lfo-sync'))controls['lfo-run-mode']=0
  return{patch,anchorPresetId:String(anchor?.id||''),performance:generatedMavisPerformance(anchor,random,seed,profile),profile}
}

const LABYRINTH_VOICE_ANCHOR_CONTROLS=Object.freeze([
  'decay-a','decay-b','eg-trigger-mix','vco-frequency','vco-eg1-amt','vco-seq1-amt','mod-vco-frequency','mod-vco-eg1-amt','mod-vco-seq2-amt',
  'mod-to-vco-fm-amt','vco-level','noise-level','ring-mod-level','noise-tone','mod-vco-level','vcw-fold','vcw-eg1-cv-amt','vcw-seq1-amt',
  'vcw-bias','filter-cutoff','filter-eg1-amt','filter-seq2-amt','filter-resonance','filter-mode','order-mode','blend','volume','u-mix1-level',
  'rift-fold-depth','rift-filter-depth','rift-rise-ms','rift-fall-ms',
])
const LABYRINTH_LENGTH_PAIRS=Object.freeze([[5,7],[3,8],[4,7],[5,6],[7,8],[8,7]])
const LABYRINTH_INTERVAL_SEMITONES=Object.freeze([-12,-7,-5,-4,-3,0,0,3,4,5,7,12])
const LABYRINTH_GEN_REGISTER_SHIFTS=Object.freeze([-5,-3,0,0,0,2,3,5,7,12])
const normalizeLabyrinthRegister=(vcoHz,modHz,random)=>{
  let v=Math.max(20,finite(vcoHz,220)),m=Math.max(20,finite(modHz,164.8138))
  while(v<146.8324){v*=2;m*=2}
  while(v>440){v*=.5;m*=.5}
  const semitones=LABYRINTH_GEN_REGISTER_SHIFTS[Math.floor(random()*LABYRINTH_GEN_REGISTER_SHIFTS.length)%LABYRINTH_GEN_REGISTER_SHIFTS.length]
  const ratio=Math.pow(2,semitones/12)
  v=clamp(v*ratio,130.8128,659.2551);m=clamp(m*ratio,65.4064,987.7666)
  return[v,m]
}
const LABYRINTH_SAFE_PATCH_PAIRS=Object.freeze([
  Object.freeze({source:'seq1-cv',target:'fold'}),Object.freeze({source:'seq2-cv',target:'cutoff'}),
  Object.freeze({source:'seq2-cv',target:'m-vco-1v-oct'}),Object.freeze({source:'seq1-cv',target:'vco-1v-oct'}),
  Object.freeze({source:'seq2-cv',target:'blend'}),Object.freeze({source:'eg1',target:'cutoff'}),
  Object.freeze({source:'eg2',target:'vcw-vca-cv'}),Object.freeze({source:'seq1-trig',target:'bit-flip-2'}),
  Object.freeze({source:'seq2-trig',target:'eg2-trig'}),Object.freeze({source:'m-vco',target:'vcw-in'}),
])
const LABYRINTH_PROFILES=Object.freeze([
  Object.freeze({id:'anchored-drift',domains:[1,2],corrupt:[[.035,.14],[.04,.18]],distance:[[.10,.32],[.12,.36]],relation:[1,2],relationDepth:[.24,.52],returnDepth:[.35,.60],lockCount:[3,2],rift:[.10,.42]}),
  Object.freeze({id:'counterpoint',domains:[1,1],corrupt:[[.025,.11],[.025,.11]],distance:[[.12,.34],[.12,.34]],relation:[3,3],relationDepth:[.52,.82],returnDepth:[.45,.72],lockCount:[3,3],rift:[.12,.48]}),
  Object.freeze({id:'rhythmic-weave',domains:[2,2],corrupt:[[.12,.34],[.14,.38]],distance:[[.22,.48],[.22,.48]],relation:[0,1],relationDepth:[.18,.42],returnDepth:[.30,.58],lockCount:[2,2],rift:[.08,.34]}),
  Object.freeze({id:'fracture-return',domains:[1,2],corrupt:[[.24,.58],[.28,.64]],distance:[[.34,.72],[.30,.68]],relation:[2,3],relationDepth:[.46,.78],returnDepth:[.62,.86],lockCount:[2,2],rift:[.32,.76]}),
])
const labyrinthMask=(count,random)=>{
  const positions=[0,1,2,3,4,5,6,7],selected=[]
  while(selected.length<count&&positions.length){const index=Math.floor(random()*positions.length)%positions.length;selected.push(positions.splice(index,1)[0])}
  return selected.reduce((mask,index)=>mask|(1<<index),0)
}
const labyrinthRange=(range,random)=>range[0]+random()*(range[1]-range[0])
const generatedLabyrinthPatch=(compatibility,random,profile)=>{
  const allowed=new Set(compatiblePairs('labyrinth',compatibility).map(row=>`${row.source}>${row.target}`))
  const candidates=LABYRINTH_SAFE_PATCH_PAIRS.filter(row=>allowed.has(`${row.source}>${row.target}`))
  if(!candidates.length)return{schema:'moog-patch-state-v1',slug:'labyrinth',cables:[]}
  const desired=profile.id==='fracture-return'?3:profile.id==='rhythmic-weave'?2:1+(random()<.42?1:0),pool=[...candidates],cables=[],targets=new Set()
  while(pool.length&&cables.length<desired){const index=Math.floor(random()*pool.length)%pool.length,row=pool.splice(index,1)[0];if(targets.has(row.target))continue;targets.add(row.target);cables.push({...row})}
  return{schema:'moog-patch-state-v1',slug:'labyrinth',cables}
}
const musicalizeLabyrinth=(controls,parents,compatibility,random)=>{
  const anchor=parents[Math.floor(random()*parents.length)%parents.length],source=parameterState(anchor),profile=LABYRINTH_PROFILES[Math.floor(random()*LABYRINTH_PROFILES.length)%LABYRINTH_PROFILES.length]
  for(const id of LABYRINTH_VOICE_ANCHOR_CONTROLS)if(Number.isFinite(Number(source[id])))controls[id]=Number(source[id])
  ;[controls['vco-frequency'],controls['mod-vco-frequency']]=normalizeLabyrinthRegister(controls['vco-frequency'],controls['mod-vco-frequency'],random)
  const [lengthA,lengthB]=LABYRINTH_LENGTH_PAIRS[Math.floor(random()*LABYRINTH_LENGTH_PAIRS.length)%LABYRINTH_LENGTH_PAIRS.length]
  controls['length-a']=lengthA;controls['length-b']=lengthB
  controls['write-offset-a']=Math.floor(random()*lengthA)%lengthA;controls['write-offset-b']=Math.floor(random()*lengthB)%lengthB
  controls['chain-seq']=profile.id==='rhythmic-weave'||(profile.id==='anchored-drift'&&random()<.35)?1:0
  controls['corrupt-a']=Number(labyrinthRange(profile.corrupt[0],random).toPrecision(8));controls['corrupt-b']=Number(labyrinthRange(profile.corrupt[1],random).toPrecision(8))
  controls['mutation-distance-a']=Number(labyrinthRange(profile.distance[0],random).toPrecision(8));controls['mutation-distance-b']=Number(labyrinthRange(profile.distance[1],random).toPrecision(8))
  controls['mutation-domain-a']=profile.domains[0];controls['mutation-domain-b']=profile.domains[1]
  controls['mutation-lock-mask-a']=labyrinthMask(profile.lockCount[0],random);controls['mutation-lock-mask-b']=labyrinthMask(profile.lockCount[1],random)
  const relationMode=profile.relation[Math.floor(random()*profile.relation.length)%profile.relation.length]
  controls['relation-mode']=relationMode
  controls['relation-depth']=relationMode===0?0:Number(labyrinthRange(profile.relationDepth,random).toPrecision(8))
  const semitones=LABYRINTH_INTERVAL_SEMITONES[Math.floor(random()*LABYRINTH_INTERVAL_SEMITONES.length)%LABYRINTH_INTERVAL_SEMITONES.length]
  controls['relation-interval']=relationMode===0?0:semitones/12
  controls['anchor-return-depth']=Number(labyrinthRange(profile.returnDepth,random).toPrecision(8))
  const riftDepth=labyrinthRange(profile.rift,random)
  controls['rift-fold-depth']=clamp(finite(source['rift-fold-depth'],0)*.45+riftDepth*.55,-1,1)
  controls['rift-filter-depth']=clamp(finite(source['rift-filter-depth'],0)*.45+(random()<.5?-1:1)*riftDepth*.42,-1,1)
  controls['rift-rise-ms']=clamp(Math.max(0,finite(source['rift-rise-ms'],18))*(.55+random()*1.25),0,1800)
  controls['rift-fall-ms']=clamp(Math.max(20,finite(source['rift-fall-ms'],360))*(.55+random()*1.30),20,3200)
  controls['filter-resonance']=clamp(finite(source['filter-resonance'],.3)+(random()-.5)*.12,0,.78)
  controls.volume=clamp(finite(source.volume,.75)+(random()-.5)*.08,.56,.84)
  controls.blend=clamp(finite(source.blend,.5)+(random()-.5)*.20,0,1)
  return{patch:generatedLabyrinthPatch(compatibility,random,profile),anchorPresetId:String(anchor?.id||''),profile:profile.id}
}

const enforceGeneratedProductLaws=(slug,controls,patch)=>{
  if(String(slug||'')!=='mavis')return controls
  const targets=new Set((patch?.cables||[]).map(row=>String(row?.target||'')))
  // A generated SUB IN cable is not useful behind a zero SUB LEVEL. SUB CV
  // likewise needs headroom or its positive modulation immediately clips.
  if(targets.has('sub-in'))controls['sub-level']=Math.max(.18,finite(controls['sub-level'],0))
  if(targets.has('sub-cv'))controls['sub-level']=clamp(finite(controls['sub-level'],0),.08,.72)
  // LFO RESET is only causal in EXT RESET mode. A generated reset cable therefore
  // overrides the normally preserved session sync mode instead of creating a dead cable.
  if(targets.has('lfo-sync'))controls['lfo-sync-mode']=1
  return controls
}

const GENERATED_IDENTITY_BANKS=Object.freeze({
  labyrinth:Object.freeze({a:['Fractal','Shifting','Tangled','Oblique','Nested','Spiral','Branching','Errant','Kinetic','Lucid','Twisted','Vector'],b:['Orbit','Knot','Branch','Maze','Vector','Circuit','Spiral','Path','Current','Arc','Thread','Field'],categories:['Generative','Sequence','Lead','Experimental'],tags:['mutation','motion','sequence','probability','cross-mod','evolving']}),
  spectravox:Object.freeze({a:['Glass','Hollow','Luminous','Veiled','Prismatic','Silver','Breathing','Diffuse','Spectral','Airy','Resonant','Frosted'],b:['Prism','Formant','Vapor','Chamber','Spectrum','Voice','Halo','Band','Glass','Current','Mist','Trace'],categories:['Spectral','Vocal','FX','Drone'],tags:['formant','spectral','filter-bank','voice','texture','resonance']}),
  subharmonicon:Object.freeze({a:['Nested','Ratio','Orbital','Divided','Slow','Interlocked','Harmonic','Circular','Measured','Braided','Pulsed','Parallel'],b:['Lattice','Cycle','Chord','Orbit','Ratio','Pulse','Wheel','Grid','Figure','Phase','Canon','Pattern'],categories:['Polyrhythm','Bass','Drone','Sequence'],tags:['ratio','polyrhythm','subharmonic','pulse','chord','cycle']}),
  mavis:Object.freeze({a:['Warm','Round','Velvet','Bright','Soft','Singing','Gliding','Folded','Pulse','Blooming','Copper','Silk'],b:['Bass','Lead','Keys','Pad','Pluck','Pulse','Arp','Motion','Tone','Chord','Bell','String'],categories:['Bass','Lead','Keys','Pad','Pluck','Arp'],tags:['bread-and-butter','mono','performance','filter','velocity','arp']}),
  dfam:Object.freeze({a:['Iron','Dusty','Crushed','Taut','Heavy','Dry','Broken','Stamped','Granite','Elastic','Rusted','Hard'],b:['Impact','Strike','Crater','Skin','Rattle','Step','Hammer','Pulse','Frame','Drift','Rim','Pattern'],categories:['Percussive','Bass','Sequence','FX'],tags:['percussion','impact','sequence','noise','rhythm','decay']}),
  mother32:Object.freeze({a:['Stepped','Linear','Quiet','Running','Bent','Measured','Night','Open','Drifting','Narrow','Ascending','Woven'],b:['Path','Phrase','Thread','March','Line','Gate','Verse','Trace','Route','Sequence','Arc','Pulse'],categories:['Sequence','Bass','Lead','Drone'],tags:['sequence','mono','gate','glide','pattern','modulation']}),
})
const identityHash=text=>{let value=2166136261;for(const char of String(text)){value^=char.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0}
const generatedIdentity=(slug,seed)=>{
  const productSlug=String(slug||''),bank=GENERATED_IDENTITY_BANKS[productSlug]||Object.freeze({a:['Liminal','Moving','Quiet','Open'],b:['State','Field','Arc','Trace'],categories:['Generated'],tags:['generated','variation','state','motion']})
  const random=makeRandom(identityHash(`${productSlug}:${Number(seed)>>>0}:preset-identity-v1`)),pick=list=>list[Math.floor(random()*list.length)%list.length],name=`${pick(bank.a)} ${pick(bank.b)}`,category=pick(bank.categories),tagCount=2+(random()>.72?1:0),tags=[]
  while(tags.length<tagCount&&tags.length<bank.tags.length){const tag=pick(bank.tags);if(!tags.includes(tag))tags.push(tag)}
  return{schema:'moog-generated-identity-v1',name,category,tags,generated:true,seed:Number(seed)>>>0}
}

// MONODIA CORE: recipes describe musical roles, not random parent presets.
// These ranges are authoring decisions, not claims of reference-synth parity.
export const MONODIA_CORE_ARCHETYPES=Object.freeze({
 'classic-bass':Object.freeze({category:'Bass',name:'Basso',role:'Single classic oscillator, short envelope and restrained resonance',fixed:{'vco-wave':0,'sustain-mode':1},ranges:{'filter-cutoff':[.32,.50],'filter-resonance':[.12,.30],'attack-ms':[1,7],'decay-ms':[140,360],'pulse-width':[.35,.55]},patch:[{source:'eg',target:'vcf-cutoff'}]}),
 'classic-lead':Object.freeze({category:'Lead',name:'Canto',role:'Envelope-gated lead with gentle glide and pulse colour',fixed:{'vco-wave':1,'sustain-mode':1},ranges:{'filter-cutoff':[.58,.78],'filter-resonance':[.10,.24],'attack-ms':[4,18],'decay-ms':[170,380],'glide-ms':[15,65],'pulse-width':[.32,.65]},patch:[]}),
 'sub-bass':Object.freeze({category:'Bass',name:'Fondamento',role:'Classic body supported by a protected sine sub',fixed:{'vco-wave':1,'sustain-mode':1,'sub-octave':-1,'sub-shape':0,'sub-protect':1,'sub-sustain':.75},ranges:{'sub-level':[.28,.46],'filter-cutoff':[.28,.43],'filter-resonance':[.05,.18],'sub-attack-ms':[2,7],'sub-decay-ms':[120,240],'sub-release-ms':[55,110]},patch:[]}),
 'harmonic-pluck':Object.freeze({category:'Pluck',name:'Rame',role:'Plucked harmonic body with a falling partial spectrum',fixed:{'sustain-mode':0,'body-partial-count':8,'body-odd-even':0},ranges:{'body-level':[.20,.34],'filter-cutoff':[.50,.69],'attack-ms':[.8,4],'decay-ms':[110,260]},harmonics:true,patch:[{source:'eg',target:'vcf-cutoff'}]}),
 'body-motion':Object.freeze({category:'Bass',name:'Trama',role:'Slow detuned body, controlled width without heavy FM',fixed:{'sustain-mode':1,'body-motion-shape':.55},ranges:{'body-motion-level':[.12,.23],'body-motion-detune-cents':[7,19],'body-motion-pm-depth':[0,.04],'filter-cutoff':[.42,.62],'attack-ms':[8,24],'decay-ms':[170,380]},patch:[]}),
 'timbre-motion':Object.freeze({category:'Texture',name:'Prisma',role:'Moving timbre field sharing the classic filter and envelope',fixed:{'sustain-mode':1,'timbre-y-mode':1,'timbre-z-mode':1,'timbre-smooth-ms':16,'mod-slot-1-source':1,'mod-slot-1-destination':9,'mod-slot-1-source-mode':0,'mod-slot-1-smoothing-ms':12},ranges:{'timbre-level':[.24,.42],'timbre-x':[.20,.66],'timbre-y':[.10,.32],'timbre-z':[-.16,.16],'mod-slot-1-amount':[.06,.16],'lfo-rate-hz':[.18,.85],'filter-cutoff':[.55,.75],'attack-ms':[10,45],'decay-ms':[240,480]},patch:[]}),
 'noise-percussion':Object.freeze({category:'Percussion',name:'Scatto',role:'Noise-dominant high-pass percussion with a short tonal attack',fixed:{'sustain-mode':0,'mix':.86,'filter-mode':0},ranges:{'noise-level':[.08,.18],'noise-color':[.2,1.8],'noise-decay-ms':[35,105],'attack-level':[.025,.09],'attack-decay-ms':[18,55],'attack-ms':[.2,2],'decay-ms':[65,140],'filter-cutoff':[.56,.78],'filter-resonance':[.04,.14]},patch:[{source:'eg',target:'vcf-cutoff'}]}),
})

// Frozen, original authoring recipes. Listening approval is deliberately separate.
export const MONODIA_CORE_FACTORY_RECIPES=Object.freeze([
 {id:'velluto-basso',name:'Velluto Basso',archetype:'classic-bass',seed:8101,controls:{'filter-cutoff':.38,'filter-resonance':.12,'attack-ms':3,'decay-ms':420,'sustain-mode':1,'pulse-width':.50,'output-level':.50},patch:[{source:'eg',target:'vcf-cutoff'}],sequence:{tempo:92,swing:.53,notes:[36,36,43,46,48,43,39,43,36,48,46,43,39,43,46,48],gates:[112,76,90,98,112,82,76,92],accents:[127,0,0,72,96,0,0,48],glides:[0,0,0,64,0,0,0,48]}},
 {id:'sottosuolo',name:'Sottosuolo',archetype:'sub-bass',seed:8203,controls:{'sub-level':.44,'sub-octave':-2,'filter-cutoff':.29,'filter-resonance':.08,'sub-sustain':.82,'sub-release-ms':115,'sustain-mode':1,'output-level':.48},sequence:{tempo:86,swing:.50,notes:[36,36,31,34,36,43,34,31,36,39,43,46,43,39,34,31],gates:[116,84,76,92,116,84,92,76],accents:[127,0,0,56,96,0,64,0],glides:[0,0,48,0,0,64,0,0]}},
 {id:'seta',name:'Seta',archetype:'classic-lead',seed:8309,controls:{'filter-cutoff':.63,'filter-resonance':.10,'attack-ms':14,'decay-ms':360,'pulse-width':.44,'glide-ms':42,'output-level':.48},sequence:{tempo:104,swing:.51,notes:[60,63,67,70,67,72,70,67,63,67,70,75,72,70,67,63],gates:[104,92,110,96,104,116,90,98],accents:[96,0,32,0,72,0,48,0],glides:[0,48,0,64,0,80,0,48]}},
 {id:'rame-chiaro',name:'Rame Chiaro',archetype:'harmonic-pluck',seed:8407,controls:{'body-level':.32,'filter-cutoff':.69,'filter-resonance':.12,'decay-ms':175,'body-odd-even':.18,'output-level':.50},patch:[{source:'eg',target:'vcf-cutoff'}],sequence:{tempo:116,swing:.50,notes:[60,67,63,70,72,67,75,70,60,67,63,72,70,75,67,63],gates:[70,62,68,58,74,62,66,58],rests:[0,0,0,0,0,0,0,127],accents:[112,0,48,0,96,0,56,0],ratchets:[0,0,0,0,0,0,64,0]}},
 {id:'rame-ombra',name:'Rame Ombra',archetype:'harmonic-pluck',seed:8501,controls:{'body-level':.28,'filter-cutoff':.45,'filter-resonance':.15,'decay-ms':260,'body-odd-even':-.22,'body-formant-shift-semitones':-5,'output-level':.52},patch:[{source:'eg',target:'vcf-cutoff'}],sequence:{tempo:98,swing:.56,notes:[55,62,58,65,67,62,70,65,55,58,62,67,65,62,58,53],gates:[82,68,76,64,86,70,78,62],rests:[0,0,0,127,0,0,0,127],accents:[96,0,0,0,72,0,48,0]}},
 {id:'trama-profonda',name:'Trama Profonda',archetype:'body-motion',seed:8609,controls:{'body-motion-level':.20,'body-motion-detune-cents':12,'body-motion-pm-depth':.018,'body-motion-shape':.44,'filter-cutoff':.50,'filter-resonance':.10,'attack-ms':12,'decay-ms':390,'output-level':.48},sequence:{tempo:84,swing:.52,notes:[41,48,53,48,39,46,51,46,41,53,48,46,39,51,46,48],gates:[118,96,110,92,118,92,106,88],accents:[96,0,48,0,80,0,32,0],glides:[0,0,64,0,0,0,48,0]}},
 {id:'trama-aperta',name:'Trama Aperta',archetype:'body-motion',seed:8707,controls:{'body-motion-level':.16,'body-motion-detune-cents':17,'body-motion-pm-depth':.03,'body-motion-shape':.62,'filter-cutoff':.64,'filter-resonance':.08,'attack-ms':20,'decay-ms':460,'lfo-rate-hz':.42,'output-level':.47},patch:[{source:'lfo-triangle',target:'vcf-cutoff'}],sequence:{tempo:76,swing:.50,notes:[48,55,60,62,60,55,53,55,48,60,62,67,65,62,60,55],gates:[122,108,116,104,122,110,116,100],accents:[80,0,32,0,72,0,40,0]}},
 {id:'prisma-dolce',name:'Prisma Dolce',archetype:'timbre-motion',seed:8803,controls:{'timbre-level':.32,'timbre-x':.38,'timbre-y':.18,'timbre-z':-.05,'timbre-orbit-depth':.12,'timbre-smooth-ms':22,'filter-cutoff':.58,'filter-resonance':.07,'attack-ms':28,'decay-ms':520,'output-level':.46},sequence:{tempo:78,swing:.50,notes:[60,63,67,70,72,70,67,63,58,62,65,69,70,69,65,62],gates:[120,108,116,104,120,112,116,100],accents:[72,0,32,0,64,0,24,0]},motion:{a:[22,28,36,48,60,72,84,94,102,94,84,72,60,48,36,28],b:[18,22,30,42,58,74,88,98,106,98,88,74,58,42,30,22],aDepth:.24,bDepth:.18}},
 {id:'prisma-vivo',name:'Prisma Vivo',archetype:'timbre-motion',seed:8909,controls:{'timbre-level':.38,'timbre-x':.61,'timbre-y':.28,'timbre-z':.10,'timbre-orbit-depth':.24,'timbre-smooth-ms':12,'filter-cutoff':.68,'filter-resonance':.10,'attack-ms':8,'decay-ms':330,'output-level':.46},sequence:{tempo:108,swing:.54,notes:[60,67,70,72,75,72,70,67,63,70,72,77,75,72,70,67],gates:[92,76,88,72,96,80,88,70],accents:[112,0,48,0,96,0,64,0],glides:[0,0,48,0,0,64,0,0]},motion:{a:[28,46,68,92,108,84,58,34,20,40,66,96,112,88,60,36],b:[92,78,58,34,22,42,68,98,108,88,60,36,20,44,72,96],aDepth:.34,bDepth:.28}},
 {id:'scatto-legno',name:'Scatto Legno',archetype:'noise-percussion',seed:9001,controls:{'mix':.78,'filter-mode':0,'filter-cutoff':.66,'filter-resonance':.06,'noise-level':.11,'noise-color':.35,'attack-level':.042,'noise-decay-ms':72,'attack-decay-ms':28,'attack-ms':.4,'decay-ms':110,'output-level':.46},patch:[{source:'eg',target:'vcf-cutoff'}],sequence:{tempo:112,swing:.58,notes:[48,48,55,48,51,48,58,48,48,55,51,48,60,48,55,46],gates:[48,40,44,36,52,40,44,32],rests:[0,127,0,0,0,127,0,0,0,0,127,0,0,0,127,0],accents:[127,0,72,0,96,0,64,0],ratchets:[0,0,0,0,64,0,0,0]}},
 {id:'notte-lunga',name:'Notte Lunga',archetype:'classic-lead',seed:9103,controls:{'filter-cutoff':.48,'filter-resonance':.17,'attack-ms':68,'decay-ms':760,'pulse-width':.57,'glide-ms':88,'lfo-rate-hz':.20,'vco-mod-amount':.035,'output-level':.46},patch:[{source:'lfo-triangle',target:'vco-mod'}],sequence:{tempo:68,swing:.50,notes:[48,55,58,60,63,60,58,55,46,53,55,58,60,58,55,53],gates:[127,120,127,116,127,120,127,112],rests:[0,0,0,127,0,0,0,127],accents:[64,0,0,0,48,0,0,0],glides:[0,64,80,0,0,64,80,0]}},
 {id:'giro-dorico',name:'Giro Dorico',archetype:'classic-bass',seed:9209,controls:{'filter-cutoff':.50,'filter-resonance':.18,'attack-ms':2,'decay-ms':245,'sustain-mode':0,'pulse-width':.38,'output-level':.50},patch:[{source:'eg',target:'vcf-cutoff'}],sequence:{tempo:124,swing:.57,notes:[38,41,45,48,50,48,45,41,38,45,48,53,50,48,45,41],gates:[82,64,74,58,86,66,76,56],rests:[0,0,0,0,0,127,0,0,0,0,127,0,0,0,0,127],accents:[127,0,48,0,96,0,64,0],glides:[0,0,0,48,0,0,64,0],ratchets:[0,0,0,0,0,0,64,0]}}
].map(Object.freeze))

const applyFactorySequence=(controls,recipe,specs)=>{
 const sequence=recipe.sequence
 if(sequence){
  const put=(id,value)=>{const spec=specs.get(id);if(!spec||!Number.isFinite(Number(value))||Number(value)<Number(spec.minimum)||Number(value)>Number(spec.maximum))throw new Error('monodiaGenerator.factorySequenceInvalid:'+id);controls[id]=Number(value)}
  put('tempo-bpm',sequence.tempo??120);put('sequence-end-step',15);put('sequence-direction',sequence.direction??0);put('sequence-random',0);put('swing-amount',sequence.swing??.5)
  const lanes={note:sequence.notes||[60],gate:sequence.gates||[96],rest:sequence.rests||[0],accent:sequence.accents||[0],glide:sequence.glides||[0],ratchet:sequence.ratchets||[0]}
  for(const [lane,values] of Object.entries(lanes))for(let step=1;step<=32;step++)put(lane+'-step-'+step,Number(values[(step-1)%values.length]))
 }
 const motion=recipe.motion
 if(motion){
  const put=(id,value)=>{const spec=specs.get(id);if(!spec||!Number.isFinite(Number(value))||Number(value)<Number(spec.minimum)||Number(value)>Number(spec.maximum))throw new Error('monodiaGenerator.factoryMotionInvalid:'+id);controls[id]=Number(value)}
  put('motion-a-destination',9);put('motion-a-depth',motion.aDepth??.2);put('motion-a-mode',1);put('motion-a-curve',3);put('motion-a-smoothing-ms',12)
  put('motion-b-destination',10);put('motion-b-depth',motion.bDepth??.15);put('motion-b-mode',1);put('motion-b-curve',3);put('motion-b-smoothing-ms',12)
  for(let step=1;step<=32;step++){put('motion-a-step-'+step,Number(motion.a[(step-1)%motion.a.length]));put('motion-b-step-'+step,Number(motion.b[(step-1)%motion.b.length]))}
 }
}

const MONODIA_SESSION_CONTROL=/^(?:midi-|keyboard-|pitch-bend-|tuning-|mpe-|transport-|host-|tempo-|sequence-|swing-|motion-|lock-|condition-|probability-|note-step-|gate-step-|rest-step-|accent-step-|glide-step-|ratchet-step-|assign-|load-saved-timing$|delay-pattern-change$)|-step-\d+$/
export function generateMonodiaCoreState({semantic,currentState,compatibility,seed=0,archetype=null}={}){
 if(currentState?.schema!=='moog-eurorack-product-state-v2'||currentState.productId!=='monodia-coreplus-sub-development-v1')throw new Error('monodiaGenerator.productIdentityInvalid')
 const specs=new Map((semantic?.controls||[]).map(row=>[String(row.id),row]))
 if(!specs.has('timbre-level')||!specs.has('sub-level')||!specs.has('body-level'))throw new Error('monodiaGenerator.coreCapabilityMissing')
 if(!Number.isInteger(Number(seed))||Number(seed)<0||Number(seed)>0xffffffff)throw new Error('monodiaGenerator.seedInvalid')
 const random=makeRandom(seed),keys=Object.keys(MONODIA_CORE_ARCHETYPES),profileId=archetype||keys[Math.floor(random()*keys.length)],profile=MONODIA_CORE_ARCHETYPES[profileId]
 if(!profile)throw new Error('monodiaGenerator.archetypeInvalid')
 const controls={},preserved=[]
 const put=(id,value)=>{
  const spec=specs.get(id);if(!spec)throw new Error('monodiaGenerator.controlMissing:'+id)
  if(typeof value!=='number'||!Number.isFinite(value)||value<Number(spec.minimum)||value>Number(spec.maximum))throw new Error('monodiaGenerator.controlRange:'+id)
  controls[id]=value
 }
 for(const[id,spec]of specs){
  const fallback=Number(spec.default??spec.defaultValue)
  const keep=MONODIA_SESSION_CONTROL.test(id)&&Object.hasOwn(currentState.controls||{},id)
  put(id,keep?currentState.controls[id]:fallback)
  if(keep)preserved.push(id)
 }
 // All additional generators begin neutral; only the selected role opens a layer.
 const neutral={'mix':0,'vco-frequency-hz':261.6255653005986,'vco-mod-amount':0,'vcf-mod-amount':0,
  'glide-ms':0,'vca-mode':0,'sustain-mode':1,'attack-ms':4,'decay-ms':220,'filter-mode':0,
  'filter-cutoff':.55,'filter-resonance':.16,'output-level':.52,'sub-level':0,'body-level':0,
  'body-motion-level':0,'attack-level':0,'noise-level':0,'timbre-level':0,'timbre-orbit-depth':0,
  'texture-am-amount':0,'texture-ring-amount':0,'texture-corrosion':0,'voice-pre-mix':0,'voice-post-mix':0,
  'bass-sub-regen':0,'pitch-env-depth':0,'master-compressor-mix':0,'master-limiter-enabled':0}
 for(const[id,value]of Object.entries(neutral))put(id,value)
 for(const[id,value]of Object.entries(profile.fixed||{}))put(id,value)
 for(const[id,[lo,hi]]of Object.entries(profile.ranges||{}))put(id,Number((lo+(hi-lo)*random()).toPrecision(12)))
 if(profile.harmonics){const slope=1.1+random()*.7;for(let i=1;i<=16;i++)put('body-partial-'+String(i).padStart(2,'0'),i<=8?Number((1/Math.pow(i,slope)).toPrecision(12)):0)}
 const patch={schema:'moog-patch-state-v1',slug:'mother32',cables:copy(profile.patch||[])}
 // Keeping a FILE descriptor does not authorize repatching an internal feedback
 // cable. Only preserve an already-authored external source marker.
 const external=(currentState.patchState?.cables||[]).find(row=>row.target==='external-audio'&&row.externalAudio===true)
 if(external)patch.cables.push(copy(external))
 if(compatibility){for(const cable of patch.cables){const target=(compatibility.targets||[]).find(row=>row.id===cable.target),option=cable.externalAudio?'external-audio':'source:'+cable.source;if(!target?.options?.some(row=>row.id===option))throw new Error('monodiaGenerator.patchUnavailable:'+option+'>'+cable.target)}}
 const macros=Object.fromEntries((semantic?.macros||[]).map(row=>[row.id,Number(row.default??row.defaultValue??0)]))
 const state={...copy(currentState),sourcePresetId:'',controls,macros,patchState:patch}
 const identity={schema:'moog-generated-identity-v1',name:profile.name+' '+String(Number(seed)>>>0).padStart(8,'0'),category:profile.category,tags:['core',profileId],generated:true,seed:Number(seed)>>>0}
 return{schema:'moog-generated-state-result-v1',strategy:'monodia-core-archetypes-v1',seed:Number(seed)>>>0,parentPresetIds:[],musicalProfile:profileId,musicalRole:profile.role,preservedSessionControls:preserved,identity,generatedName:identity.name,state}
}

export function createMonodiaCoreFactoryState({recipeId,semantic,currentState,compatibility}={}){
 const recipe=MONODIA_CORE_FACTORY_RECIPES.find(row=>row.id===recipeId)
 if(!recipe)throw new Error('monodiaGenerator.factoryRecipeMissing')
 const result=generateMonodiaCoreState({semantic,currentState,compatibility,seed:recipe.seed,archetype:recipe.archetype})
 const specs=new Map((semantic?.controls||[]).map(row=>[row.id,row]))
 for(const[id,value]of Object.entries(recipe.controls||{})){
  const spec=specs.get(id)
  if(!spec||!Number.isFinite(value)||value<spec.minimum||value>spec.maximum||MONODIA_SESSION_CONTROL.test(id))throw new Error('monodiaGenerator.factoryControlInvalid:'+id)
  result.state.controls[id]=value
 }
 // GEN is sound-only and preserves the user's active sequence. Factory states are
 // different: they are authored complete musical states and deliberately own a
 // pattern/motion snapshot as part of the preset.
 applyFactorySequence(result.state.controls,recipe,specs)
 if(recipe.patch){
  const patch={schema:'moog-patch-state-v1',slug:'mother32',cables:copy(recipe.patch)}
  if(compatibility)for(const cable of patch.cables){const target=(compatibility.targets||[]).find(row=>row.id===cable.target),option=cable.externalAudio?'external-audio':'source:'+cable.source;if(!target?.options?.some(row=>row.id===option))throw new Error('monodiaGenerator.factoryPatchUnavailable:'+option+'>'+cable.target)}
  result.state.patchState=patch
 }
 result.identity={...result.identity,name:recipe.name,generated:false,tags:['original',recipe.archetype,'complete-state']};result.generatedName=recipe.name
 return result
}

export function generateMoogProductState({slug,semantic,manifest,currentState,compatibility,seed=randomWord(),archetype=null}={}){
  // A capability-scoped strategy of this SAME complete-state generator.
  // The stable classic product and the other five products keep their existing law.
  if(String(slug)==='mother32'&&currentState?.productId==='monodia-coreplus-sub-development-v1'&&(semantic?.controls||[]).some(row=>row.id==='timbre-level'))return generateMonodiaCoreState({semantic,currentState,compatibility,seed,archetype})
  const presets=(manifest?.presets||[]).filter(row=>Object.keys(parameterState(row)).length)
  if(presets.length<2)throw new Error('moogGenerator.factoryStatesMissing')
  const random=makeRandom(seed),firstIndex=Math.floor(random()*presets.length)%presets.length,secondOffset=1+Math.floor(random()*(presets.length-1)),secondIndex=(firstIndex+secondOffset)%presets.length,parents=[presets[firstIndex],presets[secondIndex]],a=parameterState(parents[0]),b=parameterState(parents[1]),controls={}
  for(const spec of semantic?.controls||[]){const id=String(spec?.id||''),fallback=finite(spec?.default,finite(spec?.defaultValue,0));if(SESSION_SYNC_CONTROL.test(id)){controls[id]=finite(currentState?.controls?.[id],fallback);continue}const av=finite(a[id],fallback),bv=finite(b[id],av);controls[id]=generatedValue(spec,av,bv,random)}
  for(const [id,value] of Object.entries(GENERATED_CONTROL_OVERRIDES[String(slug||'')]||{}))if(Object.hasOwn(controls,id))controls[id]=value
  const productSlug=String(slug||''),mother32=productSlug==='mother32'?musicalizeMother32(controls,parents,compatibility,random):null,mavis=productSlug==='mavis'?musicalizeMavis(controls,presets,compatibility,random,seed):null,labyrinth=productSlug==='labyrinth'?musicalizeLabyrinth(controls,parents,compatibility,random):null
  const patch=mother32?.patch||mavis?.patch||labyrinth?.patch||generatedPatch(productSlug,parents,compatibility,random),current=copy(currentState||{}),macros={}
  enforceGeneratedProductLaws(productSlug,controls,patch)
  for(const macro of semantic?.macros||[])macros[String(macro.id||'')]=finite(macro?.default,finite(macro?.defaultValue,0))
  const state={...current,schema:String(current?.schema||'moog-eurorack-product-state-v2'),sourcePresetId:'',controls,macros,patchState:patch}
  const fingerprint=canonical({controls,patchState:patch}),factoryFingerprints=new Set(presets.map(row=>canonical({controls:parameterState(row),patchState:patchState(row)})))
  if(factoryFingerprints.has(fingerprint)){
    const spec=(semantic?.controls||[]).find(row=>!choiceValues(row).length&&finite(row?.maximum,0)>finite(row?.minimum,0))
    if(spec){const id=String(spec.id),minimum=finite(spec.minimum,0),maximum=finite(spec.maximum,1);controls[id]=clamp(finite(controls[id],minimum)+(maximum-minimum)*.0137,minimum,maximum)}
  }
  const identity=generatedIdentity(productSlug,seed)
  return{schema:'moog-generated-state-result-v1',seed:Number(seed)>>>0,parentPresetIds:parents.map(row=>String(row.id||'')),...(mother32?.anchorPresetId?{musicalAnchorPresetId:mother32.anchorPresetId}:{}),...(mavis?.anchorPresetId?{musicalAnchorPresetId:mavis.anchorPresetId,musicalProfile:mavis.profile,performance:mavis.performance}:{}),...(labyrinth?.anchorPresetId?{musicalAnchorPresetId:labyrinth.anchorPresetId,musicalProfile:labyrinth.profile}:{}),identity,generatedName:identity.name,state}
}
