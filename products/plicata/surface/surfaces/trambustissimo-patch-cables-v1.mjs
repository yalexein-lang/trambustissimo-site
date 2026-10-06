import {ensureStyle} from './objectual-primitives-v1.mjs'
import {subscribeSurfacePresentation} from './surface-visibility-v1.mjs'

const STYLE_ID='trambustissimo-patch-cables-v1-style'
const COLORS=['#3f8f88','#c77a3c','#d1b63f','#4d7fa9','#a85e52','#7867a2']

function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function stateFor(slug,value,stateIdentity=null){
  const cables=[]
  for(const row of Array.isArray(value?.cables)?value.cables:[]){
    if(!row||typeof row!=='object'||Array.isArray(row)||!row.target)continue
    const target=String(row.target)
    if(row.source){cables.push({source:String(row.source),target});continue}
    if(Object.prototype.hasOwnProperty.call(row,'externalVolts')&&Number.isFinite(Number(row.externalVolts))){cables.push({externalVolts:Number(row.externalVolts),target});continue}
    if(row.externalAudio===true){cables.push({externalAudio:true,target});continue}
    if(row.externalEvent===true){cables.push({externalEvent:true,target})}
  }
  if(stateIdentity?.schema==='typed-patch-state-v1')return{schema:'typed-patch-state-v1',productId:String(stateIdentity.productId||''),cables}
  if(stateIdentity?.schema==='make-noise-family-patch-state-v1')return{schema:'make-noise-family-patch-state-v1',productId:String(stateIdentity.productId||''),profile:String(value?.profile||'FREE'),cables}
  return{schema:'moog-patch-state-v1',slug:String(slug),cables}
}
function externalKind(cable){
  if(cable?.externalAudio===true)return'audio'
  if(cable?.externalEvent===true)return'event'
  if(cable&&Object.prototype.hasOwnProperty.call(cable,'externalVolts'))return'cv'
  return''
}
function hash(text){let value=2166136261;for(const char of String(text)){value^=char.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0}
function cableColor(source,target){return COLORS[hash(`${source}->${target}`)%COLORS.length]}
function domainCompatible(a,b){
  if(!a||!b||a.direction===b.direction)return false
  return (a.direction==='output'&&b.direction==='input')||(b.direction==='output'&&a.direction==='input')
}
function normalizedCable(a,b){
  const output=a.direction==='output'?a:b,input=a.direction==='input'?a:b
  return output?.direction==='output'&&input?.direction==='input'?{source:output.id,target:input.id}:null
}
function pointInSvg(layer,clientX,clientY,projection=null){
  const x=Number(clientX),y=Number(clientY);if(!Number.isFinite(x)||!Number.isFinite(y))return null
  // The inverse transform is read once in the geometry phase, never after writing
  // a draft path. This also preserves scaling/rotation without forcing SVG layout.
  if(projection){const local={x:projection.a*x+projection.c*y+projection.e,y:projection.b*x+projection.d*y+projection.f};return Number.isFinite(local.x)&&Number.isFinite(local.y)?local:null}
  try{const matrix=layer?.getScreenCTM?.()?.inverse?.();if(matrix)return pointInSvg(layer,x,y,matrix)}catch{}
  const rect=layer?.getBoundingClientRect?.();return rect?{x:x-rect.left,y:y-rect.top}:null
}
function curve(a,b,maxY=Infinity){
  // Physical patch leads hang below the sockets rather than reading as taut UI arcs.
  // Keep the endpoints exact, but give short and long runs substantially more slack.
  const distance=Math.hypot(b.x-a.x,b.y-a.y),sag=Math.min(156,Math.max(44,distance*.32)),base=Math.min(maxY,Math.max(a.y,b.y)+sag)
  return`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} C ${a.x.toFixed(2)} ${base.toFixed(2)}, ${b.x.toFixed(2)} ${base.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}
function curveStacked(a,b,maxY=Infinity){
  // Multiple routes from one output should still look like cables plugged into one
  // physical jack. They therefore share the exact socket origin and separate only
  // because their destinations differ; no synthetic fork/comb is drawn at rest.
  return curve(a,b,maxY)
}
function svgNode(name){return document.createElementNS('http://www.w3.org/2000/svg',name)}
function rectsOverlap(a,b,pad=0){return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad}
function placeExternalLabel({label,patchRoot,fromLeft,logicalWidth,logicalHeight,start}={}){
  const x=fromLeft?4:Math.max(4,logicalWidth-4),initialY=start.y-8,candidates=[initialY,start.y+16,start.y-22,start.y+30,start.y-36,start.y+44]
  label.setAttribute('x',String(x));label.setAttribute('text-anchor',fromLeft?'start':'end')
  const obstacles=[...patchRoot.querySelectorAll('.obj-jack__label')].map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0)
  let chosen=Math.max(8,Math.min(logicalHeight-4,initialY)),avoided=false
  for(const raw of candidates){const y=Math.max(8,Math.min(logicalHeight-4,raw));label.setAttribute('y',String(y));const rect=label.getBoundingClientRect();if(!obstacles.some(other=>rectsOverlap(rect,other,2))){chosen=y;avoided=Math.abs(y-initialY)>.5;break}}
  label.setAttribute('y',String(chosen));label.dataset.collisionAvoided=avoided?'1':'0'
}

export function installTrambustissimoPatchCables({slug,shell,patchRoot,jacks,api,authoritativePollMs=0,stateIdentity=null,initialCompatibility=null}={}){
  if(!(shell instanceof HTMLElement)||!(patchRoot instanceof HTMLElement)||!Array.isArray(jacks)||!api)throw new Error('trambustissimoPatchCables.invalidArguments')
  ensureStyle(STYLE_ID,`
.tram-patch-cable-layer{position:absolute;z-index:6;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.tram-patch-cable-shadow{fill:none;stroke:rgba(38,31,22,.38);stroke-width:7;stroke-linecap:round;stroke-linejoin:round}
.tram-patch-cable{fill:none;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(32,25,17,.23))}
.tram-patch-cable-hit{display:none!important;pointer-events:none!important}
.tram-patch-cable.is-route-dim,.tram-patch-cable-shadow.is-route-dim{opacity:.16}.tram-patch-cable.is-route-focus{stroke-width:5.5;filter:drop-shadow(0 0 3px color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 68%,transparent))}.tram-patch-cable-shadow.is-route-focus{opacity:.58}
.tram-patch-cable.is-draft{stroke-dasharray:7 5;opacity:.88}.tram-patch-cable.is-invalid{stroke:#a64c3e!important;opacity:.62}
.tram-patch-cable.is-external{stroke-dasharray:2.5 4.5}.tram-patch-external-node{fill:#efe0be;stroke:#4a4338;stroke-width:1.5}.tram-patch-external-label{fill:#4a4338;font:800 7px/1 ui-sans-serif,system-ui;letter-spacing:.06em}
.obj-jack__socket[data-patch-interactive='1']{position:relative;cursor:crosshair;touch-action:none;outline:none}
.obj-jack__socket[data-patch-interactive='1']::after{content:"";position:absolute;inset:-17px;border-radius:50%;pointer-events:auto}
.obj-jack__socket[data-patch-interactive='1']:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 62%,transparent),inset 0 0 0 2px rgba(255,255,255,.18)}
.tram-patch-occupancy{position:absolute;z-index:8;left:50%;top:0;display:none;min-width:12px;height:12px;box-sizing:border-box;padding:0 2px;place-items:center;transform:translate(7px,-2px);border:1px solid color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 76%,#1a1d1b);border-radius:999px;background:color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 78%,#111513);color:#fffaf2;font:900 5.6px/10px ui-monospace,monospace;box-shadow:0 1px 2px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.10);pointer-events:none}.obj-jack[data-patch-occupancy='multi'] .tram-patch-occupancy{display:grid}.obj-jack[data-patch-occupancy='multi'] .obj-jack__socket{box-shadow:inset 0 1px 2px #000,0 0 0 2px var(--patch-accent,var(--product-accent,#c9965a)),0 0 0 4px color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 20%,transparent),0 2px 3px rgba(47,43,36,.27)}.obj-jack[data-patch-occupancy='multi'] .obj-jack__socket::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:repeating-conic-gradient(from -12deg,color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 88%,#fff) 0 8deg,transparent 8deg 28deg);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));opacity:.72;pointer-events:none}.obj-jack[data-patch-focus-member='1'] .obj-jack__label{box-shadow:inset 0 -2px 0 var(--patch-accent,var(--product-accent,#c9965a))}.obj-jack[data-patch-focus-dim='1']{opacity:.46}
.obj-jack[data-patched='1'] .obj-jack__socket,.moog-product-shell .obj-jack[data-patched='1'] .obj-jack__socket{filter:brightness(.88) contrast(1.08);box-shadow:0 0 0 1px rgba(38,35,30,.72),0 0 0 3px rgba(214,209,197,.62),0 0 0 5px rgba(74,68,58,.28),inset 0 2px 4px #010202,inset 0 -1px 1px rgba(255,255,255,.08)}
.obj-jack[data-patch-stage='1'] .obj-jack__socket{box-shadow:0 0 0 3px rgba(61,133,125,.52),inset 0 1px 3px #020303}
.obj-jack[data-patch-hover='valid'] .obj-jack__socket{box-shadow:0 0 0 3px rgba(61,133,125,.68),0 0 0 6px rgba(61,133,125,.16),inset 0 1px 3px #020303}
.obj-jack[data-patch-hover='invalid'] .obj-jack__socket{box-shadow:0 0 0 3px rgba(166,76,62,.60),inset 0 1px 3px #020303}
.obj-jack[data-patch-candidate='valid'] .obj-jack__socket{box-shadow:0 0 0 3px rgba(61,133,125,.78),0 0 0 7px rgba(61,133,125,.17),inset 0 1px 3px #020303;animation:tramPatchEligible 1.05s ease-in-out infinite alternate}
.obj-jack[data-patch-candidate='blocked'] .obj-jack__socket{box-shadow:0 0 0 2px rgba(166,76,62,.48),inset 0 1px 3px #020303;opacity:.58}
.obj-jack[data-patch-candidate='irrelevant']{opacity:.43}.obj-jack[data-patch-candidate='source'] .obj-jack__socket{box-shadow:0 0 0 3px rgba(77,127,169,.76),0 0 0 7px rgba(77,127,169,.15),inset 0 1px 3px #020303}
.tram-patch-status{position:absolute;z-index:9;right:7px;top:5px;max-width:min(360px,72%);padding:5px 8px;border-radius:8px;background:rgba(47,42,34,.94);color:#f5ecd8;font:750 7.5px/1.25 ui-sans-serif,system-ui;letter-spacing:.035em;box-shadow:0 3px 10px rgba(45,35,22,.20);pointer-events:none}.tram-patch-status[data-tone='error']{background:rgba(116,49,39,.96)}.tram-patch-status[data-tone='ok']{background:rgba(45,102,91,.96)}
@keyframes tramPatchEligible{from{filter:brightness(.96)}to{filter:brightness(1.18)}}
`)
  const normalizedJacks=jacks.map(row=>({...row,id:String(row.id),direction:String(row.direction||''),domain:String(row.domain||'')})),idCounts=new Map();for(const row of normalizedJacks)idCounts.set(row.id,(idCounts.get(row.id)||0)+1)
  const nodeKey=spec=>idCounts.get(String(spec?.id||''))>1?`${String(spec?.direction||'')}:${String(spec?.id||'')}`:String(spec?.id||''),outputKey=id=>idCounts.get(String(id||''))>1?`output:${String(id||'')}`:String(id||''),inputKey=id=>idCounts.get(String(id||''))>1?`input:${String(id||'')}`:String(id||'')
  const specs=new Map(normalizedJacks.map(row=>[nodeKey(row),row])),outputSpecs=new Map(normalizedJacks.filter(row=>row.direction==='output').map(row=>[row.id,row])),inputSpecs=new Map(normalizedJacks.filter(row=>row.direction==='input').map(row=>[row.id,row])),expectedCompatibilityTargets=normalizedJacks.filter(row=>row.direction==='input').length
  const nodes=new Map(),sockets=new Map(),occupancyBadges=new Map(),rootSpecs=new Map()
  for(const root of patchRoot.querySelectorAll('.obj-jack[data-patch-id]')){
    const id=String(root.dataset.patchId||''),direction=String(root.dataset.direction||''),socket=root.querySelector('.obj-jack__socket');if(!socket)continue
    const dualSource=String(root.dataset.patchSourceId||''),dualTarget=String(root.dataset.patchTargetId||''),keys=dualSource&&dualTarget?[outputKey(dualSource),inputKey(dualTarget)]:[idCounts.get(id)>1?`${direction}:${id}`:id],resolved=keys.filter(key=>specs.has(key));if(!resolved.length)continue
    const badge=document.createElement('span');badge.className='tram-patch-occupancy';badge.setAttribute('aria-hidden','true');root.append(badge)
    for(const key of resolved){nodes.set(key,root);sockets.set(key,socket);occupancyBadges.set(key,badge)}rootSpecs.set(root,resolved.map(key=>specs.get(key)).filter(Boolean));socket.dataset.patchInteractive='1';if(resolved.length>1)socket.dataset.patchDualRole='1';socket.tabIndex=0;socket.setAttribute('role','button');socket.setAttribute('aria-label',resolved.length>1?`${root.getAttribute('aria-label')||id} · patch input / output`:`${root.getAttribute('aria-label')||id} · patch ${direction}`)
  }
  const layer=svgNode('svg'),staticLayer=svgNode('g'),draftLayer=svgNode('g');layer.classList.add('tram-patch-cable-layer');staticLayer.dataset.patchLayer='static';draftLayer.dataset.patchLayer='draft';layer.setAttribute('aria-hidden','true');layer.append(staticLayer,draftLayer);patchRoot.style.position='relative';patchRoot.append(layer)
  let state=stateFor(slug,null,stateIdentity),gesture=null,stage=null,pending=false,destroyed=false,lastSync=0,suppressClickUntil=0,compatibility=null,lastError='',statusTimer=0,gestureFrame=0,gestureFallback=0,gestureTransaction=null,deferredRefresh=null,renderCount=0,staticRenderCount=0,draftRenderCount=0,geometry=null,geometryRevision=0,staticShapeSignature='',focusJack=''
  const draftShadow=svgNode('path'),draftPath=svgNode('path');draftShadow.classList.add('tram-patch-cable-shadow');draftPath.classList.add('tram-patch-cable','is-draft')
  const setAttributeChanged=(node,key,value)=>{const text=String(value);if(node.getAttribute(key)!==text)node.setAttribute(key,text)}
  const setDataChanged=(node,key,value)=>{const text=String(value);if(node.dataset[key]!==text)node.dataset[key]=text}
  const toggleChanged=(node,key,value)=>{if(node.classList.contains(key)!==Boolean(value))node.classList.toggle(key,Boolean(value))}
  const disposers=[],status=document.createElement('div');status.className='tram-patch-status';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');patchRoot.style.position='relative';patchRoot.append(status)
  const setStatus=(text,tone='',hold=0)=>{const value=String(text||'').trim();if(status.textContent===value&&status.dataset.tone===tone&&status.hidden===!value&&hold===0)return;if(statusTimer){clearTimeout(statusTimer);statusTimer=0}if(status.textContent!==value)status.textContent=value;setDataChanged(status,'tone',tone);if(status.hidden!==!value)status.hidden=!value;if(value&&hold>0)statusTimer=setTimeout(()=>{status.hidden=true;status.textContent='';status.dataset.tone=''},hold)}
  const clearHover=()=>{for(const node of nodes.values()){delete node.dataset.patchHover;delete node.dataset.patchStage;delete node.dataset.patchCandidate}}
  const decodeCompatibility=raw=>{if(!raw||raw.schema!=='trambustissimo-patch-compatibility-v1')return null;const list=(value,{dropEmpty=false}={})=>{const rows=Array.isArray(value)?value.map(item=>String(item??'')):String(value??'').split('|');return dropEmpty?rows.filter(Boolean):rows},targetOrder=list(raw.targetOrder,{dropEmpty:true}),targetStatus=list(raw.targetStatus);if(!targetOrder.length||targetOrder.length!==targetStatus.length||targetOrder.length!==expectedCompatibilityTargets)return null;return{schema:raw.schema,slug:String(raw.slug||''),targetOrder,targetStatus,targetIndex:new Map(targetOrder.map((id,index)=>[id,index])),validMasks:{...(raw.validMasks||{})},blockedMasks:{...(raw.blockedMasks||{})},blockedReasons:{...(raw.blockedReasons||{})}}}
  if(initialCompatibility)compatibility=decodeCompatibility(initialCompatibility)
  const maskValue=value=>{try{const text=String(value??'0').replace(/^0x/i,'')||'0';return BigInt(`0x${text}`)}catch{return 0n}}
  const routeCompatibility=(a,b)=>{if(!a||!b||a.id===b.id)return{valid:false,reason:'same-port'};const cable=normalizedCable(a,b);if(!cable)return{valid:false,reason:'direction'};if(!compatibility)return{valid:false,reason:'patch compatibility unavailable'};const index=compatibility.targetIndex.get(cable.target),statusValue=index!==undefined?String(compatibility.targetStatus[index]||''):'';if(index===undefined)return{valid:false,reason:'patch compatibility unavailable'};if(statusValue!=='editable')return{valid:false,reason:`${cable.target} · ${statusValue||'not editable'}`};const bit=1n<<BigInt(index),validMask=maskValue(compatibility.validMasks?.[cable.source]);if((validMask&bit)!==0n)return{valid:true,reason:''};const blockedMask=maskValue(compatibility.blockedMasks?.[cable.source]),explicit=(blockedMask&bit)!==0n?String(compatibility.blockedReasons?.[`${cable.source}>${cable.target}`]||''):'';return{valid:false,reason:explicit||`patchState.routeLoweringUnavailable:${cable.source}->${cable.target}`}}
  const highlightCandidates=anchor=>{clearHover();let validCount=0,blockedCount=0;const anchorKey=anchor?nodeKey(anchor):'';for(const [key,node] of nodes){const spec=specs.get(key);if(!spec)continue;if(key===anchorKey){node.dataset.patchCandidate='source';continue}const candidateAnchor=gesture?.original&&gesture.pressed.direction==='input'&&spec.direction==='input'?(outputSpecs.get(gesture.original.source)||anchor):anchor;if(spec.direction===candidateAnchor?.direction){node.dataset.patchCandidate='irrelevant';continue}const result=routeCompatibility(candidateAnchor,spec);node.dataset.patchCandidate=result.valid?'valid':'blocked';if(result.valid)validCount+=1;else blockedCount+=1}if(anchor)setStatus(`${String(anchor.label||anchor.id).toUpperCase()} · ${validCount} compatible · ${blockedCount} blocked`);return{validCount,blockedCount}}
  const connectionCounts=()=>{const counts=new Map();for(const cable of state.cables){if(cable.source){const key=outputKey(cable.source);counts.set(key,(counts.get(key)||0)+1)}if(cable.target){const key=inputKey(cable.target);counts.set(key,(counts.get(key)||0)+1)}}return counts}
  const syncRouteFocus=()=>{const active=String(focusJack||''),activeSpec=specs.get(active),members=new Set(active?[active]:[]);if(activeSpec)for(const cable of state.cables){if(activeSpec.direction==='output'&&cable.source===activeSpec.id&&cable.target)members.add(inputKey(cable.target));if(activeSpec.direction==='input'&&cable.target===activeSpec.id&&cable.source)members.add(outputKey(cable.source))}for(const route of staticLayer.querySelectorAll('[data-route-source]')){const member=activeSpec&&(activeSpec.direction==='output'?route.dataset.routeSource===activeSpec.id:route.dataset.routeTarget===activeSpec.id);toggleChanged(route,'is-route-focus',Boolean(member));toggleChanged(route,'is-route-dim',Boolean(active&&!member))}for(const [key,node] of nodes){if(!active){delete node.dataset.patchFocusMember;delete node.dataset.patchFocusDim;continue}if(members.has(key)){setDataChanged(node,'patchFocusMember','1');delete node.dataset.patchFocusDim}else{delete node.dataset.patchFocusMember;setDataChanged(node,'patchFocusDim','1')}}}
  const setFocusJack=key=>{const next=String(key||''),counts=connectionCounts(),eligible=next&&(counts.get(next)||0)>1?next:'';if(eligible===focusJack)return;focusJack=eligible;syncRouteFocus()}
  const syncSocketState=()=>{const counts=connectionCounts();for(const [key,node] of nodes){const count=counts.get(key)||0,patched=count>0?'1':'0',occupancy=count>1?'multi':count===1?'single':'empty',spec=specs.get(key);if(node.dataset.patched!==patched)node.dataset.patched=patched;if(node.dataset.patchOccupancy!==occupancy)node.dataset.patchOccupancy=occupancy;setDataChanged(node,'patchCableCount',String(count));const badge=occupancyBadges.get(key),badgeText=count>1?String(count):'';if(badge&&badge.textContent!==badgeText)badge.textContent=badgeText;const socket=sockets.get(key);if(socket){const label=String(node.getAttribute('aria-label')||spec?.id||key),suffix=count>1?` · ${count} cables`:count===1?' · 1 cable':'';setAttributeChanged(socket,'aria-label',`${label} · patch ${node.dataset.direction||''}${suffix}`)}if(stage&&nodeKey(stage)===key){if(node.dataset.patchStage!=='1')node.dataset.patchStage='1'}else if(node.dataset.patchStage)delete node.dataset.patchStage}if(focusJack&&(counts.get(focusJack)||0)<2)focusJack='';syncRouteFocus()}
  const patchVisible=()=>{const rect=patchRoot.getBoundingClientRect(),style=getComputedStyle(patchRoot);return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>.5&&rect.height>.5}
  const refreshGeometry=()=>{
    if(!patchVisible()){geometry=null;return null}
    // Reveal the SVG before reading its box after PERF/mobile hide.
    if(layer.style.display==='none')layer.style.display=''
    const shellRect=shell.getBoundingClientRect(),rect=layer.getBoundingClientRect(),points=new Map(),hitRegions=[],readSockets=new Map();let projection=null
    const localWidth=Number(layer.clientWidth||patchRoot.clientWidth||rect.width),localHeight=Number(layer.clientHeight||patchRoot.clientHeight||rect.height);if(rect.width>0&&rect.height>0)projection={a:localWidth/rect.width,b:0,c:0,d:localHeight/rect.height,e:-rect.left*localWidth/rect.width,f:-rect.top*localHeight/rect.height}
    if(!projection)projection={a:1,b:0,c:0,d:1,e:-rect.left,f:-rect.top}
    const logicalWidth=Number(layer.clientWidth||shell.offsetWidth||rect.width),logicalHeight=Number(layer.clientHeight||shell.offsetHeight||rect.height),scaleX=Math.max(.01,rect.width/Math.max(1,logicalWidth)),scaleY=Math.max(.01,rect.height/Math.max(1,logicalHeight))
    for(const [key,socket] of sockets){let socketRect=readSockets.get(socket);if(!socketRect){socketRect=socket.getBoundingClientRect();readSockets.set(socket,socketRect);if(socketRect.width>.5&&socketRect.height>.5)hitRegions.push({root:nodes.get(key),x:socketRect.left+socketRect.width*.5,y:socketRect.top+socketRect.height*.5,rx:socketRect.width*.5+17*scaleX,ry:socketRect.height*.5+17*scaleY})}const point=pointInSvg(layer,socketRect.left+socketRect.width*.5,socketRect.top+socketRect.height*.5,projection);if(point)points.set(key,point)}
    geometry={rect,shellRect,logicalWidth,logicalHeight,projection,points,hitRegions,revision:++geometryRevision,layerInset:{x:rect.left-shellRect.left,y:rect.top-shellRect.top}};return geometry
  }
  const geometryFor=()=>geometry||refreshGeometry()
  const drawPath=(group,source,target,{draft=false,valid=true,point=null}={})=>{
    const layout=geometryFor();if(!layout)return;const a=source?layout.points.get(outputKey(source))||null:null,b=target?layout.points.get(inputKey(target))||null:null
    let start=a,end=b
    if(point){if(source&&a){start=a;end=point}else if(target&&b){start=point;end=b}}
    if(!start||!end)return
    const d=point?curve(start,end):curveStacked(start,end,layout.logicalHeight-8),shadow=svgNode('path'),path=svgNode('path'),decorate=node=>{node.dataset.routeSource=String(source||'');node.dataset.routeTarget=String(target||'')};shadow.setAttribute('d',d);shadow.classList.add('tram-patch-cable-shadow');decorate(shadow);path.setAttribute('d',d);path.classList.add('tram-patch-cable');decorate(path);if(draft)path.classList.add('is-draft');if(!valid)path.classList.add('is-invalid');path.style.stroke=`color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 58%,${cableColor(source||stage?.id||'',target||'draft')})`;group.append(shadow,path)
  }
  const drawExternalPath=cable=>{
    const target=String(cable?.target||''),layout=geometryFor();if(!layout)return;const end=layout.points.get(inputKey(target)),kind=externalKind(cable);if(!end||!kind)return
    const {logicalWidth,logicalHeight}=layout,fromLeft=end.x<logicalWidth*.5,start={x:fromLeft?-14:logicalWidth+14,y:Math.max(10,Math.min(logicalHeight-10,end.y+28))}
    const d=curve(start,end),shadow=svgNode('path'),path=svgNode('path'),marker=svgNode('circle'),label=svgNode('text')
    const routeSource=`external-${kind}`;shadow.setAttribute('d',d);shadow.classList.add('tram-patch-cable-shadow');shadow.dataset.routeSource=routeSource;shadow.dataset.routeTarget=target;path.setAttribute('d',d);path.classList.add('tram-patch-cable','is-external');path.dataset.routeSource=routeSource;path.dataset.routeTarget=target;path.style.stroke=cableColor(routeSource,target);marker.setAttribute('cx',String(start.x));marker.setAttribute('cy',String(start.y));marker.setAttribute('r','5');marker.classList.add('tram-patch-external-node');label.classList.add('tram-patch-external-label');label.textContent=kind==='audio'?'EXT AUDIO':kind==='event'?'EXT TRIG':`EXT ${Number(cable.externalVolts).toFixed(2)}V`
    staticLayer.append(shadow,path,marker,label);placeExternalLabel({label,patchRoot,fromLeft,logicalWidth,logicalHeight,start})
  }
  const renderStatic=()=>{if(destroyed)return;renderCount+=1;const layout=geometryFor();if(!layout){if(layer.style.display!=='none')layer.style.display='none';staticShapeSignature='';syncSocketState();return}if(layer.style.display)layer.style.display='';const signature=`${layout.revision}:${JSON.stringify(state.cables)}`;if(signature!==staticShapeSignature){staticShapeSignature=signature;staticRenderCount+=1;staticLayer.replaceChildren();for(const cable of state.cables){if(cable.source)drawPath(staticLayer,cable.source,cable.target);else drawExternalPath(cable)}}syncSocketState()}
  const renderDraft=()=>{
    if(destroyed)return;renderCount+=1;draftRenderCount+=1
    if(!gesture?.point){if(draftLayer.firstChild)draftLayer.replaceChildren();return}
    const layout=geometryFor();if(!layout){if(draftLayer.firstChild)draftLayer.replaceChildren();return}if(layer.style.display)layer.style.display=''
    const fixed=gesture.fixed,hover=gesture.hover,source=fixed.direction==='output'?fixed.id:(hover?.direction==='output'?hover.id:''),target=fixed.direction==='input'?fixed.id:(hover?.direction==='input'?hover.id:'')
    let start=layout.points.get(outputKey(source)),end=layout.points.get(inputKey(target))
    if(!hover||!gesture.valid){if(fixed.direction==='output')end=gesture.point;else start=gesture.point}
    if(!start||!end)return
    const d=curve(start,end),stroke=`color-mix(in srgb,var(--patch-accent,var(--product-accent,#c9965a)) 58%,${cableColor(source||stage?.id||'',target||'draft')})`
    setAttributeChanged(draftShadow,'d',d);setAttributeChanged(draftPath,'d',d);for(const node of [draftShadow,draftPath]){setDataChanged(node,'routeSource',source);setDataChanged(node,'routeTarget',target)}toggleChanged(draftPath,'is-invalid',!gesture.valid);if(draftPath.style.stroke!==stroke)draftPath.style.stroke=stroke
    if(!draftPath.parentNode)draftLayer.append(draftShadow,draftPath)
  }
  const renderInteraction=()=>{renderDraft();syncSocketState()}
  const render=()=>{renderStatic();renderDraft()}
  const applyState=async next=>{
    if(pending||destroyed)return false;pending=true;const before=state;state=stateFor(slug,next,stateIdentity);render();setStatus('PATCH · compiling and committing…')
    try{const result=await Promise.resolve(api.requestHostAction('patch.edit',{op:'apply',state:copy(state)}));if(result===false||result?.accepted===false||result?.patchAccepted===false)throw new Error(String(result?.error||'patch.edit rejected'));state=stateFor(slug,result?.state||state,stateIdentity);deferredRefresh=null;lastSync=performance.now();lastError='';render();setStatus(`PATCH · ${state.cables.length} cable${state.cables.length===1?'':'s'} committed`,'ok',1200);return true}catch(error){lastError=String(error?.message||error||'patch rejected');state=before;deferredRefresh=null;render();setStatus(`BLOCKED · ${lastError}`,'error',2600);try{api.onSurfaceError?.(error)}catch{}return false}finally{pending=false}
  }
  let compatibilityLoadPromise=null,compatibilityRetryTimer=0,compatibilityRetryAttempt=0,lastCompatibilityProbe=null
  const scheduleCompatibilityRetry=()=>{if(destroyed||compatibility||compatibilityRetryTimer||compatibilityRetryAttempt>=32)return;const delay=Math.min(500,50*Math.pow(2,Math.min(compatibilityRetryAttempt,4)));compatibilityRetryTimer=setTimeout(()=>{compatibilityRetryTimer=0;compatibilityRetryAttempt+=1;void loadCompatibility(true)},delay)}
  const loadCompatibility=async(force=false)=>{if(destroyed||(!force&&compatibility))return!!compatibility;if(compatibilityLoadPromise)return compatibilityLoadPromise;compatibilityLoadPromise=(async()=>{try{const result=await Promise.resolve(api.requestHostAction('patch.edit',{op:'compatibility',slug})),raw=result?.compatibility,decoded=decodeCompatibility(raw),targetOrder=Array.isArray(raw?.targetOrder)?raw.targetOrder:String(raw?.targetOrder??'').split('|').filter(Boolean),targetStatus=Array.isArray(raw?.targetStatus)?raw.targetStatus:String(raw?.targetStatus??'').split('|');lastCompatibilityProbe={accepted:result?.accepted===true,patchAccepted:result?.patchAccepted!==false,schema:String(raw?.schema||''),targetCount:targetOrder.length,statusCount:targetStatus.length,error:String(result?.error||'')};if(result?.accepted===true&&decoded){compatibility=decoded;compatibilityRetryAttempt=0;lastError='';if(compatibilityRetryTimer){clearTimeout(compatibilityRetryTimer);compatibilityRetryTimer=0}const anchor=gesture?.fixed||stage;if(anchor)highlightCandidates(anchor);renderInteraction();return true}lastError=String(result?.error||'patch compatibility unavailable')}catch(error){lastCompatibilityProbe={accepted:false,patchAccepted:false,schema:'',targetCount:0,statusCount:0,error:String(error?.message||error||'patch compatibility unavailable')};lastError=lastCompatibilityProbe.error}compatibility=null;scheduleCompatibilityRetry();return false})().finally(()=>{compatibilityLoadPromise=null});return compatibilityLoadPromise}
  let syncSerial=0
  const authoritativeSync=async(force=false)=>{
    if(destroyed||pending||gesture)return false;const now=performance.now();if(!force&&now-lastSync<180)return false;lastSync=now
    const serial=++syncSerial
    try{const result=await Promise.resolve(api.requestHostAction('patch.edit',{op:'state',slug}));if(destroyed||serial!==syncSerial)return false;if(result&&result!==true&&result.accepted!==false&&result.state){const next=stateFor(slug,result.state,stateIdentity),changed=JSON.stringify(next.cables)!==JSON.stringify(state.cables);state=next;if(changed)render();else syncSocketState();return true}if(result?.accepted===true&&result.state){const next=stateFor(slug,result.state,stateIdentity),changed=JSON.stringify(next.cables)!==JSON.stringify(state.cables);state=next;if(changed)render();else syncSocketState();return true}}catch{}return false
  }
  const chooseRootSpec=(root,anchor=null)=>{const rows=rootSpecs.get(root)||[];if(rows.length<=1)return rows[0]||null;if(anchor){const opposite=rows.filter(row=>row.direction!==anchor.direction),valid=opposite.find(row=>routeCompatibility(anchor,row).valid);return valid||opposite[0]||rows[0]||null}const input=rows.find(row=>row.direction==='input'),output=rows.find(row=>row.direction==='output');if(input&&state.cables.some(row=>row.target===input.id))return input;return output||input||rows[0]||null}
  const jackAt=(x,y,verifyDom=false)=>{
    if(verifyDom){const element=document.elementFromPoint(x,y),root=element?.closest?.('.obj-jack[data-patch-id]');if(!root||!patchRoot.contains(root))return null;return chooseRootSpec(root,gesture?.fixed||stage||null)}
    // Pointer capture does not require a fresh DOM hit test at each sample. Use
    // measured socket regions for hover; release still checks real occlusion.
    let best=null,distance=Infinity;for(const region of geometryFor()?.hitRegions||[]){const d=((x-region.x)/region.rx)**2+((y-region.y)/region.ry)**2;if(d<=1&&d<distance){best=region;distance=d}}
    return best?chooseRootSpec(best.root,gesture?.fixed||stage||null):null
  }
  const updateGesture=(clientX,clientY,verifyDom=false)=>{
    if(!gesture)return
    gesture.moved=gesture.moved||Math.hypot(clientX-gesture.startX,clientY-gesture.startY)>5;if(gesture.moved&&stage){const staged=nodes.get(nodeKey(stage));if(staged?.dataset.patchStage)delete staged.dataset.patchStage;stage=null}
    const layout=geometryFor(),point=layout?pointInSvg(layer,clientX,clientY,layout.projection):null;if(!layout||!point)return;gesture.point=point
    const priorHover=gesture.hover?nodeKey(gesture.hover):'',nextHover=jackAt(clientX,clientY,verifyDom);gesture.hover=nextHover
    // An occupied INPUT supports either replacing its source (drag to OUTPUT)
    // or moving its existing cable end (drag to a different INPUT). Do not
    // silently turn every INPUT-origin gesture into an OUTPUT-origin gesture.
    gesture.fixed=gesture.original&&gesture.pressed.direction==='input'&&nextHover?.direction==='input'&&nodeKey(nextHover)!==nodeKey(gesture.pressed)?(outputSpecs.get(gesture.original.source)||gesture.pressed):gesture.pressed
    const verdict=nextHover?routeCompatibility(gesture.fixed,nextHover):{valid:false,reason:''};gesture.valid=verdict.valid;gesture.reason=verdict.reason
    const nextHoverKey=nextHover?nodeKey(nextHover):'';if(priorHover!==nextHoverKey){const prior=nodes.get(priorHover);if(prior?.dataset.patchHover)delete prior.dataset.patchHover;if(nextHover&&nodes.has(nextHoverKey))setDataChanged(nodes.get(nextHoverKey),'patchHover',gesture.valid?'valid':'invalid')}
    if(nextHover&&!gesture.valid)setStatus(`BLOCKED · ${verdict.reason}`,'error')
    else if(priorHover!==nextHoverKey)setStatus(nextHover?`PATCH · ${String(gesture.fixed.label||gesture.fixed.id)} → ${String(nextHover.label||nextHover.id)}`:`PATCH · ${String(gesture.fixed.label||gesture.fixed.id)} · choose a compatible socket`,nextHover?'ok':'')
    renderDraft()
  }
  // Pointer ownership is separate from native patch commit. A lost up/capture
  // must never strand the host's interaction lease or keep native pan tracking.
  let panShieldTarget=null
  const blockNativePan=event=>{if(gesture&&event.cancelable)event.preventDefault()}
  const armNativePan=()=>{const doc=shell.ownerDocument;if(panShieldTarget===doc)return;panShieldTarget=doc;doc.addEventListener('touchmove',blockNativePan,{capture:true,passive:false})}
  const releasePointerOwnership=(current,outcome='commit')=>{
    if(panShieldTarget){panShieldTarget.removeEventListener('touchmove',blockNativePan,true);panShieldTarget=null}
    const transaction=current?.transaction??gestureTransaction;gestureTransaction=null
    try{if(transaction!==null)api.endTransaction?.(transaction,outcome)}finally{try{current?.socket?.releasePointerCapture?.(current.pointerId)}catch{}}
  }
  const flushGesturePreview=()=>{
    if(gestureFrame)cancelAnimationFrame(gestureFrame);if(gestureFallback)clearTimeout(gestureFallback);gestureFrame=gestureFallback=0
    if(gesture){gesture.previewAt=performance.now();updateGesture(gesture.latestX,gesture.latestY)}
  }
  const pointerMove=event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;event.preventDefault();const samples=event.getCoalescedEvents?.(),sample=samples?.length?samples[samples.length-1]:event;gesture.latestX=sample.clientX;gesture.latestY=sample.clientY
    // Cached geometry and two retained paths make immediate leading feedback cheap.
    // Do not add a mandatory compositor-frame wait, especially under WK touch tracking.
    const remaining=8-(performance.now()-gesture.previewAt)
    if(remaining<=0){flushGesturePreview();return}
    if(!gestureFrame&&!gestureFallback){gestureFrame=requestAnimationFrame(flushGesturePreview);gestureFallback=setTimeout(flushGesturePreview,Math.max(1,remaining))}
  }
  const finish=async event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return
    if(gestureFrame)cancelAnimationFrame(gestureFrame);if(gestureFallback)clearTimeout(gestureFallback);gestureFrame=gestureFallback=0;updateGesture(event.clientX,event.clientY,true)
    const current=gesture;gesture=null;window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancel,true);clearHover();releasePointerOwnership(current,'commit')
    try{
      // Arm click suppression before awaiting compatibility/compilation. Browsers
      // dispatch the synthetic click while this async pointer-up handler is still
      // suspended; arming it afterwards let one tap select and immediately clear
      // the same socket on a cold patchbay.
      if(!current.moved){suppressClickUntil=performance.now()+180;await tap(current.pressed);return}
      suppressClickUntil=performance.now()+90
      if(current.hover&&current.valid){const cable=normalizedCable(current.fixed,current.hover);if(cable){let cables=state.cables.filter(row=>row.target!==cable.target);if(current.original)cables=cables.filter(row=>!(row.source===current.original.source&&row.target===current.original.target));if(!cables.some(row=>row.source===cable.source&&row.target===cable.target))cables.push(cable);stage=null;await applyState({...state,cables});return}}
      if(current.hover&&!current.valid){stage=null;setStatus(`BLOCKED · ${current.reason||'route not available'}`,'error',2600);renderInteraction();return}
      if(current.original){stage=null;await applyState({...state,cables:state.cables.filter(row=>!(row.source===current.original.source&&row.target===current.original.target))});return}stage=null;setStatus('', '', 0);renderInteraction()
    }finally{if(deferredRefresh){state=stateFor(slug,deferredRefresh,stateIdentity);deferredRefresh=null;render()}}
  }
  const cancel=event=>{
    if(!gesture||event?.pointerId!==undefined&&event.pointerId!==gesture.pointerId)return
    if(gestureFrame)cancelAnimationFrame(gestureFrame);if(gestureFallback)clearTimeout(gestureFallback);gestureFrame=gestureFallback=0
    const current=gesture;gesture=null;stage=null;suppressClickUntil=performance.now()+180
    window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancel,true)
    try{clearHover();setStatus('', '', 0);renderInteraction()}finally{releasePointerOwnership(current,'cancel')}
    if(deferredRefresh){state=stateFor(slug,deferredRefresh,stateIdentity);deferredRefresh=null;render()}
  }
  const cancelInteraction=()=>{if(gesture)cancel(null);else if(stage){stage=null;clearHover();setStatus('');renderInteraction()}}
  const onWindowBlur=()=>cancelInteraction(),onEscape=event=>{if(event.key==='Escape'&&(gesture||stage)){event.preventDefault();cancelInteraction()}}
  window.addEventListener('blur',onWindowBlur);document.addEventListener('keydown',onEscape,true)
  const stopPresentation=subscribeSurfacePresentation(visible=>{if(!visible)cancelInteraction()},{immediate:false})
  const begin=(event,spec)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;if(gesture||pending||destroyed)return;event.preventDefault();event.stopPropagation();const layout=geometryFor(),specKey=nodeKey(spec);setFocusJack(specKey);try{sockets.get(specKey)?.focus?.({preventScroll:true})}catch{}const original=spec.direction==='input'?state.cables.find(row=>row.target===spec.id)||null:null,fixed=spec;gestureTransaction=api.beginTransaction?.({kind:'patch-cable',pointerId:event.pointerId})??null;gesture={pointerId:event.pointerId,socket:sockets.get(specKey),transaction:gestureTransaction,fixed,pressed:spec,original,startX:event.clientX,startY:event.clientY,latestX:event.clientX,latestY:event.clientY,previewAt:-Infinity,point:layout?pointInSvg(layer,event.clientX,event.clientY,layout.projection):null,hover:null,valid:false,reason:'',moved:false};armNativePan();try{gesture.socket?.setPointerCapture?.(event.pointerId)}catch{};if(compatibility)highlightCandidates(fixed);else{setStatus('PATCH · loading compiler compatibility…');void loadCompatibility(true)}window.addEventListener('pointermove',pointerMove,{capture:true,passive:false});window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',cancel,true);renderInteraction()
  }
  const tap=async spec=>{
    if(!stage){const original=spec.direction==='input'?state.cables.find(row=>row.target===spec.id)||null:null;if(original){await applyState({...state,cables:state.cables.filter(row=>row!==original)});return}stage=spec;if(compatibility)highlightCandidates(spec);else{setStatus('PATCH · loading compiler compatibility…');await loadCompatibility(true);if(stage)highlightCandidates(stage)}renderInteraction();return}const first=stage;stage=null;const verdict=routeCompatibility(first,spec);clearHover();if(first.id===spec.id){setStatus('', '', 0);renderInteraction();return}if(verdict.valid){const cable=normalizedCable(first,spec);if(cable){let cables=state.cables.filter(row=>row.target!==cable.target);if(!cables.some(row=>row.source===cable.source&&row.target===cable.target))cables.push(cable);await applyState({...state,cables});return}}setStatus(`BLOCKED · ${verdict.reason}`,'error',2400);renderInteraction()
  }
  const socketGroups=new Map();for(const [id,socket] of sockets){if(!socketGroups.has(socket))socketGroups.set(socket,[]);const spec=specs.get(id);if(spec&&!socketGroups.get(socket).includes(spec))socketGroups.get(socket).push(spec)}
  for(const [socket,group] of socketGroups){const root=[...rootSpecs.entries()].find(([,rows])=>rows.some(row=>group.includes(row)))?.[0]||socket.closest('.obj-jack'),resolve=anchor=>chooseRootSpec(root,anchor),down=event=>{const spec=resolve(stage||null);if(spec)begin(event,spec)},click=()=>{if(destroyed||pending||gesture||performance.now()<suppressClickUntil)return;const spec=resolve(stage||null);if(spec)void tap(spec)},enter=()=>{if(gesture)return;const spec=resolve(stage||null);if(spec)setFocusJack(nodeKey(spec))},leave=()=>{if(!gesture&&document.activeElement!==socket)setFocusJack('')},focus=()=>{if(gesture)return;const spec=resolve(stage||null);if(spec)setFocusJack(nodeKey(spec))},blur=()=>{if(!gesture)setFocusJack('')},lost=event=>{if(gesture?.socket===socket&&gesture.pointerId===event.pointerId)cancel(event)}, dblclick=event=>{const input=group.find(row=>row.direction==='input'),original=input?state.cables.find(row=>row.target===input.id):null;if(!input||!original)return;event.preventDefault();event.stopPropagation();stage=null;clearHover();void applyState({...state,cables:state.cables.filter(row=>!(row.source===original.source&&row.target===original.target))})},key=event=>{const spec=resolve(stage||null);if(!spec)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();void tap(spec)}else if(event.key==='Backspace'||event.key==='Delete'){const input=group.find(row=>row.direction==='input'),original=input?state.cables.find(row=>row.target===input.id):null;if(original){event.preventDefault();void applyState({...state,cables:state.cables.filter(row=>row!==original)})}}};socket.addEventListener('pointerdown',down);socket.addEventListener('click',click);socket.addEventListener('pointerenter',enter);socket.addEventListener('pointerleave',leave);socket.addEventListener('focus',focus);socket.addEventListener('blur',blur);socket.addEventListener('lostpointercapture',lost);socket.addEventListener('dblclick',dblclick);socket.addEventListener('keydown',key);disposers.push(()=>{socket.removeEventListener('pointerdown',down);socket.removeEventListener('click',click);socket.removeEventListener('pointerenter',enter);socket.removeEventListener('pointerleave',leave);socket.removeEventListener('focus',focus);socket.removeEventListener('blur',blur);socket.removeEventListener('lostpointercapture',lost);socket.removeEventListener('dblclick',dblclick);socket.removeEventListener('keydown',key)})}
  let resizeFrame=0
  const resizeNow=()=>{
    if(destroyed)return;if(resizeFrame){cancelAnimationFrame(resizeFrame);resizeFrame=0}
    geometry=null;
    // Reproject a held draft from client coordinates only during resize.
    if(gesture){if(patchVisible())updateGesture(gesture.latestX,gesture.latestY,true);else cancelInteraction()}
    render()
  },resize=()=>{if(destroyed)return;geometry=null;if(resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resizeNow()})},observer=new ResizeObserver(resizeNow);observer.observe(shell);observer.observe(patchRoot);window.addEventListener('resize',resize,{passive:true});window.addEventListener('scroll',resize,{passive:true,capture:true});globalThis.visualViewport?.addEventListener?.('resize',resize,{passive:true});const pollMs=Math.max(0,Number(authoritativePollMs)||0),interval=pollMs>0?setInterval(()=>void authoritativeSync(false),pollMs):0
  if(!compatibility)void loadCompatibility(true);void authoritativeSync(true);resize()
  return{refresh(nextState=null){if(nextState&&typeof nextState==='object'){++syncSerial;if(gesture||pending){deferredRefresh=copy(nextState);return}const next=stateFor(slug,nextState,stateIdentity),changed=JSON.stringify(next.cables)!==JSON.stringify(state.cables);state=next;lastSync=performance.now();if(changed)render();else syncSocketState();return}void authoritativeSync(true)},resize,resizeNow,state:()=>copy(state),debugState:()=>{const counts=connectionCounts();return{schema:'trambustissimo-patch-cables-v1',slug,cableCount:state.cables.length,cables:copy(state.cables),interactiveSockets:sockets.size,pending,renderCount,staticRenderCount,draftRenderCount,compatibilityLoaded:!!compatibility,compatibilityTargets:compatibility?.targetOrder?.length||0,compatibilityBootstrap:{attempt:compatibilityRetryAttempt,retryPending:!!compatibilityRetryTimer,loading:!!compatibilityLoadPromise,lastProbe:copy(lastCompatibilityProbe)},compatibilitySample:copy(compatibility?{targetOrder:compatibility.targetOrder.slice(0,4),validMasks:Object.fromEntries(Object.entries(compatibility.validMasks||{}).slice(0,1)),blockedMasks:Object.fromEntries(Object.entries(compatibility.blockedMasks||{}).slice(0,1))}:null),lastError,stage:stage?.id||'',focusJack,occupancy:Object.fromEntries([...nodes.keys()].map(id=>[id,{count:counts.get(id)||0,state:nodes.get(id)?.dataset.patchOccupancy||'empty'}])),routes:[...staticLayer.querySelectorAll('.tram-patch-cable')].map(node=>({source:String(node.dataset.routeSource||''),target:String(node.dataset.routeTarget||''),path:String(node.getAttribute('d')||''),focus:node.classList.contains('is-route-focus'),dim:node.classList.contains('is-route-dim')})),candidateCounts:{valid:[...nodes.values()].filter(node=>node.dataset.patchCandidate==='valid').length,blocked:[...nodes.values()].filter(node=>node.dataset.patchCandidate==='blocked').length,irrelevant:[...nodes.values()].filter(node=>node.dataset.patchCandidate==='irrelevant').length},gesture:gesture?{fixed:gesture.fixed.id,hover:gesture.hover?.id||'',valid:gesture.valid,reason:gesture.reason||''}:null}},destroy(){if(destroyed)return;cancelInteraction();stopPresentation();window.removeEventListener('blur',onWindowBlur);document.removeEventListener('keydown',onEscape,true);destroyed=true;if(statusTimer)clearTimeout(statusTimer);if(compatibilityRetryTimer)clearTimeout(compatibilityRetryTimer);if(resizeFrame)cancelAnimationFrame(resizeFrame);if(gestureFrame)cancelAnimationFrame(gestureFrame);if(gestureFallback)clearTimeout(gestureFallback);if(gestureTransaction!==null)api.endTransaction?.(gestureTransaction);clearInterval(interval);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('scroll',resize,true);globalThis.visualViewport?.removeEventListener?.('resize',resize);window.removeEventListener('pointermove',pointerMove,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancel,true);for(const dispose of disposers)dispose();layer.remove();status.remove()}}
}
