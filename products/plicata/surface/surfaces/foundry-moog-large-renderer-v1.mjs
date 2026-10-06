const STYLE_ID='foundry-objectual-knob-large-runtime-v1'
const BODY_COLOR='#171918'
const ACCENT_COLOR='#c7cbca'
const MARKER_COLOR='#f4f4ee'
const SIZE=140
const SKIRT_SIZE=160
const TOP_RATIO=.92
const SHOULDER_RATIO=.96
const INSERT_SIZE=82
const MARKER_RADIUS=58.5
const GRIP_COUNT=24
const GRIP_DEPTH=3
const GRIP_STEP=15

function ensureFoundryStyleLinks(){
  if(document.getElementById(STYLE_ID))return
  const marker=document.createElement('meta');marker.id=STYLE_ID;document.head.append(marker)
  for(const file of ['procedural-material-presets.css','objectual-grammar-lab.css']){
    if(document.querySelector(`link[data-foundry-objectual-style="${file}"]`))continue
    const link=document.createElement('link')
    link.rel='stylesheet'
    link.href=new URL(`./assets/foundry-objectual/${file}`,import.meta.url).href
    link.dataset.foundryObjectualStyle=file
    document.head.append(link)
  }
  const style=document.createElement('style')
  style.textContent=`
.foundry-moog-large-mount{position:absolute;inset:0;pointer-events:none;--pm-light-x:24%;--pm-light-y:12%}
.foundry-moog-large-mount .ogl-knob-top{left:50%;top:50%;width:${SKIRT_SIZE}px;height:${SKIRT_SIZE}px;aspect-ratio:1;transform:translate(-50%,-50%) scale(.44);transform-origin:50% 50%}
.foundry-moog-large-mount .ogl-knob-top__skirt,
.foundry-moog-large-mount .ogl-knob-top__base,
.foundry-moog-large-mount .ogl-knob-top__sidewall,
.foundry-moog-large-mount .ogl-knob-top__shoulder,
.foundry-moog-large-mount .ogl-knob-top__grip,
.foundry-moog-large-mount .ogl-knob-top__body,
.foundry-moog-large-mount .ogl-knob-top__insert,
.foundry-moog-large-mount .ogl-knob-top__marker{pointer-events:none}
.foundry-moog-large-mount .ogl-knob-top__skirt{background:radial-gradient(circle at 32% 25%,rgba(255,255,255,.055),transparent 28%),linear-gradient(145deg,#242725,#111311 58%,#050606)!important;box-shadow:0 5px 8px rgba(0,0,0,.58),inset 0 0 0 1px rgba(255,255,255,.035),inset 0 -4px 9px rgba(0,0,0,.48)!important}
.foundry-moog-large-mount .ogl-knob-top__grip{width:91%!important;height:91%!important;background:repeating-conic-gradient(from 0deg,#262925 0 2.6deg,#080a09 2.6deg 6.7deg,#191c19 6.7deg 10deg,#050606 10deg 15deg)!important;-webkit-mask:radial-gradient(circle,transparent 0 70%,#000 72% 100%)!important;mask:radial-gradient(circle,transparent 0 70%,#000 72% 100%)!important;opacity:1!important;filter:contrast(1.18)}
.foundry-moog-large-mount .ogl-knob-top__body{background:radial-gradient(circle at 28% 18%,rgba(255,255,255,.12),transparent 30%),linear-gradient(145deg,#252925,#121412 64%,#060707)!important;box-shadow:inset 2px 2px 3px rgba(255,255,255,.035),inset -4px -5px 7px rgba(0,0,0,.45)!important}
.foundry-moog-large-mount .ogl-knob-top__insert{background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.30),transparent 30%),repeating-conic-gradient(from -8deg,rgba(255,255,255,.115) 0 .45deg,rgba(44,48,47,.045) .45deg 1.05deg),conic-gradient(from 32deg,#eef0ec,#aeb3b1 72deg,#d9dcda 142deg,#8f9693 221deg,#e7e9e6 302deg,#eef0ec)!important;border:1px solid #858b88!important;filter:saturate(.45) contrast(1.12) brightness(1.05);box-shadow:inset 1px 1px 2px rgba(255,255,255,.48),inset -2px -2px 4px rgba(25,29,28,.22),0 1px 2px rgba(0,0,0,.50)!important}
.foundry-moog-large-mount .ogl-knob-top__marker{width:3px!important;height:9px!important;border-radius:1px!important;background:#f4f4ee!important;border:0!important;box-shadow:0 1px 2px rgba(0,0,0,.68)!important}
`
  document.head.append(style)
}

function toneStyle(color){return{'--pm-tone-hi':`color-mix(in srgb, ${color} 80%, white)`,'--pm-tone-mid':color,'--pm-tone-lo':`color-mix(in srgb, ${color} 64%, black)`}}
function roundClip(samples=96){const points=[];for(let i=0;i<Math.max(24,samples);i+=1){const t=i/Math.max(24,samples)*Math.PI*2;points.push(`${(50+Math.cos(t)*50).toFixed(3)}% ${(50+Math.sin(t)*50).toFixed(3)}%`)}return`polygon(${points.join(', ')})`}
const TOP_CLIP=roundClip(96)
function markerPosition(rotationDeg){const a=(Math.max(-180,Math.min(180,Number(rotationDeg)||0))-90)*Math.PI/180;return{x:Math.cos(a)*MARKER_RADIUS,y:Math.sin(a)*MARKER_RADIUS}}
function setProps(node,values){for(const [key,value] of Object.entries(values))node.style.setProperty(key,String(value))}
function span(className){const node=document.createElement('span');node.className=className;return node}

export function createFoundryMoogLargeRound(){
  ensureFoundryStyleLinks()
  const mount=span('foundry-moog-large-mount')
  mount.dataset.objectualArchetype='moog-large'
  mount.dataset.foundryRenderer='objectual-knob-top-canonical'
  const top=span('ogl-knob-top ogl-knob-top--crown-flat');top.dataset.knobPlanform='round';top.dataset.knobGrammar='orthogonal-v13'
  const skirt=span('ogl-knob-top__skirt ogl-knob-top__skirt--integral ogl-knob-top__skirt-profile--flat procedural-material procedural-material--abs-satin')
  const base=span('ogl-knob-top__base procedural-material procedural-material--abs-satin')
  const sidewall=span('ogl-knob-top__sidewall ogl-knob-top__sidewall--tapered procedural-material procedural-material--abs-satin')
  const shoulder=span('ogl-knob-top__shoulder')
  const grip=span('ogl-knob-top__grip ogl-knob-top__grip--fluted')
  const body=span('ogl-knob-top__body procedural-material procedural-material--abs-satin');body.dataset.material='abs-satin'
  const insert=span('ogl-knob-top__insert ogl-knob-top__insert--disc ogl-knob-top__insert-relief--flush ogl-knob-top__insert--spun procedural-material procedural-material--anodized-circular')
  const marker=span('ogl-knob-top__marker ogl-knob-top__marker--dot ogl-knob-top__marker-finish--inlay')
  for(const [node,layer] of [[skirt,'skirt'],[base,'base'],[sidewall,'sidewall'],[shoulder,'shoulder'],[grip,'grip'],[body,'body'],[insert,'insert'],[marker,'marker']])node.dataset.physicalLayer=layer
  for(const node of [skirt,base,sidewall,body])setProps(node,toneStyle(BODY_COLOR));setProps(insert,toneStyle(ACCENT_COLOR))
  top.append(skirt,base,sidewall,shoulder,grip,body,insert,marker);mount.append(top)
  setProps(top,{
    '--ogl-knob-size':`${SIZE}px`,'--ogl-knob-skirt-size':`${SKIRT_SIZE}px`,'--ogl-knob-top-ratio':TOP_RATIO,'--ogl-knob-grip-step':`${GRIP_STEP}deg`,
    '--ogl-knob-hub-size':'31px','--ogl-knob-insert-size':`${INSERT_SIZE}px`,'--ogl-knob-insert-width':`${INSERT_SIZE}px`,'--ogl-knob-insert-height':`${INSERT_SIZE}px`,
    '--ogl-knob-insert-ring-thickness':'24%','--ogl-knob-insert-corner':'10%','--ogl-knob-insert-bevel':'2.8px','--ogl-knob-marker-unit':'8.6px','--ogl-knob-marker-color':MARKER_COLOR,
    '--ogl-knob-grip-color':BODY_COLOR,'--ogl-knob-face-bevel':'5px','--ogl-knob-skirt-thickness':'10%','--ogl-knob-sidewall-profile-inner':'59%','--ogl-knob-sidewall-profile-mid':'73%','--ogl-knob-sidewall-profile-outer':'86%',
    '--ogl-knob-grip-depth':GRIP_DEPTH/16,'--ogl-knob-grip-band':'28%'
  })
  const setRotation=rotationDeg=>{const rotation=Math.max(-180,Math.min(180,Number(rotationDeg)||0)),p=markerPosition(rotation);setProps(top,{'--pm-object-rotation':`${rotation}deg`,'--ogl-knob-rotation':`${rotation}deg`,'--ogl-knob-grip-origin':`${rotation}deg`,'--ogl-knob-insert-rotation':`${rotation}deg`});insert.style.setProperty('--pm-object-rotation',`${rotation}deg`);for(const node of [skirt,base,grip,sidewall,shoulder,body])node.style.clipPath=TOP_CLIP;sidewall.style.transform=`translate(-50%, -50%) scale(${SHOULDER_RATIO})`;shoulder.style.transform=`translate(-50%, -50%) scale(${SHOULDER_RATIO})`;body.style.transform=`translate(-50%, -50%) scale(${TOP_RATIO})`;marker.style.left=`calc(50% + ${p.x}px)`;marker.style.top=`calc(50% + ${p.y}px)`;marker.style.setProperty('--ogl-knob-marker-angle',`${rotation}deg`)}
  setRotation(0)
  return{node:mount,setRotation}
}
