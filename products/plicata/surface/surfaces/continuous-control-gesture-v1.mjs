export const CONTINUOUS_CONTROL_GESTURE_SCHEMA='trambustissimo-continuous-control-gesture-v1'

// One acknowledged native batch in flight. Continuous values may supersede one
// another, but never cross a command/restore/save boundary. Drawing is not gated
// on this mailbox. A final flush bypasses the cadence, not the ordering fence.
export function createLatestControlMailbox(send,{
  intervalMs=1000/60,now=()=>performance.now(),schedule=setTimeout,cancelTimer=clearTimeout,
  enqueue=queueMicrotask,onError=()=>{},
}={}){
  let jobs=[],tail=null,busy=false,timer=null,queued=false,lastAt=-Infinity,disposed=false
  const clearTimer=()=>{if(timer!==null){cancelTimer(timer);timer=null}}
  const wake=()=>{if(!queued&&!disposed){queued=true;enqueue(()=>{queued=false;pump()})}}
  const pump=()=>{
    if(disposed||busy||!jobs.length)return
    const cadenceRaw=typeof intervalMs==='function'?Number(intervalMs()):Number(intervalMs),cadence=Number.isFinite(cadenceRaw)&&cadenceRaw>=0?cadenceRaw:1000/60
    const job=jobs[0],remaining=cadence-(now()-lastAt)
    if(job.values&&!job.urgent&&remaining>0){if(timer===null)timer=schedule(()=>{timer=null;pump()},remaining);return}
    clearTimer();jobs.shift();if(tail===job)tail=null;busy=true
    let result
    try{if(job.values){lastAt=now();result=send([...job.values].map(([id,value])=>({id,value})))}else result=job.run()}
    catch(error){result=Promise.reject(error)}
    Promise.resolve(result).then(job.resolve,error=>{
      job.reject?.(error)
      // A failed batch must not masquerade as a successful flush/save fence.
      clearTimer();for(const next of jobs)next.reject?.(error);jobs=[];tail=null
      onError(error)
    }).finally(()=>{busy=false;wake()})
  }
  const barrier=run=>{
    if(disposed)return Promise.reject(new Error('controlMailbox.disposed'))
    // Do not accumulate an unbounded command queue if the native host hangs.
    if(jobs.length>=128)return Promise.reject(new Error('controlMailbox.commandBacklog'))
    if(tail){tail.urgent=true;tail=null}
    const promise=new Promise((resolve,reject)=>jobs.push({run,resolve,reject}))
    clearTimer();wake();return promise
  }
  return{
    push(id,value){if(disposed)throw new Error('controlMailbox.disposed');if(!tail){tail={values:new Map(),urgent:false};jobs.push(tail)}tail.values.set(id,value);wake()},
    barrier,
    flush:()=>barrier(()=>true),
    get pending(){return busy||jobs.length>0},
    dispose(){disposed=true;clearTimer();for(const job of jobs)job.reject?.(new Error('controlMailbox.disposed'));jobs=[];tail=null},
  }
}

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0))

// One terminal-event arbiter only while controls own a gesture. No idle polling,
// no time-based cancellation of a genuinely held finger, and no audio PANIC.
const activeControlGestures=new Set()
const cancelActiveControls=()=>{for(const cancel of [...activeControlGestures])cancel()}
const controlDocumentHidden=()=>{if(globalThis.document?.hidden)cancelActiveControls()}
const controlHostLifecycle=event=>{if(String(event?.detail||'')==='paused')cancelActiveControls()}
export function registerControlGestureCancellation(cancel){
  if(!activeControlGestures.size){globalThis.addEventListener?.('blur',cancelActiveControls);globalThis.addEventListener?.('ppw-host-lifecycle',controlHostLifecycle);globalThis.document?.addEventListener?.('visibilitychange',controlDocumentHidden)}
  activeControlGestures.add(cancel)
  return()=>{activeControlGestures.delete(cancel);if(!activeControlGestures.size){globalThis.removeEventListener?.('blur',cancelActiveControls);globalThis.removeEventListener?.('ppw-host-lifecycle',controlHostLifecycle);globalThis.document?.removeEventListener?.('visibilitychange',controlDocumentHidden)}}
}

// Audio/control delivery must not wait for a WebView compositor frame. Preview
// stays in the pointer handler; send the leading value now, coalesce subsequent
// values, and always flush the exact final value before ending the transaction.
export function createControlWriteScheduler(commit,{intervalMs=8,now=()=>performance.now(),schedule=setTimeout,cancelTimer=clearTimeout}={}){
  let timer=null,pending=null,lastAt=-Infinity
  const clearTimer=()=>{if(timer!==null){cancelTimer(timer);timer=null}}
  const flush=()=>{clearTimer();if(pending===null)return;const args=pending;pending=null;lastAt=now();commit(...args)}
  return{
    push(...args){pending=args;const remaining=intervalMs-(now()-lastAt);if(remaining<=0)flush();else if(timer===null)timer=schedule(flush,remaining)},
    flush,
    cancel(){clearTimer();pending=null;lastAt=-Infinity},
  }
}

// Leading feedback belongs to the input task, independently of audio delivery.
// Keyed pending values retain each touched cell during a cross-step swipe.
export function createControlVisualScheduler(paint,{
  requestFrame=callback=>requestAnimationFrame(callback),
  cancelFrame=id=>cancelAnimationFrame(id),
  now=()=>performance.now(),schedule=setTimeout,cancelTimer=clearTimeout,maxWaitMs=1000/60,
}={}){
  // rAF is a presentation opportunity, not a reliable clock during WebKit
  // tracking/throttling. Keep authored feedback current even if that opportunity
  // is late, while retaining one keyed pending set and a bounded fallback.
  let frame=null,fallback=null,pending=new Map(),lastPaintAt=-Infinity
  const wait=Number.isFinite(Number(maxWaitMs))&&Number(maxWaitMs)>0?Number(maxWaitMs):1000/60
  const clearFallback=()=>{if(fallback!==null){cancelTimer(fallback);fallback=null}}
  const renderPending=()=>{clearFallback();if(!pending.size)return;const rows=pending;pending=new Map();lastPaintAt=now();for(const [key,args] of rows)paint(key,...args)}
  const tick=()=>{frame=null;if(!pending.size)return;frame=requestFrame(tick);renderPending()}
  const cancel=()=>{if(frame!==null)cancelFrame(frame);frame=null;clearFallback();pending.clear();lastPaintAt=-Infinity}
  return{
    push(key,...args){pending.set(key,args);if(frame===null){frame=requestFrame(tick);renderPending();return}const remaining=wait-(now()-lastPaintAt);if(remaining<=0)renderPending();else if(fallback===null)fallback=schedule(()=>{fallback=null;renderPending()},remaining)},
    flush(){if(frame!==null)cancelFrame(frame);frame=null;renderPending()},
    cancel,
  }
}

export function installVerticalContinuousDrag(element,{
  getNormalized,
  setNormalized,
  previewNormalized=()=>{},
  beginGesture=()=>{},
  endGesture=()=>{},
  sensitivity=180,
  fineSensitivity=420,
  disabled=()=>false,
  tap=null,
}={}){
  if(!element||typeof element.addEventListener!=='function')throw new Error('continuousControl.elementInvalid')
  if(typeof getNormalized!=='function'||typeof setNormalized!=='function'||typeof previewNormalized!=='function')throw new Error('continuousControl.callbacksInvalid')
  element.dataset.continuousControlGesture='vertical-drag-v1'
  element.style.touchAction='none'
  element.style.webkitTouchCallout='none'
  element.style.webkitUserSelect='none'
  element.style.userSelect='none'
  element.style.cursor='ns-resize'
  if(tap!==null&&typeof tap!=='function')throw new Error('continuousControl.tapCallbackInvalid')
  let pointerId=null,startX=0,startY=0,startValue=0,active=false,moved=false,downAt=0,panShieldTarget=null,stopCancellation=null
  const delivery=createControlWriteScheduler(setNormalized)
  const visual=createControlVisualScheduler((_key,...args)=>previewNormalized(...args))
  const blockNativePan=event=>{if(active&&event.cancelable)event.preventDefault()}
  const armNativePanShield=()=>{const target=element.ownerDocument||globalThis.document;if(!target||panShieldTarget===target)return;panShieldTarget=target;target.addEventListener('touchmove',blockNativePan,{capture:true,passive:false})}
  const disarmNativePanShield=()=>{if(!panShieldTarget)return;panShieldTarget.removeEventListener('touchmove',blockNativePan,true);panShieldTarget=null}
  const finish=(event,outcome='commit')=>{
    if(!active)return
    active=false;delete element.dataset.continuousControlActive;stopCancellation?.();stopCancellation=null;disarmNativePanShield()
    const captured=pointerId;pointerId=null
    try{visual.flush();if(outcome==='commit')delivery.flush()}finally{visual.cancel();delivery.cancel();try{endGesture(outcome,event)}finally{try{element.releasePointerCapture?.(captured)}catch{}}}
  }
  const onDown=event=>{
    if(active||disabled()||(event.pointerType==='mouse'&&event.button!==0))return
    event.preventDefault()
    pointerId=event.pointerId
    startX=Number(event.clientX)||0
    startY=Number(event.clientY)||0
    startValue=clamp(getNormalized())
    moved=false
    downAt=performance.now()
    active=true
    element.dataset.continuousControlActive='1'
    stopCancellation=registerControlGestureCancellation(()=>finish(null,'cancel'))
    armNativePanShield()
    try{element.setPointerCapture?.(pointerId)}catch{}
    beginGesture(event)
  }
  const onMove=event=>{
    if(!active||event.pointerId!==pointerId)return
    event.preventDefault()
    const samples=event.getCoalescedEvents?.(),sample=samples?.length?samples[samples.length-1]:event
    if(Math.hypot((Number(sample.clientX)||0)-startX,(Number(sample.clientY)||0)-startY)>12)moved=true
    const travel=sample.shiftKey?fineSensitivity:sensitivity
    const configuredTravel=Number(element.dataset.continuousTravel),effectiveTravel=Number.isFinite(configuredTravel)&&configuredTravel>0?configuredTravel:travel
    const next=clamp(startValue+(startY-(Number(sample.clientY)||0))/Math.max(1,effectiveTravel))
    visual.push('value',next,sample)
    delivery.push(next,sample)
  }
  const onUp=event=>{if(event.pointerId===pointerId){event.preventDefault();const isTap=!moved&&performance.now()-downAt<=420;finish(event,'commit');if(isTap)tap?.(event)}}
  const onCancel=event=>{if(event.pointerId===pointerId){if(event.cancelable)event.preventDefault();finish(event,'cancel')}}
  const onLost=event=>{if(active&&event.pointerId===pointerId)finish(event,'commit')}
  const onHostCancel=event=>{if(active)finish(event,String(event?.detail?.outcome||'cancel')==='commit'?'commit':'cancel')}

  element.addEventListener('pointerdown',onDown)
  element.addEventListener('pointermove',onMove)
  element.addEventListener('pointerup',onUp)
  element.addEventListener('pointercancel',onCancel)
  element.addEventListener('lostpointercapture',onLost)
  element.addEventListener('ppw-control-cancel',onHostCancel)

  return{
    schema:CONTINUOUS_CONTROL_GESTURE_SCHEMA,
    axis:'vertical',
    destroy(){finish(null,'cancel');disarmNativePanShield();delivery.cancel();element.removeEventListener('pointerdown',onDown);element.removeEventListener('pointermove',onMove);element.removeEventListener('pointerup',onUp);element.removeEventListener('pointercancel',onCancel);element.removeEventListener('lostpointercapture',onLost);element.removeEventListener('ppw-control-cancel',onHostCancel)}
  }
}

export function installHorizontalContinuousDrag(element,{
  getNormalized,
  setNormalized,
  previewNormalized=()=>{},
  beginGesture=()=>{},
  endGesture=()=>{},
  disabled=()=>false,
}={}){
  if(!element||typeof element.addEventListener!=='function')throw new Error('continuousControl.elementInvalid')
  if(typeof getNormalized!=='function'||typeof setNormalized!=='function'||typeof previewNormalized!=='function')throw new Error('continuousControl.callbacksInvalid')
  element.dataset.continuousControlGesture='horizontal-drag-v1'
  element.style.touchAction='none'
  element.style.webkitTouchCallout='none'
  element.style.webkitUserSelect='none'
  element.style.userSelect='none'
  element.style.cursor='ew-resize'
  let pointerId=null,active=false,gestureRect=null,stopCancellation=null
  const delivery=createControlWriteScheduler(setNormalized)
  const visual=createControlVisualScheduler((_key,...args)=>previewNormalized(...args))
  const normalizedAt=event=>{const rect=gestureRect||element.getBoundingClientRect(),width=Math.max(1,Number(rect.width)||1);return clamp(((Number(event.clientX)||0)-Number(rect.left||0))/width)}
  const update=event=>{const samples=event.getCoalescedEvents?.(),sample=samples?.length?samples[samples.length-1]:event,next=normalizedAt(sample);visual.push('value',next,sample);delivery.push(next,sample)}
  const finish=(event,outcome='commit')=>{if(!active)return;active=false;delete element.dataset.continuousControlActive;stopCancellation?.();stopCancellation=null;gestureRect=null;const captured=pointerId;pointerId=null;try{visual.flush();if(outcome==='commit')delivery.flush()}finally{visual.cancel();delivery.cancel();try{endGesture(outcome,event)}finally{try{element.releasePointerCapture?.(captured)}catch{}}}}
  const onDown=event=>{if(active||disabled()||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();gestureRect=element.getBoundingClientRect();pointerId=event.pointerId;active=true;element.dataset.continuousControlActive='1';stopCancellation=registerControlGestureCancellation(()=>finish(null,'cancel'));try{element.setPointerCapture?.(pointerId)}catch{};beginGesture(event);update(event)}
  const onMove=event=>{if(!active||event.pointerId!==pointerId)return;event.preventDefault();update(event)}
  const onUp=event=>{if(event.pointerId===pointerId){event.preventDefault();update(event);finish(event,'commit')}}
  const onCancel=event=>{if(event.pointerId===pointerId)finish(event,'cancel')}
  const onLost=event=>{if(active&&event.pointerId===pointerId)finish(event,'commit')},onHostCancel=event=>{if(active)finish(event,String(event?.detail?.outcome||'cancel')==='commit'?'commit':'cancel')}
  element.addEventListener('pointerdown',onDown);element.addEventListener('pointermove',onMove);element.addEventListener('pointerup',onUp);element.addEventListener('pointercancel',onCancel);element.addEventListener('lostpointercapture',onLost);element.addEventListener('ppw-control-cancel',onHostCancel)
  return{schema:CONTINUOUS_CONTROL_GESTURE_SCHEMA,axis:'horizontal',getNormalized,destroy(){finish(null,'cancel');delivery.cancel();element.removeEventListener('pointerdown',onDown);element.removeEventListener('pointermove',onMove);element.removeEventListener('pointerup',onUp);element.removeEventListener('pointercancel',onCancel);element.removeEventListener('lostpointercapture',onLost);element.removeEventListener('ppw-control-cancel',onHostCancel)}}
}
