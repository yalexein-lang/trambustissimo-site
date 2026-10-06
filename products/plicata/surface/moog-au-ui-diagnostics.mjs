// Opt-in canary only. No audio, presets, parameter values or user text are recorded.
// rAF measures JS frame opportunities, NOT actual display presentation or audio latency.
export function summarizeSamples(values){
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length
  return{count:n,p95:n?sorted[Math.min(n-1,Math.floor(n*.95))]:null,max:n?sorted[n-1]:null}
}
export function installMoogUIDiagnostics({enabled=false,slug,request}={}){
  if(!enabled)return{record(){},destroy(){},snapshot:()=>null}
  const series=new Map(),active=new Set(),eventStarts=new WeakMap();let frame=0,lastFrame=0,hotUntil=0,pendingInput=null,latestInput=null,saveTimer=0,destroyed=false,capturedEvents=0,bubbledEvents=0
  const record=(id,value)=>{if(!Number.isFinite(value)||value<0)return;let rows=series.get(id);if(!rows){rows=[];series.set(id,rows)}if(rows.length===512)rows.shift();rows.push(value)}
  const snapshot=()=>({schema:'moog-au-ui-diagnostics-v1',build:String(globalThis.__PPW_AUV3_BOOT__?.hostContext?.build||'unknown'),version:String(globalThis.__PPW_AUV3_BOOT__?.hostContext?.version||'unknown'),instrumentationRevision:2,slug,at:new Date().toISOString(),metrics:Object.fromEntries([...series].map(([id,rows])=>[id,summarizeSamples(rows)])),eventCoverage:{captured:capturedEvents,reachedWindowBubble:bubbledEvents},visibility:document.visibilityState,proof:'Native WKWebView event/bridge/rAF opportunities. Capture-to-window-bubble includes only events reaching that observer, not an entire browser task. Neither rAF timestamps nor DOM updates prove display scanout or audio latency.'})
  const save=()=>{saveTimer=0;if(destroyed||active.size)return;request('uiDiagnosticsSave',{snapshot:snapshot()}).catch(()=>{})}
  const onFrame=()=>{const now=performance.now();frame=0;if(lastFrame)record('activeFrameIntervalMs',now-lastFrame);lastFrame=now;if(pendingInput!==null){record('eventToFrameOpportunityMs',now-pendingInput);record('latestEventToFrameOpportunityMs',now-latestInput);pendingInput=null;latestInput=null}if(active.size||now<hotUntil)frame=requestAnimationFrame(onFrame);else lastFrame=0}
  const eventStart=event=>{
    if(!event.isTrusted||event.target?.closest?.('[data-ui-diagnostics]'))return
    if(event.type==='pointerdown')active.add(event.pointerId)
    if(!active.has(event.pointerId))return
    const now=performance.now(),stamp=event.timeStamp>performance.timeOrigin?event.timeStamp-performance.timeOrigin:event.timeStamp
    if(now-stamp<60000)record('inputDispatchDelayMs',now-stamp)
    // Keep the oldest unpresented input: replacing it on every move hid stalls.
    if(pendingInput===null)pendingInput=now;latestInput=now;hotUntil=now+150;if(!frame)frame=requestAnimationFrame(onFrame)
    if(saveTimer){clearTimeout(saveTimer);saveTimer=0}
    capturedEvents+=1;eventStarts.set(event,now)
    // A capture-listener microtask can run before the target listener on a
    // trusted event. It is not a measurement of that control's handler.
  }
  const eventBubble=event=>{const start=eventStarts.get(event);if(start===undefined)return;eventStarts.delete(event);bubbledEvents+=1;record('captureToWindowBubbleMs',performance.now()-start)}
  const eventEnd=event=>{if(!active.delete(event.pointerId))return;if(!active.size)saveTimer=setTimeout(save,2500)}
  const panel=document.createElement('details');panel.dataset.uiDiagnostics='1'
  Object.assign(panel.style,{position:'fixed',right:'8px',bottom:'8px',zIndex:'2147483646',color:'#fff',background:'#15231fee',border:'1px solid #869d90',borderRadius:'5px',padding:'5px',font:'11px/1.4 ui-monospace,monospace',maxWidth:'360px'})
  const summary=document.createElement('summary');const identity=globalThis.__PPW_AUV3_BOOT__?.hostContext||{};summary.textContent=`PERF · ${identity.version||'AUDIT'} (${identity.build||'?'})`;summary.style.touchAction='manipulation'
  const output=document.createElement('pre');output.style.margin='6px 0';output.style.whiteSpace='pre-wrap'
  const reset=document.createElement('button');reset.textContent='RESET MEASUREMENTS';Object.assign(reset.style,{minHeight:'44px',color:'#fff',background:'#293d34',border:'1px solid #71897c'})
  reset.addEventListener('click',()=>{series.clear();capturedEvents=0;bubbledEvents=0;output.textContent='Move a control to measure.'})
  panel.append(summary,output,reset);document.body.append(panel)
  const render=()=>{if(!panel.open)return;const fmt=id=>{const m=summarizeSamples(series.get(id)||[]);return m.count?`${m.p95.toFixed(1)} / ${m.max.toFixed(1)} ms`:'no samples'};output.textContent=`p95 / worst (last 512 samples)\nInput queue: ${fmt('inputDispatchDelayMs')}\nCapture → bubble: ${fmt('captureToWindowBubbleMs')}\nFrame gap: ${fmt('activeFrameIntervalMs')}\nOldest input → rAF: ${fmt('eventToFrameOpportunityMs')}\nLatest input → rAF: ${fmt('latestEventToFrameOpportunityMs')}\nTelemetry round trip: ${fmt('telemetryRoundTripMs')}\nControl round trip: ${fmt('controlBatchRoundTripMs')}\nNative read: ${fmt('nativeTelemetryMs')}\nFeedback gap: ${fmt('telemetryArrivalIntervalMs')}\nNot an audio latency measurement.`}
  const stopInput=()=>{active.clear();pendingInput=null;latestInput=null;hotUntil=0;lastFrame=0;if(frame)cancelAnimationFrame(frame);frame=0;if(saveTimer)clearTimeout(saveTimer);saveTimer=0}
  const pause=()=>{stopInput();if(capturedEvents)save()}
  const visibility=()=>{if(document.visibilityState==='hidden')pause()}
  const lifecycle=event=>{if(event.detail==='paused'||event.detail?.state==='paused')pause()}
  globalThis.addEventListener('blur',pause);globalThis.addEventListener('ppw-host-lifecycle',lifecycle);document.addEventListener('visibilitychange',visibility)
  const timer=setInterval(render,1000)
  for(const type of ['pointerdown','pointermove']){document.addEventListener(type,eventStart,{capture:true,passive:true});globalThis.addEventListener(type,eventBubble,{passive:true})}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,eventEnd,{capture:true,passive:true})
  return{record,snapshot,destroy(){destroyed=true;stopInput();clearInterval(timer);globalThis.removeEventListener('blur',pause);globalThis.removeEventListener('ppw-host-lifecycle',lifecycle);document.removeEventListener('visibilitychange',visibility);for(const type of ['pointerdown','pointermove']){document.removeEventListener(type,eventStart,true);globalThis.removeEventListener(type,eventBubble)};for(const type of ['pointerup','pointercancel','lostpointercapture'])document.removeEventListener(type,eventEnd,true);panel.remove()}}
}
