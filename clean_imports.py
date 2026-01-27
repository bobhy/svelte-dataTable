import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace $lib imports
    new_content = re.sub(r'from "\$lib/([^"]*)\.js"', r'from "$lib/\1.ts"', content)
    new_content = re.sub(r"from '\$lib/([^']*)\.js'", r"from '$lib/\1.ts'", new_content)
    
    # Replace relative imports
    new_content = re.sub(r'from "\.([^"]*)\.js"', r'from ".\1.ts"', new_content)
    new_content = re.sub(r"from '\.([^']*)\.js'", r"from '.\1.ts'", new_content)

    if content != new_content:
        print(f"Updating {filepath}")
        with open(filepath, 'w') as f:
            f.write(new_content)

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.svelte') or file.endswith('.ts'):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    if os.path.exists("src/lib"):
        walk_dir("src/lib")
    if os.path.exists("frontend/src/lib"):
        walk_dir("frontend/src/lib")
