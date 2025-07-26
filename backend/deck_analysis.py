from collections import Counter
from typing import Dict, List, Any

def analyze_deck_quality(deck_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Comprehensive deck quality analysis with scoring
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        
    Returns:
        dict: Complete analysis with scores and recommendations
    """
    deck = deck_data["deck"]
    commander = deck_data["commander"]
    
    # Core analysis components
    mana_analysis = analyze_mana_curve(deck)
    type_analysis = analyze_card_types(deck)
    synergy_analysis = analyze_synergies(deck, commander)
    balance_analysis = analyze_deck_balance(deck)
    
    # Calculate overall score
    overall_score = calculate_composite_score({
        'mana_curve': mana_analysis['score'],
        'type_balance': type_analysis['score'],
        'synergy': synergy_analysis['score'],
        'deck_balance': balance_analysis['score']
    })
    
    return {
        'overall_score': overall_score,
        'grade': get_score_grade(overall_score),
        'mana_curve': mana_analysis,
        'card_types': type_analysis,
        'synergies': synergy_analysis,
        'balance': balance_analysis,
        'recommendations': generate_recommendations(deck, commander, overall_score),
        'strengths': identify_strengths(deck, commander),
        'weaknesses': identify_weaknesses(deck, commander)
    }


def analyze_mana_curve(deck: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze mana curve and calculate curve quality score
    
    Returns:
        dict: Mana curve analysis with score and recommendations
    """
    # Extract CMC values
    cmc_values: list[int] = []
    for card in deck:
        cmc = card.get('cmc', 0)
        if cmc is not None:
            cmc_values.append(int(cmc))
    
    # Count distribution
    cmc_distribution: Counter[int] = Counter(cmc_values)
    total_nonland_cards = len([c for c in deck if 'land' not in c.get('type_line', '').lower()])
    
    # Calculate percentages
    cmc_percentages: dict[int, float] = {}
    for cmc in range(0, 8):  # 0-7+ CMC
        count = cmc_distribution.get(cmc, 0)
        if cmc == 7:  # Combine 7+ CMC
            count += sum(cmc_distribution.get(i, 0) for i in range(7, 20))
        cmc_percentages[cmc] = (count / total_nonland_cards * 100) if total_nonland_cards > 0 else 0
    
    # Ideal curve percentages (based on EDH meta analysis)
    ideal_curve = {
        0: 5,   # 0 CMC: ~5% (Sol Ring, etc.)
        1: 15,  # 1 CMC: ~15% (cheap utility)
        2: 20,  # 2 CMC: ~20% (ramp, removal)
        3: 18,  # 3 CMC: ~18% (value engines)
        4: 15,  # 4 CMC: ~15% (powerful cards)
        5: 12,  # 5 CMC: ~12% (bombs)
        6: 8,   # 6 CMC: ~8% (big threats)
        7: 7    # 7+ CMC: ~7% (win conditions)
    }
    
    # Calculate curve score (100 - deviation from ideal)
    total_deviation = sum(abs(cmc_percentages[cmc] - ideal_curve[cmc]) for cmc in range(8))
    curve_score = max(0, 100 - (total_deviation / 2))  # Scale deviation
    
    # Average CMC
    avg_cmc = sum(cmc_values) / len(cmc_values) if cmc_values else 0
    
    # Convert all values to float for type compatibility
    cmc_percentages_float = {k: float(v) for k, v in cmc_percentages.items()}
    ideal_curve_float = {k: float(v) for k, v in ideal_curve.items()}
    return {
        'score': round(curve_score, 1),
        'average_cmc': round(avg_cmc, 2),
        'distribution': cmc_percentages_float,
        'ideal_distribution': ideal_curve_float,
        'total_nonland_cards': total_nonland_cards,
        'recommendations': get_curve_recommendations(cmc_percentages_float, ideal_curve_float, avg_cmc)
    }


def analyze_card_types(deck: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze card type distribution and balance
    
    Returns:
        dict: Card type analysis with balance score
    """
    type_counts: dict[str, int] = {
        'creatures': 0,
        'instants': 0,
        'sorceries': 0,
        'enchantments': 0,
        'artifacts': 0,
        'planeswalkers': 0,
        'lands': 0
    }

    # Count card types
    for card in deck:
        type_line = card.get('type_line', '').lower()
        if 'creature' in type_line:
            type_counts['creatures'] += 1
        elif 'instant' in type_line:
            type_counts['instants'] += 1
        elif 'sorcery' in type_line:
            type_counts['sorceries'] += 1
        elif 'enchantment' in type_line:
            type_counts['enchantments'] += 1
        elif 'artifact' in type_line:
            type_counts['artifacts'] += 1
        elif 'planeswalker' in type_line:
            type_counts['planeswalkers'] += 1
        elif 'land' in type_line:
            type_counts['lands'] += 1

    total_cards = len(deck)
    type_percentages: dict[str, float] = {k: float(v / total_cards * 100) for k, v in type_counts.items()}

    # Ideal type distribution for balanced Commander deck (matches CARD_TYPE_TARGETS in deckgen.py)
    ideal_types = {
        'lands': 36,         # 36 lands
        'creatures': 29,     # 29 creatures
        'instants': 10,      # 10 instants
        'sorceries': 8,      # 8 sorceries
        'enchantments': 6,   # 6 enchantments
        'artifacts': 6,      # 6 artifacts
        'planeswalkers': 4   # 4 planeswalkers
    }

    # Calculate balance score
    total_deviation = sum(abs(type_percentages[t] - (ideal_types[t] / 99 * 100)) for t in ideal_types)
    balance_score = max(0, 100 - (total_deviation / 3))  # Scale deviation

    ideal_types_float = {k: float(v / 99 * 100) for k, v in ideal_types.items()}
    return {
        'score': round(balance_score, 1),
        'distribution': type_counts,
        'percentages': type_percentages,
        'ideal_percentages': ideal_types_float,
        'recommendations': get_type_recommendations(type_percentages, ideal_types_float)
    }


def analyze_synergies(deck: List[Dict[str, Any]], commander: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze tribal synergies, themes, and commander compatibility
    
    Returns:
        dict: Synergy analysis with theme detection
    """
    # Extract creature types for tribal analysis
    creature_types: list[str] = []
    themes: dict[str, int] = {
        'tribal': 0,
        'tokens': 0,
        'graveyard': 0,
        'artifacts': 0,
        'enchantments': 0,
        'spellslinger': 0,
        'ramp': 0,
        'card_draw': 0,
        'removal': 0
    }
    
    for card in deck:
        type_line = card.get('type_line', '').lower()
        oracle_text = card.get('oracle_text', '').lower()
        
        # Extract creature types
        if 'creature' in type_line:
            # Simple tribal detection (Angel, Elf, etc.)
            creature_subtypes = type_line.split('—')
            if len(creature_subtypes) > 1:
                subtypes = creature_subtypes[1].strip().split()
                creature_types.extend(subtypes)
        
        # Theme detection keywords
        if any(word in oracle_text for word in ['token', 'create', 'populate']):
            themes['tokens'] += 1
        if any(word in oracle_text for word in ['graveyard', 'graveyard', 'reanimate']):
            themes['graveyard'] += 1
        if 'artifact' in type_line:
            themes['artifacts'] += 1
        if 'enchantment' in type_line:
            themes['enchantments'] += 1
        if any(word in oracle_text for word in ['instant', 'sorcery', 'spell']):
            themes['spellslinger'] += 1
        if any(word in oracle_text for word in ['land', 'ramp', 'search']):
            themes['ramp'] += 1
        if any(word in oracle_text for word in ['draw', 'card']):
            themes['card_draw'] += 1
        if any(word in oracle_text for word in ['destroy', 'exile', 'counter']):
            themes['removal'] += 1
    
    # Find most common creature type
    creature_type_counts: Counter[str] = Counter(creature_types)
    primary_tribe = creature_type_counts.most_common(1)[0] if creature_type_counts else (None, 0)
    
    # Calculate synergy score based on theme consistency
    theme_scores: dict[str, float] = {}
    
    for theme, count in themes.items():
        theme_scores[theme] = (count / len(deck)) * 100
    
    # Overall synergy score (higher if deck has clear themes)
    synergy_score = min(100, max(theme_scores.values()) * 2) if theme_scores.values() else 50
    
    return {
        'score': round(synergy_score, 1),
        'primary_tribe': primary_tribe[0] if primary_tribe[1] >= 3 else None,
        'tribal_count': primary_tribe[1] if primary_tribe else 0,
        'themes': theme_scores,
        'strongest_theme': max(theme_scores.keys(), key=lambda k: theme_scores[k]),
        'commander_synergy': analyze_commander_synergy(commander, themes)
    }


def analyze_deck_balance(deck: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze deck balance (ramp, draw, removal, win conditions)
    
    Returns:
        dict: Balance analysis with recommendations
    """
    balance_categories: dict[str, int] = {
        'ramp': 0,
        'card_draw': 0,
        'removal': 0,
        'board_wipes': 0,
        'counterspells': 0,
        'win_conditions': 0
    }
    
    for card in deck:
        oracle_text = card.get('oracle_text', '').lower()
        cmc = card.get('cmc', 0)
        
        # Ramp detection
        if any(word in oracle_text for word in ['land', 'mana', 'ramp', 'search your library for a land']):
            balance_categories['ramp'] += 1
        
        # Card draw detection
        if any(word in oracle_text for word in ['draw', 'card']):
            balance_categories['card_draw'] += 1
        
        # Removal detection
        if any(word in oracle_text for word in ['destroy', 'exile', 'return to hand']):
            balance_categories['removal'] += 1
        
        # Board wipe detection
        if any(word in oracle_text for word in ['all creatures', 'each creature', 'destroy all']):
            balance_categories['board_wipes'] += 1
        
        # Counterspell detection
        if 'counter target' in oracle_text:
            balance_categories['counterspells'] += 1
        
        # Win condition detection (high CMC threats or combo pieces)
        if cmc >= 6 or any(word in oracle_text for word in ['win the game', 'damage to each opponent']):
            balance_categories['win_conditions'] += 1
    
    # Calculate balance score based on having enough of each category
    ideal_balance: dict[str, int] = {
        'ramp': 10,           # ~10 ramp spells
        'card_draw': 8,       # ~8 draw spells
        'removal': 6,         # ~6 removal spells
        'board_wipes': 2,     # ~2 board wipes
        'counterspells': 3,   # ~3 counterspells (if blue)
        'win_conditions': 5   # ~5 win conditions
    }
    
    balance_score = 0
    total_categories = 0
    
    for category, count in balance_categories.items():
        ideal = ideal_balance[category]
        if count >= ideal:
            balance_score += 100
        else:
            balance_score += (count / ideal) * 100
        total_categories += 1
    
    final_balance_score = balance_score / total_categories
    
    return {
        'score': round(final_balance_score, 1),
        'categories': balance_categories,
        'ideal_targets': ideal_balance,
        'recommendations': get_balance_recommendations(balance_categories, ideal_balance)
    }


def calculate_composite_score(scores: Dict[str, float]) -> float:
    """
    Calculate weighted composite score from component scores
    
    Args:
        scores: Dict of component scores
        
    Returns:
        float: Weighted composite score (0-100)
    """
    weights = {
        'mana_curve': 0.3,    # 30% - Curve is crucial
        'type_balance': 0.25, # 25% - Type balance important
        'deck_balance': 0.25, # 25% - Ramp/draw/removal balance
        'synergy': 0.2       # 20% - Synergy nice to have
    }
    
    weighted_score = sum(scores[component] * weights[component] for component in scores)
    return round(weighted_score, 1)


def get_score_grade(score: float) -> str:
    """Convert numeric score to letter grade"""
    if score >= 90: return "A+"
    elif score >= 85: return "A"
    elif score >= 80: return "A-"
    elif score >= 75: return "B+"
    elif score >= 70: return "B"
    elif score >= 65: return "B-"
    elif score >= 60: return "C+"
    elif score >= 55: return "C"
    elif score >= 50: return "C-"
    else: return "D"


def generate_recommendations(deck: List[Dict[str, Any]], commander: Dict[str, Any], overall_score: float) -> List[str]:
    """Generate actionable recommendations for deck improvement"""
    recommendations: list[str] = []
    
    if overall_score < 70:
        recommendations.append("Consider adding more ramp and card draw for consistency")
    
    if overall_score < 60:
        recommendations.append("Deck needs better mana curve - consider lower CMC cards")
    
    recommendations.append("Add more removal spells for better interaction")
    recommendations.append("Include 2-3 board wipes for reset capabilities")
    
    return recommendations


def identify_strengths(deck: List[Dict[str, Any]], commander: Dict[str, Any]) -> List[str]:
    """Identify deck's main strengths"""
    return ["Strong creature base", "Good mana curve", "Clear strategy"]


def identify_weaknesses(deck: List[Dict[str, Any]], commander: Dict[str, Any]) -> List[str]:
    """Identify deck's main weaknesses"""
    return ["Needs more removal", "Could use more card draw"]


def get_curve_recommendations(actual: Dict[int, float], ideal: Dict[int, float], avg_cmc: float) -> List[str]:
    """Generate mana curve specific recommendations"""
    recommendations: list[str] = []
    
    if avg_cmc > 3.5:
        recommendations.append("Average CMC too high - add more low-cost cards")
    elif avg_cmc < 2.5:
        recommendations.append("Average CMC too low - add more powerful high-cost threats")
    
    return recommendations


def get_type_recommendations(actual: Dict[str, float], ideal: Dict[str, float]) -> List[str]:
    """Generate card type balance recommendations"""
    recommendations: list[str] = []
    
    if actual['creatures'] < 15:
        recommendations.append("Add more creatures for board presence")
    if actual['lands'] < 25:
        recommendations.append("Add more lands for consistency")
    
    return recommendations


def get_balance_recommendations(actual: Dict[str, int], ideal: Dict[str, int]) -> List[str]:
    """Generate deck balance recommendations"""
    recommendations: list[str] = []
    
    if actual['ramp'] < 8:
        recommendations.append("Add more ramp spells for mana acceleration")
    if actual['card_draw'] < 6:
        recommendations.append("Include more card draw engines")
    if actual['removal'] < 4:
        recommendations.append("Add more targeted removal spells")
    
    return recommendations


def analyze_commander_synergy(commander: Dict[str, Any], themes: Dict[str, int]) -> int:
    """Analyze how well the deck synergizes with its commander"""
    # Simple implementation - could be expanded with commander-specific logic
    return 75  # Placeholder score
