"""Explicit full-art setup for renderer/adventure labs, never startup metrics.

Production intentionally loads distant scenery and on-foot/combat resources only
when requested. Existing coverage labs need the whole catalog before inspecting
all source pixels or timing already-warm street routines. The navigation test
browser_startup.py must not call this helper.
"""


def prepared_ready(expression):
    return """() => {
      if(!window.BearlyVisits?.prepareAll||!window.BearlyNpcMotion?.preloadAll||!window.BearlyWorld?.prepareAll)return false;
      if(!window.__bearlyFullArtFixture){
        const state=window.__bearlyFullArtFixture={done:false,error:null};
        (async()=>{
          await BearlyVisits.prepareAll();
          await BearlyBrawlArt.prepare();
          await BearlyNpcMotion.loaded;
          await BearlyNpcMotion.preloadAll();
          await BearlyWorld.prepareAll();
          state.done=true;
        })().catch(error=>{state.error=String(error);});
      }
      const state=window.__bearlyFullArtFixture;
      if(state.error)throw Error('Full art fixture: '+state.error);
      return state.done&&("""+expression+""");
    }"""
