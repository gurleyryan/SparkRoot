from collections import Counter
from typing import Dict, List, Any, Optional, Union
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    from deckgen import get_mana_curve_targets
except ImportError:
    # Fallback: duplicate the table if import fails
    def get_mana_curve_targets(commander_cmc: int) -> Dict[Union[int, str], int]:
        MANA_CURVE_TARGETS: Dict[int, Dict[Union[int, str], int]] = {
            2: {1: 9, 2: 0, 3: 20, 4: 14, 5: 9, 6: 4, "mana_rocks": 1, "lands": 42},
            3: {1: 8, 2: 19, 3: 0, 4: 16, 5: 10, 6: 3, "mana_rocks": 1, "lands": 42},
            4: {1: 6, 2: 12, 3: 13, 4: 0, 5: 13, 6: 8, "mana_rocks": 7, "lands": 39},
            5: {1: 6, 2: 12, 3: 10, 4: 13, 5: 0, 6: 10, "mana_rocks": 8, "lands": 39},
            6: {1: 6, 2: 12, 3: 10, 4: 14, 5: 9, 6: 0, "mana_rocks": 9, "lands": 38},
        }
        return MANA_CURVE_TARGETS.get(int(commander_cmc), MANA_CURVE_TARGETS[4])


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
    house_rules = deck_data.get("house_rules", False)
    commander_cmc = int(commander.get("cmc", 4))
    curve_targets = get_mana_curve_targets(commander_cmc)
    mana_analysis = analyze_mana_curve(deck, commander_cmc, curve_targets, house_rules)
    type_analysis = analyze_card_types(deck, curve_targets, house_rules)
    synergy_analysis = analyze_synergies(deck, commander)
    balance_analysis = analyze_deck_balance(deck)

    # Calculate overall score
    overall_score = calculate_composite_score(
        {
            "mana_curve": mana_analysis["score"],
            "type_balance": type_analysis["score"],
            "synergy": synergy_analysis["score"],
            "deck_balance": balance_analysis["score"],
        }
    )

    return {
        "overall_score": overall_score,
        "grade": get_score_grade(overall_score),
        "mana_curve": mana_analysis,
        "card_types": type_analysis,
        "synergies": synergy_analysis,
        "balance": balance_analysis,
        "recommendations": generate_recommendations(
            deck, commander, overall_score, curve_targets, house_rules
        ),
        "strengths": identify_strengths(deck, commander),
        "weaknesses": identify_weaknesses(deck, commander),
    }


def analyze_mana_curve(
    deck: List[Dict[str, Any]],
    commander_cmc: int,
    curve_targets: Dict[Union[int, str], int],
    house_rules: bool = False,
) -> Dict[str, Any]:
    """
    Analyze mana curve and calculate curve quality score, using curve targets from deckgen.py

    Args:
        deck: List of card dictionaries representing the deck
        commander_cmc: CMC of the commander
        curve_targets: Mana curve targets for the deck
        house_rules: Whether House Rules are in effect (e.g., Sol Ring restrictions)

    Returns:
        dict: Mana curve analysis with score and recommendations
    """
    # Exclude lands
    nonland_cards = [
        card for card in deck if "land" not in str(card.get("type_line", "")).lower()
    ]
    cmc_values: List[int] = [
        int(card.get("cmc", 0)) for card in nonland_cards if card.get("cmc") is not None
    ]
    cmc_distribution: Counter[int] = Counter(cmc_values)
    total_nonland_cards = len(nonland_cards)

    # Actual curve counts for 0-5, and 6+ drops
    actual_curve: Dict[Union[int, str], int] = {0: cmc_distribution.get(0, 0)}
    for n in range(1, 6):
        actual_curve[n] = cmc_distribution.get(n, 0)
    actual_curve["6+"] = sum(
        cmc_distribution.get(k, 0) for k in cmc_distribution if k >= 6
    )

    # Curve targets: add 0 and "6+" (use 6's target for "6+")
    curve_targets_report: Dict[Union[int, str], int] = {0: 0}
    for n in range(1, 6):
        curve_targets_report[n] = curve_targets.get(n, 0)
    curve_targets_report["6+"] = curve_targets.get(6, 0)

    # N-drop detection
    n_drop_count = cmc_distribution.get(commander_cmc, 0)
    n_drop_cards = [
        card for card in nonland_cards if int(card.get("cmc", 0)) == commander_cmc
    ]

    # Mana rocks detection (artifacts with ramp/mana, excluding Sol Ring if house_rules)
    mana_rocks = [
        card
        for card in nonland_cards
        if "artifact" in str(card.get("type_line", "")).lower()
        and (
            "ramp" in str(card.get("keywords", [])).lower()
            or "mana" in str(card.get("keywords", [])).lower()
            or "mana" in str(card.get("type_line", "")).lower()
        )
        and (not house_rules or card.get("name", "").lower() != "sol ring")
    ]
    mana_rocks_count = len(mana_rocks)

    # Land count
    land_count = len(
        [card for card in deck if "land" in str(card.get("type_line", "")).lower()]
    )

    # Small deviation logic
    deviation = 2
    curve_warnings: List[str] = []
    for k in actual_curve:
        target = curve_targets_report.get(k, 0)
        actual = actual_curve[k]
        if abs(actual - target) > deviation:
            curve_warnings.append(
                f"{k}-drops: {actual} (target {target}) is off by more than {deviation}"
            )

    # N-drop warning
    if n_drop_count > 0:
        curve_warnings.append(
            f"Deck has {n_drop_count} cards with CMC equal to commander ({commander_cmc}). Review for synergy."
        )

    # Mana rocks warning
    mana_rocks_target = curve_targets.get("mana_rocks", 0)
    if abs(mana_rocks_count - mana_rocks_target) > deviation:
        curve_warnings.append(
            f"Mana rocks: {mana_rocks_count} (target {mana_rocks_target}) is off by more than {deviation}"
        )

    # Sol Ring warning
    if house_rules and any(
        card.get("name", "").lower() == "sol ring" for card in mana_rocks
    ):
        curve_warnings.append("Sol Ring is present but banned by House Rules.")

    # Land warning
    lands_target = curve_targets.get("lands", 0)
    if abs(land_count - lands_target) > deviation:
        curve_warnings.append(
            f"Lands: {land_count} (target {lands_target}) is off by more than {deviation}"
        )

    # Score: penalize large deviations
    score = max(
        0,
        100
        - sum(
            abs(actual_curve[k] - curve_targets_report.get(k, 0)) for k in actual_curve
        )
        * 2,
    )
    avg_cmc = sum(cmc_values) / len(cmc_values) if cmc_values else 0
    return {
        "score": round(score, 1),
        "average_cmc": round(avg_cmc, 2),
        "actual_curve": actual_curve,
        "curve_targets": curve_targets_report,
        "mana_rocks": mana_rocks_count,
        "mana_rocks_target": mana_rocks_target,
        "lands": land_count,
        "lands_target": lands_target,
        "n_drop_count": n_drop_count,
        "n_drop_cards": n_drop_cards,
        "curve_warnings": curve_warnings,
        "total_nonland_cards": total_nonland_cards,
    }


def analyze_card_types(
    deck: List[Dict[str, Any]],
    curve_targets: Optional[Dict[Union[int, str], int]] = None,
    house_rules: bool = False,
) -> Dict[str, Any]:
    """
    Analyze card type distribution and balance

    Args:
        deck: List of card dictionaries representing the deck
        curve_targets: Mana curve targets for the deck (optional)
        house_rules: Whether House Rules are in effect (e.g., Sol Ring restrictions)

    Returns:
        dict: Card type analysis with balance score
    """
    type_counts: Dict[str, int] = {
        "lands": 0,
        "creatures": 0,
        "instants": 0,
        "sorceries": 0,
        "enchantments": 0,
        "artifacts": 0,
        "planeswalkers": 0,
        "mana_rocks": 0,
    }

    # Count card types
    for card in deck:
        type_line = card.get("type_line", "").lower()
        name = card.get("name", "").lower()
        if "land" in type_line:
            type_counts["lands"] += 1
        elif "creature" in type_line:
            type_counts["creatures"] += 1
        elif "instant" in type_line:
            type_counts["instants"] += 1
        elif "sorcery" in type_line:
            type_counts["sorceries"] += 1
        elif "enchantment" in type_line:
            type_counts["enchantments"] += 1
        elif "artifact" in type_line:
            type_counts["artifacts"] += 1
            # Mana rock detection
            if (
                "ramp" in str(card.get("keywords", [])).lower()
                or "mana" in str(card.get("keywords", [])).lower()
                or "mana" in type_line
            ) and (not house_rules or name != "sol ring"):
                type_counts["mana_rocks"] += 1
        elif "planeswalker" in type_line:
            type_counts["planeswalkers"] += 1

    total_cards = len(deck)
    type_percentages: Dict[str, float] = {
        k: float(v / total_cards * 100) for k, v in type_counts.items()
    }

    # Use curve_targets for ideal counts if provided
    ideal_types = {
        "lands": curve_targets.get("lands", 36) if curve_targets else 36,
        "creatures": 29,
        "instants": 10,
        "sorceries": 8,
        "enchantments": 6,
        "artifacts": 6,
        "planeswalkers": 4,
        "mana_rocks": curve_targets.get("mana_rocks", 6) if curve_targets else 6,
    }

    total_deviation = sum(abs(type_counts[t] - ideal_types[t]) for t in ideal_types)
    balance_score = max(0, 100 - (total_deviation * 2))
    return {
        "score": round(balance_score, 1),
        "distribution": type_counts,
        "percentages": type_percentages,
        "ideal_counts": ideal_types,
    }


def analyze_synergies(
    deck: List[Dict[str, Any]], commander: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Analyze tribal synergies, themes, and commander compatibility

    Returns:
        dict: Synergy analysis with theme detection
    """
    # Extract creature types for tribal analysis
    creature_types: list[str] = []
    themes: dict[str, int] = {
        "tribal": 0,
        "tokens": 0,
        "graveyard": 0,
        "artifacts": 0,
        "enchantments": 0,
        "spellslinger": 0,
        "ramp": 0,
        "card_draw": 0,
        "removal": 0,
    }

    for card in deck:
        type_line = card.get("type_line", "").lower()
        oracle_text = card.get("oracle_text", "").lower()

        # Extract creature types
        if "creature" in type_line:
            # Simple tribal detection (Angel, Elf, etc.)
            creature_subtypes = type_line.split("—")
            if len(creature_subtypes) > 1:
                subtypes = creature_subtypes[1].strip().split()
                creature_types.extend(subtypes)

        # Theme detection keywords
        if any(word in oracle_text for word in ["token", "create", "populate"]):
            themes["tokens"] += 1
        if any(word in oracle_text for word in ["graveyard", "graveyard", "reanimate"]):
            themes["graveyard"] += 1
        if "artifact" in type_line:
            themes["artifacts"] += 1
        if "enchantment" in type_line:
            themes["enchantments"] += 1
        if any(word in oracle_text for word in ["instant", "sorcery", "spell"]):
            themes["spellslinger"] += 1
        if any(word in oracle_text for word in ["land", "ramp", "search"]):
            themes["ramp"] += 1
        if any(word in oracle_text for word in ["draw", "card"]):
            themes["card_draw"] += 1
        if any(word in oracle_text for word in ["destroy", "exile", "counter"]):
            themes["removal"] += 1

    # Find most common creature type
    creature_type_counts: Counter[str] = Counter(creature_types)
    primary_tribe = (
        creature_type_counts.most_common(1)[0] if creature_type_counts else (None, 0)
    )

    # Calculate synergy score based on theme consistency
    theme_scores: dict[str, float] = {}

    for theme, count in themes.items():
        theme_scores[theme] = (count / len(deck)) * 100

    # Overall synergy score (higher if deck has clear themes)
    synergy_score = (
        min(100, max(theme_scores.values()) * 2) if theme_scores.values() else 50
    )

    return {
        "score": round(synergy_score, 1),
        "primary_tribe": primary_tribe[0] if primary_tribe[1] >= 3 else None,
        "tribal_count": primary_tribe[1] if primary_tribe else 0,
        "themes": theme_scores,
        "strongest_theme": max(theme_scores.keys(), key=lambda k: theme_scores[k]),
        "commander_synergy": analyze_commander_synergy(commander, themes),
    }


def analyze_deck_balance(deck: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze deck balance (ramp, draw, removal, win conditions)

    Returns:
        dict: Balance analysis with recommendations
    """
    balance_categories: dict[str, int] = {
        "ramp": 0,
        "card_draw": 0,
        "removal": 0,
        "board_wipes": 0,
        "counterspells": 0,
        "win_conditions": 0,
    }

    for card in deck:
        oracle_text = card.get("oracle_text", "").lower()
        cmc = card.get("cmc", 0)

        # Ramp detection
        if any(
            word in oracle_text
            for word in ["land", "mana", "ramp", "search your library for a land"]
        ):
            balance_categories["ramp"] += 1

        # Card draw detection
        if any(word in oracle_text for word in ["draw", "card"]):
            balance_categories["card_draw"] += 1

        # Removal detection
        if any(word in oracle_text for word in ["destroy", "exile", "return to hand"]):
            balance_categories["removal"] += 1

        # Board wipe detection
        if any(
            word in oracle_text
            for word in ["all creatures", "each creature", "destroy all"]
        ):
            balance_categories["board_wipes"] += 1

        # Counterspell detection
        if "counter target" in oracle_text:
            balance_categories["counterspells"] += 1

        # Win condition detection (high CMC threats or combo pieces)
        if cmc >= 6 or any(
            word in oracle_text for word in ["win the game", "damage to each opponent"]
        ):
            balance_categories["win_conditions"] += 1

    # Calculate balance score based on having enough of each category
    ideal_balance: dict[str, int] = {
        "ramp": 10,  # ~10 ramp spells
        "card_draw": 8,  # ~8 draw spells
        "removal": 6,  # ~6 removal spells
        "board_wipes": 2,  # ~2 board wipes
        "counterspells": 3,  # ~3 counterspells (if blue)
        "win_conditions": 5,  # ~5 win conditions
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
        "score": round(final_balance_score, 1),
        "categories": balance_categories,
        "ideal_targets": ideal_balance,
        "recommendations": get_balance_recommendations(
            balance_categories, ideal_balance
        ),
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
        "mana_curve": 0.3,  # 30% - Curve is crucial
        "type_balance": 0.25,  # 25% - Type balance important
        "deck_balance": 0.25,  # 25% - Ramp/draw/removal balance
        "synergy": 0.2,  # 20% - Synergy nice to have
    }

    weighted_score = sum(scores[component] * weights[component] for component in scores)
    return round(weighted_score, 1)


def get_score_grade(score: float) -> str:
    """Convert numeric score to letter grade"""
    if score >= 90:
        return "A+"
    elif score >= 85:
        return "A"
    elif score >= 80:
        return "A-"
    elif score >= 75:
        return "B+"
    elif score >= 70:
        return "B"
    elif score >= 65:
        return "B-"
    elif score >= 60:
        return "C+"
    elif score >= 55:
        return "C"
    elif score >= 50:
        return "C-"
    else:
        return "D"


def generate_recommendations(
    deck: List[Dict[str, Any]],
    commander: Dict[str, Any],
    overall_score: float,
    curve_targets: Dict[Union[int, str], int],
    house_rules: bool,
) -> List[str]:
    """Generate actionable recommendations for deck improvement"""
    recommendations: List[str] = []
    # Curve analysis
    nonland_cards = [
        card for card in deck if "land" not in str(card.get("type_line", "")).lower()
    ]
    cmc_distribution: Counter[int] = Counter(
        [
            int(card.get("cmc", 0))
            for card in nonland_cards
            if card.get("cmc") is not None
        ]
    )
    deviation = 2
    for n in range(1, 7):
        target = curve_targets.get(n, 0)
        actual = cmc_distribution.get(n, 0)
        if abs(actual - target) > deviation:
            recommendations.append(
                f"Consider adjusting {n}-drops: {actual} (target {target})"
            )
    # N-drop detection
    commander_cmc = int(commander.get("cmc", 4))
    n_drop_count = cmc_distribution.get(commander_cmc, 0)
    if n_drop_count > 0:
        recommendations.append(
            f"Review {n_drop_count} cards with CMC equal to commander ({commander_cmc}) for synergy."
        )
    # Mana rocks
    mana_rocks = [
        card
        for card in nonland_cards
        if "artifact" in str(card.get("type_line", "")).lower()
        and (
            "ramp" in str(card.get("keywords", [])).lower()
            or "mana" in str(card.get("keywords", [])).lower()
            or "mana" in str(card.get("type_line", "")).lower()
        )
        and (not house_rules or card.get("name", "").lower() != "sol ring")
    ]
    mana_rocks_count = len(mana_rocks)
    mana_rocks_target = curve_targets.get("mana_rocks", 0)
    if abs(mana_rocks_count - mana_rocks_target) > deviation:
        recommendations.append(
            f"Consider adjusting mana rocks: {mana_rocks_count} (target {mana_rocks_target})"
        )
    # Sol Ring
    if house_rules and any(
        card.get("name", "").lower() == "sol ring" for card in mana_rocks
    ):
        recommendations.append("Sol Ring is present but banned by House Rules.")
    # Lands
    land_count = len(
        [card for card in deck if "land" in str(card.get("type_line", "")).lower()]
    )
    lands_target = curve_targets.get("lands", 0)
    if abs(land_count - lands_target) > deviation:
        recommendations.append(
            f"Consider adjusting lands: {land_count} (target {lands_target})"
        )
    # General recommendations
    if overall_score < 70:
        recommendations.append(
            "Deck score is below 70. Consider improving curve, balance, or synergy."
        )
    if overall_score < 60:
        recommendations.append("Deck score is below 60. Major improvements needed.")
    recommendations.append("Add more removal spells for better interaction")
    recommendations.append("Include 2-3 board wipes for reset capabilities")

    return recommendations


def identify_strengths(
    deck: List[Dict[str, Any]], commander: Dict[str, Any]
) -> List[str]:
    """Identify deck's main strengths"""
    return ["Strong creature base", "Good mana curve", "Clear strategy"]


def identify_weaknesses(
    deck: List[Dict[str, Any]], commander: Dict[str, Any]
) -> List[str]:
    """Identify deck's main weaknesses"""
    return ["Needs more removal", "Could use more card draw"]


def get_curve_recommendations(
    actual: Dict[int, float], ideal: Dict[int, float], avg_cmc: float
) -> List[str]:
    """Generate mana curve specific recommendations"""
    recommendations: list[str] = []

    if avg_cmc > 3.5:
        recommendations.append("Average CMC too high - add more low-cost cards")
    elif avg_cmc < 2.5:
        recommendations.append(
            "Average CMC too low - add more powerful high-cost threats"
        )

    return recommendations


def get_type_recommendations(
    actual: Dict[str, float], ideal: Dict[str, float]
) -> List[str]:
    """Generate card type balance recommendations"""
    recommendations: list[str] = []

    if actual["creatures"] < 15:
        recommendations.append("Add more creatures for board presence")
    if actual["lands"] < 25:
        recommendations.append("Add more lands for consistency")

    return recommendations


def get_balance_recommendations(
    actual: Dict[str, int], ideal: Dict[str, int]
) -> List[str]:
    """Generate deck balance recommendations"""
    recommendations: list[str] = []

    if actual["ramp"] < 8:
        recommendations.append("Add more ramp spells for mana acceleration")
    if actual["card_draw"] < 6:
        recommendations.append("Include more card draw engines")
    if actual["removal"] < 4:
        recommendations.append("Add more targeted removal spells")

    return recommendations


def analyze_commander_synergy(commander: Dict[str, Any], themes: Dict[str, int]) -> int:
    """Analyze how well the deck synergizes with its commander"""
    # Simple implementation - could be expanded with commander-specific logic
    return 75  # Placeholder score
