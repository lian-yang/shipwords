import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
results=[]
for section in ['common','home','legal','pages']:
 en=json.loads((root/f'messages/{section}/en.json').read_text())
 zh=json.loads((root/f'messages/{section}/zh.json').read_text())
 assert en.keys()==zh.keys(),section
 for key in en.keys()-{'$schema'}:
  assert isinstance(en[key],str) and isinstance(zh[key],str),key
  assert set(re.findall(r'\{(\w+)\}',en[key]))==set(re.findall(r'\{(\w+)\}',zh[key])),key
  assert not re.search(r'TODO|FIXME|TBD',zh[key],re.I),key
 results.append({'block':section,'messages_per_locale':len(en)-1,'keys_and_placeholders':'matched'})
for old in ['AI 图片生成器','你的图还在生成','你的图已经好了','图片归你使用']:
 assert old not in (root/'messages/home/zh.json').read_text(),old
print(json.dumps(results,ensure_ascii=False,indent=2))
