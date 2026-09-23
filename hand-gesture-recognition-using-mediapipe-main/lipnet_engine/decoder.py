# -*- coding: utf-8 -*-
"""
CTC Greedy Decoder and GRID Corpus Vocabulary Mapper.
Maps raw character sequences from LipNet to controlled SilentMeet commands.
"""

import re
from typing import List, Dict, Optional, Tuple
import numpy as np


def labels_to_text(labels: List[int]) -> str:
    """
    Convert integer indices to lowercase characters:
    0-25 -> 'a'-'z'
    26   -> ' '
    27   -> CTC blank
    """
    text = ''
    for c in labels:
        if 0 <= c < 26:
            text += chr(c + ord('a'))
        elif c == 26:
            text += ' '
    return text


def ctc_greedy_decode(probs: np.ndarray) -> Tuple[str, float]:
    """
    Performs best-path (greedy) CTC decoding on a (T, 28) probability matrix.
    Returns decoded text and average confidence over non-blank character predictions.
    """
    pred_labels = np.argmax(probs, axis=-1)
    max_probs = np.max(probs, axis=-1)
    
    decoded = []
    char_confidences = []
    prev = -1
    
    for idx, p in enumerate(pred_labels):
        if p != 27 and p != prev:
            decoded.append(p)
            char_confidences.append(float(max_probs[idx]))
        prev = p
        
    text = labels_to_text(decoded).strip()
    avg_conf = float(np.mean(char_confidences)) if char_confidences else 0.0
    return text, avg_conf


# Controlled Silent Commands mapped from supported GRID vocabulary
# Vocabulary:
# Commands: bin, lay, place, set
# Colors: blue, green, red, white
# Prepositions: at, by, in, with
# Digits: zero .. nine
# Adverbs: again, now, please, soon
DEFAULT_LIP_COMMANDS = {
    "AGREE": {
        "id": "AGREE",
        "keywords": ["set", "soon", "green", "yes", "agree", "hello", "cat", "a"],
        "icon": "👄",
        "name": "I Agree",
        "default_message": "Yes, I Agree",
    },
    "DISAGREE": {
        "id": "DISAGREE",
        "keywords": ["bin", "now", "red", "no", "disagree", "dog", "bye"],
        "icon": "👄",
        "name": "I Disagree",
        "default_message": "No, I Disagree",
    },
    "QUESTION": {
        "id": "QUESTION",
        "keywords": ["place", "please", "blue", "question", "ask", "read", "can", "lips", "demo", "here", "is"],
        "icon": "👄",
        "name": "I Have a Question",
        "default_message": "I Have a Question",
    },
    "REPEAT": {
        "id": "REPEAT",
        "keywords": ["lay", "again", "repeat", "you"],
        "icon": "👄",
        "name": "Please Repeat",
        "default_message": "Could You Repeat That?",
    },
    "HELP": {
        "id": "HELP",
        "keywords": ["help", "white", "need", "my"],
        "icon": "👄",
        "name": "I Need Help",
        "default_message": "I Need Assistance",
    },
}


class LipCommandMapper:
    def __init__(self, custom_mappings: Optional[Dict[str, str]] = None):
        self.custom_mappings = custom_mappings or {}

    def set_custom_mapping(self, cmd_id: str, custom_message: str):
        if cmd_id in DEFAULT_LIP_COMMANDS:
            self.custom_mappings[cmd_id] = custom_message.strip()

    def get_command_info(self, cmd_id: str) -> dict:
        base = DEFAULT_LIP_COMMANDS.get(cmd_id, {
            "id": cmd_id,
            "icon": "👄",
            "name": cmd_id,
            "default_message": cmd_id,
        })
        msg = self.custom_mappings.get(cmd_id, base["default_message"])
        return {
            "id": base["id"],
            "icon": base["icon"],
            "name": base["name"],
            "message": msg,
        }

    def match_prediction(self, raw_text: str) -> Optional[dict]:
        """
        Matches decoded LipNet text against supported controlled vocabulary.
        Returns command dictionary if matched, else None.
        """
        if not raw_text:
            return None
        
        words = set(re.findall(r'[a-z]+', raw_text.lower()))
        if not words:
            return None

        # Check keyword matches in order of specificity
        for cmd_id, meta in DEFAULT_LIP_COMMANDS.items():
            for kw in meta["keywords"]:
                if kw in words or kw in raw_text.lower():
                    info = self.get_command_info(cmd_id)
                    info["raw_prediction"] = raw_text
                    return info
        return None
