// Presentation lifetime only. Never stop a transport, note planner or MIDI queue.
// Native AU hosts may hide an editor without changing document.hidden.
const listeners=new Set()
let hostPaused=false,revision=0,disposed=false
export const isSurfacePresented=()=>!disposed&&!hostPaused&&globalThis.document?.hidden!==true
export const surfacePresentationRevision=()=>revision
const notify=()=>{revision+=1;const visible=isSurfacePresented();for(const callback of [...listeners])try{callback(visible,revision)}catch(error){console.error('surfaceVisibility.listenerFailed',error)}}
const onLifecycle=event=>{
  const state=typeof event?.detail==='string'?event.detail:String(event?.detail?.state||'')
  if(state!=='paused'&&state!=='resumed')return
  const paused=state==='paused';if(paused===hostPaused)return
  hostPaused=paused;notify()
}
const onVisibility=()=>notify()
const onPageHide=event=>{
  hostPaused=true;notify()
  if(event?.persisted)return
  disposed=true;listeners.clear()
  globalThis.removeEventListener?.('ppw-host-lifecycle',onLifecycle)
  globalThis.document?.removeEventListener?.('visibilitychange',onVisibility)
  globalThis.removeEventListener?.('pageshow',onPageShow)
}
const onPageShow=event=>{if(event?.persisted){hostPaused=false;notify()}}
globalThis.addEventListener?.('ppw-host-lifecycle',onLifecycle)
globalThis.document?.addEventListener?.('visibilitychange',onVisibility)
globalThis.addEventListener?.('pagehide',onPageHide)
globalThis.addEventListener?.('pageshow',onPageShow)
export function subscribeSurfacePresentation(callback,{immediate=false}={}){
  if(typeof callback!=='function')throw new TypeError('surfaceVisibility.callbackRequired')
  if(disposed)return()=>{}
  listeners.add(callback);if(immediate)callback(isSurfacePresented(),revision)
  return()=>listeners.delete(callback)
}
