#!/usr/bin/env python3
"""
Fix page.reload() calls in test files to use reloadPage() helper.

This ensures that app.data is properly loaded from localStorage after page reloads.
"""

import re
import os
import glob

def fix_reload_calls(content):
    """Replace page.reload() with reloadPage(page) pattern."""

    # Pattern 1: await page.reload();
    #           await waitForAppReady(page);
    # Replace with: await reloadPage(page);
    pattern1 = r'await page\.reload\(\);\s*\n\s*await waitForAppReady\(page\);'
    content = re.sub(pattern1, 'await reloadPage(page);', content)

    # Pattern 2: await page.reload(); (standalone)
    # Only if NOT followed by waitForAppReady (already handled above)
    # This shouldn't exist, but let's handle it
    pattern2 = r'await page\.reload\(\);(?!\s*\n\s*await waitForAppReady)'
    content = re.sub(pattern2, 'await reloadPage(page);', content)

    return content

def main():
    # Find all test files
    test_files = []
    test_files.extend(glob.glob('tests/e2e/*.spec.js'))
    test_files.extend(glob.glob('tests/smoke/*.spec.js'))

    fixed_count = 0
    files_modified = []

    for filepath in test_files:
        print(f"Processing: {filepath}")

        # Read file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Count occurrences before fix
        before_count = content.count('await page.reload()')

        if before_count == 0:
            print(f"  [SKIP] No page.reload() calls found")
            continue

        # Fix reload calls
        fixed_content = fix_reload_calls(content)

        # Count occurrences after fix
        after_count = fixed_content.count('await page.reload()')
        changes = before_count - after_count

        if changes > 0:
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed_content)

            print(f"  [OK] Fixed {changes} page.reload() calls")
            fixed_count += changes
            files_modified.append(filepath)
        else:
            print(f"  [WARN] Found {before_count} page.reload() but couldn't fix them")

    print(f"\nTotal page.reload() calls fixed: {fixed_count}")
    print(f"Files modified: {len(files_modified)}")

    if files_modified:
        print("\nModified files:")
        for f in files_modified:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
