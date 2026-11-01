"""Render/capture the on-foot hero through real controls, without loose chair layers.

Screenshots are evidence for anatomical/carrier review, not a claim that visual
quality can be decided by assertions. --desktop-only and --phones-only allow a
focused rerun without repeating unrelated scenarios.
"""
import argparse
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ENTRY = "autumn-v16.html"
SHOTS = ROOT / "screenshots" / "revision16"

CHAIR_DRAW_AUDIT = r"""(() => {
  window.__heroLooseChairDraws=[];
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const src=image?.src||'';
    if(this.canvas?.id==='game' && /(?:^|\/)baby_pose_idle\.webp(?:\?|$)/.test(src) && this.globalAlpha>.01){
      const area=window.BearlyVisits?.audit?.();
      // The original rear bicycle seat remains valid while riding/boarding.
      // A head-only likeness crop is valid; a whole seat cutout on foot is not.
      const whole=args.length<8 || (args[2]>=image.naturalWidth*.8 && args[3]>=image.naturalHeight*.8);
      if(area?.mode && area.mode!=='water' && !area.transition && whole)
        window.__heroLooseChairDraws.push({mode:area.mode,src,args,alpha:this.globalAlpha});
    }
    return original.call(this,image,...args);
  };
})();"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def read(page):
    return page.evaluate("BearlyVisits.audit()")


def ready(context, base, errors, failures):
    page = context.new_page()
    page.clock.install()
    page.add_init_script(CHAIR_DRAW_AUDIT)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "response",
        lambda response: failures.append((response.status, response.url))
        if response.status >= 400 else None,
    )
    page.goto(f"{base}/{ENTRY}")
    page.wait_for_function(
        "BearlyVisits.audit().artReady && BearlyAtlas.ready() && window.BearlyHeroRig?.ready?.()",
        timeout=60000,
    )
    # Pause in the near future to avoid racing the real clock between calls.
    page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
    page.locator("#introStart").click()
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)")
    page.clock.run_for(100)
    return page


def capture(page, name, detail=False, expected_pose=None):
    path = SHOTS / f"{name}.png"
    rig = page.evaluate("window.BearlyHeroRig.audit?.() ?? null")
    if rig:
        assert rig.get("integratedCarrier") is True, f"Carrier must belong to the authored hero pose: {rig}"
        if expected_pose:
            assert rig.get("pose") == expected_pose, f"Expected visible {expected_pose} pose: {rig}"
    if detail and not page.evaluate("innerWidth<1000"):
        # A direct browser clip of the rendered street, not an edited image.
        # Keep enough room for the complete standing bearer and both boots.
        box = page.locator(".canvas-wrap").bounding_box()
        page.screenshot(
            path=str(path),
            clip={
                "x": box["x"] + box["width"] * .20,
                "y": box["y"] + box["height"] * .25,
                "width": box["width"] * .48,
                "height": box["height"] * .72,
            },
        )
    else:
        page.locator(".canvas-wrap").screenshot(path=str(path))
    return path.name


def assert_no_loose_chair(page):
    draws = page.evaluate("window.__heroLooseChairDraws")
    assert not draws, f"Loose bicycle-seat baby cutout rendered on foot: {draws}"


def desktop(browser, base, errors, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = ready(context, base, errors, failures)
    page.keyboard.press("q")
    page.clock.run_for(2700)
    state = read(page)
    assert state["mode"] == "street" and state["baby"] == "front-carrier", state
    parked = state["parkedAt"]
    shots = [capture(page, "hero-front-idle")]

    # Observe both stance/swing combinations while moving. Screenshots let an
    # independent reviewer inspect the actual legs, pant openings and carrier.
    for key, heading in [("ArrowRight", "right"), ("ArrowLeft", "left")]:
        initial_x = read(page)["x"]
        seen = set()
        leads = set()
        page.keyboard.down(key)
        for _ in range(24):
            page.clock.run_for(40)
            state = read(page)
            gait = state["gait"]
            rendered = page.evaluate("BearlyHeroRig.audit()")
            landmarks = rendered.get("landmarks", {})
            if "near" in landmarks and "far" in landmarks:
                near_x = landmarks["near"]["sole"]["x"]
                far_x = landmarks["far"]["sole"]["x"]
                if abs(near_x - far_x) > .1:
                    leads.add("near" if near_x > far_x else "far")
            if gait["near"]["stance"] and not gait["far"]["stance"]:
                pose = "a"
            elif gait["far"]["stance"] and not gait["near"]["stance"]:
                pose = "b"
            else:
                continue
            if pose not in seen:
                shots.append(capture(page, f"hero-walk-{heading}-{pose}", detail=True))
                seen.add(pose)
            progress = (state["x"] - initial_x) * (1 if key == "ArrowRight" else -1)
            if len(seen) == 2 and leads == {"near", "far"} and progress > 15:
                break
        page.keyboard.up(key)
        page.clock.run_for(220)
        assert seen == {"a", "b"}, f"Both legs must swing when walking {heading}: {read(page)}"
        assert leads == {"near", "far"}, f"Actual rendered feet must exchange the lead when walking {heading}: {rendered}"
        assert (read(page)["x"] - initial_x) * (1 if key == "ArrowRight" else -1) > 15
        assert page.evaluate("BEARLY_TOUCH_STATUS().x") == parked, "The bicycle stays parked"

    page.keyboard.press("Space")
    page.clock.run_for(180)
    assert read(page)["jump"] > 25
    shots.append(capture(page, "hero-front-jump"))
    page.clock.run_for(800)
    assert read(page)["jump"] == 0

    # Check the larger indoor stature and an interaction as well as the street rig.
    page.evaluate("BEARLY_DEBUG_MENU.warp(15700/1.5)")
    page.clock.run_for(100)
    page.locator(".visit-prompt").click()
    page.clock.run_for(3200)
    assert read(page)["mode"] == "room" and read(page)["baby"] == "front-carrier"
    shots.append(capture(page, "hero-front-shop-idle"))
    page.keyboard.down("ArrowRight")
    page.clock.run_for(3700)
    page.keyboard.up("ArrowRight")
    page.clock.run_for(220)
    page.keyboard.press("e")
    page.clock.run_for(80)
    assert read(page)["quest"]["lunch"] and read(page)["baby"] == "front-carrier"
    shots.append(capture(page, "hero-front-shop-talk"))
    page.evaluate("BEARLY_DEBUG_MENU.warp(2500/1.5)")
    page.clock.run_for(100)
    page.keyboard.press("q")
    page.clock.run_for(2700)
    assert read(page)["mode"] == "street"

    page.evaluate("BearlyVisits.practice()")
    page.keyboard.press("j")
    page.clock.run_for(100)
    state = read(page)
    assert state["baby"] == "back-carrier" and state["combat"]["stats"]["mauls"] >= 1
    shots.append(capture(page, "hero-back-maul", expected_pose="maul"))
    page.keyboard.press("g")
    # Holding an NPC can begin during the maul's short follow-through. Capture
    # after that animation ends so the screenshot actually shows the grab pose.
    page.clock.run_for(450)
    assert read(page)["combat"]["held"]
    shots.append(capture(page, "hero-back-grab", expected_pose="grab"))
    page.keyboard.press("g")
    page.clock.run_for(1900)
    assert read(page)["baby"] == "back-carrier"
    shots.append(capture(page, "hero-back-idle"))
    page.keyboard.down("ArrowRight")
    page.clock.run_for(340)
    shots.append(capture(page, "hero-back-walk", detail=True))
    page.keyboard.up("ArrowRight")
    page.clock.run_for(200)

    # The original hostile crew supplies real projectiles, avoiding a synthetic
    # hit state that could miss the visible hurt/collapse/recovery path.
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=false;BEARLY_DEBUG_MENU.warp(3800/1.5)")
    page.clock.run_for(100)
    page.keyboard.press("q")
    page.clock.run_for(2300)
    saw_hurt = False
    saw_defeat = False
    for _ in range(160):
        page.clock.run_for(100)
        state = read(page)
        combat = state["combat"]
        if not saw_hurt and 0 < combat["hp"] < 100 and combat["hurt"]:
            shots.append(capture(page, "hero-front-hurt", expected_pose="frontHurt"))
            saw_hurt = True
        if combat["hp"] == 0:
            assert page.locator(".area-action").is_disabled()
            shots.append(capture(page, "hero-back-collapse", expected_pose="collapse"))
            page.clock.run_for(700)
            assert read(page)["combat"]["hp"] == 0
            shots.append(capture(page, "hero-back-defeated", expected_pose="defeated"))
            saw_defeat = True
            break
    assert saw_hurt and saw_defeat, read(page)
    assert read(page)["combat"]["stats"]["enemyShots"] >= 2
    page.clock.run_for(1500)
    assert read(page)["combat"]["hp"] == 100
    assert read(page)["baby"] == "front-carrier"
    # Recovery grants a brief immunity/hurt state; capture the neutral stance
    # after that transition, with further projectiles disabled by the debug flag.
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=true")
    page.clock.run_for(2200)
    assert read(page)["combat"]["hp"] == 100
    assert not read(page)["combat"]["hurt"]
    shots.append(capture(page, "hero-front-recovered", expected_pose="walking"))
    assert page.locator(".foot-heart").count() == 5
    assert_no_loose_chair(page)
    rig = page.evaluate("window.BearlyHeroRig.audit?.() ?? null")
    context.close()
    return {"screenshots": shots, "rig_audit": rig}


def touch_hold(context, page, selector, milliseconds):
    box = page.locator(selector).bounding_box()
    cdp = context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchStart", "touchPoints": [{
            "x": box["x"] + box["width"] / 2,
            "y": box["y"] + box["height"] / 2,
        }],
    })
    page.clock.run_for(milliseconds)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.clock.run_for(180)
    cdp.detach()


def phone(browser, base, errors, failures, width, height):
    context = browser.new_context(
        viewport={"width": width, "height": height}, is_mobile=True, has_touch=True,
    )
    page = ready(context, base, errors, failures)
    page.locator(".dismount-button").tap()
    page.clock.run_for(2700)
    assert read(page)["mode"] == "street" and read(page)["baby"] == "front-carrier"
    assert page.locator(".foot-heart").count() == 5
    assert page.locator(".canvas-wrap").bounding_box()["height"] >= height - 2
    for selector in [".area-jump", ".area-grab", ".area-maul", '[data-direction="1"]', ".area-exit"]:
        box = page.locator(selector).bounding_box()
        assert box and box["x"] >= 0 and box["y"] >= 0
        assert box["x"] + box["width"] <= width + 1 and box["y"] + box["height"] <= height + 1, (selector, box)
    shots = [capture(page, f"hero-phone-front-{width}")]
    before = read(page)["x"]
    touch_hold(context, page, '[data-direction="1"]', 650)
    assert read(page)["x"] > before + 70
    page.locator(".area-jump").tap()
    page.clock.run_for(160)
    assert read(page)["jump"] > 20
    page.clock.run_for(750)
    assert read(page)["jump"] == 0
    page.evaluate("BearlyVisits.practice()")
    page.locator(".area-maul").tap()
    page.clock.run_for(90)
    assert read(page)["baby"] == "back-carrier"
    shots.append(capture(page, f"hero-phone-back-maul-{width}", expected_pose="maul"))
    page.locator(".area-grab").tap()
    page.clock.run_for(450)
    assert read(page)["combat"]["held"]
    shots.append(capture(page, f"hero-phone-back-grab-{width}", expected_pose="grab"))
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert_no_loose_chair(page)
    context.close()
    return shots


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--desktop-only", action="store_true")
    modes.add_argument("--phones-only", action="store_true")
    options = parser.parse_args()
    if not (ROOT / ENTRY).is_file():
        raise SystemExit(f"Hero regression needs {ENTRY} and the V11 hero assets first.")
    SHOTS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failures, evidence = [], [], {}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            base = f"http://127.0.0.1:{server.server_port}"
            if not options.phones_only:
                evidence["desktop"] = desktop(browser, base, errors, failures)
            if not options.desktop_only:
                evidence["phones"] = {
                    str(width): phone(browser, base, errors, failures, width, height)
                    for width, height in [(390, 844), (844, 390)]
                }
            browser.close()
        assert not errors, errors
        assert not failures, failures
        print(json.dumps({"result": "passed", "evidence": evidence, "checks": [
            "real movement/jump/combat controls", "integrated carrier poses",
            "no separate on-foot bicycle-seat baby cutout", "no page or HTTP errors",
        ]}, indent=2))
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
