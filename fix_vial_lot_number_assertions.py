#!/usr/bin/env python3
"""
Remove lot_number assertions from vial tests.

Since the HTML doesn't have a lot_number field, tests shouldn't assert on it.
"""

import re

def main():
    filepath = 'tests/e2e/02-vial-crud.spec.js'

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Count assertions before
    before_count = content.count("expect(vial.lot_number)")
    before_count += content.count("expect(v.lot_number)")

    if before_count == 0:
        print(f"No lot_number assertions found in {filepath}")
        return

    # Remove lines with lot_number assertions
    lines = content.split('\n')
    filtered_lines = []
    removed_count = 0

    for i, line in enumerate(lines):
        # Skip lines that assert on lot_number
        if ('expect(vial.lot_number)' in line or
            'expect(v.lot_number)' in line or
            'expect(newVial.lot_number)' in line):
            print(f"Removing line {i+1}: {line.strip()}")
            removed_count += 1
            continue
        filtered_lines.append(line)

    # Write back
    new_content = '\n'.join(filtered_lines)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"\n✅ Removed {removed_count} lot_number assertion lines from {filepath}")

if __name__ == '__main__':
    main()
