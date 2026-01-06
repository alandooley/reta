#!/usr/bin/env python3
"""
Fix Vial Shot Distribution in DynamoDB

This script corrects the vial_id assignments for injections to ensure
shots are properly distributed to the correct vials based on chronological
order and vial capacity constraints.

Problem: vial_20241029_3 (a dry_stock vial) incorrectly has 7 shots assigned.
Solution: Redistribute shots to earlier vials that should have them.

Usage:
    python3 fix_vial_shot_distribution.py --profile reta-admin --region eu-west-1

Requirements:
    pip install boto3
"""

import argparse
import json
from datetime import datetime
from decimal import Decimal


def get_dynamodb_client(profile_name, region):
    """Create DynamoDB client with specified profile."""
    import boto3
    session = boto3.Session(profile_name=profile_name, region_name=region)
    return session.client('dynamodb')


def scan_all_items(dynamodb, table_name, entity_type):
    """Scan all items of a specific entity type."""
    items = []
    scan_kwargs = {
        'TableName': table_name,
        'FilterExpression': 'entityType = :type',
        'ExpressionAttributeValues': {':type': {'S': entity_type}}
    }

    while True:
        response = dynamodb.scan(**scan_kwargs)
        items.extend(response.get('Items', []))

        if 'LastEvaluatedKey' not in response:
            break
        scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']

    return items


def parse_dynamo_value(value):
    """Parse a DynamoDB value into Python type."""
    if 'S' in value:
        return value['S']
    elif 'N' in value:
        return float(value['N'])
    elif 'NULL' in value:
        return None
    elif 'BOOL' in value:
        return value['BOOL']
    return value


def format_dynamo_value(value):
    """Format a Python value for DynamoDB."""
    if value is None:
        return {'NULL': True}
    elif isinstance(value, str):
        return {'S': value}
    elif isinstance(value, (int, float, Decimal)):
        return {'N': str(value)}
    elif isinstance(value, bool):
        return {'BOOL': value}
    return {'S': str(value)}


def parse_item(item):
    """Parse a DynamoDB item into a Python dict."""
    return {k: parse_dynamo_value(v) for k, v in item.items()}


def get_correct_vial_for_date(date_str):
    """
    Determine the correct vial ID for a given injection date.

    Vial assignments based on reconstitution dates:
    - vial_20240805_1: reconstituted 2025-08-05, used Aug 6 through Sep 6
    - vial_20240805_2: reconstituted 2025-09-13, used Sep 13 through Sep 27
    - vial_20241029_1: reconstituted 2025-10-29, used Oct 30 onwards

    Dry stock vials (20241029_2, _3, _4) should NEVER have shots assigned.
    """
    if not date_str:
        return None

    date_prefix = date_str[:10]

    # Chronological assignment based on vial reconstitution dates
    if date_prefix < '2025-09-13':
        # Before Sep 13: use first vial (Aug 5 batch)
        return 'vial_20240805_1'
    elif date_prefix < '2025-10-29':
        # Sep 13 to Oct 28: use second vial (Sep 13 reconstitution)
        return 'vial_20240805_2'
    else:
        # Oct 29 onwards: use third vial (Oct 29 batch)
        return 'vial_20241029_1'


def get_dynamo_to_clean_vial_mapping():
    """
    Map DynamoDB UUID vial IDs to clean_data.json vial IDs.

    Based on analysis of vials_db.json and injections_db.json:
    - 25eaa9d1-676f-47c8-ad0b-6e5783bb912e: has Sep 13 shot -> maps to vial_20240805_2
    - c45df327-4a87-4cb6-971b-f490d03e5ae1: has Sep 20, Sep 27 shots -> maps to vial_20240805_2
    - vial-1: has Nov 5 shots -> maps to vial_20241029_1

    Note: Both UUID vials appear to be the same logical vial (vial_20240805_2).
    """
    return {
        '25eaa9d1-676f-47c8-ad0b-6e5783bb912e': 'vial_20240805_2',
        'c45df327-4a87-4cb6-971b-f490d03e5ae1': 'vial_20240805_2',
        'vial-1': 'vial_20241029_1',
    }


# Vials that should NEVER have shots (dry stock)
DRY_STOCK_VIALS = ['vial_20241029_2', 'vial_20241029_3', 'vial_20241029_4']


def main():
    parser = argparse.ArgumentParser(description='Fix vial shot distribution in DynamoDB')
    parser.add_argument('--profile', default='reta-admin', help='AWS profile name')
    parser.add_argument('--region', default='eu-west-1', help='AWS region')
    parser.add_argument('--table', default='reta-data', help='DynamoDB table name')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    args = parser.parse_args()

    print(f"Connecting to DynamoDB (profile: {args.profile}, region: {args.region})...")
    dynamodb = get_dynamodb_client(args.profile, args.region)

    # Fetch all injections
    print("Fetching all injections...")
    raw_injections = scan_all_items(dynamodb, args.table, 'INJECTION')
    injections = [parse_item(item) for item in raw_injections]
    print(f"  Found {len(injections)} injections")

    # Fetch all vials
    print("Fetching all vials...")
    raw_vials = scan_all_items(dynamodb, args.table, 'VIAL')
    vials = [parse_item(item) for item in raw_vials]
    print(f"  Found {len(vials)} vials")

    # Analyze current distribution
    print("\n" + "="*60)
    print("Current vial distribution:")
    print("="*60)
    vial_shots = {}
    for inj in injections:
        vial_id = inj.get('vialId') or 'NULL/unassigned'
        if vial_id not in vial_shots:
            vial_shots[vial_id] = []
        vial_shots[vial_id].append({
            'timestamp': inj.get('timestamp'),
            'doseMg': inj.get('doseMg'),
            'SK': inj.get('SK'),
            'PK': inj.get('PK')
        })

    for vial_id, shots in sorted(vial_shots.items(), key=lambda x: str(x[0])):
        total_mg = sum(s['doseMg'] or 0 for s in shots)
        is_dry_stock = any(ds in str(vial_id) for ds in DRY_STOCK_VIALS)
        warning = " [WARNING] SHOULD NOT HAVE SHOTS!" if is_dry_stock else ""
        print(f"  {vial_id}: {len(shots)} shots, {total_mg}mg total{warning}")
        for shot in sorted(shots, key=lambda x: x['timestamp'] or ''):
            print(f"    - {shot['timestamp'][:10] if shot['timestamp'] else 'unknown'}: {shot['doseMg']}mg")

    # Calculate changes needed
    print("\n" + "="*60)
    print("Changes needed:")
    print("="*60)

    changes = []
    for inj in injections:
        timestamp = inj.get('timestamp', '')
        current_vial = inj.get('vialId')

        # Find correct vial for this date
        correct_vial = get_correct_vial_for_date(timestamp)

        if not correct_vial:
            print(f"  [!] Cannot determine vial for {timestamp}")
            continue

        # Check if current assignment is wrong
        needs_change = False
        if current_vial is None:
            # Unassigned - needs to be assigned
            needs_change = True
        elif any(ds in str(current_vial) for ds in DRY_STOCK_VIALS):
            # Assigned to dry stock vial - must fix
            needs_change = True
        elif current_vial != correct_vial:
            # Assigned to wrong active vial - fix
            needs_change = True

        if needs_change:
            changes.append({
                'PK': inj['PK'],
                'SK': inj['SK'],
                'timestamp': timestamp,
                'doseMg': inj.get('doseMg'),
                'current_vial': current_vial or 'NULL',
                'correct_vial': correct_vial
            })
            print(f"  {timestamp[:10] if timestamp else 'unknown'} ({inj.get('doseMg')}mg): {current_vial or 'NULL'} -> {correct_vial}")

    if not changes:
        print("  No changes needed - distribution is already correct!")
        return

    print(f"\nTotal changes: {len(changes)}")

    # Show expected final distribution
    print("\n" + "="*60)
    print("Expected distribution after fix:")
    print("="*60)
    expected = {}
    for inj in injections:
        timestamp = inj.get('timestamp', '')
        vial = get_correct_vial_for_date(timestamp)
        if vial not in expected:
            expected[vial] = {'count': 0, 'mg': 0}
        expected[vial]['count'] += 1
        expected[vial]['mg'] += inj.get('doseMg') or 0

    for vial, stats in sorted(expected.items()):
        print(f"  {vial}: {stats['count']} shots, {stats['mg']}mg total")

    if args.dry_run:
        print("\n[DRY RUN] No changes applied")
        print("Run without --dry-run to apply changes")
        return

    # Apply changes
    print("\nApplying changes...")
    success_count = 0
    error_count = 0

    for change in changes:
        print(f"  Updating {change['SK'][:40]}...")
        try:
            dynamodb.update_item(
                TableName=args.table,
                Key={
                    'PK': format_dynamo_value(change['PK']),
                    'SK': format_dynamo_value(change['SK'])
                },
                UpdateExpression='SET vialId = :vialId, updatedAt = :updatedAt',
                ExpressionAttributeValues={
                    ':vialId': format_dynamo_value(change['correct_vial']),
                    ':updatedAt': format_dynamo_value(datetime.utcnow().isoformat() + 'Z')
                }
            )
            print(f"    [OK] Updated to {change['correct_vial']}")
            success_count += 1
        except Exception as e:
            print(f"    [FAIL] Error: {e}")
            error_count += 1

    print(f"\nDone! Updated {success_count} injections, {error_count} errors")


if __name__ == '__main__':
    main()
