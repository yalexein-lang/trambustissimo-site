import {el,ensureStyle} from './objectual-primitives-v1.mjs'
import {createTrambustissimoRoundPanelButton} from './foundry-objectual-button-renderer-v1.mjs'
import {createMetalBaySelector} from './metal-bay-selector-v1.mjs'
import {PlicataArpeggiatorEngine,defaultPlicataArpState,normalizePlicataArpState,makePlicataArpMutation,PLICATA_ARP_DIVISIONS,PLICATA_ARP_STYLES,PLICATA_ARP_RETRIGGER,PLICATA_ARP_VELOCITY_MODES,PLICATA_ARP_CLOCK_MODES,PLICATA_ARP_PATTERN_STEPS} from './plicata-arpeggiator-core-v1.mjs'
import {defaultPlicataArpScenesState,normalizePlicataArpScenesState,replacePlicataArpScene,activatePlicataArpScene,plicataArpSceneState,setPlicataArpKeyswitch,plicataArpKeyswitchScene,plicataArpKeyswitchLabel,PLICATA_ARP_SCENE_COUNT} from './plicata-arpeggiator-scenes-v1.mjs'
import {resolvePlicataKeyboardPitch} from './plicata-keyboard-pitch-v1.mjs'
import {installStepLanePaintGesture} from './step-lane-monitor-v1.mjs'

export const PLICATA_ARP_SURFACE_AUTHORITY='plicata-arpeggiator-surface-v1'

import {isSurfacePresented,subscribeSurfacePresentation} from './surface-visibility-v1.mjs'

const STATE_KEY='plicata.arp.v1'
const SCENES_STATE_KEY='plicata.arp.scenes.v1'
const GATE_VALUES=[.45,.6,.72,.86,1]
const SWING_VALUES=[0,.2,.35,.5,.65]
const OCTAVE_VALUES=[1,2,3,4]
const OCTAVE_PROBABILITY_VALUES=[1,.75,.5,.25,0]
const PROBABILITY_VALUES=[1,.75,.5,.25,.1,0]
const RATCHET_VALUES=[1,2,3,4]
const FIXED_VELOCITY_VALUES=[64,80,96,104,112,127]
const ACCENT_VALUES=[0,10,20,30,40]
const CLOCK_LABEL=value=>value==='INTERNAL'?'INT':value

const labelStyle=value=>String(value).replace('UP_DOWN','UP↕').replace('AS_PLAYED','PLAY').replace('CONVERGE','CONV').replace('DIVERGE','DIV')
const labelPercent=value=>`${Math.round(Number(value)*100)}%`
const signed=value=>Number(value)>0?`+${Number(value)}`:String(Number(value))
const signedPercent=value=>`${Number(value)>0?'+':''}${Math.round(Number(value)*100)}%`
const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,Number(value)))
const nearest=(values,value)=>values.reduce((best,row)=>Math.abs(Number(row)-Number(value))<Math.abs(Number(best)-Number(value))?row:best,values[0])
const PATTERN_LANES=Object.freeze([
  Object.freeze({id:'STATE',key:'enabled',minimum:0,maximum:1,quantize:1,format:value=>Number(value)>=.5?'ON':'REST'}),
  Object.freeze({id:'PITCH',key:'pitchOffset',minimum:-12,maximum:12,quantize:1,format:signed}),
  Object.freeze({id:'OCT',key:'octaveOffset',minimum:-2,maximum:2,quantize:1,format:signed}),
  Object.freeze({id:'VEL',key:'velocityOffset',minimum:-63,maximum:63,quantize:1,format:signed}),
  Object.freeze({id:'GATE',key:'gateOffset',minimum:-.75,maximum:.75,quantize:.01,format:signedPercent}),
  Object.freeze({id:'PROB',key:'probability',minimum:0,maximum:1,quantize:.01,format:labelPercent}),
  Object.freeze({id:'RATCH',key:'ratchet',minimum:1,maximum:4,quantize:1,format:value=>`R+${Math.max(0,Math.round(Number(value)||1)-1)}`}),
])
const patternLaneSpec=id=>PATTERN_LANES.find(row=>row.id===String(id))||PATTERN_LANES[1]
const neutralPatternStep=()=>({enabled:true,octaveOffset:0,velocityOffset:0,gateOffset:0,pitchOffset:0,probability:1,ratchet:1})
const ensurePlicataArp32Styles=()=>ensureStyle('plicata-arp32-monitor-v1-style',`
.mav-keyboard-control-row{gap:2.5px}.mav-keyboard-presets{grid-template-columns:repeat(7,44px);gap:2.5px;flex:0 0 323px;width:323px;min-width:323px;max-width:323px}.mav-plicata-metal-host,.mav-keyboard-preset{width:44px;min-width:44px}.mav-keyboard-presets .moog-header-choice.metal-bay-selector{width:44px;min-width:44px}.mav-sub-strip{grid-template-columns:repeat(4,44px);gap:2.5px;flex:0 0 183.5px;width:183.5px;min-width:183.5px}.mav-sub-strip .obj-dial{width:44px;min-width:44px}.mav-arp-strip{grid-template-columns:repeat(6,44px);gap:2.5px;flex:0 0 276.5px;width:276.5px;min-width:276.5px}.mav-arp-strip>.moog-header-choice.metal-bay-selector{width:44px!important;min-width:44px!important}.mavis-object[data-layout='compact'] .mav-arp-strip{flex-basis:276.5px;width:276.5px;min-width:276.5px}
.mav-arp-advanced__row--play{grid-template-columns:repeat(4,44px)}

.mav-arp-advanced[data-page='PATTERN']{right:2px;bottom:56px;width:min(750px,calc(100vw - 18px));min-height:286px;grid-template-rows:18px 44px minmax(0,1fr);background:linear-gradient(180deg,#111310,#050605 74%,#020302);border-color:#343a34;color:#f0f2ed;box-shadow:0 16px 34px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.05)}
.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__head{border-bottom-color:#242824}.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__head strong{color:#d9ded8}.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__head span{color:#879087}.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__close{border-color:#414741;background:#141714;color:#d9ded8;box-shadow:none}
.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__tabs{height:44px}.mav-arp-advanced[data-page='PATTERN'] .mav-arp-tab{border-color:#303630;background:#0d100d;color:#818881}.mav-arp-advanced[data-page='PATTERN'] .mav-arp-tab[data-active='1']{border-color:var(--product-accent,#b3633e);background:#171b17;color:#fff;box-shadow:inset 0 -2px 0 var(--product-accent,#b3633e)}
.mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__page--pattern{height:auto;min-height:214px;display:block!important}.mav-arp32-monitor{display:grid;grid-template-rows:22px 38px 118px 30px 36px;gap:4px;min-width:0;min-height:214px}
.mav-arp32-monitor__head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:0 5px;border:1px solid #262b26;border-radius:6px;background:#080a08;color:#bec5be;font:850 6px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.065em}.mav-arp32-monitor__head strong{color:#f3f5f1;font-size:7px}.mav-arp32-monitor__playhead{min-width:68px;text-align:right;color:var(--product-accent,#d6a45a)}
.mav-arp32-lanes{display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:2px}.mav-arp32-lane{min-width:44px;height:38px;padding:0 4px;border:1px solid #292f29;border-radius:6px;background:#0a0d0a;color:#8e978f;font:900 6px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.045em;cursor:pointer}.mav-arp32-lane[aria-pressed='true']{border-color:var(--product-accent,#b3633e);color:#fff;box-shadow:inset 0 -2px 0 var(--product-accent,#b3633e),0 0 7px color-mix(in srgb,var(--product-accent,#b3633e) 20%,transparent)}
.mav-arp32-steps-viewport{min-width:0;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin;border:1px solid #242924;border-radius:7px;background:#020302;padding:2px}.mav-arp32-step-grid{display:grid;grid-template-columns:repeat(16,minmax(44px,1fr));min-width:704px;height:112px;touch-action:none;user-select:none}.mav-arp32-step{position:relative;display:grid;grid-template-rows:minmax(0,1fr) 22px;min-width:44px;height:112px;padding:0;border:0;border-right:1px solid #141714;background:#070907;color:#dfe4de;cursor:ns-resize;overflow:hidden}.mav-arp32-step:nth-child(4n+1){box-shadow:inset 1px 0 color-mix(in srgb,var(--product-accent,#b3633e) 32%,transparent)}.mav-arp32-step__meter{position:relative;margin:4px 3px 2px;border:1px solid #2b302b;border-radius:5px;background:#020302;overflow:hidden}.mav-arp32-step__meter i{position:absolute;left:0;right:0;bottom:0;height:var(--arp-step-fill,50%);background:linear-gradient(180deg,color-mix(in srgb,var(--product-accent,#b3633e) 66%,#fff),var(--product-accent,#b3633e));opacity:.88;pointer-events:none}.mav-arp32-step__meter b{position:absolute;inset:0;display:grid;place-items:center;font:900 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f6f2;text-shadow:0 1px 2px #000;pointer-events:none}.mav-arp32-step__foot{display:flex;align-items:center;justify-content:center;gap:2px;background:#050705;color:#7e877f;font:850 5.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.mav-arp32-step[data-rest='1']{opacity:.38}.mav-arp32-step[data-selected='1']{box-shadow:inset 0 0 0 1px #fff;z-index:2}.mav-arp32-step[data-playhead='1']{box-shadow:inset 0 3px 0 var(--product-accent,#b3633e),0 0 7px color-mix(in srgb,var(--product-accent,#b3633e) 22%,transparent);z-index:3}.mav-arp32-step[data-outside='1']{opacity:.20}
.mav-arp32-monitor__lower{display:grid;grid-template-columns:132px minmax(180px,1fr) 78px;gap:4px;align-items:center}.mav-arp32-banks{display:grid;grid-template-columns:repeat(2,1fr);gap:2px}.mav-arp32-bank,.mav-arp32-op{height:30px;min-width:44px;padding:0 5px;border:1px solid #2d332d;border-radius:5px;background:#0a0d0a;color:#aab1aa;font:900 5.8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}.mav-arp32-bank[aria-pressed='true'],.mav-arp32-op[data-active='1']{border-color:var(--product-accent,#b3633e);color:#fff}.mav-arp32-bank[data-playing='1']{box-shadow:inset 0 3px 0 var(--product-accent,#b3633e)}.mav-arp32-length{display:grid;grid-template-columns:36px minmax(0,1fr) 34px;gap:5px;align-items:center;color:#aab1aa;font:900 5.8px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.mav-arp32-length__track{position:relative;height:26px;border:1px solid #2d332d;border-radius:5px;background:#060806;touch-action:none;cursor:ew-resize}.mav-arp32-length__track::before{content:'';position:absolute;left:5px;right:5px;top:50%;height:2px;transform:translateY(-50%);background:#202520}.mav-arp32-length__fill{position:absolute;left:5px;top:50%;height:2px;transform:translateY(-50%);background:var(--product-accent,#b3633e)}.mav-arp32-length__thumb{position:absolute;top:4px;width:6px;height:16px;transform:translateX(-3px);border-radius:3px;background:#f0f2ed;box-shadow:0 0 6px color-mix(in srgb,var(--product-accent,#b3633e) 30%,transparent);pointer-events:none}.mav-arp32-length__value{text-align:right;color:#f1f3ef}
.mav-arp32-ops{display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:2px}.mav-arp32-op{height:36px}.mav-arp32-op:disabled{opacity:.32;cursor:default}
.mav-arp-advanced[data-page='PLAY'],.mav-arp-advanced[data-page='PERF']{right:2px;bottom:56px;width:min(750px,calc(100vw - 18px));height:286px;min-height:286px;grid-template-rows:18px 44px minmax(0,1fr);background:linear-gradient(180deg,#111310,#050605 74%,#020302);border-color:#343a34;color:#f0f2ed;box-shadow:0 16px 34px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.05)}
.mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__head,.mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__head{border-bottom-color:#242824}.mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__head strong,.mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__head strong{color:#d9ded8}.mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__head span,.mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__head span{color:#879087}.mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__close,.mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__close{border-color:#414741;background:#141714;color:#d9ded8;box-shadow:none}
.mav-arp-advanced[data-page='PLAY'] .mav-arp-tab,.mav-arp-advanced[data-page='PERF'] .mav-arp-tab{border-color:#303630;background:#0d100d;color:#818881}.mav-arp-advanced[data-page='PLAY'] .mav-arp-tab[data-active='1'],.mav-arp-advanced[data-page='PERF'] .mav-arp-tab[data-active='1']{border-color:var(--product-accent,#b3633e);background:#171b17;color:#fff;box-shadow:inset 0 -2px 0 var(--product-accent,#b3633e)}
.mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__page--play,.mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__page--performance{height:auto;min-height:214px;display:block!important}
.mav-arp-play-monitor{display:grid;grid-template-rows:repeat(2,102px);gap:4px;min-height:208px}.mav-arp-play-top,.mav-arp-play-bottom{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.mav-arp-choice,.mav-arp-drag-choice,.mav-arp-gesture{box-sizing:border-box;min-width:0;border:1px solid #262b26;border-radius:6px;background:#080a08;padding:4px}.mav-arp-choice__label,.mav-arp-drag-choice__label,.mav-arp-gesture__label{display:block;height:14px;color:#899189;font:900 5.8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}.mav-arp-choice__grid{display:grid;gap:2px}.mav-arp-choice__grid button{box-sizing:border-box;min-width:44px;height:44px;padding:0 4px;border:1px solid #2d332d;border-radius:5px;background:#0a0d0a;color:#aab1aa;font:900 5.7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}.mav-arp-choice__grid button[aria-pressed='true']{border-color:var(--product-accent,#b3633e);background:#171b17;color:#fff;box-shadow:inset 0 -2px 0 var(--product-accent,#b3633e)}.mav-arp-drag-choice{height:102px;touch-action:none;user-select:none}.mav-arp-drag-choice__surface{box-sizing:border-box;width:100%;height:78px;min-height:78px;padding:0 8px;border:1px solid #2d332d;border-radius:5px;background:linear-gradient(180deg,#101410,#090c09);color:#f3f5f1;display:grid;grid-template-rows:minmax(0,1fr) 18px;place-items:center;cursor:ns-resize;touch-action:none}.mav-arp-drag-choice__value{font:950 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.mav-arp-drag-choice__hint{color:#667068;font:900 5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}.mav-arp-drag-choice__surface:focus-visible{outline:1px solid var(--product-accent,#b3633e);outline-offset:1px}.mav-arp-reset-visual{box-sizing:border-box;width:100%;height:78px;min-height:78px;padding:0 8px;border:1px solid #2d332d;border-radius:5px;background:linear-gradient(180deg,#101410,#090c09);color:#f3f5f1;font:950 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
.mav-arp-gesture{position:relative;height:102px;touch-action:none;user-select:none;cursor:ns-resize;overflow:hidden}.mav-arp-gesture__value{position:relative;z-index:2;display:grid;place-items:center;height:54px;color:#f3f5f1;font:950 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.mav-arp-gesture__meter{position:absolute;left:4px;right:4px;bottom:4px;height:18px;border:1px solid #252b25;border-radius:4px;background:#030403;overflow:hidden}.mav-arp-gesture__meter i{display:block;height:100%;width:var(--arp-gesture-fill,0%);background:var(--product-accent,#b3633e)}
.mav-arp-velocity-stack{display:grid;grid-template-rows:auto 1fr;gap:2px;min-width:0}.mav-arp-velocity-value{height:34px!important}.mav-arp-velocity-value .mav-arp-gesture__value{height:16px;font-size:8px}.mav-arp-perf-monitor{display:grid;grid-template-rows:18px 44px 78px 44px;gap:4px;min-height:214px}.mav-arp-perf-status{display:flex;align-items:center;justify-content:space-between;padding:0 5px;border:1px solid #262b26;border-radius:5px;background:#080a08;color:#8e978f;font:900 5.7px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.mav-arp-scenes{display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:2px}.mav-arp-scene{height:44px;min-width:44px;padding:2px;border:1px solid #2d332d;border-radius:5px;background:#0a0d0a;color:#9da59d;font:900 6px/1 ui-monospace,SFMono-Regular,Menlo,monospace;display:grid;place-items:center;gap:1px}.mav-arp-scene small{font-size:4.8px;color:#737b74}.mav-arp-scene[aria-pressed='true']{border-color:var(--product-accent,#b3633e);color:#fff;box-shadow:inset 0 -2px 0 var(--product-accent,#b3633e)}
.mav-arp-perf-values{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.mav-arp-perf-values .mav-arp-gesture{height:78px}.mav-arp-perf-values .mav-arp-gesture__value{height:34px;font-size:10px}.mav-arp-perf-actions{display:grid;grid-template-columns:repeat(6,minmax(44px,1fr));gap:2px}.mav-arp-perf-actions button{height:44px!important;min-height:44px!important;width:auto!important;min-width:44px!important;transform:none!important}.mav-arp-keyswitch-learn[data-active='1']{border-color:var(--product-accent,#b3633e)!important;color:#fff!important}
.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PLAY'],.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PERF']{left:auto!important;right:0!important;top:auto!important;bottom:58px!important;width:min(750px,calc(100vw - 18px))!important;height:286px!important;min-height:286px!important;grid-template-columns:1fr!important;grid-template-rows:18px 44px minmax(0,1fr)!important;gap:4px!important;padding:6px!important;border-radius:9px!important;background:linear-gradient(180deg,#111310,#050605 74%,#020302)!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__head,.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__head{height:18px!important;display:flex!important;padding:0 2px!important;text-align:left}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__tabs,.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__tabs{height:44px!important;grid-template-columns:repeat(3,1fr)!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PLAY'] .mav-arp-tab,.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PERF'] .mav-arp-tab{height:44px!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PLAY'] .mav-arp-advanced__page--play,.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PERF'] .mav-arp-advanced__page--performance{height:auto!important;min-height:214px!important;display:block!important}
.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PATTERN']{left:auto!important;right:0!important;top:auto!important;bottom:58px!important;width:min(750px,calc(100vw - 18px))!important;height:286px!important;min-height:286px!important;grid-template-columns:1fr!important;grid-template-rows:18px 44px minmax(0,1fr)!important;gap:4px!important;padding:6px!important;border-radius:9px!important;background:linear-gradient(180deg,#111310,#050605 74%,#020302)!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__head{height:18px!important;display:flex!important;padding:0 2px!important;text-align:left}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__tabs{height:44px!important;grid-template-columns:repeat(3,1fr)!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PATTERN'] .mav-arp-tab{height:44px!important}.mavis-object[data-performance-mode='1'][data-layout='expanded'] .mav-arp-strip .mav-arp-advanced[data-page='PATTERN'] .mav-arp-advanced__page--pattern{height:auto!important;min-height:214px!important;display:block!important}
@media(max-width:820px){.mav-arp-advanced[data-page='PATTERN']{width:calc(100vw - 12px);right:-6px}.mav-arp32-monitor{grid-template-rows:22px 38px 118px 30px 36px}.mav-arp32-lanes{overflow-x:auto;grid-template-columns:repeat(7,minmax(54px,1fr))}.mav-arp32-ops{overflow-x:auto;grid-template-columns:repeat(7,minmax(62px,1fr))}}
`)

function makeMetalChoice({label,values,get,set,format=value=>String(value)}){
  let currentIndex=0
  const indexFor=value=>{const found=values.findIndex(row=>Object.is(row,value)||String(row)===String(value));return found>=0?found:0}
  const localApi={
    read:()=>currentIndex,
    write:(_endpoint,index)=>{const next=Math.max(0,Math.min(values.length-1,Math.round(Number(index)||0)));currentIndex=next;set(values[next]);selector.sync(next);return true},
    beginTransaction:()=>null,
    endTransaction:()=>true,
  }
  const spec={id:`arp-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,label,minimum:0,maximum:Math.max(0,values.length-1),quantize:1,default:0,choices:values.map((value,index)=>({value:index,label:String(format(value))}))}
  const selector=createMetalBaySelector({spec,api:localApi,label});selector.root.classList.add('mav-arp-metal-choice')
  const input=selector.root.querySelector('.mbs-input'),sync=()=>{currentIndex=indexFor(get());selector.sync(currentIndex)}
  const setEnabled=enabled=>{const active=enabled!==false;selector.root.dataset.disabled=active?'0':'1';if(input)input.disabled=!active}
  sync();setEnabled(true);return{node:selector.root,sync,input,setEnabled}
}

export function makePlicataArpeggiatorSurface({api,restoreEvent='plicata-host-state-restored'}={}){
  if(!api?.trigger||!api?.requestHostAction)throw new Error('plicataArp.surfaceApiMissing')
  ensurePlicataArp32Styles()
  let state=defaultPlicataArpState(),hydrated=false,persistTimer=0,destroyed=false,currentSourceNote=null,selectedPatternStep=0,patternBank=0,activePatternLane='PITCH',patternClipboard=null,arpPlayhead=-1,advancedPage='PATTERN',mutationSerial=0,mutationActive=false,mutationOverlay=null,fillActive=false,interactionRevision=0,lastHydrateSource='none',lastHydrateHostJson=null,lastHydrateFallbackJson=null,lastHydrateScenesHostJson=null,lastHydrateScenesFallbackJson=null,midiPollTimer=0,midiCaptureRetryTimer=0,midiPollBusy=false,midiInputSequence=0,midiResetEpoch=0,midiCaptureActive=false,midiCaptureGeneration=0,midiCaptureHandledGeneration=0,midiCaptureDesired=false,midiCaptureSyncPromise=null,midiConfig=null,midiOutputConfig={mode:'pitch-bend',bendRangeSemitones:2},clockPollTimer=0,internalScheduleFrame=null,internalScheduleBusy=false,internalNativeScheduling=false,internalCommittedPhase=null,internalLastFrame=null,internalSampleRate=48000,internalPollPending=false,internalReplanRevision=0,internalAppliedReplanRevision=0,hostNextBeat=null,hostWasPlaying=false,hostLastBeat=null,midiClockRunning=false,midiClockSawTransport=false,midiClockFirstStep=true,midiClockAccumulator=0,midiClockLastPulseMs=0,midiClockLastSampleTime=null,midiClockFramesPerPulse=1000,midiClockSampleRate=48000,midiClockTempo=120,midiClockPeriodLocked=false,midiClockPulsePosition=0,midiClockNextStepPulse=null,midiClockCommittedPhase=null,midiNativeScheduling=false,nativeScheduleAvailable=false,nativeScheduleEpochApplied=0,nativeScheduleResetPromise=null,hostScheduleEpoch=1,hostScheduleBeat=null,hostScheduleBusy=false,hostNativeScheduling=false,hostScheduleGeneration=0,hostCommittedPhase=null,readyResolve=null
  let sceneBank=defaultPlicataArpScenesState(state),keyswitchLearn=false,keyswitchLearnStatus='READY',lastSceneRecall=null
  const readyPromise=new Promise(resolve=>{readyResolve=resolve}),markReady=()=>{if(readyResolve){readyResolve(true);readyResolve=null}}
  const midiChannelBend=Array.from({length:16},()=>0),externalHeld=new Map(),sustainChannels=new Set(),keyswitchHeld=new Set(),scheduledGeneratedNotes=new Map(),internalClockPlanned=[],midiClockPlanned=[],hostClockPlanned=[]
  const INTERNAL_CLOCK_MIN_LEAD_MS=16,INTERNAL_CLOCK_LOOKAHEAD_MS=360,INTERNAL_CLOCK_REFILL_MS=64,INTERNAL_CLOCK_REPLAN_MS=4,MIDI_CLOCK_MIN_LEAD_PULSES=5,MIDI_CLOCK_LOOKAHEAD_PULSES=18
  const divisionBeats=()=>PLICATA_ARP_DIVISIONS.find(row=>row.id===state.division)?.beats??.25
  const stepBeatsForCounter=counter=>{const phase=Math.max(0,Math.round(Number(counter)||0))&1,displacement=.5*state.swing;return divisionBeats()*(phase?1-displacement:1+displacement)}
  const root=el('div','mav-arp-strip'),advanced=el('div','mav-arp-advanced'),advancedHead=el('div','mav-arp-advanced__head'),advancedTitle=el('strong','','ARP DETAIL'),advancedStatus=el('span','','OFF'),advancedClose=el('button','mav-arp-advanced__close','×'),advancedTabs=el('div','mav-arp-advanced__tabs'),playPage=el('div','mav-arp-advanced__page mav-arp-advanced__page--play'),patternPage=el('div','mav-arp-advanced__page mav-arp-advanced__page--pattern'),performancePage=el('div','mav-arp-advanced__page mav-arp-advanced__page--performance'),playRow=el('div','mav-arp-advanced__row mav-arp-advanced__row--play'),motionRow=el('div','mav-arp-advanced__row mav-arp-advanced__row--motion'),performanceRow=el('div','mav-arp-advanced__row mav-arp-advanced__row--performance'),performanceReadout=el('span','mav-arp-performance-readout','PERFORMANCE'),patternMonitor=el('div','mav-arp32-monitor'),patternMonitorHead=el('div','mav-arp32-monitor__head'),patternMonitorTitle=el('strong','','ARP PATTERN'),patternBankReadout=el('span','mav-arp32-monitor__bank','01–16'),patternPlayheadReadout=el('span','mav-arp32-monitor__playhead','■ STOP'),patternLanes=el('div','mav-arp32-lanes'),patternViewport=el('div','mav-arp32-steps-viewport'),patternGrid=el('div','mav-arp32-step-grid'),patternLower=el('div','mav-arp32-monitor__lower'),patternBanks=el('div','mav-arp32-banks'),patternLength=el('div','mav-arp32-length'),patternLengthLabel=el('span','','LEN'),patternLengthTrack=el('div','mav-arp32-length__track'),patternLengthFill=el('i','mav-arp32-length__fill'),patternLengthThumb=el('i','mav-arp32-length__thumb'),patternLengthValue=el('b','mav-arp32-length__value','08'),patternOps=el('div','mav-arp32-ops')
  const bindMultiTouchButton=(button,action)=>{let touchPointer=null,suppressClick=false;button.style.touchAction='manipulation';button.addEventListener('pointerdown',event=>{if(!['touch','pen'].includes(String(event.pointerType||''))||button.disabled||touchPointer!==null)return;event.preventDefault();touchPointer=event.pointerId;suppressClick=true;try{button.setPointerCapture?.(event.pointerId)}catch{};action(event)});const finish=event=>{if(touchPointer!==event.pointerId)return;const id=touchPointer;touchPointer=null;try{if(button.hasPointerCapture?.(id))button.releasePointerCapture?.(id)}catch{}};button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',event=>{finish(event);suppressClick=false});button.addEventListener('lostpointercapture',event=>{if(touchPointer===event.pointerId){touchPointer=null;suppressClick=false}});button.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();return}if(button.disabled)return;action(event)})}
  const pageButtons=['PLAY','PATTERN','PERF'].map(page=>{const button=el('button','mav-arp-tab',page);button.type='button';button.dataset.page=page;button.setAttribute('aria-label',`Show ${page.toLowerCase()} arpeggiator controls`);bindMultiTouchButton(button,()=>{advancedPage=page;syncUi();syncAdvancedMount()});advancedTabs.append(button);return button})
  playRow.dataset.section='PLAY';motionRow.dataset.section='MOTION';performanceRow.dataset.section='PERF';advanced.hidden=true;advanced.dataset.page=advancedPage;advancedClose.type='button';advancedClose.setAttribute('aria-label','Close arpeggiator controls');advancedHead.append(advancedTitle,advancedStatus,advancedClose);playPage.append(playRow,motionRow);patternMonitorHead.append(patternMonitorTitle,patternBankReadout,patternPlayheadReadout);patternViewport.append(patternGrid);patternLengthTrack.append(patternLengthFill,patternLengthThumb);patternLength.append(patternLengthLabel,patternLengthTrack,patternLengthValue);patternLower.append(patternBanks,patternLength,el('span','mav-arp32-monitor__hint','Y→VALUE'));patternMonitor.append(patternMonitorHead,patternLanes,patternViewport,patternLower,patternOps);patternPage.append(patternMonitor);performancePage.append(performanceReadout,performanceRow);advanced.append(advancedHead,advancedTabs,playPage,patternPage,performancePage)
  const pitchForCurrentOutput=pitch=>{if(!pitch||typeof pitch!=='object')return pitch;const range=Math.max(.01,Number(midiOutputConfig.bendRangeSemitones)||2),exact=Number(pitch.exactSemitones),fallbackNote=Number(pitch.sourceNote),midiNote=Number.isFinite(Number(pitch.midiNote))?Math.max(0,Math.min(127,Math.round(Number(pitch.midiNote)))):Math.max(0,Math.min(127,Math.round(Number.isFinite(exact)?exact:(Number.isFinite(fallbackNote)?fallbackNote:60)))),residual=Number.isFinite(exact)?exact-midiNote:Number(pitch.residualSemitones)||0,bend14=Math.max(0,Math.min(16383,Math.round(8192+clamp(residual/range,-1,1)*8192))),midiOutMode=pitch.externalMidi===true?'off':midiOutputConfig.mode;return{...pitch,midiOutMode,bendRangeSemitones:range,midiNote,residualSemitones:residual,bend14}}
  const outputPayload=payload=>({...payload,pitch:pitchForCurrentOutput(payload?.pitch)})
  const bendRouting={stored:0,forwarded:0,stepApplied:0,resets:0,lastStored:null,lastForwarded:null,lastStep:null}
  const outputNoteOn=payload=>{const next=outputPayload(payload);currentSourceNote=Number(next?.sourceNote??next?.note);root.dataset.currentNote=String(next?.note??'');root.dataset.currentSourceNote=String(currentSourceNote);try{dispatchEvent(new CustomEvent('plicata-arp-output',{detail:{kind:'on',...next}}))}catch{};const external=next?.pitch?.externalMidi===true,bend=external?Number(next?.pitch?.externalBendSemitones)||0:Number(next?.xBendSemitones)||0,range=external?Math.max(.01,Number(midiOutputConfig.bendRangeSemitones)||2):Math.max(.01,Number(next?.xBendRangeSemitones)||2);try{bendRouting.stepApplied+=1;bendRouting.lastStep={sourceNote:Number(next?.sourceNote??next?.note),ownerKey:String(next?.ownerKey||''),bendSemitones:bend,rangeSemitones:range,external};api.trigger('keyboard.pitchBend',{note:Number(next?.sourceNote??next?.note),ownerKey:String(next?.ownerKey||''),bendSemitones:bend,xBendRangeSemitones:range,source:external?'external-midi-arp-step':'internal-arp-step'})}catch{};return api.trigger('keyboard.noteOn',next)}
  const outputNoteOff=payload=>{const next=outputPayload(payload);root.dataset.currentNote='';if(Number.isFinite(Number(next?.sourceNote))&&Number(next.sourceNote)===Number(currentSourceNote))currentSourceNote=null;root.dataset.currentSourceNote='';try{dispatchEvent(new CustomEvent('plicata-arp-output',{detail:{kind:'off',...next}}))}catch{};const accepted=api.trigger('keyboard.noteOff',next);try{bendRouting.resets+=1;api.trigger('keyboard.pitchBend',{note:Number(next?.sourceNote??next?.note),ownerKey:String(next?.ownerKey||''),bendSemitones:0,xBendRangeSemitones:Math.max(.01,Number(next?.xBendRangeSemitones)||2),source:'arp-step-reset'})}catch{};return accepted}
  const markPlayhead=plan=>{const index=Number(plan?.patternStepIndex);if(Number.isInteger(index)&&index>=0&&index<PLICATA_ARP_PATTERN_STEPS){arpPlayhead=index;try{syncPatternPlayhead()}catch{}}return arpPlayhead}
  const clearPlayhead=()=>{arpPlayhead=-1;try{syncPatternPlayhead()}catch{};return arpPlayhead}
  const engine=new PlicataArpeggiatorEngine({noteOn:outputNoteOn,noteOff:outputNoteOff,onStep:plan=>markPlayhead(plan),onState:next=>{state=normalizePlicataArpState(next);syncUi();schedulePersist()}})
  let handleMidiRealtime=()=>{},prepareInternalScheduledEdit=()=>{},cancelInternalScheduledFuture=()=>false,prepareMidiScheduledEdit=()=>{},prepareHostScheduledEdit=()=>{},requestInternalReplan=()=>0
  const prepareScheduledEdit=()=>state.clockMode==='INTERNAL'?prepareInternalScheduledEdit():state.clockMode==='MIDI'?prepareMidiScheduledEdit():state.clockMode==='HOST'?prepareHostScheduledEdit():false
  const rearmScheduledClock=()=>{if(state.clockMode==='INTERNAL'){internalCommittedPhase=engine.phaseSnapshot();internalScheduleFrame=null;if(state.enabled)void internalClockPoll()}else if(state.clockMode==='HOST'){hostCommittedPhase=engine.phaseSnapshot();hostScheduleBeat=null}else if(state.clockMode==='MIDI'){midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;if(midiClockRunning)alignMidiNextBoundary()}return true}
  const midiMode=()=>String(midiConfig?.mode||'AUTO').toUpperCase()
  const isMpeMode=()=>midiMode()==='MPE_LOWER'||midiMode()==='MPE_UPPER'
  const masterChannelIndex=()=>clamp(Math.round(Number(midiConfig?.masterChannel)||1)-1,0,15)
  const channelBendSemitones=channel=>{
    const ch=clamp(Math.round(Number(channel)||0),0,15),mode=midiMode(),master=masterChannelIndex(),masterRange=Math.max(0,Number(midiConfig?.masterPitchBendRangeSemitones)||2),memberRange=Math.max(1,Number(midiConfig?.memberPitchBendRangeSemitones)||48)
    if(mode==='MPE_LOWER'||mode==='MPE_UPPER')return midiChannelBend[ch]*(ch===master?masterRange:memberRange)+(ch===master?0:midiChannelBend[master]*masterRange)
    return midiChannelBend[ch]*Math.max(.01,masterRange||2)
  }
  const externalPitch=(note,channel)=>{
    const source=Math.max(0,Math.min(127,Math.round(Number(note)||60))),index=source-60,tuningCents=index>=0&&index<=12?Number(api.read?.(`control.keyboard-tune-cents-${index}`))||0:0,transpose=Number(api.read?.('control.keyboard-transpose-semitones'))||0,kbScale=Number(api.read?.('control.kb-scale'))||1,outputRange=Math.max(1,Number(midiOutputConfig.bendRangeSemitones)||2),base=resolvePlicataKeyboardPitch({sourceNote:source,transposeSemitones:transpose,tuningCents,kbScale,rootNote:60,bendRangeSemitones:outputRange}),externalBend=channelBendSemitones(channel),exact=base.exactSemitones+externalBend,midiNote=Math.max(0,Math.min(127,Math.round(exact))),residual=exact-midiNote,bend14=Math.max(0,Math.min(16383,Math.round(8192+clamp(residual/outputRange,-1,1)*8192)))
    return{...base,sourceNote:source,exactSemitones:exact,tunedNote:base.tunedNote+externalBend,midiNote,residualSemitones:residual,bend14,externalBendSemitones:externalBend,sourceChannel:channel,midiOutMode:midiOutputConfig.mode,externalMidi:true}
  }
  const externalOwnerKey=(channel,note)=>`midi:${Math.max(0,Math.min(15,Math.round(Number(channel)||0)))}:${Math.max(0,Math.min(127,Math.round(Number(note)||0)))}`
  const keyswitchOwnerKey=(channel,note)=>`${Math.max(0,Math.min(15,Math.round(Number(channel)||0)))}:${Math.max(0,Math.min(127,Math.round(Number(note)||0)))}`
  const keyswitchChannelAccepted=channel=>{const configured=sceneBank?.keyswitch?.channel;if(Number.isInteger(configured))return Number(channel)===configured;return !isMpeMode()||Number(channel)===masterChannelIndex()}
  const setKeyswitchLearn=value=>{keyswitchLearn=value===true;keyswitchLearnStatus=keyswitchLearn?'PLAY BASE NOTE':'READY';syncUi();void syncMidiCapture(state.enabled||keyswitchLearn);return keyswitchLearn}
  const handleKeyswitchMidi=(family,channel,note,velocity)=>{
    const owner=keyswitchOwnerKey(channel,note),noteOn=family===0x90&&velocity>0,noteOff=family===0x80||(family===0x90&&velocity===0)
    if(noteOff&&keyswitchHeld.has(owner)){keyswitchHeld.delete(owner);return true}
    if(!noteOn)return false
    if(keyswitchLearn){
      if(note>127-(PLICATA_ARP_SCENE_COUNT-1)){keyswitchLearnStatus='BASE MUST BE ≤ 121';syncUi();return true}
      sceneBank=setPlicataArpKeyswitch(sceneBank,{baseNote:note,channel},state);keyswitchLearn=false;keyswitchLearnStatus=`LEARNED CH ${channel+1}`;keyswitchHeld.add(owner);schedulePersist();syncUi();void syncMidiCapture(state.enabled);return true
    }
    if(!keyswitchChannelAccepted(channel))return false
    const scene=plicataArpKeyswitchScene(sceneBank,note,channel,state)
    if(scene===null)return false
    keyswitchHeld.add(owner);activateArpScene(scene,{source:'midi-keyswitch',channel,note});return true
  }
  const updateExternalPitchForChannel=channel=>{
    if(destroyed)return false
    const ch=Math.max(0,Math.min(15,Math.round(Number(channel)||0))),master=masterChannelIndex(),touchAll=isMpeMode()&&ch===master
    for(const [owner,row] of externalHeld){if(!touchAll&&row.channel!==ch)continue;const pitch=externalPitch(row.note,row.channel);row.pitch=pitch;engine.updateHeldPitch(owner,pitch);if(engine.hasSoundingOwner(owner))try{api.trigger('keyboard.pitchBend',{note:row.note,ownerKey:owner,bendSemitones:pitch.externalBendSemitones,xBendRangeSemitones:Math.max(.01,Number(midiOutputConfig.bendRangeSemitones)||2),source:'external-midi-arp'})}catch{}}
    return true
  }
  const forceReleaseExternal=()=>{
    sustainChannels.clear();keyswitchHeld.clear();externalHeld.clear();engine.removeHeldOwnersByPrefix('midi:');for(let channel=0;channel<16;channel++)midiChannelBend[channel]=0
    clearPlayhead();try{api.trigger('keyboard.pitchBend',{note:60,bendSemitones:0,source:'external-midi-arp-reset'})}catch{}
  }
  const forceReleaseExternalChannel=channel=>{
    const ch=Math.max(0,Math.min(15,Math.round(Number(channel)||0)));sustainChannels.delete(ch)
    for(const [owner,row] of [...externalHeld])if(row.channel===ch)releaseExternalOwner(owner,{force:true})
    for(const owner of [...keyswitchHeld])if(String(owner).startsWith(`${ch}:`))keyswitchHeld.delete(owner)
    midiChannelBend[ch]=0;if(!engine.heldCount)clearPlayhead();return true
  }
  const releaseExternalOwner=(owner,{force=false}={})=>{
    const row=externalHeld.get(owner);if(!row)return false
    if(force){externalHeld.delete(owner);engine.removeHeldOwner(owner);return true}
    const physicalCount=Math.max(0,Math.round(Number(row.physicalCount??1)))
    if(physicalCount<=0)return true
    row.physicalCount=physicalCount-1
    if(sustainChannels.has(row.channel)){row.deferredOffCount=Math.max(0,Math.round(Number(row.deferredOffCount)||0))+1;row.pendingOff=true;return true}
    const accepted=engine.physicalNoteOff({note:row.note,ownerKey:owner,pitch:row.pitch})
    if(row.physicalCount<=0&&Math.max(0,Number(row.deferredOffCount)||0)<=0)externalHeld.delete(owner)
    if(!engine.heldCount)clearPlayhead()
    return accepted
  }
  const releaseSustainChannel=channel=>{const ch=Math.max(0,Math.min(15,Math.round(Number(channel)||0)));sustainChannels.delete(ch);for(const [owner,row] of [...externalHeld])if(row.channel===ch){const deferred=Math.max(0,Math.round(Number(row.deferredOffCount)||0));for(let index=0;index<deferred;index++)engine.physicalNoteOff({note:row.note,ownerKey:owner,pitch:row.pitch});row.deferredOffCount=0;row.pendingOff=false;if(Math.max(0,Number(row.physicalCount)||0)<=0)externalHeld.delete(owner)}}
  const forwardExternalExpression=(status,data1,data2)=>{
    if(typeof api.midi!=='function')return
    const family=status&0xf0
    if(family===0xb0&&data1===74)api.midi('arp-expression',[0xb0,74,data2])
    else if(family===0xd0)api.midi('arp-expression',[0xd0,data1])
    else if(family===0xa0)api.midi('arp-expression',[0xd0,data2])
  }
  const handleExternalMidiBytes=(raw,{synthetic=false,sampleTime=null,beatPosition=null,tempo=null}={})=>{
    const bytes=Array.from(raw||[]).slice(0,3).map(value=>Math.max(0,Math.min(255,Math.trunc(Number(value)||0))));if(!bytes.length)return false
    const status=bytes[0],family=status&0xf0,channel=status&0x0f,data1=bytes[1]??0,data2=bytes[2]??0
    if(status>=0xf8){if(status===0xfc||status===0xff){forceReleaseExternal();try{if(state.clockMode==='INTERNAL')cancelInternalScheduledFuture();else resetNativeSchedule({release:true,resetSequence:false})}catch{}}handleMidiRealtime(status,{sampleTime,beatPosition,tempo,synthetic});return true}
    if(family===0xe0){const bend=((data2&0x7f)<<7)|(data1&0x7f);midiChannelBend[channel]=clamp((bend-8192)/(bend>=8192?8191:8192),-1,1);updateExternalPitchForChannel(channel);return true}
    if((family===0x90||family===0x80)&&handleKeyswitchMidi(family,channel,data1,data2))return true
    if(family===0x90&&data2>0){if(state.clockMode==='MIDI')prepareMidiScheduledEdit();else if(state.clockMode==='HOST')prepareHostScheduledEdit();const internalNative=state.clockMode==='INTERNAL'&&internalNativeScheduling,owner=externalOwnerKey(channel,data1),pitch=externalPitch(data1,channel),prior=externalHeld.get(owner);if(prior){externalHeld.delete(owner);engine.removeHeldOwner(owner)}const row={ownerKey:owner,channel,note:data1,velocity:data2,pitch,pendingOff:false,physicalCount:1,deferredOffCount:0,synthetic};externalHeld.set(owner,row);engine.physicalNoteOn({note:data1,velocity:data2,pitch,ownerKey:owner,externalMidi:true,sourceChannel:channel,...(internalNative?{deferInternalSchedule:true}:{})});if(internalNative)requestInternalReplan();else if(state.clockMode==='HOST'){hostCommittedPhase=engine.phaseSnapshot();hostScheduleBeat=null}else if(state.clockMode==='MIDI'){midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;if(midiClockRunning)alignMidiNextBoundary()}return true}
    if(family===0x80||(family===0x90&&data2===0)){if(state.clockMode==='MIDI')prepareMidiScheduledEdit();else if(state.clockMode==='HOST')prepareHostScheduledEdit();const accepted=releaseExternalOwner(externalOwnerKey(channel,data1));if(state.clockMode==='INTERNAL'){if(!engine.heldCount){cancelInternalScheduledFuture();clearPlayhead()}else if(state.hold!==true)requestInternalReplan()}else if(state.clockMode==='HOST'){hostCommittedPhase=engine.phaseSnapshot();hostScheduleBeat=null}else if(state.clockMode==='MIDI'){midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;if(midiClockRunning)alignMidiNextBoundary()}return accepted}
    if(family===0xb0&&data1===64){if(data2>=64)sustainChannels.add(channel);else releaseSustainChannel(channel);return true}
    if(family===0xb0&&(data1===120||data1===123)){forceReleaseExternalChannel(channel);try{if(state.clockMode==='INTERNAL'){if(!engine.heldCount)cancelInternalScheduledFuture();else requestInternalReplan()}else if(!engine.heldCount)resetNativeSchedule({release:true,resetSequence:false})}catch{};return true}
    if((family===0xb0&&data1===74)||family===0xd0||family===0xa0){forwardExternalExpression(status,data1,data2);return true}
    return false
  }
  const androidMidiPush=Boolean(globalThis.__PPW_ANDROID_NATIVE_HOST__)
  const applyMidiSnapshot=snapshot=>{if(!snapshot||typeof snapshot!=='object')return false;const resetEpoch=Math.max(0,Number(snapshot.resetEpoch??snapshot.panicEpoch)||0),resetSequence=Math.max(0,Number(snapshot.resetSequence)||0);if(resetEpoch>midiResetEpoch){forceReleaseExternal();midiResetEpoch=resetEpoch;midiInputSequence=Math.max(midiInputSequence,resetSequence)}if(Number(snapshot.overwritten)>0)forceReleaseExternal();for(const event of snapshot.events||[]){const sequence=Math.max(0,Number(event?.sequence)||0);if(sequence&&sequence<=midiInputSequence)continue;handleExternalMidiBytes(event?.bytes,{sampleTime:event?.sampleTime,beatPosition:event?.beatPosition,tempo:event?.tempo});if(sequence)midiInputSequence=Math.max(midiInputSequence,sequence)}midiInputSequence=Math.max(midiInputSequence,Number(snapshot.latestSequence)||0);return true}
  const midiCaptureWanted=()=>state.enabled||keyswitchLearn
  const scheduleMidiPoll=()=>{clearTimeout(midiPollTimer);if(!androidMidiPush&&!destroyed&&midiCaptureWanted()&&midiCaptureActive)midiPollTimer=setTimeout(()=>void pollMidiInput(),16)}
  const scheduleMidiCaptureRetry=()=>{clearTimeout(midiCaptureRetryTimer);if(!destroyed&&midiCaptureWanted()&&!midiCaptureActive)midiCaptureRetryTimer=setTimeout(()=>void syncMidiCapture(true),160)}
  const pollMidiInput=async()=>{
    if(destroyed||!midiCaptureWanted()||!midiCaptureActive||midiPollBusy)return
    midiPollBusy=true
    try{const reply=await api.requestHostAction('midi.input.snapshot',{afterSequence:midiInputSequence}),snapshot=reply?.snapshot;if(reply?.accepted!==true||!applyMidiSnapshot(snapshot)){midiCaptureActive=false;scheduleMidiCaptureRetry();return}}catch{midiCaptureActive=false;scheduleMidiCaptureRetry()}finally{midiPollBusy=false;scheduleMidiPoll()}
  }
  const ensureMidiCaptureSync=()=>{
    if(destroyed)return Promise.resolve(false)
    if(midiCaptureSyncPromise)return midiCaptureSyncPromise
    midiCaptureSyncPromise=(async()=>{
      while(!destroyed&&midiCaptureHandledGeneration!==midiCaptureGeneration){
        const generation=midiCaptureGeneration,wanted=midiCaptureDesired
        clearTimeout(midiCaptureRetryTimer);midiCaptureRetryTimer=0
        if(!wanted){
          clearTimeout(midiPollTimer);midiPollTimer=0;midiCaptureActive=false;forceReleaseExternal()
          try{await api.requestHostAction('midi.arp.capture.set',{enabled:false})}catch{}
          if(generation===midiCaptureGeneration)midiCaptureHandledGeneration=generation
          continue
        }
        const superseded=()=>generation!==midiCaptureGeneration||destroyed||!midiCaptureDesired||!midiCaptureWanted()
        const fail=()=>{if(!superseded()){midiCaptureActive=false;midiCaptureHandledGeneration=generation;scheduleMidiCaptureRetry()}return false}
        try{
          const configReply=await api.requestHostAction('midi.config.get');if(superseded())continue;if(configReply?.accepted!==false)midiConfig=configReply?.config||midiConfig
          const baseline=await api.requestHostAction('midi.input.snapshot',{afterSequence:0});if(superseded())continue;if(baseline?.accepted!==true||!baseline?.snapshot){fail();continue}
          midiInputSequence=Math.max(0,Number(baseline.snapshot.latestSequence)||0);midiResetEpoch=Math.max(0,Number(baseline.snapshot.resetEpoch??baseline.snapshot.panicEpoch)||0)
          const capture=await api.requestHostAction('midi.arp.capture.set',{enabled:true});if(superseded())continue;if(capture?.accepted!==true){fail();continue}
          midiCaptureActive=true;midiCaptureHandledGeneration=generation;scheduleMidiPoll()
        }catch{fail()}
      }
      return midiCaptureActive
    })().finally(()=>{midiCaptureSyncPromise=null;if(!destroyed&&midiCaptureHandledGeneration!==midiCaptureGeneration)queueMicrotask(()=>void ensureMidiCaptureSync())})
    return midiCaptureSyncPromise
  }
  const syncMidiCapture=enabled=>{
    midiCaptureDesired=enabled===true
    midiCaptureGeneration+=1
    if(!midiCaptureDesired){clearTimeout(midiPollTimer);midiPollTimer=0;clearTimeout(midiCaptureRetryTimer);midiCaptureRetryTimer=0;midiCaptureActive=false;forceReleaseExternal()}
    return ensureMidiCaptureSync()
  }
  const onSyntheticMidiInput=event=>{if(destroyed||!midiCaptureWanted()||midiCaptureActive)return;const detail=event?.detail||{},bytes=detail.bytes??detail.data;if(bytes)handleExternalMidiBytes(bytes,{synthetic:true,sampleTime:detail.sampleTime,beatPosition:detail.beatPosition,tempo:detail.tempo})}
  const onAndroidMidiBatch=event=>{if(destroyed||!androidMidiPush||!midiCaptureWanted()||!midiCaptureActive)return;applyMidiSnapshot(event?.detail||{})}
  addEventListener('instrument-surface-midi-input',onSyntheticMidiInput);addEventListener('ppw-android-midi-batch',onAndroidMidiBatch)
  const scheduledPitch=row=>pitchForCurrentOutput(row?.pitch)
  const scheduledPayload=(plan,row=plan)=>({note:row.note,velocity:row.velocity??plan.velocity,pitch:scheduledPitch(row),sourceNote:row.sourceNote,ownerKey:row.ownerKey,octave:row.octave,arp:true,chord:Array.isArray(plan?.chord)&&plan.chord.length>1,ratchet:plan.ratchet,gate:plan.gate,patternStepIndex:plan.patternStepIndex,patternStep:plan.patternStep?{...plan.patternStep}:null,stepIndex:plan.stepIndex})
  const scheduledPayloads=plan=>Array.isArray(plan?.chord)&&plan.chord.length?plan.chord.map(row=>scheduledPayload(plan,row)):[scheduledPayload(plan)]
  const rememberScheduled=plan=>{if(!plan||plan.skipped)return;for(const payload of scheduledPayloads(plan))scheduledGeneratedNotes.set(`${payload.ownerKey??payload.note}:${payload.note}`,payload)}
  const releaseScheduledGenerated=()=>{for(const row of scheduledGeneratedNotes.values())try{api.trigger('keyboard.noteOff',row)}catch{};scheduledGeneratedNotes.clear()}
  const resetNativeSchedule=({release=true,resetSequence=false}={})=>{
    hostScheduleGeneration+=1;hostScheduleEpoch+=1;hostScheduleBeat=null;hostNextBeat=null
    // Native schedule reset owns cancellation and release of the currently sounding
    // generated voice in O(1). Never walk every future planned note during a replan:
    // those notes have not sounded yet and are invalidated by the new epoch.
    if(nativeScheduleAvailable)scheduledGeneratedNotes.clear();else if(release)releaseScheduledGenerated()
    if(resetSequence)engine.resetSequence({keepSounding:false})
    return hostScheduleEpoch
  }
  const ensureNativeScheduleEpoch=async()=>{
    if(!nativeScheduleAvailable)return true
    while(!destroyed&&nativeScheduleAvailable&&nativeScheduleEpochApplied!==hostScheduleEpoch){
      if(nativeScheduleResetPromise){await nativeScheduleResetPromise;continue}
      const target=hostScheduleEpoch
      nativeScheduleResetPromise=(async()=>{try{const reply=await api.requestHostAction('timeline.schedule.reset',{epoch:target}),applied=Math.max(0,Number(reply?.epoch??0));if(reply?.accepted!==false&&applied>=target)nativeScheduleEpochApplied=applied;return reply?.accepted!==false&&applied>=target}catch{return false}finally{nativeScheduleResetPromise=null}})()
      const accepted=await nativeScheduleResetPromise
      if(!accepted&&target===hostScheduleEpoch)return false
    }
    return !nativeScheduleAvailable||nativeScheduleEpochApplied===hostScheduleEpoch
  }
  const stopExternalClockSound=()=>{engine.stopScheduler();engine.stopSounding();releaseScheduledGenerated();clearPlayhead()}
  const commitInternalPlanned=frame=>{const now=Number(frame);if(!Number.isFinite(now))return;while(internalClockPlanned.length&&internalClockPlanned[0].startFrame<=now){const row=internalClockPlanned.shift();internalCommittedPhase=row.phaseAfter;markPlayhead(row)}}
  const rollbackInternalFuture=({resetSequence=false}={})=>{if(resetSequence){resetNativeSchedule({release:true,resetSequence:true});internalCommittedPhase=engine.phaseSnapshot()}else{if(internalCommittedPhase)engine.restorePhase(internalCommittedPhase);resetNativeSchedule({release:true,resetSequence:false})}internalClockPlanned.length=0;internalScheduleFrame=null;internalLastFrame=null;engine.stopScheduler();return hostScheduleEpoch}
  prepareInternalScheduledEdit=()=>{if(state.clockMode!=='INTERNAL'||!internalNativeScheduling)return false;rollbackInternalFuture({resetSequence:false});void ensureNativeScheduleEpoch();return true}
  cancelInternalScheduledFuture=()=>{if(state.clockMode!=='INTERNAL')return false;const target=internalNativeScheduling?rollbackInternalFuture({resetSequence:false}):resetNativeSchedule({release:true,resetSequence:false});void Promise.resolve(api.requestHostAction('timeline.schedule.reset',{epoch:target})).then(reply=>{const applied=Math.max(0,Number(reply?.epoch??0));if(reply?.accepted!==false&&applied>=target)nativeScheduleEpochApplied=Math.max(nativeScheduleEpochApplied,applied)}).catch(()=>{});return true}
  const commitHostPlanned=beat=>{const now=Number(beat);if(!Number.isFinite(now))return;while(hostClockPlanned.length&&hostClockPlanned[0].startBeat<=now+.002){const row=hostClockPlanned.shift();hostCommittedPhase=row.phaseAfter;markPlayhead(row)}}
  const rollbackHostFuture=({resetSequence=false}={})=>{if(resetSequence){resetNativeSchedule({release:true,resetSequence:true});hostCommittedPhase=engine.phaseSnapshot()}else{if(hostCommittedPhase)engine.restorePhase(hostCommittedPhase);resetNativeSchedule({release:true,resetSequence:false})}hostClockPlanned.length=0;hostScheduleBeat=null;return hostScheduleEpoch}
  prepareHostScheduledEdit=()=>{if(state.clockMode!=='HOST')return false;rollbackHostFuture({resetSequence:false});return true}
  const schedulePlannedAtBeat=async(plan,startBeat,stepBeats,epoch,generation)=>{
    if(!plan||plan.skipped||generation!==hostScheduleGeneration)return true
    const repeats=Math.max(1,Number(plan.ratchet)||1),slice=stepBeats/repeats,gate=Math.max(1e-6,Math.min(slice*.98,slice*Math.max(.05,Math.min(1,Number(plan.gate)||state.gate)))),payloads=scheduledPayloads(plan)
    rememberScheduled(plan)
    for(let repeat=0;repeat<repeats;repeat++){
      if(generation!==hostScheduleGeneration)return false
      const onBeat=startBeat+repeat*slice,offBeat=onBeat+gate
      for(const payload of payloads){const on=await api.requestHostAction('keyboard.schedule.atBeat',{kind:'on',beat:onBeat,epoch,...payload});if(on?.accepted!==true)return false}
      for(const payload of payloads){const off=await api.requestHostAction('keyboard.schedule.atBeat',{kind:'off',beat:offBeat,epoch,...payload});if(off?.accepted!==true)return false}
    }
    for(const payload of payloads)try{dispatchEvent(new CustomEvent('plicata-arp-output',{detail:{kind:'planned',clock:'HOST',beat:startBeat,...payload}}))}catch{}
    return true
  }
  const schedulePlannedAtFrame=async(plan,startFrame,stepFrames,epoch,clock='MIDI',referenceFrame=null,generation=hostScheduleGeneration)=>{
    if(!plan||plan.skipped||generation!==hostScheduleGeneration)return true
    const repeats=Math.max(1,Number(plan.ratchet)||1),slice=stepFrames/repeats,gate=Math.max(1,Math.min(slice*.98,slice*Math.max(.05,Math.min(1,Number(plan.gate)||state.gate)))),payloads=scheduledPayloads(plan),events=[]
    rememberScheduled(plan)
    for(let repeat=0;repeat<repeats;repeat++){
      if(generation!==hostScheduleGeneration)return false
      const onFrame=Math.max(0,Math.round(startFrame+repeat*slice)),offFrame=Math.max(onFrame+1,Math.round(onFrame+gate))
      for(const payload of payloads)events.push({kind:'on',targetFrame:onFrame,...payload})
      for(const payload of payloads)events.push({kind:'off',targetFrame:offFrame,...payload})
    }
    if(generation!==hostScheduleGeneration)return false
    const result=await api.requestHostAction('keyboard.schedule.batchAtFrame',{epoch,currentFrame:referenceFrame,events})
    if(generation!==hostScheduleGeneration)return false
    if(result?.accepted!==true)return false
    for(const payload of payloads)try{dispatchEvent(new CustomEvent('plicata-arp-output',{detail:{kind:'planned',clock,targetFrame:startFrame,...payload}}))}catch{}
    return true
  }
  const scheduleInternalClockPoll=(delayMs=INTERNAL_CLOCK_REFILL_MS)=>{clearTimeout(clockPollTimer);if(!destroyed&&state.enabled&&state.clockMode==='INTERNAL'&&engine.heldCount)clockPollTimer=setTimeout(()=>void internalClockPoll(),Math.max(0,Number(delayMs)||0))}
  const internalClockPoll=async()=>{
    if(destroyed||!state.enabled||state.clockMode!=='INTERNAL')return
    if(internalScheduleBusy){internalPollPending=true;return}
    internalScheduleBusy=true;internalPollPending=false
    const pollGeneration=hostScheduleGeneration
    try{
      const reply=await api.requestHostAction('timeline.clock')
      // The musical state may change while the native clock reply is in flight.
      // A retired poll must not restore flags, plan notes, or start a fallback driver.
      if(destroyed||!state.enabled||state.clockMode!=='INTERNAL'||pollGeneration!==hostScheduleGeneration)return
      const clock=reply?.clock||{},currentFrame=Number(clock.currentFrame),sampleRate=Math.max(1000,Number(clock.sampleRate)||internalSampleRate),quantum=Math.max(1,Number(clock.quantum)||128)
      internalSampleRate=sampleRate;nativeScheduleAvailable=reply?.accepted===true&&Number.isFinite(currentFrame);internalNativeScheduling=nativeScheduleAvailable
      if(!internalNativeScheduling){internalScheduleFrame=null;internalClockPlanned.length=0;internalCommittedPhase=null;internalLastFrame=null;if(engine.heldCount)engine.ensureRunning();return}
      engine.stopScheduler();commitInternalPlanned(currentFrame)
      const replanRequested=internalReplanRevision!==internalAppliedReplanRevision
      if(replanRequested){rollbackInternalFuture({resetSequence:false});internalAppliedReplanRevision=internalReplanRevision;internalLastFrame=currentFrame}
      else{const discontinuity=internalLastFrame!==null&&(currentFrame<internalLastFrame||currentFrame-internalLastFrame>sampleRate*1.25);internalLastFrame=currentFrame;if(discontinuity)rollbackInternalFuture({resetSequence:true})}
      if(!engine.heldCount){internalScheduleFrame=null;internalClockPlanned.length=0;return}
      if(!(await ensureNativeScheduleEpoch()))return
      if(destroyed||!state.enabled||state.clockMode!=='INTERNAL')return
      if(!internalCommittedPhase)internalCommittedPhase=engine.phaseSnapshot()
      const leadFrames=Math.max(quantum*4,Math.round(sampleRate*INTERNAL_CLOCK_MIN_LEAD_MS/1000)),horizon=currentFrame+Math.max(leadFrames*2,Math.round(sampleRate*INTERNAL_CLOCK_LOOKAHEAD_MS/1000))
      if(internalScheduleFrame===null||internalScheduleFrame<currentFrame+leadFrames){if(internalScheduleFrame!==null&&internalClockPlanned.length)rollbackInternalFuture({resetSequence:false});if(!internalCommittedPhase)internalCommittedPhase=engine.phaseSnapshot();internalScheduleFrame=currentFrame+leadFrames}
      const epoch=hostScheduleEpoch,generation=hostScheduleGeneration;let guard=0
      while(internalScheduleFrame!==null&&internalScheduleFrame<=horizon&&guard++<24&&generation===hostScheduleGeneration){
        const startFrame=internalScheduleFrame,plan=engine.planStep(),stepFrames=Math.max(1,Math.round(Math.max(1,Number(plan?.stepMs)||engine.stepDurationMs())*sampleRate/1000));internalClockPlanned.push({startFrame,phaseAfter:engine.phaseSnapshot(),patternStepIndex:Number.isInteger(plan?.patternStepIndex)?plan.patternStepIndex:-1,stepIndex:Number.isInteger(plan?.stepIndex)?plan.stepIndex:-1});internalScheduleFrame+=stepFrames
        if(plan&&!plan.skipped){const scheduled=await schedulePlannedAtFrame(plan,startFrame,stepFrames,epoch,'INTERNAL',currentFrame,generation);if(!scheduled||generation!==hostScheduleGeneration)break}
      }
    }catch{if(!destroyed&&state.enabled&&state.clockMode==='INTERNAL'&&pollGeneration===hostScheduleGeneration){internalNativeScheduling=false;if(engine.heldCount)engine.ensureRunning()}}
    finally{internalScheduleBusy=false;internalPollPending=false;scheduleInternalClockPoll()}
  }
  requestInternalReplan=()=>{internalReplanRevision=(internalReplanRevision+1)>>>0;internalPollPending=true;if(!internalScheduleBusy&&!destroyed&&state.enabled&&state.clockMode==='INTERNAL')scheduleInternalClockPoll(INTERNAL_CLOCK_REPLAN_MS);return internalReplanRevision}
  const runHostReference=transport=>{
    const available=transport?.available===true,playing=transport?.playing===true,beat=Number(transport?.beatPosition),tempo=Number(transport?.tempo)
    if(!available||!playing||!Number.isFinite(beat)){if(hostWasPlaying)stopExternalClockSound();hostWasPlaying=false;hostNextBeat=null;hostLastBeat=null;return}
    if(Number.isFinite(tempo)&&tempo>=20&&tempo<=400)engine.setExternalTempo(tempo)
    const discontinuity=hostLastBeat!==null&&(beat<hostLastBeat-.05||beat-hostLastBeat>4)
    if(!hostWasPlaying||hostNextBeat===null||discontinuity){engine.resetSequence({keepSounding:false});const base=Math.max(1e-6,divisionBeats());hostNextBeat=Math.ceil((beat-1e-7)/base)*base;if(hostNextBeat<beat-1e-5)hostNextBeat+=base}
    hostWasPlaying=true;hostLastBeat=beat
    let guard=0;while(hostNextBeat!==null&&beat>=hostNextBeat-.002&&guard++<8){engine.externalTick();hostNextBeat+=Math.max(1e-6,stepBeatsForCounter(engine.stepIndex))}
  }
  const scheduleHostClockPoll=()=>{clearTimeout(clockPollTimer);if(!destroyed&&state.enabled&&state.clockMode==='HOST')clockPollTimer=setTimeout(()=>void hostClockPoll(),14)}
  const hostClockPoll=async()=>{
    if(destroyed||!state.enabled||state.clockMode!=='HOST'||hostScheduleBusy)return
    hostScheduleBusy=true
    try{
      const reply=await api.requestHostAction('timeline.clock'),transport=reply?.transport??(typeof api.transport==='function'?api.transport():null),available=transport?.available===true,playing=transport?.playing===true,musical=transport?.musicalContextAvailable!==false,beat=Number(transport?.beatPosition),tempo=Number(transport?.tempo)
      hostNativeScheduling=reply?.accepted===true&&available&&musical&&Number.isFinite(beat)
      if(!hostNativeScheduling){runHostReference(transport);return}
      if(!playing){
        if(hostWasPlaying){commitHostPlanned(beat);rollbackHostFuture({resetSequence:false})}
        hostWasPlaying=false;hostScheduleBeat=null;hostLastBeat=null;stopExternalClockSound();return
      }
      if(Number.isFinite(tempo)&&tempo>=20&&tempo<=400)engine.setExternalTempo(tempo)
      const discontinuity=hostLastBeat!==null&&(beat<hostLastBeat-.05||beat-hostLastBeat>4)
      commitHostPlanned(beat)
      if(!hostWasPlaying||discontinuity){
        const epoch=rollbackHostFuture({resetSequence:true}),base=Math.max(1e-6,divisionBeats())
        hostScheduleBeat=Math.ceil((beat+.015)/base)*base;if(hostScheduleBeat<beat+.005)hostScheduleBeat+=base
      }else if(hostScheduleBeat===null){
        const base=Math.max(1e-6,divisionBeats());hostScheduleBeat=Math.ceil((beat+.015)/base)*base;if(hostScheduleBeat<beat+.005)hostScheduleBeat+=base
      }
      hostWasPlaying=true;hostLastBeat=beat
      if(nativeScheduleAvailable&&!(await ensureNativeScheduleEpoch())){hostNativeScheduling=false;return}
      const generation=hostScheduleGeneration,epoch=hostScheduleEpoch,horizon=beat+Math.max(.5,divisionBeats()*4)
      let guard=0
      while(hostScheduleBeat!==null&&hostScheduleBeat<=horizon&&guard++<16&&generation===hostScheduleGeneration){
        const startBeat=hostScheduleBeat,plan=engine.externalPlanStep(),stepBeats=Math.max(1e-6,stepBeatsForCounter(engine.stepIndex))
        hostClockPlanned.push({startBeat,phaseAfter:engine.phaseSnapshot(),patternStepIndex:Number.isInteger(plan?.patternStepIndex)?plan.patternStepIndex:-1,stepIndex:Number.isInteger(plan?.stepIndex)?plan.stepIndex:-1});hostScheduleBeat+=stepBeats
        if(plan&&!plan.skipped){const ok=await schedulePlannedAtBeat(plan,startBeat,stepBeats,epoch,generation);if(!ok){rollbackHostFuture({resetSequence:false});hostNativeScheduling=false;break}}
      }
    }catch{hostNativeScheduling=false}
    finally{hostScheduleBusy=false;scheduleHostClockPoll()}
  }
  const midiBasePulses=()=>Math.max(.125,24*divisionBeats())
  const alignMidiNextBoundary=()=>{
    const base=midiBasePulses(),minimum=midiClockPulsePosition+MIDI_CLOCK_MIN_LEAD_PULSES
    midiClockNextStepPulse=Math.ceil((minimum-1e-9)/base)*base
    return midiClockNextStepPulse
  }
  const commitMidiPlanned=()=>{
    while(midiClockPlanned.length&&midiClockPlanned[0].startPulse<=midiClockPulsePosition+1e-9){
      const row=midiClockPlanned.shift();midiClockCommittedPhase=row.phaseAfter;markPlayhead(row)
    }
  }
  const rollbackMidiFuture=({resetSequence=false}={})=>{
    if(resetSequence){resetNativeSchedule({release:true,resetSequence:true});midiClockCommittedPhase=engine.phaseSnapshot()}
    else{if(midiClockCommittedPhase)engine.restorePhase(midiClockCommittedPhase);resetNativeSchedule({release:true,resetSequence:false})}
    midiClockPlanned.length=0;midiClockNextStepPulse=null
    if(midiClockRunning)alignMidiNextBoundary()
  }
  prepareMidiScheduledEdit=()=>{if(state.clockMode!=='MIDI')return false;rollbackMidiFuture({resetSequence:false});return true}
  const scheduleMidiLookahead=sampleTime=>{
    const frame=Number(sampleTime)
    if(!midiNativeScheduling||!midiClockPeriodLocked||!Number.isFinite(frame)||!midiClockRunning)return false
    if(nativeScheduleEpochApplied!==hostScheduleEpoch){void ensureNativeScheduleEpoch();return false}
    if(midiClockNextStepPulse===null)alignMidiNextBoundary()
    let guard=0
    while(midiClockNextStepPulse!==null&&midiClockNextStepPulse<=midiClockPulsePosition+MIDI_CLOCK_LOOKAHEAD_PULSES&&guard++<24){
      const delta=midiClockNextStepPulse-midiClockPulsePosition
      if(delta<MIDI_CLOCK_MIN_LEAD_PULSES){
        midiClockNextStepPulse+=Math.max(.125,24*stepBeatsForCounter(engine.stepIndex+1))
        continue
      }
      const startPulse=midiClockNextStepPulse,plan=engine.externalPlanStep(),stepPulses=Math.max(.125,24*stepBeatsForCounter(engine.stepIndex)),targetFrame=frame+delta*midiClockFramesPerPulse
      if(plan&&!plan.skipped)void schedulePlannedAtFrame(plan,targetFrame,Math.max(1,stepPulses*midiClockFramesPerPulse),hostScheduleEpoch,'MIDI',frame,hostScheduleGeneration)
      midiClockPlanned.push({startPulse,phaseAfter:engine.phaseSnapshot(),patternStepIndex:Number.isInteger(plan?.patternStepIndex)?plan.patternStepIndex:-1,stepIndex:Number.isInteger(plan?.stepIndex)?plan.stepIndex:-1})
      midiClockNextStepPulse+=stepPulses
    }
    return true
  }
  const emitMidiClockFallbackStep=()=>engine.externalTick()
  handleMidiRealtime=(status,{sampleTime=null}={})=>{
    const code=Number(status)&0xff
    if(state.clockMode!=='MIDI'||!state.enabled)return
    if(code===0xfa){
      midiClockSawTransport=true;midiClockRunning=true;midiClockFirstStep=true;midiClockAccumulator=0;midiClockLastPulseMs=0;midiClockLastSampleTime=null;midiClockPeriodLocked=false;midiClockPulsePosition=0;midiClockPlanned.length=0
      resetNativeSchedule({release:true,resetSequence:true});midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;alignMidiNextBoundary();return
    }
    if(code===0xfb){
      midiClockSawTransport=true;midiClockRunning=true;midiClockLastPulseMs=0;midiClockLastSampleTime=null;midiClockPlanned.length=0;midiClockNextStepPulse=null;alignMidiNextBoundary();return
    }
    if(code===0xfc){
      midiClockSawTransport=true;commitMidiPlanned();midiClockRunning=false;midiClockLastSampleTime=null;rollbackMidiFuture({resetSequence:false});midiClockNextStepPulse=null;stopExternalClockSound();return
    }
    if(code!==0xf8)return
    const now=performance.now(),frame=Number(sampleTime)
    if(!midiClockSawTransport&&!midiClockRunning){
      midiClockRunning=true;midiClockFirstStep=true;midiClockAccumulator=0;midiClockPulsePosition=0;midiClockPlanned.length=0;resetNativeSchedule({release:true,resetSequence:true});midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;alignMidiNextBoundary()
    }
    if(!midiClockRunning)return
    midiClockPulsePosition+=1
    if(Number.isFinite(frame)&&midiClockLastSampleTime!==null&&frame>midiClockLastSampleTime){
      const frameDelta=frame-midiClockLastSampleTime
      midiClockFramesPerPulse=midiClockPeriodLocked?midiClockFramesPerPulse+(frameDelta-midiClockFramesPerPulse)*.2:frameDelta
      midiClockPeriodLocked=true
      const instant=midiClockSampleRate*60/(midiClockFramesPerPulse*24)
      if(Number.isFinite(instant)&&instant>=20&&instant<=400){midiClockTempo=instant;engine.setExternalTempo(instant)}
    }
    if(Number.isFinite(frame))midiClockLastSampleTime=frame
    if(midiClockLastPulseMs>0&&!midiClockPeriodLocked){const delta=now-midiClockLastPulseMs,instant=delta>2&&delta<250?60000/(delta*24):NaN;if(Number.isFinite(instant)&&instant>=20&&instant<=400){midiClockTempo=instant;engine.setExternalTempo(instant)}}
    midiClockLastPulseMs=now
    commitMidiPlanned()
    if(midiNativeScheduling){if(midiClockPeriodLocked)scheduleMidiLookahead(frame);return}
    if(midiClockFirstStep){midiClockFirstStep=false;midiClockAccumulator=0;emitMidiClockFallbackStep();return}
    midiClockAccumulator+=1
    let target=Math.max(1,24*stepBeatsForCounter(engine.stepIndex)),guard=0
    while(midiClockAccumulator+1e-9>=target&&guard++<4){midiClockAccumulator-=target;emitMidiClockFallbackStep();target=Math.max(1,24*stepBeatsForCounter(engine.stepIndex))}
  }

  const probeNativeClock=async()=>{
    try{const reply=await api.requestHostAction('timeline.clock'),rate=Number(reply?.clock?.sampleRate??reply?.transport?.sampleRate);if(Number.isFinite(rate)&&rate>1000)midiClockSampleRate=rate;nativeScheduleAvailable=reply?.accepted===true;midiNativeScheduling=nativeScheduleAvailable;if(nativeScheduleAvailable)await ensureNativeScheduleEpoch();return midiNativeScheduling}catch{nativeScheduleAvailable=false;midiNativeScheduling=false;return false}
  }
  const syncClockDriver=()=>{
    clearTimeout(clockPollTimer);clockPollTimer=0;resetNativeSchedule({release:true,resetSequence:false});hostScheduleBeat=null;hostNextBeat=null;hostWasPlaying=false;hostLastBeat=null;hostClockPlanned.length=0;engine.stopScheduler();midiClockPlanned.length=0;midiClockNextStepPulse=null
    if(state.clockMode==='INTERNAL'){hostNativeScheduling=false;midiNativeScheduling=false;midiClockRunning=false;midiClockPeriodLocked=false;hostCommittedPhase=null;internalScheduleFrame=null;internalClockPlanned.length=0;internalCommittedPhase=engine.phaseSnapshot();internalLastFrame=null;engine.setExternalTempo(null);if(state.enabled)void internalClockPoll();return true}
    if(state.clockMode==='HOST'){midiClockRunning=false;midiClockPeriodLocked=false;hostCommittedPhase=engine.phaseSnapshot();void probeNativeClock().finally(scheduleHostClockPoll);return true}
    if(state.clockMode==='MIDI'){hostCommittedPhase=null;midiClockCommittedPhase=engine.phaseSnapshot();engine.setExternalTempo(midiClockTempo);void probeNativeClock();return true}
    return false
  }

  const liveState=()=>normalizePlicataArpState(state)
  const syncActiveSceneSnapshot=()=>{sceneBank=replacePlicataArpScene(sceneBank,sceneBank.activeScene,state);return sceneBank}
  const liveScenes=()=>normalizePlicataArpScenesState(syncActiveSceneSnapshot(),state)
  const activateArpScene=(sceneNumber,{source='ui',channel=null,note=null}={})=>{
    const wanted=Math.max(1,Math.min(PLICATA_ARP_SCENE_COUNT,Math.round(Number(sceneNumber)||1)))
    if(wanted===sceneBank.activeScene){lastSceneRecall={scene:wanted,source,channel,note,noOp:true};syncUi();return true}
    interactionRevision+=1;syncActiveSceneSnapshot();if(state.enabled)prepareScheduledEdit()
    const keepFill=fillActive;mutationActive=false;mutationOverlay=null;engine.clearPerformanceOverlay()
    sceneBank=activatePlicataArpScene(sceneBank,wanted,state);state=engine.setSceneState(plicataArpSceneState(sceneBank,wanted,state),{notify:false})
    if(keepFill)engine.setPerformanceOverlay({fill:true})
    lastSceneRecall={scene:wanted,source,channel,note,noOp:false};if(state.enabled)rearmScheduledClock();syncUi();schedulePersist();return true
  }
  const persist=async()=>{if(destroyed)return false;const scenes=liveScenes(),json=JSON.stringify(liveState()),scenesJson=JSON.stringify(scenes);const [activeResult,scenesResult]=await Promise.all([api.requestHostAction('state.save',{key:STATE_KEY,json,musical:true}),api.requestHostAction('state.save',{key:SCENES_STATE_KEY,json:scenesJson,musical:true})]);return activeResult?.accepted!==false&&scenesResult?.accepted!==false}
  const schedulePersist=()=>{clearTimeout(persistTimer);persistTimer=setTimeout(()=>{persistTimer=0;void persist()},100)}
  const apply=patch=>{const source=patch&&typeof patch==='object'?patch:{},candidate=normalizePlicataArpState({...state,...source}),keys=Object.keys(source),changedKeys=keys.filter(key=>JSON.stringify(candidate?.[key])!==JSON.stringify(state?.[key]));if(!changedKeys.length)return state;interactionRevision+=1;const wasEnabled=state.enabled,wasClock=state.clockMode,enabledChanged=candidate.enabled!==wasEnabled,clockChanged=candidate.clockMode!==wasClock,holdReleaseDropsLatched=changedKeys.includes('hold')&&state.hold&&!candidate.hold&&engine.hasLatchedNotes(),schedulerContentChanged=changedKeys.some(key=>key!=='hold'&&key!=='enabled'&&key!=='clockMode'),needsScheduledEdit=wasEnabled&&!enabledChanged&&!clockChanged&&(schedulerContentChanged||holdReleaseDropsLatched);if(needsScheduledEdit)prepareScheduledEdit();const mutationSensitive=changedKeys.some(key=>['pattern','patternLength','probability','ratchet'].includes(key)),disabling=wasEnabled&&!candidate.enabled;if(disabling){mutationActive=false;mutationOverlay=null;fillActive=false;engine.clearPerformanceOverlay()}else if(mutationActive&&mutationSensitive){mutationActive=false;mutationOverlay=null;engine.clearPerformanceOverlay();if(fillActive)engine.setPerformanceOverlay({fill:true})}state=engine.setState(candidate,{notify:false,startScheduler:false});syncUi();if(enabledChanged)void syncMidiCapture(state.enabled||keyswitchLearn);if(enabledChanged||clockChanged)syncClockDriver();else if(needsScheduledEdit)rearmScheduledClock();schedulePersist();return state}
  const applyPatternPatch=(patch,{persist=true,refresh=true}={})=>{interactionRevision+=1;state=engine.setState({...state,...patch},{notify:false,startScheduler:false});if(refresh)syncPatternMonitor();if(persist)schedulePersist();return state}
  const applyLivePerformancePatch=(patch,{persist=true,replan=true,sync=true,markInteraction=true}={})=>{if(markInteraction)interactionRevision+=1;const before=state,stateNext=engine.setLivePerformanceState(patch,{notify:false}),keys=Object.keys(patch||{}),changed=keys.some(key=>JSON.stringify(stateNext?.[key])!==JSON.stringify(before?.[key]));state=stateNext;if(!changed)return state;if(replan&&state.enabled&&state.clockMode==='INTERNAL'&&internalNativeScheduling){prepareInternalScheduledEdit();internalCommittedPhase=engine.phaseSnapshot();internalScheduleFrame=null;void internalClockPoll()}if(sync)syncUi();if(persist)schedulePersist();return state}
  const performanceOverlayValue=()=>{if(!mutationActive&&!fillActive)return null;const row={fill:fillActive};if(mutationActive&&mutationOverlay){row.probability=mutationOverlay.probability;row.ratchet=mutationOverlay.ratchet;row.pattern=mutationOverlay.pattern}return row}
  const replanPerformance=()=>{if(state.enabled&&state.clockMode==='INTERNAL')prepareInternalScheduledEdit();else if(state.enabled&&state.clockMode==='MIDI')prepareMidiScheduledEdit();else if(state.enabled&&state.clockMode==='HOST')prepareHostScheduledEdit();const overlay=performanceOverlayValue();if(overlay)engine.setPerformanceOverlay(overlay);else engine.clearPerformanceOverlay();if(state.enabled&&state.clockMode==='INTERNAL'){internalCommittedPhase=engine.phaseSnapshot();internalScheduleFrame=null;void internalClockPoll()}else if(state.enabled&&state.clockMode==='HOST'){hostCommittedPhase=engine.phaseSnapshot();hostScheduleBeat=null}else if(state.enabled&&state.clockMode==='MIDI'){midiClockCommittedPhase=engine.phaseSnapshot();midiClockNextStepPulse=null;if(midiClockRunning)alignMidiNextBoundary()}syncUi();return overlay}
  const clearPerformance=()=>{mutationActive=false;mutationOverlay=null;fillActive=false;engine.clearPerformanceOverlay();return true}
  const toggleMutation=()=>{if(mutationActive){mutationActive=false;mutationOverlay=null;replanPerformance();return false}mutationSerial+=1;mutationOverlay=makePlicataArpMutation(state,mutationSerial);mutationActive=true;replanPerformance();return true}
  const freezeMutation=()=>{if(!mutationActive||!mutationOverlay)return false;const frozen={pattern:mutationOverlay.pattern,probability:mutationOverlay.probability,ratchet:mutationOverlay.ratchet};mutationActive=false;mutationOverlay=null;engine.clearPerformanceOverlay();const next=apply(frozen);if(fillActive)replanPerformance();return next}
  const setFillActive=value=>{const next=value===true;if(fillActive===next)return fillActive;fillActive=next;replanPerformance();return fillActive}
  const rotatePattern=delta=>{const length=Math.max(1,Number(state.patternLength)||1),current=((Number(state.patternRotation)||0)%length+length)%length,next=(current+Math.sign(Number(delta)||0)+length)%length;return applyPatternPatch({patternRotation:next})}
  const commitVisualGesture=()=>{if(state.enabled)prepareScheduledEdit();if(state.enabled)rearmScheduledClock();schedulePersist();return true}

  const makeVisualChoice=({label,values,get,set,format=value=>String(value),columns=values.length})=>{
    const node=el('div','mav-arp-choice'),title=el('span','mav-arp-choice__label',label),grid=el('div','mav-arp-choice__grid');grid.style.gridTemplateColumns=`repeat(${Math.max(1,columns)},minmax(44px,1fr))`
    const buttons=values.map(value=>{const button=el('button','',String(format(value)));button.type='button';button.dataset.value=String(value);button.setAttribute('aria-label',`${label} ${format(value)}`);bindMultiTouchButton(button,()=>set(value));grid.append(button);return{button,value}})
    node.append(title,grid);const sync=()=>{const current=get();for(const row of buttons)row.button.setAttribute('aria-pressed',String(Object.is(row.value,current)||String(row.value)===String(current)))};sync();return{node,sync,buttons}
  }
  const makeDragChoice=({label,values,get,set,format=value=>String(value)})=>{
    const node=el('div','mav-arp-drag-choice'),title=el('span','mav-arp-drag-choice__label',label),surface=el('button','mav-arp-drag-choice__surface'),valueNode=el('b','mav-arp-drag-choice__value',''),hint=el('small','mav-arp-drag-choice__hint','DRAG ↑↓');surface.type='button';surface.append(valueNode,hint);node.append(title,surface)
    const indexFor=value=>{const found=values.findIndex(row=>Object.is(row,value)||String(row)===String(value));return found>=0?found:0}
    const sync=()=>{const index=indexFor(get()),value=values[index];valueNode.textContent=String(format(value));surface.setAttribute('aria-label',`${label} ${format(value)} · drag vertically`);surface.setAttribute('role','slider');surface.setAttribute('aria-orientation','vertical');surface.setAttribute('aria-valuemin','0');surface.setAttribute('aria-valuemax',String(Math.max(0,values.length-1)));surface.setAttribute('aria-valuenow',String(index));surface.setAttribute('aria-valuetext',String(format(value)));node.dataset.index=String(index);return index}
    const commitIndex=index=>{const next=Math.max(0,Math.min(values.length-1,Math.round(Number(index)||0))),current=indexFor(get());if(next===current){sync();return false}set(values[next]);sync();return true}
    let pointer=null,suppressClick=false
    surface.addEventListener('pointerdown',event=>{if(pointer||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();pointer={id:event.pointerId,startY:Number(event.clientY),startIndex:indexFor(get()),step:0,moved:false};suppressClick=false;try{surface.setPointerCapture?.(event.pointerId)}catch{}})
    surface.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;event.preventDefault();const step=Math.trunc((pointer.startY-Number(event.clientY))/14);if(step===pointer.step)return;pointer.step=step;pointer.moved=pointer.moved||step!==0;commitIndex(pointer.startIndex+step)})
    const finish=event=>{if(!pointer||event?.pointerId!==pointer.id)return;const moved=pointer.moved,id=pointer.id;pointer=null;suppressClick=true;try{surface.releasePointerCapture?.(id)}catch{};if(!moved)commitIndex(indexFor(get())+1)}
    surface.addEventListener('pointerup',finish);surface.addEventListener('pointercancel',event=>{if(pointer?.id===event.pointerId){pointer=null;suppressClick=false;sync()}});surface.addEventListener('lostpointercapture',event=>{if(pointer?.id===event.pointerId){pointer=null;suppressClick=false;sync()}});surface.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();return}commitIndex(indexFor(get())+1)})
    surface.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End','PageUp','PageDown'].includes(event.key))return;event.preventDefault();if(event.key==='Home')commitIndex(0);else if(event.key==='End')commitIndex(values.length-1);else commitIndex(indexFor(get())+(['ArrowUp','ArrowRight','PageUp'].includes(event.key)?1:-1))})
    sync();return{node,sync,surface,valueNode}
  }
  const makeGestureControl=({label,minimum=0,maximum=1,getMaximum=null,step=.01,get,set,format=value=>String(value),commit=commitVisualGesture,compact=false})=>{
    const node=el('div',`mav-arp-gesture${compact?' mav-arp-velocity-value':''}`),title=el('span','mav-arp-gesture__label',label),valueNode=el('b','mav-arp-gesture__value',''),meter=el('span','mav-arp-gesture__meter'),fill=el('i','');meter.append(fill);node.append(title,valueNode,meter);node.tabIndex=0;node.setAttribute('role','slider');node.setAttribute('aria-label',label)
    const maxValue=()=>Math.max(minimum,Number(typeof getMaximum==='function'?getMaximum():maximum)||maximum),quantize=raw=>{const max=maxValue(),clamped=clamp(raw,minimum,max),q=step>0?Math.round((clamped-minimum)/step)*step+minimum:clamped;return clamp(Number(q.toFixed(step<1?4:0)),minimum,max)}
    const sync=()=>{const max=maxValue(),current=quantize(Number(get()));const t=max>minimum?(current-minimum)/(max-minimum):0;valueNode.textContent=format(current);node.style.setProperty('--arp-gesture-fill',`${Math.round(t*100)}%`);node.setAttribute('aria-valuemin',String(minimum));node.setAttribute('aria-valuemax',String(max));node.setAttribute('aria-valuenow',String(current));node.setAttribute('aria-valuetext',format(current));return current}
    let gesture=null;const write=event=>{if(!gesture)return;const rect=node.getBoundingClientRect(),range=maxValue()-minimum,travel=Math.max(44,rect.height*.72),next=quantize(gesture.startValue+(gesture.startY-Number(event.clientY))/travel*range);set(next);sync()}
    node.addEventListener('pointerdown',event=>{if(gesture||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();gesture={pointerId:event.pointerId,startY:Number(event.clientY),startValue:Number(get())};try{node.setPointerCapture?.(event.pointerId)}catch{};write(event)})
    node.addEventListener('pointermove',event=>{if(gesture?.pointerId!==event.pointerId)return;event.preventDefault();write(event)})
    const end=event=>{if(!gesture||event?.pointerId!==undefined&&gesture.pointerId!==event.pointerId)return;const prior=gesture;gesture=null;try{node.releasePointerCapture?.(prior.pointerId)}catch{};commit?.();sync()};node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);node.addEventListener('lostpointercapture',end)
    node.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const direction=event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1,next=event.key==='Home'?minimum:event.key==='End'?maxValue():quantize(Number(get())+direction*step);set(next);commit?.();sync()});sync();return{node,sync,valueNode}
  }

  const onRendered=createTrambustissimoRoundPanelButton({tone:'red'}),onWrap=el('div','mav-arp-cell mav-arp-cell--toggle mav-arp-cell--inside-label'),onLabel=el('span','mav-arp-cell__label',''),onButton=onRendered.button,onCrownLabel=el('span','mav-arp-crown-label','ARP')
  onButton.classList.add('mav-arp-toggle');onButton.setAttribute('aria-label','Arpeggiator on or off');onButton.append(onCrownLabel);onWrap.append(onLabel,onRendered.node);root.append(onWrap)
  bindMultiTouchButton(onButton,()=>{const next=!state.enabled;apply({enabled:next})})

  const controls=[
    makeMetalChoice({label:'RATE',values:PLICATA_ARP_DIVISIONS.map(row=>row.id),get:()=>state.division,set:value=>apply({division:value})}),
    makeMetalChoice({label:'MODE',values:PLICATA_ARP_STYLES,get:()=>state.style,set:value=>apply({style:value}),format:labelStyle}),
    makeMetalChoice({label:'OCT',values:OCTAVE_VALUES,get:()=>state.octaves,set:value=>apply({octaves:value}),format:value=>`${value}X`}),
  ];controls[1].node.classList.add('mav-arp-mode-inside');controls[1].node.querySelector('.mbs-input')?.append(el('span','mav-arp-selector-inside-label','MODE'));root.append(controls[0].node,controls[1].node)

  const moreRendered=createTrambustissimoRoundPanelButton({tone:'charcoal'}),moreWrap=el('div','mav-arp-cell mav-arp-cell--toggle mav-arp-more-wrap mav-arp-cell--inside-label'),moreLabel=el('span','mav-arp-cell__label',''),more=moreRendered.button,moreInsideLabel=el('span','mav-round-inside-label','MORE');more.classList.add('mav-arp-advanced-toggle');more.setAttribute('aria-label','Open advanced arpeggiator controls');more.setAttribute('aria-expanded','false');more.append(moreInsideLabel);moreWrap.append(moreLabel,moreRendered.node)
  const resetAdvancedInlinePosition=()=>{advanced.style.removeProperty('left');advanced.style.removeProperty('right');advanced.style.removeProperty('top');advanced.style.removeProperty('bottom')}
  const positionAdvancedOverlay=()=>{if(advanced.hidden)return false;const shell=root.closest('.mavis-object');if(!shell||advanced.parentNode!==shell)return false;advanced.style.left='2px';advanced.style.right='auto';advanced.style.top='1px';advanced.style.bottom='auto';return true}
  function syncAdvancedMount(){const shell=root.closest('.mavis-object'),overlay=!advanced.hidden&&shell;if(overlay){if(advanced.parentNode!==shell)shell.append(advanced);advanced.classList.add('mav-arp-advanced--shell-overlay');positionAdvancedOverlay();return true}if(advanced.parentNode!==root)root.append(advanced);advanced.classList.remove('mav-arp-advanced--shell-overlay');resetAdvancedInlinePosition();return false}
  const setAdvancedVisible=visible=>{advanced.hidden=!visible;root.dataset.advanced=visible?'1':'0';more.setAttribute('aria-expanded',String(visible));moreRendered.setPressed(visible);syncAdvancedMount();return visible},closeAdvanced=()=>setAdvancedVisible(false)
  bindMultiTouchButton(more,()=>{const visible=setAdvancedVisible(advanced.hidden);if(visible)dispatchEvent(new CustomEvent('plicata-arp-detail-open'))});bindMultiTouchButton(advancedClose,event=>{event?.stopPropagation?.();closeAdvanced();more.focus({preventScroll:true})});advanced.addEventListener('keydown',event=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();closeAdvanced();more.focus({preventScroll:true})});const onSubDetailOpen=()=>closeAdvanced();addEventListener('plicata-sub-detail-open',onSubDetailOpen)
  root.append(moreWrap)
  const holdRendered=createTrambustissimoRoundPanelButton({tone:'yellow'}),holdWrap=el('div','mav-arp-cell mav-arp-cell--toggle mav-arp-cell--inside-label'),holdLabel=el('span','mav-arp-cell__label',''),holdButton=holdRendered.button,holdCrownLabel=el('span','mav-arp-crown-label','HOLD')
  holdButton.classList.add('mav-arp-hold');holdButton.setAttribute('aria-label','Arpeggiator hold latch');holdButton.append(holdCrownLabel);holdWrap.append(holdLabel,holdRendered.node);bindMultiTouchButton(holdButton,()=>apply({hold:!state.hold}))
  const gateControl=makeMetalChoice({label:'GATE',values:GATE_VALUES,get:()=>state.gate,set:value=>apply({gate:value}),format:labelPercent}),swingControl=makeMetalChoice({label:'SWING',values:SWING_VALUES,get:()=>state.swing,set:value=>apply({swing:value}),format:labelPercent}),retriggerControl=makeMetalChoice({label:'RETRIG',values:PLICATA_ARP_RETRIGGER,get:()=>state.retrigger,set:value=>apply({retrigger:value}),format:value=>value==='FIRST'?'1ST':value==='EACH'?'EACH':'OFF'})
  const reset=el('button','mav-arp-command','RESET');reset.type='button';reset.setAttribute('aria-label','Reset arpeggiator phase');bindMultiTouchButton(reset,()=>{engine.resetSequence();clearPlayhead()})
  const clockControl=makeMetalChoice({label:'CLK',values:PLICATA_ARP_CLOCK_MODES,get:()=>state.clockMode,set:value=>apply({clockMode:value}),format:CLOCK_LABEL}),probabilityControl=makeMetalChoice({label:'PROB',values:PROBABILITY_VALUES,get:()=>state.probability,set:value=>apply({probability:value}),format:labelPercent}),octaveProbabilityControl=makeMetalChoice({label:'OCT P',values:OCTAVE_PROBABILITY_VALUES,get:()=>state.octaveProbability,set:value=>apply({octaveProbability:value}),format:labelPercent}),ratchetControl=makeMetalChoice({label:'RATCH',values:RATCHET_VALUES,get:()=>state.ratchet,set:value=>apply({ratchet:value}),format:value=>`${value}X`}),velocityControl=makeMetalChoice({label:'VEL',values:PLICATA_ARP_VELOCITY_MODES,get:()=>state.velocityMode,set:value=>apply({velocityMode:value})}),fixedVelocityControl=makeMetalChoice({label:'FIX',values:FIXED_VELOCITY_VALUES,get:()=>state.fixedVelocity,set:value=>apply({fixedVelocity:value})}),accentControl=makeMetalChoice({label:'ACCENT',values:ACCENT_VALUES,get:()=>state.accentAmount,set:value=>apply({accentAmount:value}),format:value=>`+${value}`}),performanceChassis=el('div','mav-arp-chassis-controls'),performanceActions=el('div','mav-arp-performance-actions'),quickHold=el('button','mav-arp-quick-action mav-arp-quick-action--hold','HOLD'),quickFill=el('button','mav-arp-quick-action mav-arp-quick-action--fill','FILL'),chassisOctaveControl=makeMetalChoice({label:'OCT',values:OCTAVE_VALUES,get:()=>state.octaves,set:value=>apply({octaves:value}),format:value=>`${value}X`}),chassisGateControl=makeMetalChoice({label:'GATE',values:GATE_VALUES,get:()=>state.gate,set:value=>apply({gate:value}),format:labelPercent}),chassisProbabilityControl=makeMetalChoice({label:'PROB',values:PROBABILITY_VALUES,get:()=>state.probability,set:value=>apply({probability:value}),format:labelPercent}),chassisRatchetControl=makeMetalChoice({label:'RATCH',values:RATCHET_VALUES,get:()=>state.ratchet,set:value=>apply({ratchet:value}),format:value=>`${value}X`});performanceChassis.append(chassisOctaveControl.node,chassisGateControl.node,chassisProbabilityControl.node,chassisRatchetControl.node);quickHold.type='button';quickFill.type='button';quickHold.setAttribute('aria-label','Arpeggiator hold');quickFill.setAttribute('aria-label','Momentary arpeggiator fill');bindMultiTouchButton(quickHold,()=>apply({hold:!state.hold}));const endQuickFill=()=>setFillActive(false);quickFill.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;event.preventDefault();try{quickFill.setPointerCapture(event.pointerId)}catch{};setFillActive(true)});quickFill.addEventListener('pointerup',endQuickFill);quickFill.addEventListener('pointercancel',endQuickFill);quickFill.addEventListener('lostpointercapture',endQuickFill);quickFill.addEventListener('keydown',event=>{if(event.repeat||!(event.key===' '||event.key==='Enter'))return;event.preventDefault();setFillActive(true)});quickFill.addEventListener('keyup',event=>{if(!(event.key===' '||event.key==='Enter'))return;event.preventDefault();endQuickFill()});performanceActions.append(quickHold,quickFill)
  const previewScenePatch=patch=>{interactionRevision+=1;state=engine.setSceneState(patch,{notify:false});syncUi();return state}
  const playMonitor=el('div','mav-arp-play-monitor'),playTop=el('div','mav-arp-play-top'),playBottom=el('div','mav-arp-play-bottom')
  const playRate=makeDragChoice({label:'RATE',values:PLICATA_ARP_DIVISIONS.map(row=>row.id),get:()=>state.division,set:value=>apply({division:value})})
  const playMode=makeDragChoice({label:'MODE',values:PLICATA_ARP_STYLES,get:()=>state.style,set:value=>apply({style:value}),format:labelStyle})
  const playOct=makeDragChoice({label:'OCT',values:OCTAVE_VALUES,get:()=>state.octaves,set:value=>apply({octaves:value}),format:value=>`${value}X`})
  const playGate=makeGestureControl({label:'GATE',minimum:.45,maximum:1,step:.01,get:()=>state.gate,set:value=>applyLivePerformancePatch({gate:value},{persist:false,replan:false}),format:labelPercent})
  const playSwing=makeGestureControl({label:'SWING',minimum:0,maximum:.65,step:.01,get:()=>state.swing,set:value=>applyLivePerformancePatch({swing:value},{persist:false,replan:false}),format:labelPercent})
  const playClock=makeDragChoice({label:'CLOCK',values:PLICATA_ARP_CLOCK_MODES,get:()=>state.clockMode,set:value=>apply({clockMode:value}),format:CLOCK_LABEL})
  const playRetrigger=makeDragChoice({label:'RETRIGGER',values:PLICATA_ARP_RETRIGGER,get:()=>state.retrigger,set:value=>apply({retrigger:value}),format:value=>value==='FIRST'?'FIRST':value})
  const playVelocity=makeDragChoice({label:'VELOCITY',values:PLICATA_ARP_VELOCITY_MODES,get:()=>state.velocityMode,set:value=>apply({velocityMode:value})})
  const playVelocityValue=makeGestureControl({label:'VALUE',minimum:0,maximum:127,getMaximum:()=>state.velocityMode==='FIX'?127:63,step:1,get:()=>state.velocityMode==='FIX'?state.fixedVelocity:state.accentAmount,set:value=>state.velocityMode==='FIX'?previewScenePatch({fixedVelocity:Math.max(1,value)}):applyLivePerformancePatch({accentAmount:Math.min(63,value)},{persist:false,replan:false}),format:value=>state.velocityMode==='FIX'?String(Math.max(1,Math.round(value))):`+${Math.min(63,Math.round(value))}`})
  const resetVisualWrap=el('div','mav-arp-choice'),resetVisualLabel=el('span','mav-arp-choice__label','PHASE'),resetVisual=el('button','mav-arp-reset-visual','RESET');resetVisual.type='button';resetVisual.setAttribute('aria-label','Reset arpeggiator phase');bindMultiTouchButton(resetVisual,()=>{engine.resetSequence();clearPlayhead();rearmScheduledClock()});resetVisualWrap.append(resetVisualLabel,resetVisual)
  playTop.append(playRate.node,playMode.node,playOct.node,playGate.node,playSwing.node);playBottom.append(playClock.node,playRetrigger.node,playVelocity.node,playVelocityValue.node,resetVisualWrap);playMonitor.append(playTop,playBottom);playPage.replaceChildren(playMonitor)
  const playVisualControls=[playRate,playMode,playOct,playGate,playSwing,playClock,playRetrigger,playVelocity,playVelocityValue]

  const patternStepState=(index=selectedPatternStep)=>state.pattern?.[index]||neutralPatternStep()
  const laneValue=(row,spec=patternLaneSpec(activePatternLane))=>spec.key==='enabled'?(row?.enabled===false?0:1):Number(row?.[spec.key]??neutralPatternStep()[spec.key])
  const laneNormalized=(row,spec=patternLaneSpec(activePatternLane))=>clamp((laneValue(row,spec)-spec.minimum)/Math.max(1e-9,spec.maximum-spec.minimum),0,1)
  const laneValueFromNormalized=(normalized,spec=patternLaneSpec(activePatternLane))=>{const t=clamp(normalized,0,1),raw=spec.minimum+t*(spec.maximum-spec.minimum),quantized=spec.quantize>0?Math.round(raw/spec.quantize)*spec.quantize:raw;return clamp(Number(quantized.toFixed(spec.quantize<1?4:0)),spec.minimum,spec.maximum)}
  const preparePatternBase=()=>{if(mutationActive)freezeMutation()}
  const updatePatternStepAt=(index,patch,{persist=false,refresh=false}={})=>{const step=Math.max(0,Math.min(PLICATA_ARP_PATTERN_STEPS-1,Math.round(Number(index)||0))),pattern=(state.pattern||[]).map(row=>({...neutralPatternStep(),...row}));while(pattern.length<PLICATA_ARP_PATTERN_STEPS)pattern.push(neutralPatternStep());pattern[step]={...pattern[step],...patch};applyPatternPatch({pattern},{persist,refresh:false});if(refresh)syncPatternMonitor(new Set([step]));return pattern[step]}
  const writePatternLaneNormalized=(index,normalized)=>{const spec=patternLaneSpec(activePatternLane),value=laneValueFromNormalized(normalized,spec),row=patternStepState(index),next=spec.key==='enabled'?value>=.5:value;if(spec.key==='enabled'){if((row.enabled!==false)===next)return next;updatePatternStepAt(index,{enabled:next})}else{if(Math.abs(Number(row[spec.key])-Number(next))<1e-9)return next;updatePatternStepAt(index,{[spec.key]:next})}return next}
  const setSelectedPatternStep=index=>{const previous=selectedPatternStep,next=Math.max(0,Math.min(PLICATA_ARP_PATTERN_STEPS-1,Math.round(Number(index)||0))),nextBank=Math.floor(next/16),bankChanged=nextBank!==patternBank;selectedPatternStep=next;if(bankChanged)patternBank=nextBank;if(bankChanged)syncPatternMonitor();else if(previous!==next)syncPatternMonitor(new Set([previous,next]));return next}
  const patternLaneButtons=new Map();for(const spec of PATTERN_LANES){const button=el('button','mav-arp32-lane',spec.id);button.type='button';button.dataset.lane=spec.id;button.setAttribute('aria-label',`Edit arpeggiator ${spec.id.toLowerCase()} lane`);bindMultiTouchButton(button,()=>{activePatternLane=spec.id;syncPatternMonitor()});patternLanes.append(button);patternLaneButtons.set(spec.id,button)}
  const patternBankButtons=[0,1].map(bank=>{const button=el('button','mav-arp32-bank',bank===0?'01–16':'17–32');button.type='button';button.dataset.bank=String(bank);button.setAttribute('aria-label',bank===0?'Show arpeggiator steps 1 to 16':'Show arpeggiator steps 17 to 32');bindMultiTouchButton(button,()=>{const previous=selectedPatternStep;patternBank=bank;if(selectedPatternStep<bank*16||selectedPatternStep>=bank*16+16)selectedPatternStep=bank*16;syncPatternMonitor(new Set([previous,selectedPatternStep]))});patternBanks.append(button);return button})
  const patternCells=Array.from({length:16},(_,slot)=>{const cell=el('button','mav-arp32-step'),meter=el('span','mav-arp32-step__meter'),fill=el('i',''),value=el('b','','0'),foot=el('span','mav-arp32-step__foot','');cell.type='button';cell.tabIndex=-1;cell.dataset.slot=String(slot+1);meter.append(fill,value);cell.append(meter,foot);cell._value=value;cell._foot=foot;patternGrid.append(cell);return cell})
  patternGrid.setAttribute('role','grid');patternGrid.setAttribute('tabindex','0');patternGrid.setAttribute('aria-label','PLICATA 32-step arpeggiator pattern. Drag vertically while moving horizontally to paint the selected relative lane.')
  const patternOp=(id,text,label)=>{const button=el('button','mav-arp32-op',text);button.type='button';button.dataset.op=id;button.setAttribute('aria-label',label);patternOps.append(button);return button}
  const copyPatternButton=patternOp('copy','COPY','Copy arpeggiator pattern'),pastePatternButton=patternOp('paste','PASTE','Paste arpeggiator pattern'),clearPatternButton=patternOp('clear','CLEAR','Reset arpeggiator pattern to neutral steps'),monitorRotateLeft=patternOp('rotate-left','ROT←','Rotate arpeggiator pattern left'),monitorRotateRight=patternOp('rotate-right','ROT→','Rotate arpeggiator pattern right'),monitorMutate=patternOp('mutate','MUTATE','Toggle temporary arpeggiator mutation'),monitorFreeze=patternOp('freeze','FREEZE','Freeze mutation into the saved arpeggiator state')
  bindMultiTouchButton(copyPatternButton,()=>{patternClipboard={pattern:state.pattern.map(row=>({...row})),patternLength:state.patternLength,patternRotation:state.patternRotation};syncPatternMonitor()})
  bindMultiTouchButton(pastePatternButton,()=>{if(!patternClipboard)return;preparePatternBase();applyPatternPatch({pattern:patternClipboard.pattern.map(row=>({...row})),patternLength:patternClipboard.patternLength,patternRotation:patternClipboard.patternRotation});syncPatternMonitor()})
  bindMultiTouchButton(clearPatternButton,()=>{preparePatternBase();applyPatternPatch({pattern:Array.from({length:PLICATA_ARP_PATTERN_STEPS},neutralPatternStep),patternRotation:0});syncPatternMonitor()})
  bindMultiTouchButton(monitorRotateLeft,()=>{preparePatternBase();rotatePattern(-1);syncPatternMonitor()});bindMultiTouchButton(monitorRotateRight,()=>{preparePatternBase();rotatePattern(1);syncPatternMonitor()});bindMultiTouchButton(monitorMutate,()=>{toggleMutation();syncPatternMonitor()});bindMultiTouchButton(monitorFreeze,()=>{freezeMutation();syncPatternMonitor()})
  function syncPatternPlayhead(){
    if(!isSurfacePresented())return arpPlayhead
    const visibleStart=patternBank*16
    for(let slot=0;slot<patternCells.length;slot+=1){const next=visibleStart+slot===arpPlayhead?'1':'0';if(patternCells[slot].dataset.playhead!==next)patternCells[slot].dataset.playhead=next}
    for(const button of patternBankButtons){const next=arpPlayhead>=Number(button.dataset.bank)*16&&arpPlayhead<Number(button.dataset.bank)*16+16?'1':'0';if(button.dataset.playing!==next)button.dataset.playing=next}
    const text=arpPlayhead>=0?`▶ STEP ${String(arpPlayhead+1).padStart(2,'0')}`:'■ STOP';if(patternPlayheadReadout.textContent!==text)patternPlayheadReadout.textContent=text
    return arpPlayhead
  }
  const syncPatternCell=(cell,index)=>{const row=patternStepState(index),spec=patternLaneSpec(activePatternLane),value=laneValue(row,spec),normalized=laneNormalized(row,spec),selected=index===selectedPatternStep,rest=row.enabled===false,outside=index>=state.patternLength,formatted=spec.format(value);cell.dataset.step=String(index);cell.dataset.selected=selected?'1':'0';cell.dataset.rest=rest?'1':'0';cell.dataset.outside=outside?'1':'0';cell.style.setProperty('--arp-step-fill',`${Math.round(normalized*100)}%`);if(cell._value.textContent!==formatted)cell._value.textContent=formatted;const foot=`${String(index+1).padStart(2,'0')} ${rest?'○':'●'}`;if(cell._foot.textContent!==foot)cell._foot.textContent=foot;cell.setAttribute('aria-label',`Step ${index+1} · ${rest?'REST':'ON'} · pitch ${signed(row.pitchOffset)} · octave ${signed(row.octaveOffset)} · velocity ${signed(row.velocityOffset)} · gate ${signedPercent(row.gateOffset)} · probability ${labelPercent(row.probability)} · ratchet R+${Math.max(0,Number(row.ratchet||1)-1)}${outside?' · outside current length':''}`)}
  function syncPatternMonitor(changedSteps=null){const start=patternBank*16,spec=patternLaneSpec(activePatternLane),selectedRow=patternStepState(selectedPatternStep),selectedValue=spec.format(laneValue(selectedRow,spec));patternBankReadout.textContent=`${patternBank===0?'01–16':'17–32'} · SEL ${String(selectedPatternStep+1).padStart(2,'0')} ${selectedValue}`;for(const [id,button] of patternLaneButtons)button.setAttribute('aria-pressed',String(id===activePatternLane));for(const button of patternBankButtons)button.setAttribute('aria-pressed',String(Number(button.dataset.bank)===patternBank));const length=Math.max(1,Math.min(PLICATA_ARP_PATTERN_STEPS,Number(state.patternLength)||8)),position=(length-1)/(PLICATA_ARP_PATTERN_STEPS-1)*100;patternLengthValue.textContent=String(length).padStart(2,'0');patternLengthFill.style.width=`${position}%`;patternLengthThumb.style.left=`${position}%`;patternLengthTrack.setAttribute('aria-valuenow',String(length));patternLengthTrack.setAttribute('aria-valuetext',`${length} active steps`);patternMonitorTitle.textContent=`ARP PATTERN · ${spec.id} · S${sceneBank.activeScene}`;for(let slot=0;slot<16;slot+=1){const index=start+slot;if(changedSteps&&changedSteps.size&&!changedSteps.has(index))continue;syncPatternCell(patternCells[slot],index)}pastePatternButton.disabled=!patternClipboard;monitorMutate.dataset.active=mutationActive?'1':'0';monitorFreeze.dataset.active=mutationActive?'1':'0';monitorFreeze.disabled=!mutationActive;syncPatternPlayhead()}
  let patternGestureBaseline=null
  const patternGesture=installStepLanePaintGesture(patternGrid,{visibleStepCount:16,totalSteps:PLICATA_ARP_PATTERN_STEPS,bankStart:()=>patternBank*16,selectedStep:()=>selectedPatternStep,setSelectedStep:setSelectedPatternStep,readNormalized:index=>laneNormalized(patternStepState(index)),writeNormalized:(index,normalized)=>writePatternLaneNormalized(index,normalized),toggleStep:index=>{if(activePatternLane!=='STATE')return setSelectedPatternStep(index);const row=patternStepState(index);return updatePatternStepAt(index,{enabled:row.enabled===false})},beginTransaction:meta=>{preparePatternBase();patternGestureBaseline=liveState();return api.beginTransaction?.(meta)??null},endTransaction:(transaction,outcome)=>{if(outcome==='commit')schedulePersist();patternGestureBaseline=null;if(transaction!==null&&transaction!==undefined)api.endTransaction?.(transaction,outcome)},onPreview:({changedSteps})=>syncPatternMonitor(changedSteps),onCancel:()=>{if(patternGestureBaseline)state=engine.setState(patternGestureBaseline,{notify:false,startScheduler:false});patternGestureBaseline=null;syncPatternMonitor()},transactionMeta:()=>({kind:'plicata-arp32-paint',lane:activePatternLane,bank:patternBank})})
  let lengthGesture=null
  const lengthFromPointer=event=>{const rect=patternLengthTrack.getBoundingClientRect(),t=clamp((Number(event.clientX)-rect.left)/Math.max(1,rect.width),0,1);return 1+Math.round(t*(PLICATA_ARP_PATTERN_STEPS-1))}
  const writePatternLength=event=>{const length=lengthFromPointer(event);if(length!==state.patternLength)applyPatternPatch({patternLength:length},{persist:false,refresh:false});syncPatternMonitor();return length}
  const endLengthGesture=(event,outcome='commit')=>{if(!lengthGesture||event?.pointerId!==undefined&&lengthGesture.pointerId!==event.pointerId)return;const completed=lengthGesture;lengthGesture=null;try{patternLengthTrack.releasePointerCapture?.(completed.pointerId)}catch{};if(outcome==='cancel')state=engine.setState(completed.baseline,{notify:false,startScheduler:false});else schedulePersist();if(completed.transaction!==null&&completed.transaction!==undefined)api.endTransaction?.(completed.transaction,outcome);syncPatternMonitor()}
  patternLengthTrack.setAttribute('role','slider');patternLengthTrack.setAttribute('aria-label','Arpeggiator pattern length');patternLengthTrack.setAttribute('aria-valuemin','1');patternLengthTrack.setAttribute('aria-valuemax',String(PLICATA_ARP_PATTERN_STEPS));patternLengthTrack.tabIndex=0
  patternLengthTrack.addEventListener('pointerdown',event=>{if(lengthGesture||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();preparePatternBase();lengthGesture={pointerId:event.pointerId,baseline:liveState(),transaction:api.beginTransaction?.({kind:'plicata-arp32-length'})??null};try{patternLengthTrack.setPointerCapture?.(event.pointerId)}catch{};writePatternLength(event)})
  patternLengthTrack.addEventListener('pointermove',event=>{if(lengthGesture?.pointerId!==event.pointerId)return;event.preventDefault();writePatternLength(event)})
  patternLengthTrack.addEventListener('pointerup',event=>{if(lengthGesture?.pointerId!==event.pointerId)return;event.preventDefault();writePatternLength(event);endLengthGesture(event,'commit')})
  patternLengthTrack.addEventListener('pointercancel',event=>endLengthGesture(event,'cancel'))
  patternLengthTrack.addEventListener('lostpointercapture',event=>endLengthGesture(event,'cancel'))
  patternLengthTrack.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();preparePatternBase();const transaction=api.beginTransaction?.({kind:'plicata-arp32-length-key'})??null,current=Math.max(1,Number(state.patternLength)||8),next=event.key==='Home'?1:event.key==='End'?PLICATA_ARP_PATTERN_STEPS:clamp(current+(event.key==='ArrowRight'||event.key==='ArrowUp'?1:-1),1,PLICATA_ARP_PATTERN_STEPS);applyPatternPatch({patternLength:next},{persist:false});if(transaction!==null&&transaction!==undefined)api.endTransaction?.(transaction,'commit');schedulePersist()})
  const perfButton=(text,label)=>{const button=el('button','mav-arp-command mav-arp-performance-command',text);button.type='button';button.setAttribute('aria-label',label);return button},rotateLeft=perfButton('ROT←','Rotate arpeggiator pattern left'),rotateRight=perfButton('ROT→','Rotate arpeggiator pattern right'),mutateButton=perfButton('MUTATE','Toggle temporary arpeggiator mutation'),freezeButton=perfButton('FREEZE','Freeze current mutation into the arpeggiator pattern'),fillButton=perfButton('FILL','Momentary arpeggiator fill')
  bindMultiTouchButton(rotateLeft,()=>{preparePatternBase();rotatePattern(-1)});bindMultiTouchButton(rotateRight,()=>{preparePatternBase();rotatePattern(1)});bindMultiTouchButton(mutateButton,()=>toggleMutation());bindMultiTouchButton(freezeButton,()=>freezeMutation())
  const endFill=()=>setFillActive(false);fillButton.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;event.preventDefault();try{fillButton.setPointerCapture(event.pointerId)}catch{};setFillActive(true)});fillButton.addEventListener('pointerup',endFill);fillButton.addEventListener('pointercancel',endFill);fillButton.addEventListener('lostpointercapture',endFill);fillButton.addEventListener('keydown',event=>{if(event.repeat||!(event.key===' '||event.key==='Enter'))return;event.preventDefault();setFillActive(true)});fillButton.addEventListener('keyup',event=>{if(!(event.key===' '||event.key==='Enter'))return;event.preventDefault();endFill()})
  const perfMonitor=el('div','mav-arp-perf-monitor'),perfStatus=el('div','mav-arp-perf-status'),perfStatusMain=el('span','','PERFORMANCE'),perfStatusKey=el('span','','KEYSWITCH'),sceneGrid=el('div','mav-arp-scenes'),perfValues=el('div','mav-arp-perf-values'),perfActions=el('div','mav-arp-perf-actions')
  perfStatus.append(perfStatusMain,perfStatusKey)
  const sceneButtons=Array.from({length:PLICATA_ARP_SCENE_COUNT},(_,index)=>{const scene=index+1,button=el('button','mav-arp-scene'),main=el('b','',`S${scene}`),small=el('small','','');button.type='button';button.dataset.scene=String(scene);button.append(main,small);button._keyswitch=small;button.setAttribute('aria-label',`Recall arpeggiator scene ${scene}`);bindMultiTouchButton(button,()=>activateArpScene(scene,{source:'ui'}));sceneGrid.append(button);return button})
  const perfProbability=makeGestureControl({label:'PROB',minimum:0,maximum:1,step:.01,get:()=>state.probability,set:value=>applyLivePerformancePatch({probability:value},{persist:false,replan:false}),format:labelPercent})
  const perfOctProbability=makeGestureControl({label:'OCT PROB',minimum:0,maximum:1,step:.01,get:()=>state.octaveProbability,set:value=>applyLivePerformancePatch({octaveProbability:value},{persist:false,replan:false}),format:labelPercent})
  const perfRatchet=makeGestureControl({label:'RATCH',minimum:1,maximum:4,step:1,get:()=>state.ratchet,set:value=>applyLivePerformancePatch({ratchet:value},{persist:false,replan:false}),format:value=>`${Math.round(value)}X`})
  const perfAccent=makeGestureControl({label:'ACCENT',minimum:0,maximum:63,step:1,get:()=>state.accentAmount,set:value=>applyLivePerformancePatch({accentAmount:value},{persist:false,replan:false}),format:value=>`+${Math.round(value)}`})
  const perfRotation=makeGestureControl({label:'ROT',minimum:0,maximum:31,getMaximum:()=>Math.max(0,Number(state.patternLength)-1),step:1,get:()=>((Number(state.patternRotation)||0)%Math.max(1,Number(state.patternLength)||1)+Math.max(1,Number(state.patternLength)||1))%Math.max(1,Number(state.patternLength)||1),set:value=>applyPatternPatch({patternRotation:Math.round(value)},{persist:false,refresh:false}),format:value=>String(Math.round(value))})
  const perfVisualControls=[perfProbability,perfOctProbability,perfRatchet,perfAccent,perfRotation];perfValues.append(...perfVisualControls.map(control=>control.node))
  const learnButton=perfButton('KS LEARN','Learn arpeggiator scene keyswitch base note and MIDI channel');learnButton.classList.add('mav-arp-keyswitch-learn');bindMultiTouchButton(learnButton,()=>setKeyswitchLearn(!keyswitchLearn))
  perfActions.append(rotateLeft,rotateRight,mutateButton,freezeButton,fillButton,learnButton);perfMonitor.append(perfStatus,sceneGrid,perfValues,perfActions);performancePage.replaceChildren(perfMonitor)
  root.insertBefore(holdWrap,controls[0].node);root.insertBefore(controls[2].node,moreWrap);root.append(advanced)

  function syncUi(){
    const s=liveState();selectedPatternStep=Math.max(0,Math.min(PLICATA_ARP_PATTERN_STEPS-1,selectedPatternStep));patternBank=Math.max(0,Math.min(1,patternBank));if(!s.enabled)arpPlayhead=-1;root.dataset.enabled=s.enabled?'1':'0';root.dataset.hold=s.hold?'1':'0';root.dataset.mutation=mutationActive?'1':'0';root.dataset.fill=fillActive?'1':'0';advanced.dataset.page=advancedPage;advancedStatus.textContent=s.enabled?`${CLOCK_LABEL(s.clockMode)} · ${s.style.replace('_',' ')} · ${s.division} · S${sceneBank.activeScene}`:`OFF · S${sceneBank.activeScene}`;more.title=s.enabled?`ARP ${CLOCK_LABEL(s.clockMode)} · ${s.style.replace('_',' ')} · ${s.division} · ${s.octaves} OCT`:'ARP detail';onButton.setAttribute('aria-pressed',String(s.enabled));holdButton.setAttribute('aria-pressed',String(s.hold));quickHold.setAttribute('aria-pressed',String(s.hold));quickHold.dataset.active=s.hold?'1':'0';quickFill.setAttribute('aria-pressed',String(fillActive));quickFill.dataset.active=fillActive?'1':'0';onRendered.setPressed(s.enabled);holdRendered.setPressed(s.hold);for(const control of controls)control.sync();gateControl.sync();swingControl.sync();retriggerControl.sync();clockControl.sync();probabilityControl.sync();octaveProbabilityControl.sync();ratchetControl.sync();velocityControl.sync();fixedVelocityControl.sync();accentControl.sync();for(const control of playVisualControls)control.sync();for(const control of perfVisualControls)control.sync();{const velocityValueVisible=s.velocityMode==='FIX'||s.velocityMode==='ACCENT';playVelocityValue.node.hidden=!velocityValueVisible;playBottom.style.gridTemplateColumns=`repeat(${velocityValueVisible?5:4},minmax(0,1fr))`;playVelocityValue.node.querySelector('.mav-arp-gesture__label').textContent=s.velocityMode==='FIX'?'FIX':'ACCENT';}chassisOctaveControl.sync();chassisGateControl.sync();chassisProbabilityControl.sync();chassisRatchetControl.sync();fixedVelocityControl.setEnabled(s.velocityMode==='FIX');accentControl.setEnabled(s.velocityMode==='ACCENT');pageButtons.forEach(button=>{const active=button.dataset.page===advancedPage;button.dataset.active=active?'1':'0';button.setAttribute('aria-selected',String(active))});playPage.hidden=advancedPage!=='PLAY';patternPage.hidden=advancedPage!=='PATTERN';performancePage.hidden=advancedPage!=='PERF';syncPatternMonitor();mutateButton.dataset.active=mutationActive?'1':'0';mutateButton.setAttribute('aria-pressed',String(mutationActive));mutateButton.title=mutationActive?'MUTATE active · press to return to base pattern':'Generate a temporary bounded mutation';freezeButton.disabled=!mutationActive;freezeButton.dataset.active=mutationActive?'1':'0';freezeButton.title=mutationActive?'Freeze this mutation into the saved ARP state':'Create a mutation first';fillButton.dataset.active=fillActive?'1':'0';fillButton.setAttribute('aria-pressed',String(fillActive));fillButton.title=fillActive?'FILL active':'Hold for momentary fill';const rotation=((Number(s.patternRotation)||0)%s.patternLength+s.patternLength)%s.patternLength;rotateLeft.title=`Rotate pattern left · current ${rotation}`;rotateRight.title=`Rotate pattern right · current ${rotation}`;performanceReadout.textContent=mutationActive?`MUTATION ${mutationSerial} · R${rotation}`:fillActive?`FILL · R${rotation}`:`PERFORMANCE · R${rotation}`;perfStatusMain.textContent=mutationActive?`MUTATION ${mutationSerial} · S${sceneBank.activeScene}`:fillActive?`FILL · S${sceneBank.activeScene}`:`SCENE S${sceneBank.activeScene} · ROT ${rotation}`;const ks=sceneBank.keyswitch;perfStatusKey.textContent=keyswitchLearn?`KS LEARN · ${keyswitchLearnStatus}`:`KS ${ks.baseNote} · ${ks.channel===null?'OMNI':`CH ${ks.channel+1}`}`;learnButton.dataset.active=keyswitchLearn?'1':'0';learnButton.setAttribute('aria-pressed',String(keyswitchLearn));sceneButtons.forEach((button,index)=>{const scene=index+1,label=plicataArpKeyswitchLabel(sceneBank,scene,state),parts=label.split(' · ');button._keyswitch.textContent=parts.slice(1).join(' · ');button.setAttribute('aria-pressed',String(scene===sceneBank.activeScene));button.setAttribute('aria-label',`${label} · recall arpeggiator scene`)})
  }

  const browserFallbackJson=key=>{try{for(const storageKey of [`trambustissimo.surface.${key}`,`trambustissimo.visual.mavis.${key}`]){const value=globalThis.localStorage?.getItem?.(storageKey);if(typeof value==='string'&&value)return value}}catch{}return null}
  const hydrate=async()=>{
    try{
      clearPerformance();const [reply,scenesReply]=await Promise.all([api.requestHostAction('state.load',{key:STATE_KEY}),api.requestHostAction('state.load',{key:SCENES_STATE_KEY})])
      const hostJson=reply?.accepted===true&&typeof reply.json==='string'&&reply.json?reply.json:null,fallbackJson=browserFallbackJson(STATE_KEY),json=hostJson||fallbackJson
      const scenesHostJson=scenesReply?.accepted===true&&typeof scenesReply.json==='string'&&scenesReply.json?scenesReply.json:null,scenesFallbackJson=browserFallbackJson(SCENES_STATE_KEY),scenesJson=scenesHostJson||scenesFallbackJson
      lastHydrateHostJson=hostJson;lastHydrateFallbackJson=fallbackJson;lastHydrateScenesHostJson=scenesHostJson;lastHydrateScenesFallbackJson=scenesFallbackJson;lastHydrateSource=hostJson?'host':fallbackJson?'browser-fallback':'default'
      const raw=json?JSON.parse(json):defaultPlicataArpState();state=engine.setState(raw,{notify:false})
      const embedded=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.scenes:null,rawScenes=scenesJson?JSON.parse(scenesJson):embedded
      sceneBank=rawScenes?normalizePlicataArpScenesState(rawScenes,state):defaultPlicataArpScenesState(state);sceneBank=replacePlicataArpScene(sceneBank,sceneBank.activeScene,state)
      hydrated=true;syncUi();void syncMidiCapture(state.enabled);syncClockDriver();markReady();return true
    }catch{
      lastHydrateSource='error';hydrated=true;state=engine.setState(defaultPlicataArpState(),{notify:false});sceneBank=defaultPlicataArpScenesState(state);syncUi();void syncMidiCapture(state.enabled);syncClockDriver();markReady();return false
    }
  }
  const onRestore=()=>void hydrate();if(restoreEvent)addEventListener(restoreEvent,onRestore)
  queueMicrotask(()=>void hydrate())
  syncUi()

  const routedTrigger=(commandId,payload={})=>{
    const id=String(commandId||'')
    if(id==='keyboard.noteOn'&&state.enabled){interactionRevision+=1;if(state.clockMode==='INTERNAL'&&internalNativeScheduling){const accepted=engine.physicalNoteOn({...payload,deferInternalSchedule:true});requestInternalReplan();return accepted}prepareScheduledEdit();const accepted=engine.physicalNoteOn(payload);rearmScheduledClock();return accepted}
    if(id==='keyboard.noteOff'&&state.enabled){const holdLatched=state.hold===true;if(state.clockMode==='INTERNAL'){const accepted=engine.physicalNoteOff(payload);if(!engine.heldCount){cancelInternalScheduledFuture();clearPlayhead()}else if(internalNativeScheduling&&!holdLatched)requestInternalReplan();return accepted}if(!holdLatched)prepareScheduledEdit();const accepted=engine.physicalNoteOff(payload);if(!engine.heldCount)clearPlayhead();if(!holdLatched&&engine.heldCount)rearmScheduledClock();return accepted}
    if(id==='keyboard.pitchBend'&&state.enabled){const ownerKey=String(payload?.ownerKey||''),bend=Number(payload?.bendSemitones)||0,range=Math.max(.01,Number(payload?.xBendRangeSemitones)||2);bendRouting.stored+=1;bendRouting.lastStored={ownerKey,note:Number(payload?.note),bendSemitones:bend,rangeSemitones:range};const storedInEngine=ownerKey?engine.updateHeldBend(ownerKey,bend,range):false;bendRouting.lastStored={...bendRouting.lastStored,storedInEngine};if(ownerKey&&engine.hasSoundingOwner(ownerKey)){bendRouting.forwarded+=1;bendRouting.lastForwarded={ownerKey,note:Number(payload?.note),bendSemitones:bend,rangeSemitones:range};return api.trigger(commandId,payload)}return true}
    if(id==='keyboard.noteHandoff'){if(state.enabled){if(state.clockMode==='INTERNAL'&&internalNativeScheduling){const accepted=engine.physicalNoteHandoff({...payload,deferInternalSchedule:true});requestInternalReplan();return accepted}prepareScheduledEdit();const accepted=engine.physicalNoteHandoff(payload);rearmScheduledClock();return accepted}const ownerKey=String(payload.ownerKey||''),fromNote=Number(payload.fromNote),toNote=Number(payload.note??payload.toNote),velocity=Number(payload.velocity)||108;const on=api.trigger('keyboard.noteOn',{note:toNote,ownerKey,velocity,pitch:payload.pitch,smartHandoff:true});const off=api.trigger('keyboard.noteOff',{note:fromNote,ownerKey,pitch:payload.fromPitch,smartHandoff:true});return on!==false&&off!==false}
    if(id==='runtime.panic'){clearPerformance();forceReleaseExternal();resetNativeSchedule({release:true,resetSequence:true});engine.panic();clearPlayhead();hostClockPlanned.length=0;hostCommittedPhase=engine.phaseSnapshot();midiClockPlanned.length=0;midiClockNextStepPulse=null;midiClockCommittedPhase=engine.phaseSnapshot();syncUi();return api.trigger(commandId,payload)}
    return api.trigger(commandId,payload)
  }

  const performanceMapEndpoints=Object.freeze([
    Object.freeze({endpointId:'arp.gate',label:'ARP · GATE',minimum:.45,maximum:1,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({gate:nearest(GATE_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
    Object.freeze({endpointId:'arp.swing',label:'ARP · SWING',minimum:0,maximum:.65,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({swing:nearest(SWING_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
    Object.freeze({endpointId:'arp.probability',label:'ARP · PROB',minimum:0,maximum:1,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({probability:nearest(PROBABILITY_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
    Object.freeze({endpointId:'arp.octaveProbability',label:'ARP · OCT PROB',minimum:0,maximum:1,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({octaveProbability:nearest(OCTAVE_PROBABILITY_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
    Object.freeze({endpointId:'arp.ratchet',label:'ARP · RATCHET',minimum:1,maximum:4,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({ratchet:nearest(RATCHET_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
    Object.freeze({endpointId:'arp.accent',label:'ARP · ACCENT',minimum:0,maximum:40,write:(value,context={})=>{const source=context.reason==='arp-source';return applyLivePerformancePatch({accentAmount:nearest(ACCENT_VALUES,value)},{persist:!source,replan:!source,sync:!source,markInteraction:!source})}}),
  ])
  const restoreArpState=(value,{persistAfter=false}={})=>{
    try{
      if(state.enabled)prepareScheduledEdit();clearPerformance();const wasEnabled=state.enabled
      const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{},embeddedScenes=source.scenes
      state=engine.setState(source,{notify:false})
      sceneBank=embeddedScenes?normalizePlicataArpScenesState(embeddedScenes,state):defaultPlicataArpScenesState(state);sceneBank=replacePlicataArpScene(sceneBank,sceneBank.activeScene,state)
      syncUi();if(state.enabled!==wasEnabled||state.enabled||keyswitchLearn)void syncMidiCapture(state.enabled||keyswitchLearn);syncClockDriver();if(persistAfter)schedulePersist();return true
    }catch{return false}
  }
  const applyPresetState=value=>restoreArpState(value,{persistAfter:true})
  const serializeSurfaceState=()=>({...liveState(),scenes:liveScenes()})

  const routedApi={}
  for(const property of Reflect.ownKeys(api)){const value=api[property];routedApi[property]=typeof value==='function'?value.bind(api):value}
  routedApi.trigger=routedTrigger
  const stopPresentation=subscribeSurfacePresentation(visible=>{if(visible&&!destroyed)syncUi()})

  return{
    node:root,
    performanceChassis,
    performanceActions,
    performanceMapEndpoints,
    currentSourceNote:()=>currentSourceNote!==null&&Number.isFinite(Number(currentSourceNote))?Number(currentSourceNote):null,
    api:routedApi,
    isEnabled:()=>state.enabled===true,
    serialize:serializeSurfaceState,
    serializeScenes:()=>liveScenes(),
    activateScene:(sceneNumber,context={})=>activateArpScene(sceneNumber,context),
    setKeyswitchLearn,
    whenReady:()=>readyPromise,
    applyPresetState,
    setMidiOutputConfig:value=>{const mode=['off','12tet','pitch-bend'].includes(String(value?.mode||''))?String(value.mode):midiOutputConfig.mode,bendRangeSemitones=[1,2,12,24].includes(Number(value?.bendRangeSemitones))?Number(value.bendRangeSemitones):midiOutputConfig.bendRangeSemitones;midiOutputConfig={mode,bendRangeSemitones};return{...midiOutputConfig}},
    restore:value=>restoreArpState(value,{persistAfter:false}),
    reset:()=>{clearPerformance();forceReleaseExternal();resetNativeSchedule({release:true,resetSequence:true});engine.panic();hostClockPlanned.length=0;midiClockPlanned.length=0;state=engine.setState(defaultPlicataArpState(),{notify:false});sceneBank=defaultPlicataArpScenesState(state);keyswitchLearn=false;keyswitchLearnStatus='READY';lastSceneRecall=null;syncUi();void syncMidiCapture(false);syncClockDriver();schedulePersist();return true},
    panic:()=>{clearPerformance();forceReleaseExternal();resetNativeSchedule({release:true,resetSequence:true});hostClockPlanned.length=0;midiClockPlanned.length=0;midiClockNextStepPulse=null;clearPlayhead();syncUi();return engine.panic()},
    closeAdvanced,
    destroy(){if(destroyed)return;stopPresentation();patternGesture.destroy();if(lengthGesture)endLengthGesture(null,'cancel');advanced.remove();clearPerformance();resetNativeSchedule({release:true,resetSequence:false});destroyed=true;clearTimeout(persistTimer);clearTimeout(midiPollTimer);clearTimeout(midiCaptureRetryTimer);clearTimeout(clockPollTimer);internalPollPending=false;midiCaptureDesired=false;midiCaptureGeneration+=1;midiCaptureActive=false;forceReleaseExternal();void api.requestHostAction('midi.arp.capture.set',{enabled:false}).catch?.(()=>{});removeEventListener('instrument-surface-midi-input',onSyntheticMidiInput);removeEventListener('ppw-android-midi-batch',onAndroidMidiBatch);if(restoreEvent)removeEventListener(restoreEvent,onRestore);removeEventListener('plicata-sub-detail-open',onSubDetailOpen);engine.destroy()},
    debugState:()=>({schema:'plicata-arpeggiator-surface-debug-v6',authority:PLICATA_ARP_SURFACE_AUTHORITY,state:liveState(),scenes:liveScenes(),sceneRuntime:{activeScene:sceneBank.activeScene,lastRecall:lastSceneRecall?{...lastSceneRecall}:null,keyswitchLearn,keyswitchLearnStatus,keyswitchHeld:[...keyswitchHeld]},hydrated,interactionRevision,currentSourceNote,patternMonitor:{schema:'plicata-arp32-monitor-v1',totalSteps:PLICATA_ARP_PATTERN_STEPS,visibleSteps:16,bank:patternBank,selectedPatternStep,activePatternLane,playhead:arpPlayhead,length:state.patternLength,clipboard:Boolean(patternClipboard),paintGesture:true,incrementalDom:true,directLength:true,legacySelectorEditor:false},bendRouting:{...bendRouting,lastStored:bendRouting.lastStored?{...bendRouting.lastStored}:null,lastForwarded:bendRouting.lastForwarded?{...bendRouting.lastForwarded}:null,lastStep:bendRouting.lastStep?{...bendRouting.lastStep}:null},performance:{mutationSerial,mutationActive,fillActive,mutationOverlay:mutationOverlay?{...mutationOverlay,pattern:mutationOverlay.pattern?.map(row=>({...row}))}:null,engineOverlay:engine.debug().performanceOverlay||null},hydrate:{source:lastHydrateSource,hostJsonBytes:lastHydrateHostJson?.length||0,fallbackJsonBytes:lastHydrateFallbackJson?.length||0,scenesHostJsonBytes:lastHydrateScenesHostJson?.length||0,scenesFallbackJsonBytes:lastHydrateScenesFallbackJson?.length||0},clock:{nativeScheduleAvailable,internalNativeScheduling,internalScheduleFrame,internalSampleRate,internalPlannedCount:internalClockPlanned.length,internalCommittedPhase:internalCommittedPhase?{...internalCommittedPhase}:null,hostNativeScheduling,midiNativeScheduling,midiClockRunning,midiClockPeriodLocked,midiClockPulsePosition,midiClockNextStepPulse,midiClockFramesPerPulse,midiClockTempo,midiPlannedCount:midiClockPlanned.length,hostPlannedCount:hostClockPlanned.length,hostScheduleEpoch,hostScheduleBeat,hostCommittedPhase:hostCommittedPhase?{...hostCommittedPhase}:null,midiClockCommittedPhase:midiClockCommittedPhase?{...midiClockCommittedPhase}:null},midi:{captureActive:midiCaptureActive,captureDesired:midiCaptureDesired,captureGeneration:midiCaptureGeneration,captureHandledGeneration:midiCaptureHandledGeneration,captureSyncPending:Boolean(midiCaptureSyncPromise),inputSequence:midiInputSequence,resetEpoch:midiResetEpoch,externalHeld:[...externalHeld.values()].map(row=>({ownerKey:row.ownerKey,channel:row.channel,note:row.note,velocity:row.velocity,pendingOff:row.pendingOff,pitch:row.pitch})),keyswitchHeld:[...keyswitchHeld],sustainChannels:[...sustainChannels],outputConfig:{...midiOutputConfig},config:midiConfig?{mode:midiConfig.mode,masterChannel:midiConfig.masterChannel,memberFirstChannel:midiConfig.memberFirstChannel,memberCount:midiConfig.memberCount,memberPitchBendRangeSemitones:midiConfig.memberPitchBendRangeSemitones,masterPitchBendRangeSemitones:midiConfig.masterPitchBendRangeSemitones}:null},engine:engine.debug()}),
  }
}
