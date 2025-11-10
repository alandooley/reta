#!/usr/bin/env python3
"""Fix dates in clean_data.json to use correct year 2025"""

import json

# Read the original file
with open('clean_data.json', 'r') as f:
    data = json.load(f)

# Update all dates from 2024 to 2025
def update_dates(obj):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str) and value.startswith('2024-'):
                obj[key] = value.replace('2024-', '2025-')
            elif isinstance(value, (dict, list)):
                update_dates(value)
    elif isinstance(obj, list):
        for item in obj:
            update_dates(item)

update_dates(data)

# Fix dry stock expiration dates - should be 2 years from order date
for vial in data['vials']:
    if vial['status'] == 'dry_stock':
        order_date = vial['order_date']  # "2025-10-29"
        # Add 2 years
        year = int(order_date[:4])
        rest = order_date[4:]
        vial['expiration_date'] = f"{year + 2}{rest}"

# Write the corrected file
with open('clean_data.json', 'w') as f:
    json.dump(data, f, indent=2)

print("OK - Updated all dates to 2025")
print("OK - Fixed dry stock expiration dates to 2027")
print("\nVial Summary:")
for vial in data['vials']:
    status = vial['status']
    order = vial['order_date']
    exp = vial['expiration_date']
    print(f"  {vial['vial_id']}: {status.upper()} - ordered {order}, expires {exp}")
