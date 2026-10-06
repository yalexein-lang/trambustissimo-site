const STYLE_ID='foundry-objectual-knob-runtime-v1'
const BODY_COLOR='#202321'
const ACCENT_COLOR='#c5c9c9'
const MARKER_COLOR='#f1f1ea'
const SIZE=102
const SKIRT_SIZE=118
const TOP_RATIO=.91
const SHOULDER_RATIO=.955
const INSERT_SIZE=58
const MARKER_RADIUS=43
const GRIP_COUNT=20
const GRIP_DEPTH=3
const GRIP_STEP=18

function ensureFoundryStyleLinks(){
  if(document.getElementById(STYLE_ID))return
  const marker=document.createElement('meta');marker.id=STYLE_ID;document.head.append(marker)
  const files=['procedural-material-presets.css','objectual-grammar-lab.css']
  for(const file of files){
    if(document.querySelector(`link[data-foundry-objectual-style="${file}"]`))continue
    const link=document.createElement('link')
    link.rel='stylesheet'
    link.href=new URL(`./assets/foundry-objectual/${file}`,import.meta.url).href
    link.dataset.foundryObjectualStyle=file
    document.head.append(link)
  }
  const style=document.createElement('style')
  style.textContent=`
.foundry-moog-standard-mount{position:absolute;inset:0;pointer-events:none;--pm-light-x:27%;--pm-light-y:15%}
.foundry-moog-standard-mount .ogl-knob-top{left:50%;top:50%;width:${SKIRT_SIZE}px;height:${SKIRT_SIZE}px;aspect-ratio:1;transform:translate(-50%,-50%) scale(var(--foundry-moog-scale,.47));transform-origin:50% 50%}
.obj-dial--small .foundry-moog-standard-mount{--foundry-moog-scale:.35}
.obj-dial--large .foundry-moog-standard-mount{--foundry-moog-scale:.55}
.obj-macro .foundry-moog-standard-mount{--foundry-moog-scale:.38}
.foundry-moog-standard-mount .ogl-knob-top__skirt,
.foundry-moog-standard-mount .ogl-knob-top__base,
.foundry-moog-standard-mount .ogl-knob-top__sidewall,
.foundry-moog-standard-mount .ogl-knob-top__shoulder,
.foundry-moog-standard-mount .ogl-knob-top__grip,
.foundry-moog-standard-mount .ogl-knob-top__body,
.foundry-moog-standard-mount .ogl-knob-top__insert,
.foundry-moog-standard-mount .ogl-knob-top__marker{pointer-events:none}
.foundry-moog-standard-mount .ogl-knob-top__skirt{background:radial-gradient(circle at 31% 23%,rgba(255,255,255,.05),transparent 29%),linear-gradient(145deg,#232623,#111311 59%,#050606)!important;box-shadow:0 4px 6px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.035),inset 0 -3px 7px rgba(0,0,0,.44)!important}
.foundry-moog-standard-mount .ogl-knob-top__grip{width:90%!important;height:90%!important;background:repeating-conic-gradient(from 0deg,#252825 0 2.5deg,#070908 2.5deg 6deg,#181b18 6deg 9deg,#050606 9deg 18deg)!important;-webkit-mask:radial-gradient(circle,transparent 0 70%,#000 72% 100%)!important;mask:radial-gradient(circle,transparent 0 70%,#000 72% 100%)!important;opacity:1!important;filter:contrast(1.16)}
.foundry-moog-standard-mount .ogl-knob-top__insert{background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.28),transparent 31%),repeating-conic-gradient(from -10deg,rgba(255,255,255,.10) 0 .5deg,rgba(48,52,50,.04) .5deg 1.1deg),conic-gradient(from 34deg,#eceeeb,#a8adaa 78deg,#d9dcda 148deg,#8b928f 224deg,#e3e5e2 302deg,#eceeeb)!important;border:1px solid #848a87!important;filter:saturate(.45) contrast(1.1) brightness(1.04);box-shadow:inset 1px 1px 2px rgba(255,255,255,.42),inset -2px -2px 3px rgba(30,34,33,.2),0 1px 2px rgba(0,0,0,.46)!important}
.foundry-moog-standard-mount .ogl-knob-top__marker{width:2px!important;height:7px!important;border-radius:1px!important;background:#f2f1eb!important;border:0!important;box-shadow:0 1px 1px rgba(0,0,0,.65)!important}
`
  document.head.append(style)
}

function toneStyle(color){
  return{
    '--pm-tone-hi':`color-mix(in srgb, ${color} 82%, white)`,
    '--pm-tone-mid':color,
    '--pm-tone-lo':`color-mix(in srgb, ${color} 68%, black)`,
  }
}

function roundClip(samples=96){
  const points=[]
  for(let index=0;index<Math.max(24,samples);index+=1){
    const theta=index/Math.max(24,samples)*Math.PI*2
    points.push(`${(50+Math.cos(theta)*50).toFixed(3)}% ${(50+Math.sin(theta)*50).toFixed(3)}%`)
  }
  return`polygon(${points.join(', ')})`
}

const TOP_CLIP=roundClip(96)

function markerPosition(rotationDeg){
  const angle=(Math.max(-180,Math.min(180,Number(rotationDeg)||0))-90)*Math.PI/180
  return{x:Math.cos(angle)*MARKER_RADIUS,y:Math.sin(angle)*MARKER_RADIUS}
}

function setProps(node,values){for(const [key,value] of Object.entries(values))node.style.setProperty(key,String(value))}
function span(className){const node=document.createElement('span');node.className=className;return node}

export function createFoundryMoogStandardRound(){
  ensureFoundryStyleLinks()
  const mount=span('foundry-moog-standard-mount')
  mount.dataset.objectualArchetype='moog-standard'
  mount.dataset.foundryRenderer='objectual-knob-top-canonical'
  const top=span('ogl-knob-top ogl-knob-top--crown-flat')
  top.dataset.knobPlanform='round'
  top.dataset.knobGrammar='orthogonal-v13'
  const skirt=span('ogl-knob-top__skirt ogl-knob-top__skirt--integral ogl-knob-top__skirt-profile--flat procedural-material procedural-material--abs-satin')
  const base=span('ogl-knob-top__base procedural-material procedural-material--abs-satin')
  const sidewall=span('ogl-knob-top__sidewall ogl-knob-top__sidewall--tapered procedural-material procedural-material--abs-satin')
  const shoulder=span('ogl-knob-top__shoulder')
  const grip=span('ogl-knob-top__grip ogl-knob-top__grip--fluted')
  const body=span('ogl-knob-top__body procedural-material procedural-material--abs-satin')
  body.dataset.material='abs-satin'
  const insert=span('ogl-knob-top__insert ogl-knob-top__insert--disc ogl-knob-top__insert-relief--flush ogl-knob-top__insert--spun procedural-material procedural-material--anodized-circular')
  const marker=span('ogl-knob-top__marker ogl-knob-top__marker--dot ogl-knob-top__marker-finish--inlay')
  for(const [node,layer] of [[skirt,'skirt'],[base,'base'],[sidewall,'sidewall'],[shoulder,'shoulder'],[grip,'grip'],[body,'body'],[insert,'insert'],[marker,'marker']])node.dataset.physicalLayer=layer
  for(const node of [skirt,base,sidewall,body])setProps(node,toneStyle(BODY_COLOR))
  setProps(insert,toneStyle(ACCENT_COLOR))
  top.append(skirt,base,sidewall,shoulder,grip,body,insert,marker);mount.append(top)
  for(const node of [skirt,base,grip,sidewall,shoulder,body])node.style.clipPath=TOP_CLIP
  sidewall.style.transform=`translate(-50%, -50%) scale(${SHOULDER_RATIO})`
  shoulder.style.transform=`translate(-50%, -50%) scale(${SHOULDER_RATIO})`
  body.style.transform=`translate(-50%, -50%) scale(${TOP_RATIO})`
  marker.style.left='50%';marker.style.top='50%';marker.style.willChange='transform';marker.style.backfaceVisibility='hidden'

  setProps(top,{
    '--ogl-knob-size':`${SIZE}px`,
    '--ogl-knob-skirt-size':`${SKIRT_SIZE}px`,
    '--ogl-knob-top-ratio':TOP_RATIO,
    '--ogl-knob-grip-step':`${GRIP_STEP}deg`,
    '--ogl-knob-hub-size':'22.44px',
    '--ogl-knob-insert-size':`${INSERT_SIZE}px`,
    '--ogl-knob-insert-width':`${INSERT_SIZE}px`,
    '--ogl-knob-insert-height':`${INSERT_SIZE}px`,
    '--ogl-knob-insert-ring-thickness':'25%',
    '--ogl-knob-insert-corner':'11%',
    '--ogl-knob-insert-bevel':'2.2px',
    '--ogl-knob-marker-unit':'7.14px',
    '--ogl-knob-marker-color':MARKER_COLOR,
    '--ogl-knob-grip-color':BODY_COLOR,
    '--ogl-knob-face-bevel':'4px',
    '--ogl-knob-skirt-thickness':'10%',
    '--ogl-knob-sidewall-profile-inner':'59%',
    '--ogl-knob-sidewall-profile-mid':'73%',
    '--ogl-knob-sidewall-profile-outer':'86%',
    '--ogl-knob-grip-depth':GRIP_DEPTH/16,
    '--ogl-knob-grip-band':'28%',
  })

  const setRotation=rotationDeg=>{
    const rotation=Math.max(-180,Math.min(180,Number(rotationDeg)||0))
    const markerPoint=markerPosition(rotation)
    setProps(top,{
      '--pm-object-rotation':`${rotation}deg`,
      '--ogl-knob-rotation':`${rotation}deg`,
      '--ogl-knob-grip-origin':`${rotation}deg`,
      '--ogl-knob-insert-rotation':`${rotation}deg`,
    })
    insert.style.setProperty('--pm-object-rotation',`${rotation}deg`)
    marker.style.transform=`translate3d(calc(-50% + ${markerPoint.x}px),calc(-50% + ${markerPoint.y}px),0) rotate(${rotation}deg)`;marker.style.setProperty('--ogl-knob-marker-angle',`${rotation}deg`)
  }
  setRotation(0)
  return{node:mount,setRotation}
}
