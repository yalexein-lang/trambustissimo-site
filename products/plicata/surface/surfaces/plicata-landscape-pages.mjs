// The existing PERF/SYNTH switch is the only page owner. No additional navigation.
export function installLandscapePages(shell){
  let active=false;
  const update=()=>{
    if(!active)return;
    const page=shell.dataset.performanceMode==='1'?'keys':'synth';
    shell.dataset.landscapePage=page;
    shell.dispatchEvent(new CustomEvent('plicata-landscape-page-changed',{detail:{page}}));
  };
  addEventListener('plicata-performance-mode-changed',update);
  return {
    sync(next){
      if(active===next)return;
      active=next;
      shell.dataset.landscapePages=next?'1':'0';
      shell.dataset.landscapeWide=next?'1':'0';
      if(next)update();else delete shell.dataset.landscapePage;
    },
    destroy(){this.sync(false);removeEventListener('plicata-performance-mode-changed',update)}
  };
}
