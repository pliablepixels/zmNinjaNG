# Experiences in migrating zmNinja from AngularJS to React

[zmNinja](https://zmninja.zoneminder.com/) is a popular cross platform app (Desktop/iOS/Android) for [ZoneMinder](https://zoneminder.com/) (Open Source Home Security System) with 100K+ users. I built this over a couple of years. It is built with AngularJS, ionicv1 and cordova. These technologies have long been deprecated and its been a pain to keep the app updated. I have since moved on from thep project and the developers of ZoneMinder have found it to be hard to maintain.

Over the last 2 days, I used Claude CLI to refactor the old zmNinja to zmNinjaNG - a complete ground up rewrite of the old zmNinja to a modern react based ecosystem. 

## Quick summary of Before/After

Refer to more detailed information [here](COMPARISON.md)

Overall, zmNinja was a massive monolith with repeated code that grew over time. I had no time to re-write it. Claude did an excellent job modularizing and completely rewriting it

| Metric | zmNinja | zmNinjaNG | Reduction |
|--------|---------|------|-----------|
| **JavaScript/TypeScript** | ~28,000 LOC | ~11,014 LOC | **61% less** |
| **Templates/JSX** | ~3,000 LOC | (integrated) | Unified |
| **Styles (CSS/SCSS)** | ~650 LOC | ~300 LOC | **54% less** |
| **Total Source Code** | **~31,650 LOC** | **~11,314 LOC** | **65% less** |
| **Source Files** | 79 files | 67 files | **15% fewer** |
| **Cordova/Capacitor Plugins** | 26 plugins | 2 plugins | **92% fewer** |


## How I approached it

zmNinja is a reasonably complex app. It handles video streams (MJPEG, HLS, other formats), deals with goofy ZoneMinder nuances (CakePHP API) , has to deal with multi-profile cache/state management, does multi-channel notifications, has multiple views with drag&drop and more. ZoneMinder itself is a full featured NVR system that handles multi-server situations that requires clients to adapt. Further, MJPEG and Single Page Apps (SPAs) have a painful memory management issue where streams continue to operate when views change, causing memory build up. 

So here is what I did:
- I wrote up a [instruction set](ORIGINAL_CLAUDE.md) to get it started, which essentially described the problems with zmNinja
- I also downloaded the [ZM API documents](https://zoneminder.readthedocs.io/en/latest/api.html), and the old[zmNinja code](https://github.com/ZoneMinder/zmNinja)
- I then asked the agent to refactor and asked it to make its own tech stack choice. I was quite happy with the choices (reactive/capacitor)
- Finally, given this (very) complex restructure, I wasn't going to wait around hitting 'y' to every prompt. I ran AG in 'agent first' mode and Claude using `claude --dangerously-skip-permissions`

## Horse-Racing Anti Gravity (Gemini3) and Claude CLI (Auto models)

AntiGravity (AG) is the new Google IDE that was launched a few weeks ago. It seems to be based off WindSurf but adds some interesting integrated UI tests that are useful for UI heavy apps. Given zmNinja is very heavy on UI, I wanted to see how AG would measure up

| Activity | Claude CLI | Anti-Gravity (AG) | Winner |
|----------|------------|-------------------|--------|
| Initial framing | Claude did an excellent job setting up a layout of the app. It did not work out of the box, but after maybe 30 mins of tuning/pasting error logs, I had around 50% of the app functionality baked in. Even though I asked it to deep dive into my old code and extract all the functionality, it picked up the main ones (montage/monitors/settings/events) but not the nuanced ones like timeline/etc | I passed the same instructions to AG. It also selected react, but went with some other choices for the desktop stack - forgot. Overall, I spent around an hour trying to get it to work but I kept getting error after error. Gave up | Claude |
| Test setup | Claude setup Playwright and wrote out e2e test cases. Oddly it did not write unit test cases until I prompted it later | This is where I though AG would shine because it has an integrated browser plugin. However, this application has complex screens with transitions, toast popups et al. AG wasn't able to control the UI effectively. It kept entering duplicate characters into text boxes, did not time the transition intercepts correctly and keep waiting for results. Overall I gave up and went back to Claude | Claude |
| Test Execution (MCP vs no MCP) | Playwright is great, it has the ability to record screens, show visuals and either run in headless or headed(?) mode. I also configured the MCP playwright server as it allows better interactive testing. However, I realized that it was chomping on my tokens a lot more. I turned it off. When I searched around later, I noticed a lot of users complained about the chattiness of MCP as a protocol and were facing exactly this problem || Not using MCP saved me money |
| Simple feature adds | Claude was easily able to add features, ran tests and made sure everything worked | AG also did a good job, ran tests, all good | Same |
| Complex Feature Add | Claude was able to cross reference old code, read web documents and create excellent, modular code. A good example was handling the nuances of ZoneMinder API - it has a weird syntax to apply API filters. Claude figured that out and only got the data the app needed vs getting everything from the server and then doing client side filtering | AG on the other hand did not dive that deep into the API and zmNinja code - it would get, for example, all events (100MB+) and then sort out what it needed locally. If I hinted more, it got it. Overall though AG also did complex feature adds well, just not as well as Claude | Claude |
| Overall code stability | Almost always, Claude got code right, tests right | AG, not so much. I'd put it very similar to WindSurf. Stuff would keep breaking, it would run tests, go fix etc. Overall, it worked at the end of the day, but I wasted much more time. Honestly by this stage, I pretty much reverted/used Claude CLI for 80% of my things and I'd fall back to AG only if I exhausted quota. For example, it took AG 6-7 prompts to fix a rendering max-depth error. It finally got it, but Claude took 1 try. | Claude |
| Code Review | This was interesting. I pit one against the other. I asked AG to review Claude's code. It gave Claude a "B-" for several reasons. I then asked Claude to respond to the review and it was really funny. Claude hit back, but largely right. It gave the review a "B-" and explained why, while accepting some suggestions. See the fun [here](Claude_Code_Review_Response.md). I added my comments there as well | See notes on the left | Claude's own review of its code was better than AG's review of Claude Code |
| Cost | I spent around $50 over two days starting from 0 to a well written largely prod ready zmNinja replacement. I kept hitting 5 hr limits multiple times a day, prompting me to add more money | N/A - I did not pay as it did not perform nearly as well | Was $50 worth it for 2 days? zmNinja took me months to develop (not a fair comparison, as I was learning), but I know there was no way I could have developed this much over 2 days. I'd say it was significantly worth it |
| Performance | Claude was pretty good. The home version is quite fast | AG was much faster | AntiGravity (but I'll say Claude's performance was not limiting) |
| Experience without human intervention | At no stage did Claude make any mistakes or have any hallucinations. Nothing was deleted, nothing untoward was edited | Same but I did not use it as much | Claude (simplly because I used it 10x more than AG w/o issues) |
| Dump logs when things don't work and let agents figure things out | My workflow consists of dumping logs when stuff doesn't work and let agents figure things out. Claude does really well here | AG in general was similar to WS, which means at times it got it right, at times it kept trying to fix to no avail | Claude |
| Paste images with visuals to fix | Claude intelligently parses images and figures out problems - like aligning edges/overflows etc | AG also does this well | Same |
| Subsequent features (with the app in good shape) | Claude was able to add features, run tests, make sure everything worked | AG also did a good job, ran tests, all good | Same |
| Image Generation (app icon) | Claude doesn't generate great images. It writes code to generate SVGs and then converts to PNGs or other format. BTW I also tried on Cursor/WS/Copilot - all terrible | Excellent. AG nailed a professional icon the way I described | AntiGravity |

