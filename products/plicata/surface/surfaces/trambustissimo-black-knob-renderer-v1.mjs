const STYLE_ID='trambustissimo-black-knob-runtime-v2'

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return
  const style=document.createElement('style');style.id=STYLE_ID
  style.textContent=`
.tram-black-knob-mount{--tram-knob-size:40px;--tram-knob-rib:8deg;position:absolute;inset:0;pointer-events:none;isolation:isolate}
.tram-black-knob-mount[data-size='small']{--tram-knob-size:31px;--tram-knob-rib:10deg;--tram-bay-rib:12deg;--tram-grip-inset:9%;--tram-top-inset:14%}.tram-black-knob-mount[data-size='medium']{--tram-bay-rib:10deg;--tram-grip-inset:10%;--tram-top-inset:15%}.tram-black-knob-mount[data-size='large']{--tram-knob-size:58px;--tram-knob-rib:30deg;--tram-knob-black-bay-clearance:4px;--tram-grip-inset:0%;--tram-top-inset:15%}
.tram-black-knob-shadow{position:absolute;z-index:0;left:50%;top:50%;width:min(var(--tram-knob-size),calc(100% - 2px));height:min(var(--tram-knob-size),calc(100% - 2px));border-radius:50%;transform:translate(calc(-50% + 1.5px),calc(-50% + 2.5px)) scale(.98);background:rgba(23,20,15,.38);filter:blur(2.2px);opacity:.78;pointer-events:none}
.tram-black-knob-mount[data-size='large'] .tram-black-knob-shadow{width:min(calc(var(--tram-knob-size) + 2px),calc(100% - 1px));height:min(calc(var(--tram-knob-size) + 2px),calc(100% - 1px));transform:translate(calc(-50% + 2px),calc(-50% + 3px)) scale(.98);filter:blur(2.5px);opacity:.82}
.tram-black-knob-bay{display:block;position:absolute;z-index:1;left:50%;top:50%;width:min(var(--tram-knob-size),calc(100% - 2px));height:min(var(--tram-knob-size),calc(100% - 2px));transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:repeating-conic-gradient(from 0deg,#252724 0 calc(var(--tram-bay-rib,10deg)*.34),#0b0d0b calc(var(--tram-bay-rib,10deg)*.34) calc(var(--tram-bay-rib,10deg)*.56),#1b1d1a calc(var(--tram-bay-rib,10deg)*.56) var(--tram-bay-rib,10deg));box-shadow:0 0 0 1px rgba(24,22,18,.9),inset 0 0 0 max(1px,calc(var(--tram-knob-size)*.055)) rgba(5,6,5,.78),inset 0 -2px 4px rgba(0,0,0,.34),inset 0 1px 1px rgba(255,255,255,.035)}
.tram-black-knob-mount[data-size='large'] .tram-black-knob-bay{width:min(var(--tram-knob-size),calc(100% - var(--tram-knob-black-bay-clearance)));height:min(var(--tram-knob-size),calc(100% - var(--tram-knob-black-bay-clearance)));background:conic-gradient(from 15deg,#242421 0 30deg,#111210 30deg 60deg,#242421 60deg 90deg,#111210 90deg 120deg,#242421 120deg 150deg,#111210 150deg 180deg,#242421 180deg 210deg,#111210 210deg 240deg,#242421 240deg 270deg,#111210 270deg 300deg,#242421 300deg 330deg,#111210 330deg 360deg);box-shadow:0 0 0 1px rgba(27,24,19,.88),inset 0 -3px 5px rgba(0,0,0,.30),inset 0 2px 2px rgba(255,255,255,.035)}
.tram-black-knob{position:absolute;z-index:2;left:50%;top:50%;width:var(--tram-knob-size);height:var(--tram-knob-size);transform:translate(-50%,-50%) rotate(var(--tram-knob-angle,0deg));transform-origin:50% 50%;border-radius:50%;box-shadow:none}
[data-continuous-control-active='1'] .tram-black-knob{will-change:transform}
.tram-black-knob[data-size='large']{width:min(var(--tram-knob-size),calc(100% - var(--tram-knob-black-bay-clearance)));height:min(var(--tram-knob-size),calc(100% - var(--tram-knob-black-bay-clearance)))}
.tram-black-knob__base{position:absolute;inset:var(--tram-grip-inset,7%);border-radius:50%;background:repeating-conic-gradient(from 0deg,#20221f 0 calc(var(--tram-knob-rib)*.28),#090a09 calc(var(--tram-knob-rib)*.28) calc(var(--tram-knob-rib)*.48),#292b27 calc(var(--tram-knob-rib)*.48) calc(var(--tram-knob-rib)*.72),#101210 calc(var(--tram-knob-rib)*.72) var(--tram-knob-rib));box-shadow:0 0 0 1px rgba(21,20,18,.86),inset 0 -3px 4px rgba(0,0,0,.34);-webkit-mask:radial-gradient(circle,transparent 0 70%,#000 73% 100%);mask:radial-gradient(circle,transparent 0 70%,#000 73% 100%)}
.tram-black-knob__top{position:absolute;inset:var(--tram-top-inset,15%);border-radius:50%;background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.115),transparent 27%),linear-gradient(145deg,#2b2b28,#171715 62%,#0a0a09);box-shadow:inset 1px 1px 2px rgba(255,255,255,.055),inset -3px -4px 5px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.025)}
.tram-black-knob[data-size='large'] .tram-black-knob__base{display:none}.tram-black-knob[data-size='large'] .tram-black-knob__top{inset:15%;background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.10),transparent 28%),linear-gradient(145deg,#31312d,#1a1a18 64%,#0e0f0d);box-shadow:inset 1px 1px 2px rgba(255,255,255,.045),inset -3px -4px 5px rgba(0,0,0,.34),0 0 0 2px rgba(226,214,190,.18)}
.tram-black-knob__marker{position:absolute;left:50%;top:8%;width:2px;height:24%;transform:translateX(-50%);border-radius:2px;background:#f5f1e7;box-shadow:0 1px 1px rgba(0,0,0,.58)}
.tram-black-knob[data-size='large'] .tram-black-knob__marker{top:12%;width:3px;height:25%;border-radius:2px;background:#fff9ec}
.tram-black-knob__center{display:none}.obj-dial[data-knob-tone='teal'] .tram-black-knob__top{background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.18),transparent 28%),linear-gradient(145deg,#4a9d95,#2e716c 62%,#194d49)}.obj-dial[data-knob-tone='blue'] .tram-black-knob__top{background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.18),transparent 28%),linear-gradient(145deg,#6093bd,#3c6e99 62%,#244d71)}.obj-dial[data-knob-tone='yellow'] .tram-black-knob__top{background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.20),transparent 28%),linear-gradient(145deg,#d9c452,#ac972f 62%,#77671f)}.obj-dial[data-knob-tone='orange'] .tram-black-knob__top{background:radial-gradient(circle at 31% 24%,rgba(255,255,255,.18),transparent 28%),linear-gradient(145deg,#d48242,#a95e2c 62%,#733b1d)}.obj-dial[data-knob-tone] .tram-black-knob__base{filter:saturate(.78) brightness(.92)}
`
  document.head.append(style)
}

function create(size='medium'){
  ensureStyle()
  const mount=document.createElement('span');mount.className='tram-black-knob-mount';mount.dataset.size=size;mount.dataset.knobRenderer=`trambustissimo-black-${size}-v2`;mount.dataset.knobMorphology=size==='large'?'fixed-bay-low-profile-puck-white-line':'fixed-stator-compact-cylinder-white-line';mount.dataset.shadowAuthority='chassis-fixed';mount.dataset.bayAuthority='chassis-fixed'
  const shadow=document.createElement('span');shadow.className='tram-black-knob-shadow';shadow.dataset.physicalLayer='chassis-shadow';shadow.setAttribute('aria-hidden','true')
  const bay=document.createElement('span');bay.className='tram-black-knob-bay';bay.dataset.physicalLayer='fixed-bay';bay.dataset.rotationAuthority='fixed';bay.setAttribute('aria-hidden','true')
  const rotor=document.createElement('span');rotor.className='tram-black-knob';rotor.dataset.size=size;rotor.dataset.rotationAuthority='rotor'
  const base=document.createElement('span');base.className='tram-black-knob__base';base.dataset.physicalLayer=size==='large'?'rotating-grip-hidden':'rotating-grip';base.dataset.rotationAuthority='rotor'
  const top=document.createElement('span');top.className='tram-black-knob__top';top.dataset.physicalLayer='top'
  const marker=document.createElement('span');marker.className='tram-black-knob__marker';marker.dataset.physicalLayer='marker'
  const center=document.createElement('span');center.className='tram-black-knob__center';center.dataset.physicalLayer='center'
  rotor.append(base,top,marker,center);mount.append(shadow,bay,rotor)
  // Static stators/shadows do not need their own permanent compositing layer.
  // The exact rotor geometry is preserved; promote only the actively touched one.
  let lastRotation=NaN
  const setRotation=degrees=>{const angle=Number(degrees)||0;if(Object.is(angle,lastRotation))return;lastRotation=angle;rotor.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;mount.dataset.rotation=String(angle)}
  return{node:mount,setRotation,renderer:mount.dataset.knobRenderer,morphology:mount.dataset.knobMorphology}
}

export function createTrambustissimoSmallBlackKnob(){return create('small')}
export function createTrambustissimoMediumBlackKnob(){return create('medium')}
export function createTrambustissimoLargeBlackKnob(){return create('large')}
