#!/usr/bin/env python3
"""
Fix injection site values in test files to match HTML dropdown options.

The HTML dropdown uses: abdomen_left, abdomen_right
But tests were using: left_abdomen, right_abdomen

This script fixes the mismatch.
"""

import re
import glob

def fix_injection_sites(content):
    """Replace incorrect injection site values with correct ones."""

    # Map from incorrect test values to correct HTML values
    replacements = {
        'right_abdomen': 'abdomen_right',
        'left_abdomen': 'abdomen_left',
        # The following are already correct, but included for completeness:
        # 'left_thigh': 'left_thigh',  # Already correct
        # 'right_thigh': 'right_thigh',  # Already correct
        # 'left_arm': 'left_arm',  # Already correct
        # 'right_arm': 'right_arm',  # Already correct
    }

    for old_value, new_value in replacements.items():
        # Replace in string literals (quoted)
        content = content.replace(f"'{old_value}'", f"'{new_value}'")
        content = content.replace(f'"{old_value}"', f'"{new_value}"')

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
        before_right = content.count("'right_abdomen'") + content.count('"right_abdomen"')
        before_left = content.count("'left_abdomen'") + content.count('"left_abdomen"')
        before_total = before_right + before_left

        if before_total == 0:
            print(f"  [SKIP] No incorrect injection sites found")
            continue

        # Fix injection sites
        fixed_content = fix_injection_sites(content)

        # Count occurrences after fix
        after_right = fixed_content.count("'right_abdomen'") + fixed_content.count('"right_abdomen"')
        after_left = fixed_content.count("'left_abdomen'") + fixed_content.count('"left_abdomen"')
        after_total = after_right + after_left

        changes = before_total - after_total

        if changes > 0:
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed_content)

            print(f"  [OK] Fixed {changes} injection site values")
            if before_right > 0:
                print(f"    - right_abdomen -> abdomen_right: {before_right}")
            if before_left > 0:
                print(f"    - left_abdomen -> abdomen_left: {before_left}")

            fixed_count += changes
            files_modified.append(filepath)
        else:
            print(f"  [WARN] Found {before_total} incorrect values but couldn't fix them")

    print(f"\nTotal injection site values fixed: {fixed_count}")
    print(f"Files modified: {len(files_modified)}")

    if files_modified:
        print("\nModified files:")
        for f in files_modified:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
