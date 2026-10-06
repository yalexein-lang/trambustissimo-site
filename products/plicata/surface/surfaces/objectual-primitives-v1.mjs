import {createFoundryMoogStandardRound} from './foundry-moog-standard-renderer-v1.mjs'
import {createFoundryMoogLargeRound} from './foundry-moog-large-renderer-v1.mjs'
import {createMoogCompactBlackKnob} from './moog-compact-black-knob-renderer-v1.mjs?sha=a75560d90ff42a3765780da2551083a2274f0a648b1ebe19e8ea7ee10539a3ce'
import {createFoundryMavisSoftKey,createFoundryMoogSoftKey,createTrambustissimoRoundPanelButton} from './foundry-objectual-button-renderer-v1.mjs'
import {createFoundryMoogThreeWayToggleLever,createFoundryMoogToggleLever} from './foundry-objectual-toggle-renderer-v1.mjs'
import {createTrambustissimoSmallBlackKnob,createTrambustissimoMediumBlackKnob,createTrambustissimoLargeBlackKnob} from './trambustissimo-black-knob-renderer-v1.mjs?sha=dc9f6ecc35292976e468bc641011e0a84ff9b96d4c5bcd8236c1bccabca7fad4'
import {createControlWriteScheduler,installHorizontalContinuousDrag,installVerticalContinuousDrag,registerControlGestureCancellation} from './continuous-control-gesture-v1.mjs'

export const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)))

const KNOB_ASSET_FAMILIES=Object.freeze({})
const FOUNDRY_KNOB_FAMILIES=Object.freeze(new Set(['objectual-moog-standard-round','objectual-moog-large-round','moog-compact-black-v1','trambustissimo-black-small-v1','trambustissimo-black-medium-v1','trambustissimo-black-large-v1']))

function knobAppearanceLayers(familyId){
  const family=KNOB_ASSET_FAMILIES[familyId]
  if(family){
    const base=el('img','obj-knob-asset obj-knob-asset--base'),cap=el('img','obj-knob-asset obj-knob-asset--cap')
    base.src=family.base;cap.src=family.cap;base.alt=cap.alt='';base.draggable=cap.draggable=false
    base.decoding=cap.decoding='async'
    return{nodes:[base,cap],familyId}
  }
  if(FOUNDRY_KNOB_FAMILIES.has(familyId)){
    const renderer=familyId==='trambustissimo-black-small-v1'?createTrambustissimoSmallBlackKnob():familyId==='trambustissimo-black-medium-v1'?createTrambustissimoMediumBlackKnob():familyId==='trambustissimo-black-large-v1'?createTrambustissimoLargeBlackKnob():familyId==='moog-compact-black-v1'?createMoogCompactBlackKnob():familyId==='objectual-moog-large-round'?createFoundryMoogLargeRound():createFoundryMoogStandardRound()
    return{nodes:[renderer.node],familyId,setRotation:renderer.setRotation}
  }
  return null
}

export function semanticReviewId(slug,kind,id){
  return `${slug}.${kind}.${String(id).replace(/[^a-zA-Z0-9._-]/g,'-')}`
}

export function markReview(node,id){
  node.dataset.reviewId=id
  node.classList.add('review-target')
  return node
}

export function el(tag,className='',text=''){
  const node=document.createElement(tag)
  if(className)node.className=className
  if(text!==undefined&&text!==null&&String(text)!=='')node.textContent=String(text)
  return node
}

export function controlNormalized(spec,value){
  const min=Number(spec.minimum),max=Number(spec.maximum),v=clamp(value,min,max)
  if(spec.scale==='log'&&min>0&&max>min)return clamp(Math.log(v/min)/Math.log(max/min),0,1)
  if(spec.scale==='square'&&max>min)return Math.sqrt(clamp((v-min)/(max-min),0,1))
  return max>min?clamp((v-min)/(max-min),0,1):0
}

export function controlFromNormalized(spec,normalized){
  const n=clamp(normalized,0,1),min=Number(spec.minimum),max=Number(spec.maximum)
  let value=spec.scale==='log'&&min>0&&max>min?min*Math.pow(max/min,n):spec.scale==='square'&&max>min?min+(max-min)*n*n:min+(max-min)*n
  if(spec.quantize){
    const q=Math.max(Number(spec.quantize),Number.EPSILON)
    value=min+Math.round((value-min)/q)*q
  }
  return clamp(value,min,max)
}

export function displayValue(spec,value){
  const n=Number(value)
  if(Array.isArray(spec.choices)){
    const row=spec.choices.find(choice=>Math.abs(Number(choice.value)-n)<1e-9)
    if(row)return String(row.label??row.value)
  }
  if(!Number.isFinite(n))return String(value??'')
  if(spec.format==='hz')return n>=1000?`${(n/1000).toFixed(2)} kHz`:`${n.toFixed(n<10?2:1)} Hz`
  if(spec.format==='ms')return n>=1000?`${(n/1000).toFixed(2)} s`:`${n.toFixed(n<10?2:0)} ms`
  if(spec.format==='seconds')return `${n.toFixed(n<1?2:n<10?1:0)} s`
  if(spec.format==='db')return `${n.toFixed(1)} dB`
  if(spec.format==='semitones'){
    const text=Math.abs(n)>=10?n.toFixed(0):n.toFixed(1).replace(/\.0$/,'')
    return `${n>0?'+':''}${text} st`
  }
  if(Math.abs(n)>=1000)return n.toFixed(0)
  if(Number.isInteger(n))return String(n)
  return n.toPrecision(4).replace(/\.?0+$/,'')
}

function controlResetValue(spec,choices=[]){
  const finiteChoices=(Array.isArray(choices)?choices:[]).map(row=>Number(row?.value)).filter(Number.isFinite)
  let value=Number(spec?.default??spec?.defaultValue)
  if(!Number.isFinite(value)){
    if(finiteChoices.length){const zero=finiteChoices.find(row=>Math.abs(row)<1e-9);value=Number.isFinite(zero)?zero:finiteChoices[0]}
    else{const minimum=Number(spec?.minimum),maximum=Number(spec?.maximum);value=Number.isFinite(minimum)&&Number.isFinite(maximum)&&minimum<=0&&maximum>=0?0:minimum}
  }
  if(finiteChoices.length)return finiteChoices.reduce((best,row)=>Math.abs(row-value)<Math.abs(best-value)?row:best,finiteChoices[0])
  const minimum=Number(spec?.minimum),maximum=Number(spec?.maximum),quantize=Number(spec?.quantize)
  if(Number.isFinite(quantize)&&quantize>0&&Number.isFinite(minimum))value=minimum+Math.round((value-minimum)/quantize)*quantize
  if(Number.isFinite(minimum)&&Number.isFinite(maximum))value=clamp(value,minimum,maximum)
  return Number.isFinite(value)?value:null
}

function installControlDefaultReset(target,{spec,api,endpointId,sync,choices=[],writeValue}={}){
  if(!(target instanceof HTMLElement))return()=>{}
  const resetValue=controlResetValue(spec,choices);if(!Number.isFinite(resetValue))return()=>{}
  let lastTouchAt=-Infinity,lastTouchX=0,lastTouchY=0,suppressClickUntil=0;const starts=new Map()
  const write=()=>{if(typeof writeValue==='function')writeValue(resetValue);else{api.write(endpointId,resetValue);sync?.(resetValue)}}
  const reset=event=>{event?.preventDefault?.();event?.stopPropagation?.();write()}
  const onPointerDown=event=>{if(!['touch','pen'].includes(String(event.pointerType||'')))return;starts.set(event.pointerId,{x:event.clientX,y:event.clientY})}
  const onPointerUp=event=>{if(!['touch','pen'].includes(String(event.pointerType||'')))return;const start=starts.get(event.pointerId);starts.delete(event.pointerId);if(!start)return;const moved=Math.hypot(event.clientX-start.x,event.clientY-start.y);if(moved>10){lastTouchAt=-Infinity;return}const now=performance.now(),near=Math.hypot(event.clientX-lastTouchX,event.clientY-lastTouchY)<=28,isDouble=near&&now-lastTouchAt<=430;lastTouchAt=now;lastTouchX=event.clientX;lastTouchY=event.clientY;if(!isDouble)return;lastTouchAt=-Infinity;suppressClickUntil=now+700;event.preventDefault();event.stopImmediatePropagation?.();write()}
  const suppressSyntheticClick=event=>{if(performance.now()>suppressClickUntil)return;event.preventDefault();event.stopImmediatePropagation?.()}
  const onDblClick=event=>{suppressClickUntil=performance.now()+250;reset(event)}
  const priorTitle=String(target.title||'').trim();target.title=`${priorTitle?`${priorTitle} · `:''}double-click / double-tap to reset`
  target.addEventListener('pointerdown',onPointerDown)
  target.addEventListener('pointerup',onPointerUp)
  target.addEventListener('pointercancel',event=>{starts.delete(event.pointerId)})
  target.addEventListener('click',suppressSyntheticClick,true)
  target.addEventListener('dblclick',onDblClick)
  return()=>{target.removeEventListener('pointerdown',onPointerDown);target.removeEventListener('pointerup',onPointerUp);target.removeEventListener('click',suppressSyntheticClick,true);target.removeEventListener('dblclick',onDblClick)}
}

function writeGesture(api,endpointId,value,transaction){
  api.write(endpointId,value,transaction)
}

export function makeDial({slug,spec,api,bindings,size='medium',accent='',appearance='',knobTone='',numericScale=false,scaleProfile=''}={}){
  const endpointId=`control.${spec.id}`
  const root=markReview(el('div',`obj-dial obj-dial--${size}`),semanticReviewId(slug,'control',spec.id))
  if(accent)root.dataset.accent=accent
  if(knobTone)root.dataset.knobTone=knobTone
  const appearanceLayers=knobAppearanceLayers(appearance)
  if(appearanceLayers)root.dataset.knobFamily=appearanceLayers.familyId
  if(scaleProfile)root.dataset.scaleProfile=String(scaleProfile)
  const label=el('div','obj-dial__label',spec.label||spec.id)
  const face=el('button','obj-dial__face'); face.type='button'; face.setAttribute('role','slider'); face.setAttribute('aria-label',spec.label||spec.id);face.setAttribute('aria-valuemin',String(spec.minimum));face.setAttribute('aria-valuemax',String(spec.maximum))
  const scale=el('span','obj-dial__scale')
  for(let index=0;index<11;index+=1){const tick=el('i','obj-dial__tick');tick.style.setProperty('--tick-index',String(index));scale.append(tick)}
  let scaleValues=null
  if(numericScale){const minValue=Number(spec.minimum),maxValue=Number(spec.maximum),midValue=spec.scale==='square'?controlFromNormalized(spec,.5):minValue+(maxValue-minValue)*.5,compactScaleValue=value=>{const n=Number(value);if(!Number.isFinite(n))return'';if(spec.format==='hz')return Math.abs(n)>=1000?`${(n/1000).toFixed(Math.abs(n)>=10000?0:1).replace(/\.0$/,'')}k`:String(Math.round(n));if(spec.format==='ms')return Math.abs(n)>=1000?`${(n/1000).toFixed(n%1000?1:0)}s`:String(Math.round(n));if(spec.format==='db')return String(Math.round(n));if(Math.abs(n)>=1000)return `${(n/1000).toFixed(Math.abs(n)>=10000?0:1).replace(/\.0$/,'')}k`;if(Number.isInteger(n))return String(n);return Number(n.toPrecision(2)).toString()};scaleValues=el('span','obj-dial__scale-values');for(const [position,value] of [['min',minValue],['mid',midValue],['max',maxValue]])scaleValues.append(el('i',`obj-dial__scale-value obj-dial__scale-value--${position}`,compactScaleValue(value)))}
  if(appearanceLayers)face.append(scale,...(scaleValues?[scaleValues]:[]),...appearanceLayers.nodes)
  else{
    const washer=el('span','obj-dial__washer'),skirt=el('span','obj-dial__skirt'),cap=el('span','obj-dial__cap'),pointer=el('span','obj-dial__pointer'),highlight=el('span','obj-dial__highlight')
    cap.append(pointer,highlight);face.append(scale,washer,skirt,cap,...(scaleValues?[scaleValues]:[]))
  }
  const valueNode=el('output','obj-dial__value')
  root.append(label,face,valueNode)
  let current=Number(spec.default),transaction=null,lastVisualValue=NaN,lastSyncedValue=NaN
  const preview=value=>{
    current=Number(value)
    if(Object.is(current,lastVisualValue))return
    lastVisualValue=current
    const n=controlNormalized(spec,current),deg=-138+n*276
    face._ppwVisualAngle=deg
    if(appearanceLayers)appearanceLayers.setRotation?.(deg)
    else{root.style.setProperty('--dial-angle',`${deg}deg`);root.style.setProperty('--knob-asset-angle',`${deg}deg`)}
  }
  const sync=value=>{
    preview(value)
    if(Object.is(current,lastSyncedValue))return
    lastSyncedValue=current
    const text=displayValue(spec,current)
    face.setAttribute('aria-valuenow',String(current)); face.setAttribute('aria-valuetext',text)
    // <output>.value already replaces its text. Avoid two child-list mutations
    // for every numeric update, including unchanged rounded display values.
    if(valueNode.value!==text)valueNode.value=text
  }
  let pointerTap=()=>{}
  installVerticalContinuousDrag(face,{
    getNormalized:()=>controlNormalized(spec,current),
    previewNormalized:normalized=>sync(controlFromNormalized(spec,normalized)),
    setNormalized:normalized=>{const next=controlFromNormalized(spec,normalized);writeGesture(api,endpointId,next,transaction)},
    beginGesture:()=>{transaction=api.beginTransaction({kind:'rotary',endpointId})},
    endGesture:outcome=>{sync(current);if(!transaction)return;const id=transaction;transaction=null;try{api.endTransaction(id,outcome)}catch{}},
    tap:event=>pointerTap(event),
  })
  face.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key))return
    event.preventDefault(); let n=controlNormalized(spec,current)
    if(event.key==='Home')n=0; else if(event.key==='End')n=1; else n+=['ArrowUp','ArrowRight'].includes(event.key)?(event.shiftKey?.01:.025):-(event.shiftKey?.01:.025)
    const next=controlFromNormalized(spec,n);api.write(endpointId,next);sync(next)
  })
  let lastResetAt=0
  const resetToDefault=event=>{
    const now=performance.now();if(now-lastResetAt<220)return
    const fallback=Number(spec.default);if(!Number.isFinite(fallback))return
    event?.preventDefault?.();event?.stopPropagation?.();lastResetAt=now
    api.write(endpointId,fallback);sync(fallback)
  }
  let lastTapAt=-Infinity,lastTapPointerType=''
  pointerTap=event=>{
    const now=performance.now(),pointerType=String(event?.pointerType||'pointer')
    const isDouble=pointerType===lastTapPointerType&&now-lastTapAt<=430
    lastTapAt=now;lastTapPointerType=pointerType
    if(isDouble){lastTapAt=-Infinity;resetToDefault(event)}
  }
  face.title=`${String(spec.label||spec.id)} · double-tap to reset`
  face.addEventListener('click',event=>{if(Number(event.detail)>=2)resetToDefault(event)})
  face.addEventListener('dblclick',resetToDefault)
  bindings.set(endpointId,sync); sync(api.read(endpointId)??spec.default)
  return root
}

function ensureFunctionalControlsStyle(){
  ensureStyle('objectual-functional-controls-v1',`
.obj-functional-select,.obj-functional-range,.obj-functional-stepper{min-width:0;display:grid;align-content:start;gap:5px;padding:3px 4px}.obj-functional-select__label,.obj-functional-range__label,.obj-functional-stepper__label{min-width:0;min-height:17px;font:850 6.8px/1.12 ui-monospace,monospace;letter-spacing:.035em;text-transform:uppercase;color:var(--ink,#dedbd2);overflow-wrap:anywhere}.obj-functional-select__shell{position:relative;min-width:0}.obj-functional-select__shell::after{content:'▾';position:absolute;right:11px;top:50%;transform:translateY(-52%);pointer-events:none;color:#9b9f9a;font:900 9px/1 ui-monospace,monospace}.obj-functional-select__field{appearance:none;width:100%;height:44px;min-height:44px;padding:0 34px 0 10px;border:1px solid rgba(239,237,226,.28);border-radius:3px;background:linear-gradient(180deg,#191d1e,#111415);color:#eeeae1;font:750 10px/1 ui-sans-serif,system-ui;box-shadow:inset 0 1px 0 rgba(255,255,255,.045),inset 0 -1px 0 rgba(0,0,0,.38);cursor:pointer}.obj-functional-select__field:focus-visible,.obj-functional-range__field:focus-visible,.obj-functional-stepper__value:focus-visible,.obj-functional-stepper__button:focus-visible{outline:2px solid var(--focus,#efad4b);outline-offset:2px}.obj-functional-range__head,.obj-functional-stepper__head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.obj-functional-range__head>*,.obj-functional-stepper__head>*{min-width:0}.obj-functional-range__value{flex:0 0 auto;font:750 7.4px/1 ui-monospace,monospace;color:#8f958f;white-space:nowrap}.obj-functional-range__field{position:relative;box-sizing:border-box;width:100%;height:44px;min-height:44px;margin:0;padding:0 7px;border:0;background:transparent;cursor:ew-resize;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}.obj-functional-range__track{position:absolute;left:7px;right:7px;top:50%;height:4px;transform:translateY(-50%);border-radius:4px;background:#2b312d;box-shadow:inset 0 1px 2px rgba(0,0,0,.52);pointer-events:none}.obj-functional-range__fill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--range-normalized,0)*100%);border-radius:inherit;background:#c48b68}.obj-functional-range__thumb{position:absolute;left:calc(var(--range-normalized,0)*100%);top:50%;width:14px;height:22px;border:1px solid #8a765f;border-radius:4px;background:linear-gradient(180deg,#e9dcc5,#bda989);box-shadow:0 1px 2px rgba(0,0,0,.45);transform:translate(-50%,-50%);pointer-events:none}.obj-functional-stepper__body{display:grid;grid-template-columns:44px minmax(44px,1fr) 44px;min-height:44px}.obj-functional-stepper__button{min-width:44px;min-height:44px;border:1px solid rgba(239,237,226,.24);background:#15191a;color:#d4d1c8;font:900 15px/1 ui-monospace,monospace;cursor:pointer}.obj-functional-stepper__button:first-child{border-radius:3px 0 0 3px}.obj-functional-stepper__button:last-child{border-radius:0 3px 3px 0}.obj-functional-stepper__button:disabled{opacity:.32;cursor:default}.obj-functional-stepper__value{min-height:44px;display:grid;place-items:center;padding:0 7px;border-top:1px solid rgba(239,237,226,.24);border-bottom:1px solid rgba(239,237,226,.24);background:#0e1112;color:#eeeae1;font:850 10px/1 ui-monospace,monospace;white-space:nowrap}.obj-functional-segmented{min-width:0}.obj-functional-segmented .obj-segmented__row{display:grid;grid-template-columns:repeat(var(--functional-choice-count),minmax(44px,1fr));gap:0;width:100%}.obj-functional-segmented .obj-segmented__button{min-width:44px;border-radius:0;background:#15191a;border-color:rgba(239,237,226,.22);font-size:7px}.obj-functional-segmented .obj-segmented__button:first-child{border-radius:3px 0 0 3px}.obj-functional-segmented .obj-segmented__button:last-child{border-radius:0 3px 3px 0}.obj-functional-segmented .obj-segmented__button+.obj-segmented__button{border-left:0}.obj-functional-segmented .obj-segmented__button.is-active{background:#d8d5cc;color:#151718;border-color:#ece9df}.obj-functional-segmented--clock-source{width:100%;gap:2px;padding:0 1px}.obj-functional-segmented--clock-source .obj-segmented__label{min-height:12px;padding:0;font:900 6.1px/1 ui-monospace,monospace;letter-spacing:.045em;white-space:nowrap}.obj-functional-segmented--clock-source .obj-segmented__row{grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:2px;border:1px solid #9e8f76;border-radius:5px;background:linear-gradient(180deg,#d4c8af,#b8aa91);box-shadow:inset 0 1px 2px rgba(70,53,32,.22),0 1px 0 rgba(255,255,255,.6)}.obj-functional-segmented--clock-source .obj-segmented__button,.obj-functional-segmented--clock-source .obj-segmented__button:first-child,.obj-functional-segmented--clock-source .obj-segmented__button:last-child{min-width:0;min-height:26px;padding:0 1px;border:1px solid #a2947d;border-radius:3px;background:linear-gradient(180deg,#f4ead5,#d8cbae);color:#51483a;font:900 5.8px/1 ui-monospace,monospace;letter-spacing:.015em;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 1px 1px rgba(72,53,29,.18)}.obj-functional-segmented--clock-source .obj-segmented__button+.obj-segmented__button{border-left:1px solid #a2947d}.obj-functional-segmented--clock-source .obj-segmented__button.is-active{border-color:#8f5d20;background:linear-gradient(180deg,#dda85b,#b97729);color:#251a0d;box-shadow:inset 0 1px 0 rgba(255,235,190,.65),inset 0 -3px 0 #8d571d,0 0 0 1px rgba(173,118,37,.16)}.obj-functional-select--percen-sync{gap:2px;padding:0 1px}.obj-functional-select--percen-sync .obj-functional-select__label{min-height:12px;font-size:6.1px;white-space:nowrap}.obj-functional-select--percen-sync .obj-functional-select__field{height:30px;min-height:30px;padding:0 19px 0 6px;border-radius:4px;font:850 6.2px/1 ui-monospace,monospace}.obj-functional-select--percen-sync .obj-functional-select__shell::after{right:6px;font-size:7px}
.obj-threeway{min-width:84px;display:grid;justify-items:center;gap:2px}.obj-threeway__stage{position:relative;width:84px;height:58px}.obj-threeway__face{position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%);border:0;background:transparent;padding:0;cursor:pointer;touch-action:manipulation}.obj-threeway__legend{position:absolute;left:50%;font:900 6.4px/1 ui-monospace,monospace;letter-spacing:.01em;color:#4d473d;text-transform:uppercase;white-space:nowrap;text-shadow:0 1px rgba(255,255,255,.44)}.obj-threeway__legend--0{top:0;transform:translate(-50%,-1px)}.obj-threeway__legend--1{left:auto;right:0;top:50%;transform:translateY(-50%);font-size:5.9px;color:#5f584e}.obj-threeway__legend--2{bottom:0;transform:translate(-50%,1px)}.obj-threeway__face:focus-visible{outline:2px solid var(--focus,#efad4b);outline-offset:2px}
.obj-keyboard--chromatic-controller{min-width:0;overflow:visible}.obj-chromatic-pad-grid{display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:7px 5px;align-items:start}.obj-chromatic-pad{min-width:44px;display:grid;justify-items:center;gap:3px}.obj-chromatic-pad__label{font:850 7px/1 ui-monospace,monospace;letter-spacing:.02em;color:#b9b7af;text-align:center}.obj-chromatic-pad .foundry-moog-soft-key-mount,.obj-chromatic-pad .foundry-mavis-soft-key-mount,.obj-chromatic-pad .trambustissimo-round-button-mount{position:relative!important;left:auto!important;top:auto!important}.obj-keyboard[data-button-recipe='trambustissimo-hard-round-key-v1'] .obj-chromatic-pad-grid{gap:3px 2px}.obj-keyboard[data-button-recipe='trambustissimo-hard-round-key-v1'] .obj-chromatic-pad__label{color:#4f493f;font-family:ui-sans-serif,system-ui}.obj-keyboard[data-button-recipe='trambustissimo-chromatic-keycap-v1'] .obj-chromatic-pad-grid{gap:4px 3px}.obj-keyboard[data-button-recipe='trambustissimo-chromatic-keycap-v1'] .obj-chromatic-pad__label{color:#4b453b;font-family:ui-sans-serif,system-ui}.obj-chromatic-keycap{position:relative;width:100%;min-width:44px;height:44px;border:1px solid #8e8678;border-radius:7px 7px 10px 10px;background:linear-gradient(180deg,#f5efe2 0%,#ded4c2 65%,#c7baa4 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -4px 7px rgba(76,62,43,.12),0 2px 3px rgba(72,57,35,.24);color:#2f2a23;touch-action:none;cursor:pointer}.obj-chromatic-keycap[data-key-color='black']{border-color:#282721;background:linear-gradient(180deg,#4a4942 0%,#24241f 68%,#11110f 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -4px 6px rgba(0,0,0,.45),0 2px 3px rgba(72,57,35,.28);color:#f1eadc}.obj-chromatic-keycap[data-key-color='root']{border-color:#9b663f;background:linear-gradient(180deg,#f3e1c2 0%,#d9bc8e 68%,#b98d59 100%)}.obj-chromatic-keycap.is-held{transform:translateY(2px);box-shadow:inset 0 2px 5px rgba(54,43,30,.26),0 0 0 1px rgba(155,90,61,.28)}.moog-object[data-layout='compact'] .obj-chromatic-pad-grid,.mavis-object[data-layout='compact'] .obj-chromatic-pad-grid,.mother32-object[data-layout='compact'] .obj-chromatic-pad-grid{grid-template-columns:repeat(4,minmax(44px,1fr));gap:7px 4px}
.obj-functional-drag-choice{--selector-bezel-hi:#f2eadb;--selector-bezel-lo:#c9baa1;--selector-border:#887b67;--selector-window-hi:#31332f;--selector-window-lo:#11120f;--selector-value:#fffaf0;min-width:0;width:min(64px,100%);display:grid;justify-items:center;align-content:center;justify-self:center;gap:2px;padding:0}.obj-functional-drag-choice__label{width:100%;min-width:0;min-height:10px;height:10px;overflow:hidden;white-space:nowrap;text-align:center;font:900 5.8px/1 ui-monospace,monospace;letter-spacing:.045em;text-transform:uppercase;color:#4c463c!important}.obj-functional-drag-choice__button{position:relative;box-sizing:border-box;width:min(62px,100%);min-width:44px;height:44px;min-height:44px;display:grid;grid-template-columns:7px minmax(24px,1fr) 11px;align-items:center;gap:3px;padding:5px 4px;border:1px solid var(--selector-border);border-radius:5px;background:linear-gradient(180deg,var(--selector-bezel-hi),var(--selector-bezel-lo));color:var(--selector-value);cursor:ns-resize;touch-action:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.86),inset 0 -2px 3px rgba(76,57,31,.16),0 1px 2px rgba(54,42,25,.24)}.obj-functional-drag-choice__button::before{content:'';position:absolute;inset:-5px -2px}.obj-functional-drag-choice__detent{position:relative;width:7px;height:24px;border:1px solid rgba(43,39,32,.48);border-radius:4px;background:repeating-linear-gradient(180deg,#706858 0 2px,#c9bea9 2px 4px);box-shadow:inset 0 1px 2px rgba(31,26,19,.35)}.obj-functional-drag-choice__detent::after{content:'';position:absolute;left:1px;top:var(--choice-marker-y,10px);width:3px;height:3px;border-radius:50%;background:var(--patch-accent,#c67835);box-shadow:0 0 0 1px rgba(38,27,15,.62),0 0 3px rgba(205,126,52,.42);transition:top .08s}.obj-functional-drag-choice__value{min-width:0;height:22px;display:grid;place-items:center;padding:0 2px;border:1px solid #151613;border-radius:2px;background:linear-gradient(180deg,var(--selector-window-hi),var(--selector-window-lo));color:var(--selector-value);font:900 7px/1 ui-monospace,monospace;letter-spacing:.025em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:clip;box-shadow:inset 0 1px 2px rgba(0,0,0,.72),0 1px 0 rgba(255,255,255,.46)}.obj-functional-drag-choice__index{min-width:0;color:#514b40;font:900 5.2px/1 ui-monospace,monospace;letter-spacing:-.03em;text-align:center}.obj-functional-drag-choice__button:hover{filter:brightness(1.045)}.obj-functional-drag-choice__button[data-dragging='1']{transform:translateY(1px);border-color:#915d26;box-shadow:inset 0 2px 4px rgba(69,43,16,.26),0 0 0 1px rgba(176,115,39,.22)}.obj-functional-drag-choice__button[data-dragging='1'] .obj-functional-drag-choice__value{background:linear-gradient(180deg,#523b23,#21180f);color:#ffe5b5}.obj-functional-drag-choice__button:focus-visible{outline:2px solid var(--focus,#efad4b);outline-offset:2px}.moog-functional-menu .obj-functional-drag-choice,.mog-extension-body .obj-functional-drag-choice,.m32-extension-body .obj-functional-drag-choice,.m32-seq-utility .obj-functional-drag-choice{--selector-bezel-hi:#3a403b;--selector-bezel-lo:#151916;--selector-border:#59625a;--selector-window-hi:#151916;--selector-window-lo:#070908}.moog-functional-menu .obj-functional-drag-choice__label,.mog-extension-body .obj-functional-drag-choice__label,.m32-extension-body .obj-functional-drag-choice__label,.m32-seq-utility .obj-functional-drag-choice__label{color:#f3f1e9!important}.moog-functional-menu .obj-functional-drag-choice__index,.mog-extension-body .obj-functional-drag-choice__index,.m32-extension-body .obj-functional-drag-choice__index,.m32-seq-utility .obj-functional-drag-choice__index{color:#c9cec9}
`)
}

function needsFunctionalSelector(choices){
  if(!Array.isArray(choices))return false
  const labels=choices.map(choice=>String(choice.label??choice.value??''))
  return choices.length>=3||labels.reduce((sum,label)=>sum+label.length,0)>34||labels.some(label=>label.length>13)
}

export function makeFunctionalDragChoice({slug,spec,api,bindings,choices=[]}={}){
  const endpointId=`control.${spec.id}`,rows=choices.map(row=>({label:String(row.label??row.value),value:Number(row.value)})).filter(row=>Number.isFinite(row.value))
  if(!rows.length)throw new Error(`functionalDragChoice.empty:${String(spec.id||'unknown')}`)
  const root=markReview(el('div','obj-functional-drag-choice'),semanticReviewId(slug,'control',spec.id)),caption=el('span','obj-functional-drag-choice__label',spec.label||spec.id),button=el('button','obj-functional-drag-choice__button'),detent=el('span','obj-functional-drag-choice__detent'),valueLabel=el('span','obj-functional-drag-choice__value'),indexLabel=el('span','obj-functional-drag-choice__index')
  detent.setAttribute('aria-hidden','true');indexLabel.setAttribute('aria-hidden','true');button.append(detent,valueLabel,indexLabel);root.dataset.interfaceFamily='functional-drag-choice-v2';root.dataset.optionCount=String(rows.length);root.dataset.controlId=String(spec.id||'');button.type='button';button.setAttribute('role','spinbutton');button.setAttribute('aria-orientation','vertical');button.setAttribute('aria-label',`${spec.label||spec.id}. Drag vertically to change.`);button.title='Vertical drag · arrow keys';root.append(caption,button)
  let current=Number(api.read(endpointId)??spec.default??rows[0].value),gesture=null,lastRenderedIndex=-1,stopCancellation=null
  const nearestIndex=value=>rows.reduce((best,row,index)=>Math.abs(row.value-Number(value))<Math.abs(rows[best].value-Number(value))?index:best,0)
  button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax',String(rows.length-1))
  const sync=value=>{current=Number(value);const index=nearestIndex(current);if(index===lastRenderedIndex)return;lastRenderedIndex=index;const row=rows[index],progress=rows.length>1?index/(rows.length-1):.5;valueLabel.textContent=row.label;indexLabel.textContent=String(index+1).padStart(2,'0');button.style.setProperty('--choice-marker-y',`${Math.round(2+progress*17)}px`);button.setAttribute('aria-valuenow',String(index));button.setAttribute('aria-valuetext',row.label);root.dataset.choiceIndex=String(index);root.dataset.choiceValue=String(row.value)}
  const writeIndex=(index,transaction)=>{const next=Math.max(0,Math.min(rows.length-1,index)),row=rows[next];api.write(endpointId,row.value,transaction||undefined);sync(row.value)}
  const choiceDelivery=createControlWriteScheduler(writeIndex)
  const flushChoice=()=>choiceDelivery.flush()
  const scheduleChoice=(index,transaction)=>choiceDelivery.push(index,transaction)
  const begin=event=>{if(gesture||event.button!==undefined&&event.button!==0)return;event.preventDefault();const index=nearestIndex(current),transaction=api.beginTransaction?.({kind:'functional-discrete-drag',endpointId,pointerId:event.pointerId})||null;gesture={pointerId:event.pointerId,startY:event.clientY,startIndex:index,lastIndex:index,transaction};stopCancellation=registerControlGestureCancellation(()=>end(null,true));button.dataset.dragging='1';try{button.setPointerCapture?.(event.pointerId)}catch{}}
  const move=event=>{if(!gesture||gesture.pointerId!==event.pointerId)return;event.preventDefault();const travel=gesture.startY-event.clientY,delta=Math.trunc(travel/8),index=Math.max(0,Math.min(rows.length-1,gesture.startIndex+delta));if(index===gesture.lastIndex)return;gesture.lastIndex=index;sync(rows[index].value);scheduleChoice(index,gesture.transaction)}
  const end=(event,cancelled=false)=>{if(!gesture||event&&gesture.pointerId!==event.pointerId)return;event?.preventDefault?.();const active=gesture;gesture=null;stopCancellation?.();stopCancellation=null;button.dataset.dragging='0';try{if(cancelled){choiceDelivery.cancel();lastRenderedIndex=-1;sync(api.read(endpointId)??rows[active.startIndex].value)}else flushChoice()}finally{choiceDelivery.cancel();try{button.releasePointerCapture?.(active.pointerId)}catch{};if(active.transaction!==null)try{api.endTransaction?.(active.transaction,cancelled?'cancel':'commit')}catch{}}}
  button.addEventListener('pointerdown',begin);button.addEventListener('pointermove',move);button.addEventListener('pointerup',event=>end(event,false));button.addEventListener('pointercancel',event=>end(event,true));button.addEventListener('lostpointercapture',event=>end(event,false));button.addEventListener('ppw-control-cancel',()=>end(null,true));button.addEventListener('click',event=>event.preventDefault())
  button.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','PageUp','PageDown','Home','End'].includes(event.key))return;event.preventDefault();const currentIndex=nearestIndex(current);if(event.key==='Home')writeIndex(0);else if(event.key==='End')writeIndex(rows.length-1);else{const direction=['ArrowUp','ArrowRight','PageUp'].includes(event.key)?1:-1,multiplier=event.key.startsWith('Page')?4:1;writeIndex(currentIndex+direction*multiplier)}})
  installControlDefaultReset(button,{spec,api,endpointId,sync,choices:rows,writeValue:value=>writeIndex(nearestIndex(value))})
  bindings.set(endpointId,sync);sync(current);return root
}

export function makeSegmented({slug,spec,api,bindings,appearance=''}={}){
  ensureFunctionalControlsStyle()
  const endpointId=`control.${spec.id}`
  const choices=Array.isArray(spec.choices)&&spec.choices.length?spec.choices:[{label:'LOW',value:spec.minimum},{label:'HIGH',value:spec.maximum}]
  if(/(?:transport|lfo)-sync-(?:mode|division)$/.test(String(spec.id||'')))return makeFunctionalDragChoice({slug,spec,api,bindings,choices})
  if(appearance==='trambustissimo-3way-selector'&&choices.length===3){
    const root=markReview(el('div','obj-segmented obj-threeway'),semanticReviewId(slug,'control',spec.id));root.dataset.interfaceFamily='hardware-selector-v1';root.dataset.selectorAuthority='trambustissimo-three-position-paddle-v1';root.append(el('div','obj-segmented__label',spec.label||spec.id))
    const stage=el('div','obj-threeway__stage'),button=el('button','obj-threeway__face'),rendered=createFoundryMoogThreeWayToggleLever();button.type='button';button.setAttribute('aria-label',spec.label||spec.id);button.dataset.foundryRenderer='trambustissimo-hard-plastic-selector-canonical';button.dataset.objectualRecipe=rendered.recipeId;button.dataset.sourceRecipe=rendered.sourceRecipe;button.append(rendered.node);stage.append(button)
    const compactLegend=value=>String(value).replace('PULSE + SUB SAW','P+SUB').replace('VCO 1 & 2','VCO1+2').replace('PARALLEL','PAR').replace('PULSE WIDTH','PW').replace('VCW→VCF','W→F').replace('VCF→VCW','F→W').replace('Bipolar ±5V','±5V').replace('Unipolar 0→+5V','0→+5V')
    choices.forEach((choice,index)=>{const full=String(choice.label??choice.value),legend=el('span',`obj-threeway__legend obj-threeway__legend--${index}`,compactLegend(full));legend.title=full;stage.append(legend)})
    root.append(stage)
    button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','2')
    let current=Number(api.read(endpointId)??spec.default??choices[1].value),lastPosition=-1
    const nearestIndex=value=>choices.reduce((best,choice,index)=>Math.abs(Number(choice.value)-Number(value))<Math.abs(Number(choices[best].value)-Number(value))?index:best,0)
    const sync=value=>{current=Number(value);const index=nearestIndex(current);if(index===lastPosition)return;lastPosition=index;root.dataset.position=String(index);rendered.setPosition(index);button.setAttribute('aria-valuenow',String(index));button.setAttribute('aria-valuetext',String(choices[index].label??choices[index].value))}
    const writeIndex=index=>{const next=Math.max(0,Math.min(2,index)),value=Number(choices[next].value);api.write(endpointId,value);sync(value)}
    let lastPointerActivationAt=-Infinity;const advance=()=>writeIndex((nearestIndex(current)+1)%3);button.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;event.preventDefault();lastPointerActivationAt=performance.now();advance()});button.addEventListener('click',event=>{if(performance.now()-lastPointerActivationAt<700){event.preventDefault();return}advance()});button.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const index=nearestIndex(current);if(event.key==='Home')writeIndex(0);else if(event.key==='End')writeIndex(2);else writeIndex(index+(['ArrowUp','ArrowRight'].includes(event.key)?1:-1))})
    installControlDefaultReset(button,{spec,api,endpointId,sync,choices,writeValue:value=>writeIndex(nearestIndex(value))})
    bindings.set(endpointId,sync);sync(current);return root
  }
  if(needsFunctionalSelector(choices)&&appearance!=='functional-segmented'&&!(appearance==='trambustissimo-2way-selector'&&choices.length===2)){
    const root=markReview(el('label','obj-functional-select'),semanticReviewId(slug,'control',spec.id)),caption=el('span','obj-functional-select__label',spec.label||spec.id),shell=el('span','obj-functional-select__shell'),select=document.createElement('select');root.dataset.interfaceFamily='functional-choice-v1';root.dataset.optionCount=String(choices.length)
    if(slug==='dfam'&&spec.id==='transport-sync-division')root.classList.add('obj-functional-select--percen-sync')
    select.className='obj-functional-select__field';select.setAttribute('aria-label',spec.label||spec.id);select.dataset.selectorAuthority='functional-choice-v1'
    const choiceByValue=new Map()
    for(const choice of choices){const option=document.createElement('option'),key=String(choice.value);option.value=key;option.textContent=String(choice.label??choice.value);select.append(option);choiceByValue.set(key,choice)}
    select.addEventListener('change',()=>api.write(endpointId,Number(select.value)))
    let lastSelectValue=''
    const sync=value=>{const target=String(value),resolved=choiceByValue.has(target)?target:String(choices.reduce((best,choice)=>Math.abs(Number(choice.value)-Number(value))<Math.abs(Number(best.value)-Number(value))?choice:best,choices[0]).value);if(resolved===lastSelectValue)return;lastSelectValue=resolved;select.value=resolved}
    shell.append(select);root.append(caption,shell);installControlDefaultReset(select,{spec,api,endpointId,sync,choices});bindings.set(endpointId,sync);sync(api.read(endpointId)??spec.default);return root
  }
  const root=markReview(el('div','obj-segmented'),semanticReviewId(slug,'control',spec.id)); root.append(el('div','obj-segmented__label',spec.label||spec.id))
  if(appearance==='trambustissimo-2way-selector'&&choices.length===2){
    root.classList.add('obj-toggle','obj-toggle--lever');root.dataset.toggleFamily='hard-plastic-paddle';root.dataset.toggleAuthority='trambustissimo-two-position-paddle-v1'
    const compactToggleLegend=value=>String(value).replace('Bipolar ±5V','±5V').replace('Unipolar 0→+5V','0→+5V'),legends=el('div','obj-toggle__legends'),upper=el('span','',compactToggleLegend(choices[1].label??choices[1].value)),lower=el('span','',compactToggleLegend(choices[0].label??choices[0].value));upper.title=String(choices[1].label??choices[1].value);lower.title=String(choices[0].label??choices[0].value);legends.append(upper,lower)
    const button=el('button','obj-toggle__face'),rendered=createFoundryMoogToggleLever();button.type='button';button.setAttribute('aria-label',spec.label||spec.id);button.dataset.foundryRenderer='trambustissimo-hard-plastic-selector-canonical';button.dataset.objectualRecipe=rendered.recipeId;button.dataset.sourceRecipe=rendered.sourceRecipe
    button.append(rendered.node);root.append(legends,button)
    let current=Number(api.read(endpointId)??spec.default??choices[0].value),lastUp=null
    const sync=value=>{current=Number(value);const up=Math.abs(current-Number(choices[1].value))<Math.abs(current-Number(choices[0].value));if(up===lastUp)return;lastUp=up;root.dataset.position=up?'up':'down';rendered.setPosition(up);button.setAttribute('aria-pressed',String(up));button.setAttribute('aria-valuetext',String(up?(choices[1].label??choices[1].value):(choices[0].label??choices[0].value)))}
    const toggle=()=>{const up=root.dataset.position==='up',next=Number((up?choices[0]:choices[1]).value);api.write(endpointId,next);sync(next)};let lastPointerActivationAt=-Infinity;button.style.touchAction='manipulation';button.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'&&event.pointerType!=='pen')return;event.preventDefault();lastPointerActivationAt=performance.now();toggle()});button.addEventListener('click',event=>{if(performance.now()-lastPointerActivationAt<700){event.preventDefault();return}toggle()})
    installControlDefaultReset(button,{spec,api,endpointId,sync,choices})
    bindings.set(endpointId,sync);sync(current);return root
  }
  ensureFunctionalControlsStyle();root.classList.add('obj-functional-segmented');if(spec.id==='transport-sync-mode')root.classList.add('obj-functional-segmented--clock-source','obj-functional-segmented--sync-source');root.dataset.interfaceFamily='functional-segmented-v1';root.style.setProperty('--functional-choice-count',String(choices.length))
  const row=el('div','obj-segmented__row'), buttons=[]
  for(const choice of choices){
    const button=el('button','obj-segmented__button',choice.label??choice.value); button.type='button'; button.dataset.value=String(choice.value)
    button.addEventListener('click',()=>{const next=Number(choice.value);api.write(endpointId,next);sync(next)})
    buttons.push(button); row.append(button)
  }
  root.append(row)
  let lastSegmentedValue=NaN
  const sync=value=>{const number=Number(value);if(Object.is(number,lastSegmentedValue))return;lastSegmentedValue=number;buttons.forEach(button=>{const active=Math.abs(Number(button.dataset.value)-number)<1e-9;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))})}
  installControlDefaultReset(root,{spec,api,endpointId,sync,choices})
  bindings.set(endpointId,sync); sync(api.read(endpointId)??spec.default)
  return root
}

export function makeFunctionalRange({slug,spec,api,bindings,showScale=false}={}){
  ensureFunctionalControlsStyle()
  const endpointId=`control.${spec.id}`,root=markReview(el('div','obj-functional-range'),semanticReviewId(slug,'control',spec.id));root.dataset.interfaceFamily='functional-range-v2'
  const head=el('span','obj-functional-range__head'),caption=el('span','obj-functional-range__label',spec.label||spec.id),valueNode=el('output','obj-functional-range__value'),field=el('button','obj-functional-range__field'),track=el('span','obj-functional-range__track'),fill=el('span','obj-functional-range__fill'),thumb=el('span','obj-functional-range__thumb')
  field.type='button';field.setAttribute('role','slider');field.setAttribute('aria-label',spec.label||spec.id);field.setAttribute('aria-valuemin',String(spec.minimum));field.setAttribute('aria-valuemax',String(spec.maximum));track.append(fill,thumb);field.append(track);head.append(caption,valueNode);root.append(head,field)
  if(showScale){const minimum=Number(spec.minimum),maximum=Number(spec.maximum),bipolar=minimum<0&&maximum>0,legend=el('div','obj-functional-range__scale');root.classList.add('obj-functional-range--scaled');if(bipolar){root.classList.add('obj-functional-range--bipolar');field.style.setProperty('--range-zero',String(controlNormalized(spec,0)))}legend.append(el('span','',displayValue(spec,minimum)),...(bipolar?[el('span','','0')]:[]),el('span','',displayValue(spec,maximum)));root.append(legend)}
  let current=Number(api.read(endpointId)??spec.default),tx=null,lastRangeValue=NaN
  const sync=value=>{current=Number(value);if(Object.is(current,lastRangeValue))return;lastRangeValue=current;const normalized=controlNormalized(spec,current),text=displayValue(spec,current);field.style.setProperty('--range-normalized',String(normalized));if(showScale&&root.classList.contains('obj-functional-range--bipolar')){const zero=controlNormalized(spec,0);field.style.setProperty('--range-fill-left',String(Math.min(zero,normalized)));field.style.setProperty('--range-fill-width',String(Math.abs(normalized-zero)))}valueNode.value=text;valueNode.textContent=text;field.setAttribute('aria-valuenow',String(current));field.setAttribute('aria-valuetext',text)}
  installHorizontalContinuousDrag(field,{getNormalized:()=>controlNormalized(spec,current),previewNormalized:normalized=>sync(controlFromNormalized(spec,normalized)),setNormalized:normalized=>{const next=controlFromNormalized(spec,normalized);api.write(endpointId,next,tx||undefined);sync(next)},beginGesture:()=>{if(!tx)tx=api.beginTransaction({kind:'functional-range',endpointId})},endGesture:outcome=>{if(!tx)return;const id=tx;tx=null;try{api.endTransaction(id,outcome)}catch{}}})
  field.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End','PageDown','PageUp'].includes(event.key))return;event.preventDefault();let normalized=controlNormalized(spec,current);if(event.key==='Home')normalized=0;else if(event.key==='End')normalized=1;else normalized=clamp(normalized+(['ArrowRight','ArrowUp','PageUp'].includes(event.key)?1:-1)*(event.key.startsWith('Page')?.1:event.shiftKey?.01:.025),0,1);const next=controlFromNormalized(spec,normalized);api.write(endpointId,next);sync(next)})
  installControlDefaultReset(field,{spec,api,endpointId,sync})
  bindings.set(endpointId,sync);sync(current);return root
}

export function makeFunctionalStepper({slug,spec,api,bindings}={}){
  ensureFunctionalControlsStyle()
  if(/(?:transport|lfo)-sync-division$/.test(String(spec.id||''))){const min=Number(spec.minimum),max=Number(spec.maximum),step=Math.max(Number(spec.quantize||1),Number.EPSILON),count=Math.max(1,Math.floor((max-min)/step+1e-9)+1),choices=Array.from({length:count},(_,index)=>{const value=Math.min(max,min+index*step);return{value,label:displayValue(spec,value)}});return makeFunctionalDragChoice({slug,spec,api,bindings,choices})}
  const endpointId=`control.${spec.id}`,root=markReview(el('div','obj-functional-stepper'),semanticReviewId(slug,'control',spec.id));root.dataset.interfaceFamily='functional-stepper-v1';if(spec.id==='transport-sync-division')root.classList.add('obj-functional-stepper--sync-division')
  const head=el('div','obj-functional-stepper__head'),caption=el('span','obj-functional-stepper__label',spec.label||spec.id),body=el('div','obj-functional-stepper__body'),minus=el('button','obj-functional-stepper__button','−'),valueNode=el('output','obj-functional-stepper__value'),plus=el('button','obj-functional-stepper__button','+')
  minus.type=plus.type='button';minus.setAttribute('aria-label',`Decrease ${spec.label||spec.id}`);plus.setAttribute('aria-label',`Increase ${spec.label||spec.id}`);valueNode.tabIndex=0;valueNode.setAttribute('role','spinbutton');head.append(caption);body.append(minus,valueNode,plus);root.append(head,body)
  const min=Number(spec.minimum),max=Number(spec.maximum),step=Math.max(Number(spec.quantize||1),Number.EPSILON);valueNode.setAttribute('aria-valuemin',String(min));valueNode.setAttribute('aria-valuemax',String(max));let current=Number(api.read(endpointId)??spec.default??min),lastStepperValue=NaN
  const snap=value=>clamp(min+Math.round((Number(value)-min)/step)*step,min,max)
  const sync=value=>{current=snap(value);if(Object.is(current,lastStepperValue))return;lastStepperValue=current;const text=displayValue(spec,current);valueNode.value=text;valueNode.textContent=text;valueNode.setAttribute('aria-valuenow',String(current));valueNode.setAttribute('aria-valuetext',text);minus.disabled=current<=min+step/2;plus.disabled=current>=max-step/2}
  const write=value=>{const next=snap(value);api.write(endpointId,next);sync(next)}
  minus.addEventListener('click',()=>write(current-step));plus.addEventListener('click',()=>write(current+step))
  valueNode.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','PageUp','PageDown','Home','End'].includes(event.key))return;event.preventDefault();if(event.key==='Home')write(min);else if(event.key==='End')write(max);else{const direction=['ArrowUp','ArrowRight','PageUp'].includes(event.key)?1:-1,multiplier=event.key.startsWith('Page')?4:1;write(current+direction*step*multiplier)}})
  installControlDefaultReset(root,{spec,api,endpointId,sync,writeValue:write})
  bindings.set(endpointId,sync);sync(current);return root
}

export function makeMacroDial({slug,macro,api,bindings,appearance='',numericScale=false}={}){
  const endpointId=`macro.${macro.id}`
  const root=markReview(el('div','obj-macro'),semanticReviewId(slug,'macro',macro.id))
  const appearanceLayers=knobAppearanceLayers(appearance)
  if(appearanceLayers)root.dataset.knobFamily=appearanceLayers.familyId
  const face=el('button','obj-macro__face'); face.type='button'; face.setAttribute('role','slider'); face.setAttribute('aria-label',macro.label||macro.id)
  const scale=el('span','obj-macro__scale')
  for(let index=0;index<9;index+=1){const tick=el('i','obj-macro__tick');tick.style.setProperty('--tick-index',String(index));scale.append(tick)}
  const scaleValues=numericScale?el('span','obj-macro__scale-values'):null;if(scaleValues)for(const [position,text] of [['min','0'],['mid','50'],['max','100']])scaleValues.append(el('i',`obj-macro__scale-value obj-macro__scale-value--${position}`,text))
  if(appearanceLayers)face.append(scale,...(scaleValues?[scaleValues]:[]),...appearanceLayers.nodes)
  else{const washer=el('span','obj-macro__washer'),ring=el('span','obj-macro__ring'),pointer=el('span','obj-macro__pointer'),highlight=el('span','obj-macro__highlight');ring.append(pointer,highlight);face.append(scale,washer,ring,...(scaleValues?[scaleValues]:[]))}
  const label=el('div','obj-macro__label',macro.label||macro.id),valueNode=el('output','obj-macro__value'); root.append(face,label,valueNode)
  let value=Number(macro.default??0),tx=null,lastMacroVisualValue=NaN,lastMacroSyncedValue=NaN
  const preview=next=>{value=clamp(next,0,1);if(Object.is(value,lastMacroVisualValue))return;lastMacroVisualValue=value;const angle=-138+value*276;face._ppwVisualAngle=angle;if(appearanceLayers)appearanceLayers.setRotation?.(angle);else{root.style.setProperty('--macro-angle',`${angle}deg`);root.style.setProperty('--knob-asset-angle',`${angle}deg`)}}
  const sync=next=>{preview(next);if(Object.is(value,lastMacroSyncedValue))return;lastMacroSyncedValue=value;const text=`${Math.round(value*100)}%`;if(valueNode.value!==text)valueNode.value=text;face.setAttribute('aria-valuenow',String(value))}
  let pointerTap=()=>{}
  installVerticalContinuousDrag(face,{
    getNormalized:()=>value,
    previewNormalized:next=>sync(next),
    setNormalized:next=>{api.write(endpointId,next,tx)},
    beginGesture:()=>{tx=api.beginTransaction({kind:'macro',endpointId})},
    endGesture:outcome=>{sync(value);if(!tx)return;const id=tx;tx=null;try{api.endTransaction(id,outcome)}catch{}},
    tap:event=>pointerTap(event),
  })
  face.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key))return
    event.preventDefault();let next=value
    if(event.key==='Home')next=0;else if(event.key==='End')next=1;else next=clamp(value+(['ArrowUp','ArrowRight'].includes(event.key)?.025:-.025),0,1)
    api.write(endpointId,next);sync(next)
  })
  let lastResetAt=0
  const resetToDefault=event=>{
    const now=performance.now();if(now-lastResetAt<220)return
    const fallback=Number(macro.default??0);if(!Number.isFinite(fallback))return
    event?.preventDefault?.();event?.stopPropagation?.();lastResetAt=now
    api.write(endpointId,fallback);sync(fallback)
  }
  let lastTapAt=-Infinity,lastTapPointerType=''
  pointerTap=event=>{
    const now=performance.now(),pointerType=String(event?.pointerType||'pointer')
    const isDouble=pointerType===lastTapPointerType&&now-lastTapAt<=430
    lastTapAt=now;lastTapPointerType=pointerType
    if(isDouble){lastTapAt=-Infinity;resetToDefault(event)}
  }
  face.title=`${String(macro.label||macro.id)} · double-tap to reset`
  face.addEventListener('click',event=>{if(Number(event.detail)>=2)resetToDefault(event)})
  face.addEventListener('dblclick',resetToDefault)
  bindings.set(endpointId,sync);sync(api.read(endpointId)??macro.default??0)
  return root
}

export function makePatchJack({slug,jack}={}){
  const root=markReview(el('div','obj-jack'),semanticReviewId(slug,'patch',jack.id));root.dataset.patchId=jack.id||'';root.dataset.direction=jack.direction||'';root.dataset.domain=jack.domain||'';root.dataset.objectualRecipe='eurorack-3p5-jack-provisional-v1';root.dataset.patchJackAuthority='module-lab-provisional-v1'
  const socket=el('span','obj-jack__socket');socket.dataset.patchSocket=jack.id||'';socket.dataset.physicalLayer='socket';socket.dataset.objectualRecipe='eurorack-3p5-jack-provisional-v1'
  const label=el('span','obj-jack__label',jack.label||jack.id),domain=el('small','obj-jack__domain',String(jack.domain||'').toUpperCase());root.append(socket,label,domain);return root
}

export function makeKeyboard({slug,keyboard,api,appearance=''}={}){
  const root=markReview(el('div','obj-keyboard'),semanticReviewId(slug,'territory','keyboard'))
  const black=new Set([1,3,6,8,10]),start=Number(keyboard.startNote||60),count=Math.max(1,Number(keyboard.keyCount||13))
  if(appearance==='foundry-mavis-soft-key'||appearance==='foundry-moog-soft-key'||appearance==='trambustissimo-round-key'||appearance==='trambustissimo-chromatic-keycap'){
    ensureFunctionalControlsStyle()
    if(start%12!==0||count!==13)throw new Error('foundryMoogSoftKey.requiresCToC13')
    const recipeId=appearance==='trambustissimo-chromatic-keycap'?'trambustissimo-chromatic-keycap-v1':appearance==='trambustissimo-round-key'?'trambustissimo-hard-round-key-v1':appearance==='foundry-mavis-soft-key'?'mavis-soft-key-v1':'moog-soft-key-v1',names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
    root.classList.add('obj-keyboard--foundry-buttons','obj-keyboard--chromatic-controller');root.dataset.buttonAuthority='objectual-button-canonical';root.dataset.buttonRecipe=recipeId;root.dataset.keyboardTopology='chromatic-pad-grid-v1';root.dataset.interfaceFamily='performance-controller-v1'
    const grid=el('div','obj-chromatic-pad-grid'),keyButtons=[]
    const focusPad=index=>{const target=keyButtons[Math.max(0,Math.min(count-1,index))];if(!target)return;keyButtons.forEach(button=>{button.tabIndex=button===target?0:-1});target.focus({preventScroll:true})}
    for(let i=0;i<count;i++){
      const note=start+i,noteName=names[note%12]+(Math.floor(note/12)-1),pc=note%12,tone=pc===0?'orange':black.has(pc)?'teal':'cream',keycap=appearance==='trambustissimo-chromatic-keycap',rendered=keycap?(()=>{const button=el('button','obj-chromatic-keycap'),node=el('span','obj-chromatic-keycap-mount');button.type='button';button.dataset.keyColor=pc===0?'root':black.has(pc)?'black':'white';button.dataset.objectualRecipe='trambustissimo-chromatic-keycap-v1';button.dataset.foundryRenderer='trambustissimo-css-keycap-v1';button.dataset.material=black.has(pc)?'black-abs-satin':'ivory-abs-satin';node.dataset.material='cream-hard-plastic-satin';node.append(button);return{button,node,setPressed:pressed=>button.classList.toggle('is-held',Boolean(pressed))}})():appearance==='trambustissimo-round-key'?createTrambustissimoRoundPanelButton({tone}):appearance==='foundry-mavis-soft-key'?createFoundryMavisSoftKey():createFoundryMoogSoftKey(),key=markReview(rendered.button,semanticReviewId(slug,'key',note)),mount=rendered.node,cell=el('div','obj-chromatic-pad')
      key.classList.add('obj-pad-key');key.setAttribute('aria-label',`${noteName} · MIDI ${note}`);key.dataset.noteClass='chromatic';key.dataset.note=String(note);key.dataset.performanceControl='chromatic-pad-v1';key.tabIndex=i===0?0:-1;keyButtons.push(key);mount.dataset.note=String(note);cell.dataset.note=String(note)
      let held=false
      const velocityFor=event=>{const fallback=Number(keyboard.velocity??108),pressure=Number(event?.pressure||0),expressive=(event?.pointerType==='touch'||event?.pointerType==='pen')&&pressure>0;return expressive?Math.round(32+clamp(pressure,0,1)*95):fallback}
      const on=event=>{event?.preventDefault?.();if(held)return;held=true;api.trigger('keyboard.noteOn',{note,velocity:velocityFor(event)});rendered.setPressed(true);key.classList.add('is-held')}
      const off=event=>{if(!held)return;held=false;try{api.trigger('keyboard.noteOff',{note})}catch{};rendered.setPressed(false);key.classList.remove('is-held');try{key.releasePointerCapture(event?.pointerId)}catch{}}
      key.addEventListener('pointerdown',event=>{focusPad(i);on(event);try{key.setPointerCapture(event.pointerId)}catch{}});key.addEventListener('pointerup',off);key.addEventListener('pointercancel',off);key.addEventListener('lostpointercapture',off);key.addEventListener('blur',off)
      key.addEventListener('moog-force-note-release',off)
      key.addEventListener('keydown',event=>{const nav={ArrowLeft:i-1,ArrowRight:i+1,ArrowUp:i-7,ArrowDown:i+7,Home:0,End:count-1};if(Object.hasOwn(nav,event.key)){event.preventDefault();focusPad(nav[event.key]);return}if((event.key===' '||event.key==='Enter')&&!event.repeat)on(event)});key.addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();off(event)}})
      cell.append(mount,el('span','obj-chromatic-pad__label',noteName));grid.append(cell)
    }
    root.append(grid);return root
  }
  const board=el('div','obj-keyboard__keys')
  for(let i=0;i<count;i++){
    const note=start+i,key=markReview(el('button',`obj-key ${black.has(note%12)?'is-black':'is-white'}`),semanticReviewId(slug,'key',note));key.type='button';key.setAttribute('aria-label',`MIDI ${note}`)
    const on=event=>{event.preventDefault();try{key.setPointerCapture(event.pointerId)}catch{};api.trigger('keyboard.noteOn',{note,velocity:Number(keyboard.velocity??108)});key.classList.add('is-held')}
    const off=event=>{try{api.trigger('keyboard.noteOff',{note})}catch{};key.classList.remove('is-held');try{key.releasePointerCapture(event?.pointerId)}catch{}}
    key.addEventListener('pointerdown',on);key.addEventListener('pointerup',off);key.addEventListener('pointercancel',off);key.addEventListener('lostpointercapture',off);key.addEventListener('moog-force-note-release',off);board.append(key)
  }
  root.append(board);return root
}

export function ensureStyle(id,css){
  if(document.getElementById(id))return
  const style=document.createElement('style');style.id=id;style.textContent=css;document.head.append(style)
}
