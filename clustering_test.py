import csv
import json
import os
import uuid
import random
from datetime import datetime
from sklearn.cluster import KMeans
import pandas as pd
import numpy as np

# Configuration
GROUP_SIZE = 3

# File paths
QUESTIONS_CSV_PATH = 'static/datasets/questions.csv'
RESPONSES_JSON_PATH = 'static/datasets/responses.json'

def load_questions_from_csv():
    """Load questions and answer choices from CSV file"""
    try:
        with open(QUESTIONS_CSV_PATH, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            rows = list(reader)
            
        if not rows:
            return []
            
        questions = []
        
        # Process each column as a question
        num_columns = len(rows[0])
        
        for col_idx in range(num_columns):
            question_text = rows[0][col_idx]
            answer_choices = []
            
            # Get answer choices from subsequent rows
            for row_idx in range(1, len(rows)):
                if col_idx < len(rows[row_idx]) and rows[row_idx][col_idx].strip():
                    answer_choices.append(rows[row_idx][col_idx].strip())
            
            if question_text and answer_choices:
                questions.append({
                    'question': question_text,
                    'choices': answer_choices
                })
        
        return questions
    except FileNotFoundError:
        print(f"Questions file not found: {QUESTIONS_CSV_PATH}")
        return []
    except Exception as e:
        print(f"Error loading questions: {e}")
        return []

def load_responses_json():
    """Load responses from JSON file"""
    try:
        with open(RESPONSES_JSON_PATH, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        # Create initial structure if file doesn't exist
        initial_data = {
            "system": {
                "activated": False,
                "activation_time": None,
                "matches_calculated": False
            },
            "responses": {},
            "matches": {}
        }
        save_responses_json(initial_data)
        print(f"Created initial responses file at: {RESPONSES_JSON_PATH}")
        return initial_data
    except Exception as e:
        print(f"Error loading responses: {e}")
        return {
            "system": {
                "activated": False,
                "activation_time": None,
                "matches_calculated": False
            }, 
            "responses": {}, 
            "matches": {}
        }

def save_responses_json(data):
    """Save responses to JSON file - WITH DEBUG PRINTS"""
    try:
        print(f"DEBUG: Attempting to save to: {RESPONSES_JSON_PATH}")
        print(f"DEBUG: Data keys being saved: {list(data.keys())}")
        print(f"DEBUG: Number of matches being saved: {len(data.get('matches', {}))}")
        print(f"DEBUG: Matches data preview: {list(data.get('matches', {}).keys())}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(RESPONSES_JSON_PATH), exist_ok=True)
        
        with open(RESPONSES_JSON_PATH, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
        
        print("DEBUG: File saved successfully")
        
        # Verify the save worked by reading it back
        with open(RESPONSES_JSON_PATH, 'r', encoding='utf-8') as file:
            verification_data = json.load(file)
        
        print(f"DEBUG: Verification - matches in saved file: {len(verification_data.get('matches', {}))}")
        print(f"DEBUG: Verification - system.matches_calculated: {verification_data.get('system', {}).get('matches_calculated', False)}")
        
    except Exception as e:
        print(f"DEBUG: ERROR saving responses: {e}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        raise e

def generate_unique_id(name):
    """Generate unique ID to avoid duplicate names"""
    data = load_responses_json()
    existing_names = {user_data.get('name', '').lower() for user_data in data['responses'].values()}
    
    base_name = name.lower().strip()
    if base_name not in existing_names:
        return str(uuid.uuid4())[:8]
    
    # If name exists, generate unique ID anyway
    return str(uuid.uuid4())[:8]

def save_user_response(name, answers):
    """Save user response with unique ID"""
    data = load_responses_json()
    user_id = generate_unique_id(name)
    
    data['responses'][user_id] = {
        'name': name.strip(),
        'answers': answers,
        'timestamp': datetime.now().isoformat()
    }
    
    save_responses_json(data)
    return user_id

def create_dataframe_from_responses(responses):
    """Convert responses dict to pandas DataFrame"""
    user_ids = list(responses.keys())
    answer_vectors = [responses[uid]['answers'] for uid in user_ids]
    df = pd.DataFrame(answer_vectors, index=user_ids)
    return df

def calculate_optimal_clusters(n_users):
    """Calculate optimal number of clusters based on group size"""
    return max(1, n_users // GROUP_SIZE)

def calculate_match_distance(answers1, answers2):
    """Calculate distance based on number of different answers (categorical)"""
    return sum(a1 != a2 for a1, a2 in zip(answers1, answers2))

def perform_categorical_clustering(responses):
    """Apply clustering using categorical distance matrix"""
    from sklearn.metrics import pairwise_distances
    from sklearn.cluster import AgglomerativeClustering
    
    user_ids = list(responses.keys())
    n_users = len(user_ids)
    
    if n_users <= GROUP_SIZE:
        return [user_ids]
    
    # Create distance matrix for categorical data
    answer_vectors = [responses[uid]['answers'] for uid in user_ids]
    
    # Calculate pairwise distances using Hamming distance (for categorical data)
    distance_matrix = []
    for i in range(n_users):
        row = []
        for j in range(n_users):
            if i == j:
                row.append(0)
            else:
                dist = calculate_match_distance(answer_vectors[i], answer_vectors[j])
                row.append(dist)
        distance_matrix.append(row)
    
    # Use AgglomerativeClustering with precomputed distance matrix
    k = calculate_optimal_clusters(n_users)
    clustering = AgglomerativeClustering(
        n_clusters=k, 
        metric='precomputed', 
        linkage='average'
    )
    cluster_labels = clustering.fit_predict(distance_matrix)
    
    # Group users by cluster
    clusters = {}
    for user_id, label in zip(user_ids, cluster_labels):
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(user_id)
    
    return list(clusters.values())

def balance_small_groups(groups):
    """Merge groups smaller than GROUP_SIZE with larger groups"""
    large_groups = [g for g in groups if len(g) >= GROUP_SIZE]
    small_groups = [g for g in groups if len(g) < GROUP_SIZE]
    
    # Merge small groups with large ones
    for small_group in small_groups:
        if large_groups:
            # Add to smallest large group
            smallest = min(large_groups, key=len)
            smallest.extend(small_group)
        else:
            # If no large groups, keep small group as is
            large_groups.append(small_group)
    
    return large_groups

def create_user_groups_mapping(balanced_groups):
    """Create mapping from user_id to their group"""
    user_groups = {}
    for group in balanced_groups:
        for user_id in group:
            user_groups[user_id] = group
    return user_groups

def perform_sklearn_clustering():
    """Main clustering function using categorical distance - WITH DEBUG PRINTS"""
    print("\n=== DEBUG: perform_sklearn_clustering started ===")
    
    data = load_responses_json()
    responses = data['responses']
    
    print(f"DEBUG: Found {len(responses)} responses")
    
    if len(responses) < 2:
        print("DEBUG: Less than 2 responses, returning empty dict")
        return {}
    
    # Apply categorical clustering
    groups = perform_categorical_clustering(responses)
    print(f"DEBUG: Clustering returned {len(groups)} groups: {groups}")
    
    # Balance groups to target GROUP_SIZE
    balanced_groups = balance_small_groups(groups)
    print(f"DEBUG: After balancing: {len(balanced_groups)} groups: {balanced_groups}")
    
    # Create user-to-group mapping
    user_groups = create_user_groups_mapping(balanced_groups)
    print(f"DEBUG: Final user_groups mapping: {user_groups}")
    
    print("=== DEBUG: perform_sklearn_clustering completed ===\n")
    return user_groups

def generate_compatibility_reasons(user_id, group_members):
    """Generate simple compatibility reasons"""
    data = load_responses_json()
    responses = data['responses']
    questions = load_questions_from_csv()
    
    if user_id not in responses or not group_members:
        return ["You were matched based on your questionnaire responses."]
    
    user_answers = responses[user_id]['answers']
    reasons = []
    
    # Count similar answers across the group
    similar_questions = []
    for q_idx, question in enumerate(questions):
        if q_idx < len(user_answers):
            user_answer = user_answers[q_idx]
            
            # Check how many group members have the same answer
            same_answer_count = sum(1 for member_id in group_members 
                                  if member_id in responses 
                                  and q_idx < len(responses[member_id]['answers'])
                                  and responses[member_id]['answers'][q_idx] == user_answer)
            
            if same_answer_count >= len(group_members) * 0.6:  # 60% or more have same answer
                similar_questions.append((q_idx, question['question'], 
                                        question['choices'][user_answer] if user_answer < len(question['choices']) else 'N/A'))
    
    # Generate reasons based on similarities
    if len(similar_questions) >= 3:
        reasons.append(f"You answered {len(similar_questions)} questions very similarly")
        
        # Add specific examples
        for q_idx, question, choice in similar_questions[:2]:  # Show top 2 examples
            reasons.append(f"You all chose '{choice}' for: {question}")
    
    elif len(similar_questions) >= 1:
        reasons.append("You share some key preferences with your group")
        for q_idx, question, choice in similar_questions[:1]:
            reasons.append(f"You all prefer: {choice}")
    
    else:
        reasons.append("You were matched to create a diverse and interesting group")
        reasons.append("Sometimes the best connections come from different perspectives!")
    
    return reasons[:3]  # Limit to 3 reasons max

def calculate_all_matches():
    """Calculate matches for all users using sklearn clustering - WITH DEBUG PRINTS"""
    print("\n=== DEBUG: calculate_all_matches started ===")
    
    data = load_responses_json()
    print(f"DEBUG: Loaded {len(data.get('responses', {}))} user responses")
    print(f"DEBUG: User IDs: {list(data.get('responses', {}).keys())}")
    
    # Perform clustering
    user_groups = perform_sklearn_clustering()
    print(f"DEBUG: Clustering returned {len(user_groups)} user-group mappings")
    print(f"DEBUG: user_groups structure: {user_groups}")
    
    # Generate matches and reasons for each user
    matches = {}
    for user_id, group_members in user_groups.items():
        print(f"DEBUG: Processing user {user_id} with group {group_members}")
        
        # Get other members (exclude self)
        other_members = [uid for uid in group_members if uid != user_id]
        member_names = [data['responses'][uid]['name'] for uid in other_members if uid in data['responses']]
        
        print(f"DEBUG: User {user_id} -> other_members: {other_members}, names: {member_names}")
        
        # Generate compatibility reasons
        reasons = generate_compatibility_reasons(user_id, group_members)
        
        matches[user_id] = {
            'group_ids': other_members,
            'names': member_names,
            'reasons': reasons
        }
        print(f"DEBUG: Created match entry for {user_id}: {matches[user_id]}")
    
    print(f"DEBUG: Final matches dictionary: {matches}")
    
    # Save matches
    data['matches'] = matches
    data['system']['matches_calculated'] = True
    
    print(f"DEBUG: About to save - matches count: {len(matches)}")
    print(f"DEBUG: About to save - system matches_calculated: {data['system']['matches_calculated']}")
    
    save_responses_json(data)
    
    # Double-check by loading the file again
    verification_data = load_responses_json()
    print(f"DEBUG: After save verification - matches count: {len(verification_data.get('matches', {}))}")
    print(f"DEBUG: After save verification - matches_calculated: {verification_data.get('system', {}).get('matches_calculated', False)}")
    
    print("DEBUG: Matches saved to JSON file")
    print("=== DEBUG: calculate_all_matches completed ===\n")
    
    return matches

def activate_results():
    """Toggle results activation - called when secret URL is hit - WITH DEBUG"""
    print("\n=== DEBUG: activate_results started ===")
    
    try:
        data = load_responses_json()
        print(f"DEBUG: Initial data loaded - matches count: {len(data.get('matches', {}))}")
        
        # Toggle activation state
        current_state = data['system'].get('activated', False)
        new_state = not current_state
        print(f"DEBUG: Toggling from {current_state} to {new_state}")
        
        if new_state:
            # Activating results
            print("DEBUG: About to call calculate_all_matches()")
            matches = calculate_all_matches()  # This should save the data internally
            print(f"DEBUG: calculate_all_matches returned {len(matches)} matches")
            
            # DON'T reload data here - use the data that was already updated
            print("DEBUG: Setting activation flags...")
            data['system']['activated'] = True
            data['system']['activation_time'] = datetime.now().isoformat()
            
            # The matches should already be saved by calculate_all_matches()
            # But let's verify they're still there
            current_data = load_responses_json()
            print(f"DEBUG: After calculate_all_matches, file has {len(current_data.get('matches', {}))} matches")
            
            if len(current_data.get('matches', {})) == 0:
                print("DEBUG: ERROR - Matches were lost! Re-setting them...")
                current_data['matches'] = matches
            
            current_data['system']['activated'] = True
            current_data['system']['activation_time'] = datetime.now().isoformat()
            
            print("DEBUG: About to save final activation state...")
            save_responses_json(current_data)
            
            message = f"Results ACTIVATED! {len(current_data['responses'])} users will see countdown automatically."
            action = "activated"
        else:
            # Deactivating results
            print("DEBUG: Deactivating results...")
            data['system']['activated'] = False
            data['system']['activation_time'] = None
            data['system']['matches_calculated'] = False
            data['matches'] = {}  # Clear matches
            save_responses_json(data)
            message = f"Results DEACTIVATED! Users will return to waiting state."
            action = "deactivated"
        
        # Final verification
        final_data = load_responses_json()
        print(f"DEBUG: Final verification - matches in file: {len(final_data.get('matches', {}))}")
        print(f"DEBUG: Final verification - activated: {final_data.get('system', {}).get('activated', False)}")
        
        print("=== DEBUG: activate_results completed ===\n")
        
        return {
            "status": "success", 
            "message": message,
            "action": action,
            "user_count": len(final_data['responses']),
            "activated": new_state
        }
    except Exception as e:
        print(f"DEBUG: ERROR in activate_results: {e}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        return {"status": "error", "message": f"Error toggling results: {str(e)}"}

def get_current_activation_state():
    """Get current activation state without toggling"""
    try:
        data = load_responses_json()
        return {
            "activated": data['system'].get('activated', False),
            "user_count": len(data['responses']),
            "matches_calculated": data['system'].get('matches_calculated', False)
        }
    except:
        return {"activated": False, "user_count": 0, "matches_calculated": False}

def get_user_matches(user_id):
    """Get matches for a specific user - WITH DEBUG PRINTS"""
    print(f"\n=== DEBUG: get_user_matches called for user_id: {user_id} ===")
    
    data = load_responses_json()
    print(f"DEBUG: Loaded data keys: {list(data.keys())}")
    print(f"DEBUG: System activated: {data.get('system', {}).get('activated', False)}")
    print(f"DEBUG: Matches calculated: {data.get('system', {}).get('matches_calculated', False)}")
    
    if not data['system']['activated']:
        print("DEBUG: System not activated - returning error")
        return {"error": "Results not activated yet"}
    
    print(f"DEBUG: Available user_ids in responses: {list(data.get('responses', {}).keys())}")
    print(f"DEBUG: Available user_ids in matches: {list(data.get('matches', {}).keys())}")
    print(f"DEBUG: Looking for user_id: '{user_id}' (type: {type(user_id)})")
    
    # Check if user exists in responses
    if user_id not in data.get('responses', {}):
        print(f"DEBUG: user_id '{user_id}' NOT FOUND in responses")
        return {"error": f"User ID '{user_id}' not found in responses"}
    
    # Check if user exists in matches
    if user_id not in data.get('matches', {}):
        print(f"DEBUG: user_id '{user_id}' NOT FOUND in matches")
        print(f"DEBUG: Matches dict structure: {data.get('matches', {})}")
        return {"error": f"User ID '{user_id}' not found in matches. Available matches: {list(data.get('matches', {}).keys())}"}
    
    user_info = data['responses'].get(user_id, {})
    match_info = data['matches'][user_id]
    
    print(f"DEBUG: Found user_info: {user_info}")
    print(f"DEBUG: Found match_info: {match_info}")
    print("DEBUG: Successfully returning matches")
    
    return {
        "user_name": user_info.get('name', 'Unknown'),
        "matches": match_info['names'],
        "reasons": match_info['reasons'],
        "group_size": len(match_info['names']) + 1  # +1 for the user themselves
    }

def get_admin_stats():
    """Get statistics for admin/debugging"""
    data = load_responses_json()
    
    stats = {
        "total_responses": len(data['responses']),
        "activated": data['system']['activated'],
        "matches_calculated": data['system']['matches_calculated'],
        "activation_time": data['system'].get('activation_time'),
        "sample_responses": []
    }
    
    # Add sample response data (first 5 users)
    for i, (user_id, response) in enumerate(data['responses'].items()):
        if i < 5:
            stats["sample_responses"].append({
                "id": user_id,
                "name": response['name'],
                "timestamp": response['timestamp']
            })
    
    return stats

def check_activation_status():
    """Check if results have been activated - WITH DEBUG PRINTS"""
    print(f"\n=== DEBUG: check_activation_status called ===")
    print(f"DEBUG: Checking file path: {RESPONSES_JSON_PATH}")
    
    try:
        # Ensure file exists before trying to read it
        if not os.path.exists(RESPONSES_JSON_PATH):
            print("DEBUG: Responses file doesn't exist, creating it...")
            load_responses_json()  # This will create the file
        
        # Now read the file
        with open(RESPONSES_JSON_PATH, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        print(f"DEBUG: File loaded successfully")
        print(f"DEBUG: System data: {data.get('system', {})}")
        print(f"DEBUG: Number of responses: {len(data.get('responses', {}))}")
        print(f"DEBUG: Number of matches: {len(data.get('matches', {}))}")
        
        result = {
            "activated": data.get('system', {}).get('activated', False),
            "activation_time": data.get('system', {}).get('activation_time'),
            "user_count": len(data.get('responses', {})),
            "matches_calculated": data.get('system', {}).get('matches_calculated', False)
        }
        
        print(f"DEBUG: Returning result: {result}")
        print("=== DEBUG: check_activation_status completed ===\n")
        return result
        
    except Exception as e:
        print(f"DEBUG: Error in check_activation_status: {e}")
        # Return safe defaults
        return {
            "activated": False,
            "activation_time": None,
            "user_count": 0,
            "matches_calculated": False
        }