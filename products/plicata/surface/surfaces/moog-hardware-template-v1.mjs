import {ensureStyle} from './objectual-primitives-v1.mjs'

export const MOOG_HARDWARE_TEMPLATE_ID='moog-hardware-template-v1'
export const MOOG_FAMILY_GOLDEN_V1=Object.freeze({
  schema:'moog-family-golden-v1',
  canonicalEnvelope:Object.freeze({width:1140,height:522}),
  shell:Object.freeze({radius:22,innerInset:7,innerRadius:16,screwSize:7,screwInsetX:13,screwInsetY:11}),
  header:Object.freeze({height:79,marginX:13,paddingX:6,paddingY:8,toolAssemblyHeight:52}),
  controls:Object.freeze({touch:44,panicWidth:58,presetWidth:288,presetHeight:46,presetDisplayWidth:95,cycleCapWidth:24,cycleCapHeight:38,roundCrown:36,roundAssemblyWidth:46,roundAssemblyHeight:52}),
  projection:Object.freeze({auv3:Object.freeze({width:864,height:396})}),
})
export const MOOG_LAYOUT_RECIPES_V1=Object.freeze({
  voice:Object.freeze({preferredColumns:6,minColumns:3,adaptive:true}),
  'voice-dense':Object.freeze({preferredColumns:8,minColumns:4,adaptive:true}),
  modulation:Object.freeze({preferredColumns:4,minColumns:2,adaptive:true}),
  output:Object.freeze({preferredColumns:4,minColumns:2,adaptive:true}),
  sequencer:Object.freeze({preferredColumns:8,minColumns:4,adaptive:false}),
  'sequencer-adaptive':Object.freeze({preferredColumns:8,minColumns:4,adaptive:true}),
  bands:Object.freeze({preferredColumns:10,minColumns:5,adaptive:false}),
  utility:Object.freeze({preferredColumns:4,minColumns:2,adaptive:true}),
})

export const MOOG_HARDWARE_TEMPLATE_V1=Object.freeze({
  schema:'trambustissimo-hardware-template-v1',
  id:MOOG_HARDWARE_TEMPLATE_ID,
  family:'moog-inspired',
  envelope:Object.freeze({expanded:Object.freeze({width:1140,height:522}),compact:Object.freeze({width:390,height:null})}),
  footprints:Object.freeze({
    'knob-small':Object.freeze({width:44,height:52,clearance:6}),
    'knob-medium':Object.freeze({width:52,height:60,clearance:8}),
    'knob-large':Object.freeze({width:64,height:70,clearance:8}),
    'selector-2way':Object.freeze({width:58,height:58,clearance:6}),
    'selector-3way':Object.freeze({width:58,height:64,clearance:6}),
    'round-button':Object.freeze({width:48,height:48,clearance:5}),
    'percussion-key':Object.freeze({width:44,height:44,clearance:2}),
    'percussion-utility-key':Object.freeze({width:44,height:44,clearance:2}),
    'patch-jack':Object.freeze({width:34,height:34,clearance:3}),
    'preset-selector':Object.freeze({width:220,height:44,clearance:6}),
    'functional-control':Object.freeze({width:88,height:58,clearance:5}),
    'macro-knob':Object.freeze({width:52,height:74,clearance:7}),
  }),
  packing:Object.freeze({gridUnit:8,minGap:4,preferredGap:7,edgeClearance:10,policy:Object.freeze(['redistribute-columns','reduce-gap','downgrade-non-primary-size','move-secondary-to-extension','reject-layout'])}),
})

const STYLE_ID='trambustissimo-moog-hardware-template-v1-style'
ensureStyle(STYLE_ID,`
.moog-template-host{position:relative;width:100%;max-width:1140px;margin-inline:auto;overflow:visible}
.moog-template-host[data-template-mode='expanded']{contain:layout style}
.moog-template-host[data-template-mode='expanded']>.moog-template-shell{position:absolute!important;top:0!important;margin:0!important;transform-origin:0 0!important;max-width:none!important;width:1140px!important;height:522px!important;min-height:522px!important;max-height:522px!important;overflow:hidden!important}
.moog-template-host[data-template-mode='compact']>.moog-template-shell{position:relative!important;left:auto!important;top:auto!important;transform:none!important;width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;margin-inline:auto!important}
.moog-template-shell[data-hardware-template='moog-hardware-template-v1'][data-layout='expanded']{--moog-template-w:1140px;--moog-template-h:522px;--moog-grid-unit:8px;--moog-safe-gap:7px;box-sizing:border-box}
.moog-template-shell[data-hardware-template='moog-hardware-template-v1'] [data-hardware-footprint]{box-sizing:border-box}
`)

export function moogHardwareFootprint(type){return MOOG_HARDWARE_TEMPLATE_V1.footprints[String(type||'')]||MOOG_HARDWARE_TEMPLATE_V1.footprints['functional-control']}

export function resolveMoogLayoutRecipe(id,overrides={}){
  const key=String(id||'voice'),base=MOOG_LAYOUT_RECIPES_V1[key]||MOOG_LAYOUT_RECIPES_V1.voice
  return Object.freeze({id:key,preferredColumns:Math.max(1,Number(overrides.preferredColumns??base.preferredColumns)||1),minColumns:Math.max(1,Number(overrides.minColumns??base.minColumns)||1),adaptive:overrides.adaptive??base.adaptive})
}

export function planMoogAdaptiveGrid({width,height=Infinity,items=[],preferredColumns=6,minColumns=1,columnGap=6,rowGap=6}={}){
  const availableWidth=Math.max(1,Number(width)||1),availableHeight=Number.isFinite(Number(height))?Math.max(1,Number(height)):Infinity,preferred=Math.max(1,Number(preferredColumns)||1),minimum=Math.max(1,Math.min(preferred,Number(minColumns)||1)),specs=(Array.isArray(items)?items:[]).map(item=>typeof item==='string'?moogHardwareFootprint(item):moogHardwareFootprint(item?.footprint||item?.type)),safeWidth=spec=>Number(spec.width||1)+Number(spec.clearance||0)*2,safeHeight=spec=>Number(spec.height||1)+Number(spec.clearance||0)*2,maxWidth=Math.max(1,...specs.map(safeWidth)),maxHeight=Math.max(1,...specs.map(safeHeight)),candidates=[]
  for(let columns=preferred;columns>=minimum;columns-=1){const cellWidth=(availableWidth-Math.max(0,columns-1)*columnGap)/columns,rows=Math.max(1,Math.ceil(Math.max(1,specs.length)/columns)),estimatedHeight=rows*maxHeight+Math.max(0,rows-1)*rowGap,horizontalFit=cellWidth>=maxWidth,verticalFit=estimatedHeight<=availableHeight,cost=(horizontalFit?0:(maxWidth-cellWidth)*100)+(verticalFit?0:(estimatedHeight-availableHeight)*10)+(preferred-columns);candidates.push({columns,rows,cellWidth:Number(cellWidth.toFixed(2)),estimatedHeight:Number(estimatedHeight.toFixed(2)),horizontalFit,verticalFit,cost:Number(cost.toFixed(2))})}
  const qualified=candidates.find(row=>row.horizontalFit&&row.verticalFit),best=qualified||[...candidates].sort((a,b)=>a.cost-b.cost)[0]
  return{schema:'moog-adaptive-grid-plan-v1',qualified:Boolean(qualified),selected:best||null,candidates,maxFootprint:{width:maxWidth,height:maxHeight}}
}

export function configureMoogAdaptiveGrid(grid,{preferredColumns=2,ignoreFunctional=false,minColumns=1}={}){
  if(!(grid instanceof HTMLElement))return grid
  grid.dataset.adaptiveHardwareGrid='1';grid.dataset.hardwarePreferredColumns=String(Math.max(1,Number(preferredColumns)||1));grid.dataset.hardwareMinColumns=String(Math.max(1,Number(minColumns)||1));if(ignoreFunctional)grid.dataset.hardwareIgnoreFunctional='1';return grid
}

export function updateMoogAdaptiveGrid(grid,node){
  if(!(grid instanceof HTMLElement)||!(node instanceof HTMLElement)||grid.dataset.adaptiveHardwareGrid!=='1')return 0
  if(grid.dataset.hardwareIgnoreFunctional==='1'&&node.dataset.hardwareFootprint==='functional-control')return Number(grid.dataset.hardwareCellMin||0)
  const spec=moogHardwareFootprint(node.dataset.hardwareFootprint),current=Number(grid.dataset.hardwareCellMin||0),safeWidth=Number(spec.width||0)+Number(spec.clearance||0)*2,next=Math.max(current,safeWidth);grid.dataset.hardwareCellMin=String(next);grid.style.setProperty('--hardware-cell-min',`${next}px`);return next
}

export function layoutMoogAdaptiveGrid(grid){
  if(!(grid instanceof HTMLElement)||grid.dataset.adaptiveHardwareGrid!=='1')return 0
  const preferred=Math.max(1,Number(grid.dataset.hardwarePreferredColumns||1)),minimum=Math.max(1,Math.min(preferred,Number(grid.dataset.hardwareMinColumns||1))),cell=Math.max(1,Number(grid.dataset.hardwareCellMin||44)),gap=Math.max(0,Number.parseFloat(getComputedStyle(grid).columnGap)||MOOG_HARDWARE_TEMPLATE_V1.packing.minGap),width=Math.max(1,grid.clientWidth),capacity=Math.max(minimum,Math.floor((width+gap)/(cell+gap))),columns=Math.max(minimum,Math.min(preferred,capacity));grid.dataset.hardwareResolvedColumns=String(columns);grid.style.setProperty('--hardware-grid-columns',String(columns));return columns
}

export function layoutMoogAdaptiveGrids(shell){if(!(shell instanceof HTMLElement))return[];return[...shell.querySelectorAll('[data-adaptive-hardware-grid="1"]')].map(layoutMoogAdaptiveGrid)}

export function markMoogHardwareFootprint(node,type,{priority='secondary',group=''}={}){
  if(!(node instanceof HTMLElement))return node
  const key=Object.prototype.hasOwnProperty.call(MOOG_HARDWARE_TEMPLATE_V1.footprints,type)?type:'functional-control',spec=MOOG_HARDWARE_TEMPLATE_V1.footprints[key]
  node.dataset.hardwareFootprint=key;node.dataset.hardwarePriority=String(priority||'secondary');if(group)node.dataset.hardwareGroup=String(group)
  node.style.setProperty('--hardware-footprint-width',`${spec.width}px`);node.style.setProperty('--hardware-footprint-height',`${spec.height}px`);node.style.setProperty('--hardware-footprint-clearance',`${spec.clearance}px`)
  return node
}

function densityFor({controls=0,jacks=0,actions=0}={}){
  const score=Number(controls||0)+(Number(jacks||0)*.45)+(Number(actions||0)*.7)
  if(score>=70)return'dense'
  if(score>=45)return'balanced'
  return'sparse'
}

export function attachMoogHardwareTemplate({root,shell,slug='',inventory={},compactBreakpoint=0}={}){
  if(!(root instanceof HTMLElement)||!(shell instanceof HTMLElement))throw new Error('moogHardwareTemplate.invalidMount')
  const host=document.createElement('div');host.className='moog-template-host';host.dataset.hardwareTemplate=MOOG_HARDWARE_TEMPLATE_ID;host.dataset.templateSlug=String(slug||'');shell.classList.add('moog-template-shell');shell.dataset.hardwareTemplate=MOOG_HARDWARE_TEMPLATE_ID;shell.dataset.templateDensity=densityFor(inventory);shell.dataset.templateLogicalWidth=String(MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.width);shell.dataset.templateLogicalHeight=String(MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.height)
  host.append(shell);root.append(host)
  let mode='expanded',scale=1,destroyed=false,lastApplyKey=''
  const apply=viewport=>{
    if(destroyed)return
    const logical=MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded,scaleUp=root.ownerDocument?.documentElement?.dataset?.ppwAuv3DesktopScale==='1',viewportWidth=Number(viewport?.width),viewportHeight=Number(viewport?.height),hasExplicitWidth=Number.isFinite(viewportWidth)&&viewportWidth>0,hasExplicitHeight=Number.isFinite(viewportHeight)&&viewportHeight>0,availableWidth=Math.max(1,hasExplicitWidth?viewportWidth:root.clientWidth||host.parentElement?.clientWidth||logical.width),availableHeight=Math.max(1,hasExplicitHeight?viewportHeight:root.clientHeight||host.parentElement?.clientHeight||logical.height),compactAt=Math.max(0,Number(compactBreakpoint)||0),nextMode=compactAt>0&&availableWidth<=compactAt?'compact':'expanded',applyKey=`${nextMode}:${Math.round(availableWidth*2)/2}x${Math.round(availableHeight*2)/2}:${scaleUp?'up':'native'}`
    if(applyKey===lastApplyKey)return
    lastApplyKey=applyKey;mode=nextMode;host.dataset.templateMode=mode;shell.dataset.layout=mode
    if(mode==='compact'){
      scale=1;shell.dataset.templateScale='1';host.style.width='';host.style.height='auto';host.style.maxWidth='';shell.style.left='';shell.style.transform='';layoutMoogAdaptiveGrids(shell);return
    }
    // One authority owns desktop presentation scaling. Fit the complete fixed hardware
    // envelope into the actual host viewport with a uniform transform; AUv3 may scale
    // above 1:1, while gallery/standalone review remains capped at native size. The host
    // box is the rendered envelope itself, so centering never applies a second x offset.
    const widthScale=availableWidth/logical.width,heightScale=availableHeight/logical.height,fitScale=Math.min(widthScale,heightScale);scale=scaleUp?fitScale:Math.min(1,fitScale)
    const renderedWidth=logical.width*scale,renderedHeight=logical.height*scale
    host.style.width=`${renderedWidth.toFixed(3)}px`;host.style.maxWidth=`${renderedWidth.toFixed(3)}px`;host.style.height=`${renderedHeight.toFixed(3)}px`;shell.style.left='0px';shell.style.transform=`scale(${scale})`;shell.dataset.templateScale=String(scale);layoutMoogAdaptiveGrids(shell)
  }
  const observer=new ResizeObserver(()=>apply({mode}));if(root.ownerDocument?.documentElement?.dataset?.ppwAuv3DesktopScale!=='1')observer.observe(root);apply({mode:shell.dataset.layout==='compact'?'compact':'expanded'})
  return{
    resize(viewport){apply(viewport)},
    destroy(){destroyed=true;observer.disconnect()},
    debugState(){return{schema:'moog-hardware-template-debug-v1',id:MOOG_HARDWARE_TEMPLATE_ID,mode,scale,logicalWidth:MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.width,logicalHeight:MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.height,renderedWidth:Number((MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.width*scale).toFixed(2)),renderedHeight:mode==='expanded'?Number((MOOG_HARDWARE_TEMPLATE_V1.envelope.expanded.height*scale).toFixed(2)):Number(shell.getBoundingClientRect().height.toFixed(2)),density:shell.dataset.templateDensity||''}},
  }
}

export function auditMoogHardwareFootprints(shell,{tolerance=1}={}){
  if(!(shell instanceof HTMLElement))return{schema:'moog-hardware-footprint-audit-v1',overlaps:[],plannedOverlaps:[],blackBayOverlaps:[],scaleLabelBlackBayOverlaps:[],scaleTickBlackBayOverlaps:[],outsideShell:[],serigraphyOutsideShell:[],serigraphyHardwareOverlaps:[],clippedSerigraphy:[],protectedTextOverlaps:[],sectionHeadingViolations:[],count:0}
  const visible=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'},scale=Number(shell.dataset.templateScale||1)||1,nodes=[...shell.querySelectorAll('[data-hardware-footprint]')].filter(visible)
  const centered=(source,width,height)=>{const cx=source.left+source.width*.5,cy=source.top+source.height*.5;return{left:cx-width*.5,right:cx+width*.5,top:cy-height*.5,bottom:cy+height*.5,width,height}}
  const actualRect=(node,footprint)=>{
    const source=node.getBoundingClientRect()
    if(footprint.startsWith('knob-')||footprint==='macro-knob'){const face=node.querySelector('.obj-dial__face,.obj-macro__face')||node,faceRect=face.getBoundingClientRect(),rotor=node.querySelector('.tram-black-knob'),rotorStyle=rotor?getComputedStyle(rotor):null,logicalWidth=Number.parseFloat(rotorStyle?.width||''),logicalHeight=Number.parseFloat(rotorStyle?.height||''),width=(Number.isFinite(logicalWidth)?logicalWidth:Math.min(faceRect.width/scale,faceRect.height/scale))*scale,height=(Number.isFinite(logicalHeight)?logicalHeight:Math.min(faceRect.width/scale,faceRect.height/scale))*scale;return centered(faceRect,width,height)}
    const target=footprint==='selector-3way'?node.querySelector('.obj-threeway__face'):footprint==='selector-2way'?node.querySelector('.obj-toggle__face'):footprint==='round-button'?node.querySelector('.moog-action,.moog-drawer-button'):footprint==='patch-jack'?node.querySelector('.obj-jack__socket'):footprint==='preset-selector'?node.querySelector('.preset-select'):node.querySelector('.obj-functional-select__field,.obj-functional-range__field,.obj-functional-stepper__body,.obj-functional-segmented,.obj-functional-drag-choice__button')
    return(target||node).getBoundingClientRect()
  }
  const rows=nodes.map(node=>{const source=node.getBoundingClientRect(),footprint=node.dataset.hardwareFootprint||'functional-control',spec=moogHardwareFootprint(footprint),clearance=Number(spec.clearance||0),rect=actualRect(node,footprint),planned=centered(source,(Number(spec.width||0)+clearance*2)*scale,(Number(spec.height||0)+clearance*2)*scale),blackBay=footprint.startsWith('knob-')?centered(rect,rect.width+clearance*2*scale,rect.height+clearance*2*scale):rect;return{node,id:node.closest('[data-review-id]')?.dataset.reviewId||node.dataset.reviewId||'',rect,planned,blackBay,footprint}}),overlaps=[],plannedOverlaps=[],blackBayOverlaps=[],scaleLabelBlackBayOverlaps=[],scaleTickBlackBayOverlaps=[],outsideShell=[],serigraphyOutsideShell=[],serigraphyHardwareOverlaps=[],clippedSerigraphy=[],protectedTextOverlaps=[],sectionHeadingViolations=[]
  const shellRect=shell.getBoundingClientRect(),outside=(rect,bounds)=>rect.left<bounds.left-tolerance||rect.right>bounds.right+tolerance||rect.top<bounds.top-tolerance||rect.bottom>bounds.bottom+tolerance,overlap2d=(a,b)=>({x:Math.min(a.right,b.right)-Math.max(a.left,b.left),y:Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)})
  for(const row of rows)if(outside(row.rect,shellRect))outsideShell.push({id:row.id,footprint:row.footprint,left:Number((shellRect.left-row.rect.left).toFixed(2)),right:Number((row.rect.right-shellRect.right).toFixed(2)),top:Number((shellRect.top-row.rect.top).toFixed(2)),bottom:Number((row.rect.bottom-shellRect.bottom).toFixed(2))})
  const serigraphySelector='[data-serigraphy],.obj-dial__label,.obj-segmented__label,.obj-jack__label,.obj-jack__domain,.obj-macro__label,.mav-tuning-cell__label,.mav-keyboard-meta__copy>strong,.mav-keyboard-meta__copy>span,.groupTitle,.moog-section-title__text',isVisuallyHidden=node=>{const style=getComputedStyle(node),clip=String(style.clip||'');return style.position==='absolute'&&clip&&clip!=='auto'},serigraphy=[...shell.querySelectorAll(serigraphySelector)].filter(node=>visible(node)&&!isVisuallyHidden(node)).map(node=>({node,id:node.closest('[data-review-id]')?.dataset.reviewId||'',text:String(node.textContent||'').trim().slice(0,60),rect:node.getBoundingClientRect(),owner:node.closest('[data-hardware-footprint]')}))
  for(const label of serigraphy){if(outside(label.rect,shellRect))serigraphyOutsideShell.push({id:label.id,text:label.text});if(label.node.scrollWidth>label.node.clientWidth+1||label.node.scrollHeight>label.node.clientHeight+1)clippedSerigraphy.push({id:label.id,text:label.text,clientWidth:label.node.clientWidth,scrollWidth:label.node.scrollWidth,clientHeight:label.node.clientHeight,scrollHeight:label.node.scrollHeight});for(const hardware of rows){if(label.owner===hardware.node||hardware.node.contains(label.node))continue;const hit=overlap2d(label.rect,hardware.blackBay);if(hit.x>tolerance&&hit.y>tolerance)serigraphyHardwareOverlaps.push({labelId:label.id,label:label.text,hardwareId:hardware.id,hardwareFootprint:hardware.footprint,x:Number(hit.x.toFixed(2)),y:Number(hit.y.toFixed(2))})}}
  const compare=(a,b,rectKey,target)=>{const ar=a[rectKey],br=b[rectKey],x=Math.min(ar.right,br.right)-Math.max(ar.left,br.left),y=Math.min(ar.bottom,br.bottom)-Math.max(ar.top,br.top);if(x>tolerance&&y>tolerance)target.push({a:a.id,b:b.id,aFootprint:a.footprint,bFootprint:b.footprint,x:Number(x.toFixed(2)),y:Number(y.toFixed(2))})}
  for(let i=0;i<rows.length;i+=1)for(let j=i+1;j<rows.length;j+=1){const a=rows[i],b=rows[j];if(a.id&&a.id===b.id)continue;compare(a,b,'rect',overlaps);compare(a,b,'planned',plannedOverlaps);const knobPair=a.footprint.startsWith('knob-')&&b.footprint.startsWith('knob-'),largePair=a.footprint==='knob-large'||b.footprint==='knob-large';if(knobPair&&largePair)compare(a,b,'blackBay',blackBayOverlaps)}
  for(const row of rows){if(!(row.footprint.startsWith('knob-')||row.footprint==='macro-knob'))continue;for(const label of row.node.querySelectorAll('.obj-dial__scale-value,.obj-macro__scale-value')){if(!visible(label))continue;const lr=label.getBoundingClientRect(),x=Math.min(lr.right,row.rect.right)-Math.max(lr.left,row.rect.left),y=Math.min(lr.bottom,row.rect.bottom)-Math.max(lr.top,row.rect.top);if(x>tolerance&&y>tolerance)scaleLabelBlackBayOverlaps.push({control:row.id,label:String(label.textContent||'').trim(),position:label.classList.contains('obj-dial__scale-value--mid')||label.classList.contains('obj-macro__scale-value--mid')?'mid':label.classList.contains('obj-dial__scale-value--min')||label.classList.contains('obj-macro__scale-value--min')?'min':'max',x:Number(x.toFixed(2)),y:Number(y.toFixed(2))})}for(const tick of row.node.querySelectorAll('.obj-dial__tick')){if(!visible(tick))continue;const tr=tick.getBoundingClientRect(),x=Math.min(tr.right,row.rect.right)-Math.max(tr.left,row.rect.left),y=Math.min(tr.bottom,row.rect.bottom)-Math.max(tr.top,row.rect.top);if(x>tolerance&&y>tolerance)scaleTickBlackBayOverlaps.push({control:row.id,index:Number(tick.style.getPropertyValue('--tick-index')||0),profile:String(row.node.dataset.scaleProfile||''),x:Number(x.toFixed(2)),y:Number(y.toFixed(2))})}}
  const protectedNodes=[...new Set([...shell.querySelectorAll('[data-ui-text-protected],.mog-brand,.m32-brand,.mav-brand')])].filter(visible),obstacleGroups=[...new Set([...shell.querySelectorAll('[data-ui-text-obstacle-group],.mog-top-tools,.m32-top-tools,.mav-top-tools')])].filter(visible);for(const textNode of protectedNodes){const header=textNode.closest('header'),tr=textNode.getBoundingClientRect();for(const group of obstacleGroups){if(header&&group.closest('header')!==header)continue;for(const obstacle of [...group.children].filter(visible)){if(textNode.contains(obstacle)||obstacle.contains(textNode))continue;const or=obstacle.getBoundingClientRect(),hit=overlap2d(tr,or);if(hit.x>tolerance&&hit.y>tolerance)protectedTextOverlaps.push({text:String(textNode.textContent||'').trim().slice(0,80),obstacle:String(obstacle.getAttribute('aria-label')||obstacle.textContent||obstacle.className||'').trim().slice(0,80),x:Number(hit.x.toFixed(2)),y:Number(hit.y.toFixed(2))})}}}
  for(const head of [...shell.querySelectorAll('[data-section-heading="safe-v1"]')].filter(visible)){const textNode=head.querySelector('.moog-section-title__text'),rule=head.querySelector('.moog-section-title__rule');if(!textNode||!rule||!visible(textNode)||!visible(rule)){sectionHeadingViolations.push({kind:'missing-parts',label:String(head.textContent||'').trim().slice(0,60)});continue}const ts=getComputedStyle(textNode),fontSize=Number.parseFloat(ts.fontSize||'0'),textRect=textNode.getBoundingClientRect(),ruleRect=rule.getBoundingClientRect(),gap=ruleRect.left-textRect.right,vertical=ruleRect.top-(textRect.top+textRect.height*.55);if(fontSize<7.4)sectionHeadingViolations.push({kind:'font-too-small',label:String(textNode.textContent||'').trim(),fontSize:Number(fontSize.toFixed(2))});if(gap<3)sectionHeadingViolations.push({kind:'rule-too-close',label:String(textNode.textContent||'').trim(),gap:Number(gap.toFixed(2))});if(vertical<-tolerance)sectionHeadingViolations.push({kind:'rule-crosses-text-axis',label:String(textNode.textContent||'').trim(),vertical:Number(vertical.toFixed(2))});if(textNode.scrollWidth>textNode.clientWidth+1||textNode.scrollHeight>textNode.clientHeight+1)sectionHeadingViolations.push({kind:'text-clipped',label:String(textNode.textContent||'').trim(),clientWidth:textNode.clientWidth,scrollWidth:textNode.scrollWidth,clientHeight:textNode.clientHeight,scrollHeight:textNode.scrollHeight})}
  return{schema:'moog-hardware-footprint-audit-v1',count:rows.length,overlaps,plannedOverlaps,blackBayOverlaps,scaleLabelBlackBayOverlaps,scaleTickBlackBayOverlaps,outsideShell,serigraphyOutsideShell,serigraphyHardwareOverlaps,clippedSerigraphy,protectedTextOverlaps,sectionHeadingViolations}
}
