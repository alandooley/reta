#!/usr/bin/env python3
"""
Fix form field ID mismatches in test files.

HTML vs. Test Mismatches:
1. Vial form:
   - HTML has: #vial-mg, #vial-quantity, #vial-supplier, #vial-order-date
   - Tests use: #vial-total-mg ❌, #vial-lot-number ❌ (doesn't exist!)

2. Weight form:
   - HTML has: #weight-date, #weight-kg, #weight-body-fat
   - Tests use: #weight-date ✅, #weight-kg ✅, #weight-body-fat ✅ (all correct!)

3. Settings:
   - HTML has: #user-height, #goal-weight, #default-dose
   - Tests use: #goal-weight ✅, #user-height (need to check)
"""

import re
import glob

def fix_vial_form_fields(content):
    """Fix vial form field ID mismatches."""

    # Fix #vial-total-mg → #vial-mg
    content = content.replace("'#vial-total-mg'", "'#vial-mg'")
    content = content.replace('"#vial-total-mg"', '"#vial-mg"')

    # Remove all references to #vial-lot-number (field doesn't exist in HTML)
    # This is trickier - we need to remove the entire line
    lines = content.split('\n')
    filtered_lines = []

    for line in lines:
        # Skip lines that try to fill the non-existent vial-lot-number field
        if '#vial-lot-number' in line and 'fillInput' in line:
            print(f"  [REMOVED] Line referencing non-existent #vial-lot-number: {line.strip()[:60]}...")
            continue
        filtered_lines.append(line)

    return '\n'.join(filtered_lines)

def fix_weight_form_fields(content):
    """Check weight form fields (already correct based on grep)."""
    # Weight form fields are already correct:
    # - #weight-date ✅
    # - #weight-kg ✅
    # - #weight-body-fat ✅
    return content

def fix_settings_fields(content):
    """Fix settings field ID mismatches (if any)."""
    # Settings fields appear correct:
    # - #user-height (need to verify usage)
    # - #goal-weight ✅
    # - #default-dose (need to verify usage)
    return content

def main():
    # Test files to fix
    test_files = {
        'tests/e2e/02-vial-crud.spec.js': fix_vial_form_fields,
        'tests/e2e/07-weight-crud.spec.js': fix_weight_form_fields,
        'tests/e2e/11-settings.spec.js': fix_settings_fields,
        'tests/smoke/pre-deploy.spec.js': fix_vial_form_fields,  # Also has vial references
    }

    total_changes = 0
    files_modified = []

    for filepath, fix_function in test_files.items():
        print(f"\nProcessing: {filepath}")

        try:
            # Read file
            with open(filepath, 'r', encoding='utf-8') as f:
                original_content = f.read()

            # Count occurrences before fix
            before_vial_total_mg = original_content.count('#vial-total-mg')
            before_vial_lot_number = original_content.count('#vial-lot-number')

            if before_vial_total_mg == 0 and before_vial_lot_number == 0:
                print(f"  [SKIP] No vial form field issues found")
                continue

            # Apply fixes
            fixed_content = fix_function(original_content)

            # Count changes
            changes_total_mg = before_vial_total_mg
            changes_lot_number = before_vial_lot_number
            total_file_changes = changes_total_mg + changes_lot_number

            if total_file_changes > 0:
                # Write back
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(fixed_content)

                print(f"  [OK] Fixed {total_file_changes} issues:")
                if changes_total_mg > 0:
                    print(f"    - #vial-total-mg -> #vial-mg: {changes_total_mg}")
                if changes_lot_number > 0:
                    print(f"    - #vial-lot-number references removed: {changes_lot_number}")

                total_changes += total_file_changes
                files_modified.append(filepath)

        except FileNotFoundError:
            print(f"  [SKIP] File not found: {filepath}")
            continue
        except Exception as e:
            print(f"  [ERROR] Failed to process {filepath}: {e}")
            continue

    print(f"\n{'='*60}")
    print(f"Total issues fixed: {total_changes}")
    print(f"Files modified: {len(files_modified)}")

    if files_modified:
        print(f"\nModified files:")
        for f in files_modified:
            print(f"  - {f}")

    print(f"\n{'='*60}")
    print("NEXT STEPS:")
    print("1. Run vial tests:")
    print("   npx playwright test tests/e2e/02-vial-crud.spec.js --reporter=list")
    print("\n2. Run smoke tests:")
    print("   npx playwright test tests/smoke/pre-deploy.spec.js --reporter=list")
    print("\n3. Run full test suite:")
    print("   npx playwright test tests/e2e tests/smoke --reporter=list")

if __name__ == '__main__':
    main()
