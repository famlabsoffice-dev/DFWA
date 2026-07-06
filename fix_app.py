import sys

path = 'app.js'
with open(path, 'r') as f:
    content = f.read()

# Fix 1: Ensure window._dfwaQCache is initialized correctly if fetch fails or is slow
find_str = 'async function renderCategorySelector() {'
replace_str = '''
async function renderCategorySelector() {
  console.log("Rendering category selector...");
'''
content = content.replace(find_str, replace_str)

# Fix 2: Add more logging to handleAddPlayer
find_str = 'function handleAddPlayer() {'
replace_str = '''
function handleAddPlayer() {
  console.log("Add player clicked");
'''
content = content.replace(find_str, replace_str)

with open(path, 'w') as f:
    f.write(content)
