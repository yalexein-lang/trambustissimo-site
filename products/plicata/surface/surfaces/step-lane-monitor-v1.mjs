import {createControlWriteScheduler} from './continuous-control-gesture-v1.mjs'

export const STEP_LANE_MONITOR_SCHEMA='trambustissimo-step-lane-monitor-v1'

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0))

export function installStepLanePaintGesture(element,{
  visibleStepCount=16,
  totalSteps=32,
  bankStart=()=>0,
  selectedStep=()=>0,
  setSelectedStep=()=>{},
  readNormalized=()=>0,
  writeNormalized=()=>{},
  toggleStep=()=>{},
  beginTransaction=()=>null,
  endTransaction=()=>{},
  onPreview=()=>{},
  onCancel=()=>{},
  transactionMeta=()=>({kind:'step-lane-paint'}),
  keyboardStep=.08,
}={}){
  if(!element||typeof element.addEventListener!=='function')throw new Error('stepLaneMonitor.elementInvalid')
  const visible=Math.max(1,Math.round(Number(visibleStepCount)||16)),total=Math.max(1,Math.round(Number(totalSteps)||32))
  let drag=null
  const delivery=createControlWriteScheduler(()=>applyPending())
  const pointFromEvent=(event,rect=drag?.rect)=>{
    if(!rect||rect.width<1||rect.height<1)return null
    const sample=event?.getCoalescedEvents?.()?.at?.(-1)||event
    const x=Number(sample?.clientX),y=Number(sample?.clientY)
    if(!Number.isFinite(x)||!Number.isFinite(y))return null
    const column=Math.max(0,Math.min(visible-1,Math.floor((x-rect.left)/Math.max(1,rect.width)*visible)))
    const step=Math.max(0,Math.min(total-1,Math.round(Number(bankStart())||0)+column))
    const normalized=clamp01(1-(y-rect.top)/Math.max(1,rect.height))
    return{step,normalized,x,y}
  }
  const applyPending=()=>{
    if(!drag?.pending)return
    const point=drag.pending;drag.pending=null
    if(!drag.moved&&Math.hypot(point.x-drag.startX,point.y-drag.startY)<6&&point.step===drag.startStep)return
    drag.moved=true
    const from=drag.step,to=point.step,distance=Math.abs(to-from),direction=to>=from?1:-1,changed=new Set()
    for(let index=0;index<=distance;index+=1){
      const step=from+direction*index,t=distance?index/distance:1,normalized=drag.normalized+(point.normalized-drag.normalized)*t
      writeNormalized(step,clamp01(normalized),drag.transaction)
      changed.add(step)
    }
    drag.step=to;drag.normalized=point.normalized;setSelectedStep(to)
    onPreview({changedSteps:changed,selectedStep:to,normalized:point.normalized,moved:true})
  }
  const finish=(event,outcome)=>{
    if(!drag||event?.pointerId!==undefined&&drag.pointerId!==event.pointerId)return
    if(outcome==='commit')delivery.flush()
    else delivery.cancel()
    const completed=drag;drag=null
    try{element.releasePointerCapture?.(completed.pointerId)}catch{}
    if(outcome==='commit'){
      if(!completed.moved)toggleStep(completed.startStep,completed.transaction)
      endTransaction(completed.transaction,'commit')
      onPreview({changedSteps:new Set([completed.startStep,completed.step]),selectedStep:selectedStep(),normalized:readNormalized(selectedStep()),moved:completed.moved,committed:true})
    }else{
      onCancel(completed)
      endTransaction(completed.transaction,'cancel')
      onPreview({changedSteps:null,selectedStep:selectedStep(),cancelled:true})
    }
  }
  const onPointerDown=event=>{
    if(drag||(event.pointerType==='mouse'&&event.button!==0))return
    const rect=element.getBoundingClientRect(),point=pointFromEvent(event,rect);if(!point)return
    event.preventDefault();setSelectedStep(point.step)
    const transaction=beginTransaction(transactionMeta({step:point.step,normalized:point.normalized,event}))
    drag={pointerId:event.pointerId,transaction,rect,startStep:point.step,step:point.step,startX:point.x,startY:point.y,normalized:point.normalized,moved:false,pending:null}
    try{element.setPointerCapture?.(event.pointerId)}catch{}
    onPreview({changedSteps:new Set([point.step]),selectedStep:point.step,normalized:point.normalized,moved:false})
  }
  const onPointerMove=event=>{if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();const point=pointFromEvent(event,drag.rect);if(!point)return;drag.pending=point;delivery.push()}
  const onPointerUp=event=>{if(!drag||drag.pointerId!==event.pointerId)return;event.preventDefault();finish(event,'commit')}
  const onPointerCancel=event=>{if(!drag||drag.pointerId!==event.pointerId)return;if(event.cancelable)event.preventDefault();finish(event,'cancel')}
  const onLostPointerCapture=event=>{if(!drag||drag.pointerId!==event.pointerId)return;finish(event,'cancel')}
  const onKeyDown=event=>{
    const current=Math.max(0,Math.min(total-1,Math.round(Number(selectedStep())||0)))
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();const delta=event.key==='ArrowRight'?1:-1,next=(current+delta+total)%total;setSelectedStep(next);onPreview({changedSteps:new Set([current,next]),selectedStep:next,keyboard:true});return
    }
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();const transaction=beginTransaction(transactionMeta({step:current,keyboard:true,event})),delta=event.key==='ArrowUp'?keyboardStep:-keyboardStep
      writeNormalized(current,clamp01(readNormalized(current)+delta),transaction);endTransaction(transaction,'commit');onPreview({changedSteps:new Set([current]),selectedStep:current,normalized:readNormalized(current),keyboard:true,committed:true});return
    }
    if(event.key===' '||event.key==='Enter'){
      event.preventDefault();const transaction=beginTransaction(transactionMeta({step:current,keyboard:true,event}));toggleStep(current,transaction);endTransaction(transaction,'commit');onPreview({changedSteps:new Set([current]),selectedStep:current,keyboard:true,committed:true})
    }
  }
  element.dataset.stepLaneGesture=STEP_LANE_MONITOR_SCHEMA
  element.style.touchAction='none'
  element.style.userSelect='none'
  if(!element.hasAttribute('tabindex'))element.tabIndex=0
  element.addEventListener('pointerdown',onPointerDown)
  element.addEventListener('pointermove',onPointerMove)
  element.addEventListener('pointerup',onPointerUp)
  element.addEventListener('pointercancel',onPointerCancel)
  element.addEventListener('lostpointercapture',onLostPointerCapture)
  element.addEventListener('keydown',onKeyDown)
  return{
    schema:STEP_LANE_MONITOR_SCHEMA,
    flush:delivery.flush,
    cancel:()=>{if(drag)finish(null,'cancel');else delivery.cancel()},
    destroy(){if(drag)finish(null,'cancel');delivery.cancel();element.removeEventListener('pointerdown',onPointerDown);element.removeEventListener('pointermove',onPointerMove);element.removeEventListener('pointerup',onPointerUp);element.removeEventListener('pointercancel',onPointerCancel);element.removeEventListener('lostpointercapture',onLostPointerCapture);element.removeEventListener('keydown',onKeyDown)}
  }
}
