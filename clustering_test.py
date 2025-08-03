import csv
import json
import os
import uuid
import random
from datetime import datetime
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import pdist
import numpy as np

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
    """Save responses to JSON file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(RESPONSES_JSON_PATH), exist_ok=True)
        
        with open(RESPONSES_JSON_PATH, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving responses: {e}")

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

def manhattan_distance(answers1, answers2):
    """Calculate Manhattan distance between two answer sets"""
    if len(answers1) != len(answers2):
        return float('inf')
    
    distance = sum(abs(a1 - a2) for a1, a2 in zip(answers1, answers2))
    return distance

def hierarchical_clustering_groups_of_4():
    """Perform hierarchical clustering to create groups of ~4 people"""
    data = load_responses_json()
    responses = data['responses']
    
    if len(responses) < 2:
        return {}
    
    # Prepare data for clustering
    user_ids = list(responses.keys())
    answer_vectors = [responses[uid]['answers'] for uid in user_ids]
    
    if len(user_ids) <= 4:
        # If 4 or fewer people, put them all in one group
        return {uid: user_ids for uid in user_ids}
    
    # Calculate pairwise Manhattan distances
    distances = []
    for i in range(len(answer_vectors)):
        for j in range(i + 1, len(answer_vectors)):
            dist = manhattan_distance(answer_vectors[i], answer_vectors[j])
            distances.append(dist)
    
    # Perform hierarchical clustering
    if len(distances) > 0:
        linkage_matrix = linkage(distances, method='ward')
        
        # Determine number of clusters (aim for groups of 4)
        n_users = len(user_ids)
        target_clusters = max(1, n_users // 4)
        
        # Get cluster assignments
        cluster_labels = fcluster(linkage_matrix, target_clusters, criterion='maxclust')
        
        # Group users by cluster
        clusters = {}
        for i, label in enumerate(cluster_labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(user_ids[i])
        
        # Balance clusters (merge small ones with larger ones)
        cluster_list = list(clusters.values())
        balanced_clusters = []
        
        for cluster in cluster_list:
            if len(cluster) >= 3:
                balanced_clusters.append(cluster)
            elif balanced_clusters:
                # Merge small cluster with the smallest existing cluster
                smallest_idx = min(range(len(balanced_clusters)), 
                                 key=lambda x: len(balanced_clusters[x]))
                balanced_clusters[smallest_idx].extend(cluster)
            else:
                balanced_clusters.append(cluster)
        
        # Create final groupings
        final_groups = {}
        for group in balanced_clusters:
            for user_id in group:
                final_groups[user_id] = group
        
        return final_groups
    
    # Fallback: random groups of 4
    random.shuffle(user_ids)
    groups = {}
    for i in range(0, len(user_ids), 4):
        group = user_ids[i:i+4]
        for uid in group:
            groups[uid] = group
    
    return groups

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
    """Calculate matches for all users"""
    data = load_responses_json()
    
    # Perform clustering
    groups = hierarchical_clustering_groups_of_4()
    
    # Generate matches and reasons for each user
    matches = {}
    for user_id, group_members in groups.items():
        # Get other members (exclude self)
        other_members = [uid for uid in group_members if uid != user_id]
        member_names = [data['responses'][uid]['name'] for uid in other_members if uid in data['responses']]
        
        # Generate compatibility reasons
        reasons = generate_compatibility_reasons(user_id, group_members)
        
        matches[user_id] = {
            'group_ids': other_members,
            'names': member_names,
            'reasons': reasons
        }
    
    # Save matches
    data['matches'] = matches
    data['system']['matches_calculated'] = True
    save_responses_json(data)
    
    return matches

def activate_results():
    """Toggle results activation - called when secret URL is hit"""
    try:
        data = load_responses_json()
        
        # Toggle activation state
        current_state = data['system'].get('activated', False)
        new_state = not current_state
        
        if new_state:
            # Activating results
            calculate_all_matches()
            data['system']['activated'] = True
            data['system']['activation_time'] = datetime.now().isoformat()
            message = f"Results ACTIVATED! {len(data['responses'])} users will see countdown automatically."
            action = "activated"
        else:
            # Deactivating results
            data['system']['activated'] = False
            data['system']['activation_time'] = None
            data['system']['matches_calculated'] = False
            data['matches'] = {}  # Clear matches
            message = f"Results DEACTIVATED! Users will return to waiting state."
            action = "deactivated"
        
        save_responses_json(data)
        
        return {
            "status": "success", 
            "message": message,
            "action": action,
            "user_count": len(data['responses']),
            "activated": new_state
        }
    except Exception as e:
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
    """Get matches for a specific user"""
    data = load_responses_json()
    
    if not data['system']['activated']:
        return {"error": "Results not activated yet"}
    
    if user_id not in data['matches']:
        return {"error": "User not found or no matches calculated"}
    
    user_info = data['responses'].get(user_id, {})
    match_info = data['matches'][user_id]
    
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
    """Check if results have been activated - only load when needed"""
    try:
        print(f"Checking activation status, file path: {RESPONSES_JSON_PATH}")
        
        # Ensure file exists before trying to read it
        if not os.path.exists(RESPONSES_JSON_PATH):
            print("Responses file doesn't exist, creating it...")
            load_responses_json()  # This will create the file
        
        # Now read the file
        with open(RESPONSES_JSON_PATH, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        result = {
            "activated": data.get('system', {}).get('activated', False),
            "activation_time": data.get('system', {}).get('activation_time'),
            "user_count": len(data.get('responses', {})),
            "matches_calculated": data.get('system', {}).get('matches_calculated', False)
        }
        
        print(f"Activation status result: {result}")
        return result
        
    except Exception as e:
        print(f"Error in check_activation_status: {e}")
        # Return safe defaults
        return {
            "activated": False,
            "activation_time": None,
            "user_count": 0,
            "matches_calculated": False
        }