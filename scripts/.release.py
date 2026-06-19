import re

with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
    readme_str = f.read()

match_obj = re.findall(r'### v(\d+(?:\.\d+)+)\n(.*?)(?=\n### |\Z)', readme_str, re.DOTALL)
if match_obj:
    # h3_title = match_obj.group(0)
    latest_log = max(match_obj, key=lambda x: tuple(map(int, x[0].split('.'))))
    with open('result.txt', 'w') as f:
        f.write(latest_log[1])
else:
    with open('result.txt', 'w') as f:
        f.write("")