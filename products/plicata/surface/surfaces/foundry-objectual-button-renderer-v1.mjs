const STYLE_ID='foundry-objectual-button-runtime-v1'
const RECIPE=Object.freeze({
  family:'push',
  crown:52,
  bezel:5,
  corner:8,
  travel:4,
  guard:0,
  lampStyle:'none',
  crownMaterial:'soft-touch',
  bezelMaterial:'abs-satin',
})
const ROUND_RECIPE=Object.freeze({
  family:'push',crown:34,bezel:3,corner:'50%',travel:3,guard:0,lampStyle:'none',crownMaterial:'soft-touch',bezelMaterial:'abs-satin',
})
const TRAMBUSTISSIMO_ROUND_RECIPE=Object.freeze({
  family:'push',crown:36,bezel:4,corner:'50%',travel:2,guard:0,lampStyle:'none',crownMaterial:'abs-satin',bezelMaterial:'abs-satin',
})
const TARGET_SIZE=44
const PHYSICAL_SIZE=RECIPE.crown+RECIPE.bezel*2+RECIPE.guard*2
const SCALE=TARGET_SIZE/PHYSICAL_SIZE
const ROUND_PHYSICAL_SIZE=ROUND_RECIPE.crown+ROUND_RECIPE.bezel*2+ROUND_RECIPE.guard*2
const ROUND_SCALE=1

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
.foundry-moog-soft-key-mount,.foundry-mavis-soft-key-mount,.foundry-moog-panel-button-mount,.foundry-moog-round-button-mount,.trambustissimo-round-button-mount{position:relative;width:${TARGET_SIZE}px;height:${TARGET_SIZE}px;min-width:${TARGET_SIZE}px;min-height:${TARGET_SIZE}px}
.foundry-moog-soft-key-mount>.ogl-button,.foundry-mavis-soft-key-mount>.ogl-button,.foundry-moog-panel-button-mount>.ogl-button{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(${SCALE});transform-origin:50% 50%;touch-action:none}
.foundry-moog-round-button-mount>.ogl-button,.trambustissimo-round-button-mount>.ogl-button{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(${ROUND_SCALE});transform-origin:50% 50%;touch-action:none}
.trambustissimo-round-button-mount>.ogl-button{filter:drop-shadow(0 2px 1px rgba(52,42,25,.24))}.trambustissimo-round-button-mount .ogl-button__socket{box-shadow:inset 0 1px 1px rgba(255,255,255,.24),inset 0 -2px 3px rgba(80,63,34,.16),0 0 0 1px rgba(70,55,30,.18)}.trambustissimo-round-button-mount .ogl-button__crown{box-shadow:inset 0 2px 1px rgba(255,255,255,.22),inset 0 -3px 4px rgba(70,48,24,.20),0 1px 1px rgba(65,49,25,.18)}
`
  document.head.append(style)
}

function setProps(node,values){for(const [key,value] of Object.entries(values))node.style.setProperty(key,String(value))}
function span(className){const node=document.createElement('span');node.className=className;return node}

function createFoundrySoftButton({recipeId,mountClass,tone,recipe=RECIPE,scale=SCALE}={}){
  ensureFoundryStyleLinks()
  const mount=span(mountClass)
  mount.dataset.objectualRecipe=recipeId
  const button=document.createElement('button')
  button.type='button'
  button.className=`ogl-button ogl-button--${recipe.family} ogl-button--lamp-${recipe.lampStyle}`
  button.dataset.foundryRenderer='objectual-button-canonical'
  button.dataset.objectualFamily=recipe.family
  button.dataset.objectualRecipe=recipeId
  const socket=span(`ogl-button__socket procedural-material procedural-material--${recipe.bezelMaterial}`)
  socket.dataset.physicalLayer='socket'
  socket.dataset.material=recipe.bezelMaterial
  const crown=span(`ogl-button__crown procedural-material procedural-material--${recipe.crownMaterial}`)
  crown.dataset.physicalLayer='crown'
  crown.dataset.material=recipe.crownMaterial
  setProps(crown,{
    '--pm-tone-hi':tone?.hi||'#73816d',
    '--pm-tone-mid':tone?.mid||'#4d5c48',
    '--pm-tone-lo':tone?.lo||'#293329',
    '--pm-highlight':'rgb(255 255 255 / 8%)',
  })
  setProps(button,{
    '--ogl-button-bezel':`${recipe.bezel}px`,
    '--ogl-button-corner':typeof recipe.corner==='string'?recipe.corner:`${recipe.corner}px`,
    '--ogl-button-crown':`${recipe.crown}px`,
    '--ogl-button-travel':`${recipe.travel}px`,
    '--ogl-button-guard':`${recipe.guard}px`,
  })
  button.append(socket,crown)
  mount.append(button)

  const setPressed=pressed=>{
    const down=Boolean(pressed)
    button.classList.toggle('ogl-button--pressed',down)
    button.setAttribute('aria-pressed',String(down))
  }
  setPressed(false)
  return{node:mount,button,setPressed,recipe,recipeId,scale,targetSize:TARGET_SIZE}
}

export function createFoundryMoogSoftKey({recipeId='moog-soft-key-v1',legacyMavisClass=false}={}){
  return createFoundrySoftButton({recipeId,mountClass:`foundry-moog-soft-key-mount${legacyMavisClass?' foundry-mavis-soft-key-mount':''}`,tone:{hi:'#73816d',mid:'#4d5c48',lo:'#293329'}})
}

export function createFoundryMavisSoftKey(){
  return createFoundryMoogSoftKey({recipeId:'mavis-soft-key-v1',legacyMavisClass:true})
}

export function createFoundryMoogPanelButton({primary=false}={}){
  const tone=primary?{hi:'#8e705c',mid:'#624936',lo:'#2f2119'}:{hi:'#5c625e',mid:'#343936',lo:'#181b19'}
  return createFoundrySoftButton({recipeId:'moog-panel-button-v1',mountClass:'foundry-moog-panel-button-mount',tone})
}

export function createFoundryMoogRoundPanelButton({tone='black'}={}){
  const tones={
    red:{hi:'#ff7468',mid:'#d84a41',lo:'#7e1716'},
    gray:{hi:'#aeb1ad',mid:'#777b77',lo:'#3a3d3b'},
    black:{hi:'#4a4e4b',mid:'#252927',lo:'#0b0d0c'},
  }
  return createFoundrySoftButton({recipeId:'moog-round-panel-button-v1',mountClass:'foundry-moog-round-button-mount',tone:tones[tone]||tones.black,recipe:ROUND_RECIPE,scale:ROUND_SCALE})
}

export function createTrambustissimoRoundPanelButton({tone='charcoal'}={}){
  const tones={
    red:{hi:'#e66d60',mid:'#c84f44',lo:'#8f302b'},
    orange:{hi:'#e9a05a',mid:'#cd7935',lo:'#914a20'},
    yellow:{hi:'#e6c96c',mid:'#c3a948',lo:'#88752e'},
    teal:{hi:'#72b6ac',mid:'#4f958d',lo:'#32645f'},
    blue:{hi:'#7699bd',mid:'#557da4',lo:'#385671'},
    cream:{hi:'#f4ecd9',mid:'#ddd0b6',lo:'#aa9b80'},
    charcoal:{hi:'#5a5a55',mid:'#33332f',lo:'#171715'},
  }
  return createFoundrySoftButton({recipeId:'trambustissimo-hard-round-button-v1',mountClass:'trambustissimo-round-button-mount',tone:tones[tone]||tones.charcoal,recipe:TRAMBUSTISSIMO_ROUND_RECIPE,scale:ROUND_SCALE})
}
