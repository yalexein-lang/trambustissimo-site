import {installLandscapePages} from './plicata-landscape-pages.mjs'
import {installKeyboardDetails} from './plicata-keyboard-details.mjs'
const activeTemplates=new Map();
// Experimental presentation owner. The original gesture/state/DSP owners are retained.
// Host bounds are applied synchronously and deduplicated. No delayed second layout.
export function attachMoogHardwareTemplate({root,shell,slug='',inventory={}}={}) {
  for(const [owner,dispose] of activeTemplates)if(!owner.isConnected)dispose();
  const host=document.createElement('div');host.className='moog-template-host';
  host.dataset.templateSlug=slug;host.dataset.hardwareTemplate='moog-hardware-template-v1';
  shell.classList.add('moog-template-shell');shell.dataset.hardwareTemplate='moog-hardware-template-v1';
  shell.dataset.plicataExperiment='1';host.append(shell);root.append(host);
  const select=document.querySelector('#experimentLayout'),output=document.querySelector('#experimentFormat'),externalResize=document.body.dataset.plicataNativeViewport==='1';
  const requested=new URLSearchParams(location.search).get('layout')||'auto';
  if(select&&['auto','medium','fullscreen','mobile'].includes(requested))select.value=requested;
  let destroyed=false,frame=0,lastKey='',mode='expanded',layout='medium',scale=1,keyboardMeta=null,presetAnchor=null,statusAnchor=null,presetActions=null,presetShell=null,presetMonitor=null,keyboardPresentation=null,landscapePages=null;
  const apply=(viewport)=>{
    if(destroyed)return;
    const subtitle=shell.querySelector('.mav-title p');if(subtitle&&subtitle.textContent!=='MONO PATCH SYNTH')subtitle.textContent='MONO PATCH SYNTH';
    const choice=select?.value||'auto',width=Number(viewport?.width)||root.clientWidth||innerWidth,height=Number(viewport?.height)||Number(document.body.dataset.plicataPreviewHeight)||innerHeight;
    const available=(externalResize||document.body.dataset.plicataNativePreview)?height:Math.max(1,height-host.getBoundingClientRect().top-18);
    layout=choice==='auto'?(width>=960&&available>=650?'fullscreen':width<900?'small':'medium'):choice==='mobile'?'small':choice;
    const fixed=layout==='medium'||layout==='small';
    const controls=shell.querySelector('.mav-keyboard-control-row'),globals=shell.querySelector('.mav-keyboard-global-controls');
    const paged=fixed;
    const key=`${layout}:${width}:${height}`;if(key===lastKey&&keyboardPresentation)return;lastKey=key;
    if(controls&&globals&&!keyboardPresentation){keyboardMeta ||= shell.querySelector('.mav-keyboard-meta');if(layout==='medium'){if(globals.parentNode!==keyboardMeta)keyboardMeta.append(globals)}else if(globals.parentNode!==controls)controls.append(globals)}
    // Reparent existing presentation nodes only when changing format.
    // Their original controls, listeners and state owners remain attached.
    const top=shell.querySelector('.mav-top'),tools=shell.querySelector('.mav-top-tools'),title=shell.querySelector('.mav-title'),preset=shell.querySelector('.mav-preset'),status=shell.querySelector('.moog-hardware-status-zone');
    if(top&&tools&&title&&preset&&status){
      if(layout==='mobile'){
        if(preset.parentNode===tools){presetAnchor=preset.nextSibling;top.append(preset)}
        if(status.parentNode===tools){statusAnchor=status.nextSibling;title.append(status)}
      }else{
        if(preset.parentNode!==tools)tools.insertBefore(preset,presetAnchor?.parentNode===tools?presetAnchor:null);
        if(!status.closest('.experiment-header-detail')&&status.parentNode!==tools)tools.insertBefore(status,statusAnchor?.parentNode===tools?statusAnchor:null);
      }
    }
    if(tools&&preset){
      presetShell ||= preset.querySelector('.mav-preset__shell');
      presetMonitor ||= preset.querySelector('.moog-preset__monitor');
      if(presetShell&&presetMonitor){
        if(layout==='mobile'&&width<420){
          if(!presetActions){presetActions=document.createElement('div');presetActions.className='experiment-preset-actions';presetActions.setAttribute('aria-label','Preset navigation');tools.prepend(presetActions)}
          for(const button of presetShell.querySelectorAll('.mav-preset__step,.mav-preset__random'))presetActions.append(button);
        }else if(presetActions){
          const previous=presetActions.querySelector('[data-hardware-function="preset-previous"]');
          const next=presetActions.querySelector('[data-hardware-function="preset-next"]');
          const generate=presetActions.querySelector('[data-hardware-function="preset-generate"]');
          if(previous)presetShell.insertBefore(previous,presetMonitor);
          if(next)presetShell.append(next);if(generate)presetShell.append(generate);
          presetActions.remove();presetActions=null;
        }
      }
    }
    keyboardPresentation ||= installKeyboardDetails(shell);
    keyboardPresentation?.setLayout(layout);
    for(const svg of shell.querySelectorAll('.mav-serpentine-key__svg'))svg.setAttribute('preserveAspectRatio',layout==='mobile'?'xMidYMid meet':'none');
    mode='expanded';
    shell.dataset.layout=mode;shell.dataset.plicataLayout=fixed?'medium':layout;
    shell.dataset.patchDensity=fixed?'regular':height<800?'compact':'regular';
    shell.dataset.templateScale='1';host.dataset.templateMode='responsive';
    host.style.width='';host.style.maxWidth='';host.style.height='';shell.style.transform='';
    scale=1;
    shell.dataset.fixedLandscape=fixed?'1':'0';shell.dataset.fullscreenCompact=available<850?'1':'0';
    landscapePages ||= installLandscapePages(shell);
    const logicalWidth=1080,logicalHeight=500;
    scale=fixed?Math.min(width/logicalWidth,available/logicalHeight):1;
    host.style.setProperty('width',fixed?`${logicalWidth*scale}px`:'',fixed?'important':'');
    host.style.setProperty('max-width',fixed?'none':'',fixed?'important':'');
    host.style.setProperty('height',fixed?`${logicalHeight*scale}px`:'',fixed?'important':'');
    host.style.marginInline=fixed?'auto':'';host.style.setProperty('display',fixed?'block':'',fixed?'important':'');host.style.overflow=fixed?'hidden':'';
    shell.style.setProperty('--experiment-scale',String(scale));
    shell.style.width=fixed?`${logicalWidth}px`:'';
    shell.style.transformOrigin='0 0';shell.style.transform=fixed?`scale(${scale})`:'';
    shell.style.setProperty('--experiment-panel-height',`${fixed?logicalHeight:Math.max(580,available)}px`);
    shell.style.setProperty('--experiment-dial-size',`${fixed?52:Math.max(48,Math.min(68,width/20,available/13))}px`);
    shell.style.setProperty('--experiment-key-height','140px');
    landscapePages?.sync(paged);
    document.body.dataset.plicataLayout=layout;
    shell.setAttribute('aria-label',`PLICATA ${layout} experimental workspace`);
    if(output)output.textContent=`${layout==='fullscreen'?'iPad / fullscreen':layout==='small'?'Landscape piccolo':'Landscape medio'} · ${Math.round(width)} × ${height}`;
  };
  let settledRevision=0;
  const resize=viewport=>{
    if(destroyed)return;
    // Commit geometry once for each distinct host size, before paint.
    // A host drag-end is not observable here; a quiet timer must not introduce
    // a second layout after the last bounds notification.
    const previous=lastKey;
    apply(viewport);
    if(lastKey!==previous){
      settledRevision++;
      shell.dispatchEvent(new CustomEvent('plicata-presentation-settled',{detail:{revision:settledRevision}}));
    }
  };
  const schedule=()=>resize();
  const observer=externalResize?null:new ResizeObserver(schedule);observer?.observe(root);
  if(!externalResize){addEventListener('resize',schedule,{passive:true});visualViewport?.addEventListener('resize',schedule,{passive:true});}
  const selectLayout=()=>{lastKey='';resize()};
  select?.addEventListener('change',selectLayout);apply();
  const dispose=()=>{if(destroyed)return;landscapePages?.destroy();keyboardPresentation?.destroy();destroyed=true;observer?.disconnect();if(frame)cancelAnimationFrame(frame);removeEventListener('resize',schedule);visualViewport?.removeEventListener('resize',schedule);select?.removeEventListener('change',selectLayout);activeTemplates.delete(shell)};
  activeTemplates.set(shell,dispose);
  return {
    resize,
    debugState(){return{schema:'plicata-responsive-experiment-v1',mode,layout,scale,logicalWidth:root.clientWidth,resizePhase:'settled',settledRevision,inventory}},
    destroy:dispose
  };
}
