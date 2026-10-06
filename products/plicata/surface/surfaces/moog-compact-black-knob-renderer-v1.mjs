const STYLE_ID='moog-compact-black-knob-runtime-v3'

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return
  const style=document.createElement('style');style.id=STYLE_ID
  style.textContent=`
.moog-compact-black-knob-mount{--compact-size:40px;position:absolute;inset:0;pointer-events:none;isolation:isolate}.obj-dial--small .moog-compact-black-knob-mount{--compact-size:31px}.obj-dial--large .moog-compact-black-knob-mount{--compact-size:54px}
.moog-compact-black-knob-shadow{position:absolute;z-index:0;left:50%;top:50%;width:min(var(--compact-size),calc(100% - 2px));height:min(var(--compact-size),calc(100% - 2px));border-radius:50%;transform:translate(calc(-50% + 1.5px),calc(-50% + 2.5px)) scale(.98);background:rgba(20,18,14,.42);filter:blur(2.2px);opacity:.78}
.moog-compact-black-knob-bay{position:absolute;z-index:1;left:50%;top:50%;width:min(var(--compact-size),calc(100% - 2px));height:min(var(--compact-size),calc(100% - 2px));transform:translate(-50%,-50%);border-radius:50%;background:repeating-conic-gradient(from 0deg,#242724 0 4deg,#0a0c0a 4deg 7deg,#191b18 7deg 11deg,#080908 11deg 15deg);box-shadow:0 0 0 1px #030404,inset 0 0 0 max(1px,calc(var(--compact-size)*.055)) #101210,inset 0 -2px 4px rgba(0,0,0,.42)}
.moog-compact-black-knob{position:absolute;z-index:2;left:50%;top:50%;width:var(--compact-size);height:var(--compact-size);transform:translate(-50%,-50%) rotate(var(--compact-knob-angle,0deg));transform-origin:50% 50%;border-radius:50%;filter:none}
.moog-compact-black-knob__skirt{position:absolute;inset:10%;border-radius:50%;background:repeating-conic-gradient(from 0deg,#20231f 0 2.8deg,#080a09 2.8deg 5.5deg,#272a26 5.5deg 8deg,#0a0b0a 8deg 12deg);box-shadow:0 0 0 1px #050606,inset 0 -3px 4px rgba(0,0,0,.48);-webkit-mask:radial-gradient(circle,transparent 0 70%,#000 73% 100%);mask:radial-gradient(circle,transparent 0 70%,#000 73% 100%)}
.moog-compact-black-knob__body{position:absolute;inset:17%;border-radius:50%;background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.10),transparent 29%),linear-gradient(145deg,#272a27,#121412 61%,#050606);box-shadow:inset 1px 1px 2px rgba(255,255,255,.045),inset -2px -3px 4px rgba(0,0,0,.46)}
.moog-compact-black-knob__marker{position:absolute;left:50%;top:7%;width:2px;height:23%;border-radius:1px;background:#f2f0e8;transform:translateX(-50%);box-shadow:0 1px 1px rgba(0,0,0,.65)}
`
  document.head.append(style)
}

export function createMoogCompactBlackKnob(){
  ensureStyle()
  const mount=document.createElement('span');mount.className='moog-compact-black-knob-mount';mount.dataset.knobRenderer='moog-compact-black-v3';mount.dataset.knobMorphology='fixed-stator-black-ribbed-no-insert';mount.dataset.shadowAuthority='chassis-fixed';mount.dataset.bayAuthority='chassis-fixed'
  const shadow=document.createElement('span');shadow.className='moog-compact-black-knob-shadow';shadow.dataset.physicalLayer='chassis-shadow';shadow.setAttribute('aria-hidden','true')
  const bay=document.createElement('span');bay.className='moog-compact-black-knob-bay';bay.dataset.physicalLayer='fixed-bay';bay.dataset.rotationAuthority='fixed';bay.setAttribute('aria-hidden','true')
  const rotor=document.createElement('span');rotor.className='moog-compact-black-knob';rotor.dataset.rotationAuthority='rotor'
  const skirt=document.createElement('span');skirt.className='moog-compact-black-knob__skirt';skirt.dataset.physicalLayer='rotating-grip';skirt.dataset.rotationAuthority='rotor'
  const body=document.createElement('span');body.className='moog-compact-black-knob__body';body.dataset.physicalLayer='body'
  const marker=document.createElement('span');marker.className='moog-compact-black-knob__marker';marker.dataset.physicalLayer='marker'
  rotor.append(skirt,body,marker);mount.append(shadow,bay,rotor)
  const setRotation=degrees=>{const angle=Number(degrees)||0;rotor.style.setProperty('--compact-knob-angle',`${angle}deg`);mount.dataset.rotation=String(angle)}
  return{node:mount,setRotation,renderer:'moog-compact-black-v3',morphology:'fixed-stator-black-ribbed-no-insert'}
}
