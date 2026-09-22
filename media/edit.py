"""Threshold narrated video: only actual captured prototype UI, with edit log."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import subprocess
import textwrap

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'raw/rendered';OUT.mkdir(parents=True,exist_ok=True)
DURATION=106.0
fontpath='/System/Library/Fonts/Supplemental/Arial.ttf'
fonts={s:ImageFont.truetype(fontpath,s) for s in (15,16,19,30)}
# scene, output duration, source speed. Recording content is chronological;
# final holds support narration and slow model/scroll waits may be accelerated.
settings=[(1,22.6,1),(2,9.1,1),(3,15.2,1),(4,9.0,1.25),(5,11.45,1),(6,5.95,1.85),(7,4.4,1.5),(8,15.1,1),(9,13.2,1)]
segments=[];time=0.
for scene,total,speed in settings:
 source=json.loads((ROOT/f'raw/scene{scene}/frames.json').read_text())
 # First three scene2 captures occurred during a viewport resize and do not
 # represent app actions. Preserve the substantive recording from frame3.
 kept=[(i,item) for i,item in enumerate(source) if not(scene==2 and i<3)]
 consumed=0.
 for pos,(index,item) in enumerate(kept):
  if pos==len(kept)-1: duration=total-consumed
  else: duration=(source[index+1]['t']-item['t'])/speed
  if duration<=0: raise ValueError((scene,duration))
  segments.append({'scene':scene,'frame':item['name'],'start':round(time,6),'duration':round(duration,6),'source_timestamp':item['t'],'source_speed':speed})
  time+=duration;consumed+=duration
assert abs(time-DURATION)<.001,time
cards=[
 (0,13.8,'01 / A SHARED MORNING','“Get us out the door for the library by 08:30.”','A household plan with owners, dependencies and room for real life.'),
 (13.8,22.6,'02 / REMEMBER THE LITTLE THINGS','Step-free for Sam. Quiet cues for Jo.','Tasks get an owner. Independent work can happen together.'),
 (22.6,31.7,'03 / CONFIRM WHAT ACTUALLY HAPPENED','A plan is not a completion claim.','Water and books unlock the shared bag. People confirm each completed task.'),
 (31.7,46.9,'04 / THE ELEVATOR IS OUT','Keep the step-free route. Keep completed work.','Garden ramp: 7 minutes instead of 3. The plan preserves confirmed tasks.'),
 (46.9,55.9,'05 / NOW IT IS RAINING','A new dependency. A new readiness check.','The rain cover joins the plan. Readiness waits for human confirmation.'),
 (55.9,67.35,'06 / HAND OVER THE REMAINING WORK','Alex can take over Sam’s remaining tasks.','Ownership changes. One person still cannot do two jobs at once.'),
 (67.35,73.3,'07 / A GENTLER WAY TO GO','A warm visual cue. No sound.','The hallway lamp is virtual. This action can be undone.'),
 (73.3,77.7,'08 / NOTHING HAPPENS INVISIBLY','Undo the cue. Keep the receipt.','The original action and its reversal remain in the audit trail.'),
 (77.7,92.8,'09 / THE WORK BEHIND THE CALM','Real MCP. Inspectable actions.','Streamable HTTP · revision checks · retry protection · persistent context.'),
 (92.8,106,'THRESHOLD','A little less to carry.','A way forward together. Working prototype; synthetic household and virtual devices.'),
]
concat=[];renders=[]
for seg in segments:
 start,end=seg['start'],seg['start']+seg['duration']
 for card in cards:
  a,b=max(start,card[0]),min(end,card[1])
  if b-a<.000001: continue
  path=ROOT/f"raw/scene{seg['scene']}/{seg['frame']}"
  im=Image.open(path).convert('RGB').resize((1728,972),Image.Resampling.LANCZOS)
  canvas=Image.new('RGB',(1920,1080),'#f5f4ee');canvas.paste(im,(96,0))
  d=ImageDraw.Draw(canvas);d.rectangle((0,972,1920,1080),fill='#233c31');d.rectangle((0,972,1920,974),fill='#abb58a')
  d.text((60,987),card[2],font=fonts[16],fill='#c8d4b6')
  badge='ALEXA+ SIMULATOR · REAL MCP · SYNTHETIC HOUSEHOLD · VIRTUAL DEVICES'
  d.text((1860-d.textlength(badge,font=fonts[15]),988),badge,font=fonts[15],fill='#d8dfce')
  d.text((60,1011),card[3],font=fonts[30],fill='#fffdf6')
  d.text((60,1050),card[4],font=fonts[19],fill='#e4e8df')
  target=OUT/f'{len(renders):04d}.jpg';canvas.save(target,quality=95,subsampling=0)
  concat.extend([f"file '{target}'",f'duration {b-a:.6f}'])
  renders.append({**seg,'output_start':round(a,6),'output_duration':round(b-a,6),'caption':card[3]})
concat.append(f"file '{target}'")
(OUT/'frames.ffconcat').write_text('ffconcat version 1.0\n'+'\n'.join(concat)+'\n')
# Caption sentence groups aligned to pauses in the supplied final narration.
cues=[
 (.05,2.6027,'Get us out the door for the library by 08:30.'),
 (3.2334,5.9602,'Getting a household out the door is rarely one task.'),
 (6.3309,9.4072,'Someone carries the plan, the exceptions, and the reminders.'),
 (10.1554,11.6143,'Threshold shares that load.'),
 (12.2914,16.3729,'It remembers that Sam needs a step-free exit and Jo prefers a quiet cue.'),
 (16.9486,20.438,'It gives each small job an owner and works out what can happen together.'),
 (21.0938,22.9503,'A plan is not proof something happened.'),
 (23.9682,29.5486,'People confirm completed tasks. The shared bag becomes available only when its prerequisites are done.'),
 (30.205,33.7888,'The lift has stopped working. Find another way that keeps us step-free.'),
 (34.4363,35.886,'Now real life changes.'),
 (36.3838,44.9136,'The elevator is out. Threshold moves to the garden ramp, adds the extra time, and keeps both the accessibility preference and the work already done.'),
 (45.475,46.3692,'It is raining now.'),
 (46.7302,49.6882,'Rain adds a dependency the original plan did not have.'),
 (50.3119,53.5979,'The household cannot be marked ready until the new step is confirmed.'),
 (54.4907,56.8389,'Alex can take over Sam’s remaining tasks.'),
 (57.2169,60.7375,'A caregiver can hand over the remaining work without retelling the morning.'),
 (61.3568,65.1096,'The schedule still respects that one person cannot do two jobs at once.'),
 (65.8905,68.2099,'Make the hallway glow gently without a sound.'),
 (68.8351,71.3503,'A gentle visual cue appears on the virtual lamp.'),
 (71.7478,74.3304,'It is reversible. Every change leaves a receipt.'),
 (74.9643,80.1498,'Behind this simulated Alexa-plus experience is a real, self-hosted MCP server.'),
 (80.8168,83.9412,'The official SDK handles Streamable HTTP.'),
 (84.6331,90.5715,'Revisions prevent stale actions, retries do not double-execute, and context survives a restart.'),
 (91.335,91.9168,'Threshold.'),
 (92.3956,97.7098,'A little less to carry, and a way forward together.'),
 (98.1728,102.0922,'Alexa+ interaction simulator · real MCP · synthetic household · virtual devices.'),
]
def stamp(sec):
 ms=round(sec*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
 return f'{h:02}:{m:02}:{s:02},{ms:03}'
srt=[]
for i,(a,b,t) in enumerate(cues,1):srt.append(f'{i}\n{stamp(a+1.5)} --> {stamp(b+1.5)}\n{textwrap.fill(t,70)}\n')
(ROOT/'threshold-demo.en.srt').write_text('\n'.join(srt))
manifest={'duration':DURATION,'resolution':[1920,1080],'fps':30,'source':'Actual CDP screen recording of the running prototype. No fabricated UI states.','editing':'Chronological per scene. Holds retimed and some waits accelerated for narration. Initial 3 viewport-resize frames omitted from scene2. Lower thirds are editorial. Audio starts at1.5s.','disclosure':'Alexa+ interaction simulator, real MCP, synthetic household, virtual devices.','narration_sha256':hashlib.sha256((ROOT/'narration.mp3').read_bytes()).hexdigest(),'segments':renders}
(ROOT/'edit-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Rendering',len(renders),'real-source frame segments.',flush=True)
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','warning','-f','concat','-safe','0','-i',str(OUT/'frames.ffconcat'),'-i',str(ROOT/'narration.mp3'),'-i',str(ROOT/'threshold-demo.en.srt'),'-filter_complex','[0:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=105.4:d=0.6[v];[1:a]adelay=1500|1500,apad,alimiter=limit=0.95[a]','-map','[v]','-map','[a]','-map','2:0','-t','106','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=Threshold — A little less to carry','-metadata','comment=Actual prototype UI. Alexa+ interaction simulator, real MCP, synthetic household, virtual devices. Holds edited and waits accelerated for narration.','-movflags','+faststart',str(ROOT/'threshold-demo.mp4')],check=True)
print(ROOT/'threshold-demo.mp4')
