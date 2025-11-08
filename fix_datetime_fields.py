#!/usr/bin/env python3
"""
Fix datetime field format in test files.
Combines separate date and time fills into single datetime-local format.

Example transformation:
  await fillInput(page, '#shot-date', '2025-11-07');
  await fillInput(page, '#shot-time', '14:30');

Becomes:
  await fillInput(page, '#shot-date', '2025-11-07T14:30');
"""

import re
import os
import glob

def fix_datetime_fields(content):
    """Fix datetime field format by combining date and time lines."""
    lines = content.split('\n')
    result = []
    skip_next = False

    i = 0
    while i < len(lines):
        if skip_next:
            skip_next = False
            i += 1
            continue

        line = lines[i]

        # Check if this line is a date fill and next line is time fill
        date_match = re.search(r"fillInput\(page, '(#[a-z-]+)-date', '(\d{4}-\d{2}-\d{2})'\)", line)

        if date_match and i + 1 < len(lines):
            field_prefix = date_match.group(1)  # e.g., '#shot', '#weight'
            date_value = date_match.group(2)    # e.g., '2025-11-07'
            next_line = lines[i + 1]

            # Check if next line has matching time field
            time_match = re.search(rf"fillInput\(page, '{field_prefix}-time', '(\d{{2}}:\d{{2}})'\)", next_line)

            if time_match:
                time_value = time_match.group(1)  # e.g., '14:30'

                # Combine into datetime-local format
                datetime_value = f"{date_value}T{time_value}"

                # Replace the date line with combined datetime
                fixed_line = line.replace(f"'{date_value}'", f"'{datetime_value}'")
                result.append(fixed_line)

                # Skip the next line (time fill)
                skip_next = True
                i += 1
                continue

        result.append(line)
        i += 1

    return '\n'.join(result)

def main():
    # Find all test files
    test_files = []
    test_files.extend(glob.glob('tests/e2e/*.spec.js'))
    test_files.extend(glob.glob('tests/smoke/*.spec.js'))

    fixed_count = 0

    for filepath in test_files:
        print(f"Processing: {filepath}")

        # Read file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix datetime fields
        fixed_content = fix_datetime_fields(content)

        # Check if anything changed
        if content != fixed_content:
            # Write back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed_content)

            # Count changes
            changes = content.count("fillInput(page, '#") - fixed_content.count("fillInput(page, '#")
            if changes > 0:
                print(f"  [OK] Fixed {changes} datetime field pairs")
                fixed_count += changes
        else:
            print(f"  [SKIP] No changes needed")

    print(f"\nTotal datetime field pairs fixed: {fixed_count}")

if __name__ == '__main__':
    main()
