const STYLE_ID='trambustissimo-hard-plastic-selector-runtime-v1'
const SOURCE_RECIPE='trambustissimo-hard-plastic-selector-v1'
const RECIPE_ID='trambustissimo-two-position-paddle-v1'
const THREE_WAY_RECIPE_ID='trambustissimo-three-position-paddle-v1'

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return
  const style=document.createElement('style');style.id=STYLE_ID
  style.textContent=`
.tram-selector-mount{position:absolute;inset:0;pointer-events:none}
.tram-selector-visual{--tram-selector-y:8px;position:absolute;left:50%;top:50%;width:28px;height:36px;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 1px rgba(69,52,27,.18))}
.tram-selector-visual>.form-layer{display:block;position:absolute;box-sizing:border-box;pointer-events:none}
.tram-selector-visual>.form-layer--selector-bezel{left:50%;top:50%;width:24px;height:34px;transform:translate(-50%,-50%);border-radius:9px;background:linear-gradient(145deg,#f3ead8,#d6c5a6);border:1px solid #aa9a7c;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -2px 3px rgba(103,80,45,.10),0 1px 2px rgba(80,61,33,.12)}
.tram-selector-visual>.form-layer--selector-well{left:50%;top:50%;width:14px;height:26px;transform:translate(-50%,-50%);border-radius:7px;background:linear-gradient(180deg,#8f836f,#6d6558);box-shadow:inset 0 2px 3px rgba(41,35,28,.36),0 0 0 1px rgba(70,59,43,.20)}
.tram-selector-visual>.form-layer--selector-paddle{z-index:3;left:50%;top:50%;width:12px;height:15px;border-radius:5px;background:linear-gradient(145deg,#343532,#151817 70%,#0b0d0c);border:1px solid #090a09;box-shadow:inset 1px 1px 1px rgba(255,255,255,.08),inset -1px -2px 2px rgba(0,0,0,.34),0 2px 3px rgba(62,46,24,.30);transform:translate(-50%,-50%) translateY(var(--tram-selector-y));transition:transform 70ms linear}
.tram-selector-visual>.form-layer--selector-marker{z-index:4;left:50%;top:50%;width:6px;height:2px;border-radius:2px;background:#f3efe6;box-shadow:0 1px 1px rgba(0,0,0,.45);transform:translate(-50%,-50%) translateY(var(--tram-selector-y));transition:transform 70ms linear}
.obj-toggle__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical'],.obj-threeway__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical']{position:relative;touch-action:manipulation}
.obj-toggle__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical']::before,.obj-threeway__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical']::before{content:"";position:absolute;z-index:8;inset:-8px;border-radius:12px;background:transparent}
.obj-toggle__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical']:hover .tram-selector-visual,.obj-threeway__face[data-foundry-renderer='trambustissimo-hard-plastic-selector-canonical']:hover .tram-selector-visual{filter:brightness(1.035) drop-shadow(0 1px 1px rgba(69,52,27,.22))}
`
  document.head.append(style)
}
function span(className){const node=document.createElement('span');node.className=className;return node}

function buildSelector(recipeId){
  ensureStyle()
  const mount=span('tram-selector-mount')
  mount.dataset.objectualRecipe=recipeId
  mount.dataset.sourceRecipe=SOURCE_RECIPE
  const visual=span('tram-selector-visual form-master form-master--selector-paddle')
  visual.dataset.foundryRenderer='trambustissimo-hard-plastic-selector-canonical'
  visual.dataset.objectualRecipe=recipeId
  visual.dataset.sourceRecipe=SOURCE_RECIPE
  visual.dataset.projection='orthographic-front'
  visual.dataset.pivot='50% 50%'
  const bezel=span('form-layer form-layer--selector-bezel');bezel.dataset.physicalLayer='bezel';bezel.dataset.material='cream-hard-plastic-satin'
  const well=span('form-layer form-layer--selector-well');well.dataset.physicalLayer='well';well.dataset.material='recessed-graphite-polymer'
  const paddle=span('form-layer form-layer--selector-paddle');paddle.dataset.physicalLayer='paddle';paddle.dataset.material='black-hard-plastic-satin'
  const marker=span('form-layer form-layer--selector-marker');marker.dataset.physicalLayer='marker';marker.dataset.material='white-inlay'
  visual.append(bezel,well,paddle,marker);mount.append(visual)
  return{mount,visual}
}

function setProjectedPosition(visual,position){
  const p=Math.max(-1,Math.min(1,Number(position)||0))
  visual.style.setProperty('--tram-selector-y',`${p*8}px`)
  visual.dataset.position=p<0?'up':p>0?'down':'center'
}

export function createFoundryMoogToggleLever(){
  const {mount,visual}=buildSelector(RECIPE_ID)
  const setPosition=up=>setProjectedPosition(visual,up?-1:1)
  setPosition(false)
  return{node:mount,visual,setPosition,recipeId:RECIPE_ID,sourceRecipe:SOURCE_RECIPE,pivot:'50% 50%',projection:'orthographic-front',layers:['bezel','well','paddle','marker']}
}

export function createFoundryMoogThreeWayToggleLever(){
  const {mount,visual}=buildSelector(THREE_WAY_RECIPE_ID)
  const setPosition=index=>setProjectedPosition(visual,Math.max(0,Math.min(2,Number(index)||0))-1)
  setPosition(1)
  return{node:mount,visual,setPosition,recipeId:THREE_WAY_RECIPE_ID,sourceRecipe:SOURCE_RECIPE,pivot:'50% 50%',projection:'orthographic-front',layers:['bezel','well','paddle','marker']}
}
