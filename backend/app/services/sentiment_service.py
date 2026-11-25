"""Customer sentiment analysis and objection detection service."""

import re
from typing import Optional


POSITIVE_PATTERNS = [
    r"\b(great|awesome|excellent|love|interested|sounds good|perfect|helpful|amazing|wonderful|excited|yes please|sure|definitely|let'?s do it|book|confirm)\b",
    r"(अच्छा|बढ़िया|सही|पसंद|रुचि|ज़रूर|ठीक है|शानदार)",
]

NEGATIVE_PATTERNS = [
    r"\b(expensive|too costly|too high|waste|bad|terrible|worst|not interested|annoying|frustrated|useless|slow|scam|spam|cancel|never mind|too complicated|don'?t want|no thanks)\b",
    r"(महंगा|बेकार|खराब|नहीं चाहिए|गलत|परेशान|बंद)",
]

OBJECTION_MAP = [
    (r"\b(expensive|costly|price is high|too much|budget tight|over budget|महंगा)\b", "Pricing / Budget concern"),
    (r"\b(security|privacy|data safe|cloud|on-?premise|local)\b", "Data privacy / hosting concern"),
    (r"\b(time|long|delay|how many weeks|too slow|जल्दी)\b", "Implementation timeline concern"),
    (r"\b(already have|existing crm|current tool|competitor)\b", "Existing tool / switching cost"),
    (r"\b(not sure|think about it|later|ask my team|manager)\b", "Needs internal stakeholder approval"),
]


def analyze_sentiment(
    text: str,
    llm_sentiment: Optional[str] = None,
    llm_reason: Optional[str] = None,
) -> tuple[str, str, list[str]]:
    """Classify customer sentiment (Positive, Neutral, Negative) and extract objections."""
    lowered = (text or "").lower()

    pos_hits = sum(len(re.findall(p, lowered, re.IGNORECASE)) for p in POSITIVE_PATTERNS)
    neg_hits = sum(len(re.findall(p, lowered, re.IGNORECASE)) for p in NEGATIVE_PATTERNS)

    objections: list[str] = []
    for pattern, label in OBJECTION_MAP:
        if re.search(pattern, lowered, re.IGNORECASE):
            objections.append(label)

    # Strong negative signals override generic politeness
    if neg_hits > pos_hits and neg_hits > 0:
        sentiment = "Negative"
        reason = llm_reason or "Customer expressed concern, dissatisfaction, or pushback."
    elif llm_sentiment in ("Positive", "Neutral", "Negative"):
        sentiment = llm_sentiment
        reason = llm_reason or f"Detected {sentiment.lower()} conversational tone."
    elif pos_hits > neg_hits and pos_hits > 0:
        sentiment = "Positive"
        reason = "Customer showed enthusiasm, agreement, or constructive interest."
    else:
        sentiment = "Neutral"
        reason = "Informational or exploratory inquiry with neutral tone."

    return sentiment, reason, objections
